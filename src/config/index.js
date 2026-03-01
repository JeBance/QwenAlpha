require('dotenv').config();

/**
 * Конфигурация приложения
 * Загружает значения из переменных окружения с fallback на значения по умолчанию
 */
module.exports = {
  /** Настройки бота */
  bot: {
    /** Telegram Bot API токен */
    token: process.env.BOT_TOKEN,
    /** Уровень логирования */
    logLevel: process.env.LOG_LEVEL || 'info',
    /** Whitelist пользователей (опционально) */
    allowedUsers: process.env.ALLOWED_USERS
      ? process.env.ALLOWED_USERS.split(',').map(Number).filter(Boolean)
      : [],
  },
  
  /** Настройки Qwen Code */
  qwen: {
    /** Таймаут выполнения команды (мс) */
    timeout: parseInt(process.env.QWEN_TIMEOUT, 10) || 60000,
    /** Максимальный размер буфера (байты) */
    maxBuffer: parseInt(process.env.QWEN_MAX_BUFFER, 10) || 2 * 1024 * 1024, // 2MB
    /** Максимальный размер файла для анализа (байты) */
    maxFileSize: 2 * 1024 * 1024, // 2MB
  },
  
  /** Rate limiting */
  rateLimit: {
    /** Окно времени (мс) */
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 60000, // 1 минута
    /** Максимум запросов в окно */
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX, 10) || 10,
  },
  
  /** Сессии */
  session: {
    /** Срок жизни сессии (часы) */
    timeoutHours: 24,
    /** Максимум сообщений в сессии */
    maxMessages: 1000,
  },
  
  /** Логирование */
  logging: {
    /** Ротация логов (дни) */
    rotationDays: 1,
  },
  
  /** Пути */
  paths: {
    /** Домашняя директория ~/.qwen-alpha */
    home: null, // Заполняется при инициализации
  },
};
