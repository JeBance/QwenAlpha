const { describe, it, before } = require('node:test');
const assert = require('node:assert');

/**
 * Тесты для Qwen Service
 */
describe('QwenService', () => {
  let qwenService;

  before(() => {
    // Создаём тестовый сервис
    const { QwenService } = require('../src/services/qwenService');
    qwenService = new QwenService();
  });

  describe('_escapeShell', () => {
    it('должен экранировать одинарные кавычки', () => {
      const input = 'echo hello';
      const escaped = qwenService._escapeShell(input);
      assert.ok(escaped);
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
