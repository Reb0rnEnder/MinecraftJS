// verify-final2.js
state.page = await context.newPage();
await state.page.goto('file:///C:/Users/Nicholas/Documents/Downloads/New%20folder%20(5)/dist/minecraftjs.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
let booted = false;
for (let i = 0; i < 18; i++) {
  await state.page.waitForTimeout(5000);
  const s = await state.page.evaluate(() => ({
    game: typeof window.game !== 'undefined',
    screen: typeof window.game !== 'undefined' ? String(window.game.screens?.current?.constructor?.name || '(none)') : null,
    device: typeof window.game !== 'undefined' ? String(window.game.device?.name) : null,
    splashGone: !document.getElementById('loading') || document.getElementById('loading').style.display === 'none',
  }));
  if (s.game && s.screen && s.screen !== 'null') { booted = true; console.log('BOOTED at ' + ((i + 1) * 5) + 's:', JSON.stringify(s)); break; }
  if (i === 17) console.log('boot timeout:', JSON.stringify(s));
}
if (!booted) {
  const logs = await getLatestLogs({ page: state.page, count: 40 });
  console.log('LOGS:', JSON.stringify(logs));
}
await state.page.waitForTimeout(4000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-1-title.png', scale: 'css' });
console.log('title screenshot saved');
