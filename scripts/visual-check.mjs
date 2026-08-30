import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
});

await mkdir('test-results', { recursive: true });

async function inspect(viewport, label) {
  const page = await browser.newPage({ viewport });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.screenshot({ path: `test-results/${label}-setup.png`, fullPage: true });

  const setupMetrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    playerChoices: document.querySelectorAll('.home-player-select .segmented button').length,
    primaryActions: document.querySelectorAll('.home-play-button').length,
    drawingRemoved: document.querySelector('.sketch-image-wrap') === null,
  }));

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Roll dice' }).waitFor();
  const gameMetrics = await page.evaluate(() => ({
    tileCount: document.querySelectorAll('.tile').length,
    playerCount: document.querySelectorAll('.player-chip').length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    boardScrolls: (document.querySelector('.board-scroll')?.scrollWidth ?? 0) > (document.querySelector('.board-scroll')?.clientWidth ?? 0),
    randomMode: document.querySelector('.game-meta')?.textContent?.includes('Random') ?? false,
  }));
  await page.screenshot({ path: `test-results/${label}-game.png`, fullPage: true });

  await page.getByRole('button', { name: 'Roll dice' }).click();
  const lockedDuringRoll = await page.getByRole('button', { name: /Moving|Resolving/ }).isDisabled();
  await page.waitForTimeout(2200);
  const pawnPosition = await page.locator('.player-chip').first().locator('small').textContent();

  await page.close();
  return { label, setupMetrics, gameMetrics, lockedDuringRoll, pawnPosition };
}

const results = [];
results.push(await inspect({ width: 1440, height: 1000 }, 'desktop'));
results.push(await inspect({ width: 390, height: 844 }, 'mobile'));
console.log(JSON.stringify(results, null, 2));

await browser.close();
