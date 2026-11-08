import styles from "./loading.module.css";
import CanvasBackground from "./components/CanvasBackground";

export default function Loading() {
  return (
    <main className={styles.loadingContainer}>
      <CanvasBackground />

      <div className={styles.spinnerWrapper}>
        <div className={styles.outerRing} />
        <div className={styles.innerPulse} />
      </div>

      <h3 className={styles.loadingText}>
        Loading ScatterBlitz
        <span className={styles.dots}>...</span>
      </h3>
    </main>
  );
}

