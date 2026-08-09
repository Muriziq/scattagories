import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import register from "./router/register"
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser"
import games from "./router/games"
import jwt from "jsonwebtoken";
import {activeRooms} from "./model/gamesModel"
dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const allowedOrigins = [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. Postman, curl, mobile apps, or server-to-server during testing)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests from this IP, please try again after 15 minutes." },
});
// Middleware
app.use(generalLimiter);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())
app.use("/user",register)
app.use("/games",games)
app.get("/",(req,res)=>{
    res.json({"message":"Conected to Scatterblitz Backend"})
})

// Socket.IO Setup
export const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join-room",(roomId)=>{
cookieParser()(socket.request as any,{} as any,(err)=>{
  if(err) return socket.emit("error","Unexpected error")
  const token = (socket.request as any ).cookies.accessToken
  if(!token) return socket.emit("error","No Token")
    try{
  const user = jwt.verify(token,process.env.ACCESS_TOKEN!) as {username:string,email?: string, is_email_verified?:boolean}
  const room = activeRooms.get(roomId)
  if (!room) {
      return socket.emit("error","Room Not Found")
  }
    const roomValue = room.participants.get(user.username)
  if(!roomValue) return socket.emit("error","User cant be in room")

    room.participants.set(user.username,{
      ...roomValue,socketId:socket.id
  })
  socket.join(roomId)
  io.to(roomId).emit("participants",[...room.participants.keys()])
  }catch(err:any){
    console.log(err)
     socket.emit("error","No Token")
  }
})
  })
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});


// Start Server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
