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
    return str.replace(/'/g, "'\\''").replace(/"/g, '\\"').replace(/`/g, '\\`');
  }

  /**
   * Проверка доступности Qwen Code
   * @returns {Promise<boolean>} true если Qwen доступен
   */
  async checkAvailability() {
    return new Promise((resolve) => {
      const child = spawn('qwen', ['--version'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          logger.info({ version: stdout.trim() }, 'Qwen Code available');
          resolve(true);
        } else {
          resolve(false);
        }
      });

      child.on('error', () => {
        resolve(false);
      });

      setTimeout(() => {
        child.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Анализ кода через Qwen Code headless
   * @param {string} code - Код для анализа
   * @param {Array} [contextMessages] - Контекстные сообщения для истории диалога
   * @returns {Promise<string>} Ответ от Qwen
   * @throws {QwenError} Ошибка при анализе
   */
  async analyzeCode(code, contextMessages = []) {
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

    // Формирование промпта с контекстом
    let fullPrompt = code;

    if (contextMessages && contextMessages.length > 0) {
      // Добавляем контекст диалога
      const contextText = contextMessages
        .map((msg) => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
        .join('\n');

      // Явно указываем что это продолжение диалога
      fullPrompt = `Продолжи диалог. Контекст:\n${contextText}\n\nUser: ${code}`;
    }

    // Создаём временный файл с промптом
    tempFile = path.join(
      os.tmpdir(),
      `qwen-alpha-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.txt`
    );
    fs.writeFileSync(tempFile, fullPrompt, 'utf-8');

    // Запускаем Qwen через spawn с передачей stdin из файла
    const args = ['-o', 'json'];
    if (contextMessages.length === 0) {
      args.splice(1, 0, '-p', 'Проанализируй код и дай рекомендации');
    }

    logger.debug(
      { codeLength: code.length, contextLength: contextMessages.length, tempFile },
      'Running Qwen analysis'
    );

    try {
      const result = await new Promise((resolve, reject) => {
        const child = spawn('qwen', args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';

        // Читаем файл и передаём в stdin
        const fileStream = fs.createReadStream(tempFile);
        fileStream.pipe(child.stdin);

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
          logger.debug({ stderr: data.toString().trim() }, 'Qwen stderr');
        });

        child.on('close', (code) => {
          // Удаляем временный файл
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            /* ignore */
          }

          if (code !== 0) {
            reject(new Error(`Qwen exited with code ${code}: ${stderr}`));
          } else {
            resolve(stdout);
          }
        });

        child.on('error', (err) => {
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            /* ignore */
          }
          reject(err);
        });

        // Таймаут
        const timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          try {
            fs.unlinkSync(tempFile);
          } catch (e) {
            /* ignore */
          }
          reject(new Error('Qwen timeout'));
        }, config.qwen.timeout);

        child.on('close', () => clearTimeout(timeoutId));
      });

      const stdout = result;

      // Парсинг JSON ответа
      const parsedResult = this._parseJsonResponse(stdout);

      const duration = Date.now() - startTime;
      logger.info({ duration, resultLength: parsedResult.length }, 'Qwen analysis completed');

      return parsedResult;
    } catch (error) {
      // Удаляем временный файл при ошибке
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {
        /* ignore */
      }

      logger.error({ error }, 'Qwen analysis failed');

      // Обработка различных типов ошибок
      if (error.killed && error.signal === 'SIGTERM') {
        throw new QwenError(
          'Анализ прерван по таймауту. Попробуйте с меньшим файлом.',
          error,
          'TIMEOUT'
        );
      }

      if (error.message.includes('maxBuffer')) {
        throw new QwenError(
          'Ответ слишком большой. Попробуйте меньший фрагмент кода.',
          error,
          'BUFFER_EXCEEDED'
        );
      }

      throw new QwenError(`Ошибка Qwen Code: ${error.message}`, error, 'QWEN_ERROR');
    }
  }

  /**
   * Парсинг JSON ответа от Qwen
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
