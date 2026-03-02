const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');
const { logger } = require('../../utils/logger');

/**
 * Обработчик команды /start
 * Приветствие и регистрация пользователя
 * @param {import('telegraf').Context} ctx
 */
async function startHandler(ctx) {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const isPrivate = chatId > 0 || userId === chatId;
  
  // Регистрация супер-админа если первый
  const isNewSuperAdmin = ctx.state.isSuperAdmin;
  
  if (isNewSuperAdmin) {
    logger.info({ userId }, 'Super admin registered via /start');
    
    await ctx.reply(
      '🎉 **Поздравляю! Вы — первый пользователь и супер-администратор Qwen Alpha!**\n\n' +
      'Теперь вы можете:\n' +
      '• Управлять другими администраторами через /admin\n' +
      '• Настраивать бота через /settings\n' +
      '• Просматривать статистику через /stats\n\n' +
      '📚 Документация: https://github.com/JeBance/QwenAlpha\n\n' +
      'Для начала работы отправьте мне код или напишите /help',
      { parse_mode: 'Markdown' }
    );
    
    return;
  }
  
  // Обычное приветствие
  const welcomeMessages = [
    '👋 Привет! Я Qwen Alpha — AI ассистент для работы с кодом.',
    '🔍 Я умею:\n' +
    '  • Code Review и поиск багов\n' +
    '  • Генерация кода по описанию\n' +
    '  • Объяснение сложных участков\n' +
    '  • Рефакторинг и оптимизация\n\n' +
    '📤 Отправь мне код текстом или файлом, и я проанализирую его!\n\n' +
    'ℹ️ /help — список команд\n' +
    '📊 /stats — ваша статистика\n' +
    '⚙️ /settings — настройки',
  ];
  
  await ctx.reply(welcomeMessages.join('\n'));
  
  // Создание сессии для личного чата если нет активной
  if (isPrivate && !ctx.state.session) {
    const session = sessionService.create({
      userId,
      chatId,
      rootMessageId: ctx.message.message_id,
      chatType: 'private',
    });
    ctx.state.session = session;
    statsService.incrementSessionCreated();
  }
}

module.exports = startHandler;
