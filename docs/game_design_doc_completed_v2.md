# Game Design Document: Dynamic Party Board Game (Web MVP v1.1)

> Based on the original hand-drawn board concept and the first documented MVP. This version fills in gameplay edge cases, event resolution rules, safety/fairness rules, data-model gaps, implementation phases, and acceptance criteria so another developer/agent can build the game without having to guess core behavior.

**Target Platform:** Web (HTML5 / React + TypeScript recommended; Canvas/SVG/CSS Grid for board rendering)  
**Game Mode:** Local Pass-and-Play (2–4 players on the same device)  
**Primary Audience:** Friends / family party play  
**Expected Match Length:** ~10–20 minutes  
**Board Size:** Approximately 34 positions (`START = 0`, numbered path tiles, `FINISH = 33`)  
**Objective:** Be the first player to navigate past traps, tunnels/portals, blocks, and party tasks and reach the Finish line.

---

## 1. Original Sketch Concepts Preserved

The paper sketch clearly establishes the following core ideas and they should remain part of the game identity:

- A winding numbered path from **Starting Point** to **Finishing Point**.
- A **Tunnel** that acts as a shortcut.
- A **Portal** / special transport mechanic.
- A **Go to Starting Point** punishment.
- Multiple handwritten **blocks/tasks/challenges** placed on the path.
- Some tasks appear to be timed or physical party challenges.
- The path changes direction several times rather than being a simple straight line.

Some handwritten task text in the sketch is not fully legible. Those specific tasks should be treated as editable content rather than hard-coded rules.

---

## 2. Core Game Rules

1. **Player Setup**
   - 2–4 players enter a display name.
   - Each player receives a unique pawn color/avatar.
   - All pawns begin on `START` (Tile `0`).
   - Player order is either entered order or randomly shuffled by a setting.

2. **Turn-Based Dice Rolling**
   - Players take turns rolling one standard six-sided die (`1–6`).
   - Only the active player can roll.
   - Dice input is disabled while movement or an event animation is resolving.
   - A pawn on `START` can leave only after rolling `1` or `6`. The valid roll is then used for normal movement.

3. **Pawn Movement**
   - A pawn moves one tile at a time according to the dice result.
   - Each intermediate step should be animated.
   - Intermediate tiles do **not** activate while passing over them. Only the final landing tile resolves.

4. **Special Tile Resolution**
   - After movement completes, resolve the event on the landed tile.
   - Forced movement caused by a tile can still produce a win if it reaches/passes `FINISH`.
   - For MVP, forced movement does **not** trigger another special tile unless the effect explicitly sets `triggerDestinationEffect = true`. This prevents accidental loops.

5. **Winning**
   - A player wins as soon as their position reaches or exceeds the `FINISH` tile.
   - **Exact roll is not required** in the MVP.
   - The winner earns **1,000 points**. Totals continue across rematches and reset from the home screen.
   - Once a winner is declared, all gameplay controls are disabled and the Victory screen appears.

6. **Shared Tile Rule**
   - Multiple pawns may occupy the same tile.
   - There is no pawn capture, knock-back, or blocking in MVP.

---

## 3. Recommended Game Modes

### 3.1 Original Sketch Mode
A fixed board intended to preserve the nephew's original concept.

- Board geometry is fixed.
- Special tile locations are fixed after the unclear handwritten tasks are finalized.
- Useful as the canonical/default board.

### 3.2 Random Party Mode
The path geometry and eligible special events are generated at match creation.

- Creates a connected 34-block route with a different shape for each seed.
- Increases replayability.
- Reusing the same seed recreates the same layout.
- Uses fairness constraints described later in this document.

For MVP, either mode can ship first. The data model should support both without rewriting the board engine.

---

## 4. Tile Specifications & Classification

| Tile Type | Classification | Behavior & Mechanics | UI / Visual Indicator |
| :--- | :--- | :--- | :--- |
| `START` | Origin | Starting point for every pawn. Tile `0`. | Green flag / Home icon |
| `FINISH` | Goal | Reaching or passing this tile wins the game. | Trophy / Checkered flag |
| `NORMAL` | Standard | No effect. Turn ends. | Plain numbered tile |
| `SHORTCUT_TUNNEL` | Positive Transport | Sends the player to a configured forward target tile. | Tunnel entrance + directional arrow |
| `PORTAL` | Transport / Chaos | Teleports the player to a configured destination. Can be forward or backward depending on the portal definition. | Purple/blue portal swirl |
| `MYSTERY` | Random Event | Draws one random mystery effect such as movement or an extra roll. | `?` / mystery card icon |
| `EXTRA_ROLL` | Positive Modifier | Active player receives one additional dice roll after the current event resolves. | Dice + sparkle icon |
| `PENALTY_SKIP` | Status Debuff | Player skips a configured number of future turns (MVP default: `1`). | Pause / frozen icon |
| `PENALTY_RESET` | Major Setback | Sends the player directly to `START`. | Red reset / home arrow |
| `GATE_RESTRICTION` | Conditional Block | Player becomes locked at this tile until they roll one of the allowed values. | Lock / barricade |
| `PARTY_DARE` | Physical / Social Task | Opens one task prompt with **Completed? Yes / No**. | Star / challenge badge |
| `CHOICE_TASK` | Reserved | Not generated in the simplified kid mode. | Fork / choice icon |

### Important distinction: Tunnel vs Portal

- **Tunnel:** normally a beneficial one-way shortcut and should always move forward.
- **Portal:** can connect any two points and may be beneficial or risky.
- **Mystery:** is the random-card mechanic; it is separate from a deterministic portal.

This separation avoids overloading one mechanic with several unrelated behaviors.

---

## 5. Mystery Deck

`MYSTERY` tiles draw one effect from a small reusable deck.

### MVP Mystery Effects

- Move forward `+1`
- Move forward `+2`
- Move forward `+3`
- Move forward `+4`
- Move backward `-1`
- Move backward `-2`
- Move backward `-3`
- Gain one extra roll
- Nothing happens / lucky escape

### Rules

- Clamp backward movement at `START`; position can never become negative.
- Forward mystery movement can win the game.
- Avoid choosing the same mystery result more than twice in a row when practical.
- Maximum bonus rolls during one player's turn: **2**, preventing infinite extra-roll chains.

---

## 6. Gate / Block Mechanic

This mechanic represents the "block" idea in the sketch.

1. Player lands on a `GATE_RESTRICTION` tile.
2. `player.gateLock` is assigned the gate configuration.
3. On each future turn, the player still rolls the die normally.
4. If the result is not in `allowedDice`, the pawn does not move and the turn ends.
5. If the result is allowed:
   - Gate is cleared.
   - The same successful roll is used to move the pawn forward.
6. A player cannot simultaneously have more than one gate lock.

**Recommended MVP gate:** roll `1` or `2` to escape.

---

## 7. Dynamic Procedural Generation Logic

Random Party Mode generates both the physical path coordinates and tile behavior from the match seed.

Path generation rules:

- Tile `0` starts at the lower-left corner.
- The route contains exactly `34` unique grid cells.
- Consecutive path tiles must be orthogonally adjacent.
- The finish must be in the upper half and a useful distance from Start.
- A failed generation attempt retries with the same seed and a new attempt suffix.
- Reusing a seed must reproduce the same route.

### Recommended Distribution Per Match

For the eligible interior tiles:

- **Normal:** ~45–55%
- **Party Dares / Choice Tasks:** ~15–20%
- **Tunnel / Portal / Extra Roll / Mystery:** ~15–20%
- **Skip / Gate:** ~10–15%
- **Reset to Start:** maximum `1–2` tiles total

These are target ranges, not strict percentages; a 34-tile board is small enough that hard percentages can create awkward counts.

### Generation Constraints

1. Tile `0` is always `START`.
2. Tile `33` is always `FINISH`.
3. Tiles `1–3` must be beginner-safe.
4. The final `2` tiles before `FINISH` cannot be `PENALTY_RESET` or `GATE_RESTRICTION`.
5. Two major negative events should not be adjacent.
6. `PENALTY_RESET` tiles should be separated from each other by at least `8` path positions.
7. A tunnel target must always be ahead of its source by at least `4` tiles.
8. Tunnel/portal destinations cannot target `START` unless intentionally configured as a negative portal.
9. Portal/tunnel source and destination must not be the same tile.
10. No generated transport cycle is allowed (`A → B → A`).
11. Do not place a gate immediately after another gate or skip tile.
12. Every generated board must contain at least:
    - `1` transport shortcut,
    - `2` party tasks,
    - `1` mystery/chaos event.

### Optional Deterministic Seed

Store a `seed` string/number when generating the board. This allows:

- recreating a fun board,
- debugging a reported issue,
- adding a future "Play Same Board" button.

---

## 8. Physical Party Dare Mechanics

When a player lands on `PARTY_DARE`, pause the main board and open a modal.

### Flow

1. Draw a random challenge from the dare repository.
2. Show the task and **Completed? Yes / No** in one modal.
3. Tapping either answer immediately applies the result and closes the modal.
4. Resume the game and end the turn unless the reward grants an extra roll.

The simplified kid UI does not use a separate start button, timer, voting screen, or result popup.

Each player keeps an independent recent-task history. Show every eligible task before repeating one for that player, and never repeat their immediately previous task when a new cycle begins.

### MVP Failure Rule

Default failure result: move backward `2` spaces.

This should be data-driven per dare so individual tasks can use a different result later.

---

## 9. Dare Content Guidelines

Party challenges should be fun without requiring dangerous, humiliating, sexual, painful, destructive, or age-inappropriate behavior.

### Initial Seed Data

- **Shoulder Massage** — "Give the player to your left a 20-second shoulder massage." — 20s
- **Single-Leg Balance** — "Stand on one leg without losing balance." — 20s
- **Tree Pose** — "Hold a Tree Pose for 20 seconds." — 20s
- **Tongue Twister** — "Say 'Kacha Papad, Pakka Papad' 5 times fast without stumbling." — 15s
- **Fitness Burst** — "Perform 10 jumping jacks before the timer ends." — 20s
- **No-Laugh Challenge** — "Keep a straight face while the other players try to make you laugh." — 20s
- **Robot Walk** — "Walk like a robot for 15 seconds." — 15s
- **One-Breath Sentence** — "Say the displayed funny sentence in one breath." — 15s
- **Freeze Pose** — "Hold a silly statue pose without moving." — 20s
- **Memory Challenge** — "Repeat a displayed sequence of 5 simple items." — 20s

### Accessibility / Comfort Option

Game settings should include **No Physical Dares**. When enabled, physical challenges are replaced by verbal, memory, acting, or trivia-style party tasks.

A player should also be able to select **Skip This Dare**. For MVP, skipping counts as a normal failure penalty rather than forcing participation.

---

## 10. Exact Event Resolution Order

Use this order to avoid edge-case bugs:

```text
TURN_START
  ↓
Check skipped-turn status
  ↓
Check gate lock
  ↓
ROLL_PENDING
  ↓
Roll D6
  ↓
If gate locked:
   invalid roll → end turn
   valid roll   → unlock and continue with same roll
  ↓
MOVING
  ↓
Move tile-by-tile
  ↓
Check FINISH
  ↓
RESOLVING_EVENT
  ↓
Resolve landed tile
  ↓
Apply forced movement/status/dare
  ↓
Check FINISH again
  ↓
If extra roll granted → ROLL_PENDING for same player
Else → NEXT_TURN
```

### Event Chaining

MVP default:

```ts
triggerDestinationEffect = false
```

Example: landing on Tunnel 7 sends the pawn to Tile 18, but Tile 18's own event is not triggered during that forced move.

This keeps turns understandable and prevents portal/reset chains. It can be turned on later for specific special tiles.

---

## 11. Player Status Rules

### Skip Turn

Use a counter rather than a boolean:

```ts
skipTurnsRemaining: number;
```

At the start of the player's turn:

- if `> 0`, decrement it and immediately move to the next player.

### Gate Lock

Store the gate's allowed dice values on the player while locked.

### Status Stacking

For MVP:

- Skip-turn penalties can stack up to a maximum of `2` skipped turns.
- Only one gate lock can exist at a time.
- A skipped player does not roll for their gate during the skipped turn.

---

## 12. Technical Architecture

### Recommended Stack

- **React + TypeScript + Vite**
- Board rendering: **CSS Grid / absolute-positioned HTML/SVG** for MVP
- Animations: CSS transitions or a lightweight animation layer
- State: React reducer (`useReducer`) or Zustand if desired
- Persistence: `localStorage` for refresh recovery
- No backend required for local MVP

Canvas is also viable, but DOM/SVG is easier for modals, responsive interaction, accessibility, and debugging.

---

## 13. TypeScript Data Model

```typescript
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

export interface DarePayload {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  category: 'PHYSICAL' | 'VERBAL' | 'ACTING' | 'MEMORY';
  penaltySteps: number;
  rewardExtraRoll?: boolean;
}

export interface GatePayload {
  allowedDice: number[];
  label?: string;
}

export interface MysteryEffect {
  id: string;
  type: 'MOVE' | 'EXTRA_ROLL' | 'NONE';
  steps?: number;
  label: string;
}

export interface BoardTile {
  id: number;
  gridX: number;
  gridY: number;
  type: TileType;
  label: string;

  targetTileId?: number;
  triggerDestinationEffect?: boolean;
  gate?: GatePayload;
  dareId?: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  currentTileId: number;
  skipTurnsRemaining: number;
  gateLock: GatePayload | null;
}

export type TurnPhase =
  | 'SETUP'
  | 'TURN_START'
  | 'ROLL_PENDING'
  | 'MOVING'
  | 'RESOLVING_EVENT'
  | 'DARE_ACTIVE'
  | 'DARE_VOTING'
  | 'GAME_OVER';

export interface GameSettings {
  mode: GameMode;
  playerOrder: 'ENTERED' | 'RANDOM';
  physicalDaresEnabled: boolean;
  exactRollToFinish: boolean; // false for MVP
  soundEnabled: boolean;
}

export interface GameState {
  gameId: string;
  seed: string;
  settings: GameSettings;
  players: Player[];
  activePlayerIndex: number;
  board: BoardTile[];
  phase: TurnPhase;

  diceValue: number | null;
  activeDare: DarePayload | null;
  activeMystery: MysteryEffect | null;
  bonusRollsUsedThisTurn: number;

  winnerPlayerId: string | null;
  turnNumber: number;
  eventMessage: string | null;
}
```

---

## 14. Suggested Reducer / Game Actions

Keep game rules separate from rendering.

```typescript
export type GameAction =
  | { type: 'CREATE_GAME'; payload: GameState }
  | { type: 'START_TURN' }
  | { type: 'ROLL_DICE'; value: number }
  | { type: 'MOVE_ONE_STEP' }
  | { type: 'RESOLVE_TILE' }
  | { type: 'RESOLVE_MYSTERY'; effect: MysteryEffect }
  | { type: 'START_DARE'; dare: DarePayload }
  | { type: 'RESOLVE_DARE'; passed: boolean }
  | { type: 'END_TURN' }
  | { type: 'DECLARE_WINNER'; playerId: string }
  | { type: 'REMATCH'; seed?: string };
```

The dice animation should generate a result once and pass that result to game state. Do not repeatedly generate random values during animation.

---

## 15. Board Rendering Requirements

1. Represent the visual path as a static array of tile coordinates.
2. The tile's path position (`id`) is independent from its screen coordinate (`gridX/gridY`).
3. Connect non-adjacent visual positions with subtle path lines/arrows if needed.
4. Tunnel and portal routes should be visually drawn over/under the board.
5. Pawns on the same tile must be offset so every pawn remains visible.
6. Board should scale responsively without changing tile order.
7. On small screens, allow the board container to scale/scroll instead of making tiles too small to read.

### Suggested Layer Order

```text
Background
→ Path connectors
→ Portal/tunnel graphics
→ Tiles
→ Pawns
→ Movement/effect animations
→ Modal overlays
```

---

## 16. Animation & Input Locking

### Pawn Movement

- Recommended step duration: `180–300 ms` per tile.
- Do not allow another dice roll during movement.
- Informational events appear as short notifications after movement and continue automatically.

### Tunnel / Portal

- Brief entrance animation.
- Animate along a curved path or fade-out/fade-in for MVP.
- Show a short event message, e.g. `"Shortcut! Move to 18"`.

### Reset

- Avoid replaying every tile in reverse.
- Use a quick "whoosh back to start" animation.

### Reduced Motion

Respect `prefers-reduced-motion` and replace long movement animations with short transitions.

---

## 17. UI Screens

### Screen A — Main Menu

- New Game
- How to Play
- Sound toggle

### Screen B — Player Setup

- Number of players (`2–4`)
- Player names
- Pawn colors/avatars
- Original Sketch / Random Party mode
- Physical dares on/off
- Start Game

### Screen C — Game Board

- Board
- Active player indicator
- Dice button / dice animation
- Player status chips (`Skip 1`, `Gate: Roll 1 or 2`)
- Recent event message
- Optional small turn-order panel

### Screen D — Event Feedback

Use a short auto-closing notification for:

- Mystery cards
- Gate result
- Portal/tunnel result
- Reset penalty

Use a modal only when input is required:

- Task completion: **Yes / No**
- Victory actions

### Screen E — Victory

- Winner name/avatar
- Number of turns
- `Play Again` — always generates a new seed and layout
- `Main Menu`

---

## 18. Local Save / Refresh Recovery

Because this is a pass-and-play browser game, accidental refresh should not destroy the match.

Persist `GameState` to `localStorage` after meaningful state changes.

On app load:

- If an unfinished game exists, show **Resume Game**.
- Do not restore the app in the middle of a movement animation; normalize to a stable phase (`ROLL_PENDING` or `RESOLVING_EVENT`).
- Clear saved state after the player intentionally starts a new game.

---

## 19. Sound & Feedback

Recommended simple audio cues:

- Dice roll
- Pawn step
- Tunnel/portal
- Positive reward
- Penalty
- Timer ticking during final 5 seconds
- Victory

Include mute control and persist the setting.

Use visual feedback as well; gameplay should never rely on sound alone.

---

## 20. Edge Cases That Must Be Defined

| Situation | MVP Behavior |
| :--- | :--- |
| Roll would pass Finish | Player wins; exact roll not required |
| Backward effect goes below 0 | Clamp to Tile 0 |
| Tunnel/portal sends player beyond Finish | Player wins |
| Destination tile is another special tile | Do not trigger it by default |
| Player lands on occupied tile | Both remain there |
| Player skips a turn while gate-locked | Skip first; no gate roll that turn |
| Dare fails near Start | Clamp movement at Tile 0 |
| Bonus roll lands on another bonus roll | Allow, max 2 bonus rolls per turn |
| Browser refreshed during game | Resume persisted stable state |
| Active dare is uncomfortable | Player may skip; treat as failed dare |
| All opponents tie on dare vote | Pass |

---

## 21. Fairness & Fun Guardrails

A party game can become frustrating quickly if setbacks dominate. Keep these guardrails:

- Reward/neutral tiles should outnumber punishment tiles.
- Avoid two resets in the first half of the board.
- Do not let a gate require only one exact number in MVP; `1 or 2` is less frustrating.
- Avoid more than two consecutive turns in which a player cannot meaningfully act.
- A reset-to-start effect should be rare and clearly telegraphed.
- Prefer funny setbacks over long lockouts.
- Keep tasks short: usually `10–30 seconds`.

---

## 22. Implementation Phases

### Phase 1 — Playable Core Board

**Goal:** Finish a complete match with only normal tiles.

- Project setup (React + TypeScript)
- Main menu + player setup
- Static winding board coordinates
- 2–4 pawns
- D6 roll
- Step-by-step pawn movement
- Active-player turns
- Finish detection
- Victory screen

**Done when:** 2–4 people can play from Start to Finish with no special events.

### Phase 2 — Original Special Mechanics

- Tunnel
- Portal
- Go to Starting Point / Reset
- Skip turn
- Gate / block
- Extra roll
- Event messages/animations

**Done when:** every non-dare special tile resolves correctly and turn order never breaks.

### Phase 3 — Tasks & Party Dares

- Dare repository
- Dare modal
- Timer
- Pass/fail voting
- Dare rewards/penalties
- No Physical Dares setting

**Done when:** every dare can start, resolve, and return to the correct player's turn flow.

### Phase 4 — Random Board Generation

- Tile distribution rules
- Fairness validation
- Random seed
- Same-board rematch
- New-board rematch

**Done when:** 100+ generated boards can be validated without illegal loops or invalid placements.

### Phase 5 — Polish & Resilience

- Responsive layout
- Sound effects
- Better pawn/tunnel/portal animation
- Local save + Resume Game
- Reduced-motion support
- How to Play screen
- Basic tests

---

## 23. Testing Checklist

### Game Logic

- [ ] Every dice result `1–6` moves the correct number of spaces.
- [ ] Only active player can roll.
- [ ] Movement cannot be triggered twice by double-clicking.
- [ ] Turn changes exactly once.
- [ ] Finish is detected after normal movement and forced movement.
- [ ] Reset returns to `0`.
- [ ] Skip turn decrements correctly.
- [ ] Gate accepts/rejects correct dice values.
- [ ] Bonus roll does not change active player.
- [ ] Bonus-roll cap works.
- [ ] Backward effects cannot create negative positions.
- [ ] Special destination event does not accidentally chain.

### Dares

- [ ] Timer starts only after Start Challenge.
- [ ] Active player cannot vote for themselves.
- [ ] Majority rule works for 3–4 players.
- [ ] Tie resolves as Pass.
- [ ] Failure penalty is clamped at Start.
- [ ] Physical-dare filter works.

### Board Generation

- [ ] Start and Finish are immutable.
- [ ] Safe zones contain no major punishment.
- [ ] No tunnel/portal cycles.
- [ ] All target tile IDs are valid.
- [ ] Reset count <= 2.
- [ ] Required event categories exist.

### UX

- [ ] Same-tile pawns remain visible.
- [ ] No input during animations.
- [ ] Refresh can resume the game.
- [ ] Mobile board remains usable.
- [ ] Sound can be muted.

---

## 24. Acceptance Criteria for Web MVP v1.0

The MVP is considered complete when:

1. 2–4 players can create a local game and finish it without page reload.
2. The winding board visually resembles the original paper-board concept.
3. Dice movement is animated one tile at a time.
4. Tunnel, portal, reset, gate/block, skip-turn, mystery/extra-roll, and dare mechanics work.
5. Game rules cannot enter an infinite event/portal loop.
6. A player can win by reaching or passing Finish.
7. Party tasks can be completed or skipped without breaking the game state.
8. The active player and current status effects are always visible.
9. A rematch can use the same board or generate a new one.
10. Core game state survives an accidental browser refresh.

---

## 25. Future Enhancements — Not Required for MVP

- Online multiplayer with rooms
- Mobile PWA install
- Custom user-created dare packs
- Difficulty presets: Family / Party / Chaos
- Power-up inventory
- Animated 3D dice
- Multiple board themes
- Alternate paths / player route choices
- Player statistics and match history
- AI-generated safe party tasks
- Team mode
- Board editor
- QR-code join for each player's phone as controller

---

## 26. Open Content Items From the Original Sketch

The game engine can be implemented immediately, but these content details from the handwritten board should remain editable until confirmed:

- Exact wording of several handwritten tasks.
- Exact source/destination tile numbers for the drawn portal.
- Exact source/destination tile numbers for the tunnel if the original paper layout must be reproduced precisely.
- Whether every handwritten task should remain fixed in `ORIGINAL_SKETCH` mode.

These are content/configuration questions, not architecture blockers. They should be stored in board/dare configuration files rather than hard-coded into the engine.
