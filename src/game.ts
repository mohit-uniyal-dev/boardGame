import { createOriginalBoard, createRandomBoard, PLAYER_COLORS } from './data';
import type { GameMode, GameState, Player } from './types';

export function createSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function createGame(names: string[], mode: GameMode, physicalDaresEnabled: boolean, soundEnabled: boolean, seed = createSeed()): GameState {
  const players: Player[] = names.map((name, index) => ({
    id: `player-${index + 1}-${Date.now()}`,
    name: name.trim() || `Player ${index + 1}`,
    color: PLAYER_COLORS[index],
    currentTileId: 0,
    skipTurnsRemaining: 0,
    gateLock: null,
  }));

  return {
    id: `game-${Date.now()}`,
    seed,
    settings: { mode, physicalDaresEnabled, soundEnabled },
    players,
    activePlayerIndex: 0,
    board: mode === 'ORIGINAL_SKETCH' ? createOriginalBoard() : createRandomBoard(seed),
    phase: 'ROLL_PENDING',
    diceValue: null,
    bonusRollsUsedThisTurn: 0,
    winnerPlayerId: null,
    turnNumber: 1,
    eventMessage: `${players[0].name} starts the game.`,
  };
}

export function advanceTurn(state: GameState): GameState {
  const players = state.players.map((player) => ({ ...player }));
  let nextIndex = state.activePlayerIndex;
  const skipped: string[] = [];

  for (let checked = 0; checked < players.length; checked += 1) {
    nextIndex = (nextIndex + 1) % players.length;
    if (players[nextIndex].skipTurnsRemaining > 0) {
      players[nextIndex].skipTurnsRemaining -= 1;
      skipped.push(players[nextIndex].name);
      continue;
    }
    break;
  }

  const activeName = players[nextIndex].name;
  const skipMessage = skipped.length ? `${skipped.join(' and ')} skipped. ` : '';
  return {
    ...state,
    players,
    activePlayerIndex: nextIndex,
    phase: 'ROLL_PENDING',
    diceValue: null,
    bonusRollsUsedThisTurn: 0,
    turnNumber: state.turnNumber + 1,
    eventMessage: `${skipMessage}${activeName}'s turn.`,
  };
}

export function validateBoard(state: Pick<GameState, 'board'>) {
  const { board } = state;
  if (board.length !== 34 || board[0].type !== 'START' || board[33].type !== 'FINISH') return false;
  return board.every((tile, index) => tile.id === index && (tile.targetTileId === undefined || (tile.targetTileId >= 0 && tile.targetTileId <= 33 && tile.targetTileId !== tile.id)));
}
