"use client";

import { useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaKey } from "react-icons/fa";
import styles from "./reset-password.module.css";

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
      const res = await fetch("http://localhost:5000/user/reset-password", {
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

  if (isSuccess) {
    return (
      <main className={styles.main}>
        <section className={styles.card}>
          <FaCheckCircle size={80} className={styles.successIcon} />
          <h1 className={styles.title}>Password Reset!</h1>
          <p className={styles.description}>
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <Link href="/user/register?type=login" className={styles.submitButton} style={{ textDecoration: "none" }}>
            Log In Now
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <div className={styles.header}>
          <FaKey size={64} className={styles.avatar} />
          <h1 className={styles.title}>Reset Password</h1>
          <p className={styles.description}>
            Please enter your new password below.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            <FaLock className={styles.icon} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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

        <Link href="/user/register?type=login" className={styles.backLink}>
          Back to Login
        </Link>
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
