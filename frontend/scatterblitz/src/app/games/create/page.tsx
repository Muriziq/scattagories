"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaTags,
  FaGlobe,
  FaLock,
  FaUsers,
  FaClock,
  FaPlusCircle,
  FaExclamationTriangle,
  FaCompass,
} from "react-icons/fa";
import CanvasBackground from "../../components/CanvasBackground";
import styles from "../gameRooms.module.css";
import { createNewGuest, authFetch } from "../../accessToken";
import { API_BASE_URL } from "../../../config/api";
import AuthModel from "../authModels";

export default function CreateRoomPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [presetCategories, setPresetCategories] = useState<string[]>([]);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    const getCategories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/games/`);
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

  const handleCreateRoom = async () => {
    setError(null);

    if (categories.length === 0) {
      setError("Please select at least one category.");
      return;
    }

    if (!settings.isPublic && !settings.password.trim()) {
      setError("Private rooms must have a password.");
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch(`${API_BASE_URL}/games/room/create`, {
        method: "POST",
        body: JSON.stringify({ categories, ...settings }),
      });

      const data = await res.json();

      if (res.status === 439 || res.status === 401) {
        setLoading(false);
        setShowAuthModal(true);
        return;
      }

      if (!res.ok) {
        if (data.errors?.password?._errors) {
          setError(data.errors.password._errors.join(", "));
        } else {
          setError(data.message || "Failed to create room.");
        }
        return;
      }

      if (data.roomId) {
        router.push(`/games/${data.roomId}${settings.password ? `?password=${settings.password}` : ""}`);
      }
    } catch (err) {
      console.error("Network error creating room:", err);
      setError("Network error creating room. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const enterAsGuest = async () => {
    const guestToken = await createNewGuest();
    if (guestToken) {
      setShowAuthModal(false);
      handleCreateRoom();
    } else {
      setError("Failed to create guest session. Please try logging in.");
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <CanvasBackground />

      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <FaArrowLeft /> Back
          </button>
          <Link href="/games/join" className={styles.switchRouteLink}>
            <FaCompass /> Browse Lobbies
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>HOST GAME ROOM</h1>
          <p className={styles.subtitle}>
            Configure custom category decks, player limits, and round timers for your match.
          </p>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        <div className={styles.formSection}>
          {/* Categories Box */}
          <div className={styles.categoriesBox}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionLabel}>
                <FaTags /> Categories ({categories.length})
              </div>
              <span className={styles.helperText}>Select categories for the match</span>
            </div>

            <div className={styles.selectedCategoriesList}>
              {categories.map((cat) => (
                <span key={cat} className={styles.categoryChip}>
                  {cat}
                </span>
              ))}
            </div>

            <div>
              <span className={styles.helperText} style={{ display: "block", marginBottom: "0.6rem" }}>
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

          {/* Room Settings Box */}
          <div className={styles.settingsBox}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionLabel}>
                <FaUsers /> Match Rules &amp; Visibility
              </div>
            </div>

            {/* Public/Private Toggle */}
            <div className={styles.toggleRow}>
              <div className={styles.toggleTextCol}>
                <div className={styles.toggleTitle}>
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

            {/* Inputs Grid */}
            <div className={styles.controlsGrid}>
              {!settings.isPublic && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="password">
                    <span className={styles.labelSpan}>
                      <FaLock /> Room Password
                    </span>
                  </label>
                  <input
                    type="password"
                    id="password"
                    placeholder="Enter room password"
                    name="password"
                    className={styles.input}
                    value={settings.password}
                    onChange={changeSettings}
                  />
                </div>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="maxPlayers">
                  <span className={styles.labelSpan}>
                    <FaUsers /> Max Players
                  </span>
                  <span className={styles.helperText}>2–8 Players</span>
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

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="maxTimePerRound">
                  <span className={styles.labelSpan}>
                    <FaClock /> Round Timer
                  </span>
                  <span className={styles.helperText}>10–120s</span>
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
            onClick={handleCreateRoom}
            disabled={loading}
          >
            <FaPlusCircle /> {loading ? "CREATING ROOM..." : "HOST ROOM"}
          </button>
        </div>

        {showAuthModal && (
          <AuthModel
            modelFunction={enterAsGuest}
            cancelModal={() => setShowAuthModal(false)}
          />
        )}
      </main>
    </div>
  );
}
