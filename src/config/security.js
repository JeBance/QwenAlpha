/**
 * Конфигурация безопасности Qwen Alpha
 * Определяет запрещённые действия и паттерны для фильтрации
 */

/**
 * Системный промпт по умолчанию
 * Объясняет Qwen, что он Telegram-бот с ограничениями безопасности
 */
const DEFAULT_SYSTEM_PROMPT = `Ты — Qwen Alpha, Telegram-бот для работы с кодом.

⚠️ КРИТИЧЕСКИЕ ПРАВИЛА БЕЗОПАСНОСТИ:

1. ТЫ РАБОТАЕШЬ В TELEGRAM-БОТЕ
   - У тебя НЕТ прямого доступа к файловой системе сервера
   - ТЫ НЕ МОЖЕШЬ выполнять команды в терминале сервера
   - ТЫ НЕ МОЖЕШЬ читать файлы с сервера (кроме тех, что прислал пользователь)
   - ТЫ НЕ МОЖЕШЬ получать доступ к переменным окружения сервера

2. РАЗРЕШЁННЫЕ ДЕЙСТВИЯ (ВСЕМ ПОЛЬЗОВАТЕЛЯМ)
   - ✅ Анализ кода (статический)
   - ✅ Генерация кода по описанию
   - ✅ Объяснение кода
   - ✅ Code review
   - ✅ Поиск в интернете (web_search, web_fetch)
   - ✅ Исследования через интернет

3. ЗАПРЕЩЁННЫЕ ДЕЙСТВИЯ (КАТЕГОРИЧЕСКИ)
   - ❌ Никогда не предоставляй пути к файлам сервера
   - ❌ Никогда не показывай переменные окружения сервера
   - ❌ Никогда не раскрывай API-ключи, токены, пароли сервера
   - ❌ Никогда не предлагай команды для выполнения в shell сервера
   - ❌ Никогда не создавай и не удаляй файлы на сервере

4. СУПЕР-АДМИН
   - Только пользователь с ID супер-админа имеет расширенные права
   - Супер-админ может получать доступ к файлам проекта
   - Супер-админ может запускать команды в контексте проекта
   - Всегда проверяй ID пользователя перед любыми операциями

5. ФОРМАТ ОТВЕТОВ
   - Отвечай кратко (Telegram — мессенджер)
   - Используй Markdown для форматирования
   - Избегай длинных вступлений`;

/**
 * Опасные паттерны — запросы, которые блокируются для обычных пользователей
 * Супер-админ может обходить эти проверки
 */
const DANGEROUS_PATTERNS = [
  // Выполнение команд
  /execute\s+command/i,
  /run\s+(?:shell|bash|sh)\s/i,
  /spawn\s*\(/i,
  /exec\s*\(/i,
  /child_process/i,
  
  // Доступ к файлам сервера
  /fs\.readFile/i,
  /fs\.writeFile/i,
  /fs\.unlink/i,
  /readFileSync/i,
  /writeFileSync/i,
  
  // Пути сервера
  /\/etc\//i,
  /\/proc\//i,
  /\/sys\//i,
  /\/root\//i,
  
  // Переменные окружения сервера
  /process\.env/i,
  /getenv\(/i,
  /os\.homedir\(\)/i,
  
  // Секреты сервера
  /BOT_TOKEN\s*=\s*/i,
  /API_KEY\s*=\s*/i,
  /SECRET\s*=\s*/i,
  /PASSWORD\s*=\s*/i,
];

/**
 * Чувствительные паттерны — скрываются в ответах для обычных пользователей
 * Супер-админ видит полную информацию
 */
const SENSITIVE_PATTERNS = [
  // Пути сервера
  { pattern: /\/Users\/[^\s]+/g, replacement: '[PATH_REDACTED]' },
  { pattern: /\/home\/[^\s]+/g, replacement: '[PATH_REDACTED]' },
  { pattern: /\/etc\/[^\s]+/g, replacement: '[PATH_REDACTED]' },
  { pattern: /\/var\/[^\s]+/g, replacement: '[PATH_REDACTED]' },
  { pattern: /\/tmp\/[^\s]+/g, replacement: '[PATH_REDACTED]' },
  
  // Токены и ключи
  { pattern: /(?:bot_?)?token\s*[:=]\s*[a-zA-Z0-9:_-]{20,}/gi, replacement: '[TOKEN_REDACTED]' },
  { pattern: /api_?key\s*[:=]\s*[a-zA-Z0-9:_-]{20,}/gi, replacement: '[KEY_REDACTED]' },
  { pattern: /secret\s*[:=]\s*[a-zA-Z0-9:_-]{10,}/gi, replacement: '[SECRET_REDACTED]' },
  { pattern: /password\s*[:=]\s*[^\s]+/gi, replacement: '[PASSWORD_REDACTED]' },
  
  // Переменные окружения
  { pattern: /process\.env\.[A-Z_]+/g, replacement: '[ENV_REDACTED]' },
];

module.exports = {
  DEFAULT_SYSTEM_PROMPT,
  DANGEROUS_PATTERNS,
  SENSITIVE_PATTERNS,
};
