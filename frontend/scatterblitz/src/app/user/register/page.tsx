"use client"
import { FaUser, FaLock, FaEnvelope, FaUserCircle, FaGoogle, FaGithub, FaDiscord, FaEye, FaEyeSlash } from 'react-icons/fa';
import { useState, useRef, FormEvent, useEffect, Suspense } from "react";
import Link from "next/link";
import styles from "./register.module.css";
import { useSearchParams, useRouter } from 'next/navigation';

function RegisterContent() {
  const searchParams = useSearchParams();
  const [isLogin, setIsLogin] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'login') {
      setIsLogin(true);
    } else if (type === 'register' || type === 'signup') {
      setIsLogin(false);
    }
  }, [searchParams]);

  return (
    <main className={styles.main}>
      <section className={styles.cardContainer}>
        <section className={styles.tabSection}>
            <div className={styles.sectionStyle1}></div>
            <div className={styles.sectionStyle2}></div>
            <div className={styles.sectionStyle3}></div>
            <div className={styles.sectionStyle4}></div>
            <div className={styles.tabButtons}>
    <button 
            className={`${styles.tabButton} ${isLogin ? styles.activeTab : ''}`} 
            onClick={(e) => {e.preventDefault();setIsLogin(true)}}
          >
            LOGIN
          </button>
          <button 
            className={`${styles.tabButton} ${!isLogin ? styles.activeTab : ''}`} 
            onClick={(e) => {e.preventDefault();setIsLogin(false)}}
          >
            SIGN UP
          </button>
            </div>
      
        </section>
        <div className={styles.cardWrapper}>
          {isLogin ? <Login /> : <SignUp />} 
        </div>
      </section>
    </main>
  );
}

export default function Register() {
  return (
    <Suspense fallback={<main className={styles.main}></main>}>
      <RegisterContent />
    </Suspense>
  );
}

function Login(){
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");
    const [loading, setLoading] = useState(false);

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
            const res = await fetch("http://localhost:5000/user/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ identifier: username, password })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.message || "Invalid credentials");
            } else {
                setSuccessMsg(data.message || "Login successful! Redirecting...");
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

    return(
        <section className={styles.card}>
            <div className={styles.header}>
                <FaUserCircle size={100} className={styles.avatar} />
                <h1 className={styles.title}>Login</h1>
            </div>

            <section className={styles.formSection}>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label}>
                        <FaUser className={styles.icon} />
                        <input 
                            type="text" 
                            placeholder="Username or Email" 
                            className={`${styles.input} ${styles.usernameInput}`} 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </label>

                    <label className={styles.label}>
                        <FaLock className={styles.icon} />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Password" 
                            className={`${styles.input} ${styles.passwordInput}`} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                        <Link href="/" className={styles.forgotPassword}>Forgot Password</Link>
                        <button type="submit" className={styles.submitButton} disabled={loading}>
                            {loading ? "Logging in..." : "Login"}
                        </button>
                    </div>
                </form>

                <div className={styles.socialSection}>
                    <div className={styles.socialDivider}>
                        <span>OR CONTINUE WITH</span>
                    </div>
                    <div className={styles.socialButtons}>
                        <button type="button" className={styles.socialButton} aria-label="Sign in with Google">
                            <FaGoogle className={styles.socialIcon} />
                        </button>
                        <button type="button" className={styles.socialButton} aria-label="Sign in with GitHub">
                            <FaGithub className={styles.socialIcon} />
                        </button>
                        <button type="button" className={styles.socialButton} aria-label="Sign in with Discord">
                            <FaDiscord className={styles.socialIcon} />
                        </button>
                    </div>
                </div>

            </section>
        </section>
    )
}

function SignUp(){
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
            const res = await fetch("http://localhost:5000/user/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, email, password })
            });
            const data = await res.json();
            if (!res.ok) {
                setErrorMsg(data.message || "Registration failed");
            } else {
                setSuccessMsg(data.message || "Registered successfully! Redirecting...");
                setTimeout(() => {
                    router.push("/");
                }, 1200);
            }
        } catch (err) {
            setErrorMsg("Network error. Could not connect to server.");
        } finally {
            setLoading(false);
        }
    };

    return(
        <section className={styles.card}>
            <div className={styles.header}>
                <FaUserCircle size={100} className={styles.avatar} />
                <h1 className={styles.title}>Sign Up</h1>
            </div>

            <section className={styles.formSection}>
                <form className={styles.form} onSubmit={handleSubmit}>
                    <label className={styles.label}>
                        <FaUser className={styles.icon} />
                        <input 
                            type="text" 
                            placeholder="Username" 
                            className={`${styles.input} ${styles.usernameInput}`} 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </label>

                    <label className={styles.label}>
                        <FaEnvelope className={styles.icon} />
                        <input 
                            type="email" 
                            placeholder="Email Address" 
                            className={`${styles.input} ${styles.emailInput}`} 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>

                    <label className={styles.label}>
                        <FaLock className={styles.icon} />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Password" 
                            className={`${styles.input} ${styles.passwordInput}`} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
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
                            placeholder="Confirm Password" 
                            className={`${styles.input} ${styles.confirmPasswordInput}`} 
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
                        {loading ? "Signing Up..." : "Sign Up"}
                    </button>
                    <p className={styles.termsText}>
                        By signing up, you agree to our <Link href="#" className={styles.termsLink}>Terms of Service</Link> and <Link href="#" className={styles.termsLink}>Privacy Policy</Link>.
                    </p>
                </form>

                <div className={styles.socialSection}>
                    <div className={styles.socialDivider}>
                        <span>OR REGISTER WITH</span>
                    </div>
                    <div className={styles.socialButtons}>
                        <button type="button" className={styles.socialButton} aria-label="Register with Google">
                            <FaGoogle className={styles.socialIcon} />
                        </button>
                        <button type="button" className={styles.socialButton} aria-label="Register with GitHub">
                            <FaGithub className={styles.socialIcon} />
                        </button>
                        <button type="button" className={styles.socialButton} aria-label="Register with Discord">
                            <FaDiscord className={styles.socialIcon} />
                        </button>
                    </div>
                </div>

            </section>
        </section>
    )
}