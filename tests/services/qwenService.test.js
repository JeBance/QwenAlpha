const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * Тесты для Qwen Service
 */
describe('QwenService', () => {
  describe('_escapeShell', () => {
    it('должен возвращать строку', () => {
      const { QwenService } = require('../../src/services/qwenService');
      const qwenService = new QwenService();
      const input = 'hello';
      const escaped = qwenService._escapeShell(input);
      assert.ok(typeof escaped === 'string');
    });

    it('должен возвращать пустую строку для не-string', () => {
      const { QwenService } = require('../../src/services/qwenService');
      const qwenService = new QwenService();
      assert.strictEqual(qwenService._escapeShell(null), '');
      assert.strictEqual(qwenService._escapeShell(123), '');
    });
  });
});
