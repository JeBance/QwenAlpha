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
    // Личный чат — сброс сессии пользователя
    const sessionKey = `user:${userId}`;
    const session = sessionService.getByKey(sessionKey);

    if (session) {
      sessionService.close(session.session_id, chatId);
    }

    // Создание новой сессии
    sessionService.create({
      userId,
      chatId,
      rootMessageId: ctx.message.message_id,
      chatType: 'private',
    });

    statsService.incrementSessionCreated();
    
    await ctx.reply(
      '🔄 **Сессия сброшена**\n\n' +
      'Контекст предыдущего диалога очищен. Начнём с чистого листа!',
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
