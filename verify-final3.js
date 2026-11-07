// verify-final3.js — full log dump + error hunt.
const logs = await getLatestLogs({ page: state.page, count: 100 });
console.log('ALL LOGS (' + logs.length + '):');
logs.forEach(l => console.log(' ', l.slice(0, 160)));
const s = await state.page.evaluate(() => ({
  assetsLoadDone: typeof window.__assetsLoaded !== 'undefined' ? window.__assetsLoaded : 'n/a',
  game: typeof window.game !== 'undefined',
  workers: 'n/a',
}));
console.log('state:', JSON.stringify(s));
