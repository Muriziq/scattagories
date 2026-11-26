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

// Global module-level singleton instance to prevent multiple socket connections across renders/layouts
let globalSocket: Socket | null = null;
let globalConnectingPromise: Promise<Socket | null> | null = null;

// Provides a singleton Socket.IO client instance across lobby and game routes
export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState<boolean>(Boolean(globalSocket?.connected));

  // Explicitly disconnects and clears the singleton socket reference
  const disconnectSocket = useCallback(() => {
    globalConnectingPromise = null;
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
    }
    setSocket(null);
    setIsConnected(false);
  }, []);

  // Connects or returns the existing active singleton socket
  const connectSocket = useCallback(async (): Promise<Socket | null> => {
    // 1. Reuse existing connected socket
    if (globalSocket?.connected) {
      setSocket(globalSocket);
      setIsConnected(true);
      return globalSocket;
    }

    // 2. Reuse in-flight connection promise to prevent duplicate handshakes
    if (globalConnectingPromise) {
      return globalConnectingPromise;
    }

    globalConnectingPromise = (async () => {
      try {
        if (globalSocket) {
          globalSocket.disconnect();
          globalSocket = null;
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

        globalSocket = newSocket;
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
        globalConnectingPromise = null;
      }
    })();

    return globalConnectingPromise;
  }, []);

  useEffect(() => {
    // If a global socket already exists, sync state on mount
    if (globalSocket) {
      setSocket(globalSocket);
      setIsConnected(globalSocket.connected);
    }
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, connectSocket, disconnectSocket }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
