// =====================================================================
// ThermoCare IoT · API REST
// Recibe las lecturas del parche (NodeMCU), calcula la temperatura del
// núcleo, guarda en MySQL, crea alertas y avisa por Telegram.
// =====================================================================
const express = require('express');
const mysql = require('mysql2/promise');
const cfg = require('./config');

const app = express();
app.use(express.json());

const pool = mysql.createPool({ ...cfg.db, waitForConnections: true, connectionLimit: 10});

// --- Registro de cada petición: hora, método, ruta y respuesta --------
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    const hora = new Date().toLocaleTimeString('es-MX', { hour12: false });
    console.log(`[${hora}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - inicio} ms)`);
  });
  next();
});

// --- Utilidades -------------------------------------------------------
const redondear = (x) => Math.round(x * 100) / 100;

function calcularNucleo(piel, cuarto) {
  return redondear(piel + cfg.factorK * (piel - cuarto));
}

function colorSemaforo(nucleo) {
  if (nucleo === null || nucleo === undefined) return 'revisar_parche';
  if (nucleo >= cfg.umbralRojo) return 'rojo';
  if (nucleo >= cfg.umbralAmarillo) return 'amarillo';
  return 'verde';
}

function esTemperatura(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= cfg.temperaturaMin && v <= cfg.temperaturaMax;
}

function validarLectura(b) {
  const errores = [];
  if (!Number.isInteger(b.id_dispositivo) || b.id_dispositivo <= 0) errores.push('id_dispositivo debe ser un entero mayor a 0');
  if (!esTemperatura(b.temp_piel)) errores.push(`temp_piel debe ser un número entre ${cfg.temperaturaMin} y ${cfg.temperaturaMax} °C`);
  if (!esTemperatura(b.temp_cuarto)) errores.push(`temp_cuarto debe ser un número entre ${cfg.temperaturaMin} y ${cfg.temperaturaMax} °C`);
  if (b.temp_flujo !== null && b.temp_flujo !== undefined && !esTemperatura(b.temp_flujo)) errores.push('temp_flujo debe ser null o un número en rango');
  if (b.parche_colocado !== 0 && b.parche_colocado !== 1) errores.push('parche_colocado debe ser 1 o 0');
  if (b.calentador_encendido !== undefined && b.calentador_encendido !== 0 && b.calentador_encendido !== 1) errores.push('calentador_encendido debe ser 1 o 0');
  return errores;
}

function esErrorConexion(e) {
  return ['ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ER_ACCESS_DENIED_ERROR', 'ENOTFOUND'].includes(e.code);
}

function manejarError(res, e) {
  if (esErrorConexion(e)) return res.status(503).json({ error: 'La base de datos no está disponible' });
  console.error(e);
  return res.status(500).json({ error: 'No se pudo completar la operación' });
}

// --- Telegram ---------------------------------------------------------
async function avisarTelegram(idPaciente, mensaje) {
  const [destinos] = await pool.query(
    `SELECT pm.nombre, pm.telegram_id FROM TRATA t JOIN PERSONAL_MEDICO pm ON pm.id_personal = t.id_personal
       WHERE t.id_paciente = ? AND pm.telegram_id IS NOT NULL
     UNION ALL
     SELECT pa.nombre, pa.telegram_id FROM APOYA a JOIN PERSONA_APOYO pa ON pa.id_apoyo = a.id_apoyo
       WHERE a.id_paciente = ? AND pa.telegram_id IS NOT NULL`,
    [idPaciente, idPaciente]
  );
  if (!cfg.telegramToken || destinos.length === 0) {
    console.log(`[TELEGRAM sin enviar] ${mensaje}`);
    return 0;
  }
  let enviados = 0;
  for (const d of destinos) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${cfg.telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: d.telegram_id, text: mensaje })
      });
      if (r.ok) enviados++;
    } catch (e) {
      console.error(`No se pudo avisar a ${d.nombre}: ${e.message}`);
    }
  }
  return enviados;
}

// --- Alertas ----------------------------------------------------------
async function revisarAlerta(conn, paciente, nucleo, colocado) {
  let tipo = null;
  if (colocado === 0) tipo = 'revisar_parche';
  else if (nucleo >= cfg.umbralRojo) tipo = 'fiebre';
  if (!tipo) return null;

  // No repetir una alerta igual que siga sin atender en los últimos minutos
  const [repetida] = await conn.query(
    `SELECT id_alerta FROM ALERTA
      WHERE id_paciente = ? AND tipo = ? AND atendida = 0
        AND fecha_hora >= NOW() - INTERVAL ? MINUTE LIMIT 1`,
    [paciente.id_paciente, tipo, cfg.minutosSinRepetir]
  );
  if (repetida.length) return { id_alerta: repetida[0].id_alerta, tipo, nueva: false };

  const [medico] = await conn.query(
    `SELECT pm.id_personal FROM TRATA t JOIN PERSONAL_MEDICO pm ON pm.id_personal = t.id_personal
      WHERE t.id_paciente = ? ORDER BY pm.rol = 'medico' DESC, pm.id_personal LIMIT 1`,
    [paciente.id_paciente]
  );
  const [r] = await conn.query(
    'INSERT INTO ALERTA (id_paciente, id_personal, tipo, temperatura, fecha_hora, atendida) VALUES (?, ?, ?, ?, NOW(), 0)',
    [paciente.id_paciente, medico.length ? medico[0].id_personal : null, tipo, tipo === 'fiebre' ? nucleo : null]
  );
  return { id_alerta: r.insertId, tipo, nueva: true };
}

// --- Rutas ------------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ servicio: 'ThermoCare IoT API', estado: 'encendida', hora: new Date().toISOString() });
});

// El NodeMCU manda una lectura
app.post('/lecturas', async (req, res) => {
  const b = req.body || {};
  const errores = validarLectura(b);
  if (errores.length) return res.status(400).json({ error: 'Datos incorrectos', detalles: errores });

  let conn;
  try {
    conn = await pool.getConnection();
    const [pac] = await conn.query(
      `SELECT p.id_paciente, p.nombres, p.apellido_paterno FROM DISPOSITIVO d
         JOIN PACIENTE p ON p.id_dispositivo = d.id_dispositivo WHERE d.id_dispositivo = ?`,
      [b.id_dispositivo]
    );
    if (!pac.length) return res.status(404).json({ error: `El dispositivo ${b.id_dispositivo} no existe o no tiene paciente` });
    const paciente = pac[0];

    const flujo = (b.temp_flujo === null || b.temp_flujo === undefined) ? b.temp_piel : b.temp_flujo; // aún no hay segundo sensor de piel
    const nucleo = b.parche_colocado === 1 ? calcularNucleo(b.temp_piel, b.temp_cuarto) : null;
    const semaforo = colorSemaforo(nucleo);

    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO LECTURA (id_dispositivo, fecha_hora, temp_piel, temp_flujo, temp_cuarto, temp_nucleo, parche_colocado, calentador_encendido)
       VALUES (?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [b.id_dispositivo, b.temp_piel, flujo, b.temp_cuarto, nucleo, b.parche_colocado, b.calentador_encendido ?? 0]
    );
    const alerta = await revisarAlerta(conn, paciente, nucleo, b.parche_colocado);
    await conn.commit();

    if (alerta && alerta.nueva) {
      const nombre = `${paciente.nombres} ${paciente.apellido_paterno}`;
      const msg = alerta.tipo === 'fiebre'
        ? `ThermoCare: ${nombre} tiene fiebre (${nucleo} °C). Revisar lo antes posible.`
        : `ThermoCare: el parche de ${nombre} se despegó. Hay que volver a colocarlo.`;
      avisarTelegram(paciente.id_paciente, msg).catch((e) => console.error(e.message));
    }

    res.status(201).json({
      id_lectura: r.insertId,
      id_paciente: paciente.id_paciente,
      temp_nucleo: nucleo,
      semaforo,
      alerta: alerta ? { id_alerta: alerta.id_alerta, tipo: alerta.tipo, nueva: alerta.nueva } : null
    });
  } catch (e) {
    if (conn) await conn.rollback().catch(() => {});
    manejarError(res, e);
  } finally {
    if (conn) conn.release();
  }
});

// Últimas lecturas con su dispositivo y paciente
app.get('/lecturas', async (req, res) => {
  const limite = Math.min(Math.max(parseInt(req.query.limite, 10) || 20, 1), 500);
  try {
    const [filas] = await pool.query(
      `SELECT l.id_lectura, l.fecha_hora, d.numero_serie, CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
              l.temp_piel, l.temp_cuarto, l.temp_nucleo, l.parche_colocado, l.calentador_encendido
         FROM LECTURA l JOIN DISPOSITIVO d ON d.id_dispositivo = l.id_dispositivo
         JOIN PACIENTE p ON p.id_dispositivo = d.id_dispositivo
        ORDER BY l.fecha_hora DESC, l.id_lectura DESC LIMIT ?`, [limite]);
    res.json(filas);
  } catch (e) { manejarError(res, e); }
});

// El NodeMCU pregunta el color del semáforo y cada cuánto mandar datos
app.get('/dispositivos/:id/estado', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!(id > 0)) return res.status(400).json({ error: 'id de dispositivo inválido' });
  try {
    const [d] = await pool.query('SELECT id_dispositivo FROM DISPOSITIVO WHERE id_dispositivo = ?', [id]);
    if (!d.length) return res.status(404).json({ error: `El dispositivo ${id} no existe` });
    const [u] = await pool.query(
      'SELECT temp_nucleo, parche_colocado FROM LECTURA WHERE id_dispositivo = ? ORDER BY fecha_hora DESC, id_lectura DESC LIMIT 1', [id]);
    const nucleo = u.length && u[0].parche_colocado ? Number(u[0].temp_nucleo) : null;
    res.json({ id_dispositivo: id, semaforo: u.length ? colorSemaforo(nucleo) : 'verde', intervalo_segundos: cfg.intervaloSegundos });
  } catch (e) { manejarError(res, e); }
});

// Temperatura del núcleo actual y si va subiendo o bajando
app.get('/pacientes/:id/temperatura', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!(id > 0)) return res.status(400).json({ error: 'id de paciente inválido' });
  try {
    const [p] = await pool.query('SELECT id_paciente, nombres, apellido_paterno, id_dispositivo FROM PACIENTE WHERE id_paciente = ?', [id]);
    if (!p.length) return res.status(404).json({ error: `El paciente ${id} no existe` });
    const [l] = await pool.query(
      `SELECT temp_nucleo, fecha_hora FROM LECTURA
        WHERE id_dispositivo = ? AND parche_colocado = 1 AND temp_nucleo IS NOT NULL
        ORDER BY fecha_hora DESC, id_lectura DESC LIMIT 6`, [p[0].id_dispositivo]);
    if (!l.length) return res.json({ id_paciente: id, temp_nucleo: null, tendencia: 'sin datos', semaforo: 'revisar_parche' });
    const actual = Number(l[0].temp_nucleo);
    const previas = l.slice(1).map((x) => Number(x.temp_nucleo));
    const promedio = previas.length ? previas.reduce((a, b) => a + b, 0) / previas.length : actual;
    const dif = redondear(actual - promedio);
    const tendencia = dif > 0.1 ? 'subiendo' : dif < -0.1 ? 'bajando' : 'estable';
    res.json({
      id_paciente: id, paciente: `${p[0].nombres} ${p[0].apellido_paterno}`,
      temp_nucleo: actual, semaforo: colorSemaforo(actual), tendencia, cambio: dif, fecha_hora: l[0].fecha_hora
    });
  } catch (e) { manejarError(res, e); }
});

// Alertas (todas o solo las activas con ?activas=1)
app.get('/alertas', async (req, res) => {
  const soloActivas = req.query.activas === '1' || req.query.activas === 'true';
  try {
    const [filas] = await pool.query(
      `SELECT a.id_alerta, a.tipo, a.temperatura, a.fecha_hora, a.atendida, a.id_paciente,
              CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente, pm.nombre AS medico_responsable
         FROM ALERTA a JOIN PACIENTE p ON p.id_paciente = a.id_paciente
         LEFT JOIN PERSONAL_MEDICO pm ON pm.id_personal = a.id_personal
        ${soloActivas ? 'WHERE a.atendida = 0' : ''}
        ORDER BY a.fecha_hora DESC`);
    res.json(filas);
  } catch (e) { manejarError(res, e); }
});

// El personal médico marca una alerta como atendida
app.put('/alertas/:id/atender', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!(id > 0)) return res.status(400).json({ error: 'id de alerta inválido' });
  const idPersonal = req.body && req.body.id_personal;
  if (idPersonal !== undefined && !(Number.isInteger(idPersonal) && idPersonal > 0)) {
    return res.status(400).json({ error: 'id_personal debe ser un entero mayor a 0' });
  }
  try {
    const [r] = await pool.query(
      `UPDATE ALERTA SET atendida = 1${idPersonal ? ', id_personal = ?' : ''} WHERE id_alerta = ?`,
      idPersonal ? [idPersonal, id] : [id]);
    if (!r.affectedRows) return res.status(404).json({ error: `La alerta ${id} no existe` });
    res.json({ id_alerta: id, atendida: 1 });
  } catch (e) {
    if (e.code === 'ER_NO_REFERENCED_ROW_2') return res.status(404).json({ error: 'Ese miembro del personal médico no existe' });
    manejarError(res, e);
  }
});

// JSON mal escrito
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'El cuerpo no es un JSON válido' });
  next(err);
});

app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// --- Arranque: revisa que MySQL responda antes de escuchar -------------
async function iniciar() {
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    console.error(`No se pudo conectar a MySQL (${e.code}). Enciende MySQL en XAMPP y revisa config.js.`);
    process.exit(1);
  }
  return app.listen(cfg.puerto, () => console.log(`ThermoCare API escuchando en http://localhost:${cfg.puerto}`));
}

if (require.main === module) iniciar();

module.exports = { app, pool, iniciar, calcularNucleo, colorSemaforo, validarLectura };
