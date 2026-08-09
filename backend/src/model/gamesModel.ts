
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
  status: 'waiting' | 'letter_selection' | 'active_sprint' | 'recap'; 
  currentRound: number; 
  usersTurn: string | null; 
  availableLetters: string[]; 
  activeLetter: string | null; 
  isBoardLocked: boolean; 
  isPublic:boolean;
  // --- Live Data Trackers ---
  participants: Map<string, {
    socketId: string;
    dbId: string | null; 
    displayName: string;
    score: number;
  }>; 
  
  // The detailed tracker accumulating every answer and score for the whole match
  // Structure: { participantId: { Letter: { Category: { value: "word", score: 2 } } } }
  detailedSubmissions: Record<string, Record<string, Record<string, { value: string; score: number }>>>;

  constructor(
    id: string,
    hostId: string,
    maxPlayers: number = 8,
    maxTimePerRound: number = 60,
    password: string | null = null,
    isPublic:boolean,
    categories: string[] = ["Animals", "Countries", "Things in a Fridge"]
  ) {
    // 1. Set values passed in during room creation
    this.id = id;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.maxTimePerRound = maxTimePerRound;
    this.password = password;
    this.categories = categories
    // 2. Initialize dynamic settings
    this.createdAt = new Date();
    this.isPublic = isPublic;

    // 3. Set the default starting game state
    this.status = 'waiting';
    this.currentRound = 0;
    this.usersTurn = hostId; 
    this.activeLetter = null;
    this.isBoardLocked = false;
    
    // The full alphabet ready for the picking
    this.availableLetters = [
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
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
}