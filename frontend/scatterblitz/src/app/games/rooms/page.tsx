"use client";

import { useState, useEffect, Suspense } from "react";
import CreateRoom from "./components/createRoom";
import JoinRoom from "./components/joinRoom";
import { useSearchParams, useRouter } from 'next/navigation';
import styles from "./rooms.module.css";

function RoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isJoin, setIsJoin] = useState(false);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "join") {
      setIsJoin(true);
    } else if (type === "create") {
      setIsJoin(false);
    }
  }, [searchParams]);

  const handleTabChange = (joinState: boolean) => {
    setIsJoin(joinState);
    const newType = joinState ? "join" : "create";
    router.replace(`/games/rooms?type=${newType}`, { scroll: false });
  };

  return (
    <main className={styles.main}>
      <section className={styles.cardContainer}>
        <section className={styles.tabSection}>
          <div className={styles.sectionStyle1}></div>
          <div className={styles.sectionStyle2}></div>
          <div className={styles.sectionStyle3}></div>
          <div className={styles.sectionStyle4}></div>
          <div className={styles.tabButtons}>
            <button 
              className={`${styles.tabButton} ${!isJoin ? styles.activeTab : ''}`} 
              onClick={(e) => { e.preventDefault(); handleTabChange(false); }}
            >
              CREATE
            </button>
            <button 
              className={`${styles.tabButton} ${isJoin ? styles.activeTab : ''}`} 
              onClick={(e) => { e.preventDefault(); handleTabChange(true); }}
            >
              JOIN
            </button>
          </div>
        </section>
        <div className={styles.cardWrapper}>
          {!isJoin ? <CreateRoom /> : <JoinRoom />}
        </div>
      </section>
    </main>
  );
}

export default function Room() {
  return (
    <Suspense fallback={<main className={styles.main}></main>}>
      <RoomContent />
    </Suspense>
  );
}