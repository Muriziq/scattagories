"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken } from "../../accessToken";
import { SOCKET_URL } from "../../../config/api";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectSocket: () => Promise<Socket | null>;
  disconnectSocket: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  connectSocket: async () => null,
  disconnectSocket: () => {},
});

// Provides a singleton Socket.IO client instance across lobby and game routes
export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Connects or re-authenticates the socket using the current access token
  const connectSocket = async (): Promise<Socket | null> => {
    // Reuse existing active socket if already connected
    if (socketRef.current) {
      if (socketRef.current.connected) {
        return socketRef.current;
      }
      socketRef.current.disconnect();
    }

    const token = await getAccessToken();
    if (!token) return null;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: true,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    return newSocket;
  };

  // Explicitly disconnects and clears the socket reference
  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  };

  // Clean up socket connection on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
