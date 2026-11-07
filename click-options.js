await state.page.mouse.click(484, 605);
await state.page.waitForTimeout(2500);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-2-options.png', scale: 'css' });
const s = await state.page.evaluate(() => ({
  screen: String(window.game?.screens?.current?.constructor?.name || '(minified)'),
  canvas: document.querySelectorAll('canvas').length,
}));
console.log('after Options click:', JSON.stringify(s));
