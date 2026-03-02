const { systemPromptService } = require('../../services/db/systemPrompt');
const { DEFAULT_SYSTEM_PROMPT } = require('../../config/security');

/**
 * Обработчик команды /setSystemPrompt
 * Установка системного промпта (только для супер-админа)
 * @param {import('telegraf').Context} ctx
 */
async function setSystemPromptHandler(ctx) {
  const userId = ctx.from.id;

  // Проверка на супер-админа
  if (!ctx.state.isSuperAdmin) {
    await ctx.reply(
      '⛔ **Доступ запрещён**\n\n' + 'Только супер-администратор может изменять системный промпт.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Получение промпта из команды
  const prompt = ctx.message?.text?.replace('/setSystemPrompt', '').trim();

  if (!prompt) {
    await ctx.reply(
      '⚙️ **Установка системного промпта**\n\n' +
        'Использование:\n' +
        '`/setSystemPrompt <ваш промпт>`\n\n' +
        'Пример:\n' +
        '`/setSystemPrompt Ты — консультант магазина электроники...`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Установка промпта
  const success = systemPromptService.set(prompt);

  if (success) {
    await ctx.reply(
      '✅ **Системный промпт обновлён**\n\n' +
        `📝 Длина: ${prompt.length} символов\n\n` +
        'Бот будет использовать новый промпт для всех будущих запросов.\n' +
        'Промпт сохраняется после перезапуска бота.',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      '❌ **Ошибка**\n\n' + 'Не удалось сохранить системный промпт.\n' + 'Проверьте логи бота.',
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Обработчик команды /getSystemPrompt
 * Просмотр текущего системного промпта (только для супер-админа)
 * @param {import('telegraf').Context} ctx
 */
async function getSystemPromptHandler(ctx) {
  // Проверка на супер-админа
  if (!ctx.state.isSuperAdmin) {
    await ctx.reply(
      '⛔ **Доступ запрещён**\n\n' +
        'Только супер-администратор может просматривать системный промпт.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const currentPrompt = systemPromptService.get();
  const isCustom = systemPromptService.isCustom();

  // Если промпт длинный, разбиваем на части
  const maxLength = 4000;
  const header = isCustom
    ? '⚙️ **Текущий системный промпт** (кастомный)\n\n'
    : '⚙️ **Текущий системный промпт** (по умолчанию)\n\n';

  if (header.length + currentPrompt.length <= maxLength) {
    await ctx.reply(header + currentPrompt, {
      parse_mode: 'Markdown',
    });
  } else {
    // Отправляем частями
    await ctx.reply(
      header +
        'Промпт слишком длинный для отображения.\n\n' +
        'Длина: ' +
        currentPrompt.length +
        ' символов.',
      {
        parse_mode: 'Markdown',
      }
    );
  }

  // Если есть кастомный промпт, показываем кнопку сброса
  if (isCustom) {
    await ctx.reply(
      'ℹ️ Для сброса к промпту по умолчанию используйте:\n' + '`/resetSystemPrompt`',
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Обработчик команды /resetSystemPrompt
 * Сброс промпта к значению по умолчанию (только для супер-админа)
 * @param {import('telegraf').Context} ctx
 */
async function resetSystemPromptHandler(ctx) {
  // Проверка на супер-админа
  if (!ctx.state.isSuperAdmin) {
    await ctx.reply('⛔ **Доступ запрещён**', { parse_mode: 'Markdown' });
    return;
  }

  const success = systemPromptService.reset();

  if (success) {
    await ctx.reply('✅ **Системный промпт сброшен**\n\n' + 'Бот использует промпт по умолчанию.', {
      parse_mode: 'Markdown',
    });
  }
}

module.exports = {
  setSystemPromptHandler,
  getSystemPromptHandler,
  resetSystemPromptHandler,
};
