"use client"
import { FaUser } from "react-icons/fa"
import Image from "next/image"
import styles from "./profile.module.css"

export default function Profile(){
    return(
        <main className={styles.main}>
            <UsersInfo />
            <Stats />
            <History />
        </main>
    )
}

function UsersInfo(){
    return(
        <section className={styles.userInfoSection}>
            <div className={styles.avatarContainer}>
                <input type="file" name="avatar" id="avatar" className={styles.fileInput} />
                <Image src="" alt="User Image" width={100} height={100} className={styles.userImage} />
                <FaUser className={styles.userIcon} />
            </div>
            <h1 className={styles.username}>Hi, Username</h1>
        </section>
    )
}

function Stats(){
    return(        
    <section className={styles.statsSection}>
        <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Total Wins</h3>
            <p className={styles.statValue}>30</p>
        </div>
        <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Total Games Played</h3>
            <p className={styles.statValue}>30</p>
        </div>
        <div className={styles.statCard}>
            <h3 className={styles.statTitle}>Total Lifetime Points</h3>
            <p className={styles.statValue}>30</p>
        </div>
    </section>
    )
}

function History(){
return (
  <section className={styles.historySection}>
    <table className={styles.historyTable}>
      <thead className={styles.tableHead}>
        <tr className={styles.tableHeaderRow}>
          <th className={styles.tableHeaderCell}>Game ID</th>
          <th className={styles.tableHeaderCell}>Date Played</th>
          <th className={styles.tableHeaderCell}>Placement</th>
          <th className={styles.tableHeaderCell}>Individual Score</th>
          <th className={styles.tableHeaderCell}>Opponents</th>
        </tr>
      </thead>
      <tbody className={styles.tableBody}>
        <tr className={styles.tableRow}>
          <td className={styles.tableCell}>#A7F92</td>
          <td className={styles.tableCell}>Oct 24, 2026</td>
          <td className={styles.tableCell}>1st Place 🏆</td>
          <td className={styles.tableCell}>32 pts</td>
          <td className={styles.tableCell}>@alex, @sam</td>
        </tr>
        <tr className={styles.tableRow}>
          <td className={styles.tableCell}>#B3K11</td>
          <td className={styles.tableCell}>Oct 23, 2026</td>
          <td className={styles.tableCell}>2nd Place</td>
          <td className={styles.tableCell}>24 pts</td>
          <td className={styles.tableCell}>@jordan, @taylor</td>
        </tr>
        <tr className={styles.tableRow}>
          <td className={styles.tableCell}>#C9L04</td>
          <td className={styles.tableCell}>Oct 20, 2026</td>
          <td className={styles.tableCell}>3rd Place</td>
          <td className={styles.tableCell}>12 pts</td>
          <td className={styles.tableCell}>@casey, @alex</td>
        </tr>
      </tbody>
    </table>
  </section>
);
}