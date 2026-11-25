"use client";

import { usePathname, useRouter } from "next/navigation";
import { FaTimes, FaUserCircle } from "react-icons/fa";
import styles from "./authmodel.module.css";

interface AuthModelProps {
  modelFunction?: () => void;
  cancelModal?: () => void;
  redirectUrl?: string;
}

export default function AuthModel({ modelFunction, cancelModal, redirectUrl }: AuthModelProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLoginRedirect = () => {
    const target = redirectUrl || pathname || "/";
    router.push(`/user/login?redirect=${encodeURIComponent(target)}`);
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <button
          type="button"
          className={styles.closeModalBtn}
          onClick={cancelModal}
          aria-label="Close modal"
        >
          <FaTimes />
        </button>
        <FaUserCircle size={56} className={styles.modalIcon} />
        <h3 className={styles.modalTitle}>Authentication Required</h3>
        <p className={styles.modalDescription}>
          Please log in to your account or enter as a guest to create and
          host game rooms.
        </p>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalPrimaryBtn}
            onClick={handleLoginRedirect}
          >
            Log In / Sign Up
          </button>
          <button
            type="button"
            className={styles.modalSecondaryBtn}
            onClick={modelFunction}
          >
            Enter as Guest
          </button>
        </div>
      </div>
    </div>
  );
}