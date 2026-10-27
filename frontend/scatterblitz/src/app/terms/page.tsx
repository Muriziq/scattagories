"use client";
import Link from "next/link";
import { FaBolt, FaArrowLeft } from "react-icons/fa";
import styles from "./legal.module.css";

export default function TermsPage() {
  return (
    <div className={styles.legalWrapper}>
      <header className={styles.header}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>
            <FaBolt className={styles.logoIcon} />
            <span>Scatter<span className={styles.logoHighlight}>Blitz</span></span>
          </Link>
          <Link href="/" className={styles.backLink}>
            <FaArrowLeft /> Back to Game
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.date}>Last updated: October 2026</p>

          <section className={styles.section}>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or playing ScatterBlitz, you agree to be bound by these Terms of Service. 
              ScatterBlitz is a real-time multiplayer word game service. If you do not agree, please do not use the application.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. User Accounts & Fair Play</h2>
            <p>
              Players may participate as anonymous guests or registered users. You are responsible for safeguarding your account credentials. 
              Cheating, automated submission scripting, abusive language in game rooms, or exploitation of the socket service is strictly prohibited 
              and may result in immediate suspension or termination of your account.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Real-Time Scoring & Game Rules</h2>
            <p>
              ScatterBlitz round timings, letter selections, and word validations are governed by automated game engine rules. 
              Room hosts may configure specific player limits, round timers, and categories for private sessions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Service Modifications</h2>
            <p>
              We reserve the right to modify or discontinue any part of the service at any time without prior notice.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
