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
    FaArrowLeft,
    FaShareAlt,
    FaTimes
} from "react-icons/fa";
import styles from "./waitingRoom.module.css";
import authStyles from "../authmodel.module.css";
import { getAccessToken, getUserData, createNewGuest } from "../../accessToken";
import AuthModel from "../authModels";
import { useSocket } from "./SocketContext";
import ErrorModals from "./ErrorModals";

function WaitingRoomContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    const roomId = (params.waitingRoom as string || "").toUpperCase();
    const password = searchParams.get("password") || "";

    const [participants, setParticipants] = useState<any[]>([]);
    const [hostUsername, setHostUsername] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [maxPlayers, setMaxPlayers] = useState<number>(4);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [currentUser, setCurrentUser] = useState<Record<string, any>>({});

    // Password Modal state
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [inputPassword, setInputPassword] = useState("");
    const [passwordError, setPasswordError] = useState<string | null>(null);

    // Room Error Modal state
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomErrorMsg, setRoomErrorMsg] = useState<string | null>(null);

    // Change Room Modal state
    const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
    const [previousRoomId, setPreviousRoomId] = useState<string>("");

    // Persistent Socket Context
    const { socket, connectSocket: initSocket, disconnectSocket } = useSocket();

    const handleSocketError = (err: any) => {
        console.error("Socket error:", err);
        const message = typeof err === "object" ? err?.message : String(err || "");
        const type = typeof err === "object" ? err?.type : "";

        if (type === "authorization" || message.includes("Unauthorized") || message.includes("Authentication required")) {
            setShowAuthModal(true);
        } else if (type === "password") {
            setPasswordError(message);
            setShowPasswordModal(true);
        } else if (type === "room") {
            setRoomErrorMsg(message);
            setShowRoomModal(true);
        } else if (type === "change-room") {
            const prevRoom = typeof err === "object" ? (err?.roomID || err?.roomId || "") : "";
            setPreviousRoomId(prevRoom);
            setShowChangeRoomModal(true);
        } else {
            setError(message);
        }
    };

    const handleLeavePrevAndJoinNew = () => {
        setShowChangeRoomModal(false);
        if (socket) {
            if (previousRoomId) {
                socket.emit("room:leave", previousRoomId);
            }
            setTimeout(() => {
                socket.emit("room:join", { roomId, password });
            }, 50);
        }
    };

    const handleGoToPrevRoom = () => {
        setShowChangeRoomModal(false);
        if (previousRoomId) {
            router.push(`/games/${previousRoomId}`);
        } else {
            router.push("/games/rooms");
        }
    };

    const connectSocket = async () => {
        setError(null);
        const activeSocket = await initSocket();

        if (!activeSocket) {
            setShowAuthModal(true);
            return;
        }

        setCurrentUser(getUserData() || {});

        activeSocket.emit("room:join", { roomId, password });

        activeSocket.off("room:participants");
        activeSocket.off("error");
        activeSocket.off("join:error");
        activeSocket.off("game:started");

        activeSocket.on("room:participants", (data: any) => {
            if (Array.isArray(data)) {
                setParticipants(data);
            } else if (data && typeof data === "object") {
                setParticipants(data.participants || []);
                if (data.hostUsername) setHostUsername(data.hostUsername);
                if (data.categories) setCategories(data.categories);
                if (data.maxPlayers) setMaxPlayers(data.maxPlayers);
            }
        });

        activeSocket.on("game:started", () => {
            router.push(`/games/${roomId}/game`);
        });

        activeSocket.on("error", handleSocketError);
        activeSocket.on("join:error", handleSocketError);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputPassword) return;
        setShowPasswordModal(false);
        setPasswordError(null);
        router.replace(`/games/${roomId}?password=${inputPassword}`);
        if (socket) {
            socket.emit("room:join", { roomId, password: inputPassword });
        }
    };

    useEffect(() => {
        connectSocket();
    }, [roomId, password]);

    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const handleCopyCode = (val: string, key: string) => {
        if (!val) return;
        navigator.clipboard.writeText(val);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

      const enterAsGuest = async () => {
        const guestToken = await createNewGuest();
        if (guestToken) {
                setCurrentUser(getUserData() || {});
          setShowAuthModal(false);
            connectSocket()
        } else {
          setError("Failed to create guest session. Please try logging in.");
        }
      };

    const handleStartGame = () => {
        if (socket) {
            socket.emit("game:start", roomId);
        }
    };

    const handleLeaveRoom = () => {
        if (socket) {
            socket.emit("room:leave", roomId);
        }
        router.push("/");
    };

    const isHost = currentUser?.username && (
        (hostUsername && currentUser.username === hostUsername) ||
        (participants.length > 0 && typeof participants[0] === "object" && participants[0].isHost && participants[0].username === currentUser.username) ||
        (participants.length > 0 && (participants[0]?.username === currentUser.username || participants[0] === currentUser.username))
    );

    return (
        <main className={styles.main}>
                                <button onClick={handleLeaveRoom} className={styles.backBtn}>
                        <FaArrowLeft /> Exit Lobby
                    </button>
<div className={styles.container}>
            <div className={styles.lobbyContainer}>


                {/* ERROR BANNER */}
                {error && (
                    <div className={styles.errorMessage}>
                        <FaExclamationTriangle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* ROOM HERO HEADER CARD */}
                 <h1 className={styles.roomTitle}>WAITING ROOM</h1>
                 <div className={styles.copyRow}>
                <div className={styles.copyUrl} style={{margin:"0 1rem"}}>
                    <p>Copy Url: <span>{typeof window !== "undefined" ? window.location.href : ""}</span> </p>  
                    {copiedKey === "url" ? (
                        <FaCheck className={styles.copyBtn} style={{ color: "#10b981" }} />
                    ) : (
                        <FaCopy 
                            className={styles.copyBtn} 
                            onClick={() => handleCopyCode(typeof window !== "undefined" ? window.location.href : "", "url")} 
                        />
                    )}
                </div>
                <div className={styles.copyUrl}>
                    <p>Room Code: <span>{roomId}</span> </p>  
                    {copiedKey === "room" ? (
                        <FaCheck className={styles.copyBtn} style={{ color: "#10b981" }} />
                    ) : (
                        <FaCopy 
                            className={styles.copyBtn} 
                            onClick={() => handleCopyCode(roomId, "room")} 
                        />
                    )}
                </div>

                {password && (<div className={styles.copyUrl}>
                    <p>Password: <span>{password}</span> </p>  
                    {copiedKey === "password" ? (
                        <FaCheck className={styles.copyBtn} style={{ color: "#10b981" }} />
                    ) : (
                        <FaCopy 
                            className={styles.copyBtn} 
                            onClick={() => handleCopyCode(password, "password")} 
                        />
                    )}
                </div>)}

                 </div>


                {/* CONTENT GRID */}
                <div className={styles.contentGrid}>
                    {/* PARTICIPANTS SECTION */}
                    <section className={styles.playersSection}>
                        <div className={styles.sectionHeader}>
         
                                <h2 className={styles.sectionTitle}>Joined Players</h2>
                            <span className={styles.playerCountBadge}>
                                {participants.length} / {maxPlayers} Players
                            </span>
                        </div>

                        <div className={styles.playersGrid}>
                            {participants.map((participant, index) => {
                                const username = typeof participant === "object" ? participant.username : participant;
                                const isHostPlayer = typeof participant === "object"
                                    ? (participant.isHost || (hostUsername && participant.username === hostUsername))
                                    : (hostUsername ? participant === hostUsername : index === 0);

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

                            {/* Filler Empty Slots based on room maxPlayers */}
                            {Array.from({ length: Math.max(0, maxPlayers - participants.length) }).map((_, i) => (
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

                        {/* CATEGORIES PREVIEW BOX */}
                        {categories.length > 0 && (
                            <div className={styles.actionBox}>
                                <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--amber)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <FaBolt /> Room Categories ({categories.length})
                                </h3>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                    {categories.map((cat, i) => (
                                        <span key={i} style={{ background: "rgba(242, 204, 136, 0.08)", border: "1px solid var(--amber)", color: "var(--sunset)", padding: "0.35rem 0.85rem", borderRadius: "12px", fontSize: "0.85rem", fontWeight: 700 }}>
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            {/* REUSABLE ERROR & AUTH MODALS */}
            <ErrorModals
                roomId={roomId}
                showAuthModal={showAuthModal}
                enterAsGuest={enterAsGuest}
                onCloseAuthModal={() => {
                    setShowAuthModal(false);
                    router.push("/");
                }}
                showPasswordModal={showPasswordModal}
                inputPassword={inputPassword}
                setInputPassword={setInputPassword}
                handlePasswordSubmit={handlePasswordSubmit}
                onClosePasswordModal={() => {
                    setShowPasswordModal(false);
                    router.push("/games/rooms");
                }}
                showRoomModal={showRoomModal}
                roomErrorMsg={roomErrorMsg}
                onCloseRoomModal={() => {
                    setShowRoomModal(false);
                    router.push("/games/rooms");
                }}
                showChangeRoomModal={showChangeRoomModal}
                previousRoomId={previousRoomId}
                handleLeavePrevAndJoinNew={handleLeavePrevAndJoinNew}
                handleGoToPrevRoom={handleGoToPrevRoom}
                onCloseChangeRoomModal={handleGoToPrevRoom}
            />
</div>

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

