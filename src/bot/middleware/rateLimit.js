const { logger } = require('../../utils/logger');

/**
 * Хранилище запросов пользователей в памяти
 * Ключ: user_id, Значение: массив временных меток
 */
const userRequests = new Map();

/**
 * Middleware для rate limiting
 * Ограничивает количество запросов от пользователя в единицу времени
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function rateLimitMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    return next();
  }
  
  const now = Date.now();
  const windowMs = 60000; // 1 минута
  const maxRequests = 10; // 10 запросов в минуту
  
  if (!userRequests.has(userId)) {
    userRequests.set(userId, []);
  }
  
  const requests = userRequests.get(userId);
  
  // Очищаем старые запросы за пределами окна
  const recentRequests = requests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    const oldestRequest = Math.min(...recentRequests);
    const waitTime = Math.ceil((windowMs - (now - oldestRequest)) / 1000);
    
    logger.warn({ userId, waitTime }, 'Rate limit exceeded');
    
    await ctx.reply(
      `⚠️ Слишком много запросов. Пожалуйста, подождите ${waitTime} сек.`
    );
    
    return;
  }
  
  // Добавляем текущий запрос
  recentRequests.push(now);
  userRequests.set(userId, recentRequests);
  
  return next();
}

/**
 * Сброс rate limiting для пользователя
 * @param {number} userId
 */
function resetRateLimit(userId) {
  userRequests.delete(userId);
}

/**
 * Очистка всех rate limit данных
 */
function clearRateLimits() {
  userRequests.clear();
}

module.exports = {
  rateLimitMiddleware,
  resetRateLimit,
  clearRateLimits,
};
