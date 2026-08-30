import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});
const baseUrl = process.env.BASE_URL ?? 'http://localhost:5173/boardGame/';

await mkdir('test-results', { recursive: true });

async function inspect(viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `test-results/${label}-setup.png`, fullPage: true });

  const setupMetrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    playerChoices: document.querySelectorAll('.home-player-select .segmented button').length,
    primaryActions: document.querySelectorAll('.home-play-button').length,
    drawingRemoved: document.querySelector('.sketch-image-wrap') === null,
    credit: document.querySelector('.home-credit')?.textContent,
  }));

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Roll dice' }).waitFor();
  const gameMetrics = await page.evaluate(() => ({
    tileCount: document.querySelectorAll('.tile').length,
    playerCount: document.querySelectorAll('.pawn').length,
    playerStripRemoved: document.querySelector('.player-strip') === null,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    boardScrolls: (document.querySelector('.board-scroll')?.scrollWidth ?? 0) > (document.querySelector('.board-scroll')?.clientWidth ?? 0),
    compactHud: document.querySelector('.hud-actions') !== null,
    boardFitsViewport: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
    randomMode: document.querySelector('.game-meta')?.textContent?.includes('Random') ?? 'hidden in compact HUD',
  }));
  await page.screenshot({ path: `test-results/${label}-game.png`, fullPage: true });

  await page.evaluate(() => { Math.random = () => 0.5; });
  await page.getByRole('button', { name: 'Roll dice' }).click();
  const lockedDuringRoll = await page.getByRole('button', { name: /Moving|Resolving/ }).isDisabled();
  await page.locator('.event-toast').waitFor();
  const pawnPosition = await page.locator('.event-log strong').textContent();
  const startRuleText = await page.locator('.event-toast').evaluate((toast) => ({
    title: toast.querySelector('strong')?.textContent,
    detail: toast.querySelector('p')?.textContent,
    hasButton: toast.querySelector('button') !== null,
  }));
  const startPawnCount = await page.locator('.tile-start .pawn').count();
  await page.screenshot({ path: `test-results/${label}-start-notification.png`, fullPage: true });
  await page.locator('.event-toast').waitFor({ state: 'detached' });
  const startNotificationAutoClosed = await page.locator('.event-toast').count() === 0;

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('blocks-and-tasks-game-v1'));
    state.activePlayerIndex = 0;
    state.phase = 'ROLL_PENDING';
    state.players = state.players.map((player, index) => ({ ...player, currentTileId: index === 0 ? 5 : 0, gateLock: null }));
    state.board[6] = { ...state.board[6], type: 'PARTY_DARE', label: 'Task', dareId: 'robot' };
    localStorage.setItem('blocks-and-tasks-game-v1', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole('button', { name: 'Roll dice' }).click();
  await page.locator('.task-result-buttons').waitFor();
  const taskPrompt = await page.locator('.modal').evaluate((modal) => ({
    title: modal.querySelector('h2')?.textContent,
    detail: modal.querySelector('.dare-detail')?.textContent,
    question: modal.querySelector('.task-complete-label')?.textContent,
    actions: [...modal.querySelectorAll('.task-result-buttons button')].map((button) => button.textContent?.trim()),
  }));
  await page.screenshot({ path: `test-results/${label}-task.png`, fullPage: true });
  await page.getByRole('button', { name: 'Yes', exact: true }).click();
  await page.locator('.modal').waitFor({ state: 'detached' });
  const taskClosedAfterOneAnswer = await page.locator('.modal').count() === 0;

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('blocks-and-tasks-game-v1'));
    state.activePlayerIndex = 0;
    state.phase = 'ROLL_PENDING';
    state.winnerPlayerId = null;
    state.players = state.players.map((player) => ({ ...player, currentTileId: 0, gateLock: null }));
    state.board[6] = { ...state.board[6], type: 'MYSTERY', label: 'Mystery' };
    localStorage.setItem('blocks-and-tasks-game-v1', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => { Math.random = () => 0.9; });
  await page.getByRole('button', { name: 'Roll dice' }).click();
  await page.locator('.event-toast').waitFor();
  const kidEventText = await page.locator('.event-toast').evaluate((toast) => ({
    title: toast.querySelector('strong')?.textContent,
    detail: toast.querySelector('p')?.textContent,
    hasButton: toast.querySelector('button') !== null,
  }));
  await page.screenshot({ path: `test-results/${label}-kid-event.png`, fullPage: true });
  await page.locator('.event-toast').waitFor({ state: 'detached' });
  const kidEventAutoClosed = await page.locator('.event-toast').count() === 0;

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('blocks-and-tasks-game-v1'));
    state.activePlayerIndex = 0;
    state.phase = 'ROLL_PENDING';
    state.winnerPlayerId = null;
    state.players = state.players.map((player, index) => ({ ...player, points: 0, currentTileId: index === 0 ? 32 : 0, gateLock: null }));
    localStorage.setItem('blocks-and-tasks-game-v1', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => { Math.random = () => 0; });
  await page.getByRole('button', { name: 'Roll dice' }).click();
  await page.locator('.victory-title').waitFor();
  const winPointsText = await page.locator('.points-award').innerText();
  await page.screenshot({ path: `test-results/${label}-victory.png`, fullPage: true });

  await page.close();
  return { label, setupMetrics, gameMetrics, lockedDuringRoll, pawnPosition, startRuleText, startPawnCount, startNotificationAutoClosed, taskPrompt, taskClosedAfterOneAnswer, kidEventText, kidEventAutoClosed, winPointsText };
}

const results = [];
results.push(await inspect({ width: 1440, height: 1000 }, 'desktop'));
results.push(await inspect({ width: 390, height: 844 }, 'mobile'));
results.push(await inspect({ width: 844, height: 390 }, 'mobile-landscape'));
console.log(JSON.stringify(results, null, 2));

await browser.close();
