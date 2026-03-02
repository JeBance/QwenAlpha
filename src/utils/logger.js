const pino = require('pino');
const fs = require('fs');
const { getLogFilePath, initDirectories } = require('./paths');

/**
 * Получает уровень логирования из переменных окружения
 * @returns {string} Уровень логирования (debug, info, warn, error)
 */
function getLogLevel() {
  const level = process.env.LOG_LEVEL || 'info';
  const validLevels = ['debug', 'info', 'warn', 'error', 'fatal', 'silent'];
  return validLevels.includes(level) ? level : 'info';
}

/**
 * Создаёт и конфигурирует логгер
 * @returns {import('pino').Logger} Настроенный логгер Pino
 */
function createLogger() {
  const level = getLogLevel();

  // Инициализация директорий
  initDirectories();

  // Поток для файла логов
  const logFilePath = getLogFilePath();
  let fileStream;

  try {
    fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
  } catch (error) {
    console.error('Failed to create log file stream:', error.message);
    fileStream = process.stdout;
  }

  return pino(
    {
      level,
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.multistream([
      { stream: fileStream, level },
      { stream: process.stdout, level },
    ])
  );
}

/**
 * Логгер с добавлением контекста
 */
class ContextLogger {
  constructor(baseLogger, defaultContext = {}) {
    this.baseLogger = baseLogger;
    this.defaultContext = defaultContext;
  }

  child(context) {
    return new ContextLogger(this.baseLogger.child(context), {
      ...this.defaultContext,
      ...context,
    });
  }

  debug(msg, context = {}) {
    this.baseLogger.debug({ ...this.defaultContext, ...context }, msg);
  }

  info(msg, context = {}) {
    this.baseLogger.info({ ...this.defaultContext, ...context }, msg);
  }

  warn(msg, context = {}) {
    this.baseLogger.warn({ ...this.defaultContext, ...context }, msg);
  }

  error(msg, context = {}) {
    this.baseLogger.error({ ...this.defaultContext, ...context }, msg);
  }

  fatal(msg, context = {}) {
    this.baseLogger.fatal({ ...this.defaultContext, ...context }, msg);
  }
}

// Создаём базовый логгер
const logger = createLogger();

// Обработчик для ежедневной ротации логов
function setupLogRotation() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  // Планируем ротацию на полночь
  setTimeout(() => {
    logger.info('Rotating log file');
    setupLogRotation(); // Планируем следующую ротацию
  }, msUntilMidnight);
}

setupLogRotation();

module.exports = {
  logger,
  ContextLogger,
  createLogger,
  getLogLevel,
};
