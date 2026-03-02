#!/usr/bin/env node

const { Command } = require('commander');
const packageJson = require('../package.json');
const { startBot } = require('../src');
const { logger } = require('../src/utils/logger');

/**
 * Парсинг списка пользователей из строки
 * @param {string} value - Строка вида "123456789,987654321"
 * @returns {number[]} Массив user_id
 */
function parseUserList(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));
}

const program = new Command();

program
  .name('qwen-alpha')
  .description('Telegram бот для работы с Qwen Code — AI-powered code review и генерация кода')
  .version(packageJson.version);

program
  .option('--token <TOKEN>', 'Telegram Bot API токен (получите у @BotFather)')
  .option('--log-level <LEVEL>', 'Уровень логирования (debug, info, warn, error)', 'info')
  .option('--allowed-users <USERS>', 'Whitelist user_id через запятую (опционально)', '')
  .option('--init-only', 'Только инициализация хранилищ и выход', false)
  .addHelpText('after', `
Примеры использования:
  $ qwen-alpha --token 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
  $ qwen-alpha --token <TOKEN> --log-level debug
  $ qwen-alpha --token <TOKEN> --allowed-users 123456789,987654321

Документация: https://github.com/JeBance/QwenAlpha
`);

program.parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Инициализация хранилищ
    const { initDirectories } = require('../src/utils/paths');
    const { storeManager } = require('../src/services/db');
    
    initDirectories();
    storeManager.init();
    
    // Если только инициализация
    if (options.initOnly) {
      console.log('✅ Qwen Alpha хранилища инициализированы');
      console.log(`📁 Данные хранятся в: ~/.qwen-alpha/`);
      process.exit(0);
    }
    
    // Валидация токена
    if (!options.token || options.token === '<TOKEN>') {
      console.error('❌ Ошибка: Telegram Bot API токен не указан');
      console.error('');
      console.error('Получите токен у @BotFather и запустите:');
      console.error('  qwen-alpha --token <YOUR_BOT_TOKEN>');
      console.error('');
      console.error('Или установите переменную окружения:');
      console.error('  export BOT_TOKEN=<YOUR_BOT_TOKEN>');
      console.error('  qwen-alpha --token $BOT_TOKEN');
      process.exit(1);
    }
    
    // Подготовка опций для startBot
    const botOptions = {
      token: options.token,
      logLevel: options.logLevel,
      allowedUsers: parseUserList(options.allowedUsers),
    };
    
    // Запуск бота
    await startBot(botOptions);
    
    console.log('✅ Qwen Alpha запущен');
    console.log('   Нажмите Ctrl+C для остановки');
    
  } catch (error) {
    logger.error({ error }, 'Failed to start Qwen Alpha');
    console.error('❌ Ошибка при запуске:', error.message);
    process.exit(1);
  }
}

main();
