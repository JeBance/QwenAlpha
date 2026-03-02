const userService = require('../../services/db/users');
const { storeManager } = require('../../services/db');

/**
 * Обработчик команды /settings
 * Показывает и позволяет изменить настройки
 * @param {import('telegraf').Context} ctx
 */
async function settingsHandler(ctx) {
  const userId = ctx.state.userId;
  const user = userService.getById(userId);
  const globalSettings = storeManager.get('settings').getData();

  const settingsText = `
⚙️ **Ваши настройки**

**Модель:** ${user?.settings?.model || 'qwen3-coder-plus'}
**Язык:** ${user?.settings?.language === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
**Уведомления:** ${user?.settings?.notifications ? '✅ Вкл' : '❌ Выкл'}
**Лимит запросов/час:** ${user?.settings?.requests_per_hour || 60}

---
🌍 **Глобальные настройки бота:**
**Таймаут сессии:** ${globalSettings.session_timeout_hours}ч
**Макс. размер файла:** ${globalSettings.max_file_size_mb}MB
**Режим в группах:** ${globalSettings.group_mode}

---
**Изменение настроек:**
/settings model <название> — сменить модель
/settings language <ru|en> — сменить язык
/settings notifications <on|off> — уведомления
  `.trim();

  await ctx.reply(settingsText, { parse_mode: 'Markdown' });
}

module.exports = settingsHandler;
