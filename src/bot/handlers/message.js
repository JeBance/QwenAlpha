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
  const isBotMention = text.includes('@QwenAlphaRobot') || text.includes(`@${ctx.botInfo?.username}`);
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
      // Если это reply на сообщение в сессии
      const replyToMessageId = ctx.message?.reply_to_message?.message_id;

      if (replyToMessageId && session.message_tree[replyToMessageId]) {
        // Получаем цепочку сообщений
        contextMessages = sessionService.getMessageChain(session, replyToMessageId);
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

    // В группах добавляем упоминание если это первый ответ
    if (!isPrivate && ctx.message?.reply_to_message) {
      const originalUser = ctx.message.reply_to_message.from;
      if (originalUser?.username) {
        responseText = `@${originalUser.username} ${responseText}`;
      }
    }

    // Отправка ответа
    if (loadingMsgId) {
      // Удаляем сообщение "⏳ Думаю..." и отправляем новый ответ
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsgId);
    }
    
    await ctx.reply(responseText, {
      parse_mode: 'Markdown',
      reply_parameters: { message_id: ctx.message.message_id },
    });
    
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
      
      // Добавляем ответ бота (будет добавлен после отправки)
      // sessionService.addMessage({...})
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

module.exports = messageHandler;
