"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { FaEnvelope, FaKey, FaPaperPlane } from "react-icons/fa";
import styles from "./forgot-password.module.css";
import { API_BASE_URL } from "../../../config/api";
import CanvasBackground from "../../components/CanvasBackground";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to request password reset");
      } else {
        setSuccessMsg(data.message || "A password reset link has been sent to your email address.");
        setIsSuccess(true);
      }
    } catch (err) {
      setErrorMsg("Network error. Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <section className={styles.cardContainer}>
        {isSuccess ? (
          <section className={styles.card}>
            <div className={styles.header}>
              <div className={styles.iconCircle}>
                <FaPaperPlane size={44} className={styles.avatar} style={{ transform: "translate(-2px, 2px)" }} />
              </div>
              <h1 className={styles.title}>Check Your Email</h1>
              <p className={styles.description}>
                A password reset link has been sent to <strong style={{ color: "var(--sunset)" }}>{email}</strong>. Please check your inbox and spam folder.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", alignItems: "center", marginTop: "0.5rem" }}>
              <Link href="/user/login" className={`${styles.submitButton} ${styles.centerButton}`} style={{ textDecoration: "none" }}>
                Back to Login
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setSuccessMsg("");
                }}
                className={styles.backLink}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Send to a different email
              </button>
            </div>
          </section>
        ) : (
          <section className={styles.card}>
            <div className={styles.header}>
              <div className={styles.iconCircle}>
                <FaKey size={40} className={styles.avatar} />
              </div>
              <h1 className={styles.title}>Forgot Password</h1>
              <p className={styles.description}>
                Enter your registered email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={styles.label}>
                <FaEnvelope className={styles.icon} />
                <input
                  type="email"
                  placeholder="Email Address"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
              {successMsg && <p className={styles.successText}>{successMsg}</p>}

              <button type="submit" className={styles.submitButton} disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <Link href="/user/login" className={styles.backLink}>
              Back to Login
            </Link>
          </section>
        )}
      </section>
    </main>
  );
}
