"use client";
import { useEffect, useState, useRef, FormEvent } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  FaGithub, 
  FaLinkedinIn, 
  FaTwitter, 
  FaBolt, 
  FaGamepad, 
  FaUserCircle, 
  FaPlusCircle, 
  FaUsers, 
  FaTrophy, 
  FaStopwatch, 
  FaExclamationTriangle,
  FaSignOutAlt,
  FaGlobeAmericas,
  FaLandmark,
  FaCoins,
  FaMapMarkedAlt,
  FaChevronDown,
  FaCheckCircle,
  FaFire,
  FaUserCheck,
  FaArrowRight
} from "react-icons/fa";
import { getAccessToken, getUserData, clearAccessToken } from "./accessToken";
import { API_BASE_URL } from "../config/api";
import CanvasBackground from "./components/CanvasBackground";

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url?: string | null;
  matches_played: number;
  total_wins: number;
  total_score: number;
  high_score: number;
}

export default function Home() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string>("");
  const [user, setUser] = useState<Record<string, any>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Quick join room state
  const [quickRoomCode, setQuickRoomCode] = useState("");
  const [quickJoinError, setQuickJoinError] = useState("");

  // Leaderboard preview state
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const token = await getAccessToken();
        setAccessToken(token || "");
        setUser(getUserData() || {});
      } catch (err) {
        setAccessToken("");
        setUser({});
      }
    }
    fetchSession();

    // Fetch leaderboard preview
    async function fetchLeaderboard() {
      setLoadingLeaderboard(true);
      try {
        const res = await fetch(`${API_BASE_URL}/games/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard:", err);
      } finally {
        setLoadingLeaderboard(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Quick Room Join
  const handleQuickJoin = (e: FormEvent) => {
    e.preventDefault();
    const cleanCode = quickRoomCode.trim().toUpperCase();
    if (cleanCode.length !== 5) {
      setQuickJoinError("Room code must be exactly 5 letters");
      return;
    }
    setQuickJoinError("");
    router.push(`/games/${cleanCode}`);
  };

  // Handle user logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/user/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      clearAccessToken();
      setAccessToken("");
      setUser({});
      setIsDropdownOpen(false);
    }
  };

  const isGuest = user?.role === "guest";
  const avatarSrc = user?.avatar_url
    ? user.avatar_url.startsWith("http")
      ? user.avatar_url
      : `${API_BASE_URL}${user.avatar_url}`
    : null;

  return (
    <div className={styles.pageWrapper}>
      {/* CANVAS BACKGROUND GRID */}
      <CanvasBackground />

      {/* DUAL PURPOSE NOTIFICATION BANNERS */}
      {accessToken !== "" && isGuest && (
        <div className={styles.guestBanner}>
          <div className={styles.bannerContent}>
            <FaFire className={styles.bannerIconGuest} />
            <span>
              <strong>Playing as Guest:</strong> Upgrade to a permanent account to keep your win records, customize your avatar, and enter the leaderboard!
            </span>
          </div>
          <Link href="/user/convert-guest" className={styles.bannerActionBtn}>
            Convert Guest Account
          </Link>
        </div>
      )}

      {accessToken !== "" && !isGuest && user?.is_email_verified === false && (
        <div className={styles.verificationBanner}>
          <div className={styles.bannerContent}>
            <FaExclamationTriangle className={styles.bannerIcon} />
            <span>
              Your email address is not verified yet. Please check your inbox to confirm your account.
            </span>
          </div>
          <Link href="/user/send-verification" className={styles.bannerActionBtn}>
            Resend Email
          </Link>
        </div>
      )}

      {/* MAIN HERO SECTION */}
      <main className={styles.main}>
        {/* Centered Profile Link above H1 (Only for Authenticated Users) */}
        {accessToken !== "" && (
          <div className={styles.heroProfileWrap}>
            <div className={styles.userMenuWrapper} ref={dropdownRef}>
              <button
                type="button"
                className={styles.userMenuButton}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                aria-expanded={isDropdownOpen}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="Avatar" className={styles.userAvatarImg} />
                ) : (
                  <FaUserCircle className={styles.userAvatarFallback} />
                )}
                <span className={styles.userMenuName}>{user?.username || "Player"}</span>
                {isGuest && <span className={styles.guestTag}>Guest</span>}
                <FaChevronDown className={`${styles.dropdownChevron} ${isDropdownOpen ? styles.chevronRotated : ""}`} />
              </button>

              {isDropdownOpen && (
                <div className={styles.userDropdown}>
                  <div className={styles.dropdownHeader}>
                    <span className={styles.dropdownUsername}>@{user?.username || "player"}</span>
                    <span className={styles.dropdownSubtext}>
                      {isGuest ? "Temporary Guest Session" : user?.email || "Verified Member"}
                    </span>
                  </div>

                  <div className={styles.dropdownDivider} />

                  {isGuest && (
                    <Link
                      href="/user/convert-guest"
                      className={styles.dropdownActionPrimary}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FaUserCheck /> Convert Guest Account
                    </Link>
                  )}

                  <Link
                    href="/user/profile"
                    className={styles.dropdownItem}
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <FaUserCircle /> Profile & Match History
                  </Link>

                  <Link
                    href="/games/rooms?type=join"
                    className={styles.dropdownItem}
                    onClick={() => setIsDropdownOpen(false)}
                  >
                    <FaGamepad /> Public Game Rooms
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={styles.dropdownItemLogout}
                    onClick={handleLogout}
                  >
                    <FaSignOutAlt /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={styles.heroSection}>
          <h1 className={styles.heroTitle}>
            Scatter<span className={styles.titleGradient}>Blitz</span>
          </h1>

          <h2 className={styles.heroSubtitle}>
            Think Fast. Type Faster. Beat the Blitz!
          </h2>

          <p className={styles.heroDescription}>
            ScatterBlitz takes the classic party word game and injects 60-second high-speed sprints, 
            instant automated validation, and live round recaps. Compete against friends 
            or players worldwide in intense, lightning-fast vocabulary showdowns.
          </p>

          {/* QUICK JOIN ROOM BAR */}
          <div className={styles.quickJoinCard}>
            <form onSubmit={handleQuickJoin} className={styles.quickJoinForm}>
              <div className={styles.quickInputWrap}>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="ENTER 5-LETTER ROOM CODE"
                  value={quickRoomCode}
                  onChange={(e) => {
                    setQuickRoomCode(e.target.value.toUpperCase());
                    if (quickJoinError) setQuickJoinError("");
                  }}
                  className={styles.quickJoinInput}
                />
                {quickJoinError && <span className={styles.quickJoinError}>{quickJoinError}</span>}
              </div>
              <button type="submit" className={styles.quickJoinBtn}>
                <FaBolt /> Quick Join
              </button>
            </form>

            <div className={styles.buttonGroup}>
              <Link href="/games/rooms?type=create" className={styles.createBtn}>
                <FaPlusCircle /> Host Game Room
              </Link>
              <Link href="/games/rooms?type=join" className={styles.joinBtn}>
                <FaGamepad /> Browse Public Lobbies
              </Link>
            </div>
          </div>

          {/* GAME STATS BADGES */}
          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <FaUsers className={styles.statIcon} />
              <div className={styles.statText}>
                <strong>Multiplayer</strong>
                <span>Up to 10 Players</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaStopwatch className={styles.statIcon} />
              <div className={styles.statText}>
                <strong>Blitz Sprint</strong>
                <span>60s Action</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <FaTrophy className={styles.statIcon} />
              <div className={styles.statText}>
                <strong>Real-time</strong>
                <span>Instant Scoring</span>
              </div>
            </div>
          </div>
        </div>

        {/* OFFICIAL CATEGORIES SHOWCASE */}
        <section className={styles.categoriesSection}>
          <h2 className={styles.categoriesTitleLeft}>
            Here are some of the global categories to test<br />
            your knowledge and typing speed across.
          </h2>

          <div className={styles.categoriesGrid}>
            <div className={styles.categoryCard}>
              <div className={styles.categoryIconWrap}>
                <FaGlobeAmericas className={styles.categoryIcon} />
              </div>
              <h3 className={styles.categoryTitle}>Countries</h3>
              <p className={styles.categoryDesc}>
                Sovereign states & territories worldwide.
              </p>
              <div className={styles.categoryExamples}>
                <span>e.g. Brazil, Canada, Denmark, Egypt</span>
              </div>
            </div>

            <div className={styles.categoryCard}>
              <div className={styles.categoryIconWrap}>
                <FaLandmark className={styles.categoryIcon} />
              </div>
              <h3 className={styles.categoryTitle}>Capitals</h3>
              <p className={styles.categoryDesc}>
                Official recognized national capital cities.
              </p>
              <div className={styles.categoryExamples}>
                <span>e.g. Berlin, Cairo, Dublin, Madrid</span>
              </div>
            </div>

            <div className={styles.categoryCard}>
              <div className={styles.categoryIconWrap}>
                <FaCoins className={styles.categoryIcon} />
              </div>
              <h3 className={styles.categoryTitle}>Currencies</h3>
              <p className={styles.categoryDesc}>
                Global monetary units & circulating legal tenders.
              </p>
              <div className={styles.categoryExamples}>
                <span>e.g. Baht, Dollar, Euro, Franc</span>
              </div>
            </div>

            <div className={styles.categoryCard}>
              <div className={styles.categoryIconWrap}>
                <FaMapMarkedAlt className={styles.categoryIcon} />
              </div>
              <h3 className={styles.categoryTitle}>States & Provinces</h3>
              <p className={styles.categoryDesc}>
                Major regional states, provinces, and territories.
              </p>
              <div className={styles.categoryExamples}>
                <span>e.g. Bavaria, California, Ontario, Texas</span>
              </div>
            </div>
          </div>
        </section>

        {/* HOW TO PLAY SECTION */}
        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Game Rules</span>
            <h2 className={styles.featuresTitle}>How To Play ScatterBlitz</h2>
            <p className={styles.sectionSubtitle}>
              Four simple phases to dominate the room and climb the leaderboard.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>01</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>Pick Your Letter</h3>
                <p className={styles.featureStepDesc}>
                  Players take turns choosing an available letter from A-Z. Once picked, 
                  that letter is permanently locked out for the rest of the match!
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>02</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>High-Speed Sprint</h3>
                <p className={styles.featureStepDesc}>
                  Quickly type a valid word starting with the chosen letter for every category. 
                  Speed and vocabulary are your greatest weapons.
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>03</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>Beat the Blitz</h3>
                <p className={styles.featureStepDesc}>
                  Beat the 60-second timer or hit STOP early! The instant time expires, 
                  inputs lock and submissions enter the live review window.
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>04</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>Score & Dominate</h3>
                <p className={styles.featureStepDesc}>
                  Earn maximum points for unique creative answers. Duplicate words get 
                  penalized. The blitzer with highest aggregate score wins!
                </p>
              </div>
            </div>
          </div>

        </section>

        {/* LEADERBOARD TEASER SECTION */}
        <section id="leaderboard" className={styles.leaderboardSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Rankings</span>
            <h2 className={styles.featuresTitle}>Top Blitzers Worldwide</h2>
            <p className={styles.sectionSubtitle}>
              The fastest typists and sharpest minds dominating ScatterBlitz matches.
            </p>
          </div>

          <div className={styles.leaderboardCard}>
            {loadingLeaderboard ? (
              <div className={styles.leaderboardLoading}>Loading top rankings...</div>
            ) : leaderboard.length === 0 ? (
              <div className={styles.leaderboardEmpty}>
                <FaTrophy className={styles.emptyIcon} />
                <h3>No Global Champions Yet</h3>
                <p>The arena is wide open. Join a room or host a game to claim your spot on the #1 podium!</p>
                <Link href="/games/rooms?type=create" className={styles.joinBtn}>
                  Play & Claim #1
                </Link>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: "60px" }}>Rank</th>
                      <th>Player</th>
                      <th>Wins</th>
                      <th>Matches</th>
                      <th style={{ textAlign: "right" }}>Total Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.slice(0, 5).map((player, idx) => (
                      <tr key={player.id}>
                        <td className={styles.rankCell}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                        </td>
                        <td className={styles.playerCell}>
                          <div className={styles.playerInfo}>
                            {player.avatar_url ? (
                              <img
                                src={player.avatar_url.startsWith("http") ? player.avatar_url : `${API_BASE_URL}${player.avatar_url}`}
                                alt={player.username}
                                className={styles.tableAvatar}
                              />
                            ) : (
                              <FaUserCircle className={styles.tableAvatarFallback} />
                            )}
                            <span className={styles.playerName}>@{player.username}</span>
                          </div>
                        </td>
                        <td className={styles.winsCell}>
                          <strong>{player.total_wins}</strong> wins
                        </td>
                        <td>{player.matches_played}</td>
                        <td style={{ textAlign: "right", color: "var(--amber)", fontWeight: 700 }}>
                          {player.total_score} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerCta}>
          <h3 className={styles.footerCtaTitle}>Ready to test your reflexes and vocabulary?</h3>
          <p className={styles.footerCtaSub}>Jump into a live game room right now or host your own custom match!</p>
          <div className={styles.footerCtaButtons}>
            <Link href="/games/rooms?type=create" className={styles.footerPlayBtn}>
              Host A Room <FaArrowRight />
            </Link>
          </div>
        </div>

        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo}>
              <FaBolt className={styles.logoIcon} />
              <span className={styles.logoText}>
                Scatter<span className={styles.logoHighlight}>Blitz</span>
              </span>
            </Link>
            <p className={styles.footerTagline}>
              The ultimate real-time multiplayer party word game. High-speed sprints, instant validation, and endless vocabulary showdowns.
            </p>
          </div>

          <div className={styles.footerLinksCol}>
            <p className={styles.footerLinksTitle}>Play & Compete</p>
            <Link href="/games/rooms?type=create" className={styles.footerLink}>Host Game Room</Link>
            <Link href="/games/rooms?type=join" className={styles.footerLink}>Browse Public Lobbies</Link>
            <a href="#leaderboard" className={styles.footerLink}>Global Leaderboard</a>
          </div>

          <div className={styles.footerLinksCol}>
            <p className={styles.footerLinksTitle}>Account</p>
            {accessToken !== "" ? (
              <>
                <Link href="/user/profile" className={styles.footerLink}>My Profile & Stats</Link>
                {isGuest && (
                  <Link href="/user/convert-guest" className={styles.footerLink}>Convert Guest Account</Link>
                )}
                <button type="button" onClick={handleLogout} className={styles.footerLinkBtn}>
                  Log Out
                </button>
              </>
            ) : (
              <>
                <Link href="/user/register?type=login" className={styles.footerLink}>Log In</Link>
                <Link href="/user/register?type=register" className={styles.footerLink}>Sign Up Free</Link>
              </>
            )}
          </div>

          <div className={styles.footerLinksCol}>
            <p className={styles.footerLinksTitle}>Legal & Resources</p>
            <Link href="/terms" className={styles.footerLink}>Terms Of Service</Link>
            <Link href="/privacy" className={styles.footerLink}>Privacy Policy</Link>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <small className={styles.copyright}>
            © 2026 ScatterBlitz. All rights reserved.
          </small>
          <div className={styles.socialIcons}>
            <a 
              href="https://twitter.com" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="Twitter Profile"
              className={styles.socialIcon}
            >
              <FaTwitter size={20} />
            </a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="GitHub Profile"
              className={styles.socialIcon}
            >
              <FaGithub size={20} />
            </a>
            <a 
              href="https://linkedin.com" 
              target="_blank" 
              rel="noopener noreferrer"
              aria-label="LinkedIn Profile"
              className={styles.socialIcon}
            >
              <FaLinkedinIn size={20} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}