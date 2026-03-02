# Qwen Alpha

[![CI](https://github.com/JeBance/QwenAlpha/actions/workflows/ci.yml/badge.svg)](https://github.com/JeBance/QwenAlpha/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/qwen-alpha.svg)](https://www.npmjs.com/package/qwen-alpha)
[![license](https://img.shields.io/npm/l/qwen-alpha.svg)](https://github.com/JeBance/QwenAlpha/blob/main/LICENSE)

**Telegram бот для работы с Qwen Code** — AI-powered code review, генерация кода и анализ прямо в Telegram.

---

## 🚀 Быстрый старт

### Установка

```bash
npm install -g qwen-alpha
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

## 📋 Возможности

### Для пользователей

| Функция              | Описание                                  |
| -------------------- | ----------------------------------------- |
| **Code Review**      | Анализ кода, поиск багов и уязвимостей    |
| **Генерация кода**   | Создание кода по описанию                 |
| **Объяснение кода**  | Подробное объяснение сложных участков     |
| **Рефакторинг**      | Улучшение читаемости и производительности |
| **Работа с файлами** | Анализ файлов с кодом (до 2MB)            |
| **Контекст диалога** | Бот помнит историю обсуждения             |

### Команды бота

| Команда     | Описание                   |
| ----------- | -------------------------- |
| `/start`    | Запуск бота и приветствие  |
| `/help`     | Список команд и информация |
| `/reset`    | Сброс текущей сессии       |
| `/stats`    | Статистика пользователя    |
| `/settings` | Настройки бота             |
| `/admin`    | Панель администратора      |

### Для групповых чатов

- **Начало сессии**: `/qwen <запрос>` или `@QwenAlphaRobot <запрос>`
- **Продолжение**: ответ (reply) на сообщение из сессии
- **Контекст**: бот помнит всю цепочку обсуждения
- **Изоляция**: каждая тема — отдельная сессия

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
QWEN_TIMEOUT=60000
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10
```

---

## 📁 Хранение данных

Данные хранятся в `~/.qwen-alpha/`:

```
~/.qwen-alpha/
├── db/
│   ├── users.json       # Пользователи
│   ├── sessions.json    # Сессии (24ч)
│   ├── admins.json      # Администраторы
│   └── stats.json       # Статистика
├── logs/
│   └── qwen-alpha-YYYY-MM-DD.log
└── config/
    └── settings.json    # Настройки бота
```

**Важно**: Данные не хранятся в node_modules и не затираются при обновлении.

---

## 🛡 Администрирование

### Первый запуск

Первый пользователь, запустивший `/start`, становится **супер-админом**.

### Админ команды

```bash
# Управление админами
/admin add <user_id>       # Добавить админа
/admin remove <user_id>    # Удалить админа

# Управление пользователями
/admin ban <user_id>       # Забанить
/admin unban <user_id>     # Разбанить

# Сессии
/admin sessions list       # Список сессий
/admin sessions clear <chat_id>  # Очистить чат

# Настройки
/admin set <key> <value>   # Изменить настройку
/admin settings            # Показать настройки

# Статистика
/admin stats               # Подробная статистика
```

### Настройки бота

| Настройка                    | По умолчанию | Описание                 |
| ---------------------------- | ------------ | ------------------------ |
| `session_timeout_hours`      | 24           | Срок жизни сессии (часы) |
| `max_file_size_mb`           | 2            | Макс. размер файла (MB)  |
| `requests_per_user_per_hour` | 60           | Лимит запросов/час       |
| `group_mode`                 | mention      | Режим в группах          |

---

## 🔧 Разработка

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

## 📊 Структура проекта

```
QwenAlpha/
├── bin/
│   └── qwen-alpha.js      # CLI entry point
├── src/
│   ├── index.js           # Основной экспорт
│   ├── bot/
│   │   ├── bot.js         # Telegraf инициализация
│   │   ├── handlers/      # Обработчики команд
│   │   └── middleware/    # Middleware
│   ├── services/
│   │   ├── db/            # JSON хранилище
│   │   └── qwenService.js # Qwen Code интеграция
│   ├── config/            # Конфигурация
│   └── utils/             # Утилиты
├── tests/                 # Тесты
├── .github/workflows/     # CI/CD
└── package.json
```

---

## 🐛 Решение проблем

### Qwen Code не установлен

```bash
npm install -g @qwen-code/qwen-code
```

### Ошибка "Bot token not specified"

Используйте `--token` или установите `BOT_TOKEN`:

```bash
export BOT_TOKEN=123456789:ABCdef...
qwen-alpha --token $BOT_TOKEN
```

### Ошибка доступа к хранилищу

Проверьте права на запись в `~/.qwen-alpha/`:

```bash
chmod -R 755 ~/.qwen-alpha/
```

### Бот не отвечает в группах

Проверьте, что бот добавлен в группу и имеет права на чтение сообщений.

---

## 📝 Лицензия

[MIT License](LICENSE)

---

## 🔗 Ссылки

- **Репозиторий**: https://github.com/JeBance/QwenAlpha
- **NPM**: https://www.npmjs.com/package/qwen-alpha
- **Qwen Code**: https://github.com/QwenLM/qwen-code
- **Telegraf**: https://telegraf.js.org/

---

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Отправьте в remote (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📞 Контакты

- **Telegram**: [@QwenAlphaRobot](https://t.me/QwenAlphaRobot) (бот)
- **GitHub**: https://github.com/JeBance/QwenAlpha/issues

---

**Qwen Alpha** — ваш AI ассистент для работы с кодом в Telegram! 🚀
