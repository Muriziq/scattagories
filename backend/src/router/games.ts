import express, { Response, Router, Request } from "express";
import { z } from "zod";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import pool from "../db";
import { verifyAccessToken, AuthRequest } from "../middleware/tokens";
import { GameRoom, publicRooms, privateRooms, getRoom, getTotalRoomsCount, deleteRoom } from "../model/gamesModel";
import { getAvailableCategories, isCategoryAvailable } from "../services/categoryManager";
import crypto from "crypto";

dotenv.config();
const router = Router();

// Rate limiter for room creation to prevent memory spamming (15 rooms per 10 minutes)
const roomCreationLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many rooms created recently, please try again in a few minutes." },
});

// Unambiguous 32-character alphanumeric set (omits easily confused characters 0, O, 1, I)
const ROOM_CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Incremental sequence counter for rooms created during server lifetime
let roomSequence = 1;

// Bijective permutation mapping each increment of roomSequence to a unique, randomized 5-character string
// Guarantees zero collisions within a 33.5 million room cycle without needing retry loops
const generateUniqueRoomCode = (): string => {
  // Prime multiplier and offset create a pseudo-random permutation with full period modulo 33,554,432 (32^5)
  const n = (roomSequence * 104729 + 7919) % 33554432;
  roomSequence++;

  let val = n;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += ROOM_CODE_CHARS[val % 32];
    val = Math.floor(val / 32);
  }
  return code;
};

// Validation schema for room creation
const createRoomSchema = z
  .object({
    isPublic: z.boolean(),
    password: z.string().trim().optional().nullable(),
    maxPlayers: z.number().min(1).max(10).default(5),
    maxTimePerRound: z.number().min(5).max(120).default(60),
    categories: z
      .array(z.string())
      .min(1, "At least one category is required")
      .refine(
        (cats) => cats.every((c) => isCategoryAvailable(c)),
        { message: "One or more selected categories are not supported." }
      ),
    allowComputerHelper: z.boolean().default(true),
  })
  .refine(
    // Enforce password requirement when room is set to private
    (data) => data.isPublic || (!data.isPublic && typeof data.password === "string" && data.password.trim() !== ""),
    {
      message: "Private rooms must have a password.",
      path: ["password"],
    }
  );

// Validation schema for joining a room
const joinRoomSchema = z.object({
  roomId: z.string().length(5, "Room code must be exactly 5 characters"),
  password: z.string().optional().nullable(),
});

// Returns the list of standard game categories available for selection
router.get("/", (req: Request, res: Response) => {
  return res.status(200).json({ categories: getAvailableCategories() });
});

// 1. CREATE ROOM: Initializes an in-memory game room and assigns creator as host (rate-limited)
router.post("/room/create", verifyAccessToken, roomCreationLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      const firstIssue = validation.error.issues[0]?.message || "Invalid room configuration";
      return res.status(400).json({ message: firstIssue });
    }

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const hostId = req.user.id;
    const hostUsername = req.user.username;
    const hostAvatar = req.user.avatar_url || null;

    const { isPublic, password, maxPlayers, maxTimePerRound, categories, allowComputerHelper } = validation.data;

    // Reset counter if there are currently no active rooms
    if (getTotalRoomsCount() === 0 && roomSequence > 50) {
      roomSequence = 1;
    }

    // Instant, collision-free room code generated in O(1) time without retry loops
    const roomId = generateUniqueRoomCode();

    if (!isPublic && !password) {
      return res.status(400).json({ message: "Password is required for private games" });
    }

    const newRoom = new GameRoom(
      roomId,
      hostUsername,
      hostId,
      maxPlayers,
      maxTimePerRound,
      password,
      isPublic,
      categories,
      allowComputerHelper
    );

    // Register host as the first participant keyed by username
    newRoom.participants.set(hostUsername, {
      score: 0,
      avatar_url: hostAvatar,
      isConnected: true,
      hasLeft: false,
    });

    // Store into the appropriate map based on room privacy
    if (isPublic) {
      publicRooms.set(roomId, newRoom);
    } else {
      privateRooms.set(roomId, newRoom);
    }

    // Auto-expire room after 30 minutes if host never connects via socket or starts game
    newRoom.connectionTimeout = setTimeout(() => {
      if (newRoom.status === "waiting") {
        console.log(`[Auto-Expire] Evicting unjoined room ${roomId} after 30m inactivity`);
        deleteRoom(roomId);
      }
    }, 30 * 60 * 1000);

    return res.status(201).json({ message: "Room created", roomId });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Validation schema for public lobby query parameters
const publicRoomsQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  categories: z.union([z.string(), z.array(z.string())]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// 2. GET PUBLIC ROOMS: Seamlessly browses publicRooms map with search filtering and pagination
router.get("/rooms/public", (req: Request, res: Response) => {
  try {
    const queryValidation = publicRoomsQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ message: "Invalid query parameters" });
    }

    const { search, category, categories, page, limit } = queryValidation.data;
    const searchFilter = search?.toLowerCase();

    // Normalize category filters into an array of lowercase strings
    const categoryFilters: string[] = [];
    if (categories) {
      const rawList = Array.isArray(categories) ? categories : categories.split(",");
      rawList.forEach((c) => {
        const trimmed = c.trim().toLowerCase();
        if (trimmed && !categoryFilters.includes(trimmed)) categoryFilters.push(trimmed);
      });
    } else if (category) {
      categoryFilters.push(category.trim().toLowerCase());
    }

    const matchingRooms: any[] = [];

    // Directly iterates over the dedicated publicRooms map
    for (const room of publicRooms.values()) {
      // Only include lobbies that are still waiting and have available slots
      if (room.status !== "waiting" || room.participants.size >= room.maxPlayers) {
        continue;
      }

      // Filter by room code or host username if search query is provided
      if (searchFilter) {
        const matchesCode = room.id.toLowerCase().includes(searchFilter);
        const hostName = room.hostUsername?.toLowerCase() || "";
        const matchesHost = hostName.includes(searchFilter);
        if (!matchesCode && !matchesHost) continue;
      }

      // Filter by categories if requested (room must have at least one of the selected categories)
      if (categoryFilters.length > 0) {
        const roomCatsLower = room.categories.map((c) => c.toLowerCase());
        const hasMatch = categoryFilters.some((f) => roomCatsLower.some((rc) => rc.includes(f)));
        if (!hasMatch) continue;
      }

      matchingRooms.push({
        roomId: room.id,
        hostUsername: room.hostUsername,
        playerCount: room.participants.size,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt,
        categories: room.categories,
      });
    }

    // Sort newest rooms first
    matchingRooms.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const totalCount = matchingRooms.length;
    const startIndex = (page - 1) * limit;
    const paginatedRooms = matchingRooms.slice(startIndex, startIndex + limit);

    return res.status(200).json({
      rooms: paginatedRooms,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ============================================================================
// IN-MEMORY CACHE FOR LEADERBOARD
// Avoids hammering PostgreSQL whenever visitors load the landing page
// ============================================================================
const LEADERBOARD_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
let cachedLeaderboard: any[] | null = null;
let lastLeaderboardFetchTime = 0;
let leaderboardInFlightPromise: Promise<any[]> | null = null;

// Helper to update a single user's stats in the cached leaderboard without full invalidation
export function updateCachedLeaderboardUser(userStats: {
  username: string;
  avatar_url: string | null;
  total_games: number;
  total_wins: number;
  total_score?: number;
  high_score: number;
}) {
  // If no cache exists yet or an initial fetch is in-flight, let the full fetch complete naturally
  if (!cachedLeaderboard || leaderboardInFlightPromise) return;

  const existingIndex = cachedLeaderboard.findIndex((entry) => entry.username === userStats.username);

  if (existingIndex !== -1) {
    // Update existing entry with latest stats
    const currentEntry = cachedLeaderboard[existingIndex];
    cachedLeaderboard[existingIndex] = {
      ...currentEntry,
      username: userStats.username,
      avatar_url: userStats.avatar_url,
      matches_played: userStats.total_games,
      total_wins: userStats.total_wins,
      high_score: userStats.high_score,
      total_score: userStats.total_score !== undefined ? userStats.total_score : currentEntry.total_score,
    };
  } else {
    // Check if this user qualifies for the top 20 list
    const lowestEntry = cachedLeaderboard[cachedLeaderboard.length - 1];
    const candidateScore = userStats.total_score || 0;
    const qualifies =
      cachedLeaderboard.length < 20 ||
      (lowestEntry &&
        (userStats.total_wins > lowestEntry.total_wins ||
          (userStats.total_wins === lowestEntry.total_wins && candidateScore > lowestEntry.total_score)));

    if (!qualifies) {
      return;
    }

    cachedLeaderboard.push({
      username: userStats.username,
      avatar_url: userStats.avatar_url,
      matches_played: userStats.total_games,
      total_wins: userStats.total_wins,
      total_score: candidateScore,
      high_score: userStats.high_score,
    });
  }

  // Re-sort top 20 by wins, then total score
  cachedLeaderboard.sort((a, b) => {
    if (b.total_wins !== a.total_wins) return b.total_wins - a.total_wins;
    return b.total_score - a.total_score;
  });

  if (cachedLeaderboard.length > 20) {
    cachedLeaderboard = cachedLeaderboard.slice(0, 20);
  }
}

// 4. GET GLOBAL LEADERBOARD: Returns top players ranked by wins and total score (Cached for 30m)
router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const now = Date.now();

    // 1. Serve from in-memory cache if within the 30-minute window
    if (cachedLeaderboard && now - lastLeaderboardFetchTime < LEADERBOARD_CACHE_TTL_MS) {
      return res.status(200).json({ leaderboard: cachedLeaderboard, cached: true });
    }

    // 2. Prevent cache stampede if multiple requests arrive right as cache expires
    if (!leaderboardInFlightPromise) {
      leaderboardInFlightPromise = (async () => {
        const leaderboardQuery = `
          SELECT 
            u.username,
            u.avatar_url,
            COUNT(gp.id)::int AS matches_played,
            COALESCE(SUM(CASE WHEN gp.is_winner = TRUE THEN 1 ELSE 0 END), 0)::int AS total_wins,
            COALESCE(SUM(gp.score), 0)::int AS total_score,
            COALESCE(MAX(gp.score), 0)::int AS high_score
          FROM users u
          JOIN game_players gp ON gp.user_id = u.id
          WHERE u.deleted_at IS NULL
          GROUP BY u.id
          ORDER BY total_wins DESC, total_score DESC
          LIMIT 20;
        `;
        const result = await pool.query(leaderboardQuery);
        cachedLeaderboard = result.rows;
        lastLeaderboardFetchTime = Date.now();
        return result.rows;
      })().finally(() => {
        leaderboardInFlightPromise = null;
      });
    }

    const leaderboardData = await leaderboardInFlightPromise;
    return res.status(200).json({ leaderboard: leaderboardData, cached: false });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    // If DB is temporarily unavailable but we have previously cached data, fallback to it gracefully
    if (cachedLeaderboard) {
      return res.status(200).json({ leaderboard: cachedLeaderboard, cached: true, degraded: true });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;