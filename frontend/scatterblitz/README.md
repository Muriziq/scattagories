# ScatterBlitz — Frontend Client Setup & Architecture Guide

Welcome to the **ScatterBlitz** frontend repository. This application is a high-speed, real-time multiplayer word sprint platform built with **Next.js 16 (App Router), React 19, TypeScript, and Socket.IO Client**.

---

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation & Setup](#installation--setup)
3. [Environment Configuration](#environment-configuration)
4. [Running the Application](#running-the-application)
5. [Project & Folder Structure](#project--folder-structure)
6. [Key Features & Architecture](#key-features--architecture)
7. [Scripts Reference](#scripts-reference)
8. [Troubleshooting](#troubleshooting)
9. [Proprietary Notice](#proprietary-notice)

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed on your machine:
- **Node.js**: `v20.x` or higher (Node 22 LTS recommended)
- **Package Manager**: `npm` (v10+), `pnpm`, or `yarn`
- **Backend Server**: The ScatterBlitz backend API and Socket.IO server running locally (typically on `http://localhost:5000`) or on a hosted staging environment.

---

## 🚀 Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd scattagories/frontend/scatterblitz
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

---

## ⚙️ Environment Configuration

The frontend connects to the backend API via environment variables or the central configuration located at `src/config/api.ts`.

Create a `.env.local` file in `frontend/scatterblitz`:

```env
# URL where your backend Express & Socket.IO server is running
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

> **Note on Fallback:** If `NEXT_PUBLIC_API_BASE_URL` is omitted, `src/config/api.ts` defaults to `http://localhost:5000` during local development and connects to the production Render server when deployed.

---

## 💻 Running the Application

### Development Mode (with Turbopack / Fast Refresh)
```bash
npm run dev
```
Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

### Production Build
Test and verify the production build locally:
```bash
# 1. Type-check and compile the Next.js application
npm run build

# 2. Start the optimized production server
npm run start
```

---

## 📂 Project & Folder Structure

```
frontend/scatterblitz/
├── public/                 # Static public assets (icons, images)
├── src/
│   ├── config/
│   │   └── api.ts          # Central backend API and WebSocket endpoints
│   ├── app/
│   │   ├── layout.tsx      # Root HTML layout (Bree Serif, Fraunces fonts, CanvasBackground)
│   │   ├── page.tsx        # Landing page (hero, quick-join, rules, leaderboard preview)
│   │   ├── globals.css     # Design tokens, color palette, 3D buttons, canvas rules
│   │   ├── accessToken.ts  # In-memory access token storage, refresh interceptor & guest tokens
│   │   ├── loading.tsx     # Animated arena loading view with progress indicator
│   │   ├── not-found.tsx   # Custom 404 screen
│   │   ├── credits/        # Attributions for datasets (PokéAPI, ISO languages, periodic table)
│   │   ├── privacy/        # Privacy Policy disclosures (GDPR / NDPR / CCPA)
│   │   ├── terms/          # Terms of Service & player conduct guidelines
│   │   ├── components/     # Reusable components (CanvasBackground, Toast notification system)
│   │   ├── games/
│   │   │   ├── create/     # Host Game Room (categories, rules, max players, password)
│   │   │   ├── join/       # Public Lobby Discovery (debounced search, category filters)
│   │   │   └── [waitingRoom]/
│   │   │       ├── page.tsx          # Waiting lobby (player roster, share link, host start)
│   │   │       ├── SocketContext.tsx # WebSocket provider for room-scoped events
│   │   │       └── game/page.tsx     # Active game board (letter selection, sprint, recap, review)
│   │   └── user/
│   │       ├── login/          # Email/username authentication
│   │       ├── register/       # User registration with email verification
│   │       ├── profile/        # Player stats, match history, inspect rounds & avatar upload
│   │       ├── convert-guest/  # Guest-to-permanent account upgrade
│   │       └── forgot-password/# Self-service password recovery flow
├── package.json
└── tsconfig.json
```

---

## 🌟 Key Features & Architecture

- **In-Memory JWT & Session Rotation:** Access tokens are kept securely in memory (`accessToken.ts`) with silent token refreshing through HTTP-only refresh cookies.
- **WebSocket Synchronization (`SocketContext`):** Connects to the backend Socket.IO instance and dispatches room updates, turn changes, live letter selection, and round recaps.
- **Conic-Gradient Radial Sweep Timer:** Custom CSS `@property --timerProgress` animation providing a stopwatch sweep without layout shift.
- **Client-Side Anti-Cheat Telemetry:** Tracks paste attempts and window blur events to enforce fair human typing.
- **State Caching & Idempotency:**
  - Debounced (`300ms`) public lobby search to prevent network request spam.
  - Inspected match details are cached in local component state to prevent duplicate network round-trips.
  - Buttons are disabled while asynchronous actions are in-flight.

---

## 📜 Scripts Reference

- `npm run dev`: Starts the Next.js development server on port 3000.
- `npm run build`: Generates the production bundle with static optimization.
- `npm run start`: Launches the compiled production application.
- `npm run lint`: Runs ESLint to verify code quality and style standards.
- `npx tsc --noEmit`: Performs a full TypeScript compilation check without emitting files.

---

## 🔧 Troubleshooting

1. **CORS / Network Error on Login or Room Creation:**
   - Ensure the backend is running on `http://localhost:5000`.
   - Check that the backend's allowed origins in `corsOptions` include `http://localhost:3000`.
2. **Socket Disconnections:**
   - Confirm your JWT access token or guest token exists in memory.
   - The backend enforces a 30-second grace window for page reloads before timing out a player.
3. **Number Inputs Showing Leading Zeros:**
   - Handled natively in `create/page.tsx` through string-compatible state parsing to allow clean backspacing.

---

## 🔒 Proprietary Notice

```
Copyright (c) 2026 ScatterBlitz. All rights reserved.
```

**ScatterBlitz is proprietary software. It is NOT open source.**
No permission is granted to reproduce, distribute, or reverse-engineer this codebase without prior written consent.
