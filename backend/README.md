# Scatterblitz — Backend Engine & API Documentation

Scatterblitz is a real-time multiplayer word sprint game inspired by Scattergories. Built with **Node.js, Express, TypeScript, PostgreSQL, and Socket.IO**, the backend orchestrates game rooms, bijective 5-character collision-free lobby codes, instant $O(1)$ dictionary scoring, session rotation with fingerprinting, and post-game persistence.

---

## Table of Contents
1. [Architecture & Engine Overview](#architecture--engine-overview)
2. [Environment Configuration](#environment-configuration)
3. [REST API Documentation](#rest-api-documentation)
   - [System & Health](#1-system--health-endpoints)
   - [Authentication & Users (`/user`)](#2-authentication--users-endpoints)
   - [Session Refresh (`/refresh`)](#3-session-refresh-endpoints)
   - [Game Rooms & Match History (`/games`)](#4-game-rooms--lobbies-endpoints)
4. [Socket.IO Real-Time Protocol](#socketio-real-time-protocol)
   - [Handshake & Authentication](#handshake--authentication)
   - [Client-to-Server Events](#client-to-server-events)
   - [Server-to-Client Events](#server-to-client-events)
5. [Free External APIs & Dataset Sources for Categories](#free-external-apis--dataset-sources-for-categories)

---

## Architecture & Engine Overview

* **Bijective Room Codes:** Generates collision-free 5-character room codes (`ROOM_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"`) with zero collision retry loops using full-period modulo arithmetic.
* **Separated Registry:** In-memory maps for `publicRooms` and `privateRooms` allow $O(1)$ lookups while cleanly isolating lobby discovery from private password-protected matches.
* **In-Memory $O(1)$ Answer Scoring:** Validates category submissions across alphabet-indexed Sets in nanoseconds (5 points for unique words, 2 points for shared words).
* **Multi-Layered Security:**
  * JWT segregation: separate secrets for access tokens, refresh tokens, email verification, password reset, and guest sessions.
  * Session rotation: device fingerprint tracking and SHA-256 token hashing with token reuse detection (`tokenSession.ts`).
  * Strict file upload validation: dual MIME type and file extension matching against allowed formats (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`) preventing Stored XSS.
  * Uniform forgot-password responses to mitigate user enumeration.
  * Automated unjoined room garbage collection with connection-cleared timers.

---

## Environment Configuration

Configuration variables located in `backend/.env`:

```env
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/scatterblitz
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scatterblitz

# Cryptographic Token Secrets
ACCESS_TOKEN=your_access_token_secret
REFRESH_TOKEN=your_refresh_token_secret
VERIFY_TOKEN=your_verify_token_secret
GUEST_TOKEN=your_guest_token_secret
RESET_PASSWORD_TOKEN=your_reset_password_secret

# Admin & Telemetry Secret
MONITORING_KEY=your_high_entropy_secret_key

# Outbound Email (Nodemailer SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

---

## REST API Documentation

### 1. System & Health Endpoints

#### `GET /`
Basic API availability greeting.
* **Response `200 OK`**:
```json
{
  "message": "Scatterblitz API is running. Check /health for database and system metrics."
}
```

#### `GET /health`
Public lightweight liveness probe for uptime monitors and load balancers (zero database load).
* **Response `200 OK`**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-29T23:15:00.000Z"
}
```

#### `GET /health/detailed`
Protected diagnostic endpoint exposing connection pool health, latency, memory usage, category cache stats, and live room count.
* **Headers**: `x-monitoring-key: <MONITORING_KEY>` (or `?key=<MONITORING_KEY>`)
* **Response `200 OK`**:
```json
{
  "status": "healthy",
  "timestamp": "2026-10-30T14:35:43.236Z",
  "uptimeSeconds": 7200,
  "database": {
    "status": "connected",
    "latencyMs": 15,
    "pool": {
      "totalClients": 3,
      "idleClients": 2,
      "waitingRequests": 0
    }
  },
  "activeRoomsCount": 4,
  "categories": {
    "isSyncInProgress": false,
    "lastUpdatedAt": "2026-10-30T14:36:17.479Z",
    "totalWords": 9364,
    "categoriesCount": 8,
    "categories": {
      "Countries": 250,
      "Capitals": 244,
      "Currencies": 315,
      "States": 4944,
      "Animals": 1332,
      "Food": 1136,
      "Pokemon": 1025,
      "Elements": 118
    }
  },
  "memory": {
    "rssMb": 86,
    "heapUsedMb": 22
  }
}
```
* **Error `403 Forbidden`**:
```json
{
  "message": "Forbidden: Invalid credentials"
}
```

#### `POST /health/sync-categories`
Protected administrative endpoint to trigger on-demand background category re-ingestion from public APIs without waiting for the automatic 30-day sync interval. Runs off the main event loop in an isolated background process and executes an atomic memory pointer swap upon completion ($0\text{ms}$ lag to active games).
* **Headers**: `x-monitoring-key: <MONITORING_KEY>` (or `?key=<MONITORING_KEY>`)
* **Response `200 OK`**:
```json
{
  "started": true,
  "message": "Background category synchronization initiated."
}
```
* **Response `409 Conflict`** (if a sync job is already currently running):
```json
{
  "started": false,
  "message": "Category synchronization is already in progress."
}
```

---

### 2. Authentication & Users Endpoints

Base path: `/user`

#### `POST /user/register`
Creates a new user account, sends verification email, and sets HTTP-only refresh token cookie.
* **Rate Limit:** 15 requests / 15 minutes
* **Request Body**:
```json
{
  "username": "blitzmaster",
  "email": "player@example.com",
  "password": "SecretPassword123"
}
```
* **Response `201 Created`**:
```json
{
  "user": {
    "id": "0192e123-4567-789a-bcde-f0123456789a",
    "username": "blitzmaster",
    "email": "player@example.com",
    "is_email_verified": false,
    "avatar_url": null
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Set-Cookie Header:** `refreshToken=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`

#### `POST /user/login`
Authenticates with username or email and issues a fresh session.
* **Rate Limit:** 15 requests / 15 minutes
* **Request Body**:
```json
{
  "identifier": "blitzmaster",
  "password": "SecretPassword123"
}
```
* **Response `200 OK`**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "0192e123-4567-789a-bcde-f0123456789a",
    "username": "blitzmaster",
    "email": "player@example.com",
    "is_email_verified": true,
    "avatar_url": "/uploads/avatars/avatar-123.png"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `GET /user/guest-login`
Issues an anonymous guest account with a temporary `GUEST_XXXXX` identifier without database overhead.
* **Response `200 OK`**:
```json
{
  "user": {
    "id": "0192e123-0000-789a-bcde-f0123456789a",
    "username": "GUEST_8F4A9",
    "role": "guest"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Set-Cookie Header:** `guestToken=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`

#### `POST /user/convert-guest`
Converts an active guest session into a permanent database user while preserving match history.
* **Cookie Required:** `guestToken=<token>`
* **Request Body**:
```json
{
  "username": "permanentPlayer",
  "email": "newuser@example.com",
  "password": "NewSecurePassword123"
}
```
* **Response `200 OK`**:
```json
{
  "message": "Guest account converted successfully! Please verify your email.",
  "user": {
    "id": "0192e123-0000-789a-bcde-f0123456789a",
    "username": "permanentplayer",
    "email": "newuser@example.com",
    "is_email_verified": false,
    "avatar_url": null
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `POST /user/logout`
Revokes the current refresh session and clears authentication cookies.
* **Response `200 OK`**:
```json
{
  "message": "Logged out successfully"
}
```

#### `POST /user/forgot-password`
Initiates password reset email (uniform response prevents account enumeration).
* **Rate Limit:** 15 requests / 15 minutes
* **Request Body**:
```json
{
  "email": "player@example.com"
}
```
* **Response `200 OK`**:
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

#### `POST /user/reset-password`
Resets password using the 15-minute verification token sent via email.
* **Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "BrandNewPassword123"
}
```
* **Response `200 OK`**:
```json
{
  "message": "Password reset successfully!"
}
```

#### `POST /user/sendVerification`
Resends the email confirmation link.
* **Request Body**:
```json
{
  "email": "player@example.com"
}
```
* **Response `200 OK`**:
```json
{
  "message": "Verification link sent successfully. Please check your inbox."
}
```

#### `POST /user/verify-email`
Validates verification token and marks user as verified in database.
* **Headers**: `Authorization: Bearer <verifyToken>`
* **Response `200 OK`**:
```json
{
  "message": "Email verified successfully"
}
```

#### `GET /user/profile`
Returns user account information and aggregate career statistics.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Response `200 OK`**:
```json
{
  "user": {
    "id": "0192e123-4567-789a-bcde-f0123456789a",
    "username": "blitzmaster",
    "email": "player@example.com",
    "is_email_verified": true,
    "avatar_url": "/uploads/avatars/avatar-123.png",
    "created_at": "2026-10-01T12:00:00.000Z"
  },
  "stats": {
    "totalGames": 42,
    "totalWins": 18,
    "winRate": 43,
    "highScore": 95,
    "averageScore": 64.2
  }
}
```

#### `GET /user/profile/matches`
Paginated match history for the authenticated user.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Query Parameters**:
  * `page` (default: `1`)
  * `limit` (default: `10`, max: `100`)
  * `onlyWins` (optional: `"true"` | `"false"`)
* **Response `200 OK`**:
```json
{
  "matches": [
    {
      "game_id": "0192e456-789a-bcde-f012-3456789abcde",
      "room_code": "8K2PA",
      "score": 85,
      "rank": 1,
      "is_winner": true,
      "categories": ["Countries", "Capitals", "Currencies"],
      "total_rounds": 6,
      "ended_at": "2026-10-28T19:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "hasMore": false
  }
}
```

#### `POST /user/profile/avatar`
Uploads profile picture (JPEG, PNG, WEBP, GIF up to 2MB).
* **Headers**: `Authorization: Bearer <accessToken>`
* **Form-Data**: `avatar: <binary image file>`
* **Response `200 OK`**:
```json
{
  "message": "Profile avatar updated successfully",
  "avatar_url": "/uploads/avatars/avatar-user-1730000000.png",
  "user": { ... },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### `PATCH /user/profile`
Updates username and/or email address.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Request Body**:
```json
{
  "username": "newUsername",
  "email": "newemail@example.com",
  "currentPassword": "Password123"
}
```
* **Response `200 OK`**:
```json
{
  "message": "Profile updated successfully",
  "user": { ... },
  "accessToken": "..."
}
```

#### `DELETE /user/delete`
Soft-deletes the user account and revokes active sessions.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Response `200 OK`**:
```json
{
  "message": "Account deleted successfully"
}
```

---

### 3. Session Refresh Endpoints

Base path: `/refresh`

#### `GET /refresh/`
Rotates the refresh token (or guest token), issues a fresh 1-hour access token, and detects reuse/theft.
* **Cookies Required:** `refreshToken=<token>` OR `guestToken=<token>`
* **Headers Optional:** `x-device-id: <uuid>`
* **Response `200 OK`**:
```json
{
  "user": {
    "id": "0192e123-4567-789a-bcde-f0123456789a",
    "username": "blitzmaster",
    "email": "player@example.com",
    "is_email_verified": true,
    "avatar_url": "/uploads/avatars/avatar-123.png"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
* **Set-Cookie Header:** `refreshToken=<newRotatedToken>; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
* **Error `401 Unauthorized`**:
```json
{
  "message": "Session expired or invalid. Please log in again."
}
```

---

### 4. Game Rooms & Lobbies Endpoints

Base path: `/games`

#### `GET /games/`
Returns the active standard categories available in the system.
* **Response `200 OK`**:
```json
{
  "categories": [
    "Countries",
    "Capitals",
    "Currencies",
    "States",
    "Animals",
    "Food",
    "Pokemon",
    "Elements"
  ]
}
```

#### `POST /games/room/create`
Initializes a new game lobby and registers creator as host.
* **Headers**: `Authorization: Bearer <accessToken>`
* **Rate Limit:** 15 rooms / 10 minutes
* **Request Body**:
```json
{
  "isPublic": true,
  "password": null,
  "maxPlayers": 5,
  "maxTimePerRound": 60,
  "categories": ["Countries", "Capitals", "Currencies"],
  "allowComputerHelper": true
}
```
* **Response `201 Created`**:
```json
{
  "message": "Room created",
  "roomId": "8K2PA"
}
```

#### `GET /games/rooms/public`
Browses active, joinable public lobbies with pagination and filtering.
* **Query Parameters**:
  * `search` (optional room code or host username filter)
  * `category` (optional category filter)
  * `page` (default: `1`)
  * `limit` (default: `20`, max: `50`)
* **Response `200 OK`**:
```json
{
  "rooms": [
    {
      "roomId": "8K2PA",
      "hostUsername": "blitzmaster",
      "playerCount": 2,
      "maxPlayers": 5,
      "createdAt": "2026-10-29T21:20:00.000Z",
      "categories": ["Countries", "Capitals", "Currencies"]
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### `GET /games/room/:roomId`
Inspects room status and player capacity prior to joining.
* **Response `200 OK`**:
```json
{
  "roomId": "8K2PA",
  "isPublic": true,
  "hasPassword": false,
  "status": "waiting",
  "playerCount": 2,
  "maxPlayers": 5,
  "hostUsername": "blitzmaster",
  "categories": ["Countries", "Capitals", "Currencies"]
}
```

#### `GET /games/leaderboard`
Global player rankings (cached in memory for 30 minutes with anti-stampede locks).
* **Response `200 OK`**:
```json
{
  "leaderboard": [
    {
      "id": "0192e123-4567-789a-bcde-f0123456789a",
      "username": "blitzmaster",
      "avatar_url": "/uploads/avatars/avatar-123.png",
      "matches_played": 50,
      "total_wins": 32,
      "total_score": 1420,
      "high_score": 98
    }
  ],
  "cached": true
}
```

---

## Socket.IO Real-Time Protocol

WebSocket endpoint: `ws://localhost:5000` (or `wss://api.yourdomain.com`)

### Handshake & Authentication
Connecting clients must supply the JWT token in `auth`:
```javascript
const socket = io("http://localhost:5000", {
  auth: {
    token: "<accessToken>"
  },
  withCredentials: true
});
```

---

### Client-to-Server Events

| Event Name | Expected Payload | Description |
| :--- | :--- | :--- |
| `room:join` | `{ roomId: string, password?: string }` | Enters a waiting room lobby. |
| `game:start` | `roomId: string` (or code string) | Host triggers match start. |
| `game:join` | `{ roomId: string, clientSendTime?: number }` | Re-syncs match state when switching to game view. |
| `letter:select` | `{ roomID: string, letter: string }` | Active player chooses the letter for the sprint. |
| `round:stop` | `roomID: string` | Active player finishes sprint early and triggers recap. |
| `answer:submit`| `{ roomID: string, answers: Record<string, string> }` | Flushes player category responses for validation. |
| `room:leave` | `roomID: string` | Explicitly departs the room. |

---

### Server-to-Client Events

#### 1. `room:participants`
Broadcast whenever players enter, leave, or scores update.
```json
{
  "participants": [
    {
      "username": "blitzmaster",
      "score": 15,
      "isHost": true,
      "hasLeft": false,
      "isConnected": true
    }
  ],
  "hostUsername": "blitzmaster",
  "categories": ["Countries", "Capitals", "Currencies"],
  "maxPlayers": 5,
  "allLetters": ["A", "B", "C", "D", "..."],
  "selectionTimeLimit": 15
}
```

#### 2. `game:started`
Broadcast when the host initiates the match.
```json
"Game Has Started"
```

#### 3. `turn:change`
Notifies players whose turn it is to pick a letter.
```json
{
  "usersTurn": "blitzmaster",
  "selectionTimeLimit": 15,
  "selectionStartTime": 1730240000000
}
```

#### 4. `letter:selected`
Triggered when a letter is picked and the round sprint begins.
```json
{
  "letter": "M",
  "round": 1,
  "roundStartTime": 1730240015000,
  "maxTimePerRound": 60
}
```

#### 5. `round:ended`
Notifies that the sprint clock expired or was stopped early by the active turn player.
```json
{
  "reason": "stopped_by_player"
}
```

#### 6. `round:recap`
Emitted at the end of a sprint with scored answers (5 pts for unique word, 2 pts for shared word, 0 for invalid).
```json
{
  "letter": "M",
  "round": 1,
  "scores": {
    "blitzmaster": {
      "Countries": { "answer": "Madagascar", "score": 5 },
      "Capitals": { "answer": "Madrid", "score": 2 },
      "Currencies": { "answer": "", "score": 0 }
    },
    "opponentPlayer": {
      "Countries": { "answer": "Mexico", "score": 5 },
      "Capitals": { "answer": "Madrid", "score": 2 },
      "Currencies": { "answer": "Moroccan Dirham", "score": 5 }
    }
  },
  "recapDuration": 6
}
```

#### 7. `game:ended`
Broadcast when rounds conclude. Persists match records and ranks to PostgreSQL.
```json
{
  "standings": [
    { "username": "opponentPlayer", "score": 24, "isHost": false },
    { "username": "blitzmaster", "score": 19, "isHost": true }
  ],
  "submissions": { ... }
}
```

#### 8. `room:state`
Full sync payload delivered to reconnecting or refreshing players.
```json
{
  "serverTime": 1730240020000,
  "clientSendTime": 1730240019950,
  "status": "active_sprint",
  "currentRound": 2,
  "totalRound": 6,
  "activeLetter": "B",
  "usersTurn": "opponentPlayer",
  "maxTimePerRound": 60,
  "selectionTimeLimit": 15,
  "selectionStartTime": 1730240005000,
  "roundStartTime": 1730240015000,
  "hostUsername": "blitzmaster",
  "maxPlayers": 5,
  "categories": ["Countries", "Capitals", "Currencies"],
  "availableLetters": ["A", "C", "D", "E", "..."],
  "allLetters": ["A", "B", "C", "D", "..."],
  "participants": [ ... ]
}
```

#### 9. `error`
Standardized error object sent to client.
```json
{
  "message": "You are already in a room.",
  "type": "change-room",
  "roomID": "7JK9P"
}
```

---

## Free External APIs & Dataset Sources for Categories

For building category expansion scripts via GitHub Actions or automated seeders:

| Category | API / Dataset Name | Free Endpoint / Repository | Auth / Key | Sample Content |
| :--- | :--- | :--- | :---: | :--- |
| **Animals** | **Corpora Common Animals** | `https://raw.githubusercontent.com/dariusk/corpora/master/data/animals/common.json` | None | `["aardvark", "alligator", "alpaca", ...]` |
| **Dog Breeds** | **Dog CEO API** | `https://dog.ceo/api/breeds/list/all` | None | `{ "message": { "beagle": [], "boxer": [] } }` |
| **Fruits & Veggies** | **Corpora Foods** | `https://raw.githubusercontent.com/dariusk/corpora/master/data/foods/fruits.json` | None | `["apple", "apricot", "avocado", "banana", ...]` |
| **Meals & Dishes** | **TheMealDB API** | `https://www.themealdb.com/api/json/v1/1/list.php?c=list` | None (Free `1`) | Beef, Breakfast, Chicken, Dessert, Pasta, Seafood |
| **Pokémon** | **PokéAPI** | `https://pokeapi.co/api/v2/pokemon?limit=1025` | None | `["bulbasaur", "charmander", "pikachu", ...]` |
| **Chemical Elements**| **Periodic Table JSON** | `https://raw.githubusercontent.com/Bowser-Dragon/Periodic-Table-JSON/master/PeriodicTableJSON.json` | None | Hydrogen, Helium, Lithium, Beryllium, Carbon |
| **Car Makes** | **NHTSA vPIC API** | `https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json` | None | Audi, BMW, Chevrolet, Ferrari, Ford, Honda |
| **Musical Instruments**| **Corpora Instruments** | `https://raw.githubusercontent.com/dariusk/corpora/master/data/music/instruments.json` | None | Accordion, Bagpipes, Cello, Drum, Flute, Guitar |
| **World Languages** | **REST Countries** | `https://restcountries.com/v3.1/all?fields=languages` | None | English, Spanish, Arabic, French, Mandarin |
| **Movie Titles** | **TMDB API** | `https://api.themoviedb.org/3/movie/popular` | Free Key | Title lists, popularity index, release dates |
