# ThermoCare IoT

Parche de antebrazo que estima de forma continua la temperatura del núcleo del cuerpo de pacientes en quimioterapia y avisa de la fiebre a enfermería, al médico y a la familia por un dashboard y por Telegram.

**Implementación de internet en las cosas · Grupo 504 · Equipo 5**

| Integrante | Matrícula | Rol |
| --- | --- | --- |
| Federico Luis Salazar Guzmán | A01174886 | Product Owner · datos |
| José Ángel López Arvayo | A00843562 | Scrum Master · calidad y seguridad |
| Antonio Daniel Gómez García | A01199791 | Hardware y experimento |
| Francisco González Brito | A00841560 | Actuadores y alertas |
| Raúl Alejandro Anguiano Solano | A01742895 | Dashboard y algoritmo |

## Cómo funciona

1. Un **NodeMCU ESP8266** lee los termistores (piel, flujo y cuarto) con un **ADS1115**, la fotorresistencia del parche y el estado del calentador.
2. Manda cada lectura por WiFi a una **API REST en Node.js** (`POST /lecturas`).
3. La API calcula la temperatura del núcleo, la guarda en **MySQL** y, si hay fiebre o el parche se despegó, crea una alerta y avisa por **Telegram**.
4. El **LED RGB** del parche muestra el semáforo: verde, amarillo o rojo.

## Base de datos

Base `thermocare` en MySQL 8.0 (InnoDB), 12 tablas: `PACIENTE`, `DISPOSITIVO`, `LECTURA`, `ONDA_CALOR`, `ALERTA`, `MEDICAMENTO`, `PERSONAL_MEDICO`, `PERSONA_APOYO`, `TELEFONO_PERSONAL`, `TELEFONO_APOYO`, `TRATA` y `APOYA`. El diseño completo (ER Chen, modelo relacional, 3NF y diccionario) está en [`docs/Etapa2-Software-Equipo5.pdf`](docs/Etapa2-Software-Equipo5.pdf).

## Organización del repositorio

| Carpeta | Contenido |
| --- | --- |
| `docs/` | Entregables de cada etapa |
| `sql/` | Script de creación, datos de prueba e indicadores |
| `api/` | API REST en Node.js con Express y mysql2 |
| `arduino/` | Código del NodeMCU |

## Seguimiento

El backlog está en [Issues](../../issues), agrupado por sprint en [Milestones](../../milestones). Las etiquetas indican la épica, la prioridad y el responsable de cada historia.

| Sprint | Fechas | Objetivo |
| --- | --- | --- |
| 0 | 26 – 30 oct | Tablero, repositorio y base de datos |
| 1 | 2 – 6 nov | Hardware base y LEDs |
| 2 | 9 – 13 nov | Calentador, envío a la nube y diseño de la base de datos |
| 3 | 16 – 20 nov | Análisis de ondas, núcleo y alarma de fiebre |
| 4 | 23 – 27 nov | Dashboard y alertas por Telegram |
| 5 | 30 nov – 4 dic | Cierre, presentación y expo |

## Seguridad

Las pruebas con el parche se hacen solo con un integrante sano, sin marcapasos ni implantes, nunca con pacientes. El parche se alimenta con power bank y nunca conectado a la laptop o al cargador mientras se usa.
