const { test } = require('@playwright/test');

test('F+number keys work for F1-F9', async ({ page }) => {
  await page.goto('file:///C:/Users/Nicholas/Documents/Downloads/New folder (5)/dist/minecraftjs.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  
  // Wait for boot
  await page.waitForTimeout(10000);
  
  // Test F+1 -> F1
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit1');
  await page.keyboard.up('KeyF');
  await page.waitForTimeout(1000);
  
  const state1 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+1:', JSON.stringify(state1));
  
  await page.waitForTimeout(1000);
  
  // Test F+2 -> F2
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit2');
  await page.keyboard.up('KeyF');
  await page.waitForTimeout(1000);
  
  const state2 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+2:', JSON.stringify(state2));
  
  await page.waitForTimeout(1000);
  
  // Test F+3 -> F3
  await page.keyboard.down('KeyF');
  await page.keyboard.press('Digit3');
  await page.keyboard.up('KeyF');
  await new Promise(r => setTimeout(r, 1000));
  
  const state3 = await page.evaluate(() => ({
    screen: String(window.game?.screens?.current?.constructor?.name || '(none)'),
    game: typeof window.game !== 'undefined',
  }));
  console.log('After F+3:', JSON.stringify(state3));
  
  await page.screenshot({ path: 'shot-fkeys-test.png', scale: 'css' });
  console.log('Screenshot saved');
});