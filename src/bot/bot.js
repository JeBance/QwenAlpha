const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const { logger } = require('../utils/logger');
const { loggingMiddleware } = require('./middleware/logging');
const { rateLimitMiddleware } = require('./middleware/rateLimit');
const { sessionMiddleware } = require('./middleware/session');
const { authMiddleware } = require('./middleware/auth');

// Handlers
const startHandler = require('./handlers/start');
const helpHandler = require('./handlers/help');
const resetHandler = require('./handlers/reset');
const statsHandler = require('./handlers/stats');
const settingsHandler = require('./handlers/settings');
const adminHandler = require('./handlers/admin');
const messageHandler = require('./handlers/message');
const fileHandler = require('./handlers/file');

/**
 * Инициализация Telegraf бота
 * @param {string} token - Telegram Bot API токен
 * @returns {Promise<import('telegraf').Telegraf>} Бот
 */
async function initBot(token) {
  const bot = new Telegraf(token, {
    handlerTimeout: 120000, // Таймаут обработки (120 секунд)
  });
  bot.catch((err, ctx) => {
    logger.error({
      err,
      userId: ctx?.from?.id,
      chatId: ctx?.chat?.id,
      updateType: ctx?.updateType,
    }, 'Bot error caught');
    
    // Не показываем пользователю технические детали
    if (ctx && ctx.reply) {
      ctx.reply('⚠️ Произошла ошибка. Попробуйте позже.').catch(() => {});
    }
  });
  
  // Middleware
  bot.use(loggingMiddleware);
  bot.use(rateLimitMiddleware);
  bot.use(authMiddleware);
  bot.use(sessionMiddleware);
  
  // Commands
  bot.command('start', startHandler);
  bot.command('help', helpHandler);
  bot.command('reset', resetHandler);
  bot.command('stats', statsHandler);
  bot.command('settings', settingsHandler);
  bot.command('admin', adminHandler);
  
  // Сообщения
  bot.on(message('text'), messageHandler);
  bot.on(message('document'), fileHandler);
  bot.on(message('photo'), fileHandler);
  
  // Упоминания бота (для групповых чатов)
  bot.on('message', async (ctx, next) => {
    const botInfo = await bot.telegram.getMe();
    const botUsername = `@${botInfo.username}`;
    
    if (ctx.message.text?.includes(botUsername)) {
      return messageHandler(ctx);
    }
    
    return next();
  });
  
  logger.info('Bot initialized with middleware and handlers');
  
  return bot;
}

module.exports = { initBot };
