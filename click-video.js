await state.page.mouse.click(394, 347);
await state.page.waitForTimeout(2000);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-3-video.png', scale: 'css' });
// Scroll the video list a bit to show more rows.
await state.page.mouse.wheel(0, 240);
await state.page.waitForTimeout(800);
await state.page.screenshot({ path: 'C:/Users/Nicholas/Documents/Downloads/New folder (5)/shot-3b-video-scrolled.png', scale: 'css' });
console.log('video settings screenshots saved');
