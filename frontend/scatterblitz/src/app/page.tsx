"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import Link from "next/link";
import { FaGithub, FaLinkedinIn, FaTwitter, FaBolt, FaGamepad, FaUserCircle, FaPlusCircle, FaUsers, FaTrophy, FaStopwatch, FaExclamationTriangle } from "react-icons/fa";
import { getAccessToken, getUserData } from "./accessToken";
function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawGrid = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(242, 204, 136, 0.1)"; // Theme-matching warm sunset/amber grid line color

      const iterationWidth = height / 100;
      for (let i = 0; i <= iterationWidth; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * 100);
        ctx.lineTo(width, i * 100 + 50);
        ctx.stroke();
      }

      const iterationHeight = width / 100;
      for (let i = 0; i <= iterationHeight; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 100, 0);
        ctx.lineTo(i * 100 + 50, height);
        ctx.stroke();
      }
    };

    drawGrid();
    window.addEventListener("resize", drawGrid);
    return () => window.removeEventListener("resize", drawGrid);
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className={styles.canvasBackground}
    />
  );
}

export default function Home() {
  const [accessToken, setAccessToken] = useState<string>("");
  const [user, setUser] = useState<Record<string, any>>({});

  useEffect(() => {
    async function fetchToken() {
      try {
        const token = await getAccessToken();
        setAccessToken(token || "");
        setUser(getUserData() || {});
      } catch (err) {
        setAccessToken("");
        setUser({});
      }
    }
    fetchToken();
  }, []);

  return (
    <div className={styles.pageWrapper}>
      {/* CANVAS BACKGROUND GRID */}
      <CanvasBackground />

      {/* HEADER */}
      <header className={styles.header}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>
             <FaBolt className={styles.logoIcon} />
            <span className={styles.logoText}>Scatter<span className={styles.logoHighlight}>Blitz</span></span>
          </Link>
          {
            accessToken === "" ?
          <nav className={styles.nav}>
            <Link href="/user/register?type=login" className={styles.loginBtn}>
              Log In
            </Link>
            <Link href="/user/register?type=register" className={styles.registerBtn}>
              Get Started
            </Link>
          </nav>
          : <div className={styles.nav}><FaUserCircle className={styles.profileIcon} /></div>
          }

        </div>
      </header>

      {/* EMAIL VERIFICATION WARNING BANNER */}
      {accessToken !== "" && user && user.is_email_verified === false && (
        <div className={styles.verificationBanner}>
          <div className={styles.bannerContent}>
            <FaExclamationTriangle className={styles.bannerIcon} />
            <span>Your email address is not verified yet. Please check your inbox or resend the verification link.</span>
          </div>
          <Link href="/user/send-verification" className={styles.bannerActionBtn}>
            Resend Email
          </Link>
        </div>
      )}

      {/* MAIN HERO SECTION */}
      <main className={styles.main}>
        <div className={styles.heroSection}>
          <h1 className={styles.heroTitle}>
            Scatter<span className={styles.titleGradient}>Blitz</span>
          </h1>

          <h2 className={styles.heroSubtitle}>
            Think Fast. Type Faster. Beat the Blitz!
          </h2>

          <p className={styles.heroDescription}>
            ScatterBlitz takes the classic party game and injects high-speed multiplayer sprints, 
            automated round balancing, and real-time category validation. Compete against friends 
            or players worldwide in intense, lightning-fast word battles.
          </p>

          <div className={styles.heroActions}>
            <div className={styles.buttonGroup}>
              <Link href="/games/rooms?type=join" className={styles.joinBtn}>
                <FaGamepad /> Join Game
              </Link>
              <Link href="/games/rooms?type=create" className={styles.createBtn}>
                <FaPlusCircle /> Create Room
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

        {/* HOW TO PLAY SECTION */}
        <section className={styles.featuresSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTag}>Game Rules</span>
            <h2 className={styles.featuresTitle}>How To Play ScatterBlitz</h2>
            <p className={styles.sectionSubtitle}>
              Master the four simple steps to dominate the room and climb the leaderboard.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>01</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>Pick Your Letter</h3>
                <p className={styles.featureStepDesc}>
                  Players take turns choosing an available letter from A-Z. Once picked, 
                  that letter is locked out for the rest of the game!
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
                  inputs lock and submissions enter the recap window.
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.cardBadge}>04</div>
              <div className={styles.featureBody}>
                <h3 className={styles.featureStepTitle}>Score & Win</h3>
                <p className={styles.featureStepDesc}>
                  Earn maximum points for unique creative answers. Duplicate or invalid words 
                  earn fewer points. Highest score at the end wins!
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerCta}>
          <h3 className={styles.footerCtaTitle}>Ready to test your reflexes and vocabulary?</h3>
          <p className={styles.footerCtaSub}>Jump into a live game room right now or host your own match!</p>
          <div className={styles.footerCtaButtons}>
            <Link href="/games/rooms?type=join" className={styles.joinBtn}>
              Play Now
            </Link>
          </div>
        </div>

        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Link href="/" className={styles.logo}>
              <FaBolt className={styles.logoIcon} />
              <span className={styles.logoText}>Scatter<span className={styles.logoHighlight}>Blitz</span></span>
            </Link>
            <p className={styles.footerTagline}>
              The ultimate real-time multiplayer party word game.
            </p>
          </div>

          <div className={styles.footerLinks}>
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