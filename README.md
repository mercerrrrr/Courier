# Courier Service

Система управления курьерскими доставками с микросервисной архитектурой.

## Структура проекта

- `backend/auth-service` - сервис авторизации и управления пользователями
- `backend/work-service` - сервис управления сменами курьеров
- `backend/orders-service` - сервис управления заказами
- `frontend` - React-приложение

## Быстрый старт

### Требования

- Node.js 16+
- PostgreSQL 16+

### Установка

1. Клонируйте репозиторий
```bash
git clone <repository-url>
cd Courier
```

2. Настройте PostgreSQL
```bash
# Создайте пользователя и базу данных
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE courier;"
```

3. Настройте переменные окружения

Скопируйте файлы `.env.example` в `.env` для каждого сервиса:
```bash
cp backend/auth-service/.env.example backend/auth-service/.env
cp backend/work-service/.env.example backend/work-service/.env
cp backend/orders-service/.env.example backend/orders-service/.env
```

4. Установите зависимости
```bash
# Backend services
cd backend/auth-service && npm install && cd ../..
cd backend/work-service && npm install && cd ../..
cd backend/orders-service && npm install && cd ../..

# Frontend
cd frontend && npm install && cd ..
```

5. Запустите сервисы

```bash
# Terminal 1 - Auth Service
cd backend/auth-service && node src/index.js

# Terminal 2 - Work Service
cd backend/work-service && node src/index.js

# Terminal 3 - Orders Service
cd backend/orders-service && node src/index.js

# Terminal 4 - Frontend
cd frontend && npm start
```

Приложение будет доступно на `http://localhost:3000`

## API Endpoints

### Auth Service (Port 4001)
- POST `/auth/register` - регистрация
- POST `/auth/login` - вход
- GET `/auth/me` - получить текущего пользователя
- PUT `/auth/profile` - обновить профиль (имя, аватар)

### Work Service (Port 4002)
- GET `/shifts/current` - получить текущую смену
- POST `/shifts/start` - начать смену
- POST `/shifts/end` - завершить смену

### Orders Service (Port 4003)
- GET `/orders/available` - доступные заказы
- GET `/orders/my` - мои заказы
- POST `/orders/:id/accept` - принять заказ
- POST `/orders/:id/complete` - завершить заказ

## Доступ по умолчанию

Администратор:
- Телефон: +79999999999
- Пароль: admin123

## Решение проблем

### Ошибка 404 при редактировании профиля

Убедитесь, что все backend сервисы запущены:
```bash
# Проверка auth-service
curl http://localhost:4001

# Проверка work-service
curl http://localhost:4002

# Проверка orders-service
curl http://localhost:4003
```

Если какой-то сервис не отвечает, запустите его заново.
