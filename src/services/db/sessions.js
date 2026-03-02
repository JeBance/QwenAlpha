const { storeManager } = require('./index');
const { logger } = require('../../utils/logger');

/**
 * Сервис для управления сессиями
 * Поддерживает древовидную структуру для групповых чатов
 */
class SessionService {
  /**
   * Получение хранилища сессий
   * @private
   */
  get _store() {
    return storeManager.get('sessions');
  }

  /**
   * Генерация ключа сессии
   * @param {number} userId - Telegram user ID
   * @param {number} chatId - Telegram chat ID
   * @returns {string} Ключ сессии
   * @private
   */
  _getSessionKey(userId, chatId) {
    // Личный чат: user:{userId}
    // Групповой чат: chat:{chatId}:session:{sessionId}
    if (userId === chatId || chatId > 0) {
      return `user:${userId}`;
    }
    return `chat:${chatId}`;
  }

  /**
   * Создание новой сессии
   * @param {Object} options - Опции сессии
   * @param {number} options.userId - Telegram user ID
   * @param {number} options.chatId - Telegram chat ID
   * @param {number} options.rootMessageId - ID корневого сообщения
   * @param {string} [options.chatType] - Тип чата (private, group, supergroup)
   * @param {string} [options.chatTitle] - Название чата (для групп)
   * @returns {Object} Данные сессии
   */
  create({ userId, chatId, rootMessageId, chatType = 'private', chatTitle = null }) {
    const data = this._store.getData();
    const now = new Date();
    const timeoutHours = storeManager.get('settings').getData().session_timeout_hours || 24;
    const expiresAt = new Date(now.getTime() + timeoutHours * 60 * 60 * 1000);

    const sessionKey = this._getSessionKey(userId, chatId);
    const sessionId = `${sessionKey}:session:${now.getTime()}`;

    const session = {
      session_id: sessionId,
      chat_id: chatId,
      root_message_id: rootMessageId,
      root_user_id: userId,
      chat_type: chatType,
      chat_title: chatTitle,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      status: 'active',
      message_tree: {
        [rootMessageId]: {
          message_id: rootMessageId,
          user_id: userId,
          text: '',
          type: 'root',
          children: [],
        },
      },
      context: {
        summary: '',
        keywords: [],
        last_summary_at: null,
      },
      participants: [userId],
      message_count: 1,
    };

    // Для групповых чатов - массив сессий
    if (chatType !== 'private') {
      if (!data[sessionKey]) {
        data[sessionKey] = [];
      }
      data[sessionKey].push(session);
    } else {
      data[sessionKey] = session;
    }

    this._store.setData(data);
    logger.info({ sessionId, userId, chatId }, 'Session created');

    return session;
  }

  /**
   * Получение сессии по ключу
   * @param {string} sessionKey - Ключ сессии
   * @returns {Object|null} Сессия или null
   */
  getByKey(sessionKey) {
    const data = this._store.getData();
    return data[sessionKey] || null;
  }

  /**
   * Поиск сессии по ID сообщения (для reply в группах)
   * @param {number} chatId - Telegram chat ID
   * @param {number} messageId - ID сообщения
   * @returns {Object|null} Сессия или null
   */
  findByMessage(chatId, messageId) {
    const data = this._store.getData();
    const chatKey = `chat:${chatId}`;

    const sessions = data[chatKey];
    if (!Array.isArray(sessions)) {
      return null;
    }

    for (const session of sessions) {
      if (session.message_tree && session.message_tree[messageId]) {
        return session;
      }
    }

    return null;
  }

  /**
   * Добавление сообщения в дерево сессии
   * @param {Object} options - Опции
   * @param {string} options.sessionId - ID сессии
   * @param {number} options.chatId - Telegram chat ID
   * @param {number} options.messageId - ID сообщения
   * @param {number|string} options.userId - Telegram user ID (или 'bot')
   * @param {string} options.text - Текст сообщения
   * @param {number} [options.parentId] - ID родительского сообщения
   * @param {string} [options.type] - Тип сообщения
   * @returns {Object|null} Обновлённая сессия или null
   */
  addMessage({
    sessionId,
    chatId,
    messageId,
    userId,
    text,
    parentId = null,
    type = 'user_message',
  }) {
    const data = this._store.getData();
    const chatKey = `chat:${chatId}`;

    let session;
    let sessionIndex = -1;

    // Поиск сессии
    if (Array.isArray(data[chatKey])) {
      sessionIndex = data[chatKey].findIndex((s) => s.session_id === sessionId);
      if (sessionIndex === -1) {
        logger.warn({ sessionId, chatId }, 'Session not found');
        return null;
      }
      session = data[chatKey][sessionIndex];
    } else {
      session = data[chatKey];
    }

    if (!session || session.status !== 'active') {
      return null;
    }

    // Добавление сообщения в дерево
    session.message_tree[messageId] = {
      message_id: messageId,
      user_id: userId,
      text,
      type,
      parent_id: parentId,
      children: [],
      created_at: new Date().toISOString(),
    };

    // Обновление родительского узла
    if (parentId && session.message_tree[parentId]) {
      if (!session.message_tree[parentId].children) {
        session.message_tree[parentId].children = [];
      }
      session.message_tree[parentId].children.push(messageId);
    }

    // Обновление участников
    if (typeof userId === 'number' && !session.participants.includes(userId)) {
      session.participants.push(userId);
    }

    session.message_count++;

    // Сохранение
    if (Array.isArray(data[chatKey])) {
      data[chatKey][sessionIndex] = session;
    } else {
      data[chatKey] = session;
    }

    this._store.setData(data);
    logger.debug({ sessionId, messageId }, 'Message added to session');

    return session;
  }

  /**
   * Получение цепочки сообщений от корня до указанного
   * @param {Object} session - Сессия
   * @param {number} messageId - ID сообщения
   * @returns {Array} Массив сообщений от корня до текущего
   */
  getMessageChain(session, messageId) {
    const chain = [];
    let currentId = messageId;

    while (currentId) {
      const message = session.message_tree[currentId];
      if (!message) {
        break;
      }

      chain.unshift({
        role: message.user_id === 'bot' ? 'assistant' : 'user',
        content: message.text || '',
        message_id: message.message_id,
      });

      currentId = message.parent_id;
    }

    return chain;
  }

  /**
   * Обновление контекста сессии
   * @param {string} sessionId - ID сессии
   * @param {number} chatId - Telegram chat ID
   * @param {Object} context - Новый контекст
   * @returns {Object|null} Обновлённая сессия
   */
  updateContext(sessionId, chatId, context) {
    const data = this._store.getData();
    const chatKey = `chat:${chatId}`;

    let session;
    let sessionIndex = -1;

    if (Array.isArray(data[chatKey])) {
      sessionIndex = data[chatKey].findIndex((s) => s.session_id === sessionId);
      if (sessionIndex === -1) {
        return null;
      }
      session = data[chatKey][sessionIndex];
    } else {
      session = data[chatKey];
    }

    session.context = { ...session.context, ...context };

    if (Array.isArray(data[chatKey])) {
      data[chatKey][sessionIndex] = session;
    } else {
      data[chatKey] = session;
    }

    this._store.setData(data);
    return session;
  }

  /**
   * Закрытие сессии
   * @param {string} sessionId - ID сессии
   * @param {number} chatId - Telegram chat ID
   * @returns {boolean} Успешность
   */
  close(sessionId, chatId) {
    const data = this._store.getData();
    const chatKey = `chat:${chatId}`;

    if (Array.isArray(data[chatKey])) {
      const index = data[chatKey].findIndex((s) => s.session_id === sessionId);
      if (index === -1) {
        return false;
      }

      data[chatKey][index].status = 'closed';
      data[chatKey][index].closed_at = new Date().toISOString();
    } else if (data[chatKey]?.session_id === sessionId) {
      data[chatKey].status = 'closed';
      data[chatKey].closed_at = new Date().toISOString();
    } else {
      return false;
    }

    this._store.setData(data);
    logger.info({ sessionId, chatId }, 'Session closed');

    return true;
  }

  /**
   * Полное удаление сессии
   * @param {string} sessionKey - Ключ сессии (user:{userId} или chat:{chatId})
   * @returns {boolean} Успешность
   */
  remove(sessionKey) {
    const data = this._store.getData();

    if (data[sessionKey]) {
      delete data[sessionKey];
      this._store.setData(data);
      logger.info({ sessionKey }, 'Session removed');
      return true;
    }

    return false;
  }

  /**
   * Очистка просроченных сессий
   * @returns {number} Количество удалённых сессий
   */
  cleanupExpired() {
    const data = this._store.getData();
    const now = new Date();
    let removed = 0;

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        // Групповые сессии
        const filtered = value.filter((session) => {
          const expiresAt = new Date(session.expires_at);
          if (expiresAt < now) {
            removed++;
            return false;
          }
          return true;
        });
        data[key] = filtered;
      } else if (value?.expires_at) {
        // Личная сессия
        const expiresAt = new Date(value.expires_at);
        if (expiresAt < now) {
          delete data[key];
          removed++;
        }
      }
    }

    this._store.setData(data);
    logger.info({ removed }, 'Expired sessions cleaned up');

    return removed;
  }

  /**
   * Получение активных сессий чата
   * @param {number} chatId - Telegram chat ID
   * @returns {Array} Массив сессий
   */
  getChatSessions(chatId) {
    const data = this._store.getData();
    const chatKey = `chat:${chatId}`;
    return data[chatKey] || [];
  }
}

module.exports = new SessionService();
