-- ============================================================================
-- ScatterBlitz PostgreSQL Database Schema (Local & Neon Cloud Compatible)
-- ============================================================================

-- Enable UUID extension if not already present
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    avatar_url TEXT DEFAULT NULL,
    refresh_tokens JSONB DEFAULT '[]'::jsonb,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for active users and soft-delete queries
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_username_active ON users (username) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- 2. GAMES (MATCHES) TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(64) PRIMARY KEY,
    room_code VARCHAR(100) NOT NULL,
    host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    categories JSONB NOT NULL DEFAULT '[]'::jsonb,
    max_players INT NOT NULL DEFAULT 8,
    max_time_per_round INT NOT NULL DEFAULT 60,
    total_rounds INT NOT NULL DEFAULT 0,
    -- Full snapshot of submissions: { Letter: { player: { category: { answer, score } } } }
    rounds_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_host_id ON games(host_id);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games(ended_at DESC);

-- ============================================================================
-- 3. GAME PLAYERS (MATCH RESULTS & LEADERBOARD STATS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS game_players (
    id BIGSERIAL PRIMARY KEY,
    game_id VARCHAR(64) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    -- Nullable for guest players or deleted accounts
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    player_name VARCHAR(100) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 1,
    is_winner BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_players_user_id ON game_players(user_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
-- Fast lookup for counting user wins on their profile & leaderboards
CREATE INDEX IF NOT EXISTS idx_game_players_wins ON game_players(user_id) WHERE is_winner = TRUE;
CREATE INDEX IF NOT EXISTS idx_game_players_user_winner ON game_players(user_id, is_winner);
