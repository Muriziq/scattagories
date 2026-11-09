import Link from "next/link";
import { FaHome, FaGamepad, FaSearchLocation } from "react-icons/fa";
import styles from "./not-found.module.css";
import CanvasBackground from "./components/CanvasBackground";

export default function NotFound() {
  return (
    <main className={styles.container}>
      <CanvasBackground />

      <div className={styles.contentCard}>

        <h1 className={styles.errorCode}>
          4<span className={styles.zeroGradient}>0</span>4
        </h1>

        <h2 className={styles.title}>Lost in the Blitz</h2>

        <p className={styles.description}>
          Looks like this word, room, or page evaporated into the volcanic fog. Let&apos;s get you back into the action.
        </p>

        <div className={styles.actionsRow}>
          <Link href="/" className={styles.primaryBtn}>
            <FaHome /> Return Home
          </Link>
          <Link href="/games/join" className={styles.secondaryBtn}>
            <FaGamepad /> Find Matches
          </Link>
        </div>
      </div>
    </main>
  );
}
