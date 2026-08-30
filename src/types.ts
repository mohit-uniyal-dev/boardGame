export type GameMode = 'ORIGINAL_SKETCH' | 'RANDOM_PARTY';

export type TileType =
  | 'START'
  | 'FINISH'
  | 'NORMAL'
  | 'SHORTCUT_TUNNEL'
  | 'PORTAL'
  | 'MYSTERY'
  | 'EXTRA_ROLL'
  | 'PENALTY_SKIP'
  | 'PENALTY_RESET'
  | 'GATE_RESTRICTION'
  | 'PARTY_DARE'
  | 'CHOICE_TASK';

export interface BoardTile {
  id: number;
  gridX: number;
  gridY: number;
  type: TileType;
  label: string;
  targetTileId?: number;
  allowedDice?: number[];
  dareId?: string;
}

export interface Dare {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  category: 'PHYSICAL' | 'VERBAL' | 'ACTING' | 'MEMORY';
  penaltySteps: number;
  rewardExtraRoll?: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  points: number;
  recentDareIds: string[];
  currentTileId: number;
  skipTurnsRemaining: number;
  gateLock: number[] | null;
}

export interface GameSettings {
  mode: GameMode;
  physicalDaresEnabled: boolean;
  soundEnabled: boolean;
}

export type GamePhase = 'ROLL_PENDING' | 'MOVING' | 'RESOLVING_EVENT' | 'DARE_ACTIVE' | 'GAME_OVER';

export interface GameState {
  id: string;
  seed: string;
  settings: GameSettings;
  players: Player[];
  activePlayerIndex: number;
  board: BoardTile[];
  phase: GamePhase;
  diceValue: number | null;
  bonusRollsUsedThisTurn: number;
  winnerPlayerId: string | null;
  turnNumber: number;
  eventMessage: string;
}

export interface MysteryEffect {
  type: 'MOVE' | 'EXTRA_ROLL' | 'NONE';
  steps?: number;
  label: string;
}
