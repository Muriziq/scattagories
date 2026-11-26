"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getAccessToken, requestAccessToken } from "../../accessToken";
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
  const connectingPromiseRef = useRef<Promise<Socket | null> | null>(null);

  // Explicitly disconnects and clears the socket reference
  const disconnectSocket = useCallback(() => {
    connectingPromiseRef.current = null;
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  // Connects or re-authenticates the socket using the current access token
  const connectSocket = useCallback(async (): Promise<Socket | null> => {
    // Reuse existing active socket if already connected
    if (socketRef.current?.connected) {
      return socketRef.current;
    }

    // Reuse in-flight connection promise to prevent concurrent calls from spawning duplicates
    if (connectingPromiseRef.current) {
      return connectingPromiseRef.current;
    }

    connectingPromiseRef.current = (async () => {
      try {
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }

        const token = await getAccessToken();
        if (!token) return null;

        let hasRetriedAuth = false;

        const newSocket = io(SOCKET_URL, {
          auth: async (cb) => {
            try {
              const currentToken = await getAccessToken();
              cb({ token: currentToken });
            } catch {
              cb({ token: null });
            }
          },
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1000,
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on("connect", () => {
          setIsConnected(true);
          hasRetriedAuth = false;
        });

        newSocket.on("disconnect", () => {
          setIsConnected(false);
        });

        // Auto-refresh token EXACTLY ONCE if connection fails due to authentication or token expiration
        newSocket.on("connect_error", async (err: any) => {
          const errMsg = err?.message || "";
          if (
            errMsg.includes("Authentication error") ||
            errMsg.includes("Unauthorized") ||
            errMsg.includes("jwt")
          ) {
            if (hasRetriedAuth) {
              // Already tried once and still failed; abort further socket connection attempts
              newSocket.disconnect();
              return;
            }
            hasRetriedAuth = true;
            try {
              const freshToken = await requestAccessToken();
              if (freshToken) {
                newSocket.connect();
              } else {
                newSocket.disconnect();
              }
            } catch (_) {
              newSocket.disconnect();
            }
          }
        });

        return newSocket;
      } finally {
        connectingPromiseRef.current = null;
      }
    })();

    return connectingPromiseRef.current;
  }, []);

  // Clean up socket connection on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
