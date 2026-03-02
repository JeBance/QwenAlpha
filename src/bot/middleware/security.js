const { DANGEROUS_PATTERNS, SENSITIVE_PATTERNS } = require('../../config/security');
const adminService = require('../../services/db/admins');
const { logger } = require('../../utils/logger');

/**
 * Middleware для проверки безопасности запросов
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function securityMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  const message = ctx.message?.text;

  if (!userId || !message) {
    return next();
  }

  // Супер-админ пропускает все проверки
  if (adminService.isSuperAdmin(userId)) {
    ctx.state.isAdmin = true;
    return next();
  }

  ctx.state.isAdmin = false;

  // Проверка на опасные паттерны
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(message)) {
      logger.warn({ userId, pattern: pattern.toString() }, 'Dangerous request blocked');
      await ctx.reply(
        '⚠️ **Запрос заблокирован**\n\n' +
          'Этот запрос содержит потенциально опасные операции.\n' +
          'Обратитесь к администратору для получения доступа.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  return next();
}

/**
 * Фильтрация ответа Qwen — скрытие чувствительной информации
 * @param {string} response - Ответ от Qwen
 * @param {number} userId - ID пользователя
 * @returns {string} Отфильтрованный ответ
 */
function filterResponse(response, userId) {
  // Супер-админ видит всё
  if (adminService.isSuperAdmin(userId)) {
    return response;
  }

  let filtered = response;

  // Применяем паттерны фильтрации
  for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
    filtered = filtered.replace(pattern, replacement);
  }

  return filtered;
}

module.exports = {
  securityMiddleware,
  filterResponse,
};
