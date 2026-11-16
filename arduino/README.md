# Código del parche

`ThermoCare-NodeMCU/ThermoCare-NodeMCU.ino` lee los sensores, manda cada lectura a la API por WiFi y enciende el LED RGB con el color que responde la API.

| Componente | Pin |
| --- | --- |
| DHT11 del cuerpo | D0 |
| DHT11 del ambiente | D1 |
| Fotorresistencia (salida digital) | D6 |
| PIR 1 · PIR 2 | D5 · D4 |
| LED RGB rojo · verde · azul | D7 · D8 · D2 |

## Cómo subirlo

1. En Arduino IDE instala la placa **esp8266** y elige **NodeMCU 1.0 (ESP-12E Module)**.
2. Instala las bibliotecas **DHT sensor library** (Adafruit) y **ArduinoJson**.
3. Al inicio del código escribe tu WiFi, su contraseña y la IP de la computadora donde corre la API.
4. Sube el código y abre el monitor serial a **115200**.

Si la lectura de un DHT11 sale con error o fuera de 0 a 50 °C, no se manda. Si se pierde el WiFi se reconecta solo, y cada envío se intenta hasta 3 veces.

Compilado con la placa esp8266 3.1.2 para NodeMCU 1.0.
