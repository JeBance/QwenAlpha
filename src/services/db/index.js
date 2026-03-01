const fs = require('fs');
const path = require('path');
const { DB_FILES, initDirectories } = require('../../utils/paths');
const { logger } = require('../../utils/logger');

/**
 * Базовый класс для JSON хранилища
 * Обеспечивает CRUD операции с файлами и синхронизацию
 */
class JsonStore {
  /**
   * @param {string} filePath - Путь к JSON файлу
   * @param {Object} defaultData - Данные по умолчанию
   */
  constructor(filePath, defaultData = {}) {
    this.filePath = filePath;
    this.defaultData = defaultData;
    this.data = null;
    this.isInitialized = false;
  }
  
  /**
   * Инициализация хранилища
   * Загружает данные из файла или создаёт новый
   */
  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(content);
        logger.debug({ file: this.filePath }, 'Loaded existing store');
      } else {
        this.data = JSON.parse(JSON.stringify(this.defaultData));
        this.save();
        logger.debug({ file: this.filePath }, 'Created new store');
      }
      this.isInitialized = true;
    } catch (error) {
      logger.error({ error, file: this.filePath }, 'Failed to initialize store');
      this.data = JSON.parse(JSON.stringify(this.defaultData));
      this.isInitialized = true;
    }
  }
  
  /**
   * Сохранение данных в файл
   */
  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      logger.error({ error, file: this.filePath }, 'Failed to save store');
      throw error;
    }
  }
  
  /**
   * Получение данных
   * @returns {Object} Копия данных хранилища
   */
  getData() {
    if (!this.isInitialized) {
      this.init();
    }
    return JSON.parse(JSON.stringify(this.data));
  }
  
  /**
   * Установка данных
   * @param {Object} newData - Новые данные
   */
  setData(newData) {
    if (!this.isInitialized) {
      this.init();
    }
    this.data = JSON.parse(JSON.stringify(newData));
    this.save();
  }
  
  /**
   * Обновление данных (merge)
   * @param {Object} updates - Данные для обновления
   */
  updateData(updates) {
    if (!this.isInitialized) {
      this.init();
    }
    this.data = { ...this.data, ...updates };
    this.save();
  }
}

/**
 * Менеджер хранилищ
 * Управляет инициализацией и доступом ко всем хранилищам
 */
class StoreManager {
  constructor() {
    this.stores = {};
    this.isInitialized = false;
  }
  
  /**
   * Инициализация всех хранилищ
   */
  init() {
    if (this.isInitialized) {
      return;
    }
    
    initDirectories();
    
    // Инициализация хранилищ
    this.stores.users = new JsonStore(DB_FILES.users, {});
    this.stores.sessions = new JsonStore(DB_FILES.sessions, {});
    this.stores.admins = new JsonStore(DB_FILES.admins, { super_admin: null, admins: [] });
    this.stores.stats = new JsonStore(DB_FILES.stats, {
      global: {
        total_users: 0,
        active_24h: 0,
        requests_today: 0,
        errors_24h: 0,
        avg_response_time_ms: 0,
      },
      daily: {},
    });
    this.stores.settings = new JsonStore(DB_FILES.settings, {
      session_timeout_hours: 24,
      max_file_size_mb: 2,
      requests_per_user_per_hour: 60,
      log_rotation_days: 1,
      group_mode: 'mention',
    });
    
    // Инициализация каждого хранилища
    Object.values(this.stores).forEach(store => store.init());
    
    this.isInitialized = true;
    logger.info('All stores initialized');
  }
  
  /**
   * Получение хранилища
   * @param {string} name - Имя хранилища
   * @returns {JsonStore} Хранилище
   */
  get(name) {
    if (!this.isInitialized) {
      this.init();
    }
    return this.stores[name];
  }
  
  /**
   * Сохранение всех хранилищ
   */
  saveAll() {
    Object.values(this.stores).forEach(store => {
      if (store.isInitialized) {
        store.save();
      }
    });
  }
}

// Экспорт синглтона
const storeManager = new StoreManager();

module.exports = {
  JsonStore,
  StoreManager,
  storeManager,
};
