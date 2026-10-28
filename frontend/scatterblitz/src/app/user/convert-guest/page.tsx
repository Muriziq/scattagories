"use client";

import { FaUser, FaLock, FaEnvelope, FaEye, FaEyeSlash, FaFire, FaCheckCircle, FaExclamationTriangle } from "react-icons/fa";
import { useState, FormEvent, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./convert.module.css";
import { saveAccessToken, updateUserData, getDeviceId } from "../../accessToken";
import { API_BASE_URL } from "../../../config/api";

export default function ConvertGuestPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isConverted, setIsConverted] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!username.trim() || username.length < 3 || username.length > 20) {
      setErrorMsg("Username must be 3-20 characters long");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid Email address");
      return;
    }
    if (!password || password.length < 6 || password.length > 20) {
      setErrorMsg("Password must be 6-20 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/convert-guest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        credentials: "include",
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Failed to convert guest account");
      } else {
        if (data?.accessToken) {
          saveAccessToken(data.accessToken);
        }
        if (data?.user) {
          updateUserData(data.user);
        }
        setSuccessMsg(data.message || "Guest account converted successfully! Please verify your email.");
        setIsConverted(true);
        setTimeout(() => {
          router.push("/");
        }, 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Server connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleUsernameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      emailInputRef.current?.focus();
    }
  };

  const handleEmailKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      passwordInputRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <FaFire className={styles.headerIcon} />
          </div>
          <h1 className={styles.title}>Convert Guest Account</h1>
          <p className={styles.subtitle}>
            Upgrade your temporary guest session to a permanent account to keep all your match history, scores, and rank on the global leaderboard!
          </p>
        </div>

        {errorMsg && (
          <div className={styles.errorMessage}>
            <FaExclamationTriangle />
            <span>{errorMsg}</span>
          </div>
        )}

        {isConverted ? (
          <div className={styles.successCard}>
            <FaCheckCircle className={styles.successIcon} />
            <h2>Account Upgraded!</h2>
            <p>{successMsg}</p>
            <p className={styles.redirectNotice}>Redirecting you to the home arena...</p>
            <Link href="/" className={styles.homeBtn}>
              Back to Arena
            </Link>
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="username" className={styles.label}>
                Choose Username
              </label>
              <div className={styles.inputWrap}>
                <FaUser className={styles.inputIcon} />
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="Enter unique username"
                  className={styles.input}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  onKeyDown={handleUsernameKeyDown}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <div className={styles.inputWrap}>
                <FaEnvelope className={styles.inputIcon} />
                <input
                  ref={emailInputRef}
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email"
                  className={styles.input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleEmailKeyDown}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <div className={styles.inputWrap}>
                <FaLock className={styles.inputIcon} />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  placeholder="Create a strong password"
                  className={styles.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handlePasswordKeyDown}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword" className={styles.label}>
                Confirm Password
              </label>
              <div className={styles.inputWrap}>
                <FaLock className={styles.inputIcon} />
                <input
                  ref={confirmPasswordInputRef}
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  className={styles.input}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={handleConfirmPasswordKeyDown}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle confirm password visibility"
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Upgrading Account..." : "Save Account & Transfer Stats"}
            </button>

            <div className={styles.cancelWrap}>
              <Link href="/" className={styles.cancelLink}>
                Cancel & Continue as Guest
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
