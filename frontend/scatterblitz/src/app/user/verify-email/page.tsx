"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaCheckCircle, FaExclamationCircle, FaSpinner } from "react-icons/fa";
import styles from "./verify-email.module.css";
import { API_BASE_URL } from "../../../config/api";
import CanvasBackground from "../../components/CanvasBackground";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing. Please check your verification link.");
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/verify-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          }
        });

        const data = await res.json();

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Your email address has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data.message || "Verification failed. The token may be invalid or expired.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("Network error. Could not connect to verification server.");
      }
    };

    verifyToken();
  }, [token]);

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <section className={styles.cardContainer}>
        <section className={styles.card}>
          {status === "loading" && (
            <>
              <FaSpinner className={`${styles.icon} ${styles.loadingIcon}`} />
              <h1 className={styles.title}>Verifying</h1>
              <p className={styles.message}>{message}</p>
            </>
          )}

          {status === "success" && (
            <>
              <FaCheckCircle size={100} className={`${styles.icon} ${styles.successIcon}`} />
              <h1 className={styles.title}>Verified!</h1>
              <p className={styles.message}>{message}</p>
              <div className={styles.buttonGroup}>
                <Link href="/user/login" className={styles.primaryButton}>
                  Log In Now
                </Link>
                <Link href="/" className={styles.secondaryButton}>
                  Home
                </Link>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <FaExclamationCircle className={`${styles.icon} ${styles.errorIcon}`} size={100} />
              <h1 className={styles.title}>Verification Failed</h1>
              <p className={styles.message}>{message}</p>
              <div className={styles.buttonGroup}>
                <Link href="/user/send-verification" className={styles.primaryButton}>
                  Resend Email
                </Link>
                <Link href="/user/login" className={styles.secondaryButton}>
                  Log In
                </Link>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.main}>
          <CanvasBackground />
          <section className={styles.cardContainer}>
            <section className={styles.card}>
              <FaSpinner className={`${styles.icon} ${styles.loadingIcon}`} />
              <h1 className={styles.title}>Loading</h1>
            </section>
          </section>
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
