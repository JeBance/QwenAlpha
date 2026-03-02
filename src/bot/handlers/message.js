const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');
const userService = require('../../services/db/users');
const { qwenService } = require('../../services/qwenService');
const { logger } = require('../../utils/logger');

/**
 * Обработчик текстовых сообщений
 * @param {import('telegraf').Context} ctx
 */
async function messageHandler(ctx) {
  const userId = ctx.state.userId;
  const chatId = ctx.state.chatId;
  const isPrivate = ctx.state.isPrivate;
  const text = ctx.message?.text;

  if (!text) {
    return;
  }

  // Проверка на команду /qwen в группах
  const isQwenCommand = text.startsWith('/qwen') || text.startsWith('/qwen@');
  const isBotMention =
    text.includes('@QwenAlphaRobot') || text.includes(`@${ctx.botInfo?.username}`);
  const isReplyToBot = ctx.message?.reply_to_message?.from?.is_bot;

  // В личных чатах обрабатываем все сообщения
  // В группах только /qwen, упоминания бота, или reply на бота
  if (!isPrivate && !isQwenCommand && !isBotMention && !isReplyToBot) {
    return;
  }

  // Очистка команды из текста
  let prompt = text;
  if (isQwenCommand) {
    prompt = text.replace(/^\/qwen(@\w+)?\s*/, '').trim();
  }

  // Если пусто после очистки команды
  if (!prompt && isQwenCommand) {
    await ctx.reply('❌ Пожалуйста, укажите запрос после /qwen');
    return;
  }

  // Загрузка индикатора
  let loadingMsgId = null;
  if (isPrivate) {
    const loadingMsg = await ctx.reply('⏳ Думаю...');
    loadingMsgId = loadingMsg?.message_id;
  }

  try {
    const startTime = Date.now();

    // Получение контекста из сессии
    let contextMessages = [];
    let session = ctx.state.session;

    if (session) {
      // Если это reply на сообщение в сессии — получаем полную цепочку
      const replyToMessageId = ctx.message?.reply_to_message?.message_id;

      if (replyToMessageId && session.message_tree[replyToMessageId]) {
        contextMessages = sessionService.getMessageChain(session, replyToMessageId);
      } else {
        // Если не reply, берём последние N сообщений из сессии
        const allMessages = Object.values(session.message_tree)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .slice(-10); // Последние 10 сообщений

        contextMessages = allMessages.map((msg) => ({
          role: msg.user_id === 'bot' ? 'assistant' : 'user',
          content: msg.text || '',
        }));
      }
    }

    // Запрос к Qwen
    const result = await qwenService.analyzeCode(prompt, contextMessages);

    const duration = Date.now() - startTime;
    statsService.updateAvgResponseTime(duration);

    // Проверка на пустой ответ
    if (!result || result.trim().length === 0) {
      if (loadingMsgId) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId);
      }
      await ctx.reply('❌ Qwen вернул пустой ответ. Попробуйте другой запрос.', {
        reply_parameters: { message_id: ctx.message.message_id },
      });
      return;
    }

    // Форматирование ответа
    let responseText = result;

    // В группах добавляем упоминание только если отвечаем на сообщение пользователя (не бота)
    if (!isPrivate && ctx.message?.reply_to_message && !ctx.message.reply_to_message.from.is_bot) {
      const originalUser = ctx.message.reply_to_message.from;
      if (originalUser?.username) {
        responseText = `@${originalUser.username} ${responseText}`;
      }
    }

    // Отправка ответа
    if (loadingMsgId) {
      // Удаляем сообщение "⏳ Думаю..."
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId).catch(() => {});
    }

    // Разбивка длинного ответа на части (Telegram лимит 4096 символов)
    const maxMessageLength = 4000;
    const chunks = splitMessage(responseText, maxMessageLength);

    for (let i = 0; i < chunks.length; i++) {
      // Определяем тип форматирования
      const parseMode = determineParseMode(chunks[i]);

      await ctx.reply(chunks[i], {
        parse_mode: parseMode,
        reply_parameters: { message_id: ctx.message.message_id },
      });
    }

    // Добавление сообщений в сессию
    if (session) {
      // Добавляем сообщение пользователя
      sessionService.addMessage({
        sessionId: session.session_id,
        chatId,
        messageId: ctx.message.message_id,
        userId,
        text: prompt,
        type: 'user_question',
      });

      // Добавляем ответ бота
      const botMessageId = ctx.message.message_id + 1; // Приблизительно
      sessionService.addMessage({
        sessionId: session.session_id,
        chatId,
        messageId: botMessageId,
        userId: 'bot',
        text: responseText,
        type: 'bot_response',
        parent_id: ctx.message.message_id,
      });
    }

    // Обновление статистики
    statsService.incrementRequest();
    userService.incrementRequest(userId);

    logger.info({ userId, chatId, duration, isPrivate }, 'Message processed');
  } catch (error) {
    logger.error({ userId, chatId, error }, 'Message processing failed');

    // Удаляем сообщение "⏳ Думаю..." если есть
    if (loadingMsgId) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId).catch(() => {});
    }

    await ctx.reply('❌ Ошибка при обработке запроса. Попробуйте позже.', {
      reply_parameters: { message_id: ctx.message.message_id },
    });

    statsService.incrementError();
  }
}

/**
 * Разбиение длинного сообщения на части
 * @param {string} text - Текст для разбиения
 * @param {number} maxLength - Максимальная длина
 * @returns {string[]} Массив частей
 */
function splitMessage(text, maxLength) {
  const chunks = [];

  if (text.length <= maxLength) {
    return [text];
  }

  let remaining = text;

  while (remaining.length > maxLength) {
    // Ищем ближайший перенос строки или пробел
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Определение режима парсинга для сообщения
 * @param {string} text - Текст сообщения
 * @returns {'Markdown' | undefined} Режим парсинга
 */
function determineParseMode(text) {
  // Проверяем наличие Markdown-элементов
  const hasMarkdownElements =
    /(^|\s)#[^\s#]/.test(text) || // Заголовки #
    /\*\*[^*]+\*\*/.test(text) || // Жирный **text**
    /\*[^*]+\*/.test(text) || // Курсив *text*
    /`[^`]+`/.test(text) || // Код `code`
    /```[\s\S]*```/.test(text) || // Блок кода ```code```
    /^\s*[-*+]\s/.test(text) || // Списки
    /^\s*\d+\.\s/.test(text) || // Нумерованные списки
    /\[([^\]]+)]/.test(text); // Ссылки [text]

  return hasMarkdownElements ? 'Markdown' : undefined;
}

module.exports = messageHandler;
