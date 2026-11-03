// BrowserPlatform - updated with F+1..F9 support
// ... existing code with F-key tracking in on_key_down/on_key_up

// In on_key_down:
if (code === 'KeyF') { this.f_key_held = true; }
if (this.f_key_held && code.startsWith('Digit') && code.length === 6) {
    const n = parseInt(code[5], 10);
    if (n >= 1 && n <= 9) { code = 'F' + n; key = 'F' + n; }
}

// In on_key_up:
if (code === 'KeyF') { this.f_key_held = false; }
