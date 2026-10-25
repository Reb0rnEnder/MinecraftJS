# Mesh snapshot ordering — 2026-10-25

Worker replies now carry the build token of their source snapshot. A reply from
an older or retried job cannot clear a newer in-flight build or overwrite its
geometry. World generations are checked before touching current in-flight state.
A section dirtied during a build remains queued, and that obsolete snapshot is
discarded until a fresh build completes. Unload also releases the associated
in-flight/token entries.

The same engine safeguard is applied to 1.8.9, 1.12.2, 1.13.2 and 1.14.4. No
newer packet layouts or game content are backported. Regression tests drive the
production worker callback with out-of-order jobs, an older world generation,
and a newly dirtied section. Run `node tools/test-worker-snapshots.mjs`.
