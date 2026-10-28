"use client";
import { FaUser, FaLock, FaUserCircle, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useState, FormEvent, useRef, KeyboardEvent } from "react";
import Link from "next/link";
import styles from "./login.module.css";
import { useRouter } from 'next/navigation';
import { saveAccessToken, updateUserData, getDeviceId } from "../../accessToken";
import { API_BASE_URL } from "../../../config/api";
import CanvasBackground from "../../components/CanvasBackground";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Validates credentials and logs in the user, saving access token in memory
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!username.trim()) {
      setErrorMsg("Please enter Username or Email");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter Password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": getDeviceId(),
        },
        credentials: "include",
        body: JSON.stringify({ identifier: username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || "Invalid credentials");
      } else {
        setSuccessMsg(data.message || "Login successful! Redirecting...");
        if (data?.accessToken) {
          saveAccessToken(data.accessToken);
        }
        if (data?.user && typeof data.user === "object") {
          updateUserData(data.user);
        }
        setTimeout(() => {
          router.push("/");
        }, 1000);
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
          <section className={styles.card}>
            <div className={styles.header}>
              <FaUserCircle size={100} className={styles.avatar} />
              <h1 className={styles.title}>Welcome Back</h1>
            </div>

            <section className={styles.formSection}>
              <form ref={formRef} className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.label}>
                  <FaUser className={styles.icon} />
                  <input 
                    type="text" 
                    placeholder="Username or Email" 
                    className={`${styles.input} ${styles.usernameInput}`} 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={handleUsernameKeyDown}
                  />
                </label>

                <label className={styles.label}>
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

                <div className={styles.actions}>
                  <Link href="/user/forgot-password" className={styles.forgotPassword}>Forgot Password?</Link>
                  <button type="submit" className={styles.submitButton} disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                  </button>
                </div>
              </form>

              <p className={styles.switchPrompt}>
                Don&apos;t have an account?{" "}
                <Link href="/user/register" className={styles.switchLink}>
                  Sign Up
                </Link>
              </p>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
