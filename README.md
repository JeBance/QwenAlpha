# Qwen Alpha v2.0

[![CI](https://github.com/JeBance/QwenAlpha/actions/workflows/ci.yml/badge.svg)](https://github.com/JeBance/QwenAlpha/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/qwen-alpha.svg)](https://www.npmjs.com/package/qwen-alpha)
[![license](https://img.shields.io/npm/l/qwen-alpha.svg)](https://github.com/JeBance/QwenAlpha/blob/main/LICENSE)

**Qwen Alpha** — универсальный Telegram-бот на базе Qwen Code с поддержкой кастомных системных промптов. Превратите бота в консультанта магазина, техподдержку, юридического советника или AI-ассистента для работы с кодом.

---

## 🚀 Быстрый старт

### Установка

```bash
npm install -g qwen-alpha@2.0.0
```

### Требования

- **Node.js** >= 18.0.0
- **Qwen Code** (глобально): `npm install -g @qwen-code/qwen-code`
- **Telegram Bot Token** (получите у [@BotFather](https://t.me/BotFather))

### Запуск

```bash
qwen-alpha --token <YOUR_BOT_TOKEN>
```

Или через переменную окружения:

```bash
export BOT_TOKEN=<YOUR_BOT_TOKEN>
qwen-alpha --token $BOT_TOKEN
```

---

## 📋 Возможности v2.0

### Для всех пользователей

| Функция              | Описание                                  |
| -------------------- | ----------------------------------------- |
| **Code Review**      | Анализ кода, поиск багов и уязвимостей    |
| **Генерация кода**   | Создание кода по описанию                 |
| **Объяснение кода**  | Подробное объяснение сложных участков     |
| **Рефакторинг**      | Улучшение читаемости и производительности |
| **Работа с файлами** | Анализ файлов с кодом (до 2MB)            |
| **Контекст диалога** | Бот помнит историю обсуждения             |
| **Безопасность**     | Защита от опасных запросов                |

### Для супер-админа

| Функция                 | Описание                                 |
| ----------------------- | ---------------------------------------- |
| **Системный промпт**    | Настройка поведения бота под свои задачи |
| **Управление админами** | Добавление/удаление администраторов      |
| **Просмотр промпта**    | Просмотр текущего системного промпта     |
| **Сброс промпта**       | Возврат к промпту по умолчанию           |

### Сценарии использования

| Сценарий                 | Пример промпта                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Консультант магазина** | `Ты — консультант магазина электроники. Ассортимент: телевизоры, холодильники. Отвечай кратко, предлагай товары.` |
| **Техподдержка**         | `Ты — техподдержка CRM-системы. Тарифы: Старт (990₽), Про (1990₽). Помогай с настройкой.`                         |
| **Юридический бот**      | `Ты — юридический консультант по праву РФ. Специализация: договоры, ИП, ООО. Отвечай на основе ГК РФ, НК РФ.`     |
| **AI-ассистент кода**    | `Ты — AI-ассистент для работы с кодом. Анализируй код, ищи баги, предлагай улучшения.`                            |

---

## 📖 Команды бота

### Основные команды

| Команда         | Описание                          |
| --------------- | --------------------------------- |
| `/start`        | Запуск бота и приветствие         |
| `/help`         | Список команд и информация        |
| `/instructions` | Подробные инструкции по настройке |
| `/reset`        | Сброс текущей сессии              |
| `/stats`        | Статистика пользователя           |
| `/settings`     | Настройки бота                    |

### Команды супер-админа

| Команда                    | Описание                     |
| -------------------------- | ---------------------------- |
| `/setSystemPrompt <промт>` | Установить системный промпт  |
| `/getSystemPrompt`         | Просмотр текущего промпта    |
| `/resetSystemPrompt`       | Сброс к промпту по умолчанию |
| `/admin add <user_id>`     | Добавить админа              |
| `/admin remove <user_id>`  | Удалить админа               |
| `/admin ban <user_id>`     | Забанить пользователя        |
| `/admin unban <user_id>`   | Разбанить пользователя       |

---

## ⚙️ Конфигурация

### CLI опции

```bash
qwen-alpha --token <TOKEN> [опции]
```

| Опция                   | Описание                      | По умолчанию    |
| ----------------------- | ----------------------------- | --------------- |
| `--token <TOKEN>`       | Telegram Bot API токен        | **Обязательно** |
| `--log-level <LEVEL>`   | Уровень логирования           | `info`          |
| `--allowed-users <IDS>` | Whitelist user_id             | все             |
| `--init-only`           | Только инициализация хранилищ | `false`         |

### Переменные окружения

```bash
# .env файл (опционально)
BOT_TOKEN=your_bot_token_here
LOG_LEVEL=info
ALLOWED_USERS=123456789,987654321
QWEN_TIMEOUT=300000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

---

## 🔒 Безопасность

### Защита от опасных запросов

Бот автоматически блокирует запросы, содержащие:

- Выполнение shell-команд (`execute command`, `run shell`)
- Доступ к файловой системе сервера (`fs.readFile`, `fs.writeFile`)
- Переменные окружения сервера (`process.env`)
- Секреты и токены (`BOT_TOKEN`, `API_KEY`, `SECRET`)

### Фильтрация ответов

Для обычных пользователей скрывается:

- Пути к файлам сервера (`/Users/...`, `/home/...`)
- Токены и API-ключи
- Переменные окружения
- Пароли и секреты

**Супер-админ обходит все проверки!**

---

## 📁 Хранение данных

Данные хранятся в `~/.qwen-alpha/`:

```
~/.qwen-alpha/
├── db/
│   ├── users.json       # Пользователи
│   ├── sessions.json    # Сессии (24ч)
│   ├── admins.json      # Администраторы
│   ├── stats.json       # Статистика
│   └── settings.json    # Настройки (включая system_prompt)
├── logs/
│   └── qwen-alpha-YYYY-MM-DD.log
└── config/
    └── settings.json    # Конфигурация бота
```

**Важно**: Данные не хранятся в node_modules и не затираются при обновлении.

---

## 🏗 Архитектура проекта

```
QwenAlpha/
├── bin/qwen-alpha.js          # CLI entry point (Commander)
├── src/
│   ├── index.js               # Основной экспорт (startBot, stopBot)
│   ├── bot/
│   │   ├── bot.js             # Telegraf инициализация
│   │   ├── middleware/        # logging, rateLimit, session, auth, security
│   │   └── handlers/          # start, help, reset, stats, settings, admin, message, file, systemPrompt, instructions
│   ├── services/
│   │   ├── db/                # JSON хранилище (users, sessions, admins, stats, systemPrompt)
│   │   └── qwenService.js     # Qwen Code интеграция (headless режим)
│   ├── config/                # Конфигурация (index.js, security.js)
│   └── utils/                 # logger (pino), paths (~/.qwen-alpha/)
├── tests/                     # Тесты (node:test)
└── package.json               # v2.0.0, dependencies: telegraf, commander, dotenv, pino
```

### Поток обработки запроса

```
1. Пользователь → Telegram → Бот
2. Middleware: logging → rateLimit → auth → security → session
3. Handler: messageHandler
4. qwenService.analyzeCode() + systemPrompt + userId
5. Qwen Code (headless, -o text)
6. filterResponse() (скрытие чувствительных данных)
7. preprocessMarkdown() (заголовки → emoji + жирный)
8. Telegram → Пользователь
```

---

## 🧪 Тесты

```bash
npm test
```

Запускает тесты CLI:

- `--help` — проверка справки
- `--version` — проверка версии
- Без токена — проверка ошибки

---

## 📝 Примеры использования

### 1. Консультант магазина электроники

```bash
# Запуск бота
qwen-alpha --token YOUR_BOT_TOKEN

# В Telegram (супер-админ):
/setSystemPrompt Ты — консультант магазина электроники "ТехноМир".
Ассортимент: телевизоры (LG, Samsung, Sony), холодильники, стиральные машины.
Цены: телевизоры от 15000₽, холодильники от 25000₽.
Отвечай кратко, предлагай товары, упоминай акции.
```

### 2. Техподдержка SaaS-платформы

```bash
/setSystemPrompt Ты — техподдержка CRM-системы "Битрикс24".
Тарифы: Старт (990₽/мес), Компания (1990₽/мес), Бизнес (3990₽/мес).
Помогай с настройкой воронок, интеграцией почты, импортом клиентов.
```

### 3. Юридический консультант

```bash
/setSystemPrompt Ты — юридический консультант по праву РФ.
Специализация: договоры, ИП, ООО, налоги, трудовое право.
Отвечай на основе ГК РФ, НК РФ, ТК РФ.
Не давай гарантий — рекомендуй очную консультацию.
```

---

## 🛠 Разработка

### Установка зависимостей

```bash
git clone https://github.com/JeBance/QwenAlpha.git
cd QwenAlpha
npm install
```

### Запуск в режиме разработки

```bash
npm start -- --token <YOUR_BOT_TOKEN>
```

### Тесты

```bash
npm test
```

### Линтинг и форматирование

```bash
npm run lint
npm run format
npm run format:check
```

---

## 📊 История версий

### v2.0.0 (2026-03-02)

**Новые возможности:**

- ✅ Системные промпты (кастомизация поведения бота)
- ✅ Команды `/setSystemPrompt`, `/getSystemPrompt`, `/resetSystemPrompt`
- ✅ Команда `/instructions` — подробные инструкции
- ✅ Система безопасности (DANGEROUS_PATTERNS, SENSITIVE_PATTERNS)
- ✅ Middleware для проверки запросов
- ✅ Фильтрация ответов (скрытие чувствительной информации)
- ✅ Автоматическая инициализация промпта при первом запуске
- ✅ Приветствие супер-админа с инструкциями
- ✅ Передача ID пользователя в Qwen (для проверки прав)
- ✅ Обработка заголовков Markdown (→ emoji + жирный)
- ✅ Переход на HTML-форматирование (стабильнее Markdown)

**Исправления:**

- ✅ Исправлены ошибки парсинга Markdown
- ✅ Исправлено форматирование Prettier
- ✅ Увеличен таймаут Qwen до 5 минут
- ✅ Увеличен таймаут Telegraf до 6 минут

### v1.0.20 и ранее

- Базовая функциональность бота
- Code review, генерация кода, объяснение
- Сессии и контекст диалога
- Админ-панель

---

## 🔗 Ссылки

- **Репозиторий**: https://github.com/JeBance/QwenAlpha
- **NPM**: https://www.npmjs.com/package/qwen-alpha
- **Qwen Code**: https://github.com/QwenLM/qwen-code
- **Issues**: https://github.com/JeBance/QwenAlpha/issues
- **Telegraf**: https://telegraf.js.org/

---

## 📞 Поддержка

- **Telegram**: [@QwenAlphaRobot](https://t.me/QwenAlphaRobot) (бот)
- **GitHub Issues**: https://github.com/JeBance/QwenAlpha/issues

---

## 📝 Лицензия

[MIT License](LICENSE)

---

**Qwen Alpha v2.0** — универсальная платформа для создания AI-консультантов! 🚀
