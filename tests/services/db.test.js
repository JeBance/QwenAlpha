const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * Тесты для DB сервисов
 */
describe('DB Services', () => {
  it('должен создавать пользователя', () => {
    const userService = require('../../src/services/db/users');
    const user = userService.upsert({
      id: 999001,
      username: 'test',
      first_name: 'Test',
    });
    assert.strictEqual(user.id, 999001);
    assert.strictEqual(user.username, 'test');
  });

  it('должен получать пользователя по ID', () => {
    const userService = require('../../src/services/db/users');
    const user = userService.getById(999001);
    assert.strictEqual(user.id, 999001);
  });

  it('должен регистрировать супер-админа', () => {
    const adminService = require('../../src/services/db/admins');
    const result = adminService.registerSuperAdmin(888001);
    assert.strictEqual(result, true);
    assert.strictEqual(adminService.isSuperAdmin(888001), true);
  });

  it('должен возвращать глобальную статистику', () => {
    const statsService = require('../../src/services/db/stats');
    const stats = statsService.getGlobal();
    assert.ok(typeof stats.total_users === 'number');
  });
});
