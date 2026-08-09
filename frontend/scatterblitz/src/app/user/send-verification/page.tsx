"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { FaEnvelope, FaPaperPlane } from "react-icons/fa";
import styles from "./send-verification.module.css";

export default function SendVerificationPage() {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
      const res = await fetch("http://localhost:5000/user/sendVerification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to send verification email");
      } else {
        setSuccessMsg(data.message || "Verification email sent successfully! Please check your inbox.");
      }
    } catch (err) {
      setErrorMsg("Network error. Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <div className={styles.header}>
          <FaPaperPlane size={64} className={styles.avatar} />
          <h1 className={styles.title}>Resend Verification</h1>
          <p className={styles.description}>
            Enter your registered email address and we'll send you a new verification link.
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
            {loading ? "Sending..." : "Send Verification Email"}
          </button>
        </form>

        <Link href="/user/register?type=login" className={styles.backLink}>
          Back to Login
        </Link>
      </section>
    </main>
  );
}
