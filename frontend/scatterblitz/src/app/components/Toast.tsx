"use client";

import { useEffect, useRef } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaTimesCircle,
  FaTimes,
  FaInfoCircle,
} from "react-icons/fa";
import styles from "./Toast.module.css";

export type ToastType = "error" | "success" | "warning" | "info";

export interface ToastProps {
  message: string | null;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  message,
  type = "error",
  duration = 3500,
  onClose,
}: ToastProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!message) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        onClose();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [message, duration, onClose]);

  if (!message) return null;

  const renderIcon = () => {
    switch (type) {
      case "success":
        return <FaCheckCircle className={styles.toastIcon} />;
      case "warning":
        return <FaExclamationTriangle className={styles.toastIcon} />;
      case "info":
        return <FaInfoCircle className={styles.toastIcon} />;
      case "error":
      default:
        return <FaTimesCircle className={styles.toastIcon} />;
    }
  };

  const variantClass =
    type === "success"
      ? styles.toastSuccess
      : type === "warning"
      ? styles.toastWarning
      : type === "info"
      ? styles.toastWarning
      : styles.toastError;

  return (
    <div
      className={`${styles.toastContainer} ${variantClass}`}
      role="alert"
      aria-live="assertive"
    >
      <div className={styles.toastContent}>
        {renderIcon()}
        <span className={styles.toastText}>{message}</span>
      </div>

      <button
        type="button"
        className={styles.toastCloseBtn}
        onClick={onClose}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <FaTimes size={13} />
      </button>

      {duration > 0 && (
        <div
          className={styles.toastProgressBar}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
}

