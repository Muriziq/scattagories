import express, { Response, Router, Request } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { verifyAccessToken, AuthRequest } from "../middleware/tokens";
import { GameRoom, activeRooms } from "../model/gamesModel";
import crypto from "crypto";

dotenv.config();
const router = Router();

const generateRoomCode = () => crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);

// Zod Schema for Creating a Room
const createRoomSchema = z
  .object({
    isPublic: z.boolean(),
    password: z.string().optional().nullable(),
    maxPlayers: z.number().min(2).max(10).default(5),
    maxTimePerRound: z.number().min(10).max(120).default(60),
    categories: z.array(z.string().min(1).max(50)).min(1, "At least one category is required"),
  })
  .refine(
    (data) => data.isPublic || (!data.isPublic && typeof data.password === "string" && data.password.trim() !== ""),
    {
      message: "Private rooms must have a password.",
      path: ["password"],
    }
  );

// Zod Schema for Joining a Room
const joinRoomSchema = z.object({
  roomId: z.string().length(5, "Room code must be exactly 5 characters"),
  password: z.string().optional().nullable(),
});

// 1. CREATE ROOM
router.post("/room/create", verifyAccessToken, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.format() });
    }

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const hostId = req.user.id;

    // Check if user is already hosting or participating in an active room
    for (const room of activeRooms.values()) {
      if (room.hostId === hostId) {
        return res.status(400).json({ message: "You are already hosting a room", roomId: room.id });
      }
      if (room.participants.has(hostId)) {
        return res.status(400).json({ message: "You are already in a room", roomId: room.id });
      }
    }

    const { isPublic, password, maxPlayers, maxTimePerRound, categories } = validation.data;

    // Generate unique 5-letter code
    let roomId = generateRoomCode();
    while (activeRooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    // Hash password for private rooms
    let hashedPassword = null;
    if (!isPublic) {
      if (!password) return res.status(400).json({ message: "Password is required for private games" });
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Instantiate new GameRoom
    const newRoom = new GameRoom(
      roomId,
      hostId,
      maxPlayers,
      maxTimePerRound,
      hashedPassword,
      isPublic,
      categories
    );

    // Automatically add host as the first participant
    newRoom.participants.set(hostId, {
      socketId: "",
      dbId: hostId,
      displayName: req.user.username,
      score: 0,
    });

    activeRooms.set(roomId, newRoom);

    return res.status(201).json({ message: "Room created", roomId });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// 2. GET PUBLIC ROOMS
router.get("/rooms/public", (req: Request, res: Response) => {
  try {
    const publicLobbies: any[] = [];

    activeRooms.forEach((room) => {
      if (room.isPublic && room.status === "waiting" && room.participants.size < room.maxPlayers) {
        publicLobbies.push({
          roomId: room.id,
          hostId: room.hostId,
          playerCount: room.participants.size,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt,
        });
      }
    });

    return res.status(200).json({ rooms: publicLobbies });
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


export default router;