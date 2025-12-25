-- Создаём схему для auth-сервиса
CREATE SCHEMA IF NOT EXISTS auth;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS auth.users (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(32) NOT NULL UNIQUE,
    password_plain VARCHAR(255) NOT NULL,  -- ВНИМАНИЕ: только для учебного проекта, в реале так нельзя
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'courier', -- 'courier' или 'admin'
    avatar_url TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
