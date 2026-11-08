import Link from "next/link";
import { FaHome, FaGamepad, FaSearchLocation } from "react-icons/fa";
import styles from "./not-found.module.css";
import CanvasBackground from "./components/CanvasBackground";

export default function NotFound() {
  return (
    <main className={styles.container}>
      <CanvasBackground />

      <div className={styles.contentCard}>
        <div className={styles.iconCircle}>
          <FaSearchLocation size={44} />
        </div>

        <h1 className={styles.errorCode}>404</h1>

        <h2 className={styles.title}>Word Not in Dictionary!</h2>

        <p className={styles.description}>
          The page or game room you are looking for does not exist, has been deleted, or may have already expired.
        </p>

        <div className={styles.actionsRow}>
          <Link href="/" className={styles.primaryBtn}>
            <FaHome /> Return Home
          </Link>
          <Link href="/games/join" className={styles.secondaryBtn}>
            <FaGamepad /> Browse Rooms
          </Link>
        </div>
      </div>
    </main>
  );
}

