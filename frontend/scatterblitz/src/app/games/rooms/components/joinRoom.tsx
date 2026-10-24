"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FaUsers, FaExclamationTriangle } from "react-icons/fa";
import styles from "../rooms.module.css";
import { API_BASE_URL } from "../../../../config/api";

interface PublicRoomData {
    roomId: string;
    hostId: string;
    playerCount: number;
    maxPlayers: number;
    createdAt: number;
    hostUsername?: string | null;
    categories: string[];
}

export default function JoinRoom() {
    const router = useRouter();
    const [roomCode, setRoomCode] = useState("");
    const [password, setPassword] = useState("");
    const [isPrivate, setIsPrivate] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [publicRooms, setPublicRooms] = useState<PublicRoomData[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingRooms, setLoadingRooms] = useState(false);

    // Fetches open public lobbies with optional search query and pagination
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            setLoadingRooms(true);
            try {
                const params = new URLSearchParams();
                if (searchQuery.trim()) {
                    params.append("search", searchQuery.trim());
                }
                const queryString = params.toString() ? `?${params.toString()}` : "";
                const res = await fetch(`${API_BASE_URL}/games/rooms/public${queryString}`);
                if (res.ok) {
                    const data = await res.json();
                    setPublicRooms(data.rooms || []);
                }
            } catch (err) {
                console.error("Failed to fetch public rooms:", err);
            } finally {
                setLoadingRooms(false);
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Validates 5-character room code and routes player to the waiting room
    const handleJoinSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanCode = roomCode.trim().toUpperCase();
        if (cleanCode.length !== 5) {
            setError("Room Code must be exactly 5 characters.");
            return;
        }

        router.push(`/games/${cleanCode}${password ? `?password=${password}` : ''}`);
    };

    return (
        <section>
            <h2 className={styles.sectionTitle}>JOIN GAME ROOM</h2>

            {error && (
                <div className={styles.errorMessage}>
                    <FaExclamationTriangle />
                    <span>{error}</span>
                </div>
            )}

            {/* Direct Code Entry Card */}
            <div className={styles.joinCodeCard}>
                <form onSubmit={handleJoinSubmit} className={styles.formGroup}>
                    <div className={styles.joinLabelRow}>
                        <label htmlFor="code" className={styles.joinLabel}>
                            Enter Room Code
                        </label>
                        <button 
                            type="button" 
                            className={styles.joinPasswordToggle}
                            onClick={() => setIsPrivate(!isPrivate)}
                        >
                            {isPrivate ? "Hide password" : "Private room?"}
                        </button>
                    </div>

                    <div className={styles.joinCodeRow}>
                        <input 
                            type="text" 
                            id="code" 
                            placeholder="e.g. A1B2C" 
                            maxLength={5}
                            className={`${styles.input} ${styles.codeInput}`}
                            value={roomCode}
                            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        />

                        <button type="submit" className={styles.joinSubmitBtn}>
                            JOIN ROOM
                        </button>
                    </div>

                    {isPrivate && (
                        <div className={styles.formGroup} style={{ marginTop: "0.5rem" }}>
                            <input 
                                type="password" 
                                id="joinPassword" 
                                placeholder="Enter room password"
                                className={styles.input}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    )}
                </form>
            </div>

            {/* Public Lobbies List */}
            <div className={styles.publicRoomsSection}>
                <div className={styles.toggleRow} style={{ marginBottom: "1rem" }}>
                    <div>
                        <h3 className={styles.sectionSubheading} style={{ margin: 0 }}>Public Lobbies</h3>
                        <span className={styles.helperText}>Find open public games and join instantly</span>
                    </div>
                    <div style={{ position: "relative", width: "220px" }}>
                        <input 
                            type="text" 
                            placeholder="Filter code..." 
                            className={styles.input}
                            style={{ padding: "0.55rem 0.85rem", fontSize: "0.85rem" }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Room Code</th>
                                <th>Players</th>
                                <th>Categories</th>
                                <th style={{textAlign:"right"}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingRooms ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                                        Loading public lobbies...
                                    </td>
                                </tr>
                            ) : publicRooms.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                                        No active public rooms found. Create one to start playing!
                                    </td>
                                </tr>
                            ) : (
                                publicRooms.map((room) => (
                                    <tr key={room.roomId} onClick={() => router.push(`/games/${room.roomId}`)}>
                                        <td style={{ fontWeight: 800, color: "var(--sunset)", letterSpacing: "0.1em" }}>
                                            <div>{room.roomId}</div>
                                            {room.hostUsername && (
                                                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
                                                    by {room.hostUsername}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                                                <FaUsers style={{ color: "var(--amber)" }} />
                                                {room.playerCount} / {room.maxPlayers}
                                            </span>
                                        </td>
                                        <td style={{textWrap:"wrap"}}>
                                            {room.categories.join(", ")}
                                        </td>
                                        <td style={{textAlign:"right"}} >
                                            <button 
                                                type="button" 
                                                className={styles.joinTableBtn}
                                                onClick={() => router.push(`/games/${room.roomId}`)}
                                            >
                                                Join
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
}