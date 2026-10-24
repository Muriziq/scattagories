// Base HTTP API URL, defaulting to local backend development server
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// WebSocket server URL for real-time multiplayer socket events
export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE_URL;
