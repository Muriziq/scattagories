import { Server, Socket } from "socket.io";
export const activeRooms = new Map<string, GameRoom>();

export class GameRoom {
  // --- Core Identity ---
  id: string;
  password: string | null;
  createdAt: Date;
  hostId: string;

  // --- Room Settings ---
  maxPlayers: number;
  maxTimePerRound: number;
  categories: string[];

  // --- Game State Trackers ---
  status: "waiting" | "letter_selection" | "active_sprint" | "recap";
  currentRound: number;
  totalRound: number;
  usersTurn: string | null;
  availableLetters: string[];
  activeLetter: string | null;
  isBoardLocked: boolean;
  roundTimer: NodeJS.Timeout | null;
  isPublic: boolean;
  // --- Live Data Trackers ---
  participants: Map<
    string,
    {
      socketId: string;
      dbId: string | null;
      displayName: string;
      score: number;
    }
  >;

  // The detailed tracker accumulating every answer and score for the whole match
  // Structure: { participantId: { Letter: { Category: { value: "word", score: 2 } } } }
  detailedSubmissions: Record<
    string, // Letter (e.g., "A")
    Record<
      string, // Participant ID
      Record<
        string, // Category Name (e.g., "Animals")
       string // Answer
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
    categories: string[] = ["Animals", "Countries", "Things in a Fridge"],
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

    // 3. Set the default starting game state
    this.status = "waiting";
    this.currentRound = 0;
    this.usersTurn = hostId;
    this.activeLetter = null;
    this.totalRound = 0;
    this.isBoardLocked = false;
    this.submitStatus = "notAccepting";

    // The full alphabet ready for the picking
    this.availableLetters = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ];

    // 4. Initialize empty data trackers
    this.participants = new Map();
    this.detailedSubmissions = {};
  }
  public addParticipant(participant: any) {
    this.participants.set(participant.id, participant);
  }
  public removeParticipant(participantId: string) {
    this.participants.delete(participantId);
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

  public getNextUserTurn(io: Server,socket:Socket) {
    const participantIds = Array.from(this.participants.keys());
    this.currentRound++;
    if (
      participantIds.length === 0 ||
      this.currentRound > this.totalRound ||
      this.currentRound <= 0
    ) {
      this.usersTurn = null;
      const randomLetter = this.availableLetters[Math.floor(Math.random() * this.availableLetters.length)];
      if(!randomLetter){
      io.to(this.id).emit("game:ended", { message: "Game Has Ended" });
      }
      this.setActiveLetter(randomLetter, io, socket);
      return true;
    }

    const playerIndex = (this.currentRound - 1) % participantIds.length;
    this.usersTurn =
      this.participants.get(participantIds[playerIndex])?.displayName || null;
    io.to(this.id).emit("turn:change", this.usersTurn);
  }

  public setActiveLetter(letter: string, io: Server,socket:Socket) {
    const newLetter = letter.toUpperCase();
    const isLetterRelevant = this.availableLetters.includes(newLetter);
    if (!isLetterRelevant) {
      socket.emit("error", "Pls Select A Valid Letter");
      return false;
    }
    this.activeLetter = newLetter;
    this.availableLetters = this.availableLetters.filter(
      (l) => l !== newLetter,
    );
    this.status = "active_sprint";
    this.roundTimer = setTimeout(() => {
      this.submitStatus = "accepting";
      io.to(this.id).emit("round:ended", { reason: "time_up" });
      this.startRecapTimer(io,socket);
    }, this.maxTimePerRound * 1000);

    io.to(this.id).emit("letter:active", newLetter);
  }

  public clearRoundTimer() {
    if (this.roundTimer !== null) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
  }

  public startRecapTimer(io: Server, socket: Socket) {
    this.clearRoundTimer();
    this.submitStatus = "accepting";
    this.status = "recap";

    this.roundTimer = setTimeout(() => {
      this.submitStatus = "notAccepting";
      this.status = "letter_selection";
      this.clearRoundTimer();
      this.getNextUserTurn(io, socket);
    }, 2500);
  }

  saveAnswers(participantId: string, answers: Record<string, string>, socket: Socket) {
    if (!this.activeLetter) return socket.emit("error", "No Active Letter Selected");
    if (this.submitStatus === "notAccepting") return socket.emit("error", "Submit Status Closed");

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

    this.detailedSubmissions[this.activeLetter][participantId] = answers;
    socket.emit("answer:success", { message: "Your answers have been submitted successfully" });
  }
}
