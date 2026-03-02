# 🚀 Инструкция по публикации и запуску Qwen Alpha v2.0

## ✅ Чек-лист перед публикацией

- [ ] Все зависимости установлены (`npm install`)
- [ ] Тесты проходят (`npm test`)
- [ ] Линтинг проходит (`npm run lint`)
- [ ] Форматирование в порядке (`npm run format:check`)
- [ ] README.md актуален
- [ ] CHANGELOG.md обновлён
- [ ] Version в package.json обновлён (2.0.0)
- [ ] .env.example актуален

---

## 📦 Публикация на npm

### 1. Логин в npm

```bash
npm login
```

Введите ваш логин, пароль и email.

### 2. Проверка пакета перед публикацией

```bash
# Проверка package.json
npm pkg get

# Проверка файлов которые будут опубликованы
npm pack --dry-run

# Просмотр содержимого .tgz
tar -tzf qwen-alpha-2.0.0.tgz
```

### 3. Публикация

```bash
# Публикация стабильной версии
npm publish

# Публикация с тегом latest (явно)
npm publish --tag latest
```

### 4. Проверка публикации

```bash
# Проверка на npmjs.com
npm view qwen-alpha

# Или откройте https://www.npmjs.com/package/qwen-alpha
```

---

## 🧪 Тестирование после публикации

### 1. Глобальная установка

```bash
npm install -g qwen-alpha@2.0.0
```

### 2. Проверка CLI

```bash
qwen-alpha --version
qwen-alpha --help
```

### 3. Инициализация хранилищ

```bash
qwen-alpha --init-only
```

Проверьте что создалась папка `~/.qwen-alpha/`.

### 4. Запуск бота

```bash
qwen-alpha --token <YOUR_BOT_TOKEN>
```

---

## 🔄 Обновление версии (SemVer)

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ обратно совместимые исправления
  │     └─────── обратно совместимые новые функции
  └───────────── ломающие изменения
```

### Команды для обновления версии

```bash
# Исправление багов (2.0.0 → 2.0.1)
npm version patch

# Новые функции (2.0.0 → 2.1.0)
npm version minor

# Ломающие изменения (2.0.0 → 3.0.0)
npm version major

# Pre-release версии (2.0.0 → 2.0.1-beta.0)
npm version prerelease --preid=beta
```

После `npm version` автоматически обновится package.json и создастся git tag.

### Публикация новой версии

```bash
# Push коммита и тега
git push && git push --tags

# Публикация на npm
npm publish
```

---

## 🐛 Устранение проблем

### Ошибка "You cannot publish over the previously published versions"

Обновите версию:

```bash
npm version patch
npm publish
```

### Ошибка "npm ERR! 403 Forbidden"

Проверьте что вы залогинены и являетесь владельцем пакета:

```bash
npm whoami
npm owner ls qwen-alpha
```

### Ошибка "package.json name уже занят"

Измените name в package.json на уникальное название.

---

## 📊 Статистика npm

```bash
# Просмотр информации о пакете
npm view qwen-alpha

# Все версии
npm view qwen-alpha versions

# Зависимости
npm view qwen-alpha dependencies

# Количество загрузок
npm install -g npm-views
npm-views qwen-alpha
```

---

## 🔐 Безопасность

### Перед публикацией проверьте:

1. **Нет ли .env файлов в репозитории**

   ```bash
   git ls-files | grep .env
   ```

2. **Токен бота не в коде**
   - Токен передаётся только через CLI `--token`
   - Или через переменную окружения `BOT_TOKEN`

3. **npm audit**

   ```bash
   npm audit
   npm audit fix
   ```

4. **Проверка .gitignore**

   ```bash
   cat .gitignore
   ```

   Должны быть: `node_modules/`, `.env`, `*.log`, `~/.qwen-alpha/`

---

## 📝 Примеры использования

### Базовый запуск

```bash
qwen-alpha --token 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

### С логированием

```bash
qwen-alpha --token <TOKEN> --log-level debug
```

### С whitelist пользователей

```bash
qwen-alpha --token <TOKEN> --allowed-users 123456789,987654321
```

### Через переменную окружения

```bash
export BOT_TOKEN=your_token_here
qwen-alpha --token $BOT_TOKEN
```

---

## 🎯 Настройка v2.0 после установки

### 1. Первый запуск

```bash
qwen-alpha --token <TOKEN>
```

Бот автоматически:

- Инициализирует хранилище `~/.qwen-alpha/`
- Создаст системный промпт по умолчанию
- Зарегистрирует первого пользователя как супер-админа

### 2. Настройка системного промпта

В Telegram (супер-админ):

```
/setSystemPrompt Ты — консультант магазина электроники. Ассортимент: телевизоры, холодильники. Отвечай кратко.
```

### 3. Проверка промпта

```
/getSystemPrompt
```

### 4. Инструкции

```
/instructions
```

### 5. Добавление администраторов

```
/admin add <user_id>
```

---

## 📚 Документация v2.0

### Новые возможности

- **Системные промпты** — кастомизация поведения бота
- **Команда `/instructions`** — подробные инструкции
- **Система безопасности** — защита от опасных запросов
- **Фильтрация ответов** — скрытие чувствительной информации
- **HTML-форматирование** — стабильная работа с Telegram

### Сценарии использования

| Сценарий             | Пример промпта                                |
| -------------------- | --------------------------------------------- |
| Консультант магазина | `Ты — консультант магазина электроники...`    |
| Техподдержка         | `Ты — техподдержка CRM-системы...`            |
| Юридический бот      | `Ты — юридический консультант по праву РФ...` |
| AI-ассистент кода    | `Ты — AI-ассистент для работы с кодом...`     |

---

## 🔗 Ссылки

- **Репозиторий**: https://github.com/JeBance/QwenAlpha
- **NPM**: https://www.npmjs.com/package/qwen-alpha
- **Issues**: https://github.com/JeBance/QwenAlpha/issues
- **CHANGELOG**: https://github.com/JeBance/QwenAlpha/blob/main/CHANGELOG.md

---

**Удачи с публикацией v2.0! 🚀**
