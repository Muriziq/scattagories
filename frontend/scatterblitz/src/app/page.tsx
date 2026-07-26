import Image from "next/image";
import styles from "./page.module.css";
import Link from "next/link";
import { FaGithub, FaLinkedinIn, FaTwitter } from "react-icons/fa";

export default function Home() {
  return (
    <>
      <Header/>
      <MainSection/>
      <Features/>
      <Footer/>
    </>
  );
}

function Header(){
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <button className={styles.loginBtn}>Login</button>
        <button className={styles.registerBtn}>Register</button>
      </nav>
    </header>
  );
}

function MainSection(){
  return(
    <main className={styles.main}>
      <div className={styles.heroContent}>
        <h1 className={styles.heroTitle}>ScatterBlitz</h1>
        <h3 className={styles.heroSubtitle}>Think Fast. Type Faster. Welcome to ScatterBlitz!</h3>
        <p className={styles.heroDescription}>ScatterBlitz is a fast-paced, competitive multiplayer web application 
inspired by the classic party game Scattergories. This app takes the traditional creative 
thinking game and injects a high-speed "Blitz" mechanic, automated round balancing, and
real-time category validation.</p>
      </div>
      <div className={styles.heroActions}>
        <div className={styles.buttonGroup}>
          <button className={styles.joinBtn}>Join Game</button>
          <button className={styles.createBtn}>Create Room</button>
        </div>
      </div>
    </main>
  )
}

function Features(){
  return(
    <section className={styles.featuresSection}>
      <h1 className={styles.featuresTitle}>How To Play</h1>
      <section className={styles.featuresList}>

        <div className={styles.featureCard}>
          <h2 className={styles.featureNumber}>1</h2>
          <div className={styles.featureBody}>
            <h3 className={styles.featureStepTitle}>Pick Your Letter</h3>
            <p className={styles.featureStepDesc}>To kick off a round, players take turns selecting a single letter from A-Z. Choose wisely, because once a letter is picked, it is locked out for the rest of the game.</p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <h2 className={styles.featureNumber}>2</h2>
          <div className={styles.featureBody}>
            <h3 className={styles.featureStepTitle}>High-Speed Sprint</h3>
            <p className={styles.featureStepDesc}>Once the letter is set, you will be given a list of random categories. Your goal is to quickly type one valid word for each category that starts with the chosen letter.</p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <h2 className={styles.featureNumber}>3</h2>
          <div className={styles.featureBody}>
            <h3 className={styles.featureStepTitle}>Beat the Blitz</h3>
            <p className={styles.featureStepDesc}>There is no standard timer—this game is a high-stakes sprint. The exact millisecond the first player finishes and submits their answers, the board instantly locks for everyone else. Type fast!</p>
          </div>
        </div>

        <div className={styles.featureCard}>
          <h2 className={styles.featureNumber}>4</h2>
          <div className={styles.featureBody}>
            <h3 className={styles.featureStepTitle}>Score Big</h3>
            <p className={styles.featureStepDesc}>Our automated system will instantly verify if your submitted words legitimately match the categories and the active letter. You earn 5 points for uniquely creative answers, but you still earn a baseline 2 points if your answer matches an opponent's word.</p>
          </div>
        </div>
      </section>
    </section>
  )
}

function Footer(){
  return(
    <footer className={styles.footer}>
      <div className={styles.footerCta}>
        <p className={styles.footerCtaText}>Ready to test your reflexes and vocabulary?</p>
        <button className={styles.footerJoinBtn}>Join Game</button>
      </div>

      <div className={styles.footerLinks}>
        <p className={styles.footerLinksTitle}>Legal</p>
        <Link href="/" className={styles.footerLink}>Terms Of Service</Link>
        <Link href="/" className={styles.footerLink}>Privacy Policy</Link>
      </div>

      <div className={styles.footerBottom}>
        <small className={styles.copyright}>© 2026 ScatterBlitz. All rights reserved.</small>
        <div className={styles.socialIcons}>
          <a 
            href="https://twitter.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="Twitter Profile"
            className={styles.socialIcon}
          >
            <FaTwitter size={24} />
          </a>
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="GitHub Profile"
            className={styles.socialIcon}
          >
            <FaGithub size={24} />
          </a>
          <a 
            href="https://linkedin.com" 
            target="_blank" 
            rel="noopener noreferrer"
            aria-label="LinkedIn Profile"
            className={styles.socialIcon}
          >
            <FaLinkedinIn size={24} />
          </a>
        </div>
      </div>
    </footer>
  )
}