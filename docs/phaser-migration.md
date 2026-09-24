# Phaser migration

The React SVG map was removed. `Valley` is now a lifecycle bridge: lazy-load the browser-only engine, create one Phaser Game, pass current state/callbacks by reference, and destroy the engine on unmount. Phaser is pinned to 3.90.0; upgrading major versions should be a separate compatibility change.

- Persistent ground, trees and buildings; terrain rebuilt on seed/unlock changes.
- Camera transform handles world picking, drag threshold, mouse zoom, touch pinch, keyboard panning and resize.
- Image-margin hit bugs are avoided by manifest polygons in texture coordinates.
- Animated images use Phaser animation frames, not CSS on the old SVG world. Known legacy SVG classes are baked into twelve poses. Custom artists can supply sprite sheets.
- Worker positions/cargo/chopping use authoritative job timestamps; no gameplay timers are replaced by presentation tweens.
- Tree fall uses Phaser tweens. Belts animate only when their source has rotation. Fog and route/placement overlays retain the existing rules.
- React retains menus and accessible controls, including the five-step tutorial and building guides. In-world canvas selection is pointer-driven; keyboard controls support camera and placement.
- Reduced motion disables decorative animation while cargo still moves to reflect simulation.
- Existing save and economics schemas are unchanged. Standalone local storage is a development convenience; the proxy preserves the Bitter API contract.

Validation includes unit tests, production builds and browser checks. Desktop WebGL was observed at approximately 60 FPS in a small initial colony, which is not a benchmark for large colonies or physical phones. Responsive layout was checked at 390×844. A real-device multitouch/performance pass remains useful before mobile release.
