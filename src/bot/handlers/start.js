const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');
const { systemPromptService } = require('../../services/db/systemPrompt');
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

  // Инициализация системного промпта при первом запуске
  systemPromptService.init();

  if (isNewSuperAdmin) {
    logger.info({ userId }, 'Super admin registered via /start');

    const welcomeMessage = `
🎉 <b>Поздравляю! Вы — первый пользователь и супер-администратор Qwen Alpha!</b>

👑 <b>Ваши привилегии:</b>
• Полный доступ ко всем функциям бота
• Управление другими администраторами
• Настройка системного промпта
• Просмотр статистики и логов

📋 <b>Что делать дальше:</b>

<b>1. Настройте системный промпт</b> (опционально):
/setSystemPrompt &lt;ваш промпт&gt;

Пример для консультанта:
/setSystemPrompt Ты — консультант магазина электроники. Отвечай кратко, предлагай товары.

<b>2. Просмотрите инструкции:</b>
/instructions — Полная справка по настройке

<b>3. Добавьте администраторов</b> (опционально):
/admin add &lt;user_id&gt;

<b>4. Начните использовать:</b>
• Отправьте код для анализа
• Задайте вопрос по программированию
• Используйте /help для списка команд

🔗 <b>Репозиторий:</b> https://github.com/JeBance/QwenAlpha
📝 <b>Документация:</b> https://github.com/JeBance/QwenAlpha#readme

Для начала работы отправьте мне код или напишите /help
    `.trim();

    await ctx.reply(welcomeMessage, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });

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
      '📖 /instructions — инструкции по настройке\n' +
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
