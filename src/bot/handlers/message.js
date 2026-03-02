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
      // Конвертируем Markdown в HTML для Telegram
      const htmlText = markdownToHtml(chunks[i]);

      await ctx.reply(htmlText, {
        parse_mode: 'HTML',
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
 * Разбиение длинного сообщения на части с учётом HTML-тегов
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

    // Проверяем, не попали ли мы внутрь HTML-тега
    // Если да — отодвигаем splitIndex до начала тега
    const beforeSplit = remaining.substring(0, splitIndex);
    const openTags = findUnclosedTags(beforeSplit);
    
    // Если есть незакрытые теги внутри блока кода — ищем конец блока
    if (openTags.includes('pre') || openTags.includes('code')) {
      // Ищем ближайший закрывающий тег </pre> или </code> после splitIndex
      const nextClosePre = remaining.indexOf('</pre>', splitIndex);
      const nextCloseCode = remaining.indexOf('</code>', splitIndex);
      const nextClose = Math.min(
        nextClosePre === -1 ? Infinity : nextClosePre,
        nextCloseCode === -1 ? Infinity : nextCloseCode
      );
      
      if (nextClose !== Infinity && nextClose < remaining.length) {
        // Разбиваем ПОСЛЕ закрывающего тега
        splitIndex = nextClose + (remaining[nextClose + 6] === '>' ? 7 : 6);
      }
    }

    let chunk = remaining.substring(0, splitIndex);
    
    // Закрываем незакрытые теги в конце чанка
    const unclosedTags = findUnclosedTags(chunk);
    if (unclosedTags.length > 0) {
      // Закрываем теги в обратном порядке
      for (let i = unclosedTags.length - 1; i >= 0; i--) {
        chunk += `</${unclosedTags[i]}>`;
      }
    }
    
    chunks.push(chunk);
    
    // Открываем теги в начале оставшейся части
    if (unclosedTags.length > 0) {
      let prefix = '';
      for (const tag of unclosedTags) {
        prefix += `<${tag}>`;
      }
      remaining = prefix + remaining.substring(splitIndex).trim();
    } else {
      remaining = remaining.substring(splitIndex).trim();
    }
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Поиск незакрытых HTML-тегов в строке
 * @param {string} html - HTML строка
 * @returns {string[]} Массив имен тегов
 */
function findUnclosedTags(html) {
  const tagStack = [];
  const tagRegex = /<(\/?)(b|i|u|s|code|pre|a|span)(?:\s[^>]*)?>/g;
  let match;
  
  while ((match = tagRegex.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];
    
    // Пропускаем самозакрывающиеся теги и теги с href (a)
    if (tagName === 'a') {
      if (!isClosing) {
        tagStack.push(tagName);
      } else {
        tagStack.pop();
      }
      continue;
    }
    
    if (!isClosing) {
      tagStack.push(tagName);
    } else {
      // Закрывающий тег — убираем последний открытый такой же
      const lastIndex = tagStack.lastIndexOf(tagName);
      if (lastIndex !== -1) {
        tagStack.splice(lastIndex, 1);
      }
    }
  }
  
  return tagStack;
}

/**
 * Конвертация Markdown в HTML для Telegram
 * @param {string} text - Markdown текст
 * @returns {string} HTML текст
 */
function markdownToHtml(text) {
  let html = text;

  // Заголовки обрабатываем ПЕРВЫМИ (до экранирования)
  // ### Заголовок → <b>📌 Заголовок</b>\n
  html = html.replace(/^###\s+(.+)$/gm, '<b>📌 $1</b>');
  html = html.replace(/^##\s+(.+)$/gm, '<b>🔹 $1</b>');
  html = html.replace(/^#\s+(.+)$/gm, '<b>🔸 $1</b>');

  // Блоки кода ```code``` → <pre><code>code</code></pre> (до экранирования)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    // Экранируем код внутри блока
    const escapedCode = code
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code class="language-${lang || 'text'}">${escapedCode}</code></pre>`;
  });

  // Inline код `code` → <code>code</code> (до экранирования)
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<code>${escapedCode}</code>`;
  });

  // Теперь экранируем ВСЁ, кроме уже созданных HTML-тегов
  // Временная замена тегов
  const tempTags = [];
  let tagIndex = 0;
  
  // Сохраняем теги
  html = html.replace(/<(\/?)(b|i|u|s|code|pre|a|span)[^>]*>/g, (match) => {
    tempTags.push(match);
    return `%%TAG${tagIndex++}%%`;
  });

  // Экранируем спецсимволы
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Восстанавливаем теги
  tempTags.forEach((tag, index) => {
    html = html.replace(`%%TAG${index}%%`, tag);
  });

  // Жирный **text** → <b>text</b>
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

  // Курсив *text* → <i>text</i>
  html = html.replace(/\*([^*]+)\*/g, '<i>$1</i>');

  // Ссылки [text](url) → <a href="url">text</a>
  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

module.exports = messageHandler;
