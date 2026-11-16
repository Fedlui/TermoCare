# Base de datos

MySQL 8.0, base `thermocare`, 12 tablas en tercera forma normal.

| Archivo | Para qué |
| --- | --- |
| `ScriptCreacionBaseDatos_iot_Equipo5.sql` | Crea la base de datos con sus tablas, llaves y restricciones |
| `DatosPrueba_iot_Equipo5.sql` | 2 parches, 2 pacientes, personal médico, familiares, 72 lecturas de las últimas 24 horas y 3 alertas |
| `indicadores_iot_Equipo5.sql` | Temperatura del núcleo por hora, alertas por paciente y colocación del parche |

## Cómo cargarla

1. Abre XAMPP y enciende **MySQL**.
2. En phpMyAdmin (o DBeaver) ejecuta, en este orden:
   1. `ScriptCreacionBaseDatos_iot_Equipo5.sql`
   2. `DatosPrueba_iot_Equipo5.sql`
3. Para ver los indicadores ejecuta `indicadores_iot_Equipo5.sql`.

Desde terminal:

```bash
mysql -u root < ScriptCreacionBaseDatos_iot_Equipo5.sql
mysql -u root < DatosPrueba_iot_Equipo5.sql
mysql -u root -t < indicadores_iot_Equipo5.sql
```

Las fechas de los datos de prueba se calculan con `NOW()`, así que siempre parecen de las últimas 24 horas.
