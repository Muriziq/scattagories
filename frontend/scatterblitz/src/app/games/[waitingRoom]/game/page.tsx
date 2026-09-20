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
} from "react-icons/fa";
import styles from "./game.module.css";
import { useSocket } from "../SocketContext";
import { getUserData, createNewGuest } from "../../../accessToken";
import AuthModel from "../../authModels";
import ErrorModals from "../ErrorModals";
import CanvasBackground from "../../../components/CanvasBackground";

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
    { username: string; score: number }[]
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

  const maxTimeRef = useRef<number>(60);
  maxTimeRef.current = maxTimePerRound;
  const selectionLimitRef = useRef<number>(15);
  selectionLimitRef.current = selectionTimeLimit;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Game End & Review state
  const [endedData, setEndedData] = useState<{
    submissions: Record<
      string,
      Record<string, Record<string, { answer: string; score: number }>>
    >;
    standings: Array<{ username: string; score: number; isHost: boolean }>;
  } | null>(null);
  const [reviewParticipant, setReviewParticipant] = useState<string | null>(
    null,
  );
  const [reviewRoundIndex, setReviewRoundIndex] = useState<number>(0);

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

        if (data.selectionStartTime) {
          const selTarget = data.selectionStartTime + selLimit * 1000;
          setSelectionTargetEndTime(selTarget);
          setSelectionTimerSeconds(
            Math.max(0, Math.ceil((selTarget - Date.now()) / 1000)),
          );
        } else if (data.selectionTimeLimit !== undefined) {
          const selTarget = Date.now() + selLimit * 1000;
          setSelectionTargetEndTime(selTarget);
          setSelectionTimerSeconds(selLimit);
        }

        if (data.roundStartTime) {
          const sprintTarget = data.roundStartTime + maxTime * 1000;
          setSprintTargetEndTime(sprintTarget);
          setTimerSeconds(
            Math.max(0, Math.ceil((sprintTarget - Date.now()) / 1000)),
          );
        } else if (data.maxTimePerRound !== undefined) {
          const sprintTarget = Date.now() + maxTime * 1000;
          setSprintTargetEndTime(sprintTarget);
          setTimerSeconds(maxTime);
        }
      });

      activeSocket.on("turn:change", (data: any) => {
        const turnPlayer =
          typeof data === "object" ? data.usersTurn : String(data || "");
        const limit =
          typeof data === "object" && data.selectionTimeLimit
            ? data.selectionTimeLimit
            : selectionLimitRef.current || 15;
        const startTime =
          typeof data === "object" && data.selectionStartTime
            ? data.selectionStartTime
            : Date.now();

        selectionLimitRef.current = limit;
        setSelectionTimeLimit(limit);
        setUsersTurn(turnPlayer);

        const selTarget = startTime + limit * 1000;
        setSelectionTargetEndTime(selTarget);
        const remaining = Math.max(
          0,
          Math.ceil((selTarget - Date.now()) / 1000),
        );
        setSelectionTimerSeconds(remaining);

        setStatus("letter_selection");
        setActiveLetter(null);
        setAnswers({});
        setHasSubmitted(false);
      });

      activeSocket.on("letter:active", (data: any) => {
        const letterStr =
          typeof data === "object" ? data.letter : String(data || "");
        const startTime =
          typeof data === "object" && data.roundStartTime
            ? data.roundStartTime
            : Date.now();
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
          Math.ceil((sprintTarget - Date.now()) / 1000),
        );

        setActiveLetter(letterStr);
        setStatus("active_sprint");
        setAvailableLetters((prev) =>
          prev.filter((l) => l !== letterStr.toUpperCase()),
        );
        setTimerSeconds(remaining);
        setHasSubmitted(false);
      });

      activeSocket.on("round:ended", ({ reason }: { reason: string }) => {
        setStatus("recap");
        submitAnswers(activeSocket);
      });

      activeSocket.on("game:ended", (data: any) => {
        setStatus("ended");
        if (data) {
          setEndedData(data);
        }
      });

      activeSocket.on("answer:success", () => {
        setHasSubmitted(true);
      });

      activeSocket.on("error", (err: any) => {
        const msg = typeof err === "object" ? err?.message : String(err || "");
        const type = typeof err === "object" ? err?.type : "";

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
          setTimeout(() => setError(null), 1000);
        }
      });
    };

    setup();
  }, [roomId]);

  // Accurate timer countdown effect during letter_selection using target timestamp
  useEffect(() => {
    if (status !== "letter_selection" || !selectionTargetEndTime) return;

    const updateSelectionTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((selectionTargetEndTime - Date.now()) / 1000),
      );
      setSelectionTimerSeconds(remaining);
    };

    updateSelectionTimer();
    const interval = setInterval(updateSelectionTimer, 200);

    return () => clearInterval(interval);
  }, [status, selectionTargetEndTime]);

  // Accurate timer countdown effect during active_sprint using target timestamp
  useEffect(() => {
    if (status !== "active_sprint" || !sprintTargetEndTime) return;

    const updateSprintTimer = () => {
      const remaining = Math.max(
        0,
        Math.ceil((sprintTargetEndTime - Date.now()) / 1000),
      );
      setTimerSeconds(remaining);

      if (remaining <= 0) {
        if (socket) {
          submitAnswers(socket);
        }
      }
    };

    updateSprintTimer();
    const interval = setInterval(updateSprintTimer, 200);

    return () => clearInterval(interval);
  }, [status, sprintTargetEndTime, socket]);

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

  const isYourTurn =
    currentUser?.username && usersTurn && currentUser.username === usersTurn;

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <button onClick={handleExitGame} className={styles.exitBtn}>
        <FaArrowLeft /> Lobby
      </button>
      <div className={styles.gameContainer}>
        {/* ERROR BANNER */}
        {error && (
          <div className={styles.errorBanner}>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
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
              <h3 style={{ fontSize: "2rem", fontWeight: 800 }}>
                Round Ended!
              </h3>
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
              {!reviewParticipant ? (
                /* VIEW A: STANDINGS / LEADERBOARD */
                <>
                  <div className={styles.winnerCard}>
                    <FaTrophy size={100} style={{ color: "var(--gold)" }} />
                    <h2 style={{ fontSize: "3rem", fontWeight: 900 }}>
                      Match Completed!
                    </h2>
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
                            username: p.username || p.displayName,
                            score: p.score,
                            isHost: p.isHost || false,
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
                    Return to Waiting Room
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
                              {reviewParticipant}
                            </span>
                          </h2>
                          <span className={styles.roundLetterBadge}>
                            Round {reviewRoundIndex + 1} of{" "}
                            {letters.length || 1} • Letter "
                            {currentReviewLetter}"
                          </span>
                        </div>
                      </div>

                      <div className={styles.reviewCategoryGrid}>
                        {categories.map((cat, catIdx) => {
                          const entry = participantAnswers[cat] || {
                            answer: "",
                            score: 0,
                          };
                          const rawAns = entry.answer || "";
                          const score = entry.score || 0;

                          let cardStyle = styles.reviewCardEmpty;
                          let badgeText = "0 pts";
                          let badgeColor = "#777777";
                          let Icon = FaTimesCircle;

                          if (score === 5) {
                            cardStyle = styles.reviewCardUnique;
                            badgeText = "+5 pts";
                            badgeColor = "#4CAF50";
                            Icon = FaCheckCircle;
                          } else if (score > 0) {
                            cardStyle = styles.reviewCardDuplicate;
                            badgeText = `+${score} pts`;
                            badgeColor = "#8BC34A";
                            Icon = FaCheckCircle;
                          } else if (rawAns) {
                            cardStyle = styles.reviewCardInvalid;
                            badgeText = "0 pts ";
                            badgeColor = "#F44336";
                            Icon = FaTimesCircle;
                          }

                          return (
                            <label
                              key={catIdx}
                              className={styles.reviewDiv}
                              style={{borderColor:badgeColor}}
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
                        <button
                          className={styles.navRoundBtn}
                          disabled={reviewRoundIndex === 0}
                          onClick={() =>
                            setReviewRoundIndex((prev) => Math.max(0, prev - 1))
                          }
                        >
                          <FaChevronLeft />
                        </button>
                        <button
                          className={styles.stopReviewBtn}
                          onClick={() => setReviewParticipant(null)}
                        >
                          Stop Review
                        </button>
                        <button
                          className={styles.navRoundBtn}
                          disabled={reviewRoundIndex >= letters.length - 1}
                          onClick={() =>
                            setReviewRoundIndex((prev) =>
                              Math.min(letters.length - 1, prev + 1),
                            )
                          }
                        >
                         <FaChevronRight />
                        </button>
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
    <Suspense
      fallback={
        <main className={styles.main}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              color: "var(--amber)",
            }}
          >
            <FaSpinner className={styles.spinIcon} size={32} />
            <h2>Loading Game Board...</h2>
          </div>
        </main>
      }
    >
      <GameContent />
    </Suspense>
  );
}
