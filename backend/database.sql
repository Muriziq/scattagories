CREATE DATABASE scatterblitz;

-- Connect to the new database
\c scatterblitz;

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    refresh_tokens JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index to optimize soft-delete filtering
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 2. GAMES (MATCHES) TABLE
-- ============================================================================
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(10) NOT NULL,
    host_id UUID REFERENCES users(id) ON DELETE SET NULL,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_players INT NOT NULL DEFAULT 8,
    max_time_per_round INT NOT NULL DEFAULT 60,
    total_rounds INT NOT NULL DEFAULT 0,
    -- Full snapshot of submissions: { Letter: { player: { category: { answer, score } } } }
    rounds_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_games_ended_at ON games(ended_at);

-- ============================================================================
-- 3. GAME PLAYERS (MATCH RESULTS & LEADERBOARD STATS)
-- ============================================================================
CREATE TABLE game_players (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    -- Nullable for guest players or deleted accounts
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    player_name VARCHAR(50) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 1,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_game_players_user_id ON game_players(user_id);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
-- Fast lookup for counting user wins on their profile
CREATE INDEX idx_game_players_wins ON game_players(user_id) WHERE is_winner = TRUE;
