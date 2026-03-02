const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');

/**
 * Обработчик команды /reset
 * Сброс текущей сессии пользователя
 * @param {import('telegraf').Context} ctx
 */
async function resetHandler(ctx) {
  const userId = ctx.state.userId;
  const chatId = ctx.state.chatId;
  const isPrivate = ctx.state.isPrivate;

  if (isPrivate) {
    // Личный чат — полное удаление старой сессии
    const sessionKey = `user:${userId}`;
    const oldSession = sessionService.getByKey(sessionKey);

    if (oldSession) {
      sessionService.remove(sessionKey);
    }

    // Создание новой сессии
    const newSession = sessionService.create({
      userId,
      chatId,
      rootMessageId: ctx.message.message_id,
      chatType: 'private',
    });

    statsService.incrementSessionCreated();

    await ctx.reply(
      '🔄 **Сессия сброшена**\n\n' +
        'Контекст предыдущего диалога очищен. Начнём с чистого листа!\n\n' +
        `🆔 Новая сессия: \`${newSession.session_id}\``,
      { parse_mode: 'Markdown' }
    );
  } else {
    // Групповой чат — информация
    await ctx.reply(
      '⚠️ **Сброс сессии в группах**\n\n' +
        'В групповых чатах команда /reset не работает.\n\n' +
        'Чтобы начать новую тему, просто отправьте:\n' +
        '  `/qwen <ваш запрос>`\n\n' +
        'Каждая тема — отдельная сессия с собственным контекстом.',
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = resetHandler;
