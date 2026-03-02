const userService = require('../../services/db/users');
const adminService = require('../../services/db/admins');
const { storeManager } = require('../../services/db');
const { logger } = require('../../utils/logger');
const config = require('../../config');

/**
 * Middleware для аутентификации и авторизации пользователей
 * @param {import('telegraf').Context} ctx
 * @param {Function} next
 */
async function authMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  
  if (!userId) {
    return next();
  }
  
  // Проверка whitelist (если настроен)
  if (config.bot.allowedUsers.length > 0) {
    if (!config.bot.allowedUsers.includes(userId)) {
      logger.warn({ userId }, 'User not in whitelist');
      await ctx.reply('⛔ Доступ запрещён. Вы не в списке разрешённых пользователей.');
      return;
    }
  }
  
  // Получение или создание пользователя
  let user = userService.getById(userId);
  
  if (!user) {
    user = userService.upsert({
      id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
    });
    logger.info({ userId, username: ctx.from.username }, 'New user registered');
  } else {
    // Обновление last_seen и имени
    userService.upsert({
      id: userId,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
    });
  }
  
  // Проверка бана
  if (user.is_banned) {
    logger.warn({ userId }, 'Banned user attempted access');
    await ctx.reply('⛔ Ваш аккаунт заблокирован.');
    return;
  }

  // Проверка блокировки бота (lock mode)
  const settings = storeManager.get('settings');
  const settingsData = settings.getData();
  
  if (settingsData.locked && !adminService.isAdmin(userId)) {
    logger.warn({ userId }, 'User blocked by lock mode');
    await ctx.reply('🔒 Бот временно заблокирован администратором. Попробуйте позже.');
    return;
  }

  // Регистрация супер-админа (первый пользователь)
  const isNewSuperAdmin = adminService.registerSuperAdmin(userId);
  if (isNewSuperAdmin) {
    logger.info({ userId }, 'First user registered as super admin');
    ctx.state.isSuperAdmin = true;
  } else {
    ctx.state.isSuperAdmin = adminService.isSuperAdmin(userId);
  }
  
  ctx.state.isAdmin = adminService.isAdmin(userId);
  ctx.state.user = user;
  
  return next();
}

module.exports = { authMiddleware };
