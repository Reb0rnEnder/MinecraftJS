// verify-full-play.js — comprehensive menu navigation test
state.page = await context.newPage();
const url = 'file:///C:/Users/Nicholas/Documents/Downloads/New%20folder%20(5)/dist/minecraftjs.html';
const t0 = Date.now();
await state.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

// Wait for title screen
let booted = false;
for (let i = 0; i < 24; i++) {
  await state.page.waitForTimeout(5000);
  const s = await state.page.evaluate(() => ({
    game: typeof window.game !== 'undefined',
    screen: typeof window.game !== 'undefined' ? String(window.game.screens?.current?.constructor?.name || '(none)') : null,
    loading: (document.getElementById('loading') || {}).style?.display,
    canvases: document.querySelectorAll('canvas').length,
  }));
  console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s:`, JSON.stringify(s));
  if (s.game && s.screen && s.screen !== 'null') { break; }
}

// Take screenshot of title screen
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-title-final.png', scale: 'css' });

// Click Options (center-bottom-ish)
await state.page.mouse.click(484, 605);
await state.page.waitForTimeout(2000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-options.png', scale: 'css' });

// Click Video Settings
await state.page.mouse.click(394, 347);
await state.page.waitForTimeout(2000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-video.png', scale: 'css' });

// Scroll video settings
await state.page.mouse.wheel(0, 240);
await state.page.waitForTimeout(500);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-video-scroll.png', scale: 'css' });

// Back to Options (Done button - bottom right area)
await state.page.mouse.click(944, 645);
await state.page.waitForTimeout(2000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-options-back.png', scale: 'css' });

// Click Controls...
await state.page.mouse.click(484, 445);
await state.page.waitForTimeout(2000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-controls.png', scale: 'css' });

// Back (Done)
await state.page.mouse.click(944, 645);
await state.page.waitForTimeout(1500);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-back-from-controls.png', scale: 'css' });

// Click Singleplayer
await state.page.mouse.click(484, 345);
await state.page.waitForTimeout(3000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-singleplayer.png', scale: 'css' });

// Check if we're in singleplayer screen
const sp = await state.page.evaluate(() => ({
  screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
  game: typeof window.game !== 'undefined',
}));
console.log('singleplayer state:', JSON.stringify(sp));

// Final screenshot
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/final-verify.png', scale: 'css' });

console.log('DONE');