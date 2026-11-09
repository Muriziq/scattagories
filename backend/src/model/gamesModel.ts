import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../server";
import { getAvailableCategories, isCategoryWordValid } from "../services/categoryManager";
import pool from "../db";
import { v7 as uuidv7 } from "uuid";

// Dedicated in-memory registries separating public lobbies from private game rooms
export const publicRooms = new Map<string, GameRoom>();
export const privateRooms = new Map<string, GameRoom>();

// Unified O(1) lookup helper to retrieve a game room regardless of privacy setting
export function getRoom(roomId: string): GameRoom | undefined {
  return publicRooms.get(roomId) || privateRooms.get(roomId);
}

// Unified deletion helper removing a game room from either public or private registries
export function deleteRoom(roomId: string): boolean {
  return publicRooms.delete(roomId) || privateRooms.delete(roomId);
}

// Returns the total number of active rooms across both public and private maps
export function getTotalRoomsCount(): number {
  return publicRooms.size + privateRooms.size;
}

// Re-export dynamic category accessor for game creation and lookups
export { getAvailableCategories };
export const availableCategories = [
  "Countries",
  "Capitals",
  "Currencies",
  "States",
] as const;

// Strips diacritics, punctuation, and leading whitespace for normalized answer matching
function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^[^a-z0-9]/i, "");
}

export const alphabets = {
  en: [
    "A", "B", "C", "D", "E",
    //  "F", "G", "H", "I", "J",
    // "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    // "U", "V", "W", "X", "Y", "Z"
  ],
} as const;

export type Language = keyof typeof alphabets;

// Represents an active Scatterblitz game room and manages round timers, state, and scoring
export class GameRoom {
  // Core Identity
  id: string;
  password: string | null;
  createdAt: Date;
  hostUsername: string | null;

  // Room Configuration
  maxPlayers: number;
  maxTimePerRound: number;
  categories: string[];
  language: Language;
  allowComputerHelper: boolean;

  // Game Lifecycle State
  status: "waiting" | "letter_selection" | "active_sprint" | "recap" | "ended";
  currentRound: number;
  totalRound: number;
  usersTurn: string | null;
  availableLetters: string[];
  activeLetter: string | null;
  isBoardLocked: boolean;
  // Timers and Grace Periods
  roundTimer: NodeJS.Timeout | null;
  selectionTimer: NodeJS.Timeout | null;
  connectionTimeout: NodeJS.Timeout | null;
  forfeitTimer: NodeJS.Timeout | null = null;
  pausedStateBeforeForfeit: {
    status: "waiting" | "letter_selection" | "active_sprint" | "recap";
    remainingSprintMs?: number;
    remainingSelectionMs?: number;
  } | null = null;
  disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  recapSkipVotes: Set<string> = new Set();
  selectionTimeLimit: number;
  roundStartTime: number | null = null;
  selectionStartTime: number | null = null;
  isPublic: boolean;

  // Live Participant Data keyed by username
  participants: Map<
    string,
    {
      score: number;
      avatar_url?: string | null;
      hasLeft?: boolean;
      isConnected?: boolean;
    }
  >;

  // Tracks usernames flagged for anti-cheat violations in the active round (reset each round)
  flaggedCheaters: Set<string> = new Set();

  // Internal mapping of username to database UUID for post-game PostgreSQL persistence
  userDbIds: Record<string, string>;

  // Submissions structured as: { Letter: { participantName: { Category: { answer, score, cheated?: boolean } } } }
  detailedSubmissions: Record<
    string,
    Record<
      string,
      Record<string, { answer: string; score: number; cheated?: boolean }>
    >
  >;
  submitStatus: "accepting" | "notAccepting";

  // Per-round input telemetry tracking: username -> { category -> { focusedAt?: number, totalDurationMs: number, blurCount: number } }
  inputActivity: Map<
    string,
    Map<string, { focusedAt?: number; totalDurationMs: number; blurCount: number }>
  > = new Map();

  constructor(
    id: string,
    hostUsername: string,
    hostDbId: string,
    maxPlayers: number = 8,
    maxTimePerRound: number = 60,
    password: string | null = null,
    isPublic: boolean = true,
    categories: string[] = [...getAvailableCategories()],
    allowComputerHelper: boolean = true
  ) {
    this.id = id;
    this.hostUsername = hostUsername;
    this.maxPlayers = maxPlayers;
    this.maxTimePerRound = maxTimePerRound;
    this.password = password;
    this.categories = categories;
    this.allowComputerHelper = allowComputerHelper;

    this.createdAt = new Date();
    this.isPublic = isPublic;

    this.roundTimer = null;
    this.selectionTimer = null;
    this.connectionTimeout = null;
    this.selectionTimeLimit = 15;

    this.status = "waiting";
    this.currentRound = 0;
    this.usersTurn = hostUsername;
    this.activeLetter = null;
    this.totalRound = 0;
    this.isBoardLocked = false;
    this.submitStatus = "notAccepting";

    this.language = "en";
    this.availableLetters = [...this.getAllLetters()];

    this.participants = new Map();
    this.flaggedCheaters = new Set();
    this.userDbIds = { [hostUsername]: hostDbId };
    this.detailedSubmissions = {};
  }

  public getAllLetters(): readonly string[] {
    return alphabets[this.language] || alphabets.en;
  }

  // Adds a connected socket user as an active room participant
  public addParticipant(socket: AuthenticatedSocket) {
    if (!socket.user) return socket.emit("error", "Unauthorized: Authentication required");
    const username = socket.user.username;
    this.userDbIds[username] = socket.user.id;
    this.participants.set(username, {
      score: 0,
      avatar_url: socket.user.avatar_url || null,
      hasLeft: false,
      isConnected: true,
    });
  }

  // Handles player departure; cleans up empty rooms or reassigns host if needed
  public removeParticipant(username: string, io?: Server, socket?: Socket) {
    const participant = this.participants.get(username);
    if (!participant) return;

    // Clear any pending disconnect timer for this user
    this.clearDisconnectTimer(username);

    if (this.status === "waiting") {
      this.participants.delete(username);
      delete this.userDbIds[username];
      // Destroy room if all participants left
      if (this.participants.size === 0) {
        this.clearConnectionTimeout();
        this.clearSelectionTimer();
        this.clearRoundTimer();
        this.clearForfeitTimer();
        this.clearAllDisconnectTimers();
        deleteRoom(this.id);
      } else if (this.hostUsername === username) {
        // Reassign host role to the next participant in the lobby
        const remainingUsers = Array.from(this.participants.keys());
        this.hostUsername = remainingUsers.length > 0 ? remainingUsers[0] : null;
      }
    } else {
      // Mark as left during active game to maintain scoreboard consistency
      participant.hasLeft = true;
      participant.isConnected = false;

      const activeParticipants = Array.from(this.participants.entries()).filter(([_, p]) => !p.hasLeft);
      
      // If no active players remain, destroy room immediately
      if (activeParticipants.length === 0) {
        this.clearConnectionTimeout();
        this.clearSelectionTimer();
        this.clearRoundTimer();
        this.clearForfeitTimer();
        this.clearAllDisconnectTimers();
        deleteRoom(this.id);
        return;
      }

      // If only 1 player remains and match is still active, trigger 15s forfeit grace period
      if (activeParticipants.length === 1 && this.status !== "ended" && io) {
        const remainingUsername = activeParticipants[0][0];
        this.startForfeitCountdown(remainingUsername, io, socket);
        return;
      }

      // Recalculate remaining rounds dynamically so all remaining active players get equal turns
      this.recalculateRemainingRounds(io);

      // If departing player held the letter selection turn, advance immediately to next turn
      if (io && this.usersTurn === username && this.status === "letter_selection") {
        this.clearSelectionTimer();
        this.getNextUserTurn(io, socket);
      }
    }
  }

  // Gracefully handles mid-game disconnects with a 30s reconnect window
  public handlePlayerDisconnect(username: string, io: Server) {
    const participant = this.participants.get(username);
    if (!participant || participant.hasLeft) return;

    participant.isConnected = false;
    this.clearDisconnectTimer(username);

    // Notify room of participant connection status change
    io.to(this.id).emit("room:participants", this.getRoomParticipantsData());

    // Check if only 1 connected active player remains
    const activeConnected = Array.from(this.participants.entries()).filter(
      ([_, p]) => !p.hasLeft && p.isConnected !== false
    );

    if (activeConnected.length === 1 && this.status !== "ended") {
      const remainingUsername = activeConnected[0][0];
      this.startForfeitCountdown(remainingUsername, io);
      // The 15s forfeit countdown governs the outcome; no redundant 30s disconnect timer needed
      return;
    }

    // Set a 30-second disconnect timeout only if multiple players are still active
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(username);
      this.removeParticipant(username, io);
      io.to(this.id).emit("room:participants", this.getRoomParticipantsData());
    }, 30000);

    this.disconnectTimers.set(username, timer);
  }

  // Restores a returning player if they reconnect within the grace period
  public handlePlayerReconnect(username: string, socket: AuthenticatedSocket, io: Server) {
    const participant = this.participants.get(username);
    if (!participant) return;

    this.clearDisconnectTimer(username);
    participant.isConnected = true;
    participant.hasLeft = false;
    if (socket.user?.avatar_url) {
      participant.avatar_url = socket.user.avatar_url;
    }

    // Recalculate remaining rounds dynamically to re-include the returning player
    this.recalculateRemainingRounds(io);

    // If room was counting down to forfeit victory for the sole player, cancel it and resume accurately
    if (this.forfeitTimer !== null) {
      const paused = this.pausedStateBeforeForfeit;
      this.clearForfeitTimer();

      io.to(this.id).emit("room:forfeit_cancelled", {
        message: `${username} reconnected. Resuming match!`,
      });

      // Resume exact paused game flow without skipping rounds or prematurely triggering recap
      if (this.status !== "ended" && paused) {
        if (paused.status === "letter_selection") {
          this.status = "letter_selection";
          const remainingSec = Math.max(
            3,
            Math.ceil((paused.remainingSelectionMs || this.selectionTimeLimit * 1000) / 1000)
          );
          this.selectionStartTime = Date.now();

          io.to(this.id).emit("turn:change", {
            usersTurn: this.usersTurn,
            selectionTimeLimit: remainingSec,
            selectionStartTime: this.selectionStartTime,
          });

          this.selectionTimer = setTimeout(() => {
            if (this.status === "letter_selection" && this.availableLetters.length > 0) {
              const randomLetter =
                this.availableLetters[
                  Math.floor(Math.random() * this.availableLetters.length)
                ];
              if (randomLetter) {
                this.setActiveLetter(randomLetter, io, socket);
              }
            }
          }, remainingSec * 1000);
        } else if (paused.status === "active_sprint" && this.activeLetter) {
          this.status = "active_sprint";
          const remainingMs = Math.max(2000, paused.remainingSprintMs || this.maxTimePerRound * 1000);
          this.roundStartTime = Date.now() - (this.maxTimePerRound * 1000 - remainingMs);

          io.to(this.id).emit("letter:active", {
            letter: this.activeLetter,
            roundStartTime: this.roundStartTime,
          });

          this.roundTimer = setTimeout(() => {
            this.submitStatus = "accepting";
            io.to(this.id).emit("round:ended", { reason: "time_up" });
            this.startRecapTimer(io, socket);
          }, remainingMs);
        } else if (paused.status === "recap") {
          this.startRecapTimer(io, socket);
        }
      }
    }

    io.to(this.id).emit("room:participants", this.getRoomParticipantsData());
  }

  // Starts a 15-second forfeit countdown when only 1 active player remains
  public startForfeitCountdown(remainingUsername: string, io: Server, socket?: Socket) {
    // Prevent starting forfeit if game has already ended or timer is already running
    if (this.status === "ended" || this.forfeitTimer !== null) return;

    // Snapshot currently active phase and exact remaining timer durations before pausing
    const now = Date.now();
    let remainingSprintMs: number | undefined;
    let remainingSelectionMs: number | undefined;

    if (this.status === "active_sprint" && this.roundStartTime) {
      const elapsed = now - this.roundStartTime;
      remainingSprintMs = Math.max(0, this.maxTimePerRound * 1000 - elapsed);
    } else if (this.status === "letter_selection" && this.selectionStartTime) {
      const elapsed = now - this.selectionStartTime;
      remainingSelectionMs = Math.max(0, this.selectionTimeLimit * 1000 - elapsed);
    }

    this.pausedStateBeforeForfeit = {
      status: this.status,
      remainingSprintMs,
      remainingSelectionMs,
    };

    // Pause round/turn timers
    this.clearSelectionTimer();
    this.clearRoundTimer();

    io.to(this.id).emit("room:forfeit_warning", {
      remainingSeconds: 15,
      remainingPlayer: remainingUsername,
      message: "An opponent disconnected or left. Waiting 15s for reconnection...",
    });

    this.forfeitTimer = setTimeout(() => {
      this.forfeitTimer = null;
      this.pausedStateBeforeForfeit = null;
      // Re-verify that only 1 player remains
      const activePlayers = Array.from(this.participants.entries()).filter(
        ([_, p]) => !p.hasLeft && p.isConnected !== false
      );

      if (activePlayers.length <= 1 && this.status !== "ended") {
        this.endGame(io, socket, remainingUsername);
      }
    }, 15000);
  }

  public clearForfeitTimer() {
    if (this.forfeitTimer !== null) {
      clearTimeout(this.forfeitTimer);
      this.forfeitTimer = null;
    }
    this.pausedStateBeforeForfeit = null;
  }

  public clearDisconnectTimer(username: string) {
    const timer = this.disconnectTimers.get(username);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(username);
    }
  }

  public clearAllDisconnectTimers() {
    for (const [_, timer] of this.disconnectTimers.entries()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
  }

  // Recalculates total rounds dynamically after a player departs mid-game
  public recalculateRemainingRounds(io?: Server) {
    const activeCount = Array.from(this.participants.values()).filter((p) => !p.hasLeft).length;
    if (activeCount <= 1) return;

    const remainingLettersCount = this.availableLetters.length;
    const turnsEach = Math.floor(remainingLettersCount / activeCount);

    if (turnsEach > 0) {
      // Remaining rounds calculated equal across active players
      this.totalRound = Math.min(
        this.availableLetters.length + this.currentRound,
        this.currentRound + turnsEach * activeCount
      );
    }

    if (io) {
      io.to(this.id).emit("room:state", {
        totalRound: this.totalRound,
        currentRound: this.currentRound,
        participants: this.getParticipantsList(),
      });
    }
  }

  public getParticipantsList() {
    return Array.from(this.participants.entries()).map(([username, p]) => ({
      username,
      score: p.score,
      avatar_url: p.avatar_url || null,
      isHost: username === this.hostUsername,
      hasLeft: !!p.hasLeft,
      isConnected: p.isConnected !== false && !p.hasLeft,
    }));
  }

  public getRoomParticipantsData() {
    return {
      participants: this.getParticipantsList(),
      hostUsername: this.hostUsername,
      categories: this.categories,
      maxPlayers: this.maxPlayers,
      allLetters: this.getAllLetters(),
      selectionTimeLimit: this.selectionTimeLimit,
    };
  }

  // Calculates total rounds ensuring each player receives an equal number of turns
  public calculateTotalRound(): number {
    const playerCount = this.participants.size;
    const letterCount = this.availableLetters.length;

    if (playerCount === 0) {
      this.totalRound = 0;
      return this.totalRound;
    }

    const turnsPerPlayer = Math.floor(letterCount / playerCount);
    this.totalRound = turnsPerPlayer * playerCount;
    return this.totalRound;
  }

  public clearConnectionTimeout() {
    if (this.connectionTimeout !== null) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  public clearSelectionTimer() {
    if (this.selectionTimer !== null) {
      clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }
  }

  // Advances game to next player's letter selection, or ends game if rounds are exhausted
  public getNextUserTurn(io: Server, socket?: Socket) {
    this.status = "letter_selection";
    this.clearSelectionTimer();
    this.clearRoundTimer();
    const activeUsernames = Array.from(this.participants.entries())
      .filter(([_, p]) => !p.hasLeft)
      .map(([username]) => username);

    this.currentRound++;
    // Check if player-assigned rounds are exhausted or no players remain
    if (activeUsernames.length === 0 || this.currentRound <= 0) {
      this.endGame(io, socket);
      return true;
    }

    if (this.currentRound > this.totalRound) {
      // If computer helper is allowed and unused letters remain, let the computer pick and continue
      if (this.allowComputerHelper && this.availableLetters.length > 0) {
        this.usersTurn = "computer";
        const randomLetter =
          this.availableLetters[
            Math.floor(Math.random() * this.availableLetters.length)
          ];
        this.setActiveLetter(randomLetter, io, socket);
        return true;
      }

      // Otherwise conclude match immediately
      this.usersTurn = null;
      this.endGame(io, socket);
      return true;
    }

    // Determine whose turn it is in round-robin sequence
    const playerIndex = (this.currentRound - 1) % activeUsernames.length;
    this.usersTurn = activeUsernames[playerIndex] || null;
    this.selectionStartTime = Date.now();
    this.roundStartTime = null;
    io.to(this.id).emit("turn:change", {
      usersTurn: this.usersTurn,
      selectionTimeLimit: this.selectionTimeLimit,
      selectionStartTime: this.selectionStartTime,
    });

    // Auto-select random letter if player times out
    this.selectionTimer = setTimeout(() => {
      if (this.status === "letter_selection" && this.availableLetters.length > 0) {
        const randomLetter =
          this.availableLetters[
            Math.floor(Math.random() * this.availableLetters.length)
          ];
        if (randomLetter) {
          this.setActiveLetter(randomLetter, io, socket);
        }
      }
    }, this.selectionTimeLimit * 1000);
  }

  // Sets active round letter and transitions room into active sprint phase
  public setActiveLetter(letter: string, io: Server, socket?: Socket) {
    if (!letter) return false;
    const newLetter = letter.toUpperCase();
    const isLetterRelevant = this.availableLetters.includes(newLetter);
    if (!isLetterRelevant) {
      if (socket) {
        socket.emit("error", "Pls Select A Valid Letter");
      }
      return false;
    }
    this.clearSelectionTimer();
    this.activeLetter = newLetter;
    this.availableLetters = this.availableLetters.filter(
      (l) => l !== newLetter
    );
    this.status = "active_sprint";
    this.roundStartTime = Date.now();
    this.selectionStartTime = null;
    this.flaggedCheaters.clear();
    this.inputActivity.clear();

    // Start round sprint countdown
    this.roundTimer = setTimeout(() => {
      this.submitStatus = "accepting";
      io.to(this.id).emit("round:ended", { reason: "time_up" });
      this.startRecapTimer(io, socket);
    }, this.maxTimePerRound * 1000);

    io.to(this.id).emit("letter:active", {
      letter: newLetter,
      roundStartTime: this.roundStartTime,
    });
  }

  public clearRoundTimer() {
    if (this.roundTimer !== null) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  // Records player input focus to track human interaction timing per category
  public recordInputFocus(username: string, category: string) {
    if (this.status !== "active_sprint") return;
    if (!this.inputActivity.has(username)) {
      this.inputActivity.set(username, new Map());
    }
    const userMap = this.inputActivity.get(username)!;
    const current = userMap.get(category) || { totalDurationMs: 0, blurCount: 0 };
    current.focusedAt = Date.now();
    userMap.set(category, current);
  }

  // Records player input blur to aggregate interaction duration per category
  public recordInputBlur(username: string, category: string) {
    if (this.status !== "active_sprint") return;
    const userMap = this.inputActivity.get(username);
    if (!userMap) return;
    const current = userMap.get(category);
    if (current && current.focusedAt) {
      current.totalDurationMs += Date.now() - current.focusedAt;
      current.focusedAt = undefined;
      current.blurCount += 1;
    }
  }

  // Persists the completed match and all player results to PostgreSQL using bulk insertion
  public async saveGameToDatabase(
    standings: Array<{ username: string; score: number; isHost: boolean; hasLeft?: boolean }>,
    forfeitWinnerUsername?: string
  ) {
    try {
      const hostDbId = this.hostUsername ? this.userDbIds[this.hostUsername] || null : null;
      const gameId = uuidv7();

      // 1. Insert game record with time-ordered uuidv7 primary key
      const insertGameQuery = `
        INSERT INTO games (
          id,
          room_code,
          host_id,
          categories,
          max_players,
          max_time_per_round,
          total_rounds,
          rounds_data,
          created_at,
          ended_at
        ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, CURRENT_TIMESTAMP);
      `;

      await pool.query(insertGameQuery, [
        gameId,
        this.id,
        hostDbId,
        JSON.stringify(this.categories),
        this.maxPlayers,
        this.maxTimePerRound,
        this.currentRound,
        JSON.stringify(this.detailedSubmissions),
        this.createdAt,
      ]);

      if (standings.length === 0) return;

      // Determine top score to mark winner(s)
      const topScore = standings[0]?.score ?? 0;

      // 2. Build parameterized bulk insert for game_players: ($1, $2, $3, $4, $5, $6), ($7, $8, ...)
      const valueClauses: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      for (let i = 0; i < standings.length; i++) {
        const p = standings[i];
        const userDbId = this.userDbIds[p.username] || null;
        const rank = i + 1;
        // If forfeit winner is specified, that player is the guaranteed winner; otherwise top score > 0
        const isWinner = forfeitWinnerUsername
          ? p.username === forfeitWinnerUsername
          : p.score > 0 && p.score === topScore;

        valueClauses.push(
          `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`
        );

        queryParams.push(gameId, userDbId, p.username, p.score, rank, isWinner);
        paramIndex += 6;
      }

      const bulkInsertPlayersQuery = `
        INSERT INTO game_players (
          game_id,
          user_id,
          player_name,
          score,
          rank,
          is_winner
        ) VALUES ${valueClauses.join(", ")};
      `;

      await pool.query(bulkInsertPlayersQuery, queryParams);
      console.log(`[DB] Successfully saved match ${this.id} and ${standings.length} players (Game ID: ${gameId})`);
    } catch (err) {
      console.error(`[DB Error] Failed to persist game ${this.id}:`, err);
    }
  }

  // Concludes match, broadcasts final rankings, persists to DB, and schedules room cleanup
  public endGame(io: Server, socket?: Socket, forfeitWinnerUsername?: string) {
    if (this.status === "ended") return;
    this.status = "ended";
    this.clearConnectionTimeout();
    this.clearSelectionTimer();
    this.clearRoundTimer();
    this.clearForfeitTimer();
    this.clearAllDisconnectTimers();

    let standings = Array.from(this.participants.entries())
      .map(([username, p]) => ({
        username,
        score: p.score,
        isHost: username === this.hostUsername,
        hasLeft: !!p.hasLeft,
      }))
      .sort((a, b) => b.score - a.score);

    // If game ended via forfeit victory, prioritize the remaining player as Rank 1 / Winner
    if (forfeitWinnerUsername) {
      standings = standings.sort((a, b) => {
        if (a.username === forfeitWinnerUsername) return -1;
        if (b.username === forfeitWinnerUsername) return 1;
        return b.score - a.score;
      });
    }

    // 1. Instantly notify connected players
    io.to(this.id).emit("game:ended", {
      submissions: this.detailedSubmissions,
      standings,
      forfeit: !!forfeitWinnerUsername,
      winner: forfeitWinnerUsername || (standings[0]?.username ?? null),
    });

    // 2. Persist to PostgreSQL asynchronously in the background only if there are 2 or more players
    // Solo matches are practice matches and do not affect competitive database statistics or leaderboards
    const totalParticipantsCount = this.participants.size;
    if (totalParticipantsCount >= 2) {
      this.saveGameToDatabase(standings, forfeitWinnerUsername);
    } else {
      console.log(`[Practice Match] Room ${this.id} finished with ${totalParticipantsCount} player(s). Skipped DB persistence.`);
    }

    // 3. Keep room alive for 15 minutes for post-game review, then clean up
    setTimeout(() => {
      deleteRoom(this.id);
    }, 15 * 60 * 1000);
  }

  // Computes round scores, broadcasts recap to all players, and starts the 6.0s review period
  public executeRoundRecap(io: Server, socket?: Socket) {
    this.clearRoundTimer();
    this.submitStatus = "notAccepting";
    const roundScores = this.calculateRoundScores();

    // Compute round points and rank players for this specific round
    const roundPointsSummary = Object.keys(roundScores || {}).map((uname) => {
      const userCatScores = roundScores[uname] || {};
      const roundTotal = Object.values(userCatScores).reduce(
        (sum, cat) => sum + (cat?.score || 0),
        0
      );
      const participant = this.participants.get(uname);
      return {
        username: uname,
        roundPoints: roundTotal,
        cumulativeScore: participant?.score || 0,
      };
    }).sort((a, b) => b.roundPoints - a.roundPoints);

    const topRoundScore = roundPointsSummary[0]?.roundPoints || 0;
    const roundWinners = topRoundScore > 0
      ? roundPointsSummary.filter((p) => p.roundPoints === topRoundScore).map((p) => p.username)
      : [];

    // Broadcast updated cumulative standings for sidebars
    io.to(this.id).emit("room:participants", this.getRoomParticipantsData());

    // Broadcast this round's scored submissions so all players can review answers, round winners and points
    io.to(this.id).emit("round:recap", {
      letter: this.activeLetter,
      round: this.currentRound,
      scores: roundScores || {},
      roundStandings: roundPointsSummary,
      roundWinners,
      recapDuration: 6,
    });

    // Phase 2: 6.0s review period so players can inspect answers and points before advancing
    this.roundTimer = setTimeout(() => {
      this.clearRoundTimer();
      this.recapSkipVotes.clear();

      // If this was the final round, conclude match directly
      if (
        this.currentRound >= this.totalRound &&
        (!this.allowComputerHelper || this.availableLetters.length === 0)
      ) {
        this.endGame(io, socket);
      } else {
        this.status = "letter_selection";
        this.getNextUserTurn(io, socket);
      }
    }, 6000);
  }

  // Brief recap window allowing answer submissions before computing and displaying scores
  public startRecapTimer(io: Server, socket?: Socket) {
    this.clearSelectionTimer();
    this.clearRoundTimer();
    this.submitStatus = "accepting";
    this.status = "recap";
    this.recapSkipVotes.clear();

    // Phase 1: 3.5s buffer gives in-flight mobile/Wi-Fi submissions time to flush
    this.roundTimer = setTimeout(() => {
      this.executeRoundRecap(io, socket);
    }, 3500);
  }

  // Handles a player voting to skip the 6-second recap review window early
  public handleRecapSkip(username: string, io: Server, socket?: Socket) {
    if (this.status !== "recap" || this.submitStatus === "accepting") return;
    const participant = this.participants.get(username);
    if (!participant || participant.hasLeft) return;

    this.recapSkipVotes.add(username);

    const activePlayers = Array.from(this.participants.entries()).filter(
      ([_, p]) => !p.hasLeft && p.isConnected !== false
    );

    io.to(this.id).emit("recap:skip_update", {
      votes: this.recapSkipVotes.size,
      total: activePlayers.length,
    });

    // If every active connected player has voted to skip, advance immediately
    if (this.recapSkipVotes.size >= activePlayers.length) {
      this.clearRoundTimer();
      this.recapSkipVotes.clear();

      if (
        this.currentRound >= this.totalRound &&
        (!this.allowComputerHelper || this.availableLetters.length === 0)
      ) {
        this.endGame(io, socket);
      } else {
        this.status = "letter_selection";
        this.getNextUserTurn(io, socket);
      }
    }
  }

  // Validates answers against category dictionaries: 5 pts for unique word, 2 pts for shared word.
  // Defaults non-submitters and blank answers to 0 points for every category.
  // Returns the scored submissions for this round.
  public calculateRoundScores(): Record<string, Record<string, { answer: string; score: number }>> {
    if (!this.activeLetter) return {};
    const letter = this.activeLetter;

    if (!this.detailedSubmissions[letter]) {
      this.detailedSubmissions[letter] = {};
    }
    const currentSubmissions = this.detailedSubmissions[letter];

    // 1. Guarantee every participant has an entry for each category with default 0 points
    for (const [username, p] of this.participants.entries()) {
      if (!currentSubmissions[username]) {
        currentSubmissions[username] = {};
      }
      for (const category of this.categories) {
        if (!currentSubmissions[username][category]) {
          currentSubmissions[username][category] = { answer: "", score: 0 };
        }
      }
    }

    const usernames = Object.keys(currentSubmissions);

    // 2. Score each category
    for (const category of this.categories) {
      const answerCounts: Record<string, number> = {};
      const normalizedAnswers: Record<string, string> = {};

      // Pass 1: Normalize answers and validate against category dictionary
      for (const username of usernames) {
        const item = currentSubmissions[username]?.[category];
        const raw = item?.answer?.trim() || "";
        if (!raw) continue;

        const clean = normalizeText(raw);
        normalizedAnswers[username] = clean;

        const firstChar = clean[0]?.toUpperCase();
        if (firstChar === letter && isCategoryWordValid(category, letter, clean)) {
          answerCounts[clean] = (answerCounts[clean] || 0) + 1;
        }
      }

      // Pass 2: Award 5 points for unique, 2 points for shared, 0 for invalid/empty
      for (const username of usernames) {
        const raw = currentSubmissions[username]?.[category]?.answer || "";
        const clean = normalizedAnswers[username];
        const isUserCheating = this.flaggedCheaters.has(username);
        let score = 0;

        // Anti-Cheat: If user was flagged for cheating in this round, their score is 0
        if (!isUserCheating && clean && answerCounts[clean] !== undefined) {
          score = answerCounts[clean] === 1 ? 5 : 2;
        }

        currentSubmissions[username][category] = {
          answer: raw,
          score,
          cheated: isUserCheating,
        };

        if (score > 0) {
          const participant = this.participants.get(username);
          if (participant) {
            participant.score += score;
          }
        }
      }
    }

    return currentSubmissions;
  }

  // Validates and saves submitted answers during the active round
  saveAnswers(
    username: string,
    answers: Record<string, string>,
    socket: Socket,
    io?: Server,
    telemetry?: {
      pasteAttempts?: number;
      blurCount?: number;
    }
  ) {
    if (!this.activeLetter)
      return socket.emit("error", "No Active Letter Selected");
    if (this.submitStatus === "notAccepting")
      return socket.emit("error", "Submit Status Closed");

    const participant = this.participants.get(username);
    if (!participant) return socket.emit("error", "Participant Not Found");

    // Enforce strictly one submission per letter round to prevent tamper/race conditions
    if (this.detailedSubmissions[this.activeLetter]?.[username]) {
      return socket.emit("error", "You have already submitted your answers for this round.");
    }

    // Validate that submitted keys belong to configured room categories
    const answersKey = Object.keys(answers);
    if (this.categories.length < answersKey.length) {
      return socket.emit("error", "Category Not Found");
    }

    for (const key of answersKey) {
      if (!this.categories.includes(key)) {
        return socket.emit("error", "Category Not Found");
      }
    }

    // --- ANTI-CHEAT DETECTION LOGIC ---
    let isCheatingDetected = false;
    let cheatReason = "";

    const pasteAttempts = telemetry?.pasteAttempts || 0;
    const blurCount = telemetry?.blurCount || 0;

    // 1. Paste Detection: Pasting is strictly prohibited
    if (pasteAttempts > 0) {
      isCheatingDetected = true;
      cheatReason = "Pasting answers into category fields is not allowed.";
    }

    // 2. Tab switching / blur detection while typing answers
    // If user switched tabs multiple times (>=2) while answers are populated
    const totalChars = Object.values(answers).reduce(
      (sum, val) => sum + (typeof val === "string" ? val.trim().length : 0),
      0
    );

    if (!isCheatingDetected && totalChars > 0) {
      if (blurCount >= 2) {
        isCheatingDetected = true;
        cheatReason = "Excessive tab switching or leaving the game during an active round.";
      }
    }


    // 4. Input Focus & Interaction Cadence Verification (Server-Authoritative Anti-Bot)
    // Every category with an answer must have genuine user focus interaction recorded on the server
    if (!isCheatingDetected && totalChars > 0) {
      const userActivity = this.inputActivity.get(username);
      for (const [cat, word] of Object.entries(answers)) {
        const trimmed = (word || "").trim();
        if (trimmed.length > 0) {
          const catMetric = userActivity?.get(cat);
          // If no focus was ever registered for this category, it was injected programmatically
          if (!catMetric || (!catMetric.focusedAt && catMetric.totalDurationMs === 0)) {
            isCheatingDetected = true;
            cheatReason = "Automated submission detected (no input interaction recorded).";
            break;
          }
          // Calculate active interaction time including currently open focus
          const currentDuration =
            catMetric.totalDurationMs +
            (catMetric.focusedAt ? Date.now() - catMetric.focusedAt : 0);
          // A human cannot type a word of >= 3 chars in under 250 milliseconds
          if (trimmed.length >= 3 && currentDuration < 250) {
            isCheatingDetected = true;
            cheatReason = "Abnormal typing speed on category input.";
            break;
          }
        }
      }
    }

    if (isCheatingDetected) {
      this.flaggedCheaters.add(username);
      socket.emit("player:cheatPenalty", {
        message: `Your score for this round was voided (0 pts): ${cheatReason}`,
        reason: cheatReason,
      });
    }

    if (!this.detailedSubmissions[this.activeLetter]) {
      this.detailedSubmissions[this.activeLetter] = {};
    }

    this.detailedSubmissions[this.activeLetter][username] = {};

    for (const [cat, word] of Object.entries(answers)) {
      this.detailedSubmissions[this.activeLetter][username][cat] = {
        answer: word,
        score: 0,
      };
    }

    socket.emit("answer:success", {
      message: "Your answers have been submitted successfully",
    });

    // Check if every active player has now submitted for this round
    const activePlayers = Array.from(this.participants.entries()).filter(
      ([_, p]) => !p.hasLeft && p.isConnected !== false
    );
    const submittedCount = Object.keys(this.detailedSubmissions[this.activeLetter]).length;

    if (submittedCount >= activePlayers.length && io) {
      // Early trigger: every active player has submitted!
      // If we are waiting out the recap submission buffer, immediately execute score calculation and review
      if (this.status === "recap" && this.submitStatus === "accepting") {
        this.executeRoundRecap(io, socket);
      }
    }
  }
}
