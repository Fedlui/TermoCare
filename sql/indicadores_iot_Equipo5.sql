-- =====================================================================
-- ThermoCare IoT · Indicadores
-- Tres consultas que responden lo que necesita el equipo médico.
-- =====================================================================
USE thermocare;

-- ---------------------------------------------------------------------
-- Indicador 1. Temperatura del núcleo por hora (últimas 24 horas)
-- Promedio, máxima y mínima por paciente y hora, con el color del
-- semáforo. Solo cuenta lecturas con el parche bien puesto.
-- ---------------------------------------------------------------------
SELECT
  p.id_paciente,
  CONCAT(p.nombres, ' ', p.apellido_paterno)   AS paciente,
  DATE_FORMAT(l.fecha_hora, '%Y-%m-%d %H:00')  AS hora,
  COUNT(*)                                     AS lecturas_validas,
  ROUND(AVG(l.temp_nucleo), 2)                 AS nucleo_promedio,
  MAX(l.temp_nucleo)                           AS nucleo_maximo,
  MIN(l.temp_nucleo)                           AS nucleo_minimo,
  CASE
    WHEN MAX(l.temp_nucleo) >= 38.0 THEN 'ROJO (fiebre)'
    WHEN MAX(l.temp_nucleo) >= 37.5 THEN 'AMARILLO (precaucion)'
    ELSE 'VERDE (normal)'
  END                                          AS estado
FROM LECTURA l
JOIN DISPOSITIVO d ON d.id_dispositivo = l.id_dispositivo
JOIN PACIENTE p    ON p.id_dispositivo = d.id_dispositivo
WHERE l.fecha_hora >= NOW() - INTERVAL 24 HOUR
  AND l.parche_colocado = 1
  AND l.temp_nucleo IS NOT NULL
GROUP BY p.id_paciente, paciente, hora
ORDER BY p.id_paciente, hora;

-- ---------------------------------------------------------------------
-- Indicador 2. Alertas por paciente
-- Cuántas alertas de cada tipo, cuántas siguen pendientes, porcentaje
-- atendido, temperatura más alta y última alerta.
-- ---------------------------------------------------------------------
SELECT
  p.id_paciente,
  CONCAT(p.nombres, ' ', p.apellido_paterno)   AS paciente,
  a.tipo,
  COUNT(*)                                     AS total_alertas,
  SUM(a.atendida = 0)                          AS pendientes,
  ROUND(100 * AVG(a.atendida), 1)              AS porcentaje_atendidas,
  MAX(a.temperatura)                           AS temperatura_maxima,
  MAX(a.fecha_hora)                            AS ultima_alerta,
  MIN(pm.nombre)                               AS medico_responsable
FROM ALERTA a
JOIN PACIENTE p              ON p.id_paciente  = a.id_paciente
LEFT JOIN PERSONAL_MEDICO pm ON pm.id_personal = a.id_personal
GROUP BY p.id_paciente, paciente, a.tipo
ORDER BY pendientes DESC, total_alertas DESC;

-- ---------------------------------------------------------------------
-- Indicador 3. Colocación del parche (últimos 7 días)
-- Porcentaje de lecturas con el parche bien puesto, última lectura y
-- minutos que lleva cada dispositivo sin transmitir.
-- ---------------------------------------------------------------------
SELECT
  d.id_dispositivo,
  d.numero_serie,
  CONCAT(p.nombres, ' ', p.apellido_paterno)   AS paciente,
  COUNT(l.id_lectura)                          AS lecturas_totales,
  SUM(l.parche_colocado = 0)                   AS lecturas_parche_despegado,
  ROUND(100 * AVG(l.parche_colocado), 1)       AS porcentaje_parche_colocado,
  MAX(l.fecha_hora)                            AS ultima_lectura,
  TIMESTAMPDIFF(MINUTE, MAX(l.fecha_hora), NOW()) AS minutos_sin_transmitir
FROM DISPOSITIVO d
JOIN PACIENTE p     ON p.id_dispositivo = d.id_dispositivo
LEFT JOIN LECTURA l ON l.id_dispositivo = d.id_dispositivo
                   AND l.fecha_hora >= NOW() - INTERVAL 7 DAY
GROUP BY d.id_dispositivo, d.numero_serie, paciente
ORDER BY porcentaje_parche_colocado ASC;
