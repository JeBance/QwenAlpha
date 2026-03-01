const userService = require('../../services/db/users');
const statsService = require('../../services/db/stats');
const sessionService = require('../../services/db/sessions');
const { logger } = require('../../utils/logger');

/**
 * Обработчик команды /stats
 * Показывает статистику пользователя или чата
 * @param {import('telegraf').Context} ctx
 */
async function statsHandler(ctx) {
  const userId = ctx.state.userId;
  const chatId = ctx.state.chatId;
  const isPrivate = ctx.state.isPrivate;
  
  if (isPrivate) {
    // Личная статистика
    const user = userService.getById(userId);
    const globalStats = statsService.getGlobal();
    const todayStats = statsService.getDaily();
    
    const statsText = `
📊 **Ваша статистика**

**Запросы:**
• Сегодня: ${user?.stats?.total_requests || 0}
• Всего: ${user?.stats?.total_requests || 0}

**Файлы:**
• Проанализировано: ${user?.stats?.total_files || 0}

**Токены:**
• Использовано: ~${user?.stats?.total_tokens?.toLocaleString() || 0}

**Группы:**
• Использовано чатов: ${user?.stats?.groups_used || 0}

---
🌍 **Глобальная статистика:**
• Пользователей: ${globalStats.total_users}
• Активных за 24ч: ${globalStats.active_24h}
• Запросов сегодня: ${globalStats.requests_today}
• Среднее время ответа: ${globalStats.avg_response_time_ms}мс
    `.trim();
    
    await ctx.reply(statsText, { parse_mode: 'Markdown' });
  } else {
    // Статистика чата
    const sessions = sessionService.getChatSessions(chatId);
    const activeSessions = sessions.filter(s => s.status === 'active');
    const totalMessages = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0);
    const participants = new Set(sessions.flatMap(s => s.participants || []));
    
    const chatStatsText = `
📊 **Статистика чата**

**Сессии:**
• Активных: ${activeSessions.length}
• Всего: ${sessions.length}

**Активность:**
• Сообщений в сессиях: ${totalMessages}
• Участников: ${participants.size}

**Сессии:**
${activeSessions.slice(0, 5).map(s => {
      const timeLeft = Math.max(0, Math.floor((new Date(s.expires_at) - new Date()) / 3600000));
      return `• Тема от ${s.root_user_id} (осталось ${timeLeft}ч)`;
    }).join('\n') || 'Нет активных сессий'}
    `.trim();
    
    await ctx.reply(chatStatsText, { parse_mode: 'Markdown' });
  }
}

module.exports = statsHandler;
