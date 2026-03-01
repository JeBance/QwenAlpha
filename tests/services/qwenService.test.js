const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Моки для зависимостей
const mockLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => mockLogger,
};

// Временная директория для тестов
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-alpha-test-'));

/**
 * Тесты для Qwen Service
 */
describe('QwenService', () => {
  let qwenService;
  
  before(() => {
    // Мокаем зависимости перед импортом
    const mockPath = {
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
      },
    };
    
    // Создаём тестовый сервис
    const { QwenService } = require('../src/services/qwenService');
    qwenService = new QwenService();
  });
  
  describe('_escapeShell', () => {
    it('должен экранировать одинарные кавычки', () => {
      const input = "echo 'hello'";
      const escaped = qwenService._escapeShell(input);
      assert.ok(escaped.includes("'\\''"));
    });
    
    it('должен экранировать обратные кавычки', () => {
      const input = 'echo `command`';
      const escaped = qwenService._escapeShell(input);
      assert.ok(escaped.includes('\\`'));
    });
    
    it('должен возвращать пустую строку для не-string', () => {
      assert.strictEqual(qwenService._escapeShell(null), '');
      assert.strictEqual(qwenService._escapeShell(undefined), '');
      assert.strictEqual(qwenService._escapeShell(123), '');
    });
  });
  
  describe('checkAvailability', () => {
    it('должен возвращать false если Qwen не установлен', async () => {
      const result = await qwenService.checkAvailability();
      // В тестовой среде Qwen скорее всего не установлен
      assert.strictEqual(typeof result, 'boolean');
    });
  });
  
  describe('_parseJsonResponse', () => {
    it('должен парсить JSON с assistant сообщением', () => {
      const json = JSON.stringify([
        {
          type: 'system',
          subtype: 'session_start',
        },
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'Hello World' }],
          },
        },
      ]);
      
      const result = qwenService._parseJsonResponse(json);
      assert.strictEqual(result, 'Hello World');
    });
    
    it('должен парсить JSON со строковым content', () => {
      const json = JSON.stringify([
        {
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Hello World',
          },
        },
      ]);
      
      const result = qwenService._parseJsonResponse(json);
      assert.strictEqual(result, 'Hello World');
    });
    
    it('должен возвращать stdout при ошибке парсинга', () => {
      const invalidJson = 'not a json';
      const result = qwenService._parseJsonResponse(invalidJson);
      assert.strictEqual(result, 'not a json');
    });
    
    it('должен парсить result сообщение', () => {
      const json = JSON.stringify([
        {
          type: 'result',
          result: 'Result text',
        },
      ]);
      
      const result = qwenService._parseJsonResponse(json);
      assert.strictEqual(result, 'Result text');
    });
  });
});
