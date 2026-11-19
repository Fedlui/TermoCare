-- =====================================================================
-- ThermoCare IoT · Consultas para las gráficas del dashboard
-- Cada consulta alimenta una gráfica. Donde dice "id_paciente = 1"
-- se cambia por el paciente que se quiera ver (en Grafana se puede
-- reemplazar por una variable, por ejemplo $paciente).
-- La columna "time" es la que Grafana usa como eje del tiempo.
-- =====================================================================
USE thermocare;

-- 1. Temperatura de las últimas 24 horas (línea: núcleo, piel y cuarto)
--    Umbrales para pintar franjas: 37.5 °C amarillo y 38.0 °C rojo
SELECT l.fecha_hora AS time, l.temp_nucleo AS nucleo, l.temp_piel AS piel, l.temp_cuarto AS cuarto
FROM LECTURA l JOIN PACIENTE p ON p.id_dispositivo = l.id_dispositivo
WHERE p.id_paciente = 1 AND l.fecha_hora >= NOW() - INTERVAL 24 HOUR
ORDER BY l.fecha_hora;

-- 2. Medicamentos para marcar sobre la gráfica 1 (anotaciones)
SELECT m.fecha_hora AS time, CONCAT(m.nombre, ' ', ROUND(m.dosis_mg), ' mg') AS texto
FROM MEDICAMENTO m
WHERE m.id_paciente = 1 AND m.fecha_hora >= NOW() - INTERVAL 24 HOUR;

-- 3. Estado actual de cada paciente (tarjetas con semáforo y tendencia)
SELECT CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       u.temp_nucleo AS nucleo_actual,
       CASE WHEN u.parche_colocado = 0 THEN 'Revisar parche'
            WHEN u.temp_nucleo >= 38.0 THEN 'Rojo'
            WHEN u.temp_nucleo >= 37.5 THEN 'Amarillo' ELSE 'Verde' END AS semaforo,
       ROUND(u.temp_nucleo - (SELECT AVG(l2.temp_nucleo) FROM LECTURA l2
                               WHERE l2.id_dispositivo = u.id_dispositivo AND l2.temp_nucleo IS NOT NULL
                                 AND l2.fecha_hora BETWEEN u.fecha_hora - INTERVAL 1 HOUR AND u.fecha_hora - INTERVAL 1 MINUTE), 2) AS cambio_ultima_hora,
       TIMESTAMPDIFF(MINUTE, u.fecha_hora, NOW()) AS minutos_desde_ultima_lectura
FROM PACIENTE p
JOIN LECTURA u ON u.id_lectura = (SELECT l.id_lectura FROM LECTURA l WHERE l.id_dispositivo = p.id_dispositivo
                                  ORDER BY l.fecha_hora DESC LIMIT 1)
ORDER BY (u.temp_nucleo >= 38) DESC, u.temp_nucleo DESC;

-- 4. Alertas por paciente: pendientes y atendidas (barras apiladas)
SELECT CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       SUM(a.atendida = 0) AS pendientes, SUM(a.atendida = 1) AS atendidas
FROM PACIENTE p LEFT JOIN ALERTA a ON a.id_paciente = p.id_paciente
GROUP BY p.id_paciente, paciente
ORDER BY pendientes DESC, atendidas DESC;

-- 5. Porcentaje del tiempo con el parche bien puesto, últimos 7 días (barras o dona)
SELECT CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       ROUND(100 * AVG(l.parche_colocado), 1) AS porcentaje_colocado
FROM PACIENTE p JOIN LECTURA l ON l.id_dispositivo = p.id_dispositivo
WHERE l.fecha_hora >= NOW() - INTERVAL 7 DAY
GROUP BY p.id_paciente, paciente
ORDER BY porcentaje_colocado;

-- 6. Minutos sin mandar datos por parche (barra con semáforo: más de 30 min = revisar)
SELECT d.numero_serie AS parche, CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       TIMESTAMPDIFF(MINUTE, MAX(l.fecha_hora), NOW()) AS minutos_sin_datos
FROM DISPOSITIVO d JOIN PACIENTE p ON p.id_dispositivo = d.id_dispositivo
LEFT JOIN LECTURA l ON l.id_dispositivo = d.id_dispositivo
GROUP BY d.id_dispositivo, d.numero_serie, paciente
ORDER BY minutos_sin_datos DESC;

-- 7. Alertas por día y por tipo, últimos 7 días (barras agrupadas)
SELECT DATE(a.fecha_hora) AS dia,
       SUM(a.tipo = 'fiebre') AS fiebre, SUM(a.tipo = 'revisar_parche') AS revisar_parche
FROM ALERTA a
WHERE a.fecha_hora >= CURDATE() - INTERVAL 6 DAY
GROUP BY dia ORDER BY dia;

-- 8. Grosor de grasa estimado por paciente (puntos en el tiempo)
SELECT o.fecha_inicio AS time, CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente, o.grosor_grasa AS grosor_mm
FROM ONDA_CALOR o JOIN PACIENTE p ON p.id_dispositivo = o.id_dispositivo
WHERE o.grosor_grasa IS NOT NULL
ORDER BY o.fecha_inicio;

--    8b. Promedio por paciente (barras)
SELECT CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       ROUND(AVG(o.grosor_grasa), 1) AS grosor_promedio_mm, ROUND(STDDEV(o.grosor_grasa), 2) AS variacion_mm
FROM ONDA_CALOR o JOIN PACIENTE p ON p.id_dispositivo = o.id_dispositivo
GROUP BY p.id_paciente, paciente ORDER BY grosor_promedio_mm;

-- 9. Ondas emitidas por día y potencia promedio (barras + línea)
SELECT DATE(o.fecha_inicio) AS dia, COUNT(*) AS ondas, ROUND(AVG(o.potencia), 1) AS potencia_promedio
FROM ONDA_CALOR o
WHERE o.fecha_inicio >= CURDATE() - INTERVAL 6 DAY
GROUP BY dia ORDER BY dia;

-- 10. Pacientes por miembro del personal (barras)
SELECT pm.nombre, pm.rol, COUNT(t.id_paciente) AS pacientes
FROM PERSONAL_MEDICO pm LEFT JOIN TRATA t ON t.id_personal = pm.id_personal
GROUP BY pm.id_personal, pm.nombre, pm.rol ORDER BY pacientes DESC;

-- 11. Alertas por miembro del personal responsable (barras apiladas)
SELECT pm.nombre, SUM(a.atendida = 1) AS atendidas, SUM(a.atendida = 0) AS pendientes
FROM PERSONAL_MEDICO pm LEFT JOIN ALERTA a ON a.id_personal = pm.id_personal
GROUP BY pm.id_personal, pm.nombre ORDER BY atendidas DESC;

-- Extra. Temperatura del núcleo de todos los pacientes, 7 días, promedio por hora (líneas)
SELECT DATE_FORMAT(l.fecha_hora, '%Y-%m-%d %H:00:00') AS time,
       CONCAT(p.nombres, ' ', p.apellido_paterno) AS paciente,
       ROUND(AVG(l.temp_nucleo), 2) AS nucleo
FROM LECTURA l JOIN PACIENTE p ON p.id_dispositivo = l.id_dispositivo
WHERE l.temp_nucleo IS NOT NULL AND l.fecha_hora >= NOW() - INTERVAL 7 DAY
GROUP BY time, paciente ORDER BY time;
