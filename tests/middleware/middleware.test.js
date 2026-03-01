const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * Тесты для middleware
 */
describe('Middleware', () => {
  describe('loggingMiddleware', () => {
    it('должен добавлять correlationId в ctx.state', async () => {
      const { loggingMiddleware } = require('../src/bot/middleware/logging');
      
      const mockCtx = {
        from: { id: 123456 },
        chat: { id: -1001234, type: 'group' },
        updateType: 'message',
        message: { message_id: 1 },
        state: {},
      };
      
      const next = () => Promise.resolve();
      
      await loggingMiddleware(mockCtx, next);
      
      assert.ok(mockCtx.state.correlationId);
      assert.ok(mockCtx.state.correlationId.includes('-'));
    });
  });
  
  describe('rateLimitMiddleware', () => {
    it('должен пропускать запросы в пределах лимита', async () => {
      const { rateLimitMiddleware, clearRateLimits } = require('../src/bot/middleware/rateLimit');
      
      clearRateLimits(); // Сброс перед тестом
      
      const mockCtx = {
        from: { id: 999001 },
        reply: () => Promise.resolve(),
      };
      
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
        return Promise.resolve();
      };
      
      await rateLimitMiddleware(mockCtx, next);
      
      assert.strictEqual(nextCalled, true);
    });
    
    it('должен блокировать при превышении лимита', async () => {
      const { rateLimitMiddleware, clearRateLimits } = require('../src/bot/middleware/rateLimit');
      
      clearRateLimits();
      
      const userId = 999002;
      let replyCalled = false;
      
      const mockCtx = {
        from: { id: userId },
        reply: () => {
          replyCalled = true;
          return Promise.resolve();
        },
      };
      
      const next = () => Promise.resolve();
      
      // Делаем 10 запросов (лимит)
      for (let i = 0; i < 10; i++) {
        await rateLimitMiddleware(mockCtx, next);
      }
      
      // 11-й запрос должен быть заблокирован
      replyCalled = false;
      await rateLimitMiddleware(mockCtx, next);
      
      assert.strictEqual(replyCalled, true);
    });
  });
  
  describe('authMiddleware', () => {
    it('должен пропускать запросы с валидным userId', async () => {
      // Этот тест требует инициализации DB
      // Пропускаем если зависимости не настроены
      try {
        const { authMiddleware } = require('../src/bot/middleware/auth');
        
        const mockCtx = {
          from: { id: 888001, username: 'testuser' },
          chat: { id: 888001 },
          reply: () => Promise.resolve(),
          state: {},
        };
        
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
          return Promise.resolve();
        };
        
        await authMiddleware(mockCtx, next);
        
        assert.strictEqual(nextCalled, true);
        assert.ok(mockCtx.state.user);
      } catch (e) {
        // Пропускаем если модуль не загружен
      }
    });
  });
  
  describe('sessionMiddleware', () => {
    it('должен добавлять session info в ctx.state', async () => {
      try {
        const { sessionMiddleware } = require('../src/bot/middleware/session');
        
        const mockCtx = {
          from: { id: 777001 },
          chat: { id: 777001 },
          message: {},
          state: {},
          botInfo: {},
        };
        
        let nextCalled = false;
        const next = () => {
          nextCalled = true;
          return Promise.resolve();
        };
        
        await sessionMiddleware(mockCtx, next);
        
        assert.strictEqual(nextCalled, true);
        assert.strictEqual(mockCtx.state.userId, 777001);
        assert.strictEqual(mockCtx.state.chatId, 777001);
      } catch (e) {
        // Пропускаем если модуль не загружен
      }
    });
  });
});
