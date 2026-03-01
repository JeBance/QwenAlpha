const { storeManager } = require('./index');
const { logger } = require('../../utils/logger');

/**
 * Сервис для управления статистикой
 */
class StatsService {
  /**
   * Получение хранилища статистики
   * @private
   */
  get _store() {
    return storeManager.get('stats');
  }
  
  /**
   * Получение сегодняшней даты в формате YYYY-MM-DD
   * @private
   */
  get _today() {
    return new Date().toISOString().split('T')[0];
  }
  
  /**
   * Инициализация дня в статистике
   * @private
   */
  _initDay() {
    const data = this._store.getData();
    const today = this._today;
    
    if (!data.daily[today]) {
      data.daily[today] = {
        requests: 0,
        users: 0,
        errors: 0,
        files: 0,
        sessions_created: 0,
      };
    }
    
    return data;
  }
  
  /**
   * Инкремент запроса
   */
  incrementRequest() {
    const data = this._initDay();
    
    data.global.requests_today++;
    data.daily[this._today].requests++;
    
    this._store.setData(data);
  }
  
  /**
   * Инкремент ошибки
   */
  incrementError() {
    const data = this._initDay();
    
    data.global.errors_24h++;
    data.daily[this._today].errors++;
    
    this._store.setData(data);
  }
  
  /**
   * Инкремент анализа файла
   */
  incrementFile() {
    const data = this._initDay();
    
    data.daily[this._today].files++;
    
    this._store.setData(data);
  }
  
  /**
   * Инкремент создания сессии
   */
  incrementSessionCreated() {
    const data = this._initDay();
    
    data.daily[this._today].sessions_created++;
    
    this._store.setData(data);
  }
  
  /**
   * Обновление среднего времени ответа
   * @param {number} responseTimeMs - Время ответа в мс
   */
  updateAvgResponseTime(responseTimeMs) {
    const data = this._store.getData();
    const currentAvg = data.global.avg_response_time_ms;
    const totalRequests = data.global.requests_today;
    
    // Скользящее среднее
    const newAvg = totalRequests > 0
      ? ((currentAvg * (totalRequests - 1)) + responseTimeMs) / totalRequests
      : responseTimeMs;
    
    data.global.avg_response_time_ms = Math.round(newAvg);
    
    this._store.setData(data);
  }
  
  /**
   * Обновление количества активных пользователей за 24ч
   * @param {number} count - Количество пользователей
   */
  updateActiveUsers24h(count) {
    const data = this._store.getData();
    data.global.active_24h = count;
    this._store.setData(data);
  }
  
  /**
   * Обновление общего количества пользователей
   * @param {number} count - Количество пользователей
   */
  updateTotalUsers(count) {
    const data = this._store.getData();
    data.global.total_users = count;
    this._store.setData(data);
  }
  
  /**
   * Получение глобальной статистики
   * @returns {Object} Глобальная статистика
   */
  getGlobal() {
    const data = this._store.getData();
    return data.global;
  }
  
  /**
   * Получение статистики за день
   * @param {string} [date] - Дата в формате YYYY-MM-DD (по умолчанию сегодня)
   * @returns {Object} Статистика за день
   */
  getDaily(date = this._today) {
    const data = this._store.getData();
    return data.daily[date] || {
      requests: 0,
      users: 0,
      errors: 0,
      files: 0,
      sessions_created: 0,
    };
  }
  
  /**
   * Получение статистики за период
   * @param {number} days - Количество дней
   * @returns {Object} Статистика за период
   */
  getPeriod(days) {
    const data = this._store.getData();
    const result = {
      total_requests: 0,
      total_errors: 0,
      total_files: 0,
      total_sessions: 0,
      daily: [],
    };
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStats = data.daily[dateStr] || {
        requests: 0,
        errors: 0,
        files: 0,
        sessions_created: 0,
      };
      
      result.total_requests += dayStats.requests;
      result.total_errors += dayStats.errors;
      result.total_files += dayStats.files;
      result.total_sessions += dayStats.sessions_created;
      
      result.daily.push({
        date: dateStr,
        ...dayStats,
      });
    }
    
    return result;
  }
  
  /**
   * Сброс статистики за день (вызывается ежедневно)
   */
  resetDaily() {
    const data = this._store.getData();
    
    // Архивация старых данных (опционально)
    // Очистка данных старше 30 дней
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    for (const date of Object.keys(data.daily)) {
      if (date < cutoffDate) {
        delete data.daily[date];
      }
    }
    
    // Сброс счётчиков 24ч
    data.global.errors_24h = 0;
    data.global.active_24h = 0;
    
    this._store.setData(data);
    logger.info('Daily stats reset');
  }
}

module.exports = new StatsService();
