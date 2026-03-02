# 🚀 Инструкция по публикации и запуску Qwen Alpha

## ✅ Чек-лист перед публикацией

- [ ] Все зависимости установлены (`npm install`)
- [ ] Тесты проходят (`npm test`)
- [ ] Линтинг проходит (`npm run lint`)
- [ ] README.md актуален
- [ ] Version в package.json обновлён

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
tar -tzf qwen-alpha-1.0.0.tgz
```

### 3. Публикация

```bash
# Публикация стабильной версии
npm publish

# Публикация beta версии (не затронет latest)
npm publish --tag beta
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
npm install -g qwen-alpha
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

## 🔄 Обновление версии

### SemVer (Semantic Versioning)

```
MAJOR.MINOR.PATCH
  │     │     │
  │     │     └─ обратно совместимые исправления
  │     └─────── обратно совместимые новые функции
  └───────────── ломающие изменения
```

### Команды для обновления версии

```bash
# Исправление багов (1.0.0 → 1.0.1)
npm version patch

# Новые функции (1.0.0 → 1.1.0)
npm version minor

# Ломающие изменения (1.0.0 → 2.0.0)
npm version major

# Pre-release версии (1.0.0 → 1.0.1-beta.0)
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

### Через Docker (пример)

```dockerfile
FROM node:18-alpine
RUN npm install -g qwen-alpha @qwen-code/qwen-code
CMD ["qwen-alpha", "--token", "$BOT_TOKEN"]
```

---

## 🎯 Следующие шаги после публикации

1. **Добавить бота в Telegram**
   - Откройте https://t.me/BotFather
   - Создайте нового бота если ещё не создан
   - Получите токен

2. **Настроить бота**
   - Установите аватар (логотип)
   - Настройте description и about

3. **Протестировать функционал**
   - `/start` — приветствие
   - `/help` — справка
   - Отправить код на анализ

4. **Добавить в группы** (опционально)
   - Добавьте бота в группу
   - Проверьте работу `/qwen` команд

5. **Мониторинг**
   - Следите за логами в `~/.qwen-alpha/logs/`
   - Проверяйте `/admin stats`

---

**Удачи с публикацией! 🚀**
