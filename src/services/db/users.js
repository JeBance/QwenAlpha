const { storeManager } = require('./index');
const { logger } = require('../../utils/logger');

/**
 * Сервис для управления пользователями
 */
class UserService {
  /**
   * Получение хранилища пользователей
   * @private
   */
  get _store() {
    return storeManager.get('users');
  }

  /**
   * Получение пользователя по ID
   * @param {number} userId - Telegram user ID
   * @returns {Object|null} Данные пользователя или null
   */
  getById(userId) {
    const data = this._store.getData();
    return data[userId] || null;
  }

  /**
   * Создание или обновление пользователя
   * @param {Object} userData - Данные пользователя
   * @param {number} userData.id - Telegram user ID
   * @param {string} [userData.username] - Username
   * @param {string} [userData.first_name] - First name
   * @param {string} [userData.last_name] - Last name
   * @returns {Object} Данные пользователя
   */
  upsert(userData) {
    const data = this._store.getData();
    const now = new Date().toISOString();

    const existingUser = data[userData.id];

    data[userData.id] = {
      id: userData.id,
      username: userData.username || null,
      first_name: userData.first_name || null,
      last_name: userData.last_name || null,
      created_at: existingUser?.created_at || now,
      last_seen: now,
      settings: {
        model: 'qwen3-coder-plus',
        language: 'ru',
        notifications: true,
        requests_per_hour: 60,
        ...existingUser?.settings,
      },
      stats: {
        total_requests: existingUser?.stats?.total_requests || 0,
        total_files: existingUser?.stats?.total_files || 0,
        total_tokens: existingUser?.stats?.total_tokens || 0,
        groups_used: existingUser?.stats?.groups_used || 0,
      },
      rate_limits: {
        requests_today: existingUser?.rate_limits?.requests_today || 0,
        last_request: existingUser?.rate_limits?.last_request || null,
      },
      is_banned: existingUser?.is_banned || false,
    };

    this._store.setData(data);
    logger.debug({ userId: userData.id }, 'User upserted');

    return data[userData.id];
  }

  /**
   * Обновление настроек пользователя
   * @param {number} userId - Telegram user ID
   * @param {Object} settings - Новые настройки
   * @returns {Object} Обновлённые данные пользователя
   */
  updateSettings(userId, settings) {
    const data = this._store.getData();

    if (!data[userId]) {
      throw new Error(`User ${userId} not found`);
    }

    data[userId].settings = {
      ...data[userId].settings,
      ...settings,
    };

    this._store.setData(data);
    logger.debug({ userId, settings }, 'User settings updated');

    return data[userId];
  }

  /**
   * Бан пользователя
   * @param {number} userId - Telegram user ID
   * @returns {boolean} Успешность операции
   */
  ban(userId) {
    const data = this._store.getData();

    if (!data[userId]) {
      return false;
    }

    data[userId].is_banned = true;
    this._store.setData(data);
    logger.warn({ userId }, 'User banned');

    return true;
  }

  /**
   * Разбан пользователя
   * @param {number} userId - Telegram user ID
   * @returns {boolean} Успешность операции
   */
  unban(userId) {
    const data = this._store.getData();

    if (!data[userId]) {
      return false;
    }

    data[userId].is_banned = false;
    this._store.setData(data);
    logger.info({ userId }, 'User unbanned');

    return true;
  }

  /**
   * Обновление статистики пользователя
   * @param {number} userId - Telegram user ID
   * @param {Object} updates - Обновления статистики
   * @returns {Object} Обновлённые данные пользователя
   */
  updateStats(userId, updates) {
    const data = this._store.getData();

    if (!data[userId]) {
      throw new Error(`User ${userId} not found`);
    }

    data[userId].stats = {
      ...data[userId].stats,
      ...updates,
    };

    this._store.setData(data);
    return data[userId];
  }

  /**
   * Increment запроса пользователя
   * @param {number} userId - Telegram user ID
   */
  incrementRequest(userId) {
    const data = this._store.getData();
    const today = new Date().toISOString().split('T')[0];

    if (!data[userId]) {
      return;
    }

    // Сброс счётчика если новый день
    const lastRequest = data[userId].rate_limits?.last_request;
    if (lastRequest && lastRequest.split('T')[0] !== today) {
      data[userId].rate_limits.requests_today = 0;
    }

    data[userId].rate_limits = {
      requests_today: (data[userId].rate_limits?.requests_today || 0) + 1,
      last_request: new Date().toISOString(),
    };

    data[userId].stats.total_requests = (data[userId].stats?.total_requests || 0) + 1;

    this._store.setData(data);
  }

  /**
   * Получение всех пользователей
   * @returns {Array} Массив пользователей
   */
  getAll() {
    const data = this._store.getData();
    return Object.values(data);
  }

  /**
   * Удаление пользователя
   * @param {number} userId - Telegram user ID
   * @returns {boolean} Успешность операции
   */
  delete(userId) {
    const data = this._store.getData();

    if (!data[userId]) {
      return false;
    }

    delete data[userId];
    this._store.setData(data);
    logger.info({ userId }, 'User deleted');

    return true;
  }
}

module.exports = new UserService();
