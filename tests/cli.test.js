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
      assert.ok(output.includes('Telegram'));
      assert.ok(output.includes('--token'));
    });
  });

  describe('--version', () => {
    it('должен показывать версию', () => {
      const output = execSync(`node ${binPath} --version`, { encoding: 'utf-8' });

      assert.ok(output.match(/\d+\.\d+\.\d+/));
    });
  });

  describe('без токена', () => {
    it('должен показывать ошибку без токена', () => {
      assert.throws(
        () => execSync(`node ${binPath}`, { encoding: 'utf-8', stdio: 'pipe' }),
        /Token|token|Ошибка/
      );
    });
  });
});
