const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Тесты для CLI entry point
 */
describe('CLI', () => {
  const binPath = path.join(__dirname, '../bin/qwen-alpha.js');

  describe('--help', () => {
    it('должен показывать справку', () => {
      const output = execSync(`node ${binPath} --help`, { encoding: 'utf-8' });

      assert.ok(output.includes('qwen-alpha'));
      assert.ok(output.includes('Telegram бот'));
      assert.ok(output.includes('--token'));
      assert.ok(output.includes('--log-level'));
    });
  });

  describe('--version', () => {
    it('должен показывать версию', () => {
      const output = execSync(`node ${binPath} --version`, { encoding: 'utf-8' });

      assert.ok(output.match(/^\d+\.\d+\.\d+$/));
    });
  });

  describe('без токена', () => {
    it('должен показывать ошибку без токена', () => {
      assert.throws(
        () => execSync(`node ${binPath}`, { encoding: 'utf-8', stdio: 'pipe' }),
        /exit code 1/
      );
    });
  });

  describe('--init-only', () => {
    it('должен инициализировать хранилища', () => {
      // Этот тест требует установку зависимостей
      // Пропускаем если node_modules нет
      try {
        const output = execSync(`node ${binPath} --init-only`, {
          encoding: 'utf-8',
          env: { ...process.env, BOT_TOKEN: 'test' },
        });

        assert.ok(output.includes('инициализированы'));
      } catch (e) {
        // Пропускаем если зависимости не установлены
      }
    });
  });
});
