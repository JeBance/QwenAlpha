const { initDirectories } = require('./utils/paths');
const { logger } = require('./utils/logger');
const config = require('./config');
const { initBot } = require('./bot/bot');

/**
 * Инициализация и запуск бота
 * @param {Object} options - Опции запуска
 * @param {string} options.token - Telegram Bot API токен
 * @param {string} [options.logLevel] - Уровень логирования
 * @param {number[]} [options.allowedUsers] - Whitelist пользователей
 */
async function startBot(options = {}) {
  try {
    // Инициализация директорий
    initDirectories();

    // Применение опций из CLI
    if (options.token) {
      config.bot.token = options.token;
    }
    if (options.logLevel) {
      config.bot.logLevel = options.logLevel;
    }
    if (options.allowedUsers) {
      config.bot.allowedUsers = options.allowedUsers;
    }

    // Валидация токена
    if (!config.bot.token) {
      throw new Error(
        'Telegram Bot API токен не указан. ' +
          'Используйте --token <TOKEN> или установите переменную окружения BOT_TOKEN'
      );
    }

    logger.info(
      {
        logLevel: config.bot.logLevel,
        allowedUsers: config.bot.allowedUsers.length > 0 ? config.bot.allowedUsers : 'all',
      },
      'Starting Qwen Alpha Bot'
    );

    // Инициализация и запуск бота
    const bot = await initBot(config.bot.token, config);

    // Запуск в режиме polling
    await bot.launch();

    logger.info('Bot launched successfully');

    // Отправка уведомления администратору о запуске
    try {
      const botInfo = await bot.telegram.getMe();
      const adminService = require('./services/db/admins');
      const allAdmins = adminService.getAllAdminIds();

      if (allAdmins.length > 0) {
        const startupMessage =
          '✅ <b>Бот запущен</b>\n\n' +
          `🤖 Имя: <b>${botInfo.first_name}</b>\n` +
          `🆔 ID: <code>${botInfo.id}</code>\n` +
          `👤 Username: @${botInfo.username}\n\n` +
          `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n\n` +
          'Бот готов к работе! 🚀';

        // Сначала отправляем супер-админу
        const superAdmin = allAdmins.find((a) => a.isSuperAdmin);
        if (superAdmin) {
          await bot.telegram.sendMessage(superAdmin.id, startupMessage, {
            parse_mode: 'HTML',
          });
          logger.info({ adminId: superAdmin.id }, 'Startup notification sent to super admin');
        }

        // Потом остальным админам
        const otherAdmins = allAdmins.filter((a) => !a.isSuperAdmin);
        for (const admin of otherAdmins) {
          await bot.telegram.sendMessage(admin.id, startupMessage, {
            parse_mode: 'HTML',
          }).catch((err) => {
            logger.warn({ adminId: admin.id, error: err.message }, 'Failed to send startup message');
          });
        }

        logger.info({ adminCount: allAdmins.length }, 'Startup notifications sent');
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to send startup notification');
    }

    // Обработчики graceful shutdown
    const shutdown = async (signal) => {
      logger.info({ signal }, 'Graceful shutdown initiated');
      bot.stop(signal);

      // Закрываем соединение с Telegram
      await bot.telegram.getMe().catch(() => {});

      logger.info('Bot stopped');
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));

    return bot;
  } catch (error) {
    logger.error({ error }, 'Failed to start bot');
    throw error;
  }
}

/**
 * Остановка бота
 * @param {import('telegraf').Telegraf} bot - Экземпляр бота
 */
async function stopBot(bot) {
  logger.info('Stopping bot');
  bot.stop('manual');
}

module.exports = {
  startBot,
  stopBot,
  config,
  logger,
};
