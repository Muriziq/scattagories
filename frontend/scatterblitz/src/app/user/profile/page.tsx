"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FaUser,
  FaCamera,
  FaSpinner,
  FaTrophy,
  FaArrowLeft,
  FaCheckCircle,
  FaCalendarAlt,
  FaClock,
  FaExclamationTriangle,
  FaChevronLeft,
  FaChevronRight,
  FaTimes,
  FaEye,
} from "react-icons/fa";
import styles from "./profile.module.css";
import CanvasBackground from "../../components/CanvasBackground";
import { API_BASE_URL } from "../../../config/api";
import {
  authFetch,
  getAccessToken,
  saveAccessToken,
  updateUserData,
} from "../../accessToken";

interface ProfileUser {
  id: string;
  username: string;
  email: string | null;
  is_email_verified: boolean;
  avatar_url: string | null;
  created_at: string;
}

interface ProfileStats {
  totalGames: number;
  totalWins: number;
  winRate: number;
  highScore: number;
  averageScore: number;
}

interface MatchHistoryItem {
  game_id: string;
  room_code: string;
  score: number;
  rank: number;
  is_winner: boolean;
  categories: string[];
  total_rounds: number;
  rounds_data?: Record<
    string,
    Record<string, Record<string, { answer: string; score: number }>>
  >;
  ended_at: string;
}

const getOrdinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const getOrdinalParts = (n: number): { num: number; suffix: string } => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return { num: n, suffix: s[(v - 20) % 10] || s[v] || s[0] };
};

const getPlacementColor = (rank: number, isWinner: boolean): string => {
  if (isWinner || rank === 1) return "#4CAF50"; // Green
  if (rank === 2) return "#38bdf8"; // Sky Blue
  if (rank === 3) return "#fbbf24"; // Amber / Gold
  if (rank === 4) return "#fb923c"; // Orange
  return "var(--text-muted)";
};

export default function Profile() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  // Match history state
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // Inspect Match state (Ternary view: full width inspect review vs profile content)
  const [inspectMatch, setInspectMatch] = useState<MatchHistoryItem | null>(null);
  const [inspectLetterIdx, setInspectLetterIdx] = useState(0);
  const [selectedInspectPlayer, setSelectedInspectPlayer] = useState<string>("");

  // Email verification resend state
  const [sendingVerification, setSendingVerification] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast feedback
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error") => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const fetchProfile = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/user/profile`);
      const data = await res.json();
      if (res.ok && (data.user || data.success)) {
        setUser(data.user);
        setStats(data.stats);
      } else {
        showToast(data.message || "Failed to load profile", "error");
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      showToast("Network error loading profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async (targetPage: number = 1, append: boolean = false) => {
    setLoadingMatches(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/user/profile/matches?page=${targetPage}&limit=20`
      );
      const data = await res.json();
      if (res.ok && (data.matches || data.success)) {
        const newMatches: MatchHistoryItem[] = data.matches || [];
        setMatches((prev) => (append ? [...prev, ...newMatches] : newMatches));
        setHasMore(data.pagination?.hasMore || false);
        setPage(targetPage);
      } else {
        showToast(data.message || "Failed to load match history", "error");
      }
    } catch (err) {
      console.error("Error loading matches:", err);
      showToast("Network error loading matches", "error");
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchMatches(1, false);
  }, []);

  const handleResendVerification = async () => {
    if (sendingVerification) return;
    setSendingVerification(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/user/sendVerification`, {
        method: "POST",
        body: JSON.stringify({ email: user?.email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Verification email sent! Check your inbox.", "success");
      } else {
        showToast(data.message || "Could not resend email", "error");
      }
    } catch (err) {
      console.error("Resend error:", err);
      showToast("Network error resending verification", "error");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file", "error");
      return;
    }

    // 2MB limit as requested
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image must be smaller than 2MB", "error");
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    setUploadingAvatar(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/user/profile/avatar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUser((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : null));
        updateUserData({ avatar_url: data.avatar_url });
        showToast("Avatar updated successfully!", "success");
      } else {
        showToast(data.message || "Avatar upload failed", "error");
      }
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast("Network error uploading avatar", "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openInspectView = (match: MatchHistoryItem) => {
    setInspectMatch(match);
    setInspectLetterIdx(0);
    if (match.rounds_data) {
      const firstLetter = Object.keys(match.rounds_data)[0];
      const players = firstLetter ? Object.keys(match.rounds_data[firstLetter] || {}) : [];
      if (user?.username && players.includes(user.username)) {
        setSelectedInspectPlayer(user.username);
      } else {
        setSelectedInspectPlayer(players[0] || "");
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const isGuest = !user?.email;

  // Rounds data navigation for Inspect View
  const letters = inspectMatch?.rounds_data ? Object.keys(inspectMatch.rounds_data) : [];
  const activeLetter = letters[inspectLetterIdx] || "";
  const roundLetterSubmissions =
    (inspectMatch?.rounds_data && activeLetter && inspectMatch.rounds_data[activeLetter]) || {};
  const availablePlayers = Object.keys(roundLetterSubmissions);
  const currentPlayer = selectedInspectPlayer || availablePlayers[0] || user?.username || "";
  const playerAnswers = roundLetterSubmissions[currentPlayer] || {};
  const categoriesList =
    inspectMatch?.categories && inspectMatch.categories.length > 0
      ? inspectMatch.categories
      : Object.keys(playerAnswers);

  if (loading) {
    return (
      <main className={styles.main}>
        <CanvasBackground />
        <div className={styles.loadingWrapper}>
          <FaSpinner className="spin" size={40} style={{ color: "var(--amber)" }} />
          <p style={{ marginTop: "1rem", color: "var(--text-muted)" }}>Loading your profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <CanvasBackground />

      {inspectMatch ? (
        /* ================= FULL-WIDTH INSPECT MATCH VIEW ================= */
        <section className={styles.inspectSection}>
          <div className={styles.topNav}>
            <button
              type="button"
              onClick={() => setInspectMatch(null)}
              className={styles.backButton}
            >
              <FaArrowLeft /> Back to Profile
            </button>
          </div>

          <div className={styles.reviewContainer}>
            <div className={styles.reviewHeader}>
              <div className={styles.reviewTitleBox}>
                <h2 className={styles.reviewTitle}>
                  Reviewing:{" "}
                  <span style={{ color: "var(--amber)" }}>
                    {currentPlayer ? String(currentPlayer).toUpperCase() : ""}
                  </span>
                </h2>
                <span className={styles.roundLetterBadgePlain}>
                  Match #{inspectMatch.room_code} • Round {inspectLetterIdx + 1} of{" "}
                  {letters.length || 1} • Letter "{activeLetter}"
                </span>
              </div>
              
            </div>

            {/* PLAYER TABS: View self or inspect opponents */}
            {availablePlayers.length > 1 && (
              <div className={styles.playerTabList}>
                {availablePlayers.map((uname) => (
                  <button
                    key={uname}
                    type="button"
                    className={`${styles.playerTab} ${
                      currentPlayer === uname ? styles.playerTabActive : ""
                    }`}
                    onClick={() => setSelectedInspectPlayer(uname)}
                  >
                    {uname === user?.username ? "My Answers" : uname}
                  </button>
                ))}
              </div>
            )}

            {/* CATEGORIES & SCORES BREAKDOWN */}
            <div className={styles.reviewCategoryGrid}>
              {categoriesList.map((cat, cIdx) => {
                const entry = playerAnswers[cat] || { answer: "", score: 0 };
                const rawAns = entry.answer || "";
                const score = entry.score || 0;

                let badgeColor = "#777777";
                let badgeText = "0 pts";
                if (score === 5) {
                  badgeColor = "#4CAF50";
                  badgeText = "+5 pts";
                } else if (score > 0) {
                  badgeColor = "#8BC34A";
                  badgeText = `+${score} pts`;
                } else if (rawAns) {
                  badgeColor = "#F44336";
                  badgeText = "0 pts";
                }

                return (
                  <label
                    key={cIdx}
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
                      style={{ color: badgeColor, borderColor: badgeColor }}
                    >
                      {badgeText}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* ROUND PAGING NAVIGATION FOOTER */}
            <div className={styles.reviewNavFooter}>
              {inspectLetterIdx > 0 && (
                <button
                  type="button"
                  className={styles.navRoundBtn}
                  onClick={() => setInspectLetterIdx((prev) => Math.max(0, prev - 1))}
                >
                  <FaChevronLeft />
                </button>
              )}

              {inspectLetterIdx >= letters.length - 1 ? (
                <button
                  type="button"
                  className={styles.stopReviewBtn}
                  onClick={() => setInspectMatch(null)}
                >
                  Stop Review
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.navRoundBtn}
                  onClick={() =>
                    setInspectLetterIdx((prev) => Math.min(letters.length - 1, prev + 1))
                  }
                >
                  <FaChevronRight />
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        /* ================= REGULAR PROFILE VIEW ================= */
        <>
          {/* TOP NAVIGATION BAR */}
          <div className={styles.topNav}>
            <button type="button" onClick={() => router.push("/")} className={styles.backButton}>
              <FaArrowLeft /> Back
            </button>
          </div>

          {/* GUEST BANNER */}
          {isGuest && (
            <div className={styles.guestBanner}>
              <div className={styles.guestBannerText}>
                <FaExclamationTriangle style={{ color: "var(--amber)", fontSize: "1.2rem" }} />
                <span>
                  You are currently using a temporary guest account. Convert to a permanent account to keep your stats!
                </span>
              </div>
              <Link href="/user/convert-guest" className={styles.guestConvertBtn}>
                Convert Account
              </Link>
            </div>
          )}

          {/* UNVERIFIED EMAIL BANNER */}
          {!isGuest && user && !user.is_email_verified && (
            <div className={styles.verifyBanner}>
              <div className={styles.guestBannerText}>
                <FaExclamationTriangle style={{ color: "var(--safety-orange)", fontSize: "1.2rem" }} />
                <span>
                  Your email address ({user.email}) is not verified. Please verify your email to secure your account.
                </span>
              </div>
              <button
                type="button"
                className={styles.resendBtn}
                onClick={handleResendVerification}
                disabled={sendingVerification}
              >
                {sendingVerification ? (
                  <>
                    <FaSpinner className="spin" style={{ marginRight: "0.4rem" }} /> Sending...
                  </>
                ) : (
                  "Resend Verification"
                )}
              </button>
            </div>
          )}

          {/* USER INFO SECTION */}
          <section className={styles.userInfoSection}>
            <div
              className={`${styles.avatarContainer} ${
                uploadingAvatar ? styles.avatarContainerLoading : ""
              }`}
              onClick={() => {
                if (!uploadingAvatar) fileInputRef.current?.click();
              }}
              title="Click to change avatar"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.username || "Avatar"}
                  className={styles.userImage}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  <FaUser className={styles.userIcon} />
                </div>
              )}

              <div className={styles.avatarOverlay}>
                {uploadingAvatar ? (
                  <FaSpinner className="spin" size={20} />
                ) : (
                  <>
                    <FaCamera size={18} />
                    <span>Change</span>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className={styles.fileInput}
                onChange={handleAvatarFileChange}
              />
            </div>

            <h1 className={styles.username}>{user?.username || "Player"}</h1>

            <div className={styles.userMeta}>
              <span className={styles.joinDate}>
                <FaCalendarAlt style={{ marginRight: "0.4rem", color: "var(--amber)" }} />
                Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "Recently"}
              </span>
              {!isGuest && (
                <span className={styles.emailBadge}>
                  {user?.is_email_verified ? (
                    <span className={styles.verifiedBadge}>
                      <FaCheckCircle size={13} /> Verified
                    </span>
                  ) : (
                    <span className={styles.unverifiedBadge}>
                      Unverified
                    </span>
                  )}
                </span>
              )}
            </div>
          </section>

          {/* LIFETIME STATS CARDS */}
          <section className={styles.statsSection}>
            <div className={styles.statCard}>
              <span className={styles.statTitle}>Matches</span>
              <p className={styles.statValue}>{stats?.totalGames ?? 0}</p>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statTitle}>Wins</span>
              <p className={styles.statValue}>{stats?.totalWins ?? 0}</p>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statTitle}>Win Rate</span>
              <p className={styles.statValue}>{stats?.winRate ?? 0}%</p>
            </div>

            <div className={styles.statCard}>
              <span className={styles.statTitle}>High Score</span>
              <p className={styles.statValue}>{stats?.highScore ?? 0} pts</p>
            </div>
          </section>

          {/* MATCH HISTORY */}
          <section className={styles.historySection}>
            <div className={styles.tableContainer}>
              <table className={styles.historyTable}>
                <thead className={styles.tableHead}>
                  <tr className={styles.tableHeaderRow}>
                    <th className={styles.tableHeaderCell}>Room Code</th>
                    <th className={styles.tableHeaderCell}>Date & Time</th>
                    <th className={styles.tableHeaderCell}>Placement</th>
                    <th className={styles.tableHeaderCell}>Final Score</th>
                    <th className={styles.tableHeaderCell}>Rounds</th>
                    <th className={styles.tableHeaderCell}>Categories</th>
                    <th className={styles.tableHeaderCell} style={{ textAlign: "center" }}>Inspect</th>
                  </tr>
                </thead>
                <tbody className={styles.tableBody}>
                  {matches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className={styles.emptyState}>
                        <FaTrophy size={36} style={{ color: "var(--amber)", opacity: 0.6 }} />
                        <p>No matches recorded yet. Jump into a room and play a round!</p>
                      </td>
                    </tr>
                  ) : (
                    matches.map((item, idx) => {
                      const is1st = item.is_winner || item.rank === 1;
                      const dateObj = item.ended_at ? new Date(item.ended_at) : null;
                      const dateStr = dateObj
                        ? `${dateObj.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })} • ${dateObj.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`
                        : "—";

                      const rankNum = item.rank || (is1st ? 1 : 0);
                      const placementText = rankNum > 0 ? getOrdinal(rankNum) : "Finished";
                      const placementColor = getPlacementColor(rankNum, is1st);

                      const roundCount = item.total_rounds || 1;
                      const roundsLabel = `${roundCount} ${roundCount > 1 ? "rounds" : "round"}`;

                      const hasRoundsData =
                        item.rounds_data && Object.keys(item.rounds_data).length > 0;

                      return (
                        <tr key={item.game_id || idx} className={styles.tableRow}>
                          <td className={styles.tableCell}>
                            <span className={styles.roomCodeBadge}>#{item.room_code || "ROOM"}</span>
                          </td>
                          <td className={styles.tableCell}>
                            <span className={styles.dateTimeCell}>
                              <FaClock size={12} style={{ color: "var(--amber)", opacity: 0.8 }} />
                              {dateStr}
                            </span>
                          </td>
                          <td className={styles.tableCell}>
                            {rankNum > 0 ? (
                              <span className={styles.scoreText}>
                                {getOrdinalParts(rankNum).num}
                                <sup className={styles.ordinalSuffix}>
                                  {getOrdinalParts(rankNum).suffix}
                                </sup>
                              </span>
                            ) : (
                              <span className={styles.placementText}>Finished</span>
                            )}
                          </td>
                          <td className={styles.tableCell}>
                            <span className={styles.scoreText}>{item.score}</span> <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>pts</span>
                          </td>
                          <td className={styles.tableCell}>
                            <span className={styles.roundsText}>{roundsLabel}</span>
                          </td>
                          <td className={styles.tableCell}>
                            {item.categories && item.categories.length > 0 ? (
                              <div className={styles.categoryPillsWrapper}>
                                {item.categories.map((c, cIdx) => (
                                  <span key={cIdx} className={styles.categoryPill}>
                                    {c}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>
                          <td className={`${styles.tableCell} ${styles.tableCellCenter}`} style={{ textAlign: "center" }}>
                            {hasRoundsData ? (
                              <button
                                type="button"
                                className={styles.inspectBtn}
                                onClick={() => openInspectView(item)}
                                title="Inspect Match"
                                aria-label="Inspect Match"
                              >
                                <FaEye />
                              </button>
                            ) : (
                              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={() => fetchMatches(page + 1, true)}
                disabled={loadingMatches}
              >
                {loadingMatches ? (
                  <>
                    <FaSpinner className="spin" style={{ marginRight: "0.5rem" }} /> Loading...
                  </>
                ) : (
                  "Load More Matches"
                )}
              </button>
            )}
          </section>
        </>
      )}

      {/* TOAST FEEDBACK */}
      {toast && (
        <div
          className={`${styles.toast} ${
            toast.type === "success" ? styles.toastSuccess : styles.toastError
          }`}
        >
          {toast.text}
        </div>
      )}
    </main>
  );
}
