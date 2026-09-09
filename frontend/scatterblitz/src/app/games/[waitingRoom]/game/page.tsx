"use client";

import { useSocket } from "../SocketContext";
import { useEffect } from "react";

export default function Game() {
    const { socket, isConnected, connectSocket: initSocket } = useSocket();

    useEffect(() => {
        const setupSocket = async () => {
            const activeSocket = await initSocket();
            if (activeSocket) {
                console.log("Active Game page connected to socket:", activeSocket.id);
            }
        };
        setupSocket();
    }, []);

    return (
        <main style={{ padding: "2rem", color: "#ffffff" }}>
            <h1>ScatterBlitz Game Board</h1>
            <p>Socket Status: {isConnected ? "Connected 🟢" : "Connecting... 🟡"}</p>
            <p>Socket ID: {socket?.id || "N/A"}</p>
        </main>
    );
}