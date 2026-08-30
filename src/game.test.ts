import { describe, expect, it } from 'vitest';
import { createRandomBoard } from './data';
import { advanceTurn, createGame, validateBoard } from './game';

describe('board game rules', () => {
  it('creates valid deterministic random boards', () => {
    const first = createRandomBoard('NEPHEW');
    const second = createRandomBoard('NEPHEW');
    expect(first).toEqual(second);
    expect(validateBoard({ board: first })).toBe(true);
    expect(first.slice(1, 4).every((tile) => tile.type === 'NORMAL')).toBe(true);
    expect(first.filter((tile) => tile.type === 'PENALTY_RESET')).toHaveLength(1);
    expect(first.slice(31, 33).every((tile) => tile.type === 'NORMAL')).toBe(true);
    const majorNegativeIds = first.filter((tile) => ['PENALTY_SKIP', 'PENALTY_RESET', 'GATE_RESTRICTION'].includes(tile.type)).map((tile) => tile.id);
    expect(majorNegativeIds.every((id) => majorNegativeIds.every((other) => id === other || Math.abs(id - other) > 1))).toBe(true);
  });

  it('keeps 100 generated boards within the fairness constraints', () => {
    for (let index = 0; index < 100; index += 1) {
      const board = createRandomBoard(`BOARD-${index}`);
      expect(validateBoard({ board })).toBe(true);
      const majorNegativeIds = board.filter((tile) => ['PENALTY_SKIP', 'PENALTY_RESET', 'GATE_RESTRICTION'].includes(tile.type)).map((tile) => tile.id);
      expect(majorNegativeIds.every((id) => majorNegativeIds.every((other) => id === other || Math.abs(id - other) > 1))).toBe(true);
      expect(board.filter((tile) => tile.type === 'SHORTCUT_TUNNEL')).toHaveLength(1);
      expect(board.filter((tile) => tile.type === 'PARTY_DARE' || tile.type === 'CHOICE_TASK')).toHaveLength(10);
      expect(board.filter((tile) => tile.type === 'MYSTERY')).toHaveLength(2);
    }
  });

  it('decrements skipped turns and selects the next available player', () => {
    const game = createGame(['A', 'B', 'C'], 'ORIGINAL_SKETCH', true, true, 'TEST');
    game.players[1].skipTurnsRemaining = 1;
    const next = advanceTurn(game);
    expect(next.activePlayerIndex).toBe(2);
    expect(next.players[1].skipTurnsRemaining).toBe(0);
  });

  it('supports two to four configured players', () => {
    const game = createGame(['A', 'B', 'C', 'D'], 'ORIGINAL_SKETCH', false, false, 'TEST');
    expect(game.players).toHaveLength(4);
    expect(game.players.every((player) => player.currentTileId === 0)).toBe(true);
    expect(game.board.filter((tile) => tile.type === 'PARTY_DARE' || tile.type === 'CHOICE_TASK')).toHaveLength(12);
  });
});
