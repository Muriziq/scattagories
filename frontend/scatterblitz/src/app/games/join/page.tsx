"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FaArrowLeft,
  FaUsers,
  FaSearch,
  FaSyncAlt,
  FaCheck,
} from "react-icons/fa";
import CanvasBackground from "../../components/CanvasBackground";
import styles from "../gameRooms.module.css";
import { API_BASE_URL } from "../../../config/api";

interface PublicRoomData {
  roomId: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  createdAt: number;
  hostUsername?: string | null;
  categories: string[];
}

export default function JoinRoomPage() {
  const router = useRouter();
  const [publicRooms, setPublicRooms] = useState<PublicRoomData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAllCategories, setIsAllCategories] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch available preset categories for filter buttons on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/games/`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.categories)) {
            setAvailableCategories(data.categories);
          }
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };

    fetchCategories();
  }, []);

  // Fetch public rooms with optional search and multiple categories
  const fetchPublicRooms = useCallback(
    async (
      query: string = searchQuery,
      allCat: boolean = isAllCategories,
      selectedCats: string[] = selectedCategories,
      isManual: boolean = false
    ) => {
      if (isManual) setIsRefreshing(true);
      else setLoadingRooms(true);

      try {
        const params = new URLSearchParams();
        if (query.trim()) {
          params.append("search", query.trim());
        }
        // If "All Categories" is active or specific categories are checked, pass them to backend
        if (allCat) {
          // No category constraint needed (fetches all public rooms)
        } else if (selectedCats.length > 0) {
          params.append("categories", selectedCats.join(","));
        }

        const queryString = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`${API_BASE_URL}/games/rooms/public${queryString}`);
        if (res.ok) {
          const data = await res.json();
          setPublicRooms(data.rooms || []);
        }
      } catch (err) {
        console.error("Failed to fetch public rooms:", err);
      } finally {
        setLoadingRooms(false);
        setIsRefreshing(false);
      }
    },
    [searchQuery, isAllCategories, selectedCategories]
  );

  // 1. Debounced search when user types or changes category filters
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPublicRooms(searchQuery, isAllCategories, selectedCategories, false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isAllCategories, selectedCategories, fetchPublicRooms]);

  // 2. Auto-refresh interval (every 60 seconds)
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchPublicRooms(searchQuery, isAllCategories, selectedCategories, false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [searchQuery, isAllCategories, selectedCategories, fetchPublicRooms]);

  // Checkbox toggle logic for categories
  const handleToggleCategory = (categoryName: string) => {
    if (isAllCategories) return;
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleToggleAllCategories = () => {
    setIsAllCategories((prev) => !prev);
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
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>public LOBBIES</h1>
          <p className={styles.subtitle}>
            Browse open public lobbies and jump into a match.
          </p>
        </div>

        {/* Public Lobbies Section */}
        <div className={styles.publicRoomsSection}>
          {/* Search bar & Refresh control */}
          <div className={styles.publicHeaderRow}>
            <div className={styles.searchInputWrap}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="FILTER ROOM CODE OR HOST..."
                className={styles.lobbySearchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
              />
            </div>

            <button
              type="button"
              className={styles.refreshIconButton}
              onClick={() =>
                fetchPublicRooms(searchQuery, isAllCategories, selectedCategories, true)
              }
              disabled={isRefreshing || loadingRooms}
              title="Refresh lobbies"
              aria-label="Refresh lobbies"
            >
              <FaSyncAlt className={isRefreshing ? "spin" : ""} size={16} />
            </button>
          </div>

          {/* Checkbox Category Filter Pills */}
          {availableCategories.length > 0 && (
            <div className={styles.categoryFiltersRow}>
              <button
                type="button"
                className={`${styles.categoryFilterBtn} ${
                  isAllCategories ? styles.categoryFilterBtnActive : ""
                }`}
                onClick={handleToggleAllCategories}
              >
                {isAllCategories && <FaCheck size={10} />} All Categories
              </button>

              {availableCategories.map((cat) => {
                const isChecked = selectedCategories.includes(cat);
                const isDisabled = isAllCategories;

                return (
                  <button
                    key={cat}
                    type="button"
                    disabled={isDisabled}
                    className={`${styles.categoryFilterBtn} ${
                      isChecked && !isDisabled ? styles.categoryFilterBtnActive : ""
                    } ${isDisabled ? styles.categoryFilterBtnDisabled : ""}`}
                    onClick={() => handleToggleCategory(cat)}
                  >
                    {isChecked && !isDisabled && <FaCheck size={10} />}
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lobbies Table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Room Code</th>
                  <th>Players</th>
                  <th>Categories</th>
                  <th style={{ textAlign: "left" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingRooms && publicRooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        color: "var(--text-subtle)",
                        padding: "3rem",
                      }}
                    >
                      Searching for active lobbies...
                    </td>
                  </tr>
                ) : publicRooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: "center",
                        color: "var(--text-subtle)",
                        padding: "3rem",
                      }}
                    >
                      No active public rooms matching your filter.{" "}
                      <Link
                        href="/games/create"
                        style={{ color: "var(--amber)", textDecoration: "underline" }}
                      >
                        Host one now!
                      </Link>
                    </td>
                  </tr>
                ) : (
                  publicRooms.map((room) => {
                    const isAlmostFull = room.playerCount >= room.maxPlayers - 1;
                    const isFull = room.playerCount >= room.maxPlayers;
                    const badgeClass = isFull
                      ? `${styles.playerBadge} ${styles.playerBadgeFull}`
                      : isAlmostFull
                      ? `${styles.playerBadge} ${styles.playerBadgeAlmostFull}`
                      : styles.playerBadge;

                    return (
                      <tr
                        key={room.roomId}
                        onClick={() => router.push(`/games/${room.roomId}`)}
                      >
                        <td>
                          <div className={styles.roomCodeDisplay}>#{room.roomId}</div>
                          {room.hostUsername && (
                            <div className={styles.hostSubtext}>
                              Host: @{room.hostUsername}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={badgeClass}>
                            <FaUsers />
                            {room.playerCount} / {room.maxPlayers}
                          </span>
                        </td>
                        <td className={styles.categoriesCell}>
                          <div className={styles.categoryPillsWrap}>
                            {room.categories && room.categories.length > 0 ? (
                              room.categories.map((cat, idx) => (
                                <span key={idx} className={styles.categoryPill}>
                                  {cat}
                                </span>
                              ))
                            ) : (
                              <span style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>
                                Default
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "left" }}>
                          <button
                            type="button"
                            className={styles.joinTableBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/games/${room.roomId}`);
                            }}
                          >
                            Join Match
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
