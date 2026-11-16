-- =====================================================================
-- ThermoCare IoT · Datos de prueba
-- 2 dispositivos, 2 pacientes, 2 miembros del personal médico,
-- 2 personas de apoyo, 72 lecturas de las últimas 24 horas y 3 alertas.
-- Las fechas se calculan con NOW(), así que siempre son "de hoy".
-- Ejecutar después de ScriptCreacionBaseDatos_iot_Equipo5.sql
-- =====================================================================
USE thermocare;
SET NAMES utf8mb4;

INSERT INTO DISPOSITIVO (id_dispositivo, numero_serie, fecha_alta) VALUES
 (1, 'TC-0001', '2026-10-26'),
 (2, 'TC-0002', '2026-10-26');

INSERT INTO PACIENTE (id_paciente, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, sexo, estatura_cm, peso_kg, id_dispositivo) VALUES
 (1, 'Ana',  'Rivera',  'López',  '1968-03-14', 'F', 162, 61.50, 1),
 (2, 'Luis', 'Salinas', 'Torres', '1975-09-02', 'M', 175, 78.20, 2);

-- Contraseñas guardadas como hash (SHA-256 de una contraseña de prueba)
INSERT INTO PERSONAL_MEDICO (id_personal, nombre, rol, correo, contrasena, telegram_id) VALUES
 (1, 'Dra. Laura Méndez', 'medico',     'laura.mendez@hospital.test', SHA2('prueba123', 256), NULL),
 (2, 'Carlos Ruiz',       'enfermeria', 'carlos.ruiz@hospital.test',  SHA2('prueba123', 256), NULL);

INSERT INTO PERSONA_APOYO (id_apoyo, nombre, rol, correo, contrasena, telegram_id) VALUES
 (1, 'Marta Rivera',   'hija',   'marta.rivera@familia.test',  SHA2('prueba123', 256), NULL),
 (2, 'Jorge Salinas',  'hermano','jorge.salinas@familia.test', SHA2('prueba123', 256), NULL);

INSERT INTO TELEFONO_PERSONAL VALUES (1, '8110000001'), (2, '8110000002'), (2, '8110000003');
INSERT INTO TELEFONO_APOYO    VALUES (1, '8120000001'), (2, '8120000002');

INSERT INTO TRATA VALUES (1, 1), (2, 1), (1, 2);
INSERT INTO APOYA VALUES (1, 1), (2, 2);

-- 36 lecturas del dispositivo 1 (una cada 40 min), con un episodio de fiebre
INSERT INTO LECTURA (id_dispositivo, fecha_hora, temp_piel, temp_flujo, temp_cuarto, temp_nucleo, parche_colocado, calentador_encendido)
WITH RECURSIVE n AS (SELECT 0 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 35),
d AS (
  SELECT i,
         NOW() - INTERVAL (35 - i) * 40 MINUTE AS fecha,
         CASE i WHEN 18 THEN 34.60 WHEN 19 THEN 34.90 WHEN 20 THEN 35.30
                WHEN 21 THEN 35.50 WHEN 22 THEN 35.20 WHEN 23 THEN 34.70
                ELSE ROUND(34.00 + 0.15 * SIN(i), 2) END AS piel,
         24.00 AS cuarto,
         IF(i IN (10, 28), 0, 1) AS colocado
  FROM n)
SELECT 1, fecha, piel, piel - 0.40, cuarto,
       IF(colocado = 1, ROUND(piel + 0.28 * (piel - cuarto), 2), NULL),
       colocado, IF(i % 4 = 0, 1, 0)
FROM d;

-- 36 lecturas del dispositivo 2; la última llegó hace más de una hora
INSERT INTO LECTURA (id_dispositivo, fecha_hora, temp_piel, temp_flujo, temp_cuarto, temp_nucleo, parche_colocado, calentador_encendido)
WITH RECURSIVE n AS (SELECT 0 AS i UNION ALL SELECT i + 1 FROM n WHERE i < 35),
d AS (
  SELECT i,
         NOW() - INTERVAL 75 MINUTE - INTERVAL (35 - i) * 40 MINUTE AS fecha,
         ROUND(33.90 + 0.12 * COS(i), 2) AS piel,
         23.50 AS cuarto,
         IF(i IN (15, 30), 0, 1) AS colocado
  FROM n)
SELECT 2, fecha, piel, piel - 0.40, cuarto,
       IF(colocado = 1, ROUND(piel + 0.28 * (piel - cuarto), 2), NULL),
       colocado, IF(i % 4 = 0, 1, 0)
FROM d;

-- 3 alertas ya atendidas
INSERT INTO ALERTA (id_paciente, id_personal, tipo, temperatura, fecha_hora, atendida) VALUES
 (1, 1, 'fiebre',         38.72, NOW() - INTERVAL 600 MINUTE, 1),
 (1, 1, 'revisar_parche', NULL,  NOW() - INTERVAL 1000 MINUTE, 1),
 (2, 1, 'revisar_parche', NULL,  NOW() - INTERVAL 475 MINUTE, 1);

INSERT INTO MEDICAMENTO (id_paciente, nombre, dosis_mg, fecha_hora) VALUES
 (1, 'Paracetamol', 500.00, NOW() - INTERVAL 12 HOUR);

INSERT INTO ONDA_CALOR (id_dispositivo, tipo, potencia, fecha_inicio, fecha_fin, grosor_grasa) VALUES
 (1, 'onda_5min', 25, NOW() - INTERVAL 3 HOUR, NOW() - INTERVAL 3 HOUR + INTERVAL 5 MINUTE, 6.2),
 (2, 'onda_5min', 25, NOW() - INTERVAL 4 HOUR, NOW() - INTERVAL 4 HOUR + INTERVAL 5 MINUTE, 8.9);
