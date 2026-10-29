import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../server";
import { countryLookup } from "./countries";
import { capitalLookup } from "./capitals";
import { currencyLookup } from "./currencies";
import { stateLookup } from "./states";
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

export const availableCategories = [
  "Countries",
  "Capitals",
  "Currencies",
  "States",
] as const;

// Fast O(1) set lookup for validating category answers by selected letter
const categoryLookups: Record<string, Record<string, Set<string>>> = {
  Countries: countryLookup,
  Capitals: capitalLookup,
  Currencies: currencyLookup,
  States: stateLookup,
};

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
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
    "U", "V", "W", "X", "Y", "Z"
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
  roundTimer: NodeJS.Timeout | null;
  selectionTimer: NodeJS.Timeout | null;
  connectionTimeout: NodeJS.Timeout | null;
  selectionTimeLimit: number;
  roundStartTime: number | null = null;
  selectionStartTime: number | null = null;
  isPublic: boolean;

  // Live Participant Data keyed by username
  participants: Map<
    string,
    {
      score: number;
      hasLeft?: boolean;
    }
  >;

  // Internal mapping of username to database UUID for post-game PostgreSQL persistence
  userDbIds: Record<string, string>;

  // Submissions structured as: { Letter: { participantName: { Category: { answer, score } } } }
  detailedSubmissions: Record<
    string,
    Record<
      string,
      Record<string, { answer: string; score: number }>
    >
  >;
  submitStatus: "accepting" | "notAccepting";

  constructor(
    id: string,
    hostUsername: string,
    hostDbId: string,
    maxPlayers: number = 8,
    maxTimePerRound: number = 60,
    password: string | null = null,
    isPublic: boolean = true,
    categories: string[] = [...availableCategories],
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
      hasLeft: false,
    });
  }

  // Handles player departure; cleans up empty rooms or reassigns host if needed
  public removeParticipant(username: string, io?: Server, socket?: Socket) {
    const participant = this.participants.get(username);
    if (!participant) return;

    if (this.status === "waiting") {
      this.participants.delete(username);
      delete this.userDbIds[username];
      // Destroy room if all participants left
      if (this.participants.size === 0) {
        this.clearConnectionTimeout();
        this.clearSelectionTimer();
        this.clearRoundTimer();
        deleteRoom(this.id);
      } else if (this.hostUsername === username) {
        // Reassign host role to the next participant in the lobby
        const remainingUsers = Array.from(this.participants.keys());
        this.hostUsername = remainingUsers.length > 0 ? remainingUsers[0] : null;
      }
    } else {
      // Mark as left during active game to maintain scoreboard consistency
      participant.hasLeft = true;

      const activeParticipants = Array.from(this.participants.entries()).filter(([_, p]) => !p.hasLeft);
      
      // If no active players remain, destroy room immediately
      if (activeParticipants.length === 0) {
        this.clearConnectionTimeout();
        this.clearSelectionTimer();
        this.clearRoundTimer();
        deleteRoom(this.id);
        return;
      }

      // If only 1 player remains, conclude the game immediately by default
      if (activeParticipants.length === 1 && io && socket) {
        this.clearSelectionTimer();
        this.clearRoundTimer();
        this.endGame(io, socket);
        return;
      }

      // Recalculate remaining rounds dynamically so all remaining active players get equal turns
      this.recalculateRemainingRounds(io);

      // If departing player held the current turn, advance immediately to next turn
      if (io && socket && this.usersTurn === username && this.status !== "ended") {
        this.getNextUserTurn(io, socket);
      }
    }
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
      isHost: username === this.hostUsername,
      hasLeft: !!p.hasLeft,
      isConnected: !p.hasLeft,
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
  public getNextUserTurn(io: Server, socket: Socket) {
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
  public setActiveLetter(letter: string, io: Server, socket: Socket) {
    if (!letter) return false;
    const newLetter = letter.toUpperCase();
    const isLetterRelevant = this.availableLetters.includes(newLetter);
    if (!isLetterRelevant) {
      socket.emit("error", "Pls Select A Valid Letter");
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

  // Persists the completed match and all player results to PostgreSQL using bulk insertion
  public async saveGameToDatabase(
    standings: Array<{ username: string; score: number; isHost: boolean }>
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
        const isWinner = p.score > 0 && p.score === topScore;

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
  public endGame(io: Server, socket: Socket) {
    if (this.status === "ended") return;
    this.status = "ended";
    this.clearConnectionTimeout();
    this.clearSelectionTimer();
    this.clearRoundTimer();

    const standings = Array.from(this.participants.entries())
      .map(([username, p]) => ({
        username,
        score: p.score,
        isHost: username === this.hostUsername,
      }))
      .sort((a, b) => b.score - a.score);

    // 1. Instantly notify connected players
    io.to(this.id).emit("game:ended", {
      submissions: this.detailedSubmissions,
      standings,
    });

    // 2. Persist to PostgreSQL asynchronously in the background
    this.saveGameToDatabase(standings);

    // 3. Keep room alive for 15 minutes for post-game review, then clean up
    setTimeout(() => {
      deleteRoom(this.id);
    }, 15 * 60 * 1000);
  }

  // Brief recap window allowing answer submissions before computing and displaying scores
  public startRecapTimer(io: Server, socket: Socket) {
    this.clearSelectionTimer();
    this.clearRoundTimer();
    this.submitStatus = "accepting";
    this.status = "recap";

    // Phase 1: 2.0s buffer gives in-flight mobile/Wi-Fi submissions time to flush
    this.roundTimer = setTimeout(() => {
      this.submitStatus = "notAccepting";
      const roundScores = this.calculateRoundScores();

      // Broadcast updated cumulative standings for sidebars
      io.to(this.id).emit("room:participants", this.getRoomParticipantsData());

      // Broadcast this round's scored submissions so all players can review answers and points
      io.to(this.id).emit("round:recap", {
        letter: this.activeLetter,
        round: this.currentRound,
        scores: roundScores || {},
        recapDuration: 6,
      });

      // Phase 2: 6.0s review period so players can inspect answers and points before advancing
      this.roundTimer = setTimeout(() => {
        this.status = "letter_selection";
        this.clearRoundTimer();
        this.getNextUserTurn(io, socket);
      }, 6000);
    }, 2000);
  }

  // Validates answers against category dictionaries: 5 pts for unique word, 2 pts for shared word.
  // Returns the scored submissions for this round.
  public calculateRoundScores(): Record<string, Record<string, { answer: string; score: number }>> | null {
    if (!this.activeLetter) return null;
    const letter = this.activeLetter;
    const currentSubmissions = this.detailedSubmissions[letter];
    if (!currentSubmissions) return null;

    for (const category of this.categories) {
      const lookupMap = categoryLookups[category]?.[letter];
      const answerCounts: Record<string, number> = {};

      // First pass: Count valid answers starting with the round letter
      for (const username of Object.keys(currentSubmissions)) {
        const item = currentSubmissions[username]?.[category];
        const raw = item?.answer?.trim() || "";
        if (!raw) continue;

        const clean = normalizeText(raw);
        const firstChar = clean[0]?.toUpperCase();
        if (firstChar === letter && lookupMap?.has(clean)) {
          answerCounts[clean] = (answerCounts[clean] || 0) + 1;
        }
      }

      // Second pass: Assign points based on answer uniqueness
      for (const username of Object.keys(currentSubmissions)) {
        const item = currentSubmissions[username]?.[category];
        const raw = item?.answer?.trim() || "";
        let score = 0;

        if (raw) {
          const clean = normalizeText(raw);
          const count = answerCounts[clean];
          if (count !== undefined) {
            score = count === 1 ? 5 : 2;
          }
        }

        currentSubmissions[username][category] = { answer: raw, score };

        const participant = this.participants.get(username);
        if (participant) {
          participant.score += score;
        }
      }
    }

    return currentSubmissions;
  }

  // Validates and saves submitted answers during the active round
  saveAnswers(
    username: string,
    answers: Record<string, string>,
    socket: Socket
  ) {
    if (!this.activeLetter)
      return socket.emit("error", "No Active Letter Selected");
    if (this.submitStatus === "notAccepting")
      return socket.emit("error", "Submit Status Closed");

    const participant = this.participants.get(username);
    if (!participant) return socket.emit("error", "Participant Not Found");

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

    if (!this.detailedSubmissions[this.activeLetter]) {
      this.detailedSubmissions[this.activeLetter] = {};
    }

    if (!this.detailedSubmissions[this.activeLetter][username]) {
      this.detailedSubmissions[this.activeLetter][username] = {};
    }

    // Incrementally merge new answers with any previously synced answers for this round
    for (const [cat, word] of Object.entries(answers)) {
      this.detailedSubmissions[this.activeLetter][username][cat] = {
        answer: word,
        score: 0,
      };
    }

    socket.emit("answer:success", {
      message: "Your answers have been submitted successfully",
    });
  }
}
