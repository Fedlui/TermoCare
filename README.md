<p align="center">
  <img src="assets/banner.svg" alt="ThermoCare IoT" width="100%">
</p>

<p align="center">
  <a href="https://github.com/users/Fedlui/projects/6"><img src="https://img.shields.io/badge/Tablero-Kanban-1d3557?style=for-the-badge" alt="Tablero"></a>
  <a href="../../issues?q=is%3Aissue"><img src="https://img.shields.io/badge/Backlog-27_historias-457b9d?style=for-the-badge" alt="Backlog"></a>
  <img src="https://img.shields.io/badge/NodeMCU-ESP8266-e63946?style=for-the-badge" alt="NodeMCU">
  <img src="https://img.shields.io/badge/API-Node.js-2a9d8f?style=for-the-badge" alt="Node.js">
  <img src="https://img.shields.io/badge/BD-MySQL-f4a261?style=for-the-badge" alt="MySQL">
</p>

<br>

> **Durante la quimioterapia, una fiebre puede ser la primera señal de una infección grave que necesita atención en menos de una hora.**
> Hoy la temperatura se toma pocas veces al día. ThermoCare la vigila todo el tiempo.

<br>

<p align="center">
  <img src="assets/funcionamiento.svg" alt="Animación: el parche emite una onda de calor, la lee y avisa por Telegram" width="100%">
</p>

<br>

## La idea en una frase

Un parche en el antebrazo **envía una pequeña onda de calor hacia la piel y escucha cómo regresa**. Con lo que tarda y lo que se debilita, calcula la temperatura del interior del cuerpo, no solo la de la piel.

<p align="center">
  <img src="assets/onda.svg" alt="Cómo viaja la onda de calor entre el emisor y los receptores" width="100%">
</p>

| | Emisor | Receptor 1 | Receptor 2 | Referencia |
| :-- | :-- | :-- | :-- | :-- |
| **Qué es** | Calentador diminuto | Termistor a 4 mm | Termistor a 8 mm | Termistor del cuarto |
| **Qué hace** | Prende y apaga en ciclos | Recibe la onda fuerte | Recibe la onda débil y tarde | Mide el aire alrededor |
| **Qué aporta** | La señal conocida | La temperatura de la piel | El retraso y la atenuación | La pérdida de calor al ambiente |

Con esos datos se aplica:

```
T_núcleo = T_piel + K · (T_piel − T_cuarto)
```

donde **K** sale del análisis de la onda: cuánta grasa hay bajo el parche y cuánto calor sube desde el núcleo. Con un modelo térmico del cuerpo, esa lectura del brazo se extiende a un mapa de temperatura de todo el cuerpo.

<br>

## Del parche al celular del médico

```mermaid
flowchart LR
    subgraph P[" Parche "]
        direction TB
        E(["Emisor de calor"]) -.onda.-> R(["Termistores T1 y T2"])
        C(["Termistor del cuarto"])
        L(["Fotorresistencia"])
    end
    P --> N["NodeMCU<br/>ESP8266"]
    N -- "WiFi · JSON" --> A["API REST<br/>Node.js"]
    A <--> D[("MySQL")]
    A --> S{"¿Fiebre o<br/>parche suelto?"}
    S -- sí --> T["Telegram<br/>médico y familia"]
    D --> G["Dashboard<br/>de enfermería"]
    A -. color .-> N
    N --> RGB(["LED semáforo"])

    classDef hw fill:#fde2d4,stroke:#e63946,color:#1d3557
    classDef sw fill:#dbeaf5,stroke:#457b9d,color:#1d3557
    classDef al fill:#fff3c4,stroke:#e9c46a,color:#1d3557
    class E,R,C,L,N,RGB hw
    class A,D,G sw
    class S,T al
```

<br>

## Un día con ThermoCare

```mermaid
sequenceDiagram
    autonumber
    participant Pa as Parche
    participant Api as Nube
    participant Enf as Enfermería
    participant Fam as Familia
    Pa->>Api: Lectura cada pocos segundos
    Api-->>Pa: Semáforo verde
    Note over Pa,Api: Horas después, la temperatura empieza a subir
    Pa->>Api: Núcleo 37.7 °C
    Api-->>Pa: Semáforo amarillo
    Pa->>Api: Núcleo 38.4 °C
    Api->>Enf: Alerta de fiebre en el dashboard
    Api->>Fam: Mensaje por Telegram
    Enf->>Api: Alerta atendida
```

<br>

## El semáforo

<p align="center">
  <img src="assets/escala.svg" alt="Escala de colores de la temperatura del núcleo" width="100%">
</p>

La alarma clínica de **neutropenia febril** se dispara con **38.3 °C una vez** o **38.0 °C sostenidos durante una hora**. Si entra luz bajo el parche, la lectura no se usa y el sistema pide **revisar el parche** en lugar de dar una falsa alarma.

<br>

## Quién lo usa

<table>
<tr>
<td width="25%" valign="top">

**Paciente**

Lleva el parche y ve en el LED si todo va bien. No tiene que acordarse de medirse.

</td>
<td width="25%" valign="top">

**Enfermería**

Ve a todos sus pacientes en una pantalla y recibe la alerta en tiempo real.

</td>
<td width="25%" valign="top">

**Médico**

Revisa la gráfica de 24 horas con medicamentos y alertas marcados.

</td>
<td width="25%" valign="top">

**Familia**

Recibe el aviso de fiebre en su celular por Telegram.

</td>
</tr>
</table>

<br>

## Lo que hay adentro

<table>
<tr>
<th>Sentir</th><th>Pensar</th><th>Avisar</th>
</tr>
<tr>
<td valign="top">

- 3 termistores NTC 10k β3950
- Convertidor ADS1115 de 16 bits
- Fotorresistencia para saber si el parche está pegado

</td>
<td valign="top">

- NodeMCU ESP8266 con WiFi
- API REST en Node.js
- Base de datos MySQL
- Cálculo del núcleo con análisis de ondas

</td>
<td valign="top">

- Calentador con MOSFET (la onda)
- LED RGB de semáforo
- Bot de Telegram
- Dashboard de enfermería

</td>
</tr>
</table>

<br>

## Cómo se guarda la información

```mermaid
erDiagram
    PACIENTE ||--|| DISPOSITIVO : usa
    DISPOSITIVO ||--o{ LECTURA : registra
    DISPOSITIVO ||--o{ ONDA_CALOR : emite
    PACIENTE ||--o{ ALERTA : genera
    PACIENTE ||--o{ MEDICAMENTO : recibe
    PERSONAL_MEDICO }o--|{ PACIENTE : trata
    PERSONA_APOYO }o--o{ PACIENTE : apoya
    PERSONAL_MEDICO ||--o{ ALERTA : atiende
```

Cada lectura queda ligada a su parche y a su hora; cada onda de calor, a su inicio, fin y potencia; cada alerta, al paciente y a quien la atendió. El diseño completo está en [`docs/`](docs/).

<br>

## El repositorio

```
TermoCare/
├── assets/     Imágenes de este README
├── docs/       Documentación y entregables
├── sql/        Creación de la base de datos, datos de prueba e indicadores
├── api/        API REST en Node.js
└── arduino/    Código del parche (NodeMCU)
```

<br>

## Equipo

<table>
<tr>
<td align="center" width="20%"><b>Federico Salazar</b><br><sub>Product Owner</sub><br><sub>Datos</sub></td>
<td align="center" width="20%"><b>José Ángel López</b><br><sub>Scrum Master</sub><br><sub>Calidad y seguridad</sub></td>
<td align="center" width="20%"><b>Antonio Gómez</b><br><sub>Hardware</sub><br><sub>y experimento</sub></td>
<td align="center" width="20%"><b>Francisco González</b><br><sub>Actuadores</sub><br><sub>y alertas</sub></td>
<td align="center" width="20%"><b>Raúl Anguiano</b><br><sub>Dashboard</sub><br><sub>y algoritmo</sub></td>
</tr>
</table>

<p align="center"><sub>Implementación de internet en las cosas · Grupo 504 · Profesores Enrique Gonzales Guerrero y Jesús Carlos Morón García</sub></p>

<br>

## Seguridad

> [!WARNING]
> ThermoCare es un **prototipo escolar**, no un dispositivo médico.
> - Las pruebas se hacen solo con un integrante sano, **sin marcapasos ni implantes**. Nunca con pacientes.
> - El parche funciona **solo con power bank**, nunca conectado a la laptop o al cargador mientras se usa.
> - El calentador tiene doble corte de seguridad: por software y por un termostato de 40 °C.
> - El sistema no usa el ritmo cardíaco, para no depender de nada que pueda afectar un marcapasos.
