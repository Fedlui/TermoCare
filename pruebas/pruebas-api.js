// =====================================================================
// ThermoCare IoT · Pruebas de la API
// Manda a la API los mismos casos de la Tarea 3.3 y revisa en MySQL qué
// quedó guardado. Uso (con la API encendida):
//     node pruebas/pruebas-api.js            (usa http://localhost:3000)
//     API_URL=http://192.168.1.50:3000 node pruebas/pruebas-api.js
// =====================================================================
const path = require('path');
const apiDir = path.join(__dirname, '..', 'api');
const mysql = require(require.resolve('mysql2/promise', { paths: [apiDir] }));
const cfg = require(path.join(apiDir, 'config'));

const URL = process.env.API_URL || `http://localhost:${cfg.puerto}`;
const DISPOSITIVO = 1;
const PACIENTE = 1;

const linea = (c = '─') => console.log(c.repeat(78));
let db;
let aprobadas = 0;
let total = 0;

async function llamar(metodo, ruta, cuerpo) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  let json = null;
  try { json = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, json };
}

async function contar(tabla, where, params) {
  const [[f]] = await db.query(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${where}`, params);
  return f.n;
}

function lectura(piel, extra = {}) {
  return { id_dispositivo: DISPOSITIVO, temp_piel: piel, temp_flujo: null, temp_cuarto: 24.0, parche_colocado: 1, calentador_encendido: 0, ...extra };
}

async function caso(n, nombre, enviado, fn) {
  total++;
  linea();
  console.log(`CASO ${n} · ${nombre}`);
  console.log(`  Qué se mandó:       ${enviado}`);
  try {
    const { ok, respuesta, mysql: guardado } = await fn();
    console.log(`  Qué respondió:      ${respuesta}`);
    console.log(`  Qué quedó en MySQL: ${guardado}`);
    console.log(`  Resultado:          ${ok ? 'APROBADA' : 'FALLÓ'}`);
    if (ok) aprobadas++;
  } catch (e) {
    console.log(`  Resultado:          FALLÓ (${e.message})`);
  }
}

async function main() {
  db = await mysql.createConnection(cfg.db);
  linea('═');
  console.log('PRUEBAS DE LA API · ThermoCare IoT');
  console.log(`API: ${URL}   ·   Base de datos: ${cfg.db.database}   ·   ${new Date().toLocaleString('es-MX')}`);
  linea('═');

  const salud = await llamar('GET', '/');
  console.log(`API encendida: ${salud.status} ${JSON.stringify(salud.json)}`);
  // Preparación: deja sin alertas pendientes a la paciente de prueba para que la prueba se pueda repetir
  const [prep] = await db.query('UPDATE ALERTA SET atendida = 1 WHERE id_paciente = ? AND atendida = 0', [PACIENTE]);
  console.log(`Preparación: ${prep.affectedRows} alerta(s) pendiente(s) de la paciente ${PACIENTE} marcadas como atendidas`);

  let idFiebre = null;

  await caso(1, 'Lectura normal', 'piel 34.1 °C, cuarto 24.0 °C, parche colocado', async () => {
    const r = await llamar('POST', '/lecturas', lectura(34.1));
    const [[l]] = await db.query('SELECT temp_nucleo FROM LECTURA WHERE id_lectura = ?', [r.json.id_lectura]);
    return {
      ok: r.status === 201 && r.json.semaforo === 'verde' && r.json.alerta === null,
      respuesta: `${r.status} · núcleo ${r.json.temp_nucleo} °C · semáforo ${r.json.semaforo}`,
      mysql: `lectura #${r.json.id_lectura} con núcleo ${l.temp_nucleo} °C, sin alerta`
    };
  });

  await caso(2, 'Precaución', 'piel 34.7 °C, cuarto 24.0 °C', async () => {
    const r = await llamar('POST', '/lecturas', lectura(34.7));
    return {
      ok: r.status === 201 && r.json.semaforo === 'amarillo' && r.json.alerta === null,
      respuesta: `${r.status} · núcleo ${r.json.temp_nucleo} °C · semáforo ${r.json.semaforo}`,
      mysql: `lectura #${r.json.id_lectura}, sin alerta`
    };
  });

  await caso(3, 'Fiebre', 'piel 35.5 °C, cuarto 24.0 °C', async () => {
    const r = await llamar('POST', '/lecturas', lectura(35.5));
    idFiebre = r.json.alerta && r.json.alerta.id_alerta;
    const [[a]] = await db.query('SELECT tipo, temperatura, atendida FROM ALERTA WHERE id_alerta = ?', [idFiebre]);
    return {
      ok: r.status === 201 && r.json.semaforo === 'rojo' && r.json.alerta && r.json.alerta.tipo === 'fiebre' && r.json.alerta.nueva,
      respuesta: `${r.status} · núcleo ${r.json.temp_nucleo} °C · semáforo ${r.json.semaforo} · alerta #${idFiebre}`,
      mysql: `lectura #${r.json.id_lectura} y alerta #${idFiebre} (${a.tipo}, ${a.temperatura} °C, pendiente)`
    };
  });

  await caso(4, 'Fiebre repetida', 'otra lectura con piel 35.6 °C', async () => {
    const antes = await contar('ALERTA', 'id_paciente = ? AND tipo = ?', [PACIENTE, 'fiebre']);
    const r = await llamar('POST', '/lecturas', lectura(35.6));
    const despues = await contar('ALERTA', 'id_paciente = ? AND tipo = ?', [PACIENTE, 'fiebre']);
    return {
      ok: r.status === 201 && r.json.semaforo === 'rojo' && r.json.alerta && !r.json.alerta.nueva && antes === despues,
      respuesta: `${r.status} · semáforo ${r.json.semaforo} · usa la misma alerta #${r.json.alerta.id_alerta}`,
      mysql: `lectura #${r.json.id_lectura}; alertas de fiebre antes ${antes}, después ${despues} (no se repitió)`
    };
  });

  await caso(5, 'Parche despegado', 'piel 30.2 °C, parche_colocado = 0 (entra luz)', async () => {
    const r = await llamar('POST', '/lecturas', lectura(30.2, { parche_colocado: 0 }));
    const [[l]] = await db.query('SELECT temp_nucleo FROM LECTURA WHERE id_lectura = ?', [r.json.id_lectura]);
    return {
      ok: r.status === 201 && r.json.temp_nucleo === null && r.json.alerta && r.json.alerta.tipo === 'revisar_parche',
      respuesta: `${r.status} · sin temperatura del núcleo · semáforo ${r.json.semaforo}`,
      mysql: `lectura #${r.json.id_lectura} con núcleo ${l.temp_nucleo === null ? 'NULL' : l.temp_nucleo} y alerta #${r.json.alerta.id_alerta} (revisar_parche)`
    };
  });

  await caso(6, 'Dato incorrecto', 'piel 85 °C (fuera de rango)', async () => {
    const antes = await contar('LECTURA', 'id_dispositivo = ?', [DISPOSITIVO]);
    const r = await llamar('POST', '/lecturas', lectura(85));
    const despues = await contar('LECTURA', 'id_dispositivo = ?', [DISPOSITIVO]);
    return {
      ok: r.status === 400 && antes === despues,
      respuesta: `${r.status} · ${r.json.error}: ${r.json.detalles.join('; ')}`,
      mysql: `nada (lecturas antes ${antes}, después ${despues})`
    };
  });

  await caso(7, 'Instrucciones', `GET /dispositivos/${DISPOSITIVO}/estado`, async () => {
    const r = await llamar('GET', `/dispositivos/${DISPOSITIVO}/estado`);
    return {
      ok: r.status === 200 && r.json.intervalo_segundos === cfg.intervaloSegundos,
      respuesta: `${r.status} · semáforo ${r.json.semaforo} · mandar cada ${r.json.intervalo_segundos} s`,
      mysql: 'nada, solo es consulta'
    };
  });

  await caso(8, 'Dispositivo que no existe', 'id_dispositivo 999', async () => {
    const r = await llamar('POST', '/lecturas', lectura(34.1, { id_dispositivo: 999 }));
    return { ok: r.status === 404, respuesta: `${r.status} · ${r.json.error}`, mysql: 'nada' };
  });

  await caso(9, 'Tendencia del paciente', `GET /pacientes/${PACIENTE}/temperatura`, async () => {
    const r = await llamar('GET', `/pacientes/${PACIENTE}/temperatura`);
    return {
      ok: r.status === 200 && typeof r.json.tendencia === 'string',
      respuesta: `${r.status} · núcleo ${r.json.temp_nucleo} °C · ${r.json.tendencia} (${r.json.cambio > 0 ? '+' : ''}${r.json.cambio} °C)`,
      mysql: 'nada, solo es consulta'
    };
  });

  await caso(10, 'Atender la alerta de fiebre', `PUT /alertas/${idFiebre}/atender`, async () => {
    const r = await llamar('PUT', `/alertas/${idFiebre}/atender`, { id_personal: 1 });
    const [[a]] = await db.query('SELECT atendida, id_personal FROM ALERTA WHERE id_alerta = ?', [idFiebre]);
    return {
      ok: r.status === 200 && a.atendida === 1,
      respuesta: `${r.status} · ${JSON.stringify(r.json)}`,
      mysql: `alerta #${idFiebre} con atendida = ${a.atendida}, atendida por el personal #${a.id_personal}`
    };
  });

  linea('═');
  console.log(`RESULTADO: ${aprobadas} de ${total} pruebas aprobadas`);
  linea('═');

  const [ult] = await db.query(
    `SELECT id_lectura, DATE_FORMAT(fecha_hora, '%H:%i:%s') AS hora, temp_piel, temp_cuarto, temp_nucleo, parche_colocado
       FROM LECTURA WHERE id_dispositivo = ? ORDER BY id_lectura DESC LIMIT 6`, [DISPOSITIVO]);
  console.log('\nÚltimas lecturas guardadas en LECTURA:');
  console.table(ult.reverse());
  const [al] = await db.query(
    `SELECT id_alerta, tipo, temperatura, DATE_FORMAT(fecha_hora, '%H:%i:%s') AS hora, atendida
       FROM ALERTA WHERE id_paciente = ? ORDER BY id_alerta DESC LIMIT 3`, [PACIENTE]);
  console.log('Últimas alertas guardadas en ALERTA:');
  console.table(al.reverse());

  await db.end();
  process.exit(aprobadas === total ? 0 : 1);
}

main().catch((e) => {
  console.error(`No se pudieron correr las pruebas: ${e.message}`);
  console.error('Revisa que MySQL y la API estén encendidos.');
  process.exit(1);
});
