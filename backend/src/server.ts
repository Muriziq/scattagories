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
import jwt from "jsonwebtoken";
import { activeRooms } from "./model/gamesModel";
import { SocketAddress } from "net";
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

const allowedOrigins = [
  CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. Postman, curl, mobile apps, or server-to-server during testing)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Too many requests from this IP, please try again after 15 minutes.",
  },
});
// Middleware
app.use(generalLimiter);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/user", register);
app.use("/games", games);
app.use("/refresh", refresh);
app.get("/", (req, res) => {
  res.json({ message: "Conected to Scatterblitz Backend" });
});

// Socket.IO Setup
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
  user?: {
    id: string;
    username: string;
    email?: string;
    is_email_verified?: boolean;
  };
}
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.auth.token;
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN!) as {
      id: string;
      username: string;
      email?: string;
      is_email_verified?: boolean;
    };
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});
io.on("connection", (socket: AuthenticatedSocket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("room:join", (data: { roomId: string; password?: string }) => {
    const rawRoomId = data?.roomId;
    const password = data?.password || "";

    if (!socket.user) {
      return socket.emit("error", { message:"Unauthorized: Authentication required",type:"authorization"});
    }
    if (!rawRoomId) {
      return socket.emit("error", { message:"Room ID is required",type:"authorization"});
    }
    const roomId = rawRoomId.toUpperCase();
    for (const room of activeRooms.values()) {
      if (room.id === roomId) {
        continue;
      }
      if (room.participants.get(socket.user.id)) {
        return socket.emit("error", { message: "You are already in a room.", type: "change-room", roomID: room.id });
      }
    }

    const room = activeRooms.get(roomId);

    if (!room) {
      return socket.emit("error", { message:"Room not found or has expired.",type:"room"});
    }
    if (!room.isPublic && room.password != password) {
      return socket.emit("error", { message:"Incorrect Password",type:"password"});
    }

    let participant = room.participants.get(socket.user.id);
    if (!participant) {
      if (room.status !== "waiting") {
        return socket.emit("error", { message:"Game is already in progress.",type:"room"});
      }
      if (room.participants.size >= room.maxPlayers) {
        return socket.emit("error", { message:"Room is currently full.",type:"room"});
      }
      room.addParticipant(socket)
    } else {
      participant.socketId = socket.id;
      if(room.status !== "waiting" && room.status !== "ended"){
        socket.emit("game:started","Game Has Started")
      }
    }

    socket.join(roomId);

    io.to(roomId).emit("room:participants", room.getRoomParticipantsData());
  });

  socket.on("game:start", (roomID: string) => {

    if (!socket.user) {
      return socket.emit("error", { message:"Unauthorized: Authentication required",type:"authorization"});
    }
    const room = activeRooms.get(roomID);
    if (!room) {
      return socket.emit("error", { message:"Room not found or has expired.",type:"room"});
    }
    if (room.hostId !== socket.user.id) {
      return socket.emit("error", { message:"You are not the host of this room",type:"room"});
    }
    if (room.status !== "waiting") {
      return socket.emit("error", { message:"Game is already in progress.",type:"room"});
    }

    room.status = "letter_selection";
    room.calculateTotalRound();
    room.getNextUserTurn(io, socket);
    return io.to(roomID).emit("game:started","Game Has Started")
  });
  socket.on("game:join",(roomID: string)=>{
    
    if (!socket.user) {
      return socket.emit("error", { message:"Unauthorized: Authentication required",type:"authorization"});
    }

    const room = activeRooms.get(roomID);
    if (!room) {
      return socket.emit("error", { message:"Room not found or has expired.",type:"room"});
    }
    if (room.status === "waiting") {
      return socket.emit("error", {message:"Game is not started yet.",type:"not-started"});
    }
    if(room.status === "ended"){
      return socket.emit("error", { message: "Game has ended", type: "room" });
    }
    if (!room.participants.get(socket.user.id)) {
  return socket.emit("error", { message: "You are not a participant in this room.", type: "room" });
}

    socket.join(roomID);

    socket.emit("room:state",{
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
      hostUsername: room.getHostUsername(),
      maxPlayers: room.maxPlayers
    });
  })

  socket.on(
    "letter:select",
    ({ roomID, letter }: { roomID: string; letter: string }) => {
      if (!socket.user) {
        return socket.emit("error", "Unauthorized: Authentication required");
      }
      const room = activeRooms.get(roomID);
      const participant = room?.participants.get(socket.user.id);
      if (
        !participant ||
        participant.displayName !== room?.usersTurn ||
        room.status !== "letter_selection"
      )
        return socket.emit("error", "Not Your Turn.");
      room.setActiveLetter(letter, io, socket);
    },
  );

  socket.on("round:stop", (roomID: string) => {
    if (!socket.user) {
      return socket.emit("error", "Unauthorized: Authentication required");
    }

    const room = activeRooms.get(roomID);
    const participant = room?.participants.get(socket.user.id);

    if (
      !participant ||
      participant.displayName !== room?.usersTurn ||
      room?.status !== "active_sprint"
    )
      return socket.emit("error", "Not Your Turn.");

    room.startRecapTimer(io, socket);
    io.to(roomID).emit("round:ended", { reason: "stopped_by_player" });
  });

  socket.on(
    "answer:submit",
    ({
      roomID,
      answers,
    }: {
      roomID: string;
      answers: Record<string, string>;
    }) => {
      if (!socket.user) {
        return socket.emit("error", "Unauthorized: Authentication required");
      }
      const room = activeRooms.get(roomID);
      const participant = room?.participants.get(socket.user.id);
      if (!participant) return socket.emit("error", "Participant not found");
      if (room?.submitStatus === "notAccepting") {
        return socket.emit("error", "Submit Status Closed");
      }
      room?.saveAnswers(socket.user.id, answers, socket);
    },
  );

  socket.on("room:leave",(roomID: string)=>{

    const room = activeRooms.get(roomID);
    if(!room) return socket.emit("error","Room Not Found or Expired.")
    if (socket.user){
      room.removeParticipant(socket.user.id, io, socket);
    }
    socket.leave(roomID);
    io.to(roomID).emit("room:participants", room.getRoomParticipantsData());
  })
  
  socket.on("disconnect", () => {
    if (socket.user) {
      for (const room of activeRooms.values()) {
        const participant = room.participants.get(socket.user.id);
        if (participant && participant.socketId === socket.id) {
          participant.socketId = null;
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
