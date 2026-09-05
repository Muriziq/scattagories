"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FaExclamationTriangle,
  FaLock,
  FaGlobe,
  FaUsers,
  FaClock,
  FaTags,
  FaUserCircle,
  FaTimes,
} from "react-icons/fa";
import styles from "../rooms.module.css";
import { getAccessToken, createNewGuest } from "../../../accessToken";
import AuthModel from "../../authModels";

export default function CreateRoom() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [presetCategories, setPresetCategories] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const getCategories = async () => {
      try {
        const res = await fetch("http://localhost:5000/games/");
        if (!res.ok) {
          setError("Server Error. Please reload.");
          return;
        }
        const data = await res.json();
        if (data.categories) {
          setPresetCategories(data.categories);
          setCategories([data.categories[0]]);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    getCategories();
  }, []);

  const [settings, setSettings] = useState<{
    isPublic: boolean;
    password: string;
    maxPlayers: number;
    maxTimePerRound: number;
  }>({
    isPublic: true,
    password: "",
    maxPlayers: 5,
    maxTimePerRound: 60,
  });

  const changeSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? Number(value)
            : value,
    }));
  };

  const toggleCategory = (cat: string) => {
    if (categories.includes(cat)) {
      if (categories.length <= 1) return;
      setCategories(categories.filter((c) => c !== cat));
    } else {
      setCategories([...categories, cat]);
    }
  };

  const createRoom = async () => {
    setError(null);

    if (categories.length === 0) {
      setError("Please select at least one category.");
      return;
    }

    if (!settings.isPublic && !settings.password.trim()) {
      setError("Private rooms must have a password.");
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken || accessToken === "") {
      setLoading(false);
      setShowAuthModal(true);
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/games/room/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ categories, ...settings }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors?.password?._errors) {
          setError(data.errors.password._errors.join(", "));
        } else {
          setError(data.message || "Failed to create room.");
        }
        console.error("Create room error:", data);
        return;
      }

      console.log("Room created successfully:", data);
      if (data.roomId) {
        router.push(`/games/${data.roomId}${settings.password ? `?password=${settings.password}` : ''}`);
      }
    } catch (err: any) {
      console.error("Network or creation error:", err);
      setError("Network error creating room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const enterAsGuest = async () => {
    const guestToken = await createNewGuest();
    if (guestToken) {
      setShowAuthModal(false);
      createRoom();
    } else {
      setError("Failed to create guest session. Please try logging in.");
    }
  };

  return (
    <section>
      <h2 className={styles.sectionTitle}>CREATE ROOM</h2>

      {error && (
        <div className={styles.errorMessage}>
          <FaExclamationTriangle />
          <span>{error}</span>
        </div>
      )}

      {/* CATEGORIES SECTION */}
      <div className={styles.categoriesBox}>
        <div className={styles.formLabel}>
          <span>
            <FaTags /> Categories ({categories.length})
          </span>
          <span className={styles.helperText}>
            Select categories for the match
          </span>
        </div>

        {/* Selected categories chips */}
        <div className={styles.selectedCategoriesList}>
          {categories.map((cat) => (
            <span key={cat} className={styles.categoryChip}>
              {cat}
            </span>
          ))}
        </div>

        {/* Preset Category Chips */}
        <div>
          <span
            className={styles.helperText}
            style={{ display: "block", marginBottom: "0.5rem" }}
          >
            Popular Presets:
          </span>
          <div className={styles.presetCategoriesGrid}>
            {presetCategories.map((cat) => {
              const isSelected = categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  className={`${styles.presetChipBtn} ${isSelected ? styles.presetChipActive : ""}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {isSelected ? `✓ ${cat}` : `+ ${cat}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ROOM SETTINGS GRID */}
      <div className={styles.formGrid}>
        {/* Public / Private Toggle */}
        <div className={styles.toggleRow}>
          <div>
            <div className={styles.formLabel}>
              {settings.isPublic ? (
                <FaGlobe style={{ color: "var(--amber)" }} />
              ) : (
                <FaLock style={{ color: "var(--safety-orange)" }} />
              )}
              <span>{settings.isPublic ? "Public Room" : "Private Room"}</span>
            </div>
            <span className={styles.helperText}>
              {settings.isPublic
                ? "Anyone can discover and join via lobby matchmaking"
                : "Only players with the password can join"}
            </span>
          </div>
          <label className={styles.switch}>
            <input
              type="checkbox"
              name="isPublic"
              id="isPublic"
              checked={settings.isPublic}
              onChange={changeSettings}
            />
            <span className={styles.slider}></span>
          </label>
        </div>

        <div className={styles.lastRow}>
          {/* Password field if Private */}
          {!settings.isPublic && (
            <div className={styles.formGroup}>
              <label className={styles.lastRowLabel} htmlFor="password">
                <span className={styles.formSpan}>
                  <FaLock /> Room Password
                </span>
              </label>
              <input
                type="password"
                id="password"
                placeholder="Enter password for private room"
                name="password"
                className={styles.input}
                value={settings.password}
                onChange={changeSettings}
              />
            </div>
          )}

          {/* Number of Players */}
          <div className={styles.formGroup}>
            <label className={styles.lastRowLabel} htmlFor="maxPlayers">
              <span className={styles.formSpan}>
                <FaUsers /> Max Players
              </span>
              <span className={styles.helperText}>2-8 Players</span>
            </label>
            <input
              type="number"
              id="maxPlayers"
              min={2}
              max={8}
              name="maxPlayers"
              className={styles.input}
              value={settings.maxPlayers}
              onChange={changeSettings}
            />
          </div>

          {/* Max Time Per Round */}
          <div className={styles.formGroup}>
            <label className={styles.lastRowLabel} htmlFor="maxTimePerRound">
              <span className={styles.formSpan}>
                <FaClock /> Round Timer
              </span>
              <span className={styles.helperText}>10-120 seconds</span>
            </label>
            <input
              type="number"
              id="maxTimePerRound"
              min={10}
              max={120}
              name="maxTimePerRound"
              className={styles.input}
              value={settings.maxTimePerRound}
              onChange={changeSettings}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        onClick={createRoom}
        disabled={loading}
      >
        {loading ? "CREATING ROOM..." : "CREATE ROOM"}
      </button>

      {/* AUTH REQUIRED POPUP MODAL */}
      {showAuthModal && (
        <AuthModel
          modelFunction={enterAsGuest}
          cancelModal={() => setShowAuthModal(false)}
        />
      )}
    </section>
  );
}
