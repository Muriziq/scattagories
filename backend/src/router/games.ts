import express, { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pool from "../db";
import { verifyTokens, AuthRequest } from "../middleware/tokens";
import { GameRoom, activeRooms } from "../model/gamesModel";
import crypto from "crypto";

dotenv.config();
const router = Router();
const generateRoomCode = () => crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
const availabeCategories: string[] = ["Animals","Countries","States"]
// Zod Schema for Creating a Room
const createRoomSchema = z.object({
  isPublic: z.boolean(),
  password: z.string().optional().nullable(),
  maxPlayers: z.number().min(2).max(10).default(5),
  maxTimePerRound: z.number().min(10).max(120).default(60),
  categories: z.array(z.string().min(1)).min(1, "At least one category is required"),
}).refine((data) => data.isPublic || (!data.isPublic && typeof data.password === "string" && data.password.trim() !== ""), {
  message: "Private rooms must have a password.",
  path: ["password"],
});

// Zod Schema for Joining a Room
const joinRoomSchema = z.object({
  roomId: z.string().length(5, "Room code must be exactly 5 characters"),
  password: z.string().optional().nullable(),
});

router.post("/room/create", verifyTokens, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Validate the input using Zod
    const validation = createRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.format() });
    }

    const { isPublic, password, maxPlayers, maxTimePerRound, categories } = validation.data;
    
    if(!req.user) return res.status(400).json({message:"No User"})

    const hostId = req.user.username; 

    // 2. Generate unique 5-letter code
    let roomId = generateRoomCode();
    while (activeRooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    // 3. Hash the password if the room is private
    let hashedPassword = null;

    if (!isPublic && password) {

      hashedPassword = await bcrypt.hash(password, 10);
    }

    // 4. Instantiate the new GameRoom
    const newRoom = new GameRoom(
      roomId,
      hostId,
      maxPlayers,
      maxTimePerRound,
      hashedPassword,
      isPublic,
      categories
    );

    activeRooms.set(roomId, newRoom);

    return res.status(201).json({ message: "Room created", roomId });

  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


router.get("/rooms/public", (req: Request, res: Response) => {
  try {
    const publicLobbies: any[] = [];

    activeRooms.forEach((room, roomId) => {
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

    // Frontend will handle the sorting!
    return res.status(200).json({ rooms: publicLobbies });
  } catch (error) {
    console.error("Error fetching public rooms:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


router.post("/room/join", verifyTokens, async (req: AuthRequest, res: Response) => {
  try {
    // 1. Validate the input using Zod
    const validation = joinRoomSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ errors: validation.error.format() });
    }

    const { roomId, password } = validation.data;
    const formattedRoomId = roomId.toUpperCase();

    // 2. Check memory
    const room = activeRooms.get(formattedRoomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found or has expired." });
    }

    // 3. Status and Capacity Checks
    if (room.status !== "waiting") {
      return res.status(403).json({ message: "Game is already in progress." });
    }
    if (room.participants.size >= room.maxPlayers) {
      return res.status(403).json({ message: "Room is currently full." });
    }

    // 4. Password validation for private rooms
    if (!room.isPublic) {
      if (!password) {
        return res.status(401).json({ message: "Password required." });
      }
      const isMatch = await bcrypt.compare(password, room.password!);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect password." });
      }
    }
    if(!req.user) return res.status(400).json({message:"No User"})
    room.participants.set(req.user.username, {
      socketId: "", // This will be set when the user connects via WebSocket
      dbId: null,
      displayName: req.user.username,
      score: 0,
    });

    return res.status(200).json({ message: "Access granted", roomId: room.id });

  } catch (error) {
    console.error("Error joining room:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router 