"use client";
import { FaUser, FaLock, FaEnvelope, FaUserCircle, FaEye, FaEyeSlash, FaPaperPlane } from 'react-icons/fa';
import { useState, FormEvent, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import styles from "./register.module.css";
import { useRouter } from 'next/navigation';
import { saveAccessToken, updateUserData, getDeviceId } from "../../accessToken";
import { API_BASE_URL } from "../../../config/api";
import CanvasBackground from "../../components/CanvasBackground";

export default function Register() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Validates user input and creates a new account, prompting verification email screen
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

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        credentials: "include",
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Registration failed");
      } else {
        if (data?.accessToken) {
          saveAccessToken(data.accessToken);
        }
        if (data?.user && typeof data.user === "object") {
          updateUserData(data.user);
        }
        setIsRegistered(true);
      }
    } catch (err) {
      setErrorMsg("Network error. Could not connect to server.");
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
      formRef.current?.requestSubmit();
    }
  };

  return (
    <main className={styles.main}>
      <CanvasBackground />
      <section className={styles.cardContainer}>
        <div className={styles.cardWrapper}>
          {isRegistered ? (
            <section className={styles.card} style={{ gap: "0rem" }}>
              <div className={styles.header} style={{ gap: "0.35rem" }}>
                <div className={styles.iconCircle} style={{ marginBottom: "0.25rem" }}>
                  <FaPaperPlane size={44} className={styles.avatar} style={{ transform: "translate(-2px, 2px)" }} />
                </div>
                <h1 className={styles.title}>Account Created</h1>
              </div>

              <section className={styles.formSection} style={{ textAlign: "center"}}>
                <p style={{ color: "var(--text-description)", fontSize: "0.95rem", lineHeight: "1.6", maxWidth: "480px" }}>
                  A verification link has been sent to <strong style={{ color: "var(--sunset)" }}>{email}</strong>. Please check your inbox to verify your email address.
                </p>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", alignItems: "center" }}>
                  <Link href="/" className={`${styles.submitButton} ${styles.centerButton}`} style={{ textDecoration: "none" }}>
                    Back to Home Page
                  </Link>
                  <Link href="/user/send-verification" className={styles.resendLink}>
                    Didn&apos;t receive email? Resend verification link
                  </Link>
                </div>
              </section>
            </section>
          ) : (
            <section className={styles.card}>
              <div className={styles.header}>
                <FaUserCircle size={100} className={styles.avatar} />
                <h1 className={styles.title}>Join the Blitz</h1>
              </div>

              <section className={styles.formSection}>
                <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
                  <label className={styles.label}>
                    <FaUser className={styles.icon} />
                    <input 
                      type="text" 
                      placeholder="Username" 
                      className={`${styles.input} ${styles.usernameInput}`} 
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      onKeyDown={handleUsernameKeyDown}
                    />
                  </label>

                  <label className={styles.label}>
                    <FaEnvelope className={styles.icon} />
                    <input 
                      ref={emailInputRef}
                      type="email" 
                      placeholder="Email Address" 
                      className={`${styles.input} ${styles.emailInput}`} 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleEmailKeyDown}
                    />
                  </label>

                  <label className={`${styles.label} ${styles.fullWidth}`}>
                    <FaLock className={styles.icon} />
                    <input 
                      ref={passwordInputRef}
                      type={showPassword ? "text" : "password"} 
                      placeholder="Password" 
                      className={`${styles.input} ${styles.passwordInput}`} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handlePasswordKeyDown}
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

                  {errorMsg && <p className={styles.errorText}>{errorMsg}</p>}
                  {successMsg && <p className={styles.successText}>{successMsg}</p>}
                  <p className={styles.termsText}>
                    By signing up, you agree to our <Link href="/terms" className={styles.termsLink}>Terms of Service</Link> and <Link href="/privacy" className={styles.termsLink}>Privacy Policy</Link>.
                  </p>
                  <button type="submit" className={styles.submitButton} disabled={loading}>
                    {loading ? "Signing Up..." : "Sign Up"}
                  </button>

                </form>

                <p className={styles.switchPrompt}>
                  Already have an account?{" "}
                  <Link href="/user/login" className={styles.switchLink}>
                    Log In
                  </Link>
                </p>
              </section>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}