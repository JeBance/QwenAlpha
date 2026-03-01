const { logger } = require('../../utils/logger');

/**
 * Middleware для логирования входящих запросов
 * Добавляет correlation ID для трассировки
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function loggingMiddleware(ctx, next) {
  const correlationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  ctx.state.correlationId = correlationId;
  
  const logContext = {
    correlationId,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
    chatType: ctx.chat?.type,
    updateType: ctx.updateType,
  };
  
  // Добавляем дополнительную информацию для разных типов обновлений
  if (ctx.message) {
    logContext.messageId = ctx.message.message_id;
    logContext.hasText = !!ctx.message.text;
    logContext.hasDocument = !!ctx.message.document;
    logContext.hasPhoto = !!ctx.message.photo;
    logContext.replyToMessageId = ctx.message.reply_to_message?.message_id;
  }
  
  logger.info(logContext, 'Incoming update');
  
  const startTime = Date.now();
  
  try {
    await next();
    const duration = Date.now() - startTime;
    
    logger.info({
      correlationId,
      duration,
    }, 'Update processed');
  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error({
      correlationId,
      duration,
      error: error.message,
    }, 'Update failed');
    
    throw error;
  }
}

module.exports = { loggingMiddleware };
