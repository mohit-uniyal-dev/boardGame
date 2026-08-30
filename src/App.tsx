import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  Check,
  CircleHelp,
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  DoorOpen,
  Flag,
  Footprints,
  Home,
  LockKeyhole,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import sketchImage from '../docs/ImageReference.jpeg';
import { DARES, MYSTERY_EFFECTS, PLAYER_COLORS } from './data';
import { advanceTurn, createGame, createSeed } from './game';
import type { BoardTile, Dare, GameMode, GameState, TileType } from './types';

const STORAGE_KEY = 'blocks-and-tasks-game-v1';
const DICE_ICONS = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6];

type Continuation = 'END_TURN' | 'BONUS_ROLL';
type EventTone = 'good' | 'bad' | 'magic' | 'neutral';

interface EventDialogState {
  title: string;
  detail: string;
  tone: EventTone;
  continuation: Continuation;
}

interface DareState {
  dare: Dare;
  stage: 'intro' | 'timer' | 'vote';
  secondsLeft: number;
  votes: Record<string, boolean>;
}

const tileIcons: Partial<Record<TileType, ComponentType<{ size?: number; strokeWidth?: number }>>> = {
  START: Flag,
  FINISH: Trophy,
  SHORTCUT_TUNNEL: DoorOpen,
  PORTAL: Sparkles,
  MYSTERY: CircleHelp,
  EXTRA_ROLL: Dice6,
  PENALTY_SKIP: Pause,
  PENALTY_RESET: Home,
  GATE_RESTRICTION: LockKeyhole,
  PARTY_DARE: Star,
  CHOICE_TASK: Shuffle,
};

function readSavedGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as GameState;
    if (!saved.players?.length || saved.board?.length !== 34) return null;
    return {
      ...saved,
      phase: saved.winnerPlayerId ? 'GAME_OVER' : 'ROLL_PENDING',
      diceValue: null,
      eventMessage: saved.winnerPlayerId ? saved.eventMessage : `Game restored. ${saved.players[saved.activePlayerIndex].name}'s turn.`,
    };
  } catch {
    return null;
  }
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function getStepDuration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 40 : 190;
}

function playTone(enabled: boolean, tone: 'step' | 'roll' | 'good' | 'bad') {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = { step: 300, roll: 180, good: 620, bad: 130 };
    oscillator.frequency.value = frequencies[tone];
    oscillator.type = tone === 'bad' ? 'sawtooth' : 'sine';
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    oscillator.addEventListener('ended', () => void context.close());
  } catch {
    // Audio feedback is optional; visual feedback remains available.
  }
}

function Modal({ children, onClose, label }: { children: React.ReactNode; onClose?: () => void; label: string }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-label={label}>
        {onClose && (
          <button className="icon-button modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        )}
        {children}
      </section>
    </div>
  );
}

function SetupScreen({ savedGame, onStart, onResume }: { savedGame: GameState | null; onStart: (game: GameState) => void; onResume: () => void }) {
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3', 'Player 4']);
  const [mode, setMode] = useState<GameMode>('ORIGINAL_SKETCH');
  const [physicalDares, setPhysicalDares] = useState(true);
  const [sound, setSound] = useState(true);
  const [showRules, setShowRules] = useState(false);

  const setName = (index: number, value: string) => {
    setNames((current) => current.map((name, nameIndex) => (nameIndex === index ? value : name)));
  };

  return (
    <main className="setup-page">
      <header className="setup-header">
        <div className="brand-mark"><Footprints size={28} /></div>
        <div>
          <p className="eyebrow">A hand-drawn party race</p>
          <h1>Blocks &amp; Tasks</h1>
        </div>
        <button className="text-button rules-button" onClick={() => setShowRules(true)}>
          <CircleHelp size={18} /> How to play
        </button>
      </header>

      <div className="setup-layout">
        <section className="setup-form" aria-labelledby="new-game-title">
          <div className="section-heading">
            <p className="step-label">New game</p>
            <h2 id="new-game-title">Gather your players</h2>
            <p>Pass one device around. First to reach tile 33 wins.</p>
          </div>

          {savedGame && !savedGame.winnerPlayerId && (
            <button className="resume-banner" onClick={onResume}>
              <span className="resume-icon"><Play size={18} fill="currentColor" /></span>
              <span><strong>Resume turn {savedGame.turnNumber}</strong><small>{savedGame.players[savedGame.activePlayerIndex].name} is up next</small></span>
              <ArrowLeft className="resume-arrow" size={18} />
            </button>
          )}

          <fieldset>
            <legend>Players</legend>
            <div className="segmented" aria-label="Number of players">
              {[2, 3, 4].map((count) => (
                <button key={count} className={playerCount === count ? 'active' : ''} onClick={() => setPlayerCount(count)} type="button">{count}</button>
              ))}
            </div>
          </fieldset>

          <div className="player-inputs">
            {names.slice(0, playerCount).map((name, index) => (
              <label className="player-field" key={index}>
                <span className="pawn-dot" style={{ '--pawn-color': PLAYER_COLORS[index] } as React.CSSProperties}>{index + 1}</span>
                <span className="sr-only">Player {index + 1} name</span>
                <input value={name} maxLength={16} onChange={(event) => setName(index, event.target.value)} />
              </label>
            ))}
          </div>

          <fieldset>
            <legend>Board style</legend>
            <div className="mode-options">
              <button type="button" className={mode === 'ORIGINAL_SKETCH' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('ORIGINAL_SKETCH')}>
                <span className="mode-icon paper"><Footprints size={20} /></span>
                <span><strong>Original sketch</strong><small>The classic fixed route and surprises</small></span>
                <span className="radio-mark">{mode === 'ORIGINAL_SKETCH' && <Check size={14} />}</span>
              </button>
              <button type="button" className={mode === 'RANDOM_PARTY' ? 'mode-option selected' : 'mode-option'} onClick={() => setMode('RANDOM_PARTY')}>
                <span className="mode-icon random"><Shuffle size={20} /></span>
                <span><strong>Random party</strong><small>Fresh, fair event tiles each match</small></span>
                <span className="radio-mark">{mode === 'RANDOM_PARTY' && <Check size={14} />}</span>
              </button>
            </div>
          </fieldset>

          <div className="toggle-list">
            <label className="toggle-row">
              <span><strong>Physical dares</strong><small>Include balance and movement challenges</small></span>
              <input type="checkbox" checked={physicalDares} onChange={(event) => setPhysicalDares(event.target.checked)} />
              <span className="toggle" aria-hidden="true" />
            </label>
            <label className="toggle-row">
              <span><strong>Game sounds</strong><small>Dice, movement and event cues</small></span>
              <input type="checkbox" checked={sound} onChange={(event) => setSound(event.target.checked)} />
              <span className="toggle" aria-hidden="true" />
            </label>
          </div>

          <button className="primary-button start-button" onClick={() => onStart(createGame(names.slice(0, playerCount), mode, physicalDares, sound))}>
            <Play size={19} fill="currentColor" /> Start the race
          </button>
        </section>

        <aside className="sketch-panel">
          <div className="sketch-image-wrap">
            <img src={sketchImage} alt="The original hand-drawn board game sketch" />
            <span className="tape tape-one" />
            <span className="tape tape-two" />
          </div>
          <div className="sketch-caption">
            <span className="caption-mark"><Star size={18} fill="currentColor" /></span>
            <div><strong>Built from the original idea</strong><p>The winding path, tunnel, portal, blocks and finish-line dash all come from the paper version.</p></div>
          </div>
        </aside>
      </div>

      {showRules && (
        <Modal onClose={() => setShowRules(false)} label="How to play">
          <p className="modal-kicker">Quick rules</p>
          <h2>Race, react, reach the finish</h2>
          <div className="rule-list">
            <div><span>1</span><p><strong>Roll and move</strong>Move your pawn the number shown. Only the tile you land on activates.</p></div>
            <div><span>2</span><p><strong>Face the board</strong>Tunnels jump ahead, portals transport you, and blocks may hold you back.</p></div>
            <div><span>3</span><p><strong>Take on tasks</strong>Complete short challenges. The other players judge pass or fail.</p></div>
            <div><span>4</span><p><strong>Reach tile 33</strong>You do not need an exact roll. First across the finish line wins.</p></div>
          </div>
          <button className="primary-button" onClick={() => setShowRules(false)}>Got it</button>
        </Modal>
      )}
    </main>
  );
}

function Board({ game }: { game: GameState }) {
  const tileCenter = (tile: BoardTile) => ({ x: tile.gridX * 100 + 50, y: tile.gridY * 100 + 50 });
  const points = game.board.map((tile) => {
    const center = tileCenter(tile);
    return `${center.x},${center.y}`;
  }).join(' ');
  const transports = game.board.filter((tile) => (tile.type === 'PORTAL' || tile.type === 'SHORTCUT_TUNNEL') && tile.targetTileId !== undefined);

  return (
    <div className="board-scroll">
      <div className="board" aria-label="Game board with 34 path tiles">
        <svg className="board-routes" viewBox="0 0 1000 600" aria-hidden="true">
          <polyline className="path-line-shadow" points={points} />
          <polyline className="path-line" points={points} />
          {transports.map((tile) => {
            const from = tileCenter(tile);
            const to = tileCenter(game.board[tile.targetTileId!]);
            const lift = Math.max(70, Math.abs(to.x - from.x) * 0.16);
            return <path key={tile.id} className={`transport-route ${tile.type === 'PORTAL' ? 'portal-route' : 'tunnel-route'}`} d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - lift} ${to.x} ${to.y}`} />;
          })}
        </svg>

        {game.board.map((tile) => {
          const Icon = tileIcons[tile.type];
          const playersHere = game.players.filter((player) => player.currentTileId === tile.id);
          return (
            <div
              className={`tile tile-${tile.type.toLowerCase()}`}
              style={{ gridColumn: tile.gridX + 1, gridRow: tile.gridY + 1 } as React.CSSProperties}
              key={tile.id}
              aria-label={`Tile ${tile.id}: ${tile.label}`}
            >
              <span className="tile-number">{tile.id}</span>
              {Icon && <Icon size={21} strokeWidth={2.4} />}
              <span className="tile-label">{tile.label}</span>
              {playersHere.length > 0 && (
                <div className={`pawns pawns-${playersHere.length}`}>
                  {playersHere.map((player) => <span key={player.id} className="pawn" style={{ '--pawn-color': player.color } as React.CSSProperties} title={player.name} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlayerStrip({ game }: { game: GameState }) {
  return (
    <div className="player-strip" aria-label="Players">
      {game.players.map((player, index) => (
        <div className={index === game.activePlayerIndex ? 'player-chip active' : 'player-chip'} key={player.id}>
          <span className="mini-pawn" style={{ '--pawn-color': player.color } as React.CSSProperties} />
          <span className="player-copy"><strong>{player.name}</strong><small>Tile {player.currentTileId}</small></span>
          <span className="statuses">
            {player.skipTurnsRemaining > 0 && <span title="Skip turn"><Pause size={12} /> {player.skipTurnsRemaining}</span>}
            {player.gateLock && <span title="Gate locked"><LockKeyhole size={12} /></span>}
          </span>
        </div>
      ))}
    </div>
  );
}

function GameScreen({ initialGame, onMainMenu }: { initialGame: GameState; onMainMenu: () => void }) {
  const [game, setGame] = useState(initialGame);
  const gameRef = useRef(game);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const [dareState, setDareState] = useState<DareState | null>(null);
  const [choiceActive, setChoiceActive] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => {
    const normalized = { ...game, phase: game.winnerPlayerId ? 'GAME_OVER' : 'ROLL_PENDING', diceValue: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, [game]);

  useEffect(() => {
    if (dareState?.stage !== 'timer') return;
    if (dareState.secondsLeft <= 0) {
      setDareState((current) => current ? { ...current, stage: 'vote' } : null);
      return;
    }
    const timer = window.setTimeout(() => setDareState((current) => current ? { ...current, secondsLeft: current.secondsLeft - 1 } : null), 1000);
    return () => window.clearTimeout(timer);
  }, [dareState]);

  const activePlayer = game.players[game.activePlayerIndex];
  const DiceIcon = DICE_ICONS[(rollingValue ?? game.diceValue ?? 1) - 1];

  const endTurn = (message?: string) => {
    setGame((current) => {
      const next = advanceTurn(current);
      return message ? { ...next, eventMessage: `${message} ${next.eventMessage}` } : next;
    });
  };

  const declareWinner = (position: number, message?: string) => {
    const current = gameRef.current;
    const player = current.players[current.activePlayerIndex];
    playTone(current.settings.soundEnabled, 'good');
    setGame((state) => ({
      ...state,
      players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, currentTileId: Math.min(33, position) } : item),
      winnerPlayerId: player.id,
      phase: 'GAME_OVER',
      eventMessage: message ?? `${player.name} reached the finish!`,
    }));
  };

  const moveCurrentPlayer = (position: number) => {
    setGame((current) => ({
      ...current,
      players: current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, currentTileId: Math.max(0, Math.min(33, position)) } : player),
    }));
  };

  const showEvent = (title: string, detail: string, tone: EventTone, continuation: Continuation) => {
    playTone(gameRef.current.settings.soundEnabled, tone === 'bad' ? 'bad' : tone === 'neutral' ? 'step' : 'good');
    setGame((current) => ({ ...current, phase: 'RESOLVING_EVENT', eventMessage: detail }));
    setEventDialog({ title, detail, tone, continuation });
  };

  const dismissEvent = () => {
    const event = eventDialog;
    setEventDialog(null);
    if (!event) return;
    if (event.continuation === 'BONUS_ROLL') {
      setGame((current) => ({ ...current, phase: 'ROLL_PENDING', diceValue: null, bonusRollsUsedThisTurn: current.bonusRollsUsedThisTurn + 1, eventMessage: `${current.players[current.activePlayerIndex].name} gets another roll.` }));
    } else {
      endTurn();
    }
  };

  const pickDare = (tile: BoardTile) => {
    const eligible = DARES.filter((dare) => gameRef.current.settings.physicalDaresEnabled || dare.category !== 'PHYSICAL');
    const configured = eligible.find((dare) => dare.id === tile.dareId);
    return configured ?? eligible[Math.floor(Math.random() * eligible.length)];
  };

  const beginDare = (tile: BoardTile) => {
    setChoiceActive(false);
    const dare = pickDare(tile);
    setGame((current) => ({ ...current, phase: 'DARE_ACTIVE', eventMessage: `${current.players[current.activePlayerIndex].name} drew: ${dare.title}.` }));
    setDareState({ dare, stage: 'intro', secondsLeft: dare.durationSeconds, votes: {} });
  };

  const resolveTile = (tile: BoardTile) => {
    const current = gameRef.current;
    const player = current.players[current.activePlayerIndex];
    const bonusAvailable = current.bonusRollsUsedThisTurn < 2;

    switch (tile.type) {
      case 'NORMAL':
      case 'START':
        endTurn(`${player.name} landed on tile ${tile.id}.`);
        break;
      case 'SHORTCUT_TUNNEL': {
        const target = tile.targetTileId ?? tile.id;
        if (target >= 33) return declareWinner(target, `${player.name} took the tunnel straight to victory!`);
        moveCurrentPlayer(target);
        showEvent('Shortcut tunnel!', `${player.name} slides ahead to tile ${target}.`, 'good', 'END_TURN');
        break;
      }
      case 'PORTAL': {
        const target = tile.targetTileId ?? tile.id;
        if (target >= 33) return declareWinner(target, `${player.name} warped to the finish!`);
        moveCurrentPlayer(target);
        showEvent('Portal opened', `${player.name} reappears on tile ${target}.`, 'magic', 'END_TURN');
        break;
      }
      case 'MYSTERY': {
        const effect = MYSTERY_EFFECTS[Math.floor(Math.random() * MYSTERY_EFFECTS.length)];
        if (effect.type === 'MOVE') {
          const target = Math.max(0, player.currentTileId + (effect.steps ?? 0));
          if (target >= 33) return declareWinner(target, `${effect.label} ${player.name} wins!`);
          moveCurrentPlayer(target);
        }
        const grantsRoll = effect.type === 'EXTRA_ROLL' && bonusAvailable;
        showEvent('Mystery revealed', grantsRoll ? effect.label : effect.type === 'EXTRA_ROLL' ? 'The bonus-roll limit has been reached.' : effect.label, 'magic', grantsRoll ? 'BONUS_ROLL' : 'END_TURN');
        break;
      }
      case 'EXTRA_ROLL':
        showEvent('Roll again', bonusAvailable ? `${player.name} earns another roll.` : 'The bonus-roll limit has been reached.', 'good', bonusAvailable ? 'BONUS_ROLL' : 'END_TURN');
        break;
      case 'PENALTY_SKIP':
        setGame((state) => ({ ...state, players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, skipTurnsRemaining: Math.min(2, item.skipTurnsRemaining + 1) } : item) }));
        showEvent('Frozen turn', `${player.name} will skip their next turn.`, 'bad', 'END_TURN');
        break;
      case 'PENALTY_RESET':
        moveCurrentPlayer(0);
        showEvent('Back to start', `${player.name} is sent all the way home.`, 'bad', 'END_TURN');
        break;
      case 'GATE_RESTRICTION': {
        const allowed = tile.allowedDice ?? [1, 2];
        setGame((state) => ({ ...state, players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, gateLock: allowed } : item) }));
        showEvent('The gate is locked', `Next turn, ${player.name} needs a ${allowed.join(' or ')} to escape.`, 'bad', 'END_TURN');
        break;
      }
      case 'PARTY_DARE':
        beginDare(tile);
        break;
      case 'CHOICE_TASK':
        setGame((state) => ({ ...state, phase: 'RESOLVING_EVENT', eventMessage: `${player.name} must choose a challenge or step back.` }));
        setChoiceActive(true);
        break;
      case 'FINISH':
        declareWinner(33);
        break;
    }
  };

  const rollDice = async () => {
    const snapshot = gameRef.current;
    if (snapshot.phase !== 'ROLL_PENDING') return;
    setGame((current) => ({ ...current, phase: 'MOVING', eventMessage: `${current.players[current.activePlayerIndex].name} is rolling...` }));
    playTone(snapshot.settings.soundEnabled, 'roll');

    for (let spin = 0; spin < 7; spin += 1) {
      setRollingValue(1 + Math.floor(Math.random() * 6));
      await sleep(70);
    }
    const value = 1 + Math.floor(Math.random() * 6);
    setRollingValue(value);
    setGame((current) => ({ ...current, diceValue: value }));
    await sleep(170);
    setRollingValue(null);

    const afterRoll = gameRef.current;
    const roller = afterRoll.players[afterRoll.activePlayerIndex];
    if (roller.gateLock) {
      if (!roller.gateLock.includes(value)) {
        showEvent('Gate stays shut', `${roller.name} rolled ${value}. They need ${roller.gateLock.join(' or ')}.`, 'bad', 'END_TURN');
        return;
      }
      setGame((current) => ({ ...current, players: current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, gateLock: null } : player), eventMessage: `${roller.name} unlocked the gate with a ${value}!` }));
    }

    const start = roller.currentTileId;
    const destination = Math.min(33, start + value);
    for (let position = start + 1; position <= destination; position += 1) {
      moveCurrentPlayer(position);
      playTone(snapshot.settings.soundEnabled, 'step');
      await sleep(getStepDuration());
    }
    if (destination >= 33) {
      declareWinner(destination);
      return;
    }
    resolveTile(gameRef.current.board[destination]);
  };

  const resolveDare = (passed: boolean) => {
    if (!dareState) return;
    const current = gameRef.current;
    const player = current.players[current.activePlayerIndex];
    const grantsRoll = passed && Boolean(dareState.dare.rewardExtraRoll) && current.bonusRollsUsedThisTurn < 2;
    if (!passed) moveCurrentPlayer(player.currentTileId - dareState.dare.penaltySteps);
    setDareState(null);
    showEvent(
      passed ? 'Challenge passed!' : 'Challenge missed',
      passed ? `${player.name} nailed it${grantsRoll ? ' and earned another roll.' : '.'}` : `${player.name} moves back ${dareState.dare.penaltySteps} spaces.`,
      passed ? 'good' : 'bad',
      grantsRoll ? 'BONUS_ROLL' : 'END_TURN',
    );
  };

  const submitVotes = () => {
    if (!dareState) return;
    const opponents = game.players.filter((_, index) => index !== game.activePlayerIndex);
    if (opponents.some((player) => dareState.votes[player.id] === undefined)) return;
    const passed = opponents.filter((player) => dareState.votes[player.id]).length;
    const failed = opponents.length - passed;
    resolveDare(passed >= failed);
  };

  const rematch = (sameBoard: boolean) => {
    const names = game.players.map((player) => player.name);
    const seed = sameBoard ? game.seed : createSeed();
    setEventDialog(null);
    setDareState(null);
    setGame(createGame(names, game.settings.mode, game.settings.physicalDaresEnabled, game.settings.soundEnabled, seed));
  };

  const winner = game.players.find((player) => player.id === game.winnerPlayerId);

  return (
    <main className="game-page">
      <header className="game-header">
        <button className="brand-button" onClick={onMainMenu} title="Main menu"><Footprints size={23} /><span>Blocks &amp; Tasks</span></button>
        <div className="game-meta"><span>Turn {game.turnNumber}</span><span className="meta-divider" /><span>{game.settings.mode === 'ORIGINAL_SKETCH' ? 'Original sketch' : `Random ${game.seed}`}</span></div>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setGame((current) => ({ ...current, settings: { ...current.settings, soundEnabled: !current.settings.soundEnabled } }))} aria-label={game.settings.soundEnabled ? 'Mute sounds' : 'Enable sounds'}>{game.settings.soundEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}</button>
          <button className="icon-button" onClick={() => setShowRules(true)} aria-label="How to play"><CircleHelp size={19} /></button>
        </div>
      </header>

      <section className="game-shell">
        <div className="board-column">
          <PlayerStrip game={game} />
          <Board game={game} />
        </div>

        <aside className="turn-panel">
          <div className="turn-owner">
            <span className="turn-pawn" style={{ '--pawn-color': activePlayer.color } as React.CSSProperties} />
            <div><p>Current turn</p><h2>{activePlayer.name}</h2></div>
          </div>

          <div className={game.phase === 'MOVING' ? 'dice-stage rolling' : 'dice-stage'}>
            <div className="dice-face"><DiceIcon size={66} strokeWidth={1.8} /></div>
            <p>{rollingValue ? 'Rolling...' : game.diceValue ? `Rolled a ${game.diceValue}` : 'Ready to roll'}</p>
          </div>

          <button className="roll-button" onClick={rollDice} disabled={game.phase !== 'ROLL_PENDING'}>
            <Dice6 size={21} /> {game.phase === 'ROLL_PENDING' ? 'Roll dice' : game.phase === 'MOVING' ? 'Moving...' : 'Resolving...' }
          </button>

          {activePlayer.gateLock && <div className="status-alert gate"><LockKeyhole size={18} /><span><strong>Gate locked</strong>Roll {activePlayer.gateLock.join(' or ')} to move</span></div>}
          {activePlayer.skipTurnsRemaining > 0 && <div className="status-alert skip"><Pause size={18} /><span><strong>Turn penalty</strong>Skip {activePlayer.skipTurnsRemaining} turn</span></div>}

          <div className="event-log" aria-live="polite">
            <span><Zap size={16} /></span>
            <div><p>Latest event</p><strong>{game.eventMessage}</strong></div>
          </div>
        </aside>
      </section>

      {eventDialog && (
        <Modal label={eventDialog.title}>
          <div className={`event-emblem ${eventDialog.tone}`}>{eventDialog.tone === 'bad' ? <RotateCcw size={30} /> : eventDialog.tone === 'magic' ? <Sparkles size={30} /> : <Star size={30} />}</div>
          <p className="modal-kicker">Board event</p>
          <h2>{eventDialog.title}</h2>
          <p className="modal-detail">{eventDialog.detail}</p>
          <button className="primary-button" onClick={dismissEvent}>{eventDialog.continuation === 'BONUS_ROLL' ? 'Roll again' : 'Continue'}</button>
        </Modal>
      )}

      {choiceActive && (
        <Modal label="Choose your task">
          <div className="event-emblem magic"><Shuffle size={30} /></div>
          <p className="modal-kicker">Your choice</p>
          <h2>Brave the task?</h2>
          <p className="modal-detail">Take a party challenge, or retreat two spaces.</p>
          <div className="choice-actions">
            <button className="primary-button" onClick={() => beginDare(game.board[activePlayer.currentTileId])}><Star size={18} /> Take the task</button>
            <button className="secondary-button" onClick={() => { setChoiceActive(false); moveCurrentPlayer(activePlayer.currentTileId - 2); showEvent('A careful retreat', `${activePlayer.name} moves back 2 spaces.`, 'neutral', 'END_TURN'); }}><ArrowLeft size={18} /> Move back 2</button>
          </div>
        </Modal>
      )}

      {dareState && (
        <Modal label={dareState.dare.title}>
          <div className="dare-topline"><span className={`category category-${dareState.dare.category.toLowerCase()}`}>{dareState.dare.category}</span><span>{dareState.dare.durationSeconds} seconds</span></div>
          <div className="event-emblem good"><Star size={30} /></div>
          <p className="modal-kicker">Party task for {activePlayer.name}</p>
          <h2>{dareState.dare.title}</h2>
          <p className="modal-detail dare-detail">{dareState.dare.description}</p>

          {dareState.stage === 'intro' && (
            <div className="dare-actions">
              <button className="primary-button" onClick={() => setDareState((current) => current ? { ...current, stage: 'timer' } : null)}><Play size={18} fill="currentColor" /> Start challenge</button>
              <button className="text-button danger-text" onClick={() => resolveDare(false)}>Skip this dare</button>
            </div>
          )}
          {dareState.stage === 'timer' && (
            <div className="timer-panel">
              <div className="timer-value">{dareState.secondsLeft}</div>
              <div className="timer-track"><span style={{ width: `${(dareState.secondsLeft / dareState.dare.durationSeconds) * 100}%` }} /></div>
              <button className="secondary-button" onClick={() => setDareState((current) => current ? { ...current, stage: 'vote' } : null)}>Ready to vote</button>
            </div>
          )}
          {dareState.stage === 'vote' && (
            <div className="vote-panel">
              <p className="vote-title">Opponents: cast your votes</p>
              {game.players.map((player, index) => index === game.activePlayerIndex ? null : (
                <div className="voter-row" key={player.id}>
                  <span className="mini-pawn" style={{ '--pawn-color': player.color } as React.CSSProperties} />
                  <strong>{player.name}</strong>
                  <div className="vote-buttons">
                    <button className={dareState.votes[player.id] === true ? 'pass selected' : 'pass'} onClick={() => setDareState((current) => current ? { ...current, votes: { ...current.votes, [player.id]: true } } : null)}><Check size={16} /> Pass</button>
                    <button className={dareState.votes[player.id] === false ? 'fail selected' : 'fail'} onClick={() => setDareState((current) => current ? { ...current, votes: { ...current.votes, [player.id]: false } } : null)}><X size={16} /> Fail</button>
                  </div>
                </div>
              ))}
              <button className="primary-button" disabled={game.players.some((player, index) => index !== game.activePlayerIndex && dareState.votes[player.id] === undefined)} onClick={submitVotes}>Resolve votes</button>
              <small className="tie-note">A tied vote counts as a pass.</small>
            </div>
          )}
        </Modal>
      )}

      {winner && (
        <Modal label={`${winner.name} wins`}>
          <div className="victory-rays"><Trophy size={54} /></div>
          <p className="modal-kicker">Finish line reached</p>
          <h2 className="victory-title">{winner.name} wins!</h2>
          <p className="modal-detail">The race wrapped up in {game.turnNumber} turns.</p>
          <div className="victory-actions">
            <button className="primary-button" onClick={() => rematch(true)}><RotateCcw size={18} /> Same board</button>
            <button className="secondary-button" onClick={() => rematch(false)}><Shuffle size={18} /> New board</button>
            <button className="text-button" onClick={onMainMenu}>Main menu</button>
          </div>
        </Modal>
      )}

      {showRules && (
        <Modal onClose={() => setShowRules(false)} label="Tile guide">
          <p className="modal-kicker">Tile guide</p>
          <h2>Know the path</h2>
          <div className="tile-guide">
            <div><DoorOpen /><span><strong>Tunnel</strong>Shortcut forward</span></div>
            <div><Sparkles /><span><strong>Portal</strong>Warp elsewhere</span></div>
            <div><LockKeyhole /><span><strong>Block</strong>Roll 1 or 2 to leave</span></div>
            <div><Star /><span><strong>Task</strong>Take a party challenge</span></div>
            <div><CircleHelp /><span><strong>Mystery</strong>Draw a surprise effect</span></div>
            <div><Home /><span><strong>Reset</strong>Return to the start</span></div>
          </div>
          <button className="primary-button" onClick={() => setShowRules(false)}>Back to game</button>
        </Modal>
      )}
    </main>
  );
}

export default function App() {
  const [savedGame, setSavedGame] = useState<GameState | null>(() => readSavedGame());
  const [activeGame, setActiveGame] = useState<GameState | null>(null);

  const startGame = (game: GameState) => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedGame(null);
    setActiveGame(game);
  };

  const mainMenu = () => {
    const saved = readSavedGame();
    setSavedGame(saved?.winnerPlayerId ? null : saved);
    setActiveGame(null);
  };

  return activeGame ? (
    <GameScreen key={activeGame.id} initialGame={activeGame} onMainMenu={mainMenu} />
  ) : (
    <SetupScreen savedGame={savedGame} onStart={startGame} onResume={() => savedGame && setActiveGame(savedGame)} />
  );
}
