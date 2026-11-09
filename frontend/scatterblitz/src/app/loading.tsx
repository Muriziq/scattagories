import { FaBolt } from "react-icons/fa";
import styles from "./loading.module.css";
import CanvasBackground from "./components/CanvasBackground";

export default function Loading() {
  return (
    <main className={styles.loadingContainer}>
      <CanvasBackground />

      <div className={styles.loadingCard}>
        <div className={styles.iconCircle}>
          <FaBolt size={42} />
        </div>

        <h1 className={styles.brandTitle}>
          Scatter<span className={styles.brandHighlight}>Blitz</span>
        </h1>

        <div className={styles.progressBarTrack}>
          <div className={styles.progressBarFill} />
        </div>

        <p className={styles.loadingSubtext}>Loading game arena...</p>
      </div>
    </main>
  );
}
