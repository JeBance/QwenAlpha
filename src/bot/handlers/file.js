const fs = require('fs');
const path = require('path');
const os = require('os');
const sessionService = require('../../services/db/sessions');
const statsService = require('../../services/db/stats');
const userService = require('../../services/db/users');
const { qwenService } = require('../../services/qwenService');
const config = require('../../config');
const { logger } = require('../../utils/logger');

/**
 * Обработчик файлов (документы и фото)
 * @param {import('telegraf').Context} ctx
 */
async function fileHandler(ctx) {
  const userId = ctx.state.userId;
  const chatId = ctx.state.chatId;
  const isPrivate = ctx.state.isPrivate;
  
  // Получение файла из сообщения
  let fileId;
  let fileName = 'unknown';
  let fileSize = 0;
  
  if (ctx.message.document) {
    fileId = ctx.message.document.file_id;
    fileName = ctx.message.document.file_name || 'code.txt';
    fileSize = ctx.message.document.file_size || 0;
  } else if (ctx.message.photo && ctx.message.photo.length > 0) {
    // Берём фото наилучшего качества
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    fileName = 'image.jpg';
    fileSize = photo.file_size || 0;
  } else {
    return;
  }
  
  // Проверка размера файла
  const maxFileSize = config.qwen.maxFileSize;
  if (fileSize > maxFileSize) {
    const maxMB = (maxFileSize / 1024 / 1024).toFixed(2);
    await ctx.reply(
      `❌ Файл слишком большой. Максимальный размер: ${maxMB}MB`,
      { reply_parameters: { message_id: ctx.message.message_id } }
    );
    return;
  }
  
  // Загрузка индикатора
  const loadingMsg = await ctx.reply('⏳ Скачиваю и анализирую файл...');
  
  let tempFilePath = null;
  
  try {
    const startTime = Date.now();
    
    // Скачивание файла
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    
    if (!response.ok) {
      throw new Error('Failed to download file');
    }
    
    // Сохранение во временный файл
    tempFilePath = path.join(os.tmpdir(), `qwen-alpha-${Date.now()}-${fileName}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempFilePath, buffer);
    
    // Чтение содержимого (для текстовых файлов)
    let fileContent;
    try {
      fileContent = fs.readFileSync(tempFilePath, 'utf-8');
    } catch (readError) {
      throw new Error('Не удалось прочитать файл. Поддерживаются только текстовые файлы.');
    }
    
    // Проверка размера содержимого
    if (fileContent.length > maxFileSize) {
      await ctx.editMessageText(
        `❌ Содержимое файла слишком большое. Максимум: ${maxFileSize} символов.`
      );
      return;
    }
    
    // Получение контекста из сессии
    let contextMessages = [];
    const session = ctx.state.session;
    
    if (session) {
      const replyToMessageId = ctx.message?.reply_to_message?.message_id;
      if (replyToMessageId && session.message_tree[replyToMessageId]) {
        contextMessages = sessionService.getMessageChain(session, replyToMessageId);
      }
    }
    
    // Формирование промпта для анализа файла
    const prompt = `Проанализируй этот файл (${fileName}):\n\n${fileContent}`;
    
    // Запрос к Qwen
    const result = await qwenService.analyzeCode(prompt, contextMessages);
    
    const duration = Date.now() - startTime;
    statsService.updateAvgResponseTime(duration);
    
    // Отправка ответа (разбиваем на части если длинный)
    const maxMessageLength = 4096;
    const chunks = splitMessage(result, maxMessageLength);
    
    for (let i = 0; i < chunks.length; i++) {
      if (i === 0 && loadingMsg) {
        await ctx.editMessageText(chunks[i], { parse_mode: 'Markdown' });
      } else {
        await ctx.reply(chunks[i], { parse_mode: 'Markdown' });
      }
    }
    
    // Обновление статистики
    statsService.incrementRequest();
    statsService.incrementFile();
    userService.incrementRequest(userId);
    userService.updateStats(userId, {
      total_files: (userService.getById(userId)?.stats?.total_files || 0) + 1,
    });
    
    logger.info({ userId, chatId, fileName, fileSize, duration }, 'File analyzed');
    
  } catch (error) {
    logger.error({ userId, chatId, fileName, error }, 'File analysis failed');
    
    await ctx.editMessageText(
      `❌ Ошибка при анализе файла: ${error.message}`
    );
    
    statsService.incrementError();
  } finally {
    // Очистка временного файла
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        logger.warn({ tempFilePath }, 'Failed to delete temp file');
      }
    }
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
  let currentChunk = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

module.exports = fileHandler;
