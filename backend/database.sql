CREATE DATABASE scatterblitz;

-- Connect to the new database
\c scatterblitz;

ALTER DATABASE scatterblitz SET TIMEZONE TO 'Africa/Lagos';
-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    refresh_token TEXT[] DEFAULT '{}',
    deleted_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
