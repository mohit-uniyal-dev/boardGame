import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
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
import { DARES, MYSTERY_EFFECTS, PLAYER_NAMES } from './data';
import { advanceTurn, canLeaveStart, chooseDare, createGame, createSeed, WIN_POINTS } from './game';
import type { BoardTile, Dare, GameState, TileType } from './types';

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
    const players = saved.players.map((player, index) => ({
      ...player,
      name: /^Player \d+$/.test(player.name) ? (PLAYER_NAMES[index] ?? player.name) : player.name,
      points: player.points ?? 0,
      recentDareIds: player.recentDareIds ?? [],
    }));
    const winner = players.find((player) => player.id === saved.winnerPlayerId);
    return {
      ...saved,
      players,
      phase: saved.winnerPlayerId ? 'GAME_OVER' : 'ROLL_PENDING',
      diceValue: null,
      eventMessage: winner ? `${winner.name} wins ${WIN_POINTS.toLocaleString()} points!` : `Game loaded. ${players[saved.activePlayerIndex].name}'s turn.`,
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

type SoundEffect = 'step' | 'roll' | 'good' | 'bad' | 'portal' | 'mystery' | 'win';

let sharedAudioContext: AudioContext | null = null;

function addTone(context: AudioContext, start: number, frequency: number, duration: number, volume: number, waveform: OscillatorType = 'sine', endFrequency?: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function addNoise(context: AudioContext, start: number, duration: number, volume: number) {
  const frameCount = Math.floor(context.sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, context.sampleRate);
  const channel = buffer.getChannelData(0);
  for (let index = 0; index < frameCount; index += 1) channel[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
  source.stop(start + duration);
}

function playSound(enabled: boolean, effect: SoundEffect) {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    sharedAudioContext ??= new AudioContextClass();
    const context = sharedAudioContext;
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime + 0.015;

    switch (effect) {
      case 'step':
        addTone(context, now, 360, 0.07, 0.05, 'square', 300);
        break;
      case 'roll':
        addNoise(context, now, 0.38, 0.13);
        [0, 0.09, 0.18, 0.27].forEach((delay, index) => addTone(context, now + delay, 180 + index * 45, 0.055, 0.055, 'square'));
        break;
      case 'good':
        [523, 659, 784].forEach((frequency, index) => addTone(context, now + index * 0.09, frequency, 0.18, 0.075, 'triangle'));
        break;
      case 'bad':
        addTone(context, now, 330, 0.2, 0.075, 'sawtooth', 210);
        addTone(context, now + 0.16, 190, 0.22, 0.065, 'sawtooth', 125);
        break;
      case 'portal':
        addTone(context, now, 180, 0.48, 0.065, 'sine', 960);
        addTone(context, now + 0.08, 260, 0.42, 0.04, 'triangle', 1320);
        break;
      case 'mystery':
        [740, 988, 1319, 988].forEach((frequency, index) => addTone(context, now + index * 0.075, frequency, 0.18, 0.055, 'sine'));
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((frequency, index) => addTone(context, now + index * 0.13, frequency, index === 3 ? 0.48 : 0.24, 0.085, 'triangle'));
        break;
    }
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

function SetupScreen({ onStart }: { onStart: (game: GameState) => void }) {
  const [playerCount, setPlayerCount] = useState(2);
  const startGame = () => {
    const names = PLAYER_NAMES.slice(0, playerCount);
    onStart(createGame(names, 'RANDOM_PARTY', true, true));
  };

  return (
    <main className="simple-home">
      <section className="home-panel" aria-labelledby="game-title">
        <div className="brand-mark home-brand"><Footprints size={35} /></div>
        <p className="eyebrow">A party board game</p>
        <h1 id="game-title">Blocks &amp; Tasks</h1>
        <p className="home-subtitle">Pick your players and race to the finish.</p>

        <fieldset className="home-player-select">
          <legend>How many players?</legend>
          <div className="segmented" aria-label="Number of players">
            {[2, 3, 4].map((count) => (
              <button key={count} className={playerCount === count ? 'active' : ''} onClick={() => setPlayerCount(count)} type="button">{count}</button>
            ))}
          </div>
        </fieldset>

        <button className="primary-button home-play-button" onClick={startGame}>
          <Play size={23} fill="currentColor" /> Play
        </button>
        <p className="home-credit">A game idea by Krishna Baukhandi, made with ChatGPT and Mama Ji</p>
      </section>
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
              className={`tile tile-${tile.type.toLowerCase()} tile-color-${tile.id % 5}`}
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

function GameScreen({ initialGame, onMainMenu }: { initialGame: GameState; onMainMenu: () => void }) {
  const [game, setGame] = useState(initialGame);
  const gameRef = useRef(game);
  const [rollingValue, setRollingValue] = useState<number | null>(null);
  const [eventDialog, setEventDialog] = useState<EventDialogState | null>(null);
  const [dareState, setDareState] = useState<DareState | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => {
    const normalized = { ...game, phase: game.winnerPlayerId ? 'GAME_OVER' : 'ROLL_PENDING', diceValue: null };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, [game]);

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
    playSound(current.settings.soundEnabled, 'win');
    setGame((state) => ({
      ...state,
      players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, currentTileId: Math.min(33, position), points: item.points + WIN_POINTS } : item),
      winnerPlayerId: player.id,
      phase: 'GAME_OVER',
      eventMessage: message ?? `${player.name} wins ${WIN_POINTS.toLocaleString()} points!`,
    }));
  };

  const moveCurrentPlayer = (position: number) => {
    setGame((current) => ({
      ...current,
      players: current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, currentTileId: Math.max(0, Math.min(33, position)) } : player),
    }));
  };

  const showEvent = (title: string, detail: string, tone: EventTone, continuation: Continuation, sound?: SoundEffect) => {
    playSound(gameRef.current.settings.soundEnabled, sound ?? (tone === 'bad' ? 'bad' : tone === 'magic' ? 'mystery' : tone === 'neutral' ? 'step' : 'good'));
    setGame((current) => ({ ...current, phase: 'RESOLVING_EVENT', eventMessage: detail }));
    setEventDialog({ title, detail, tone, continuation });
  };

  const finishEvent = () => {
    const event = eventDialog;
    setEventDialog(null);
    if (!event) return;
    if (event.continuation === 'BONUS_ROLL') {
      setGame((current) => ({ ...current, phase: 'ROLL_PENDING', diceValue: null, bonusRollsUsedThisTurn: current.bonusRollsUsedThisTurn + 1, eventMessage: `${current.players[current.activePlayerIndex].name} rolls again.` }));
    } else {
      endTurn();
    }
  };

  useEffect(() => {
    if (!eventDialog) return;
    const timer = window.setTimeout(finishEvent, 1800);
    return () => window.clearTimeout(timer);
  }, [eventDialog]);

  const pickDare = (tile: BoardTile) => {
    const eligible = DARES.filter((dare) => gameRef.current.settings.physicalDaresEnabled || dare.category !== 'PHYSICAL');
    const player = gameRef.current.players[gameRef.current.activePlayerIndex];
    return chooseDare(eligible, player.recentDareIds, tile.dareId);
  };

  const beginDare = (tile: BoardTile) => {
    const selection = pickDare(tile);
    const dare = selection.dare;
    setGame((current) => ({
      ...current,
      players: current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, recentDareIds: selection.nextRecentDareIds } : player),
      phase: 'DARE_ACTIVE',
      eventMessage: `${current.players[current.activePlayerIndex].name}'s task: ${dare.title}.`,
    }));
    setDareState({ dare });
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
        if (target >= 33) return declareWinner(target, `${player.name} wins!`);
        moveCurrentPlayer(target);
        showEvent('Tunnel!', `Go to tile ${target}.`, 'good', 'END_TURN');
        break;
      }
      case 'PORTAL': {
        const target = tile.targetTileId ?? tile.id;
        if (target >= 33) return declareWinner(target, `${player.name} wins!`);
        moveCurrentPlayer(target);
        showEvent('Portal!', `Go to tile ${target}.`, 'magic', 'END_TURN', 'portal');
        break;
      }
      case 'MYSTERY': {
        const effect = MYSTERY_EFFECTS[Math.floor(Math.random() * MYSTERY_EFFECTS.length)];
        if (effect.type === 'MOVE') {
          const target = Math.max(0, player.currentTileId + (effect.steps ?? 0));
          if (target >= 33) return declareWinner(target, `${player.name} wins!`);
          moveCurrentPlayer(target);
        }
        const grantsRoll = effect.type === 'EXTRA_ROLL' && bonusAvailable;
        showEvent('Mystery!', grantsRoll ? effect.label : effect.type === 'EXTRA_ROLL' ? 'No more extra rolls.' : effect.label, 'magic', grantsRoll ? 'BONUS_ROLL' : 'END_TURN', 'mystery');
        break;
      }
      case 'EXTRA_ROLL':
        showEvent('Roll again!', bonusAvailable ? 'You get one more roll.' : 'No more extra rolls.', 'good', bonusAvailable ? 'BONUS_ROLL' : 'END_TURN');
        break;
      case 'PENALTY_SKIP':
        setGame((state) => ({ ...state, players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, skipTurnsRemaining: Math.min(2, item.skipTurnsRemaining + 1) } : item) }));
        showEvent('Miss a turn', 'Miss your next turn.', 'bad', 'END_TURN');
        break;
      case 'PENALTY_RESET':
        moveCurrentPlayer(0);
        showEvent('Back to Start', 'Go back to Start.', 'bad', 'END_TURN');
        break;
      case 'GATE_RESTRICTION': {
        const allowed = tile.allowedDice ?? [1, 2];
        setGame((state) => ({ ...state, players: state.players.map((item, index) => index === state.activePlayerIndex ? { ...item, gateLock: allowed } : item) }));
        showEvent('Blocked!', `Next turn, roll ${allowed.join(' or ')} to move.`, 'bad', 'END_TURN');
        break;
      }
      case 'PARTY_DARE':
      case 'CHOICE_TASK':
        beginDare(tile);
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
    playSound(snapshot.settings.soundEnabled, 'roll');

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
    if (roller.currentTileId === 0 && !canLeaveStart(value)) {
      showEvent('Stay at Start', 'Roll 1 or 6 to move.', 'neutral', 'END_TURN');
      return;
    }
    if (roller.gateLock) {
      if (!roller.gateLock.includes(value)) {
        showEvent('Still blocked', `You rolled ${value}. You need ${roller.gateLock.join(' or ')}.`, 'bad', 'END_TURN');
        return;
      }
      setGame((current) => ({ ...current, players: current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, gateLock: null } : player), eventMessage: `${roller.name} is free!` }));
    }

    const start = roller.currentTileId;
    const destination = Math.min(33, start + value);
    for (let position = start + 1; position <= destination; position += 1) {
      moveCurrentPlayer(position);
      playSound(snapshot.settings.soundEnabled, 'step');
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
    const dare = dareState.dare;
    setDareState(null);
    playSound(gameRef.current.settings.soundEnabled, passed ? 'good' : 'bad');
    setGame((current) => {
      const grantsRoll = passed && Boolean(dare.rewardExtraRoll) && current.bonusRollsUsedThisTurn < 2;
      const players = passed ? current.players : current.players.map((player, index) => index === current.activePlayerIndex ? { ...player, currentTileId: Math.max(0, player.currentTileId - dare.penaltySteps) } : player);
      const message = passed ? (grantsRoll ? 'Great job! Roll again.' : 'Great job!') : `Move back ${dare.penaltySteps} spaces.`;
      const updated = { ...current, players, eventMessage: message };
      if (grantsRoll) return { ...updated, phase: 'ROLL_PENDING' as const, diceValue: null, bonusRollsUsedThisTurn: current.bonusRollsUsedThisTurn + 1 };
      const next = advanceTurn(updated);
      return { ...next, eventMessage: `${message} ${next.eventMessage}` };
    });
  };

  const rematch = () => {
    const names = game.players.map((player) => player.name);
    const seed = createSeed();
    const nextGame = createGame(names, game.settings.mode, game.settings.physicalDaresEnabled, game.settings.soundEnabled, seed);
    nextGame.players = nextGame.players.map((player, index) => ({ ...player, points: game.players[index].points, recentDareIds: game.players[index].recentDareIds }));
    setEventDialog(null);
    setDareState(null);
    setGame(nextGame);
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

          {activePlayer.gateLock && <div className="status-alert gate"><LockKeyhole size={18} /><span><strong>Blocked</strong>Roll {activePlayer.gateLock.join(' or ')} to move</span></div>}
          {activePlayer.currentTileId === 0 && <div className="status-alert start"><Flag size={18} /><span><strong>At Start</strong>Roll 1 or 6 to move</span></div>}
          {activePlayer.skipTurnsRemaining > 0 && <div className="status-alert skip"><Pause size={18} /><span><strong>Miss a turn</strong>{activePlayer.skipTurnsRemaining} left</span></div>}

          <div className="event-log" aria-live="polite">
            <span><Zap size={16} /></span>
            <div><p>What happened</p><strong>{game.eventMessage}</strong></div>
          </div>
        </aside>
      </section>

      {eventDialog && (
        <div className={`event-toast ${eventDialog.tone}`} role="status" aria-live="assertive">
          <span className="event-toast-icon">{eventDialog.tone === 'bad' ? <RotateCcw size={22} /> : eventDialog.tone === 'magic' ? <Sparkles size={22} /> : <Star size={22} />}</span>
          <div><strong>{eventDialog.title}</strong><p>{eventDialog.detail}</p></div>
          <span className="event-toast-progress" aria-hidden="true" />
        </div>
      )}

      {dareState && (
        <Modal label={dareState.dare.title}>
          <div className="event-emblem good"><Star size={30} /></div>
          <p className="modal-kicker">{activePlayer.name}'s task</p>
          <h2>{dareState.dare.title}</h2>
          <p className="modal-detail dare-detail">{dareState.dare.description}</p>
          <p className="task-complete-label">Completed?</p>
          <div className="task-result-buttons">
            <button className="primary-button" onClick={() => resolveDare(true)}><Check size={20} /> Yes</button>
            <button className="secondary-button" onClick={() => resolveDare(false)}><X size={20} /> No</button>
          </div>
        </Modal>
      )}

      {winner && (
        <Modal label={`${winner.name} wins`}>
          <div className="victory-rays"><Trophy size={54} /></div>
          <p className="modal-kicker">Game over</p>
          <h2 className="victory-title">{winner.name} wins!</h2>
          <div className="points-award"><Sparkles size={22} /><strong>+{WIN_POINTS.toLocaleString()} points</strong><span>Total: {winner.points.toLocaleString()}</span></div>
          <p className="modal-detail">You finished in {game.turnNumber} turns.</p>
          <div className="victory-actions">
            <button className="primary-button" onClick={rematch}><Shuffle size={18} /> Play again</button>
            <button className="text-button" onClick={onMainMenu}>Main menu</button>
          </div>
        </Modal>
      )}

      {showRules && (
        <Modal onClose={() => setShowRules(false)} label="Tile guide">
          <p className="modal-kicker">Tile guide</p>
          <h2>Know the path</h2>
          <div className="tile-guide">
            <div><DoorOpen /><span><strong>Tunnel</strong>Move ahead</span></div>
            <div><Sparkles /><span><strong>Portal</strong>Go to a new tile</span></div>
            <div><LockKeyhole /><span><strong>Block</strong>Roll 1 or 2</span></div>
            <div><Star /><span><strong>Task</strong>Do a fun task</span></div>
            <div><CircleHelp /><span><strong>Mystery</strong>Get a surprise</span></div>
            <div><Home /><span><strong>Back to Start</strong>Go to Start</span></div>
          </div>
          <button className="primary-button" onClick={() => setShowRules(false)}>Back to game</button>
        </Modal>
      )}
    </main>
  );
}

export default function App() {
  const [activeGame, setActiveGame] = useState<GameState | null>(() => readSavedGame());

  const startGame = (game: GameState) => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveGame(game);
  };

  const mainMenu = () => {
    localStorage.removeItem(STORAGE_KEY);
    setActiveGame(null);
  };

  return activeGame ? (
    <GameScreen key={activeGame.id} initialGame={activeGame} onMainMenu={mainMenu} />
  ) : (
    <SetupScreen onStart={startGame} />
  );
}
