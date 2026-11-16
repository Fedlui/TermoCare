# API REST

Recibe las lecturas del parche, calcula la temperatura del núcleo, guarda todo en MySQL, crea alertas y avisa por Telegram. El NodeMCU nunca se conecta directo a la base de datos.

| Archivo | Para qué |
| --- | --- |
| `RestApi-Equipo5.js` | La API (Node.js + Express + mysql2), puerto 3000 |
| `config.js` | Datos de MySQL, límites de temperatura, factor K, intervalo y token de Telegram |
| `simulador-nodemcu.js` | Hace el papel del parche para probar sin circuito |

## Cómo correrla

```bash
cd api
npm install
npm start                      # o: node RestApi-Equipo5.js
```

Si MySQL tiene contraseña: `DB_PASSWORD=tu_contraseña npm start` (o cámbiala en `config.js`).

Simulador del parche (en otra terminal):

```bash
node simulador-nodemcu.js            # lecturas normales
node simulador-nodemcu.js fiebre     # la temperatura sube hasta fiebre
node simulador-nodemcu.js despegado  # de vez en cuando se despega
```

## Rutas

| Método | Ruta | Qué hace |
| --- | --- | --- |
| GET | `/` | Confirma que la API está encendida |
| POST | `/lecturas` | Revisa y guarda una lectura, revisa alertas y regresa el semáforo |
| GET | `/lecturas?limite=20` | Últimas lecturas con dispositivo y paciente |
| GET | `/dispositivos/:id/estado` | Color del semáforo y cada cuántos segundos mandar datos |
| GET | `/pacientes/:id/temperatura` | Núcleo actual y si va subiendo o bajando |
| GET | `/alertas?activas=1` | Alertas (todas o solo las pendientes) |
| PUT | `/alertas/:id/atender` | Marca una alerta como atendida |

Respuestas: `201` guardada · `200` consulta · `400` datos incorrectos · `404` no existe · `500` error al guardar · `503` MySQL apagado.

## Lo que manda el NodeMCU

```json
{
  "id_dispositivo": 1,
  "temp_piel": 34.1,
  "temp_flujo": null,
  "temp_cuarto": 24.0,
  "parche_colocado": 1,
  "calentador_encendido": 0
}
```

`temp_flujo` va vacío mientras no exista el segundo sensor de piel; la API guarda ahí el mismo valor de la piel.
