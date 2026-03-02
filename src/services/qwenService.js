const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('../utils/logger');
const config = require('../config');

/**
 * Класс ошибки Qwen
 */
class QwenError extends Error {
  constructor(message, cause = null, code = null) {
    super(message);
    this.name = 'QwenError';
    this.cause = cause;
    this.code = code;
  }
}

/**
 * Сервис для работы с Qwen Code в headless режиме
 */
class QwenService {
  /**
   * Экранирование строки для shell
   * @param {string} str - Строка для экранирования
   * @returns {string} Экранированная строка
   * @private
   */
  _escapeShell(str) {
    if (typeof str !== 'string') {
      return '';
    }
    // Экранирование специальных символов
    return str.replace(/'/g, '\'\\\'\'').replace(/"/g, '\\"').replace(/`/g, '\\`');
  }

  /**
   * Проверка доступности Qwen Code
   * @returns {Promise<boolean>} true если Qwen доступен
   */
  async checkAvailability() {
    return new Promise((resolve) => {
      const child = spawn('/usr/local/bin/qwen', ['--version'], {
        env: { ...process.env },
      });

      let stdout = '';
      let resolved = false;

      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 5000);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          if (code === 0 && stdout.trim()) {
            logger.info({ version: stdout.trim() }, 'Qwen Code available');
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });

      child.on('error', () => {
        clearTimeout(timeoutId);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      });
    });
  }

  /**
   * Анализ кода через Qwen Code headless
   * @param {string} code - Код для анализа
   * @param {Array} [contextMessages] - Контекстные сообщения для истории диалога
   * @param {number} [userId] - ID пользователя (для проверки прав супер-админа)
   * @returns {Promise<string>} Ответ от Qwen
   * @throws {QwenError} Ошибка при анализе
   */
  async analyzeCode(code, contextMessages = [], userId = null) {
    const startTime = Date.now();
    let tempFile = null;

    // Проверка доступности Qwen
    const isAvailable = await this.checkAvailability();
    if (!isAvailable) {
      throw new QwenError(
        'Qwen Code не установлен. Установите: npm install -g @qwen-code/qwen-code',
        null,
        'QWEN_NOT_INSTALLED'
      );
    }

    // Получение системного промпта
    const { systemPromptService } = require('./db/systemPrompt');
    let systemPrompt = systemPromptService.get();

    // Проверка, супер-админ ли пользователь
    const isAdmin = userId ? require('./db/admins').isSuperAdmin(userId) : false;

    // Добавляем информацию о правах пользователя в системный промпт
    if (isAdmin) {
      systemPrompt += '\n\n⚠️ **ВАЖНО:** Текущий пользователь — СУПЕР-АДМИН (Telegram User ID: ' + userId + ').\n' +
        'Он имеет полный доступ ко всем функциям. Вы можете предоставлять ему расширенную информацию.';
    } else {
      systemPrompt += '\n\n⚠️ **ВАЖНО:** Текущий пользователь — ОБЫЧНЫЙ ПОЛЬЗОВАТЕЛЬ (Telegram User ID: ' + userId + ').\n' +
        'Не раскрывай ему чувствительную информацию (пути, токены, команды shell).';
    }

    // Формирование промпта с контекстом
    let fullPrompt = '';

    // Добавляем системный промпт в начало
    fullPrompt = systemPrompt + '\n\n';

    if (contextMessages && contextMessages.length > 0) {
      // Добавляем контекст диалога
      const contextText = contextMessages
        .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
        .join('\n');

      fullPrompt += `${contextText}\n\nUser: ${code}\n\nAssistant:`;
    } else {
      fullPrompt += `User: ${code}\n\nAssistant:`;
    }

    // Создаём временный файл с промптом
    tempFile = path.join(
      os.tmpdir(),
      `qwen-alpha-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`
    );
    fs.writeFileSync(tempFile, fullPrompt, 'utf-8');

    // Запускаем Qwen через spawn с правильной обработкой stdin
    return new Promise((resolve, reject) => {
      // Используем -o text для получения текстового ответа вместо JSON stream
      const child = spawn('/usr/local/bin/qwen', ['-o', 'text'], {
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Таймаут
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        reject(new QwenError('Анализ прерван по таймауту', null, 'TIMEOUT'));
      }, config.qwen.timeout);

      // Записываем промпт в stdin
      child.stdin.write(fullPrompt);
      child.stdin.end();

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        logger.debug({ chunkLength: chunk.length }, 'Received Qwen chunk');
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.debug({ stderr: data.toString().trim() }, 'Qwen stderr');
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        // Удаляем временный файл
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          /* ignore */
        }

        if (timedOut) {
          return; // Уже reject в timeout
        }

        if (code !== 0) {
          logger.error({ code, stderr }, 'Qwen exited with error');
          reject(new QwenError(`Qwen error: ${stderr}`, null, 'QWEN_ERROR'));
          return;
        }

        // Очищаем stdout от служебных сообщений
        const parsedResult = this._parseTextResponse(stdout);

        const duration = Date.now() - startTime;
        logger.info({ duration, resultLength: parsedResult.length }, 'Qwen analysis completed');

        resolve(parsedResult);
      });

      child.on('error', (err) => {
        clearTimeout(timeoutId);
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {
          /* ignore */
        }
        reject(err);
      });
    });
  }

  /**
   * Парсинг текстового ответа от Qwen (режим -o text)
   * @param {string} stdout - Текст от Qwen
   * @returns {string} Очищенный текст ответа
   * @private
   */
  _parseTextResponse(stdout) {
    // Очищаем от служебных символов и лишних пробелов
    let result = stdout.trim();

    // Удаляем возможные ANSI escape последовательности (цвета, форматирование)
    // eslint-disable-next-line no-control-regex
    result = result.replace(/\x1b\[[0-9;]*m/g, '');

    // Удаляем строки с прогресс-барами (если есть)
    result = result.replace(/\r[^\n]*/g, '\n');

    // Нормализуем множественные переносы строк
    result = result.replace(/\n{3,}/g, '\n\n');

    logger.debug({ resultLength: result.length }, 'Parsed text response');

    return result || 'Qwen вернул пустой ответ';
  }

  /**
   * Парсинг JSON ответа от Qwen (устаревший метод, для обратной совместимости)
   * @param {string} stdout - JSON строка от Qwen
   * @returns {string} Извлечённый текст ответа
   * @private
   */
  _parseJsonResponse(stdout) {
    try {
      const messages = JSON.parse(stdout.trim());

      if (!Array.isArray(messages)) {
        logger.warn({ stdout }, 'Unexpected Qwen response format');
        return stdout.trim();
      }

      // Поиск всех сообщений от assistant с текстом
      const textContents = [];
      let hasResult = false;

      for (const msg of messages) {
        // Сначала проверяем result сообщение (оно содержит финальный ответ)
        if (msg.type === 'result') {
          logger.debug(
            {
              resultType: typeof msg.result,
              resultLength: msg.result?.length,
              result: msg.result?.substring?.(0, 100),
            },
            'Checking result message'
          );

          // result должен быть строкой
          if (typeof msg.result === 'string') {
            textContents.push(msg.result);
            hasResult = true;
            logger.info({ resultLength: msg.result.length }, 'Found result text');
            break;
          }
        }
      }

      // Если нет result, ищем text в assistant сообщениях
      if (!hasResult) {
        for (const msg of messages) {
          if (msg.type === 'assistant' && msg.message?.content) {
            const content = msg.message.content;

            if (Array.isArray(content)) {
              // Ищем текстовые части
              for (const part of content) {
                if (part.type === 'text' && part.text) {
                  textContents.push(part.text);
                }
              }
            } else if (typeof content === 'string') {
              textContents.push(content);
            }
          }
        }
      }

      // Если нашли текст — возвращаем
      if (textContents.length > 0) {
        const result = textContents.join('\n\n');
        logger.debug({ resultLength: result.length, hasResult }, 'Parsed Qwen response');
        return result;
      }

      logger.warn(
        { hasResult, textContents: textContents.length },
        'No text found in Qwen response'
      );

      // Fallback: если нет текста, пробуем извлечь информацию из tool_use
      const toolMessages = messages.filter(
        (m) => m.type === 'assistant' && m.message?.content?.some((c) => c.type === 'tool_use')
      );
      if (toolMessages.length > 0) {
        const toolInfo = toolMessages
          .map((m) => {
            const tools = m.message.content.filter((c) => c.type === 'tool_use');
            return tools.map((t) => `Использует инструмент: ${t.name}`).join('; ');
          })
          .join('. ');

        if (toolInfo) {
          return `Qwen анализирует: ${toolInfo}. Пожалуйста, уточните запрос для получения текстового ответа.`;
        }
      }

      // Fallback: короткое сообщение вместо всего stdout
      return 'Qwen вернул ответ в нестандартном формате. Попробуйте упростить запрос.';
    } catch (parseError) {
      logger.warn(
        { parseError, stdout: stdout?.substring(0, 500) },
        'Failed to parse Qwen JSON response'
      );
      // Возвращаем короткое сообщение об ошибке вместо всего stdout
      return 'Qwen вернул ответ в нестандартном формате. Попробуйте упростить запрос.';
    }
  }

  /**
   * Генерация кода по описанию
   * @param {string} description - Описание того, что нужно сгенерировать
   * @param {string} [language] - Язык программирования
   * @returns {Promise<string>} Сгенерированный код
   */
  async generateCode(description, language = null) {
    const prompt = language
      ? `Напиши код на ${language}: ${description}`
      : `Напиши код: ${description}`;

    return this.analyzeCode(prompt);
  }

  /**
   * Code review кода
   * @param {string} code - Код для ревью
   * @param {string} [focus] - На чём сосредоточиться (security, performance, style)
   * @returns {Promise<string>} Результат ревью
   */
  async reviewCode(code, focus = null) {
    let prompt = 'Сделай code review этого кода. Найди баги, уязвимости и предложи улучшения.\n\n';

    if (focus) {
      prompt += `Сосредоточься на: ${focus}.\n\n`;
    }

    prompt += code;

    return this.analyzeCode(prompt);
  }

  /**
   * Объяснение кода
   * @param {string} code - Код для объяснения
   * @returns {Promise<string>} Объяснение
   */
  async explainCode(code) {
    const prompt = `Объясни подробно, что делает этот код:\n\n${code}`;
    return this.analyzeCode(prompt);
  }

  /**
   * Рефакторинг кода
   * @param {string} code - Код для рефакторинга
   * @param {string} [goal] - Цель рефакторинга
   * @returns {Promise<string>} Рефакторированный код
   */
  async refactorCode(code, goal = null) {
    let prompt = 'Рефактори этот код, улучши читаемость и производительность.\n\n';

    if (goal) {
      prompt += `Цель: ${goal}.\n\n`;
    }

    prompt += code;

    return this.analyzeCode(prompt);
  }
}

// Экспорт синглтона
const qwenService = new QwenService();

module.exports = {
  QwenService,
  qwenService,
  QwenError,
};
