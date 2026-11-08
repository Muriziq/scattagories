"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  FaArrowLeft,
  FaClock,
  FaCrown,
  FaStopCircle,
  FaSpinner,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaTrophy,
  FaMedal,
  FaAward,
  FaEye,
  FaChevronLeft,
  FaChevronRight,
  FaUserCircle,
  FaBolt,
  FaSpellCheck,
  FaForward,
} from "react-icons/fa";
import styles from "./game.module.css";
import { useSocket } from "../SocketContext";
import { getAccessToken, getUserData, createNewGuest } from "../../../accessToken";
import AuthModel from "../../authModels";
import ErrorModals from "../ErrorModals";
import CanvasBackground from "../../../components/CanvasBackground";
import Toast from "../../../components/Toast";

function GameContent() {
  const params = useParams();
  const router = useRouter();

  const rawRoomId = (params.waitingRoom as string) || "";
  const roomId = rawRoomId.toUpperCase();

  const {
    socket,
    isConnected,
    connectSocket: initSocket,
    disconnectSocket,
  } = useSocket();

  // User State
  const [currentUser, setCurrentUser] = useState<Record<string, any>>({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cheatNotice, setCheatNotice] = useState<string | null>(null);

  // Anti-Cheat Telemetry Tracking
  const pasteAttemptsRef = useRef<number>(0);
  const blurCountRef = useRef<number>(0);
  const blurStartTimeRef = useRef<number | null>(null);
  const totalBlurDurationRef = useRef<number>(0);
  const isAwayRef = useRef<boolean>(false);

  // Modal states for game errors
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomErrorMsg, setRoomErrorMsg] = useState<string | null>(null);
  const [showNotStartedModal, setShowNotStartedModal] = useState(false);
  const [notStartedMsg, setNotStartedMsg] = useState<string | null>(null);

  // Room & Game State
  const [status, setStatus] = useState<
    "waiting" | "letter_selection" | "active_sprint" | "recap" | "ended"
  >("letter_selection");
  const [participants, setParticipants] = useState<
    { username: string; score: number; isConnected?: boolean; hasLeft?: boolean }[]
  >([]);
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
  const [selectionTimerSeconds, setSelectionTimerSeconds] =
    useState<number>(15);
  const [selectionTargetEndTime, setSelectionTargetEndTime] = useState<number | null>(null);
  const [sprintTargetEndTime, setSprintTargetEndTime] = useState<number | null>(null);

  // Latency & clock skew offset (clientNow - estimatedServerNow)
  const [serverOffset, setServerOffset] = useState<number>(0);
  const serverOffsetRef = useRef<number>(0);
  serverOffsetRef.current = serverOffset;

  const maxTimeRef = useRef<number>(60);
  maxTimeRef.current = maxTimePerRound;
  const selectionLimitRef = useRef<number>(15);
  selectionLimitRef.current = selectionTimeLimit;

  // Track status and submission status in refs for atomic event handlers
  const statusRef = useRef(status);
  statusRef.current = status;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const hasSubmittedRef = useRef<boolean>(false);
  hasSubmittedRef.current = hasSubmitted;

  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Round Recap State
  const [roundRecapData, setRoundRecapData] = useState<{
    letter: string;
    round: number;
    scores: Record<string, Record<string, { answer: string; score: number }>>;
    roundStandings?: Array<{ username: string; roundPoints: number; cumulativeScore: number }>;
    roundWinners?: string[];
    recapDuration: number;
  } | null>(null);

  // Recap Skip Votes State
  const [skipVotes, setSkipVotes] = useState<{ votes: number; total: number } | null>(null);
  const [hasVotedSkip, setHasVotedSkip] = useState<boolean>(false);

  // Forfeit Warning banner state
  const [forfeitWarning, setForfeitWarning] = useState<{
    remainingSeconds: number;
    remainingPlayer: string;
    message: string;
  } | null>(null);

  // Game End & Review state
  const [endedData, setEndedData] = useState<{
    submissions: Record<
      string,
      Record<string, Record<string, { answer: string; score: number }>>
    >;
    standings: Array<{ username: string; score: number; isHost: boolean }>;
    forfeit?: boolean;
    winner?: string | null;
  } | null>(null);
  const [reviewParticipant, setReviewParticipant] = useState<string | null>(
    null,
  );
  const [reviewRoundIndex, setReviewRoundIndex] = useState<number>(0);

  // Helper to submit answers strictly once during the grace period buffer
  const submitAnswers = (activeSocket: any) => {
    if (!activeSocket) return;
    if (hasSubmittedRef.current) return;

    activeSocket.emit("answer:submit", {
      roomID: roomId,
      answers: answersRef.current,
      telemetry: {
        pasteAttempts: pasteAttemptsRef.current,
        blurCount: blurCountRef.current,
        totalBlurDurationMs: totalBlurDurationRef.current,
      },
    });
    setHasSubmitted(true);
    hasSubmittedRef.current = true;

    // Clear local storage draft once submitted
    try {
      sessionStorage.removeItem(`scatterblitz_draft_${roomId}`);
    } catch (_) {}
  };

  // Helper to vote to skip the recap phase early
  const handleVoteSkipRecap = () => {
    if (!socket || hasVotedSkip) return;
    socket.emit("recap:skip", roomId);
    setHasVotedSkip(true);
  };

  // Initialize user and socket setup
  useEffect(() => {
    const setup = async () => {
      // Ensure user profile / accessToken is fresh before setting up socket
      await getAccessToken();
      const userData = getUserData();
      if (userData && Object.keys(userData).length > 0) {
        setCurrentUser(userData);
      }

      const activeSocket = await initSocket();
      if (!activeSocket) {
        setShowAuthModal(true);
        return;
      }

      // Sync player presence and room state on initial mount, sending client timestamp for NTP latency calculation
      const clientSendTime = Date.now();
      activeSocket.emit("game:join", { roomId, clientSendTime });

      // Reset listeners to avoid duplicate subscriptions
      activeSocket.off("room:state");
      activeSocket.off("room:participants");
      activeSocket.off("turn:change");
      activeSocket.off("letter:active");
      activeSocket.off("round:ended");
      activeSocket.off("round:recap");
      activeSocket.off("recap:skip_update");
      activeSocket.off("room:forfeit_warning");
      activeSocket.off("room:forfeit_cancelled");
      activeSocket.off("game:ended");
      activeSocket.off("answer:success");
      activeSocket.off("player:cheatPenalty");
      activeSocket.off("error");

      // Updates participant roster and scores when emitted by server
      activeSocket.on("room:participants", (data: any) => {
        if (data?.participants) {
          setParticipants(data.participants);
        } else if (Array.isArray(data)) {
          setParticipants(data);
        }
      });

      // Synchronizes full game room snapshot upon entering or reconnecting
      activeSocket.on("room:state", (data: any) => {
        if (data.serverTime && data.clientSendTime) {
          const t1 = Date.now();
          const rtt = Math.max(0, t1 - data.clientSendTime);
          const oneWayLatency = rtt / 2;
          const estimatedServerNow = data.serverTime + oneWayLatency;
          const calculatedOffset = t1 - estimatedServerNow;
          setServerOffset(calculatedOffset);
          serverOffsetRef.current = calculatedOffset;
        }

        const currentOffset = serverOffsetRef.current;
        const synchronizedNow = Date.now() - currentOffset;

        if (data.participants) setParticipants(data.participants);
        if (data.allLetters) setAllLetters(data.allLetters);
        if (data.availableLetters) setAvailableLetters(data.availableLetters);
        if (data.categories) setCategories(data.categories);
        if (data.currentRound !== undefined) setCurrentRound(data.currentRound);
        if (data.totalRound !== undefined) setTotalRound(data.totalRound);
        if (data.usersTurn !== undefined) setUsersTurn(data.usersTurn);
        if (data.activeLetter !== undefined) setActiveLetter(data.activeLetter);
        if (data.status) {
          setStatus(data.status);
          statusRef.current = data.status;
        }
        if (data.maxTimePerRound !== undefined) {
          setMaxTimePerRound(data.maxTimePerRound);
          maxTimeRef.current = data.maxTimePerRound;
        }
        if (data.selectionTimeLimit !== undefined) {
          setSelectionTimeLimit(data.selectionTimeLimit);
          selectionLimitRef.current = data.selectionTimeLimit;
        }

        const maxTime =
          data.maxTimePerRound !== undefined
            ? data.maxTimePerRound
            : maxTimeRef.current;
        const selLimit =
          data.selectionTimeLimit !== undefined
            ? data.selectionTimeLimit
            : selectionLimitRef.current;

        // Restore cached draft answers if active sprint is ongoing
        if (data.status === "active_sprint") {
          try {
            const cached = sessionStorage.getItem(`scatterblitz_draft_${roomId}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed?.letter === data.activeLetter && parsed?.answers) {
                setAnswers(parsed.answers);
              }
            }
          } catch (_) {}
        }

        // Synchronize selection countdown target timestamp using synchronized server time
        if (data.selectionStartTime) {
          const selTarget = data.selectionStartTime + selLimit * 1000;
          setSelectionTargetEndTime(selTarget);
          setSelectionTimerSeconds(
            Math.max(0, Math.ceil((selTarget - synchronizedNow) / 1000)),
          );
        } else if (data.selectionTimeLimit !== undefined) {
          const selTarget = synchronizedNow + selLimit * 1000;
          setSelectionTargetEndTime(selTarget);
          setSelectionTimerSeconds(selLimit);
        }

        // Synchronize sprint round countdown target timestamp using synchronized server time
        if (data.roundStartTime) {
          const sprintTarget = data.roundStartTime + maxTime * 1000;
          setSprintTargetEndTime(sprintTarget);
          setTimerSeconds(
            Math.max(0, Math.ceil((sprintTarget - synchronizedNow) / 1000)),
          );
        } else if (data.maxTimePerRound !== undefined) {
          const sprintTarget = synchronizedNow + maxTime * 1000;
          setSprintTargetEndTime(sprintTarget);
          setTimerSeconds(maxTime);
        }
      });

      // Starts letter selection phase for the next player in round-robin
      activeSocket.on("turn:change", (data: any) => {
        const synchronizedNow = Date.now() - serverOffsetRef.current;
        const turnPlayer =
          typeof data === "object" ? data.usersTurn : String(data || "");
        const limit =
          typeof data === "object" && data.selectionTimeLimit
            ? data.selectionTimeLimit
            : selectionLimitRef.current || 15;
        const startTime =
          typeof data === "object" && data.selectionStartTime
            ? data.selectionStartTime
            : synchronizedNow;

        selectionLimitRef.current = limit;
        setSelectionTimeLimit(limit);
        setUsersTurn(turnPlayer);

        const selTarget = startTime + limit * 1000;
        setSelectionTargetEndTime(selTarget);
        const remaining = Math.max(
          0,
          Math.ceil((selTarget - synchronizedNow) / 1000),
        );
        setSelectionTimerSeconds(remaining);

        setStatus("letter_selection");
        statusRef.current = "letter_selection";
        setActiveLetter(null);
        setAnswers({});
        setHasSubmitted(false);
        hasSubmittedRef.current = false;
        setRoundRecapData(null);
        setSkipVotes(null);
        setHasVotedSkip(false);

        try {
          sessionStorage.removeItem(`scatterblitz_draft_${roomId}`);
        } catch (_) {}
      });

      // Begins active sprint round once a letter has been selected
      activeSocket.on("letter:active", (data: any) => {
        const synchronizedNow = Date.now() - serverOffsetRef.current;
        const letterStr =
          typeof data === "object" ? data.letter : String(data || "");
        const startTime =
          typeof data === "object" && data.roundStartTime
            ? data.roundStartTime
            : synchronizedNow;
        const roundTime =
          typeof data === "object" && data.maxTimePerRound
            ? data.maxTimePerRound
            : maxTimeRef.current || 60;

        maxTimeRef.current = roundTime;
        setMaxTimePerRound(roundTime);

        const sprintTarget = startTime + roundTime * 1000;
        setSprintTargetEndTime(sprintTarget);
        const remaining = Math.max(
          0,
          Math.ceil((sprintTarget - synchronizedNow) / 1000),
        );

        setActiveLetter(letterStr);
        setStatus("active_sprint");
        statusRef.current = "active_sprint";
        setAvailableLetters((prev) =>
          prev.filter((l) => l !== letterStr.toUpperCase()),
        );
        setAnswers({});
        setTimerSeconds(remaining);
        setHasSubmitted(false);
        hasSubmittedRef.current = false;
        setRoundRecapData(null);
        setSkipVotes(null);
        setHasVotedSkip(false);
        setCheatNotice(null);

        // Reset telemetry for the new active round
        pasteAttemptsRef.current = 0;
        blurCountRef.current = 0;
        blurStartTimeRef.current = null;
        totalBlurDurationRef.current = 0;
        isAwayRef.current = false;

        try {
          sessionStorage.removeItem(`scatterblitz_draft_${roomId}`);
        } catch (_) {}
      });

      // Triggers recap phase and auto-submits current answers once during buffer window
      activeSocket.on("round:ended", ({ reason }: { reason: string }) => {
        setStatus("recap");
        statusRef.current = "recap";
        submitAnswers(activeSocket);
      });

      // Displays round scores and validation recap from backend
      activeSocket.on("round:recap", (data: any) => {
        if (data) {
          setRoundRecapData(data);
        }
      });

      // Early skip votes updates
      activeSocket.on("recap:skip_update", (data: any) => {
        if (data) {
          setSkipVotes(data);
        }
      });

      // Mid-game forfeit countdown notifications
      activeSocket.on("room:forfeit_warning", (data: any) => {
        setForfeitWarning(data);
      });

      activeSocket.on("room:forfeit_cancelled", (data: any) => {
        setForfeitWarning(null);
      });

      // Finalizes match and displays final scores and submission breakdown
      activeSocket.on("game:ended", (data: any) => {
        setStatus("ended");
        statusRef.current = "ended";
        setForfeitWarning(null);
        if (data) {
          setEndedData(data);
        }
        try {
          sessionStorage.removeItem(`scatterblitz_draft_${roomId}`);
        } catch (_) {}
      });

      activeSocket.on("answer:success", () => {
        setHasSubmitted(true);
        hasSubmittedRef.current = true;
      });

      // Dedicated anti-cheat penalty notification from backend
      activeSocket.on("player:cheatPenalty", (data: any) => {
        const msg = data?.message || "Your score for this round was voided (0 pts) due to suspicious activity.";
        setCheatNotice(msg);
      });

      activeSocket.on("error", (err: any) => {
        const msg = typeof err === "object" ? err?.message : String(err || "");
        const type = typeof err === "object" ? err?.type : "";

        // Suppress benign closed status toasts
        if (msg === "Submit Status Closed") return;

        if (
          type === "authorization" ||
          msg.includes("Unauthorized") ||
          msg.includes("Authentication required")
        ) {
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

  // Accurate timer countdown effect during letter_selection
  useEffect(() => {
    if (status !== "letter_selection" || !selectionTargetEndTime) return;

    const updateSelectionTimer = () => {
      const synchronizedNow = Date.now() - serverOffsetRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((selectionTargetEndTime - synchronizedNow) / 1000),
      );
      setSelectionTimerSeconds(remaining);
    };

    updateSelectionTimer();
    const interval = setInterval(updateSelectionTimer, 200);

    return () => clearInterval(interval);
  }, [status, selectionTargetEndTime, serverOffset]);

  // Accurate timer countdown effect during active_sprint
  useEffect(() => {
    if (status !== "active_sprint" || !sprintTargetEndTime) return;

    // Attach blur and visibilitychange listeners with an atomic isAway guard to prevent duplicate counts
    const markAway = () => {
      if (!isAwayRef.current) {
        isAwayRef.current = true;
        blurCountRef.current += 1;
        blurStartTimeRef.current = Date.now();
      }
    };

    const markBack = () => {
      if (isAwayRef.current) {
        isAwayRef.current = false;
        if (blurStartTimeRef.current) {
          totalBlurDurationRef.current += Date.now() - blurStartTimeRef.current;
          blurStartTimeRef.current = null;
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        markAway();
      } else if (document.visibilityState === "visible") {
        markBack();
      }
    };

    const handleWindowBlur = () => {
      markAway();
    };

    const handleWindowFocus = () => {
      markBack();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    const updateSprintTimer = () => {
      const synchronizedNow = Date.now() - serverOffsetRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((sprintTargetEndTime - synchronizedNow) / 1000),
      );
      setTimerSeconds(remaining);

      // When the sprint hits 0, auto-submit once to server
      if (remaining <= 0) {
        if (socket && !hasSubmittedRef.current) {
          submitAnswers(socket);
        }
      }
    };

    updateSprintTimer();
    const interval = setInterval(updateSprintTimer, 200);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [status, sprintTargetEndTime, socket, serverOffset]);

  // User chooses a letter (when it's their turn)
  const handleSelectLetter = (letter: string) => {
    if (!socket) return;
    if (currentUser?.username !== usersTurn) {
      setError("It is not your turn!");
      return;
    }
    socket.emit("letter:select", { roomID: roomId, letter });
  };

  // User clicks STOP ROUND (available for turn player or any active player on computer turn)
  const handleStopRound = () => {
    if (!socket) return;
    if (!canStopRound) {
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

  const isYourTurn =
    Boolean(currentUser?.username && usersTurn && currentUser.username === usersTurn);
  const canStopRound = isYourTurn || usersTurn === "computer";

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <button onClick={handleExitGame} className={styles.exitBtn}>
        <FaArrowLeft /> Back
      </button>
      <div className={styles.gameContainer}>
        {/* FORFEIT WARNING BANNER */}
        {forfeitWarning && (
          <div
            className={styles.errorBanner}
            style={{
              backgroundColor: "rgba(255, 183, 3, 0.15)",
              borderColor: "var(--amber)",
              color: "var(--amber)",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <FaClock />
              <span>
                {forfeitWarning.message} ({forfeitWarning.remainingSeconds}s)
              </span>
            </div>
          </div>
        )}

        {/* MAIN GRID */}

        {/* STATUS 1: LETTER SELECTION */}
        {status === "letter_selection" && (
          <section className={styles.letterSelectionSection}>
            <h2 className={styles.sectionTitle}>
              <FaSpellCheck
                style={{ marginRight: "0.5rem", color: "var(--amber)" }}
              />
              CHOOSE A LETTER
            </h2>

            <div
              className={`${styles.turnNotice} ${isYourTurn ? styles.turnNoticeActive : styles.turnNoticeWaiting}`}
            >
              {isYourTurn
                ? `⚡ It's YOUR TURN! Click any letter below in ${String(selectionTimerSeconds).padStart(2, "0")}s or a random letter will be chosen for you.`
                : `Waiting for ${usersTurn || "the player"} to pick a letter (${String(selectionTimerSeconds).padStart(2, "0")}s remaining)...`}
            </div>

            <div className={styles.lettersGrid}>
              {(allLetters.length > 0 ? allLetters : availableLetters).map(
                (letter) => {
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
                      title={
                        !isAvailable
                          ? "Already selected"
                          : !isYourTurn
                            ? "Waiting for turn player"
                            : `Pick Letter ${letter}`
                      }
                    >
                      {letter}
                    </button>
                  );
                },
              )}
            </div>
          </section>
        )}

        {/* STATUS 2: ACTIVE SPRINT */}
        {status === "active_sprint" && (
          <section className={styles.activeSprintSection}>
            <h2 className={styles.activeTimer}>
              {String(timerSeconds).padStart(2, "0")}
            </h2>
            <div className={styles.activeLetterBox}>{activeLetter || "?"}</div>

            <div className={styles.categoriesContainer}>
              {categories.map((category, index) => (
                <label key={category} className={styles.categoryLabel}>
                  {category}:
                  <input
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
                    type="text"
                    className={styles.categoryInput}
                    placeholder={`Type a ${category} starting with ${activeLetter}...`}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-form-type="other"
                    onFocus={() => {
                      if (socket) {
                        socket.emit("input:focus", { roomID: roomId, category });
                      }
                    }}
                    onBlur={() => {
                      if (socket) {
                        socket.emit("input:blur", { roomID: roomId, category });
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      pasteAttemptsRef.current += 1;
                      setError("Copy & paste is not allowed in ScatterBlitz! Please type your answer.");
                    }}
                    value={answers[category] || ""}
                    onChange={(e) => {
                      const updated = {
                        ...answers,
                        [category]: e.target.value,
                      };
                      setAnswers(updated);
                      // Cache locally in sessionStorage so refresh preserves all answers
                      try {
                        sessionStorage.setItem(
                          `scatterblitz_draft_${roomId}`,
                          JSON.stringify({ letter: activeLetter, answers: updated })
                        );
                      } catch (_) {}
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
            {canStopRound && (
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
              {!roundRecapData ? (
                <>
                  <FaSpinner className={styles.spinIcon} />
                  <h3 style={{ fontSize: "2rem", fontWeight: 800 }}>
                    Round Ended!
                  </h3>
                  <p style={{ color: "var(--text-muted)" }}>
                    Collecting answers and calculating scores...
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.recapHeader}>
                    <span className={styles.roundLetterBadgePlain}>
                      Round {roundRecapData.round} • Letter "{roundRecapData.letter}"
                    </span>
                    <h3 className={styles.recapTitle}>
                      Round Recap
                    </h3>
                  </div>

                  {/* ROUND SCORES & BREAKDOWN GRID */}
                  <div className={styles.recapStandingsGrid}>
                    {(
                      roundRecapData.roundStandings ||
                      participants.map((p) => ({
                        username: p.username,
                        roundPoints: 0,
                        cumulativeScore: p.score,
                      }))
                    ).map((player, pIdx) => {
                      const userAnswers = roundRecapData.scores[player.username] || {};
                      const isWinner = roundRecapData.roundWinners?.includes(player.username);

                      return (
                        <div
                          key={pIdx}
                          className={`${styles.recapPlayerCard} ${
                            isWinner ? styles.recapPlayerCardWinner : ""
                          }`}
                        >
                          <div className={styles.recapPlayerTop}>
                            <span className={styles.recapPlayerName}>
                              {player.username}
                            </span>
                            <span className={styles.recapRoundPoints}>
                              +{player.roundPoints} pts
                            </span>
                          </div>
                          <span className={styles.recapCumulativeScore}>
                            Total: {player.cumulativeScore} pts
                          </span>

                          <div className={styles.recapAnswersList}>
                            {categories.map((cat, cIdx) => {
                              const item = (userAnswers[cat] || { answer: "", score: 0 }) as {
                                answer: string;
                                score: number;
                                cheated?: boolean;
                              };
                              const pts = item.score;
                              const isCheated = item.cheated;
                              return (
                                <div key={cIdx} className={styles.recapAnswerRow}>
                                  <span className={styles.recapCategoryName}>
                                    {cat}:
                                  </span>
                                  <span
                                    className={styles.recapAnswerValue}
                                    style={{
                                      color: isCheated
                                        ? "#ff6b6b"
                                        : pts === 5
                                        ? "#4CAF50"
                                        : pts > 0
                                        ? "#8BC34A"
                                        : item.answer
                                        ? "#F44336"
                                        : "var(--text-dim)",
                                    }}
                                  >
                                    {isCheated && item.answer
                                      ? `${item.answer} (0 - Voided)`
                                      : item.answer
                                      ? `${item.answer} (+${pts})`
                                      : "— (0)"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* EARLY SKIP RECAP BUTTON */}
                  <button
                    type="button"
                    className={styles.skipRecapBtn}
                    onClick={handleVoteSkipRecap}
                    disabled={hasVotedSkip}
                  >
                    <FaForward />
                    {hasVotedSkip
                      ? `Ready (${skipVotes?.votes || 1}/${skipVotes?.total || participants.length})`
                      : `Skip to Next Round (${skipVotes?.votes || 0}/${skipVotes?.total || participants.length})`}
                  </button>
                </>
              )}
            </div>
          </section>
        )}

        {/* STATUS 4: ENDED */}
        {status === "ended" && (
          <section className={styles.endedSection}>
            <div className={styles.endedContainer}>
              {!reviewParticipant ? (
                /* VIEW A: STANDINGS / LEADERBOARD */
                <>
                  <div className={styles.winnerCard}>
                    <FaTrophy size={100} style={{ color: "var(--gold)" }} />
                    <h2 style={{ fontSize: "3rem", fontWeight: 900 }}>
                      Match Completed!
                    </h2>
                    {endedData?.forfeit && endedData?.winner && (
                      <p style={{ color: "var(--amber)", fontSize: "1.1rem", fontWeight: 700 }}>
                        🏆 Won by forfeit ({endedData.winner} remained standing)
                      </p>
                    )}
                  </div>

                  <div className={styles.standingsCard}>
                    <h3 className={styles.standingsTitle}>
                      <FaTrophy style={{ color: "var(--gold)" }} /> Final
                      Standings
                    </h3>
                    <div className={styles.standingsList}>
                      {(
                        endedData?.standings ||
                        participants
                          .map((p: any) => ({
                            username: p.username,
                            score: p.score,
                            isHost: false,
                          }))
                          .sort((a: any, b: any) => b.score - a.score)
                      ).map((p: any, idx: number) => {
                        const rank = idx + 1;
                        return (
                          <div key={idx} className={styles.standingRow}>
                            <div className={styles.standingRankInfo}>
                              <span
                                className={`${styles.rankBadge} ${rank === 1 ? styles.rank1 : rank === 2 ? styles.rank2 : rank === 3 ? styles.rank3 : ""}`}
                              >
                                {rank === 1 ? (
                                  <FaTrophy />
                                ) : rank === 2 ? (
                                  <FaMedal />
                                ) : rank === 3 ? (
                                  <FaAward />
                                ) : (
                                  `#${rank}`
                                )}
                              </span>
                              <span className={styles.standingUsername}>
                                {p.username}
                              </span>
                            </div>
                            <div className={styles.standingActions}>
                              <span className={styles.standingScore}>
                                {p.score} pts
                              </span>
                              <button
                                className={styles.reviewBtn}
                                onClick={() => {
                                  setReviewParticipant(p.username);
                                  setReviewRoundIndex(0);
                                }}
                              >
                                <FaEye /> 
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={handleExitGame} className={styles.returnBtn}>
                    Return to Home Page 
                  </button>
                </>
              ) : (
                /* VIEW B: ROUND-BY-ROUND REVIEW FOR SELECTED PARTICIPANT */
                (() => {
                  const letters = Object.keys(endedData?.submissions || {});
                  const currentReviewLetter = letters[reviewRoundIndex] || "";
                  const participantAnswers = reviewParticipant
                    ? endedData?.submissions?.[currentReviewLetter]?.[
                        reviewParticipant
                      ] || {}
                    : {};

                  return (
                    <div className={styles.reviewContainer}>
                      <div className={styles.reviewHeader}>
  
                        <div className={styles.reviewTitleBox}>
                          <h2 className={styles.reviewTitle}>
                            Reviewing:{" "}
                            <span style={{ color: "var(--amber)" }}>
                              {reviewParticipant ? String(reviewParticipant).toUpperCase() : ""}
                            </span>
                          </h2>
                          <span className={styles.roundLetterBadgePlain}>
                            Round {reviewRoundIndex + 1} of{" "}
                            {letters.length || 1} • Letter "
                            {currentReviewLetter}"
                          </span>
                        </div>
                      </div>

                      <div className={styles.reviewCategoryGrid}>
                        {categories.map((cat, catIdx) => {
                          const entry = (participantAnswers[cat] || {
                            answer: "",
                            score: 0,
                          }) as { answer: string; score: number; cheated?: boolean };
                          const rawAns = entry.answer || "";
                          const score = entry.score || 0;
                          const isCheated = entry.cheated;

                          let badgeText = "0 pts";
                          let badgeColor = "#777777";

                          if (isCheated && rawAns) {
                            badgeText = "Voided (Cheat)";
                            badgeColor = "#ff6b6b";
                          } else if (score === 5) {
                            badgeText = "+5 pts";
                            badgeColor = "#4CAF50";
                          } else if (score > 0) {
                            badgeText = `+${score} pts`;
                            badgeColor = "#8BC34A";
                          } else if (rawAns) {
                            badgeText = "0 pts";
                            badgeColor = "#F44336";
                          }

                          return (
                            <label
                              key={catIdx}
                              className={styles.reviewDiv}
                              style={{ borderColor: badgeColor }}
                            >
                              {cat}:
                              <input
                                type="text"
                                readOnly
                                disabled
                                value={rawAns || "(No Answer Submitted)"}
                                className={styles.reviewInput}
                              />
                              <span
                                className={styles.reviewScoreBadge}
                                style={{
                                  color: badgeColor,
                                  borderColor: badgeColor,
                                }}
                              >
                                {badgeText}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className={styles.reviewNavFooter}>
                        {reviewRoundIndex > 0 && (
                          <button
                            className={styles.navRoundBtn}
                            onClick={() =>
                              setReviewRoundIndex((prev) => Math.max(0, prev - 1))
                            }
                          >
                            <FaChevronLeft />
                          </button>
                        )}

                        {reviewRoundIndex >= letters.length - 1 ? (
                          <button
                            className={styles.stopReviewBtn}
                            onClick={() => setReviewParticipant(null)}
                          >
                            Stop Review
                          </button>
                        ) : (
                          <button
                            className={styles.navRoundBtn}
                            onClick={() =>
                              setReviewRoundIndex((prev) =>
                                Math.min(letters.length - 1, prev + 1),
                              )
                            }
                          >
                            <FaChevronRight />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
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
        onCloseRoomModal={() => router.push("/games/join")}
        showNotStartedModal={showNotStartedModal}
        notStartedMsg={notStartedMsg}
        onCloseNotStartedModal={() => router.push(`/games/${roomId}`)}
      />

      {/* BOTTOM-RIGHT AUTO-DISMISSING TOASTS WITH TIMER BARS */}
      <Toast
        message={error}
        type="error"
        duration={3500}
        onClose={() => setError(null)}
      />
      <Toast
        message={cheatNotice}
        type="error"
        duration={6000}
        onClose={() => setCheatNotice(null)}
      />
    </main>
  );
}

export default function GamePage() {
  return <GameContent />;
}
