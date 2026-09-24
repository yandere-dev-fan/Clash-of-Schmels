# Validation — 2026-09-24

- 17 tests pass: production/transport/power, finite trees, random rivers on 64 seeds, era gates, migration, offline behavior, isometric picking/flight interpolation, durable local saves and receipt replay after restart, cookie/Origin/receipt forwarding and upstream authorization denial.
- TypeScript checks pass. Next production build passes; Phaser is browser-only and lazy-loaded.
- Browser: actual WebGL canvas, approximately 60 FPS in the small test colony; accurate visible-tree selection; manual chopping returns 25 wood after the full trip; free first brood starts with its 15-second timer. Existing Bitter colony also rendered successfully with its current progress.
- Independent local test colony used for gameplay mutations. No live player save is included in this repository.
- Responsive HUD and scene checked at 390×844; camera resizing, zoom and selection checked through browser UI. Physical-device multitouch/performance is not certified by desktop emulation.
- Runtime data, environment files, dependency/build directories and private backups are excluded by Git.
