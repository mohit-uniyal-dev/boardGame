import type { BoardTile, Dare, MysteryEffect, TileType } from './types';

export const PLAYER_COLORS = ['#f25549', '#277ee8', '#f1af19', '#8a58d4'];

export interface PathCoordinate {
  gridX: number;
  gridY: number;
}

// The fixed route remains available for the original board configuration.
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

const GRID_WIDTH = 10;
const GRID_HEIGHT = 6;
const RANDOM_PATH_LENGTH = 34;

export function createRandomPathCoordinates(seed: string): PathCoordinate[] {
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const random = seededRandom(`${seed}-path-${attempt}`);
    const path: PathCoordinate[] = [{ gridX: 0, gridY: GRID_HEIGHT - 1 }];
    const visited = new Set(['0,5']);
    let explored = 0;

    const search = (): boolean => {
      explored += 1;
      if (explored > 20000) return false;
      if (path.length === RANDOM_PATH_LENGTH) {
        const end = path[path.length - 1];
        return end.gridY <= 2 && Math.abs(end.gridX) + Math.abs(end.gridY - (GRID_HEIGHT - 1)) >= 7;
      }

      const current = path[path.length - 1];
      const previous = path[path.length - 2];
      const previousDirection = previous ? { x: current.gridX - previous.gridX, y: current.gridY - previous.gridY } : null;
      const candidates = directions
        .map((direction) => ({ gridX: current.gridX + direction.x, gridY: current.gridY + direction.y, direction }))
        .filter(({ gridX, gridY }) => gridX >= 0 && gridX < GRID_WIDTH && gridY >= 0 && gridY < GRID_HEIGHT && !visited.has(`${gridX},${gridY}`))
        .map((candidate) => {
          const onwardMoves = directions.filter((direction) => {
            const nextX = candidate.gridX + direction.x;
            const nextY = candidate.gridY + direction.y;
            return nextX >= 0 && nextX < GRID_WIDTH && nextY >= 0 && nextY < GRID_HEIGHT && !visited.has(`${nextX},${nextY}`);
          }).length;
          const continuesStraight = previousDirection?.x === candidate.direction.x && previousDirection?.y === candidate.direction.y;
          return { ...candidate, score: random() - onwardMoves * 0.32 + candidate.gridY * 0.035 - (continuesStraight ? 0.18 : 0) };
        })
        .filter((candidate) => path.length === RANDOM_PATH_LENGTH - 1 || candidate.score < 10)
        .sort((first, second) => first.score - second.score);

      for (const candidate of candidates) {
        const key = `${candidate.gridX},${candidate.gridY}`;
        path.push({ gridX: candidate.gridX, gridY: candidate.gridY });
        visited.add(key);
        if (search()) return true;
        path.pop();
        visited.delete(key);
      }
      return false;
    };

    if (search()) return path;
  }

  return PATH_COORDINATES.map((coordinate) => ({ ...coordinate }));
}

export const DARES: Dare[] = [
  { id: 'balance', title: 'Balance', description: 'Stand on one leg.', durationSeconds: 20, category: 'PHYSICAL', penaltySteps: 2 },
  { id: 'robot', title: 'Robot walk', description: 'Walk like a robot.', durationSeconds: 15, category: 'ACTING', penaltySteps: 2 },
  { id: 'twister', title: 'Tongue twister', description: "Say 'Kacha Papad, Pakka Papad' 5 times fast.", durationSeconds: 15, category: 'VERBAL', penaltySteps: 2, rewardExtraRoll: true },
  { id: 'freeze', title: 'Freeze', description: 'Hold a silly pose. Do not move.', durationSeconds: 20, category: 'ACTING', penaltySteps: 2 },
  { id: 'memory', title: 'Remember 5', description: 'Remember: moon, spoon, kite, sock, mango. Say them when time ends.', durationSeconds: 15, category: 'MEMORY', penaltySteps: 2 },
  { id: 'no-laugh', title: "Don't laugh", description: 'Do not laugh. Everyone else can try to make you laugh.', durationSeconds: 20, category: 'ACTING', penaltySteps: 2 },
  { id: 'jacks', title: 'Jumping jacks', description: 'Do 10 jumping jacks.', durationSeconds: 20, category: 'PHYSICAL', penaltySteps: 2 },
  { id: 'story', title: 'Funny story', description: 'Tell a funny story with a banana and the moon.', durationSeconds: 20, category: 'VERBAL', penaltySteps: 2 },
];

export const MYSTERY_EFFECTS: MysteryEffect[] = [
  { type: 'MOVE', steps: 1, label: 'Move ahead 1 space.' },
  { type: 'MOVE', steps: 2, label: 'Move ahead 2 spaces.' },
  { type: 'MOVE', steps: 3, label: 'Move ahead 3 spaces.' },
  { type: 'MOVE', steps: -1, label: 'Move back 1 space.' },
  { type: 'MOVE', steps: -2, label: 'Move back 2 spaces.' },
  { type: 'EXTRA_ROLL', label: 'Roll again.' },
  { type: 'NONE', label: 'You are safe. Stay here.' },
];

const originalEvents: Record<number, Partial<BoardTile> & { type: TileType }> = {
  4: { type: 'PARTY_DARE', label: 'Task', dareId: 'robot' },
  5: { type: 'PARTY_DARE', label: 'Balance', dareId: 'balance' },
  7: { type: 'SHORTCUT_TUNNEL', label: 'Tunnel', targetTileId: 16 },
  8: { type: 'PARTY_DARE', label: 'Quick task', dareId: 'story' },
  9: { type: 'MYSTERY', label: 'Mystery' },
  11: { type: 'PARTY_DARE', label: 'Task', dareId: 'story' },
  12: { type: 'PENALTY_RESET', label: 'Back to start' },
  14: { type: 'PARTY_DARE', label: 'Memory', dareId: 'memory' },
  15: { type: 'PORTAL', label: 'Portal', targetTileId: 24 },
  17: { type: 'MYSTERY', label: 'Mystery' },
  18: { type: 'PARTY_DARE', label: 'Task', dareId: 'twister' },
  20: { type: 'GATE_RESTRICTION', label: 'Block', allowedDice: [1, 2] },
  22: { type: 'PARTY_DARE', label: 'No laugh', dareId: 'no-laugh' },
  23: { type: 'PARTY_DARE', label: 'Task', dareId: 'no-laugh' },
  25: { type: 'PARTY_DARE', label: 'Task', dareId: 'memory' },
  26: { type: 'PENALTY_SKIP', label: 'Skip a turn' },
  28: { type: 'EXTRA_ROLL', label: 'Roll again' },
  29: { type: 'PARTY_DARE', label: 'Fitness', dareId: 'jacks' },
  30: { type: 'PARTY_DARE', label: 'Final task', dareId: 'freeze' },
  31: { type: 'PARTY_DARE', label: 'Last laugh', dareId: 'story' },
};

function createBaseBoard(coordinates: PathCoordinate[] = PATH_COORDINATES): BoardTile[] {
  return coordinates.map((coordinate, id) => ({
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
  const board = createBaseBoard(createRandomPathCoordinates(seed));
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
    set(id, { type: 'PARTY_DARE', label: 'Task', dareId: dare.id });
  }
  return board;
}
