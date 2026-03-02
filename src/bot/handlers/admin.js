const adminService = require('../../services/db/admins');
const userService = require('../../services/db/users');
const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');
const { storeManager } = require('../../services/db');
const { logger } = require('../../utils/logger');

/**
 * Обработчик команды /admin
 * Панель администратора
 * @param {import('telegraf').Context} ctx
 */
async function adminHandler(ctx) {
  const userId = ctx.state.userId;
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  const command = args[0]?.toLowerCase();
  
  // Проверка прав администратора
  if (!ctx.state.isAdmin) {
    await ctx.reply('⛔ Доступ запрещён. Требуются права администратора.');
    logger.warn({ userId }, 'Non-admin tried to access /admin');
    return;
  }
  
  // Без подкоманды — показать меню
  if (!command) {
    const admins = adminService.getAllAdmins();
    const globalStats = statsService.getGlobal();
    
    const menuText = `
🛡 **Панель администратора**

**Администраторы:**
• Супер-админ: ${admins.super_admin}
• Обычные админы: ${admins.admins.length}

**Глобальная статистика:**
• Пользователей: ${globalStats.total_users}
• Активных за 24ч: ${globalStats.active_24h}
• Запросов сегодня: ${globalStats.requests_today}
• Ошибок за 24ч: ${globalStats.errors_24h}

---
**Команды:**

**Управление админами:**
/admin add <user_id> — добавить админа
/admin remove <user_id> — удалить админа

**Управление пользователями:**
/admin ban <user_id> — забанить
/admin unban <user_id> — разбанить
/admin lock — заблокировать бота для всех кроме админов
/admin unlock — разблокировать бота

**Сессии:**
/admin sessions list — список сессий
/admin sessions close <session_id> — закрыть
/admin sessions clear <chat_id> — очистить чат

**Настройки:**
/admin set <key> <value> — изменить настройку
/admin settings — показать настройки

**Статистика:**
/admin stats — подробная статистика
/admin broadcast <message> — рассылка всем
    `.trim();
    
    await ctx.reply(menuText, { parse_mode: 'Markdown' });
    return;
  }
  
  // Обработка подкоманд
  switch (command) {
    case 'add': {
      const targetId = parseInt(args[1], 10);
      if (!targetId || isNaN(targetId)) {
        await ctx.reply('❌ Usage: /admin add <user_id>');
        return;
      }
      
      const success = adminService.addAdmin(targetId, userId);
      if (success) {
        await ctx.reply(`✅ Пользователь ${targetId} добавлен в админы.`);
        logger.info({ userId, targetId }, 'Admin added');
      } else {
        await ctx.reply('❌ Не удалось добавить админа.');
      }
      break;
    }
    
    case 'remove': {
      const targetId = parseInt(args[1], 10);
      if (!targetId || isNaN(targetId)) {
        await ctx.reply('❌ Usage: /admin remove <user_id>');
        return;
      }
      
      const success = adminService.removeAdmin(targetId, userId);
      if (success) {
        await ctx.reply(`✅ Пользователь ${targetId} удалён из админов.`);
        logger.info({ userId, targetId }, 'Admin removed');
      } else {
        await ctx.reply('❌ Не удалось удалить админа.');
      }
      break;
    }
    
    case 'ban': {
      const targetId = parseInt(args[1], 10);
      if (!targetId || isNaN(targetId)) {
        await ctx.reply('❌ Usage: /admin ban <user_id>');
        return;
      }
      
      const success = userService.ban(targetId);
      if (success) {
        await ctx.reply(`✅ Пользователь ${targetId} забанен.`);
        logger.info({ userId, targetId }, 'User banned');
      } else {
        await ctx.reply('❌ Пользователь не найден.');
      }
      break;
    }
    
    case 'unban': {
      const targetId = parseInt(args[1], 10);
      if (!targetId || isNaN(targetId)) {
        await ctx.reply('❌ Usage: /admin unban <user_id>');
        return;
      }

      const success = userService.unban(targetId);
      if (success) {
        await ctx.reply(`✅ Пользователь ${targetId} разбанен.`);
        logger.info({ userId, targetId }, 'User unbanned');
      } else {
        await ctx.reply('❌ Пользователь не найден.');
      }
      break;
    }

    case 'lock': {
      // Блокировка всех пользователей кроме админов
      const settings = storeManager.get('settings');
      const data = settings.getData();
      data.locked = true;
      settings.setData(data);
      
      await ctx.reply('🔒 **Бот заблокирован для всех пользователей кроме админов.**\n\nИспользуйте /admin unlock для разблокировки.', { parse_mode: 'Markdown' });
      logger.info({ userId }, 'Bot locked for all users except admins');
      break;
    }

    case 'unlock': {
      // Разблокировка бота
      const settings = storeManager.get('settings');
      const data = settings.getData();
      data.locked = false;
      settings.setData(data);
      
      await ctx.reply('🔓 **Бот разблокирован.**\n\nВсе пользователи могут снова использовать бота.', { parse_mode: 'Markdown' });
      logger.info({ userId }, 'Bot unlocked for all users');
      break;
    }

    case 'sessions': {
      const subCommand = args[2];
      
      if (subCommand === 'list') {
        const allSessions = sessionService._store.getData();
        const sessionCount = Object.keys(allSessions).length;
        await ctx.reply(`📊 Всего сессий: ${sessionCount}`);
      } else if (subCommand === 'clear') {
        const chatId = parseInt(args[3], 10);
        if (!chatId) {
          await ctx.reply('❌ Usage: /admin sessions clear <chat_id>');
          return;
        }
        
        const data = sessionService._store.getData();
        delete data[`chat:${chatId}`];
        sessionService._store.setData(data);
        
        await ctx.reply(`✅ Сессии чата ${chatId} очищены.`);
        logger.info({ userId, chatId }, 'Chat sessions cleared');
      } else {
        await ctx.reply('❌ Usage: /admin sessions list | clear <chat_id>');
      }
      break;
    }
    
    case 'set': {
      const key = args[1];
      const value = args[2];
      
      if (!key || value === undefined) {
        await ctx.reply('❌ Usage: /admin set <key> <value>');
        return;
      }
      
      const settings = storeManager.get('settings');
      const data = settings.getData();
      
      // Преобразование значения
      let parsedValue = value;
      if (!isNaN(Number(value))) {
        parsedValue = Number(value);
      } else if (value.toLowerCase() === 'true') {
        parsedValue = true;
      } else if (value.toLowerCase() === 'false') {
        parsedValue = false;
      }
      
      if (data.hasOwnProperty(key)) {
        data[key] = parsedValue;
        settings.setData(data);
        await ctx.reply(`✅ Настройка '${key}' установлена в '${parsedValue}'.`);
        logger.info({ userId, key, value: parsedValue }, 'Setting updated');
      } else {
        await ctx.reply(`❌ Настройка '${key}' не найдена.`);
      }
      break;
    }
    
    case 'settings': {
      const settings = storeManager.get('settings').getData();
      const settingsText = Object.entries(settings)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join('\n');
      
      await ctx.reply(`⚙️ **Настройки бота:**\n\n${settingsText}`, { parse_mode: 'Markdown' });
      break;
    }
    
    case 'stats': {
      const periodStats = statsService.getPeriod(7);
      const statsText = `
📊 **Статистика за 7 дней:**

**Запросы:** ${periodStats.total_requests}
**Ошибки:** ${periodStats.total_errors}
**Файлы:** ${periodStats.total_files}
**Сессии:** ${periodStats.total_sessions}
      `.trim();
      
      await ctx.reply(statsText, { parse_mode: 'Markdown' });
      break;
    }
    
    default:
      await ctx.reply('❌ Неизвестная команда. Используйте /admin для просмотра меню.');
  }
}

module.exports = adminHandler;
