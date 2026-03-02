const sessionService = require('../../services/db/sessions');
const { logger } = require('../../utils/logger');

/**
 * Middleware для управления сессиями
 * Автоматически очищает просроченные сессии раз в час
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function sessionMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  if (!userId || !chatId) {
    return next();
  }

  // Очистка просроченных сессий (раз в час)
  const lastCleanup = ctx.botInfo?.last_cleanup || 0;
  const now = Date.now();

  if (now - lastCleanup > 3600000) {
    // 1 час
    const removed = sessionService.cleanupExpired();
    logger.info({ removed }, 'Expired sessions cleaned up');
    ctx.botInfo = { ...ctx.botInfo, last_cleanup: now };
  }

  // Поиск активной сессии для текущего чата
  const isPrivate = chatId > 0 || userId === chatId;

  if (isPrivate) {
    // Личный чат - одна сессия на пользователя
    const sessionKey = `user:${userId}`;
    const session = sessionService.getByKey(sessionKey);

    if (session && session.status === 'active') {
      ctx.state.session = session;
      ctx.state.sessionKey = sessionKey;
    }
  } else {
    // Групповой чат - всегда используем последнюю активную сессию
    const chatSessions = sessionService.getChatSessions(chatId);
    let activeSession = chatSessions.find((s) => s.status === 'active');

    // Если сессии нет - создаём новую
    if (!activeSession) {
      activeSession = sessionService.create({
        userId,
        chatId,
        rootMessageId: ctx.message?.message_id || 1,
        chatType: ctx.chat.type,
        chatTitle: ctx.chat.title,
      });
    }

    if (activeSession) {
      ctx.state.session = activeSession;
      ctx.state.sessionKey = `chat:${chatId}`;
    }

    // Если есть reply, проверяем принадлежит ли оно этой сессии
    const replyToMessageId = ctx.message?.reply_to_message?.message_id;
    if (replyToMessageId && activeSession) {
      // Проверяем есть ли сообщение в дереве сессии
      if (activeSession.message_tree[replyToMessageId]) {
        ctx.state.replyToSession = true;
      }
    }
  }

  ctx.state.isPrivate = isPrivate;
  ctx.state.userId = userId;
  ctx.state.chatId = chatId;

  return next();
}

module.exports = { sessionMiddleware };
