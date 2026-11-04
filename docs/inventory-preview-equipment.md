# Inventory player equipment

The old inventory preview created only a standalone skin model. It did not attach the existing native armor, held-item or head-item layers, so those could not appear regardless of texture preloading.

The GUI now uses a separate equipment visual with the existing version-specific armor/held/head render helpers and native inventory slot order. It updates when items change, retains dedicated inventory lighting, and clears stale attachments. Main/offhand poses respect the primary-hand setting on versions with dual wielding. The 1.8.9 variant keeps its native right-hand-only behavior; no shields/offhand feature is introduced there.

A related CPU optimization skips animation/copy/sync of the leather-overlay model when wearing non-leather armor, where that overlay is already hidden. Switching back to leather updates it normally. This changes CPU work, not visible armor or draw counts; it is not a measured whole-frame FPS claim.

Native references: cached exact target inventory classes `azc` (1.8.9), `bmx` (1.12.2), `clp` (1.13.2), `deb` (1.14.4), `dhr` (1.15.2), `dql` (1.16.5), `ecj` (1.17.1), `efq` (1.18.2), and pinned 1.19.4 `InventoryScreen` (`eva`). These dispatch rendering of the actual living player with shadows disabled rather than rendering a skin-only model. The established per-version GUI transforms and inventory light modes are retained.

`test-inventory-preview-equipment.mjs` checks visible native armor materials, both applicable hands, primary-hand changes, removal of stale equipment, GUI lighting, and skipping/re-enabling hidden overlay animation. Existing chest/inventory lighting checks pass on all nine targets. Full reference-client screenshot parity, elytra/cape layers and equipment glint remain separate review items; this batch does not claim those gates have passed.
