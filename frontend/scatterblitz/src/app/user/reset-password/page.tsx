"use client";

import { useState, FormEvent, Suspense, useRef, KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaKey } from "react-icons/fa";
import styles from "./reset-password.module.css";
import { API_BASE_URL } from "../../../config/api";
import CanvasBackground from "../../components/CanvasBackground";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!token) {
      setErrorMsg("Reset token is missing or invalid. Please request a new password reset link.");
      return;
    }
    if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
      setErrorMsg("Password must be between 6 and 20 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || "Failed to reset password. The link may be expired.");
      } else {
        setSuccessMsg(data.message || "Password reset successfully!");
        setIsSuccess(true);
      }
    } catch (err) {
      setErrorMsg("Network error. Could not connect to server.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewPasswordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmPasswordInputRef.current?.focus();
    }
  };

  const handleConfirmPasswordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <section className={styles.cardContainer}>
        <div className={styles.cardWrapper}>
          {isSuccess ? (
            <section className={styles.card} style={{ gap: "0rem" }}>
              <div className={styles.header} style={{ gap: "0.35rem" }}>
                <FaCheckCircle size={80} className={styles.successIcon} />
                <h1 className={styles.title}>Password Reset!</h1>
              </div>

              <section className={styles.formSection} style={{ textAlign: "center" }}>
                <p className={styles.description}>
                  Your password has been updated successfully. You can now log in with your new password.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", alignItems: "center", marginTop: "1rem" }}>
                  <Link href="/user/login" className={`${styles.submitButton} ${styles.centerButton}`} style={{ textDecoration: "none" }}>
                    Log In Now
                  </Link>
                </div>
              </section>
            </section>
          ) : (
            <section className={styles.card}>
              <div className={styles.header}>
                <div className={styles.iconCircle}>
                  <FaKey size={40} className={styles.avatar} />
                </div>
                <h1 className={styles.title}>Reset Password</h1>
                <p className={styles.description}>
                  Please enter your new password below.
                </p>
              </div>

              <section className={styles.formSection}>
                <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
                  <label className={styles.label}>
                    <FaLock className={styles.icon} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="New Password"
                      className={styles.input}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onKeyDown={handleNewPasswordKeyDown}
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </label>

                  <label className={styles.label}>
                    <FaLock className={styles.icon} />
                    <input
                      ref={confirmPasswordInputRef}
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm New Password"
                      className={styles.input}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={handleConfirmPasswordKeyDown}
                    />
                    <button
                      type="button"
                      className={styles.togglePassword}
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </label>

                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
                  {successMsg && <p className={styles.successText}>{successMsg}</p>}

                  <button type="submit" className={styles.submitButton} disabled={loading}>
                    {loading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>

                <Link href="/user/login" className={styles.backLink}>
                  Back to Login
                </Link>
              </section>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className={styles.main}></main>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
