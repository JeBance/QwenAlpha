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
  
  if (now - lastCleanup > 3600000) { // 1 час
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
    // Групповой чат - поиск сессии по reply или создание новой
    const replyToMessageId = ctx.message?.reply_to_message?.message_id;

    if (replyToMessageId) {
      // Поиск сессии по сообщению, на которое ответили
      const session = sessionService.findByMessage(chatId, replyToMessageId);

      if (session) {
        ctx.state.session = session;
        ctx.state.sessionKey = `chat:${chatId}`;
        ctx.state.replyToSession = true;
      }
    }
    
    // Если сессии нет, ищем последнюю активную сессию чата
    if (!ctx.state.session) {
      const chatSessions = sessionService.getChatSessions(chatId);
      const activeSession = chatSessions.find(s => s.status === 'active');
      if (activeSession) {
        ctx.state.session = activeSession;
        ctx.state.sessionKey = `chat:${chatId}`;
      }
    }
  }
  
  ctx.state.isPrivate = isPrivate;
  ctx.state.userId = userId;
  ctx.state.chatId = chatId;
  
  return next();
}

module.exports = { sessionMiddleware };
