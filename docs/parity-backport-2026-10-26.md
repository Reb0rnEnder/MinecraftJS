# 1.12.2 parity backport — 2026-10-26

Melee prediction now uses the 1.9+ Sharpness damage contribution: zero without the enchantment, otherwise 0.5 × level + 0.5, multiplied by attack strength. This matches the corresponding 1.13.2/1.14.4 correction. The server remains authoritative for damage.

Validation: 63 regression tests pass, one optional external-endpoint test is skipped. The crash-screen browser regression also passes with Playwright supplied through PLAYWRIGHT_MODULE. No 1.14 features were added. Minecraft 1.8.9 retains its distinct native 1.25-per-level behavior.
