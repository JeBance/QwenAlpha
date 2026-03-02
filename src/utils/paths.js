const path = require('path');
const os = require('os');

/**
 * Базовая директория для хранения данных Qwen Alpha
 * ~/.qwen-alpha/
 */
const QWEN_ALPHA_HOME = path.join(os.homedir(), '.qwen-alpha');

/**
 * Директории для хранения данных
 */
const DIRECTORIES = {
  /** База данных (JSON файлы) */
  db: path.join(QWEN_ALPHA_HOME, 'db'),
  /** Логи */
  logs: path.join(QWEN_ALPHA_HOME, 'logs'),
  /** Конфигурация */
  config: path.join(QWEN_ALPHA_HOME, 'config'),
  /** Временные файлы */
  temp: path.join(QWEN_ALPHA_HOME, 'temp'),
};

/**
 * Файлы базы данных
 */
const DB_FILES = {
  users: path.join(DIRECTORIES.db, 'users.json'),
  sessions: path.join(DIRECTORIES.db, 'sessions.json'),
  admins: path.join(DIRECTORIES.db, 'admins.json'),
  stats: path.join(DIRECTORIES.db, 'stats.json'),
  settings: path.join(DIRECTORIES.config, 'settings.json'),
};

/**
 * Лог файл (с ежедневной ротацией)
 */
function getLogFilePath(date = new Date()) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(DIRECTORIES.logs, `qwen-alpha-${dateStr}.log`);
}

/**
 * Инициализация директорий
 * Создаёт все необходимые директории, если они не существуют
 */
function initDirectories() {
  const fs = require('fs');

  for (const dir of Object.values(DIRECTORIES)) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = {
  QWEN_ALPHA_HOME,
  DIRECTORIES,
  DB_FILES,
  getLogFilePath,
  initDirectories,
};
