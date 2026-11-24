# ScatterBlitz

**ScatterBlitz** is a high-speed, real-time multiplayer word sprint game inspired by Scattergories. Built for intense vocabulary showdowns, the platform pairs real-time WebSocket room synchronization with high-precision validation, automated scoring, interactive round recaps, guest session conversion, and responsive mobile-first gameplay.

---

## ⚡ Core Features

### 🎮 Real-Time Multiplayer Gameplay
- **Bijective 5-Character Room Codes:** Collision-free 5-character lobby codes (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) generated through prime permutation arithmetic with zero collision retry loops.
- **Dynamic Letter Selection:** Turn-based letter picking with a countdown timer or randomized computer assistance.
- **Sprint Phase & Stopwatch Countdown:** Real-time round timer featuring a progressive 360° circular conic-gradient sweep.
- **Instant Category Scoring:** Submissions are validated in nanoseconds using memory-mapped alphabet-indexed dictionary sets (5 points for unique words, 2 points for shared words).
- **Interactive Recap & Skip Votes:** Players can inspect round-by-round point allocations and vote to skip the recap cooldown early.
- **Anti-Cheat Telemetry:** Paste-attempt detection, tab blur monitoring, and input latency tracking to prevent automated copying.
- **Seamless Reconnection & Grace Period:** 30-second disconnect grace window with automatic forfeit warnings and state restoration.

### 🛡️ Authentication & User Accounts
- **Dual Session Model:** Play instantly as a guest or create a permanent account with password hashing (`bcryptjs`).
- **Guest-to-Account Conversion:** Preserve match history, high scores, and stats when upgrading a guest session to a registered account.
- **Session Security:** Segregated cryptographic JWT secrets (Access, Refresh, Email Verification, Guest, Password Reset) with HTTP-only cookies and device fingerprinting.
- **Avatar Upload Protection:** Memory-buffered image uploads to Cloudinary with dual MIME/extension filtering and **binary magic byte inspection** (JPEG, PNG, GIF, WebP) to prevent disguised executable payloads.
- **Multi-Tier Rate Limiting:** Dedicated rate limiters across general APIs (300/15min), authentication (15/15min), room creation (15/10min), avatar uploads (10/15min), and socket flood controls (30 events/sec).

### 🎨 Modern Responsive UI / UX
- **Glassmorphic Volcanic Aesthetic:** Styled with warm amber, safety orange, and sunset palettes over a global interactive canvas grid backdrop.
- **Bree Serif & Fraunces Typography:** Crisp typography hierarchy with Google Fonts integration.
- **Mobile Optimized:** Zero-overflow tables, touch-friendly buttons, responsive header typography, and dynamic viewport height handling (`100dvh`).

---

## 🛠️ Architecture & Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) & React 19
- **Animations:** Motion (`motion/react`)
- **Real-Time Client:** Socket.IO Client
- **Icons:** React Icons (`react-icons/fa`)
- **Styling:** CSS Modules with CSS Variables and Global 3D Button Components

### Backend
- **Runtime & Server:** Node.js, Express 5, TypeScript
- **Real-Time Engine:** Socket.IO Server
- **Database:** PostgreSQL (Connection Pooling via `pg`)
- **Validation:** Zod Schemas
- **Media Cloud:** Cloudinary Node SDK
- **Security:** `express-rate-limit`, `cookie-parser`, `cors`, `uuidv7`, `bcryptjs`

---

## 🌐 External Datasets & Attributions

ScatterBlitz ingests verified public knowledge bases for automated answer validation across diverse category decks:
- **Languages:** [ISO 639-3 Language Codes](https://raw.githubusercontent.com/maikudou/iso639-js/master/reference/iso639-3.json)
- **Pokémon:** [PokéAPI](https://pokeapi.co/)
- **Chemical Elements:** [Periodic Table API Dataset](https://raw.githubusercontent.com/neelpatel05/periodic-table-api/master/data.json)
- **Geography & Capitals:** Country State City Reference API
- **General Wordlists:** [Corpora Project](https://github.com/dariusk/corpora)

For a full list of software libraries and dataset licenses, visit the in-app **[Credits & Attributions](/credits)** page.

---

## 🔒 License & Proprietary Rights

```
Copyright (c) 2026 ScatterBlitz. All rights reserved.
```

**ScatterBlitz is proprietary software. It is NOT open source.**

No permission is granted to copy, modify, distribute, publish, sublicense, reverse-engineer, decompile, or sell any portion of this codebase or its proprietary game engine without express prior written consent from the copyright holders.
