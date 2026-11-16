// Todo lo que se puede configurar de la API está aquí.
// Se puede sobrescribir con variables de entorno (por ejemplo DB_PASSWORD).
module.exports = {
  puerto: Number(process.env.PUERTO || 3000),

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',      // XAMPP trae root sin contraseña
    database: process.env.DB_NAME || 'thermocare',
    charset: 'utf8mb4'
  },

  // Rangos válidos de temperatura (°C)
  temperaturaMin: 0,
  temperaturaMax: 50,

  // Semáforo de la temperatura del núcleo (°C)
  umbralAmarillo: 37.5,
  umbralRojo: 38.0,

  // T_núcleo = T_piel + K · (T_piel − T_cuarto)
  factorK: 0.28,

  // No repetir una alerta igual si hay otra sin atender de los últimos N minutos
  minutosSinRepetir: 5,

  // Cada cuántos segundos manda datos el NodeMCU
  intervaloSegundos: 10,

  // Bot de Telegram (vacío = solo se escribe el aviso en pantalla)
  telegramToken: process.env.TELEGRAM_TOKEN || ''
};
