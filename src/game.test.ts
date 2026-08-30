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
  });
});
