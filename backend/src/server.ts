import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import register from "./router/register";
import refresh from "./router/refresh";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import games from "./router/games";
import pool from "./db";
import { getRoom, publicRooms, privateRooms, getTotalRoomsCount } from "./model/gamesModel";
import { verifyAccessToken, UserPayload } from "./utils/jwt";

import path from "path";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Allowed origins for CORS in development and production
const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

// General API rate limiter (300 requests per 15 minutes for smooth UI navigation and search)
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests from this IP, please try again after 15 minutes.",
  },
});

// Middlewares
app.use(cors(corsOptions));
// Serve static uploads with browser cache headers (exempt from general rate limiter)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), { maxAge: "1d" }));
app.use(generalLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/user", register);
app.use("/games", games);
app.use("/refresh", refresh);

// 1. Public lightweight liveness probe (for uptime monitors & load balancers, zero DB load)
app.get("/health", (req, res) => {
  return res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

// 2. Protected diagnostics endpoint for admin & internal telemetry
app.get("/health/detailed", async (req, res) => {
  const monitoringKey = req.headers["x-monitoring-key"] || req.query.key;
  const configuredKey = process.env.MONITORING_KEY;

  if (!configuredKey || monitoringKey !== configuredKey) {
    return res.status(403).json({ message: "Forbidden: Invalid credentials" });
  }

  const startTime = Date.now();
  try {
    // Probe PostgreSQL connection and measure query response latency
    await pool.query("SELECT 1 AS healthy;");
    const dbLatencyMs = Date.now() - startTime;

    return res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: "connected",
        latencyMs: dbLatencyMs,
        pool: {
          totalClients: pool.totalCount,
          idleClients: pool.idleCount,
          waitingRequests: pool.waitingCount,
        },
      },
      activeRoomsCount: getTotalRoomsCount(),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    });
  } catch (error: any) {
    const dbLatencyMs = Date.now() - startTime;
    console.error("Health check failure:", error);
    return res.status(503).json({
      status: "degraded",
      timestamp: new Date().toISOString(),
      database: {
        status: "disconnected",
        latencyMs: dbLatencyMs,
      },
      activeRoomsCount: getTotalRoomsCount(),
    });
  }
});

// Root welcome route
app.get("/", (req, res) => {
  res.json({ message: "Scatterblitz API is running. Check /health for database and system metrics." });
});

// Global Express error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled express error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// Socket.IO Server Setup
export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

export interface AuthenticatedSocket extends Socket {
  user?: UserPayload;
}

// Socket authentication middleware: verifies JWT handshake token before establishing connection
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = verifyAccessToken<UserPayload>(token);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});

// Per-socket event rate tracker (mitigates socket event flood attacks: max 30 events/sec per connection)
const socketEventTracker = new Map<string, { count: number; resetTime: number }>();

// Socket.IO Connection and Game Event Handlers
io.on("connection", (socket: AuthenticatedSocket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Socket flood protection middleware: throttles rapid packet flooding
  socket.use(([event], next) => {
    const now = Date.now();
    let tracker = socketEventTracker.get(socket.id);

    if (!tracker || now > tracker.resetTime) {
      tracker = { count: 1, resetTime: now + 1000 };
      socketEventTracker.set(socket.id, tracker);
      return next();
    }

    tracker.count++;
    if (tracker.count > 30) {
      console.warn(`[Socket Throttled] Socket ${socket.id} exceeded event rate limit on '${event}'`);
      return socket.emit("error", { message: "Too many socket requests. Please slow down.", type: "rate-limit" });
    }

    next();
  });

  // Handles joining or re-joining a room lobby
  socket.on("room:join", (data: { roomId: string; password?: string }) => {
    const rawRoomId = data?.roomId;
    const password = data?.password || "";

    if (!socket.user) {
      return socket.emit("error", { message: "Unauthorized: Authentication required", type: "authorization" });
    }
    const username = socket.user.username;
    const requestedRoomId = rawRoomId ? rawRoomId.toUpperCase() : null;

    // Check if player is already occupying an active, un-ended room
    for (const room of [...publicRooms.values(), ...privateRooms.values()]) {
      if (requestedRoomId && room.id === requestedRoomId) continue;
      if (room.status === "ended") continue;
      const p = room.participants.get(username);
      if (p && !p.hasLeft) {
        return socket.emit("error", { message: "You are already in a room.", type: "change-room", roomID: room.id });
      }
    }

    if (!rawRoomId) {
      return socket.emit("error", { message: "Room ID is required", type: "authorization" });
    }

    const roomId = rawRoomId.toUpperCase();

    const room = getRoom(roomId);
    if (!room) {
      return socket.emit("error", { message: "Room not found or has expired.", type: "room" });
    }
    if (room.status === "ended") {
      return socket.emit("error", { message: "This game has already ended.", type: "room" });
    }
    if (!room.isPublic && room.password !== password) {
      return socket.emit("error", { message: "Incorrect Password", type: "password" });
    }

    let participant = room.participants.get(username);
    if (!participant) {
      // Reject new participants if game has already started or room is full
      if (room.status !== "waiting") {
        return socket.emit("error", { message: "Game is already in progress.", type: "room" });
      }
      if (room.participants.size >= room.maxPlayers) {
        return socket.emit("error", { message: "Room is currently full.", type: "room" });
      }
      room.addParticipant(socket);
    } else {
      // Reconnecting player: notify if game already began
      if (room.status !== "waiting") {
        socket.emit("game:started", "Game Has Started");
      }
    }

    // Clear unjoined room timeout once host socket connects
    if (socket.user.username === room.hostUsername) {
      room.clearConnectionTimeout();
    }

    socket.join(roomId);
    io.to(roomId).emit("room:participants", room.getRoomParticipantsData());
  });

  // Host starts the game from the waiting room lobby
  socket.on("game:start", (rawRoomId: string) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthorized: Authentication required", type: "authorization" });
    }
    const roomId = rawRoomId?.toUpperCase();
    const room = getRoom(roomId);
    if (!room) {
      return socket.emit("error", { message: "Room not found or has expired.", type: "room" });
    }
    if (room.hostUsername !== socket.user.username) {
      return socket.emit("error", { message: "You are not the host of this room", type: "room" });
    }
    if (room.status !== "waiting") {
      return socket.emit("error", { message: "Game is already in progress.", type: "room" });
    }

    room.status = "letter_selection";
    room.calculateTotalRound();
    room.getNextUserTurn(io, socket);
    return io.to(roomId).emit("game:started", "Game Has Started");
  });

  // Syncs room state for a player entering the live game screen
  socket.on("game:join", ({ roomId: rawRoomId, clientSendTime }: { roomId: string; clientSendTime?: number }) => {
    if (!socket.user) {
      return socket.emit("error", { message: "Unauthorized: Authentication required", type: "authorization" });
    }

    const roomId = rawRoomId?.toUpperCase();
    const room = getRoom(roomId);
    if (!room) {
      return socket.emit("error", { message: "Room not found or has expired.", type: "room" });
    }
    if (room.status === "waiting") {
      return socket.emit("error", { message: "Game is not started yet.", type: "not-started" });
    }
    if (room.status === "ended") {
      return socket.emit("error", { message: "Game has ended", type: "room" });
    }
    const participant = room.participants.get(socket.user.username);
    if (!participant) {
      return socket.emit("error", { message: "You are not a participant in this room.", type: "room" });
    }

    // Clear unjoined room timeout once host socket connects
    if (socket.user.username === room.hostUsername) {
      room.clearConnectionTimeout();
    }

    socket.join(roomId);

    socket.emit("room:state", {
      serverTime: Date.now(),
      clientSendTime,
      participants: room.getParticipantsList(),
      allLetters: room.getAllLetters(),
      availableLetters: room.availableLetters,
      categories: room.categories,
      currentRound: room.currentRound,
      totalRound: room.totalRound,
      usersTurn: room.usersTurn,
      activeLetter: room.activeLetter,
      status: room.status,
      maxTimePerRound: room.maxTimePerRound,
      selectionTimeLimit: room.selectionTimeLimit,
      selectionStartTime: room.selectionStartTime,
      roundStartTime: room.roundStartTime,
      hostUsername: room.hostUsername,
      maxPlayers: room.maxPlayers,
    });
  });

  // Handles active player picking a letter during letter_selection phase
  socket.on("letter:select", ({ roomID, letter }: { roomID: string; letter: string }) => {
    if (!socket.user) {
      return socket.emit("error", "Unauthorized: Authentication required");
    }
    const roomId = roomID?.toUpperCase();
    const room = getRoom(roomId);
    const participant = room?.participants.get(socket.user.username);
    if (
      !participant ||
      socket.user.username !== room?.usersTurn ||
      room.status !== "letter_selection"
    ) {
      return socket.emit("error", "Not Your Turn.");
    }
    room.setActiveLetter(letter, io, socket);
  });

  // Active player stops the round early during sprint
  socket.on("round:stop", (roomID: string) => {
    if (!socket.user) {
      return socket.emit("error", "Unauthorized: Authentication required");
    }

    const roomId = roomID?.toUpperCase();
    const room = getRoom(roomId);
    const participant = room?.participants.get(socket.user.username);

    const isTurnPlayer = socket.user.username === room?.usersTurn;
    const isComputerTurn = room?.usersTurn === "computer";

    if (
      !participant ||
      room?.status !== "active_sprint" ||
      (!isTurnPlayer && !isComputerTurn)
    ) {
      return socket.emit("error", "Not Your Turn.");
    }

    room.startRecapTimer(io, socket);
    io.to(roomId).emit("round:ended", { reason: "stopped_by_player" });
  });

  // Submits category answers for the active round
  socket.on("answer:submit", ({ roomID, answers }: { roomID: string; answers: Record<string, string> }) => {
    if (!socket.user) {
      return socket.emit("error", "Unauthorized: Authentication required");
    }
    const roomId = roomID?.toUpperCase();
    const room = getRoom(roomId);
    const participant = room?.participants.get(socket.user.username);
    if (!participant) return socket.emit("error", "Participant not found");
    room?.saveAnswers(socket.user.username, answers, socket);
  });

  // Explicitly leaves room and updates remaining participants
  socket.on("room:leave", (roomID: string) => {
    const roomId = roomID?.toUpperCase();
    const room = getRoom(roomId);
    if (!room) return socket.emit("error", "Room Not Found or Expired.");
    if (socket.user) {
      room.removeParticipant(socket.user.username, io, socket);
    }
    socket.leave(roomId);
    io.to(roomId).emit("room:participants", room.getRoomParticipantsData());
  });

  // Handles disconnect without disrupting active games or page refreshes
  socket.on("disconnect", () => {
    socketEventTracker.delete(socket.id);

    if (socket.user) {
      const username = socket.user.username;
      console.log(`Socket disconnected: ${username} (${socket.id})`);

      // Only clean up if participant was in a pre-game waiting lobby
      const allRooms = [...publicRooms.values(), ...privateRooms.values()];
      for (const room of allRooms) {
        if (room.status === "waiting" && room.participants.has(username)) {
          room.removeParticipant(username, io, socket);
          io.to(room.id).emit("room:participants", room.getRoomParticipantsData());
          break;
        }
      }
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
