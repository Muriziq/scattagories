"use client";

import { io, Socket } from "socket.io-client";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import { 
    FaBolt, 
    FaUsers, 
    FaCrown, 
    FaCopy, 
    FaCheck, 
    FaPlay, 
    FaSignOutAlt, 
    FaExclamationTriangle, 
    FaSpinner, 
    FaUserCircle,
    FaLock,
    FaGlobe,
    FaArrowLeft
} from "react-icons/fa";
import styles from "./waitingRoom.module.css";
import { getAccessToken, getUserData, createNewGuest } from "../../accessToken";
import AuthModel from "../authModels";

function WaitingRoomContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomId = (params.waitingRoom as string || "").toUpperCase();
    const password = searchParams.get("password") || "";

    const [participants, setParticipants] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [currentUser, setCurrentUser] = useState<Record<string, any>>({});
    
    const socketRef = useRef<Socket | null>(null);

    const connectSocket = async () => {
        setError(null);
        const token = await getAccessToken();

        if (!token || token === "") {
            setShowAuthModal(true);
            return;
        }

        setCurrentUser(getUserData() || {});

        if (socketRef.current) {
            socketRef.current.disconnect();
        }

        const socket = io("http://localhost:5000", {
            auth: { token }
        });
        socketRef.current = socket;

        socket.emit("room:join", { roomId, password });

        socket.on("room:participants", (participantsList: any[]) => {
            setParticipants(participantsList);
        });

        socket.on("error", (err: string) => {
            console.error("Socket error:", err);
            setError(err);
            if (err.includes("Unauthorized") || err.includes("Authentication required")) {
                setShowAuthModal(true);
            }
        });
    };

    useEffect(() => {
        connectSocket();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [roomId, password]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

      const enterAsGuest = async () => {
        const guestToken = await createNewGuest();
        if (guestToken) {
          setShowAuthModal(false);
            connectSocket()
        } else {
          setError("Failed to create guest session. Please try logging in.");
        }
      };

    const handleStartGame = () => {
        if (socketRef.current) {
            socketRef.current.emit("game:start", roomId);
        }
    };

    const handleLeaveRoom = () => {
        if (socketRef.current) {
            socketRef.current.emit("room:leave", roomId);
        }
        router.push("/");
    };

    const isHost = participants.length > 0 && currentUser?.username && (
        participants[0]?.username === currentUser.username ||
        (typeof participants[0] === "string" && participants[0] === currentUser.username)
    );

    return (
        <main className={styles.main}>
            <div className={styles.ambientGlow} />

            <div className={styles.lobbyContainer}>
                {/* TOP NAVIGATION BAR */}
                <nav className={styles.topNav}>
                    <button onClick={handleLeaveRoom} className={styles.backBtn}>
                        <FaArrowLeft /> Exit Lobby
                    </button>

                    <Link href="/" className={styles.logo}>
                        <FaBolt className={styles.logoIcon} />
                        <span>Scatter<span className={styles.logoHighlight}>Blitz</span></span>
                    </Link>
                </nav>

                {/* ERROR BANNER */}
                {error && (
                    <div className={styles.errorMessage}>
                        <FaExclamationTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* ROOM HERO HEADER CARD */}
                <header className={styles.heroCard}>
                    <div className={styles.heroDetails}>
                        <div className={styles.roomTitleRow}>
                            <h1 className={styles.roomTitle}>Game Room</h1>
                            <span className={`${styles.roomBadge} ${password ? styles.privateBadge : styles.publicBadge}`}>
                                {password ? <><FaLock /> Private</> : <><FaGlobe /> Public</>}
                            </span>
                        </div>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            Waiting for players to get ready...
                        </span>
                    </div>

                    <div className={styles.codeCopyBox}>
                        <div>
                            <span className={styles.codeLabel}>Room Code</span>
                            <div className={styles.codeValue}>{roomId}</div>
                        </div>
                        <button 
                            type="button" 
                            className={`${styles.copyBtn} ${copied ? styles.copiedBtn : ''}`}
                            onClick={handleCopyCode}
                        >
                            {copied ? <><FaCheck /> Copied!</> : <><FaCopy /> Copy Code</>}
                        </button>
                    </div>
                </header>

                {/* CONTENT GRID */}
                <div className={styles.contentGrid}>
                    {/* PARTICIPANTS SECTION */}
                    <section className={styles.playersSection}>
                        <div className={styles.sectionHeader}>
                            <div className={styles.sectionTitle}>
                                <FaUsers style={{ color: "var(--amber)" }} />
                                <span>Joined Players</span>
                            </div>
                            <span className={styles.playerCountBadge}>
                                {participants.length} Players
                            </span>
                        </div>

                        <div className={styles.playersGrid}>
                            {participants.map((participant, index) => {
                                const username = typeof participant === "object" ? participant.username : participant;
                                const isHostPlayer = index === 0;

                                return (
                                    <div key={index} className={styles.playerCard}>
                                        <div className={styles.avatarWrapper}>
                                            <div className={styles.avatarCircle}>
                                                <FaUserCircle />
                                            </div>
                                            {isHostPlayer && (
                                                <div className={styles.crownBadge} title="Host">
                                                    <FaCrown />
                                                </div>
                                            )}
                                        </div>
                                        <span className={styles.playerName}>{username}</span>
                                        <span className={styles.playerStatus}>
                                            {isHostPlayer ? "Lobby Host" : "Ready"}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Filler Empty Slots */}
                            {Array.from({ length: Math.max(0, 4 - participants.length) }).map((_, i) => (
                                <div key={`empty-${i}`} className={styles.emptySlotCard}>
                                    <FaUsers size={24} style={{ opacity: 0.3 }} />
                                    <span>Waiting for player...</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* SIDEBAR ACTIONS */}
                    <aside className={styles.sidebarSection}>
                        <div className={styles.actionBox}>
                            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                                Lobby Status
                            </h3>

                            {isHost ? (
                                <button 
                                    type="button" 
                                    className={styles.startGameBtn}
                                    onClick={handleStartGame}
                                    disabled={participants.length < 1}
                                >
                                    <FaPlay /> START GAME
                                </button>
                            ) : (
                                <div className={styles.waitingHostMsg}>
                                    <FaSpinner className={styles.spinIcon} />
                                    <span>Waiting for Host to start the game match...</span>
                                </div>
                            )}

                            <button 
                                type="button" 
                                className={styles.leaveRoomBtn}
                                onClick={handleLeaveRoom}
                            >
                                <FaSignOutAlt /> Leave Room
                            </button>
                        </div>
                    </aside>
                </div>
            </div>

            {/* REUSABLE AUTH MODEL */}
            {showAuthModal && (
                <AuthModel
                    modelFunction={enterAsGuest}
                    cancelModal={() => setShowAuthModal(false)}
                />
            )}
        </main>
    );
}

export default function WaitingRoom() {
    return (
        <Suspense fallback={
            <main className={styles.main}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "var(--amber)" }}>
                    <FaSpinner className={styles.spinIcon} size={32} />
                    <h2>Loading Waiting Room...</h2>
                </div>
            </main>
        }>
            <WaitingRoomContent />
        </Suspense>
    );
}

