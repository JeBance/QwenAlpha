const { storeManager } = require('./index');
const { logger } = require('../../utils/logger');

/**
 * Сервис для управления администраторами
 */
class AdminService {
  /**
   * Получение хранилища админов
   * @private
   */
  get _store() {
    return storeManager.get('admins');
  }

  /**
   * Получение данных об админах
   * @returns {Object} Данные об админах
   */
  getData() {
    return this._store.getData();
  }

  /**
   * Проверка, является ли пользователь супер-админом
   * @param {number} userId - Telegram user ID
   * @returns {boolean} true если супер-админ
   */
  isSuperAdmin(userId) {
    const data = this._store.getData();
    return data.super_admin === userId;
  }

  /**
   * Проверка, является ли пользователь админом
   * @param {number} userId - Telegram user ID
   * @returns {boolean} true если админ
   */
  isAdmin(userId) {
    const data = this._store.getData();
    return data.super_admin === userId || data.admins.includes(userId);
  }

  /**
   * Регистрация супер-админа (первый пользователь)
   * @param {number} userId - Telegram user ID
   * @returns {boolean} true если успешно зарегистрирован
   */
  registerSuperAdmin(userId) {
    const data = this._store.getData();

    // Если супер-админ уже есть, возвращаем false
    if (data.super_admin !== null) {
      return false;
    }

    data.super_admin = userId;
    this._store.setData(data);
    logger.info({ userId }, 'Super admin registered');

    return true;
  }

  /**
   * Добавление админа
   * @param {number} userId - Telegram user ID
   * @param {number} addedBy - Telegram user ID добавившего (должен быть супер-админом)
   * @returns {boolean} Успешность
   */
  addAdmin(userId, addedBy) {
    if (!this.isSuperAdmin(addedBy)) {
      logger.warn({ userId, addedBy }, 'Non-super-admin tried to add admin');
      return false;
    }

    const data = this._store.getData();

    if (data.admins.includes(userId)) {
      return false;
    }

    data.admins.push(userId);
    this._store.setData(data);
    logger.info({ userId, addedBy }, 'Admin added');

    return true;
  }

  /**
   * Удаление админа
   * @param {number} userId - Telegram user ID
   * @param {number} removedBy - Telegram user ID удаляющего (должен быть супер-админом)
   * @returns {boolean} Успешность
   */
  removeAdmin(userId, removedBy) {
    if (!this.isSuperAdmin(removedBy)) {
      logger.warn({ userId, removedBy }, 'Non-super-admin tried to remove admin');
      return false;
    }

    const data = this._store.getData();
    const index = data.admins.indexOf(userId);

    if (index === -1) {
      return false;
    }

    data.admins.splice(index, 1);
    this._store.setData(data);
    logger.info({ userId, removedBy }, 'Admin removed');

    return true;
  }

  /**
   * Получение списка всех админов
   * @returns {Object} Список админов
   */
  getAllAdmins() {
    const data = this._store.getData();
    return {
      super_admin: data.super_admin,
      admins: [...data.admins],
    };
  }

  /**
   * Получение массива всех admin_id (супер-админ + обычные)
   * @returns {Array} Массив объектов {id, isSuperAdmin}
   */
  getAllAdminIds() {
    const data = this._store.getData();
    const result = [];
    
    if (data.super_admin !== null) {
      result.push({ id: data.super_admin, isSuperAdmin: true });
    }
    
    for (const adminId of data.admins) {
      result.push({ id: adminId, isSuperAdmin: false });
    }
    
    return result;
  }

  /**
   * Получение списка обычных админов (не супер-админ)
   * @returns {Array} Массив user_id
   */
  getAdmins() {
    const data = this._store.getData();
    return [...data.admins];
  }

  /**
   * Получение супер-админа
   * @returns {number|null} user_id или null
   */
  getSuperAdmin() {
    const data = this._store.getData();
    return data.super_admin;
  }
}

module.exports = new AdminService();
