/**
 * Обработчик команды /help
 * Список команд и информация о боте
 * @param {import('telegraf').Context} ctx
 */
async function helpHandler(ctx) {
  const isAdmin = ctx.state.isAdmin;

  const helpText = `
📖 <b>Qwen Alpha — Команды бота</b>

<b>Основные команды:</b>
/start — Запуск бота и приветствие
/help — Эта справка
/instructions — Инструкции по настройке
/reset — Сброс текущей сессии
/stats — Ваша статистика
/settings — Настройки бота

<b>Работа с кодом:</b>
• Отправьте код текстом — я проанализирую его
• Отправьте файл с кодом — я изучу и дам рекомендации
• В группах: /qwen &lt;запрос&gt; или @QwenAlphaRobot &lt;запрос&gt;
• Ответьте на сообщение бота — продолжим диалог

<b>Для групповых чатов:</b>
1. Начните сессию: /qwen Как сделать аутентификацию?
2. Продолжайте ответами на сообщения — я помню контекст
3. Каждая тема — отдельное дерево сообщений

${
  isAdmin
    ? `<b>Админ команды:</b>
/admin — Панель администратора
/setSystemPrompt &lt;промт&gt; — Установить системный промпт
/getSystemPrompt — Просмотр текущего промпта
/resetSystemPrompt — Сброс к промпту по умолчанию
/instructions — Инструкции по настройке

<b>Пример:</b>
/setSystemPrompt Ты — консультант магазина электроники. Отвечай кратко...

`
    : ''
}🔗 <b>Репозиторий:</b> https://github.com/JeBance/QwenAlpha
📝 <b>Документация:</b> https://github.com/JeBance/QwenAlpha#readme

<b>Технологии:</b>

• Qwen Code (headless режим)
• Telegraf (Node.js)
• JSON хранилище (~/.qwen-alpha/)
  `.trim();

  await ctx.reply(helpText, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

module.exports = helpHandler;
