import type { BoardTile, Dare, MysteryEffect, TileType } from './types';

export const PLAYER_COLORS = ['#f25549', '#277ee8', '#f1af19', '#8a58d4'];

// A fixed serpentine route: path order is independent of screen position.
export const PATH_COORDINATES = [
  ...Array.from({ length: 10 }, (_, x) => ({ gridX: x, gridY: 5 })),
  { gridX: 9, gridY: 4 },
  ...Array.from({ length: 9 }, (_, index) => ({ gridX: 9 - index, gridY: 3 })),
  { gridX: 1, gridY: 2 },
  ...Array.from({ length: 8 }, (_, index) => ({ gridX: 1 + index, gridY: 1 })),
  { gridX: 8, gridY: 0 },
  { gridX: 7, gridY: 0 },
  { gridX: 6, gridY: 0 },
  { gridX: 5, gridY: 0 },
  { gridX: 4, gridY: 0 },
];

export const DARES: Dare[] = [
  { id: 'balance', title: 'Single-leg balance', description: 'Stand on one leg without losing balance.', durationSeconds: 20, category: 'PHYSICAL', penaltySteps: 2 },
  { id: 'robot', title: 'Robot walk', description: 'Walk like a robot until the timer ends.', durationSeconds: 15, category: 'ACTING', penaltySteps: 2 },
  { id: 'twister', title: 'Tongue twister', description: "Say 'Kacha Papad, Pakka Papad' five times fast.", durationSeconds: 15, category: 'VERBAL', penaltySteps: 2, rewardExtraRoll: true },
  { id: 'freeze', title: 'Freeze pose', description: 'Hold your silliest statue pose without moving.', durationSeconds: 20, category: 'ACTING', penaltySteps: 2 },
  { id: 'memory', title: 'Memory five', description: 'Study these: moon, spoon, kite, sock, mango. Repeat them after the timer.', durationSeconds: 15, category: 'MEMORY', penaltySteps: 2 },
  { id: 'no-laugh', title: 'No-laugh challenge', description: 'Keep a straight face while everyone tries to make you laugh.', durationSeconds: 20, category: 'ACTING', penaltySteps: 2 },
  { id: 'jacks', title: 'Fitness burst', description: 'Complete ten jumping jacks before time runs out.', durationSeconds: 20, category: 'PHYSICAL', penaltySteps: 2 },
  { id: 'story', title: 'Tiny tall tale', description: 'Tell a dramatic ten-second story featuring a banana and the moon.', durationSeconds: 20, category: 'VERBAL', penaltySteps: 2 },
];

export const MYSTERY_EFFECTS: MysteryEffect[] = [
  { type: 'MOVE', steps: 1, label: 'A little luck! Move forward 1.' },
  { type: 'MOVE', steps: 2, label: 'Tailwind! Move forward 2.' },
  { type: 'MOVE', steps: 3, label: 'Big leap! Move forward 3.' },
  { type: 'MOVE', steps: -1, label: 'Wrong turn. Move back 1.' },
  { type: 'MOVE', steps: -2, label: 'A wobble! Move back 2.' },
  { type: 'EXTRA_ROLL', label: 'Lucky roll! Roll once more.' },
  { type: 'NONE', label: 'Lucky escape. Nothing happens.' },
];

const originalEvents: Record<number, Partial<BoardTile> & { type: TileType }> = {
  4: { type: 'PARTY_DARE', label: 'Task', dareId: 'robot' },
  5: { type: 'PARTY_DARE', label: 'Balance', dareId: 'balance' },
  7: { type: 'SHORTCUT_TUNNEL', label: 'Tunnel', targetTileId: 16 },
  8: { type: 'PARTY_DARE', label: 'Quick task', dareId: 'story' },
  9: { type: 'MYSTERY', label: 'Mystery' },
  11: { type: 'CHOICE_TASK', label: 'Choose' },
  12: { type: 'PENALTY_RESET', label: 'Back to start' },
  14: { type: 'PARTY_DARE', label: 'Memory', dareId: 'memory' },
  15: { type: 'PORTAL', label: 'Portal', targetTileId: 24 },
  17: { type: 'MYSTERY', label: 'Mystery' },
  18: { type: 'PARTY_DARE', label: 'Task', dareId: 'twister' },
  20: { type: 'GATE_RESTRICTION', label: 'Block', allowedDice: [1, 2] },
  22: { type: 'PARTY_DARE', label: 'No laugh', dareId: 'no-laugh' },
  23: { type: 'CHOICE_TASK', label: 'Choose' },
  25: { type: 'CHOICE_TASK', label: 'Choose' },
  26: { type: 'PENALTY_SKIP', label: 'Skip a turn' },
  28: { type: 'EXTRA_ROLL', label: 'Roll again' },
  29: { type: 'PARTY_DARE', label: 'Fitness', dareId: 'jacks' },
  30: { type: 'PARTY_DARE', label: 'Final task', dareId: 'freeze' },
  31: { type: 'PARTY_DARE', label: 'Last laugh', dareId: 'story' },
};

function createBaseBoard(): BoardTile[] {
  return PATH_COORDINATES.map((coordinate, id) => ({
    id,
    ...coordinate,
    type: id === 0 ? 'START' : id === 33 ? 'FINISH' : 'NORMAL',
    label: id === 0 ? 'Start' : id === 33 ? 'Finish' : `${id}`,
  }));
}

export function createOriginalBoard(): BoardTile[] {
  return createBaseBoard().map((tile) => {
    const event = originalEvents[tile.id];
    return event ? { ...tile, ...event } : tile;
  });
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed: string) {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandomBoard(seed: string): BoardTile[] {
  const random = seededRandom(seed);
  const board = createBaseBoard();
  const available = Array.from({ length: 27 }, (_, index) => index + 4);
  const take = () => available.splice(Math.floor(random() * available.length), 1)[0];
  const takeWhere = (predicate: (id: number) => boolean) => {
    const candidates = available.filter(predicate);
    const selected = candidates[Math.floor(random() * candidates.length)];
    available.splice(available.indexOf(selected), 1);
    return selected;
  };
  const set = (id: number, patch: Partial<BoardTile>) => Object.assign(board[id], patch);

  const tunnel = take();
  set(tunnel, { type: 'SHORTCUT_TUNNEL', label: 'Tunnel', targetTileId: Math.min(32, tunnel + 5 + Math.floor(random() * 5)) });
  const portal = take();
  let portalTarget = portal < 20 ? Math.min(32, portal + 4 + Math.floor(random() * 6)) : Math.max(4, portal - 5);
  if (board[tunnel].targetTileId === portal && portalTarget === tunnel) portalTarget = Math.min(32, portal + 3);
  set(portal, { type: 'PORTAL', label: 'Portal', targetTileId: portalTarget });
  set(take(), { type: 'MYSTERY', label: 'Mystery' });
  set(take(), { type: 'MYSTERY', label: 'Mystery' });
  set(take(), { type: 'EXTRA_ROLL', label: 'Roll again' });
  const skip = take();
  set(skip, { type: 'PENALTY_SKIP', label: 'Skip a turn' });
  const gate = takeWhere((id) => Math.abs(id - skip) > 1);
  set(gate, { type: 'GATE_RESTRICTION', label: 'Block', allowedDice: [1, 2] });

  const reset = takeWhere((id) => id <= 27 && Math.abs(id - skip) > 1 && Math.abs(id - gate) > 1);
  set(reset, { type: 'PENALTY_RESET', label: 'Back to start' });

  for (let count = 0; count < 10; count += 1) {
    const id = take();
    const dare = DARES[Math.floor(random() * DARES.length)];
    const isChoice = count === 3 || count === 7;
    set(id, { type: isChoice ? 'CHOICE_TASK' : 'PARTY_DARE', label: isChoice ? 'Choose' : 'Task', dareId: dare.id });
  }
  return board;
}
