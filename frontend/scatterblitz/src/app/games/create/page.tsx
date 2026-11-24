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
  FaRobot,
} from "react-icons/fa";
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
    maxPlayers: number | string;
    maxTimePerRound: number | string;
    allowComputerHelper: boolean;
  }>({
    isPublic: true,
    password: "",
    maxPlayers: 5,
    maxTimePerRound: 60,
    allowComputerHelper: true,
  });

  const changeSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      setSettings((prev) => ({ ...prev, [name]: checked }));
      return;
    }

    if (type === "number") {
      // Allow empty string so user can clear and type fresh without leading 0 (e.g. 01, 02)
      if (value === "") {
        setSettings((prev) => ({ ...prev, [name]: "" }));
        return;
      }
      const num = parseInt(value, 10);
      setSettings((prev) => ({ ...prev, [name]: isNaN(num) ? "" : num }));
      return;
    }

    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const parsedMaxPlayers = Number(settings.maxPlayers);
  const isMaxPlayersInvalid =
    settings.maxPlayers === "" ||
    isNaN(parsedMaxPlayers) ||
    parsedMaxPlayers < 1 ||
    parsedMaxPlayers > 10;

  const parsedMaxTime = Number(settings.maxTimePerRound);
  const isMaxTimeInvalid =
    settings.maxTimePerRound === "" ||
    isNaN(parsedMaxTime) ||
    parsedMaxTime < 5 ||
    parsedMaxTime > 120;

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

    if (isMaxPlayersInvalid) {
      setError("Max players must be between 1 and 10.");
      return;
    }

    if (isMaxTimeInvalid) {
      setError("Round timer must be between 5 and 120 seconds.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        categories,
        ...settings,
        maxPlayers: parsedMaxPlayers,
        maxTimePerRound: parsedMaxTime,
      };

      const res = await authFetch(`${API_BASE_URL}/games/room/create`, {
        method: "POST",
        body: JSON.stringify(payload),
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

      <header className={styles.header}>
        <div className={styles.navContainer}>
          <button type="button" onClick={handleBack} className={styles.backButton}>
            <FaArrowLeft /> Back
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>Host Game <span style={{color: "var(--safety-orange)"}}>Room</span></h1>
          <p className={styles.subtitle}>
            Configure custom category decks, player limits, and round timers for your match.
          </p>
        </div>

        <div className={styles.formSection}>
          {/* Categories Box */}
          <div className={styles.categoriesBox}>
            <div className={styles.sectionHeaderRow}>
              <div className={styles.sectionLabel}>
                <FaTags /> Categories ({categories.length})
              </div>
              <span className={`${styles.helperText} ${styles.headerHelperText}`}>
                Select categories for the match
              </span>
            </div>

            <div className={styles.selectedCategoriesList}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={styles.categoryChip}
                  onClick={() => toggleCategory(cat)}
                  title={`Click to remove ${cat}`}
                >
                  <span>{cat}</span>
              
                </button>
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

            {/* Computer Helper Toggle */}
            <div className={styles.toggleRow}>
              <div className={styles.toggleTextCol}>
                <div className={styles.toggleTitle}>
                  <FaRobot style={{ color: "var(--amber)" }} />
                  <span>Computer Helper</span>
                </div>
                <span className={styles.helperText}>
                  Allow the computer to randomly pick letters when remaining letters exceed equal player turns
                </span>
              </div>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  name="allowComputerHelper"
                  id="allowComputerHelper"
                  checked={settings.allowComputerHelper}
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
                  <span className={styles.helperText}>1–10 Players</span>
                </label>
                <input
                  type="number"
                  id="maxPlayers"
                  min={1}
                  max={10}
                  name="maxPlayers"
                  className={`${styles.input} ${isMaxPlayersInvalid ? styles.inputError : ""}`}
                  value={settings.maxPlayers}
                  onChange={changeSettings}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel} htmlFor="maxTimePerRound">
                  <span className={styles.labelSpan}>
                    <FaClock /> Round Timer
                  </span>
                  <span className={styles.helperText}>5–120s</span>
                </label>
                <input
                  type="number"
                  id="maxTimePerRound"
                  min={5}
                  max={120}
                  name="maxTimePerRound"
                  className={`${styles.input} ${isMaxTimeInvalid ? styles.inputError : ""}`}
                  value={settings.maxTimePerRound}
                  onChange={changeSettings}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className={styles.errorMessage} style={{ marginBottom: "0.5rem" }}>
              <FaExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

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
