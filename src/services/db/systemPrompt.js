const { storeManager } = require('./index');
const { logger } = require('../../utils/logger');
const { DEFAULT_SYSTEM_PROMPT } = require('../../config/security');

/**
 * Сервис для управления системным промптом
 */
class SystemPromptService {
  /**
   * Получение хранилища настроек
   * @private
   */
  get _store() {
    return storeManager.get('settings');
  }

  /**
   * Получение текущего системного промпта
   * @returns {string} Системный промпт
   */
  get() {
    const data = this._store.getData();
    return data.system_prompt || DEFAULT_SYSTEM_PROMPT;
  }

  /**
   * Установка системного промпта
   * @param {string} prompt - Новый системный промпт
   * @returns {boolean} Успешность
   */
  set(prompt) {
    try {
      const data = this._store.getData();
      data.system_prompt = prompt;
      this._store.setData(data);
      logger.info({ promptLength: prompt.length }, 'System prompt updated');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to set system prompt');
      return false;
    }
  }

  /**
   * Сброс промпта к значению по умолчанию
   * @returns {boolean} Успешность
   */
  reset() {
    try {
      const data = this._store.getData();
      delete data.system_prompt;
      this._store.setData(data);
      logger.info('System prompt reset to default');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to reset system prompt');
      return false;
    }
  }

  /**
   * Проверка, установлен ли кастомный промпт
   * @returns {boolean} true если промпт отличается от дефолтного
   */
  isCustom() {
    const data = this._store.getData();
    return !!data.system_prompt;
  }
}

const systemPromptService = new SystemPromptService();

module.exports = {
  systemPromptService,
};
