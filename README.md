# Courier Ops

**Смены, заказы и контроль рабочего времени курьеров — в одном приложении.**

Веб-приложение с личным кабинетом курьера и панелью администратора. Курьер принимает заказы, отслеживает время работы и получает напоминания о перерывах. Администратор создаёт доставки и видит состояние смен команды.

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)

## Возможности

| Для курьера | Для администратора |
| --- | --- |
| Регистрация, вход и редактирование профиля | Создание заказов с адресом, оплатой и временем доставки |
| Начало и завершение смены, учёт работы и отдыха | Просмотр курьеров и состояния их смен |
| Принятие и завершение заказов | Просмотр заказов и их статусов |
| Напоминания о перерыве и риске переработки | Блокировка, разблокировка и удаление учётных записей |
| Карта доставки и открытие маршрута в Google Maps | Поиск адреса и выбор точки доставки на карте |

В интерфейсе есть настройки доступности: размер текста, высокая контрастность, уменьшение анимации, межстрочный интервал и крупные кнопки.

### Как устроен контроль смены

По умолчанию после **4 часов работы** предусмотрен **30-минутный перерыв**; после **9 рабочих часов** смена завершается, а начало новой блокируется на **6 часов**. Пороги настраиваются в [work-service](backend/work-service/src/config.js), события сохраняются в базе данных. Состояние пересчитывается при запросах к API — кабинет курьера обновляет его каждые 5 секунд.

## Технологии и архитектура

- **Frontend:** React 19, Bootstrap 5, React Bootstrap, Leaflet.
- **Backend:** Node.js, Express, REST API, JWT.
- **Данные:** PostgreSQL, SQL-запросы через `pg`.
- **Карты:** OpenStreetMap и Nominatim для поиска адресов, Google Maps для маршрута курьера; в API также реализован запрос маршрута через OSRM.

| Часть проекта | Назначение | Локальный порт |
| --- | --- | --- |
| [frontend](frontend) | Кабинеты курьера и администратора | `3000` |
| [auth-service](backend/auth-service) | Пользователи, авторизация и роли | `4001` |
| [work-service](backend/work-service) | Смены, перерывы и журнал событий | `4002` |
| [orders-service](backend/orders-service) | Заказы, поиск адресов и геоданные | `4003` |

Frontend обращается к трём отдельным HTTP-сервисам. Они используют **одну базу PostgreSQL** со схемами `auth`, `work` и `orders`: сервис смен обращается к данным пользователей из схемы `auth`.

## Локальный запуск

Понадобятся **Node.js 18+**, npm и PostgreSQL. Для карт и поиска адресов нужен интернет.

<details>
<summary>Установка и запуск</summary>

### 1. Скачать проект и создать базу

```bash
git clone https://github.com/mercerrrrr/Courier.git
cd Courier
createdb -U postgres courier
```

Базу `courier` также можно создать через pgAdmin. Таблицы и схемы сервисы создадут при первом запуске; пользователю PostgreSQL нужны соответствующие права.

### 2. Настроить окружение

В каждой из папок `backend/auth-service`, `backend/work-service` и `backend/orders-service` создайте файл `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/courier
JWT_SECRET=YOUR_LOCAL_JWT_SECRET
```

Подставьте пароль PostgreSQL и собственный секрет. Значения `DATABASE_URL` и `JWT_SECRET` должны совпадать во всех трёх сервисах.

В `backend/auth-service/.env` добавьте данные локального администратора:

```dotenv
ADMIN_PHONE=70000000000
ADMIN_PASSWORD=YOUR_LOCAL_ADMIN_PASSWORD
ADMIN_NAME=Admin
```

Эта учётная запись создаётся или обновляется при запуске `auth-service`.

Для демонстрации время работы и перерыва по умолчанию ускорено в **60 раз**: одна реальная минута соответствует часу на счётчике. Для обычного хода времени добавьте в `backend/work-service/.env`:

```dotenv
TIME_ACCELERATION_FACTOR=1
```

Пауза между сменами и блокировка после переработки отсчитываются в реальном времени.

### 3. Установить зависимости

Из корня проекта:

```bash
npm --prefix backend/auth-service install
npm --prefix backend/work-service install
npm --prefix backend/orders-service install
npm --prefix frontend ci
```

Для backend используется `npm install`: текущие `package-lock.json` расходятся с `package.json`, поэтому `npm ci` в этих папках завершится ошибкой. Установка обновит локальные lock-файлы.

### 4. Запустить приложение

Выполните каждую команду в отдельном терминале из корня проекта. Сначала дождитесь запуска `auth-service`, затем запустите остальные части:

```bash
npm --prefix backend/auth-service start
npm --prefix backend/work-service start
npm --prefix backend/orders-service start
npm --prefix frontend start
```

Откройте **[localhost:3000](http://localhost:3000)**. Войдите с данными администратора, чтобы создать заказ. Для кабинета курьера зарегистрируйте отдельную учётную запись, начните смену и примите заказ.

Адреса API заданы в [frontend/src/api.js](frontend/src/api.js). При изменении портов их нужно обновить; `orders-service` разрешает запросы браузера с `http://localhost:3000`.

</details>

## Статус проекта

Учебный проект для демонстрации fullstack-разработки: разделение backend на сервисы, работа с PostgreSQL, авторизация по ролям и интеграция карт. Текущая версия хранит пароли в открытом виде и предназначена для локальной демонстрации с тестовыми данными.

---

Автор: [@mercerrrrr](https://github.com/mercerrrrr)
