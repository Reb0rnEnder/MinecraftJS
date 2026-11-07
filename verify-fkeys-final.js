// verify-fkeys-final.js — test F+number key combination for F1-F9
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const url = 'file:///C:/Users/Nicholas/Documents/Downloads/New%20folder%20(5)/dist/minecraftjs.html';
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  
  let booted = false;
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await page.evaluate(() => ({
      game: typeof window.game !== 'undefined',
      screen: typeof window.game !== 'undefined' ? String(window.game.screens?.current?.constructor?.name || '(none)') : null,
      loading: (document.getElementById('loading') || {}).style?.display,
      canvases: document.querySelectorAll('canvas').length,
    }));
    console.log(`${((Date.now() - t0) / 1000).toFixed(0)}s:`, JSON.stringify(s));
    if (s.game && s.screen && s.screen !== 'null') { break; }
    if (i === 17) console.log('boot timeout:', JSON.stringify(s));
  }

  await new Promise(r => setTimeout(r, 3000));
  await page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-title-final.png', scale: 'css' });
  console.log('title screenshot saved');

  // Test F+1 -> F1
  console.log('Testing F+1 -> F1...');
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('KeyF');
  await new Promise(r => setTimeout(r, 1000));
  
  const state1 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+1:', JSON.stringify(state1));
  
  await new Promise(r => setTimeout(r, 2000));

  // Test F+2 -> F2
  console.log('Testing F+2 -> F2...');
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit2');
  await page.keyboard.up('KeyF');
  await new Promise(r => setTimeout(r, 1000));

  const state2 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+2:', JSON.stringify(state2));

  await new Promise(r => setTimeout(r, 2000));

  // Test F+3 -> F3
  console.log('Testing F+3 -> F3...');
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit3');
  await page.keyboard.up('KeyF');
  await new Promise(r => setTimeout(r, 1000));

  const state3 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+3:', JSON.stringify(state3));

  await new Promise(r => setTimeout(r, 2000));

  // Screenshot
  await page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-fkeys-final.png', scale: 'css' });
  console.log('F-key test screenshots saved');
  
  await browser.close();
})();