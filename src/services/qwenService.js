const { exec } = require('child_process');
const { promisify } = require('util');
const { logger } = require('../utils/logger');
const config = require('../config');

const execAsync = promisify(exec);

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
    try {
      const { stdout } = await execAsync('qwen --version', {
        timeout: 5000,
      });
      logger.info({ version: stdout.trim() }, 'Qwen Code available');
      return true;
    } catch (error) {
      logger.warn({ error: error.message }, 'Qwen Code not available');
      return false;
    }
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
        .map(msg => `${msg.role === 'assistant' ? 'Assistant' : 'User'}: ${msg.content}`)
        .join('\n');
      
      fullPrompt = `${contextText}\n\nUser: ${code}`;
    }
    
    // Команда для Qwen
    const escapedPrompt = this._escapeShell(fullPrompt);
    const command = `echo '${escapedPrompt}' | qwen -p "Проанализируй код и дай рекомендации" -o json`;
    
    logger.debug({ codeLength: code.length, contextLength: contextMessages.length }, 'Running Qwen analysis');
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: config.qwen.timeout,
        maxBuffer: config.qwen.maxBuffer,
        env: { ...process.env },
      });
      
      // Парсинг JSON ответа
      const result = this._parseJsonResponse(stdout);
      
      const duration = Date.now() - startTime;
      logger.info({ duration, resultLength: result.length }, 'Qwen analysis completed');
      
      return result;
      
    } catch (error) {
      logger.error({ error, stderr }, 'Qwen analysis failed');
      
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
      
      throw new QwenError(
        `Ошибка Qwen Code: ${error.message}`,
        error,
        'QWEN_ERROR'
      );
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

      // Поиск последнего сообщения от assistant с текстом
      const assistantMessages = messages.filter(m => m.type === 'assistant' && m.message?.content);
      const lastAssistantMessage = assistantMessages.length > 0 
        ? assistantMessages[assistantMessages.length - 1] 
        : null;

      if (lastAssistantMessage?.message?.content) {
        const content = lastAssistantMessage.message.content;

        // Content может быть строкой или массивом
        if (typeof content === 'string') {
          return content;
        }

        if (Array.isArray(content)) {
          // Поиск текстовой части (может быть thinking + text)
          const textPart = content.find(part => part.type === 'text');
          if (textPart?.text) {
            return textPart.text;
          }
          // Fallback: объединение всех текстовых частей
          return content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('\n');
        }
      }

      // Поиск result сообщения (fallback)
      const resultMessage = messages.find(m => m.type === 'result');
      if (resultMessage?.result) {
        return resultMessage.result;
      }

      // Fallback: возврат всего stdout
      return stdout.trim();

    } catch (parseError) {
      logger.warn({ parseError, stdout }, 'Failed to parse Qwen JSON response');
      return stdout.trim();
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
