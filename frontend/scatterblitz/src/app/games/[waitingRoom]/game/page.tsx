"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import { 
    FaArrowLeft, 
    FaClock, 
    FaCrown, 
    FaStopCircle, 
    FaSpinner, 
    FaCheckCircle, 
    FaExclamationTriangle, 
    FaTrophy,
    FaUserCircle,
    FaBolt,
    FaSpellCheck
} from "react-icons/fa";
import styles from "./game.module.css";
import { useSocket } from "../SocketContext";
import { getUserData, createNewGuest } from "../../../accessToken";
import AuthModel from "../../authModels";
import ErrorModals from "../ErrorModals";

function GameContent() {
    const params = useParams();
    const router = useRouter();

    const rawRoomId = (params.waitingRoom as string || "");
    const roomId = rawRoomId.toUpperCase();

    const { socket, isConnected, connectSocket: initSocket, disconnectSocket } = useSocket();

    // User State
    const [currentUser, setCurrentUser] = useState<Record<string, any>>({});
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal states for game errors
    const [showRoomModal, setShowRoomModal] = useState(false);
    const [roomErrorMsg, setRoomErrorMsg] = useState<string | null>(null);
    const [showNotStartedModal, setShowNotStartedModal] = useState(false);
    const [notStartedMsg, setNotStartedMsg] = useState<string | null>(null);

    // Room & Game State
    const [status, setStatus] = useState<"waiting" | "letter_selection" | "active_sprint" | "recap" | "ended">("letter_selection");
    const [participants, setParticipants] = useState<{ username: string; score: number }[]>([]);
    const [allLetters, setAllLetters] = useState<string[]>([]);
    const [availableLetters, setAvailableLetters] = useState<string[]>([]);
    const [activeLetter, setActiveLetter] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [currentRound, setCurrentRound] = useState<number>(1);
    const [totalRound, setTotalRound] = useState<number>(1);
    const [usersTurn, setUsersTurn] = useState<string | null>(null);
    const [maxTimePerRound, setMaxTimePerRound] = useState<number>(60);

    // Timer & Answers state
    const [timerSeconds, setTimerSeconds] = useState<number>(60);
    const [selectionTimeLimit, setSelectionTimeLimit] = useState<number>(15);
    const [selectionTimerSeconds, setSelectionTimerSeconds] = useState<number>(15);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
    const answersRef = useRef<Record<string, string>>({});
    answersRef.current = answers;
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Initialize user and socket setup
    useEffect(() => {
        const setup = async () => {
            const userData = getUserData();
            if (userData) {
                setCurrentUser(userData);
            }

            const activeSocket = await initSocket();
            if (!activeSocket) {
                setShowAuthModal(true);
                return;
            }

            // Emit game:join on entry
            activeSocket.emit("game:join", roomId);

            // Listeners
            activeSocket.off("room:state");
            activeSocket.off("turn:change");
            activeSocket.off("letter:active");
            activeSocket.off("round:ended");
            activeSocket.off("game:ended");
            activeSocket.off("answer:success");
            activeSocket.off("error");

            activeSocket.on("room:state", (data: any) => {
                if (data.participants) setParticipants(data.participants);
                if (data.allLetters) setAllLetters(data.allLetters);
                if (data.availableLetters) setAvailableLetters(data.availableLetters);
                if (data.categories) setCategories(data.categories);
                if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
                if (data.totalRound !== undefined) setTotalRound(data.totalRound);
                if (data.usersTurn !== undefined) setUsersTurn(data.usersTurn);
                if (data.activeLetter !== undefined) setActiveLetter(data.activeLetter);
                if (data.status) setStatus(data.status);
                if (data.maxTimePerRound !== undefined) setMaxTimePerRound(data.maxTimePerRound);
                if (data.selectionTimeLimit !== undefined) setSelectionTimeLimit(data.selectionTimeLimit);

                const maxTime = data.maxTimePerRound !== undefined ? data.maxTimePerRound : maxTimePerRound;
                const selLimit = data.selectionTimeLimit !== undefined ? data.selectionTimeLimit : selectionTimeLimit;

                if (data.selectionStartTime) {
                    const remainingSel = Math.max(0, Math.ceil(selLimit - (Date.now() - data.selectionStartTime) / 1000));
                    setSelectionTimerSeconds(remainingSel);
                } else if (data.selectionTimeLimit !== undefined) {
                    setSelectionTimerSeconds(data.selectionTimeLimit);
                }

                if (data.roundStartTime) {
                    const remainingSprint = Math.max(0, Math.ceil(maxTime - (Date.now() - data.roundStartTime) / 1000));
                    setTimerSeconds(remainingSprint);
                } else if (data.maxTimePerRound !== undefined) {
                    setTimerSeconds(data.maxTimePerRound);
                }
            });

            activeSocket.on("turn:change", (data: any) => {
                const turnPlayer = typeof data === "object" ? data.usersTurn : String(data || "");
                const limit = typeof data === "object" && data.selectionTimeLimit ? data.selectionTimeLimit : 15;
                const startTime = typeof data === "object" && data.selectionStartTime ? data.selectionStartTime : Date.now();
                const remaining = Math.max(0, Math.ceil(limit - (Date.now() - startTime) / 1000));
                setUsersTurn(turnPlayer);
                setSelectionTimeLimit(limit);
                setSelectionTimerSeconds(remaining);
                setStatus("letter_selection");
                setActiveLetter(null);
                setAnswers({});
                setHasSubmitted(false);
            });

            activeSocket.on("letter:active", (data: any) => {
                const letterStr = typeof data === "object" ? data.letter : String(data || "");
                const startTime = typeof data === "object" && data.roundStartTime ? data.roundStartTime : Date.now();
                const remaining = Math.max(0, Math.ceil(maxTimePerRound - (Date.now() - startTime) / 1000));
                setActiveLetter(letterStr);
                setStatus("active_sprint");
                setAvailableLetters((prev) => prev.filter((l) => l !== letterStr.toUpperCase()));
                setTimerSeconds(remaining);
                setHasSubmitted(false);
            });

            activeSocket.on("round:ended", ({ reason }: { reason: string }) => {
                setStatus("recap");
                submitAnswers(activeSocket);
            });

            activeSocket.on("game:ended", (data: any) => {
                setStatus("ended");
                console.log(data)
            });

            activeSocket.on("answer:success", () => {
                setHasSubmitted(true);
            });

            activeSocket.on("error", (err: any) => {
                const msg = typeof err === "object" ? err?.message : String(err || "");
                const type = typeof err === "object" ? err?.type : "";

                if (type === "authorization" || msg.includes("Unauthorized") || msg.includes("Authentication required")) {
                    setShowAuthModal(true);
                } else if (type === "not-started") {
                    setNotStartedMsg(msg);
                    setShowNotStartedModal(true);
                } else if (type === "room") {
                    setRoomErrorMsg(msg);
                    setShowRoomModal(true);
                } else {
                    setError(msg);
                }
            });
        };

        setup();
    }, [roomId]);

    // Timer countdown effect during letter_selection
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (status === "letter_selection" && selectionTimerSeconds > 0) {
            interval = setInterval(() => {
                setSelectionTimerSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, selectionTimerSeconds]);

    // Timer countdown effect during active_sprint
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (status === "active_sprint" && timerSeconds > 0) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval!);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (status === "active_sprint" && timerSeconds === 0) {
            if (socket) {
                submitAnswers(socket);
            }
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [status, timerSeconds]);

    // Helper to submit answers
    const submitAnswers = (activeSocket: any) => {
        if (!activeSocket || hasSubmitted) return;
        activeSocket.emit("answer:submit", {
            roomID: roomId,
            answers: answersRef.current,
        });
        setHasSubmitted(true);
    };

    // User chooses a letter (when it's their turn)
    const handleSelectLetter = (letter: string) => {
        if (!socket) return;
        if (currentUser?.username !== usersTurn) {
            setError("It is not your turn!");
            return;
        }
        socket.emit("letter:select", { roomID: roomId, letter });
    };

    // User clicks STOP ROUND (only available for turn player)
    const handleStopRound = () => {
        if (!socket) return;
        if (currentUser?.username !== usersTurn) {
            setError("Only the current turn player can stop the round early!");
            return;
        }
        socket.emit("round:stop", roomId);
    };

    const handleExitGame = () => {
        if (socket) {
            socket.emit("room:leave", roomId);
        }
        router.push(`/`);
    };

    const enterAsGuest = async () => {
        const guestToken = await createNewGuest();
        if (guestToken) {
            setCurrentUser(getUserData() || {});
            setShowAuthModal(false);
            if (socket) {
                socket.emit("game:join", roomId);
            } else {
                initSocket();
            }
        } else {
            setError("Failed to create guest session. Please try logging in.");
        }
    };

    const isYourTurn = currentUser?.username && usersTurn && currentUser.username === usersTurn;

    return (
        <main className={styles.main}>
            <button onClick={handleExitGame} className={styles.exitBtn}>
                <FaArrowLeft /> Lobby
            </button>
            <div className={styles.gameContainer}>
                

                {/* ERROR BANNER */}
                {error && (
                    <div className={styles.errorBanner}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FaExclamationTriangle />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                {/* MAIN GRID */}
           
                        {/* STATUS 1: LETTER SELECTION */}
                        {status === "letter_selection" && (
                            <section className={styles.letterSelectionSection}>
                                <h2 className={styles.sectionTitle}>
                                    <FaSpellCheck style={{ marginRight: "0.5rem", color: "var(--amber)" }} />
                                    CHOOSE A LETTER 
                                </h2>

                                <div className={`${styles.turnNotice} ${isYourTurn ? styles.turnNoticeActive : styles.turnNoticeWaiting}`}>
                                    {isYourTurn ? (
                                        `⚡ It's YOUR TURN! Click any letter below in ${String(selectionTimerSeconds).padStart(2, "0")}s or a random letter will be chosen for you.`
                                    ) : (
                                        `Waiting for ${usersTurn || "the player"} to pick a letter (${String(selectionTimerSeconds).padStart(2, "0")}s remaining)...`
                                    )}
                                </div>

                                <div className={styles.lettersGrid}>
                                    {(allLetters.length > 0 ? allLetters : availableLetters).map((letter) => {
                                        const isAvailable = availableLetters.includes(letter);
                                        const isDisabled = !isAvailable || !isYourTurn;

                                        let btnClass = styles.letterBtn;
                                        if (!isAvailable) {
                                            btnClass += ` ${styles.letterBtnDisabled}`;
                                        } else if (!isYourTurn) {
                                            btnClass += ` ${styles.letterBtnWaiting}`;
                                        }

                                        return (
                                            <button
                                                key={letter}
                                                type="button"
                                                className={btnClass}
                                                disabled={isDisabled}
                                                onClick={() => handleSelectLetter(letter)}
                                                title={!isAvailable ? "Already selected" : !isYourTurn ? "Waiting for turn player" : `Pick Letter ${letter}`}
                                            >
                                                {letter}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* STATUS 2: ACTIVE SPRINT */}
                        {status === "active_sprint" && (
                            <section className={styles.activeSprintSection}>
                                <h2 className={styles.activeTimer}>{String(timerSeconds).padStart(2, "0")}</h2>
                                <div className={styles.activeLetterBox}>{activeLetter || "?"}</div>


                                <div className={styles.categoriesContainer}>
                                    {categories.map((category, index) => (
                                        <label key={category} className={styles.categoryLabel}>
                                            {category}:
                                            <input
                                                ref={(el) => { inputRefs.current[index] = el; }}
                                                type="text"
                                                className={styles.categoryInput}
                                                placeholder={`Type a ${category} starting with ${activeLetter}...`}
                                                value={answers[category] || ""}
                                                onChange={(e) => {
                                                    setAnswers({
                                                        ...answers,
                                                        [category]: e.target.value,
                                                    });
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        if (index + 1 < categories.length) {
                                                            inputRefs.current[index + 1]?.focus();
                                                        }
                                                    }
                                                }}
                                            />
                                        </label>
                                    ))}
                                </div>
                                {isYourTurn && (
                                    <button
                                        type="button"
                                        className={styles.stopRoundBtn}
                                        onClick={handleStopRound}
                                    >
                                        STOP ROUND
                                    </button>
                                )}
                            </section>
                        )}

                        {/* STATUS 3: RECAP / SUBMITTED */}
                        {status === "recap" && (
                            <section className={styles.recapSection}>
                                <div className={styles.recapBox}>
                                    <FaSpinner className={styles.spinIcon} />
                                    <h3 style={{ fontSize: "1.4rem", fontWeight: 800 }}>Round Ended!</h3>
                                    <p style={{ color: "var(--text-muted)" }}>
                                        Submitting answers and setting up the next round turn...
                                    </p>
                                </div>
                            </section>
                         )}

                        {/* STATUS 4: ENDED */}
                        {status === "ended" && (
                            <section className={styles.endedSection}>
                                <div className={styles.endedContainer}>
                                    <div className={styles.winnerCard}>
                                        <FaTrophy size={56} style={{ color: "var(--gold)" }} />
                                        <h2 style={{ fontSize: "2rem", fontWeight: 900 }}>Match Completed!</h2>
                                        <p style={{ color: "var(--text-description)" }}>
                                            All rounds have concluded. Check final standings below.
                                        </p>
                                    </div>
                                    <button onClick={handleExitGame} className={styles.returnBtn}>
                                        Return to Waiting Room
                                    </button>
                                </div>
                            </section>
                        )}
              
            </div>

            {/* REUSABLE ERROR & AUTH MODALS */}
            <ErrorModals
                roomId={roomId}
                showAuthModal={showAuthModal}
                enterAsGuest={enterAsGuest}
                onCloseAuthModal={() => router.push("/")}
                showRoomModal={showRoomModal}
                roomErrorMsg={roomErrorMsg}
                onCloseRoomModal={() => router.push("/games/rooms")}
                showNotStartedModal={showNotStartedModal}
                notStartedMsg={notStartedMsg}
                onCloseNotStartedModal={() => router.push(`/games/${roomId}`)}
            />
        </main>
    );
}

export default function GamePage() {
    return (
        <Suspense fallback={
            <main className={styles.main}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", color: "var(--amber)" }}>
                    <FaSpinner className={styles.spinIcon} size={32} />
                    <h2>Loading Game Board...</h2>
                </div>
            </main>
        }>
            <GameContent />
        </Suspense>
    );
}