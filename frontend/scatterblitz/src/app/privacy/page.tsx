"use client";
import Link from "next/link";
import { FaBolt, FaArrowLeft } from "react-icons/fa";
import styles from "../terms/legal.module.css";

export default function PrivacyPage() {
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
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.date}>Last updated: October 2026</p>

          <section className={styles.section}>
            <h2>1. Information We Collect</h2>
            <p>
              When you register for an account, we collect your chosen username, email address, and hashed password. 
              For guest sessions, we use a temporary random identifier and anonymous session cookies.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. Match Data & Game Analytics</h2>
            <p>
              We record game statistics such as matches played, scores, round placements, and valid word answers to maintain 
              match history, player career profiles, and global leaderboards.
            </p>
          </section>

          <section className={styles.section}>
            <h2>3. Cookies & Local Storage</h2>
            <p>
              We use secure, HTTP-only authentication cookies to maintain your login session across game rooms. Local device 
              identifiers are used strictly to avoid session conflicts and rate-limit abuse.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Data Retention & Deletion</h2>
            <p>
              You may request deletion of your account and personal details at any time from your account settings.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
