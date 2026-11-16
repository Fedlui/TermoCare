// =====================================================================
// ThermoCare IoT · Simulador del NodeMCU
// Hace el papel del parche: cada N segundos manda a la API una lectura
// con el mismo formato que el NodeMCU. Sirve para probar sin circuito.
//   node simulador-nodemcu.js                 (normal, dispositivo 1)
//   node simulador-nodemcu.js fiebre          (la temperatura sube hasta fiebre)
//   node simulador-nodemcu.js despegado       (de vez en cuando se despega)
// Variables: API_URL, DISPOSITIVO, INTERVALO (segundos)
// =====================================================================
const cfg = require('./config');
const URL = process.env.API_URL || `http://localhost:${cfg.puerto}`;
const DISPOSITIVO = Number(process.env.DISPOSITIVO || 1);
let intervalo = Number(process.env.INTERVALO || cfg.intervaloSegundos);
const modo = process.argv[2] || 'normal';

let paso = 0;
let ok = 0;
let fallas = 0;

function generarLectura() {
  paso++;
  const ruido = (Math.random() - 0.5) * 0.1;
  let piel = 34.1 + ruido;
  if (modo === 'fiebre') piel = Math.min(34.1 + paso * 0.08, 35.8) + ruido; // sube poco a poco
  const colocado = modo === 'despegado' && paso % 5 === 0 ? 0 : 1;
  return {
    id_dispositivo: DISPOSITIVO,
    temp_piel: Math.round(piel * 10) / 10,
    temp_flujo: null,
    temp_cuarto: 24.0,
    parche_colocado: colocado,
    calentador_encendido: paso % 4 === 0 ? 1 : 0
  };
}

async function enviar() {
  const datos = generarLectura();
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(`${URL}/lecturas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) });
      const j = await r.json();
      if (r.status === 201) {
        ok++;
        const alerta = j.alerta ? ` · alerta ${j.alerta.tipo}${j.alerta.nueva ? ' (nueva)' : ''}` : '';
        console.log(`#${paso} piel ${datos.temp_piel} °C -> lectura ${j.id_lectura} · núcleo ${j.temp_nucleo ?? '-'} °C · ${j.semaforo}${alerta}   [ok ${ok} / fallas ${fallas}]`);
      } else {
        fallas++;
        console.log(`#${paso} respuesta ${r.status}: ${JSON.stringify(j)}`);
      }
      return;
    } catch (e) {
      console.log(`#${paso} intento ${intento} sin respuesta (${e.message})`);
    }
  }
  fallas++;
}

async function pedirIntervalo() {
  try {
    const r = await fetch(`${URL}/dispositivos/${DISPOSITIVO}/estado`);
    if (r.ok) intervalo = (await r.json()).intervalo_segundos;
  } catch { /* se queda el anterior */ }
}

(async function ciclo() {
  console.log(`Simulador del parche · dispositivo ${DISPOSITIVO} · modo ${modo} · ${URL}`);
  if (!process.env.INTERVALO) await pedirIntervalo();
  for (;;) {
    await enviar();
    if (!process.env.INTERVALO && paso % 6 === 0) await pedirIntervalo();
    await new Promise((r) => setTimeout(r, intervalo * 1000));
  }
})();
