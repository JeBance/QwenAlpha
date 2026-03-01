const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Тесты для DB сервисов
 */
describe('DB Services', () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-alpha-db-test-'));
  
  // Мокаем пути перед импортом
  const originalPaths = require('../src/utils/paths');
  const mockPaths = {
    QWEN_ALPHA_HOME: testDir,
    DIRECTORIES: {
      db: path.join(testDir, 'db'),
      logs: path.join(testDir, 'logs'),
      config: path.join(testDir, 'config'),
      temp: path.join(testDir, 'temp'),
    },
    DB_FILES: {
      users: path.join(testDir, 'db', 'users.json'),
      sessions: path.join(testDir, 'db', 'sessions.json'),
      admins: path.join(testDir, 'db', 'admins.json'),
      stats: path.join(testDir, 'db', 'stats.json'),
      settings: path.join(testDir, 'config', 'settings.json'),
    },
    getLogFilePath: () => path.join(testDir, 'logs', 'test.log'),
    initDirectories: () => {
      fs.mkdirSync(testDir, { recursive: true });
      fs.mkdirSync(path.join(testDir, 'db'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'config'), { recursive: true });
    },
  };
  
  // Очищаем кэш модулей для переопределения путей
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/src/')) {
      delete require.cache[key];
    }
  });
  
  before(() => {
    mockPaths.initDirectories();
  });
  
  after(() => {
    // Очистка после тестов
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
      // Игнорируем ошибки очистки
    }
  });
  
  describe('UserService', () => {
    const userService = require('../src/services/db/users');
    
    it('должен создавать нового пользователя', () => {
      const user = userService.upsert({
        id: 123456,
        username: 'testuser',
        first_name: 'Test',
      });
      
      assert.strictEqual(user.id, 123456);
      assert.strictEqual(user.username, 'testuser');
      assert.strictEqual(user.first_name, 'Test');
      assert.ok(user.created_at);
      assert.ok(user.settings);
    });
    
    it('должен получать пользователя по ID', () => {
      const user = userService.getById(123456);
      assert.strictEqual(user.id, 123456);
      assert.strictEqual(user.username, 'testuser');
    });
    
    it('должен обновлять last_seen при повторном upsert', () => {
      const firstUser = userService.getById(123456);
      
      // Ждём немного и обновляем
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      
      // Обновляем пользователя
      const updatedUser = userService.upsert({
        id: 123456,
        username: 'testuser_updated',
      });
      
      assert.strictEqual(updatedUser.username, 'testuser_updated');
      assert.ok(new Date(updatedUser.last_seen) >= new Date(firstUser.last_seen));
    });
    
    it('должен обновлять статистику', () => {
      userService.updateStats(123456, { total_requests: 10 });
      const user = userService.getById(123456);
      assert.strictEqual(user.stats.total_requests, 10);
    });
    
    it('должен инкрементировать запрос', () => {
      userService.incrementRequest(123456);
      const user = userService.getById(123456);
      assert.ok(user.rate_limits.requests_today >= 1);
    });
    
    it('должен банить пользователя', () => {
      const result = userService.ban(123456);
      assert.strictEqual(result, true);
      
      const user = userService.getById(123456);
      assert.strictEqual(user.is_banned, true);
    });
    
    it('должен разбанивать пользователя', () => {
      const result = userService.unban(123456);
      assert.strictEqual(result, true);
      
      const user = userService.getById(123456);
      assert.strictEqual(user.is_banned, false);
    });
    
    it('должен возвращать null для несуществующего пользователя', () => {
      const user = userService.getById(999999);
      assert.strictEqual(user, null);
    });
  });
  
  describe('AdminService', () => {
    const adminService = require('../src/services/db/admins');
    
    it('должен регистрировать супер-админа', () => {
      const result = adminService.registerSuperAdmin(111111);
      assert.strictEqual(result, true);
      assert.strictEqual(adminService.isSuperAdmin(111111), true);
    });
    
    it('не должен регистрировать второго супер-админа', () => {
      const result = adminService.registerSuperAdmin(222222);
      assert.strictEqual(result, false);
    });
    
    it('должен проверять isSuperAdmin', () => {
      assert.strictEqual(adminService.isSuperAdmin(111111), true);
      assert.strictEqual(adminService.isSuperAdmin(333333), false);
    });
    
    it('должен проверять isAdmin', () => {
      assert.strictEqual(adminService.isAdmin(111111), true);
    });
    
    it('должен добавлять админа', () => {
      const result = adminService.addAdmin(444444, 111111);
      assert.strictEqual(result, true);
      assert.strictEqual(adminService.isAdmin(444444), true);
    });
    
    it('не должен добавлять админа не от супер-админа', () => {
      const result = adminService.addAdmin(555555, 444444);
      assert.strictEqual(result, false);
    });
    
    it('должен удалять админа', () => {
      const result = adminService.removeAdmin(444444, 111111);
      assert.strictEqual(result, true);
      assert.strictEqual(adminService.isAdmin(444444), false);
    });
    
    it('должен возвращать список админов', () => {
      const admins = adminService.getAllAdmins();
      assert.ok(admins.super_admin);
      assert.ok(Array.isArray(admins.admins));
    });
  });
  
  describe('StatsService', () => {
    const statsService = require('../src/services/db/stats');
    
    it('должен инкрементировать запрос', () => {
      const before = statsService.getGlobal();
      statsService.incrementRequest();
      const after = statsService.getGlobal();
      
      assert.ok(after.requests_today >= before.requests_today + 1);
    });
    
    it('должен инкрементировать ошибку', () => {
      const before = statsService.getGlobal();
      statsService.incrementError();
      const after = statsService.getGlobal();
      
      assert.ok(after.errors_24h >= before.errors_24h + 1);
    });
    
    it('должен обновлять среднее время ответа', () => {
      statsService.updateAvgResponseTime(100);
      statsService.updateAvgResponseTime(200);
      
      const stats = statsService.getGlobal();
      assert.ok(stats.avg_response_time_ms >= 0);
    });
    
    it('должен возвращать ежедневную статистику', () => {
      const today = new Date().toISOString().split('T')[0];
      const daily = statsService.getDaily(today);
      
      assert.ok(typeof daily.requests === 'number');
    });
    
    it('должен возвращать статистику за период', () => {
      const period = statsService.getPeriod(7);
      
      assert.ok(typeof period.total_requests === 'number');
      assert.ok(Array.isArray(period.daily));
      assert.strictEqual(period.daily.length, 7);
    });
  });
});
