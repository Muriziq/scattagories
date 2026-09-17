import { Server, Socket } from "socket.io";
import { AuthenticatedSocket } from "../server";
import { countryLookup } from "./countries";
import { capitalLookup } from "./capitals";
import { currencyLookup } from "./currencies";
import { stateLookup } from "./states";

export const activeRooms = new Map<string, GameRoom>();
export const availableCategories = [
  "Countries",
  "Capitals",
  "Currencies",
  "States",
] as const;

const categoryLookups: Record<string, Record<string, Set<string>>> = {
  Countries: countryLookup,
  Capitals: capitalLookup,
  Currencies: currencyLookup,
  States: stateLookup,
};

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
    "A",
    "B",
    "C",
    "D",
    // "E",
    // "F",
    // "G",
    // "H",
    // "I",
    // "J",
    // "K",
    // "L",
    // "M",
    // "N",
    // "O",
    // "P",
    // "Q",
    // "R",
    // "S",
    // "T",
    // "U",
    // "V",
    // "W",
    // "X",
    // "Y",
    // "Z",
  ],
} as const;

export type Language = keyof typeof alphabets;

export class GameRoom {
  // --- Core Identity ---
  id: string;
  password: string | null;
  createdAt: Date;
  hostId: string | null;

  // --- Room Settings ---
  maxPlayers: number;
  maxTimePerRound: number;
  categories: string[];
  language: Language;

  // --- Game State Trackers ---
  status: "waiting" | "letter_selection" | "active_sprint" | "recap" | "ended";
  currentRound: number;
  totalRound: number;
  usersTurn: string | null;
  availableLetters: string[];
  activeLetter: string | null;
  isBoardLocked: boolean;
  roundTimer: NodeJS.Timeout | null;
  selectionTimer: NodeJS.Timeout | null;
  selectionTimeLimit: number;
  roundStartTime: number | null = null;
  selectionStartTime: number | null = null;
  isPublic: boolean;
  // --- Live Data Trackers ---
  participants: Map<
    string,
    {
      socketId: string | null;
      dbId: string | null;
      displayName: string;
      score: number;
      hasLeft?: boolean;
    }
  >;

  // The detailed tracker accumulating every answer and score for the whole match
  // Structure: { Letter: { participantId: { Category: { answer: "word", score: 2 } } } }
  detailedSubmissions: Record<
    string, // Letter (e.g., "A")
    Record<
      string, // Participant ID
      Record<
        string, // Category Name (e.g., "Countries")
        { answer: string; score: number } // Answer object with score
      >
    >
  >;
  submitStatus: "accepting" | "notAccepting";
  constructor(
    id: string,
    hostId: string,
    maxPlayers: number = 8,
    maxTimePerRound: number = 60,
    password: string | null = null,
    isPublic: boolean,
    categories: string[] = ["Countries", "Capitals", "Currencies", "States"],
  ) {
    // 1. Set values passed in during room creation
    this.id = id;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.maxTimePerRound = maxTimePerRound;
    this.password = password;
    this.categories = categories;
    // 2. Initialize dynamic settings
    this.createdAt = new Date();
    this.isPublic = isPublic;

    this.roundTimer = null;
    this.selectionTimer = null;
    this.selectionTimeLimit = 15;

    // 3. Set the default starting game state
    this.status = "waiting";
    this.currentRound = 0;
    this.usersTurn = hostId;
    this.activeLetter = null;
    this.totalRound = 0;
    this.isBoardLocked = false;
    this.submitStatus = "notAccepting";

    this.language = "en";
    this.availableLetters = [...this.getAllLetters()];

    // 4. Initialize empty data trackers
    this.participants = new Map();
    this.detailedSubmissions = {};
  }

  public getAllLetters(): readonly string[] {
    return alphabets[this.language] || alphabets.en;
  }

  public addParticipant(socket: AuthenticatedSocket) {
    if(!socket.user) return socket.emit("error", "Unauthorized: Authentication required");
    const participant = {
      socketId: socket.id,
      dbId: socket.user.id,
      displayName: socket.user.username,
      score: 0,
      hasLeft: false,
    };
    this.participants.set(socket.user.id, participant);
  }

  public removeParticipant(participantId: string, io?: Server, socket?: Socket) {
    const participant = this.participants.get(participantId);
    if (!participant) return;

    if (this.status === "waiting") {
      this.participants.delete(participantId);
      if (this.participants.size === 0) {
        this.clearSelectionTimer();
        this.clearRoundTimer();
        activeRooms.delete(this.id);
      } else if (this.hostId === participantId) {
        const participantsArray = Array.from(this.participants.values());
        this.hostId = participantsArray.length > 0 ? (participantsArray[0].dbId || null) : null;
      }
    } else {
      participant.hasLeft = true;
      participant.socketId = null;

      const activeParticipants = Array.from(this.participants.values()).filter((p) => !p.hasLeft);
      if (activeParticipants.length === 0) {
        this.clearSelectionTimer();
        this.clearRoundTimer();
        activeRooms.delete(this.id);
        return;
      }

      if (io && socket && this.usersTurn === participant.displayName && this.status !== "ended") {
        this.getNextUserTurn(io, socket);
      }
    }
  }

  public getHostUsername(): string | null {
    if (!this.hostId) return null;
    return this.participants.get(this.hostId)?.displayName || null;
  }

  public getParticipantsList() {
    const hostUsername = this.getHostUsername();
    return Array.from(this.participants.values()).map((p) => ({
      username: p.displayName,
      score: p.score,
      isHost: p.displayName === hostUsername,
      hasLeft: !!p.hasLeft,
      isConnected: p.socketId !== null && !p.hasLeft,
    }));
  }

  public getRoomParticipantsData() {
    return {
      participants: this.getParticipantsList(),
      hostUsername: this.getHostUsername(),
      categories: this.categories,
      maxPlayers: this.maxPlayers,
      allLetters: this.getAllLetters(),
      selectionTimeLimit: this.selectionTimeLimit,
    };
  }
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

  public clearSelectionTimer() {
    if (this.selectionTimer !== null) {
      clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }
  }

  public getNextUserTurn(io: Server, socket: Socket) {
    this.clearSelectionTimer();
    this.clearRoundTimer();
    const activeParticipants = Array.from(this.participants.values()).filter((p) => !p.hasLeft);
    const activeIds = activeParticipants.map((p) => p.dbId!).filter(Boolean);

    this.currentRound++;
    if (
      activeIds.length === 0 ||
      this.currentRound > this.totalRound ||
      this.currentRound <= 0
    ) {
      this.usersTurn = null;
      const randomLetter =
        this.availableLetters[
          Math.floor(Math.random() * this.availableLetters.length)
        ];
      if (!randomLetter || activeIds.length === 0) {
        this.endGame(io,socket)
        return true;
      }
      this.setActiveLetter(randomLetter, io, socket);
      return true;
    }

    const playerIndex = (this.currentRound - 1) % activeIds.length;
    this.usersTurn =
      this.participants.get(activeIds[playerIndex])?.displayName || null;
    this.selectionStartTime = Date.now();
    this.roundStartTime = null;
    io.to(this.id).emit("turn:change", {
      usersTurn: this.usersTurn,
      selectionTimeLimit: this.selectionTimeLimit,
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
    }, this.selectionTimeLimit * 1000);
  }

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
      (l) => l !== newLetter,
    );
    this.status = "active_sprint";
    this.roundStartTime = Date.now();
    this.selectionStartTime = null;
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
  public endGame(io: Server, socket: Socket){
            this.status = "ended";
        io.to(this.id).emit("game:ended", { submissions:this.detailedSubmissions});
        console.log(this.detailedSubmissions)
  }
  public startRecapTimer(io: Server, socket: Socket) {
    this.clearSelectionTimer();
    this.clearRoundTimer();
    this.submitStatus = "accepting";
    this.status = "recap";

    this.roundTimer = setTimeout(() => {
      this.submitStatus = "notAccepting";
      this.calculateRoundScores();
      this.status = "letter_selection";
      this.clearRoundTimer();
      this.getNextUserTurn(io, socket);
    }, 2500);
  }

  public calculateRoundScores() {
    if (!this.activeLetter) return;
    const letter = this.activeLetter;
    const currentSubmissions = this.detailedSubmissions[letter];
    if (!currentSubmissions) return;

    for (const category of this.categories) {
      const lookupMap = categoryLookups[category]?.[letter];

      // 1. Build frequency map for duplicate detection across participants
      const answerCounts: Record<string, number> = {};

      for (const participantId of Object.keys(currentSubmissions)) {
        const item = currentSubmissions[participantId]?.[category];
        const raw = item?.answer?.trim() || "";
        if (!raw) continue;

        const clean = normalizeText(raw);
        const firstChar = clean[0]?.toUpperCase();
        if (firstChar === letter && lookupMap?.has(clean)) {
          answerCounts[clean] = (answerCounts[clean] || 0) + 1;
        }
      }

      // 2. Score each participant's answer for this category
      for (const participantId of Object.keys(currentSubmissions)) {
        const item = currentSubmissions[participantId]?.[category];
        const raw = item?.answer?.trim() || "";
        let score = 0;

        if (raw) {
          const clean = normalizeText(raw);
          const count = answerCounts[clean];
          if (count !== undefined) {
            score = count === 1 ? 5 : 2; // 5 points for unique valid, 2 for duplicate valid
          }
        }

        // Store score in detailedSubmissions
        if (currentSubmissions[participantId][category]) {
          currentSubmissions[participantId][category].score = score;
        } else {
          currentSubmissions[participantId][category] = { answer: raw, score };
        }

        // Add score to cumulative participant score
        const participant = this.participants.get(participantId);
        if (participant) {
          participant.score += score;
        }
      }
    }
  }

  saveAnswers(
    participantId: string,
    answers: Record<string, string>,
    socket: Socket,
  ) {
    if (!this.activeLetter)
      return socket.emit("error", "No Active Letter Selected");
    if (this.submitStatus === "notAccepting")
      return socket.emit("error", "Submit Status Closed");

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

    const formattedAnswers: Record<string, { answer: string; score: number }> = {};
    for (const [cat, word] of Object.entries(answers)) {
      formattedAnswers[cat] = { answer: word, score: 0 };
    }

    this.detailedSubmissions[this.activeLetter][participantId] = formattedAnswers;
    socket.emit("answer:success", {
      message: "Your answers have been submitted successfully",
    });
  }
}
