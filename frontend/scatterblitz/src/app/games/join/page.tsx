"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaUsers,
  FaExclamationTriangle,
  FaBolt,
  FaPlusCircle,
} from "react-icons/fa";
import CanvasBackground from "../../components/CanvasBackground";
import styles from "../gameRooms.module.css";
import { API_BASE_URL } from "../../../config/api";

interface PublicRoomData {
  roomId: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  hostUsername?: string | null;
  categories: string[];
}

export default function JoinRoomPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingRooms, setLoadingRooms] = useState(false);

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

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length !== 5) {
      setError("Room Code must be exactly 5 characters.");
      return;
    }

    router.push(`/games/${cleanCode}${password ? `?password=${password}` : ""}`);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <CanvasBackground />

      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <FaArrowLeft /> Back
          </button>
          <Link href="/games/create" className={styles.switchRouteLink}>
            <FaPlusCircle /> Host a Game
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>JOIN GAME ROOM</h1>
          <p className={styles.subtitle}>
            Enter a private room code or jump into an open multiplayer lobby.
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {/* Direct Code Entry Card */}
        <div className={styles.joinCard}>
          <form onSubmit={handleJoinSubmit} className={styles.formGroup}>
            <div className={styles.sectionHeaderRow} style={{ marginBottom: "0.5rem" }}>
              <div className={styles.sectionLabel}>
                <FaBolt /> Quick Join with Code
              </div>
              <button
                type="button"
                className={styles.joinPasswordToggle}
                onClick={() => setIsPrivate(!isPrivate)}
              >
                {isPrivate ? "Hide Password Field" : "Have a Private Password?"}
              </button>
            </div>

            <div className={styles.joinCodeRow}>
              <input
                type="text"
                id="code"
                placeholder="ENTER 5-LETTER CODE"
                maxLength={5}
                className={`${styles.input} ${styles.codeInput}`}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              />
              <button type="submit" className={styles.joinSubmitBtn}>
                <FaBolt /> ENTER ROOM
              </button>
            </div>

            {isPrivate && (
              <div className={styles.formGroup} style={{ marginTop: "0.75rem" }}>
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

        {/* Public Lobbies Section */}
        <div className={styles.publicRoomsSection}>
          <div className={styles.publicHeaderRow}>
            <div>
              <div className={styles.sectionLabel}>
                <FaUsers /> Open Public Lobbies
              </div>
              <span className={styles.helperText}>Find active games and jump right in</span>
            </div>
            <div style={{ position: "relative", width: "240px" }}>
              <input
                type="text"
                placeholder="Filter room code..."
                className={styles.input}
                style={{ padding: "0.55rem 0.95rem", fontSize: "0.85rem" }}
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
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingRooms ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-subtle)", padding: "2.5rem" }}>
                      Searching for active lobbies...
                    </td>
                  </tr>
                ) : publicRooms.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: "center", color: "var(--text-subtle)", padding: "2.5rem" }}>
                      No active public rooms right now.{" "}
                      <Link href="/games/create" style={{ color: "var(--amber)", textDecoration: "underline" }}>
                        Host one now!
                      </Link>
                    </td>
                  </tr>
                ) : (
                  publicRooms.map((room) => (
                    <tr key={room.roomId} onClick={() => router.push(`/games/${room.roomId}`)}>
                      <td style={{ fontWeight: 800, color: "var(--gold)", letterSpacing: "0.1em" }}>
                        <div>{room.roomId}</div>
                        {room.hostUsername && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontWeight: 400 }}>
                            Host: {room.hostUsername}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
                          <FaUsers style={{ color: "var(--amber)" }} />
                          {room.playerCount} / {room.maxPlayers}
                        </span>
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {room.categories.join(", ")}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className={styles.joinTableBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/games/${room.roomId}`);
                          }}
                        >
                          Join Match
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
