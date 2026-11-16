/*
 * ThermoCare IoT · Código del parche (NodeMCU ESP8266)
 * ---------------------------------------------------------------
 * Lee los sensores, manda cada lectura por WiFi a la API REST y
 * enciende el LED RGB con el color de semáforo que responde la API.
 *
 * Circuito provisional con sensores del kit:
 *   DHT11 del cuerpo   -> D0 (GPIO16)  simula el sensor de piel
 *   DHT11 del ambiente -> D1 (GPIO5)   temperatura del cuarto
 *   Fotorresistencia   -> D6 (GPIO12)  salida digital del módulo
 *   PIR 1              -> D5 (GPIO14)
 *   PIR 2              -> D4 (GPIO2)   si no arranca, desconecta el PIR al subir el código
 *   LED RGB rojo       -> D7 (GPIO13)
 *   LED RGB verde      -> D8 (GPIO15)
 *   LED RGB azul       -> D2 (GPIO4)
 *
 * Placa: NodeMCU 1.0 (ESP-12E). Monitor serial: 115200.
 * Bibliotecas: ESP8266WiFi, ESP8266HTTPClient (vienen con la placa),
 *              DHT sensor library (Adafruit) y ArduinoJson 7.
 */
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ---------- Configuración (cambiar antes de subir) ----------
const char* WIFI_NOMBRE     = "NOMBRE_DE_TU_WIFI";
const char* WIFI_CONTRASENA = "CONTRASENA_DE_TU_WIFI";
const char* API_URL         = "http://192.168.1.50:3000";  // IP de la computadora donde corre la API
const int   ID_DISPOSITIVO  = 1;

// ---------- Pines ----------
const uint8_t PIN_DHT_CUERPO   = D0;
const uint8_t PIN_DHT_AMBIENTE = D1;
const uint8_t PIN_LDR          = D6;
const uint8_t PIN_PIR1         = D5;
const uint8_t PIN_PIR2         = D4;
const uint8_t PIN_ROJO         = D7;
const uint8_t PIN_VERDE        = D8;
const uint8_t PIN_AZUL         = D2;

const int  LDR_OSCURO      = HIGH;   // el módulo marca HIGH cuando no entra luz (parche colocado)
const bool RGB_ANODO_COMUN = false;  // true si el LED RGB es de ánodo común

const float TEMP_MIN = 0.0, TEMP_MAX = 50.0;
const int   REINTENTOS = 2;          // además del primer intento

DHT dhtCuerpo(PIN_DHT_CUERPO, DHT11);
DHT dhtAmbiente(PIN_DHT_AMBIENTE, DHT11);

unsigned long intervaloMs = 10000;   // la API lo puede cambiar
unsigned long ultimoEnvio = 0;
unsigned long ultimaConsulta = 0;
unsigned long enviosOk = 0, enviosFallidos = 0;

// ---------- LED RGB ----------
void ponerColor(bool r, bool g, bool b) {
  digitalWrite(PIN_ROJO,  RGB_ANODO_COMUN ? !r : r);
  digitalWrite(PIN_VERDE, RGB_ANODO_COMUN ? !g : g);
  digitalWrite(PIN_AZUL,  RGB_ANODO_COMUN ? !b : b);
}

void mostrarSemaforo(const char* color) {
  if      (!strcmp(color, "verde"))    ponerColor(0, 1, 0);
  else if (!strcmp(color, "amarillo")) ponerColor(1, 1, 0);
  else if (!strcmp(color, "rojo"))     ponerColor(1, 0, 0);
  else                                 ponerColor(0, 0, 1);  // revisar_parche: azul
}

// ---------- WiFi ----------
void conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("Conectando a %s", WIFI_NOMBRE);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NOMBRE, WIFI_CONTRASENA);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 15000) {
    delay(500);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) Serial.printf("\nWiFi conectado. IP: %s\n", WiFi.localIP().toString().c_str());
  else Serial.println("\nNo se pudo conectar; se intentará en el siguiente envío.");
}

// ---------- Lectura de sensores ----------
bool enRango(float t) { return !isnan(t) && t >= TEMP_MIN && t <= TEMP_MAX; }

// ---------- POST /lecturas ----------
bool enviarLectura(float piel, float cuarto, bool colocado) {
  JsonDocument doc;
  doc["id_dispositivo"] = ID_DISPOSITIVO;
  doc["temp_piel"] = piel;
  doc["temp_flujo"] = nullptr;          // aún no hay segundo sensor de piel
  doc["temp_cuarto"] = cuarto;
  doc["parche_colocado"] = colocado ? 1 : 0;
  doc["calentador_encendido"] = 0;
  String cuerpo;
  serializeJson(doc, cuerpo);
  Serial.printf("Enviando: %s\n", cuerpo.c_str());

  for (int intento = 0; intento <= REINTENTOS; intento++) {
    WiFiClient cliente;
    HTTPClient http;
    http.begin(cliente, String(API_URL) + "/lecturas");
    http.addHeader("Content-Type", "application/json");
    int codigo = http.POST(cuerpo);
    String respuesta = http.getString();
    http.end();

    if (codigo == 201) {
      JsonDocument r;
      if (!deserializeJson(r, respuesta)) {
        const char* semaforo = r["semaforo"] | "verde";
        Serial.printf("  201 · lectura %d · núcleo %s °C · semáforo %s\n",
                      (int)r["id_lectura"], r["temp_nucleo"].isNull() ? "-" : String((float)r["temp_nucleo"], 2).c_str(), semaforo);
        if (!r["alerta"].isNull()) Serial.printf("  Alerta: %s\n", (const char*)r["alerta"]["tipo"]);
        mostrarSemaforo(semaforo);
      }
      return true;
    }
    Serial.printf("  Intento %d: respuesta %d %s\n", intento + 1, codigo, respuesta.c_str());
    if (codigo == 400 || codigo == 404) return false;  // reintentar no lo arregla
    delay(1000);
  }
  return false;
}

// ---------- GET /dispositivos/:id/estado ----------
void consultarIntervalo() {
  WiFiClient cliente;
  HTTPClient http;
  http.begin(cliente, String(API_URL) + "/dispositivos/" + ID_DISPOSITIVO + "/estado");
  int codigo = http.GET();
  if (codigo == 200) {
    JsonDocument r;
    if (!deserializeJson(r, http.getString())) {
      int seg = r["intervalo_segundos"] | 10;
      intervaloMs = (unsigned long)max(seg, 2) * 1000UL;  // el DHT11 necesita al menos 2 s
      Serial.printf("La API indica mandar datos cada %d s\n", seg);
    }
  } else {
    Serial.printf("No se pudo consultar el intervalo (%d)\n", codigo);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\n=== ThermoCare IoT · parche ===");
  pinMode(PIN_LDR, INPUT);
  pinMode(PIN_PIR1, INPUT);
  pinMode(PIN_PIR2, INPUT);
  pinMode(PIN_ROJO, OUTPUT);
  pinMode(PIN_VERDE, OUTPUT);
  pinMode(PIN_AZUL, OUTPUT);
  ponerColor(0, 0, 1);
  dhtCuerpo.begin();
  dhtAmbiente.begin();
  conectarWiFi();
  if (WiFi.status() == WL_CONNECTED) consultarIntervalo();
}

void loop() {
  unsigned long ahora = millis();
  if (ahora - ultimoEnvio < intervaloMs) return;
  ultimoEnvio = ahora;

  float piel   = dhtCuerpo.readTemperature();
  float cuarto = dhtAmbiente.readTemperature();
  bool colocado = digitalRead(PIN_LDR) == LDR_OSCURO;
  bool movimiento = digitalRead(PIN_PIR1) || digitalRead(PIN_PIR2);

  Serial.printf("\nPiel %.1f °C · cuarto %.1f °C · parche %s · movimiento %s\n",
                piel, cuarto, colocado ? "colocado" : "DESPEGADO", movimiento ? "sí" : "no");

  if (!enRango(piel) || !enRango(cuarto)) {
    Serial.println("Lectura fuera de rango o con error; no se manda.");
    return;
  }

  conectarWiFi();
  if (WiFi.status() != WL_CONNECTED) { enviosFallidos++; return; }

  if (enviarLectura(piel, cuarto, colocado)) enviosOk++;
  else enviosFallidos++;
  Serial.printf("Envíos correctos: %lu · fallidos: %lu\n", enviosOk, enviosFallidos);

  if (ahora - ultimaConsulta > 60000UL) {   // revisa el intervalo cada minuto
    ultimaConsulta = ahora;
    consultarIntervalo();
  }
}
