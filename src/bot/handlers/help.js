/**
 * Обработчик команды /help
 * Список команд и информация о боте
 * @param {import('telegraf').Context} ctx
 */
async function helpHandler(ctx) {
  const isAdmin = ctx.state.isAdmin;
  
  const helpText = `
📖 **Qwen Alpha — Команды бота**

**Основные команды:**
/start — Запуск бота и приветствие
/help — Эта справка
/reset — Сброс текущей сессии
/stats — Ваша статистика
/settings — Настройки бота

**Работа с кодом:**
• Отправьте код текстом — я проанализирую его
• Отправьте файл с кодом — я изучу и дам рекомендации
• В группах: /qwen <запрос> или @QwenAlphaRobot <запрос>
• Ответьте на сообщение бота — продолжим диалог

**Для групповых чатов:**
1. Начните сессию: /qwen Как сделать аутентификацию?
2. Продолжайте ответами на сообщения — я помню контекст
3. Каждая тема — отдельное дерево сообщений

${isAdmin ? '**Админ команды:**\n/admin — Панель администратора\n\n' : ''}
🔗 **Репозиторий:** https://github.com/JeBance/QwenAlpha
📝 **Документация:** https://github.com/JeBance/QwenAlpha#readme

**Технологии:**
• Qwen Code (headless режим)
• Telegraf (Node.js)
• JSON хранилище (~/.qwen-alpha/)
  `.trim();
  
  await ctx.reply(helpText, { parse_mode: 'Markdown' });
}

module.exports = helpHandler;
