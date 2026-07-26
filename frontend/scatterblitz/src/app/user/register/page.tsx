"use client"
import { FaUser, FaLock, FaEnvelope, FaUserCircle } from 'react-icons/fa';
import { useState } from "react";
import Link from "next/link";
import styles from "./register.module.css";

export default function Register() {
    const [isLogin, setIsLogin] = useState(true);
    return(
        <main className={styles.main}>
            <section className={styles.tabSection}>
                <button 
                    className={`${styles.tabButton} ${isLogin ? styles.activeTab : ''}`} 
                    onClick={() => setIsLogin(true)}
                >
                    LOGIN
                </button>
                <button 
                    className={`${styles.tabButton} ${!isLogin ? styles.activeTab : ''}`} 
                    onClick={() => setIsLogin(false)}
                >
                    SIGN UP
                </button>
            </section>
            {isLogin ? <Login /> : <SignUp />}        
        </main>
    )
}

function Login(){
    return(
        <section className={styles.card}>
            <div className={styles.header}>
                <FaUserCircle size={100} className={styles.avatar} />
                <h1 className={styles.title}>Login</h1>
            </div>

            <section className={styles.formSection}>
                <form className={styles.form}>
                    <label className={styles.label}>
                        <FaUser className={styles.icon} />
                        <input 
                            type="text" 
                            placeholder="Username" 
                            className={`${styles.input} ${styles.usernameInput}`} 
                        />
                    </label>

                    <label className={styles.label}>
                        <FaLock className={styles.icon} />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            className={`${styles.input} ${styles.passwordInput}`} 
                        />
                    </label>
                    <div className={styles.actions}>
                        <Link href="/" className={styles.forgotPassword}>Forgot Password</Link>
                        <button type="submit" className={styles.submitButton}>Login</button>
                    </div>
                </form>
            </section>
        </section>
    )
}

function SignUp(){
    return(
        <section className={styles.card}>
            <div className={styles.header}>
                <FaUserCircle size={100} className={styles.avatar} />
                <h1 className={styles.title}>Sign Up</h1>
            </div>

            <section className={styles.formSection}>
                <form className={styles.form}>
                    <label className={styles.label}>
                        <FaUser className={styles.icon} />
                        <input 
                            type="text" 
                            placeholder="Username" 
                            className={`${styles.input} ${styles.usernameInput}`} 
                        />
                    </label>

                    <label className={styles.label}>
                        <FaEnvelope className={styles.icon} />
                        <input 
                            type="email" 
                            placeholder="Email Address" 
                            className={`${styles.input} ${styles.emailInput}`} 
                        />
                    </label>

                    <label className={styles.label}>
                        <FaLock className={styles.icon} />
                        <input 
                            type="password" 
                            placeholder="Password" 
                            className={`${styles.input} ${styles.passwordInput}`} 
                        />
                    </label>

                    <label className={styles.label}>
                        <FaLock className={styles.icon} />
                        <input 
                            type="password" 
                            placeholder="Confirm Password" 
                            className={`${styles.input} ${styles.confirmPasswordInput}`} 
                        />
                    </label>

                    <button type="submit" className={styles.submitButton}>Sign Up</button>
                </form>
            </section>
        </section>
    )
}