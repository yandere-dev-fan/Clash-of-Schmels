import * as Phaser from "phaser";
import {
  BUILDINGS,
  MAP_SIZE,
  center,
  headquarters,
  discovered,
  terrain,
  noise,
  index,
  footprint,
  placementError,
  production,
  networks,
} from "@/lib/bee";
import type { Pack, Asset } from "../Artwork";
import { point, cell, sample, lerp, type ValleyProps } from "./model";

type Sprite = Phaser.GameObjects.Sprite;
type Target = { tile?: number; building?: number };
type AnimatedAsset = Asset & {
  sheet?: {
    src: string;
    frameWidth: number;
    frameHeight: number;
    endFrame: number;
    frameRate?: number;
  };
};
const FALLBACK_SHAPE = [
  [-0.4, 0],
  [-0.38, -0.7],
  [0, -0.82],
  [0.38, -0.7],
  [0.4, 0],
  [0, 0.13],
];
/** Persistent GPU objects; simulation stays authoritative and renderer-independent. */
export class ColonyScene extends Phaser.Scene {
  private pack: Pack;
  private read: () => ValleyProps;
  private onReady: () => void;
  private loaded = false;
  private groundKey = "";
  private buildingsKey = "";
  private linksKey = "";
  private ground: Phaser.GameObjects.GameObject[] = [];
  private trees = new Map<number, Sprite>();
  private structures: Phaser.GameObjects.GameObject[] = [];
  private buildingSprites = new Map<number, Sprite>();
  private workers = new Map<string, Phaser.GameObjects.Container>();
  private routeObjects: Phaser.GameObjects.GameObject[] = [];
  private routeMotion: Phaser.GameObjects.TileSprite[] = [];
  private overlay!: Phaser.GameObjects.Graphics;
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private progress!: Phaser.GameObjects.Graphics;
  private waypointLabels: Phaser.GameObjects.Text[] = [];
  private ghost?: Sprite;
  private hover: Target | null = null;
  private drag?: {
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
    target: Target | null;
  };
  private pinch?: { distance: number; zoom: number };
  private suppressTap = false;
  private reduced = false;
  private blobUrls: string[] = [];
  constructor(read: () => ValleyProps, pack: Pack, onReady: () => void) {
    super("Colony");
    this.read = read;
    this.pack = pack;
    this.onReady = onReady;
  }
  preload() {
    for (const [key, raw] of Object.entries(this.pack.assets)) {
      const a = raw as AnimatedAsset,
        url = `/bee/assets/${a.src}?v=${encodeURIComponent(this.pack.version)}`;
      if (a.src.endsWith(".svg"))
        this.load.svg(key, url, { width: a.width * 2, height: a.height * 2 });
      else this.load.image(key, url);
      if (a.sheet)
        this.load.spritesheet(
          key + ":sheet",
          `/bee/assets/${a.sheet.src}?v=${encodeURIComponent(this.pack.version)}`,
          a.sheet,
        );
      else if (a.activeSrc?.endsWith(".svg"))
        this.load.text(
          key + ":source",
          `/bee/assets/${a.activeSrc}?v=${encodeURIComponent(this.pack.version)}`,
        );
      else if (a.activeSrc)
        this.load.image(
          key + ":active",
          `/bee/assets/${a.activeSrc}?v=${encodeURIComponent(this.pack.version)}`,
        );
    }
  }
  create() {
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // SVG CSS cannot animate a GPU texture. Bake explicit poses, then let Phaser play frames.
    for (const [key, a] of Object.entries(this.pack.assets)) {
      const svg = this.cache.text.get(key + ":source") as string | undefined;
      if (!svg) continue;
      for (let f = 0; f < 12; f++) {
        const xml = new DOMParser().parseFromString(svg, "image/svg+xml");
        xml.querySelectorAll("style").forEach((s) => s.remove());
        const phase = f / 12,
          wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
        xml.querySelectorAll("[class]").forEach((el) => {
          const cls = el.getAttribute("class") ?? "",
            style = el.getAttribute("style") ?? "";
          const origin = style.match(
            /transform-origin:\s*([\d.]+)px\s+([\d.]+)px/,
          );
          const ox = origin ? Number(origin[1]) : 17,
            oy = origin ? Number(origin[2]) : 11;
          let transform = "";
          if (/gear|wheel/.test(cls))
            transform = `rotate(${phase * 360} ${ox} ${oy})`;
          if (/piston/.test(cls)) transform = `translate(0 ${wave * 10})`;
          if (/pumpArm/.test(cls))
            transform = `rotate(${-9 + wave * 19} ${ox} ${oy})`;
          if (/flowerSway/.test(cls))
            transform = `rotate(${wave * 5} ${ox} ${oy})`;
          if (/wing/.test(cls))
            transform = `translate(${ox} ${oy}) scale(1 ${1 - wave * 0.55}) translate(${-ox} ${-oy})`;
          if (/steam/.test(cls)) {
            transform = `translate(0 ${3 - phase * 20})`;
            el.setAttribute("opacity", String(Math.sin(phase * Math.PI) * 0.8));
          }
          if (/breathe/.test(cls))
            el.setAttribute("opacity", String(1 - wave * 0.35));
          if (/hiveGlow/.test(cls))
            el.setAttribute("fill", wave > 0.5 ? "#b78035" : "#76582f");
          if (/beltMotion/.test(cls))
            el.setAttribute("stroke-dashoffset", String(-phase * 16));
          el.removeAttribute("style");
          if (transform)
            el.setAttribute(
              "transform",
              (el.getAttribute("transform") ?? "") + " " + transform,
            );
        });
        const url = URL.createObjectURL(
          new Blob([new XMLSerializer().serializeToString(xml)], {
            type: "image/svg+xml",
          }),
        );
        this.blobUrls.push(url);
        this.load.svg(`${key}:frame:${f}`, url, {
          width: a.width * 2,
          height: a.height * 2,
        });
      }
    }
    const start = () => {
      for (const [key, raw] of Object.entries(this.pack.assets)) {
        const a = raw as AnimatedAsset;
        if (a.sheet && this.textures.exists(key + ":sheet"))
          this.anims.create({
            key: key + ":run",
            frames: this.anims.generateFrameNumbers(key + ":sheet", {
              start: 0,
              end: a.sheet.endFrame,
            }),
            frameRate: a.sheet.frameRate ?? 12,
            repeat: -1,
          });
        else if (this.textures.exists(key + ":frame:0"))
          this.anims.create({
            key: key + ":run",
            frames: Array.from({ length: 12 }, (_, f) => ({
              key: `${key}:frame:${f}`,
            })),
            frameRate: key.startsWith("bee.")
              ? 60
              : key === "building.waterwheel"
                ? 4
                : 8,
            repeat: -1,
          });
      }
      this.blobUrls.forEach((u) => URL.revokeObjectURL(u));
      this.blobUrls = [];
      this.add
        .tileSprite(0, 900, 8000, 6500, this.texture("terrain.forest"))
        .setDepth(-1000);
      this.routeGraphics = this.add.graphics().setDepth(-50);
      this.overlay = this.add.graphics().setDepth(9000);
      this.progress = this.add.graphics().setDepth(9001);
      this.cameras.main.setZoom(this.scale.width < 650 ? 0.79 : 1.05);
      this.home(false);
      this.scale.on(
        "resize",
        (
          size: Phaser.Structs.Size,
          _base: unknown,
          _display: unknown,
          oldWidth: number,
          oldHeight: number,
        ) => {
          const c = this.cameras.main;
          c.setScroll(
            c.scrollX + (oldWidth - size.width) / 2,
            c.scrollY + (oldHeight - size.height) / 2,
          );
        },
      );
      this.setupInput();
      this.loaded = true;
      this.onReady();
      this.game.canvas.dataset.renderer =
        this.game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas";
      this.game.canvas.setAttribute("aria-label", "Долина Clash of Schmels");
      this.events.once("shutdown", () =>
        this.blobUrls.forEach((u) => URL.revokeObjectURL(u)),
      );
    };
    if (this.load.totalToLoad) {
      this.load.once("complete", start);
      this.load.start();
    } else start();
  }
  private texture(key: string) {
    return this.textures.exists(key)
      ? key
      : this.textures.exists("effect.missing")
        ? "effect.missing"
        : "__MISSING";
  }
  private art(
    key: string,
    x: number,
    y: number,
    width: number,
    depth: number,
    active = false,
  ): Sprite {
    const a: Asset = this.pack.assets[key] ?? {
      src: "",
      width: 48,
      height: 48,
    };
    const s = this.add
      .sprite(x, y, this.texture(key))
      .setDisplaySize(width, (width * a.height) / a.width)
      .setOrigin(
        (a.anchor?.x ?? a.width / 2) / a.width,
        (a.anchor?.y ?? a.height) / a.height,
      )
      .setDepth(depth);
    s.setData("asset", key);
    s.setData("baseWidth", width);
    this.animate(s, active);
    return s;
  }
  private animate(s: Sprite, active: boolean) {
    const key = s.getData("asset") as string;
    if (active && !this.reduced && this.anims.exists(key + ":run")) {
      if (!s.anims.isPlaying) s.play(key + ":run");
    } else {
      if (s.anims.isPlaying) s.stop();
      const texture =
        active && this.textures.exists(key + ":active")
          ? key + ":active"
          : this.texture(key);
      if (s.texture.key !== texture) s.setTexture(texture);
    }
    const a = this.pack.assets[key],
      width = s.getData("baseWidth");
    if (a && width) s.setDisplaySize(width, (width * a.height) / a.width);
    if (s.input && s.getData("hitWidth") !== s.frame.realWidth)
      this.hit(s, s.getData("target"));
  }
  private hit(s: Sprite, target: Target) {
    const key = s.getData("asset") as string,
      a = this.pack.assets[key]!;
    const shape = a.hitArea ?? FALLBACK_SHAPE;
    const w = s.frame.realWidth,
      h = s.frame.realHeight,
      ax = (a.anchor?.x ?? a.width / 2) / a.width,
      ay = (a.anchor?.y ?? a.height) / a.height;
    const polygon = new Phaser.Geom.Polygon(
      shape.map(([x, y]) => ({ x: ax * w + x! * w, y: ay * h + y! * w })),
    );
    if (s.input) s.input.hitArea = polygon;
    else s.setInteractive(polygon, Phaser.Geom.Polygon.Contains);
    s.setData("hitWidth", w);
    s.setData("target", target);
  }
  private setupInput() {
    this.input.setTopOnly(true);
    this.input.on("gameobjectover", (_p: Phaser.Input.Pointer, obj: Sprite) => {
      this.hover = obj.getData("target") ?? null;
      this.input.setDefaultCursor("pointer");
    });
    this.input.on("gameobjectout", () => {
      this.hover = null;
      this.input.setDefaultCursor("grab");
    });
    this.input.on(
      "pointerdown",
      (p: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
        if (p.button > 0) return;
        const down = this.input.manager.pointers.filter((p) => p.isDown);
        if (down.length >= 2) {
          const [a, b] = down;
          this.pinch = {
            distance: Phaser.Math.Distance.Between(a!.x, a!.y, b!.x, b!.y),
            zoom: this.cameras.main.zoom,
          };
          this.drag = undefined;
          this.suppressTap = true;
          return;
        }
        const c = this.cameras.main;
        this.drag = {
          id: p.id,
          x: p.x,
          y: p.y,
          cx: c.scrollX,
          cy: c.scrollY,
          moved: false,
          target: objects[0]?.getData("target") ?? null,
        };
      },
    );
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const down = this.input.manager.pointers.filter((p) => p.isDown);
      if (this.pinch && down.length >= 2) {
        const [a, b] = down;
        this.cameras.main.setZoom(
          Phaser.Math.Clamp(
            (this.pinch.zoom *
              Phaser.Math.Distance.Between(a!.x, a!.y, b!.x, b!.y)) /
              Math.max(1, this.pinch.distance),
            0.4,
            1.8,
          ),
        );
        return;
      }
      const d = this.drag;
      if (!d || d.id !== p.id || !p.isDown) return;
      const dx = p.x - d.x,
        dy = p.y - d.y;
      if (Math.hypot(dx, dy) > 6) d.moved = true;
      if (d.moved) {
        this.cameras.main.setScroll(
          d.cx - dx / this.cameras.main.zoom,
          d.cy - dy / this.cameras.main.zoom,
        );
        this.clampCamera();
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (this.suppressTap) {
        if (!this.input.manager.pointers.some((p) => p.isDown)) {
          this.pinch = undefined;
          this.suppressTap = false;
        }
        this.drag = undefined;
        return;
      }
      const d = this.drag;
      this.drag = undefined;
      if (!d || d.id !== p.id || d.moved) return;
      const props = this.read(),
        world = this.cameras.main.getWorldPoint(p.x, p.y),
        tile = cell(world.x, world.y);
      if (tile.x < 0 || tile.y < 0 || tile.x >= MAP_SIZE || tile.y >= MAP_SIZE)
        return;
      if (props.placement) {
        props.onPlacement(tile.x, tile.y);
        return;
      }
      if (d.target?.building !== undefined) {
        props.onSelect(d.target.building);
        return;
      }
      if (d.target?.tile !== undefined) {
        props.onTile(d.target.tile);
        return;
      }
      const t = index(tile.x, tile.y),
        b = props.state.buildings.find((b) => footprint(b).includes(t));
      if (b) props.onSelect(b.id);
      else props.onTile(t);
    };
    this.input.on("pointerup", up);
    this.input.on("pointerupoutside", () => {
      this.drag = undefined;
      this.pinch = undefined;
      this.suppressTap = false;
    });
    this.input.on(
      "wheel",
      (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) =>
        this.zoomBy(dy > 0 ? 0.92 : 1.08, p),
    );
    this.game.events.on("blur", () => {
      this.drag = undefined;
      this.pinch = undefined;
      this.suppressTap = false;
    });
  }
  private clampCamera() {
    const c = this.cameras.main;
    c.scrollX = Phaser.Math.Clamp(c.scrollX, -1800, 1400);
    c.scrollY = Phaser.Math.Clamp(c.scrollY, -400, 1800);
  }
  zoomBy(factor: number, p?: Phaser.Input.Pointer) {
    if (!this.loaded) return;
    const c = this.cameras.main,
      x = p?.x ?? c.width / 2,
      y = p?.y ?? c.height / 2,
      before = c.getWorldPoint(x, y);
    c.setZoom(Phaser.Math.Clamp(c.zoom * factor, 0.4, 1.8));
    c.preRender();
    const after = c.getWorldPoint(x, y);
    c.scrollX += before.x - after.x;
    c.scrollY += before.y - after.y;
    this.clampCamera();
  }
  home(smooth = true) {
    const p = center(headquarters(this.read().state)),
      v = point(p.x, p.y),
      c = this.cameras.main;
    if (smooth && !this.reduced) c.pan(v.x, v.y, 300, "Sine.easeOut");
    else c.centerOn(v.x, v.y);
  }
  nudge(key: string) {
    const c = this.cameras.main;
    c.scrollX +=
      (key === "ArrowRight" ? 55 : key === "ArrowLeft" ? -55 : 0) / c.zoom;
    c.scrollY +=
      (key === "ArrowDown" ? 55 : key === "ArrowUp" ? -55 : 0) / c.zoom;
  }
  private diamond(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    size: number,
    color: number,
    alpha = 0.2,
  ) {
    const pts = [
      { x, y: y - 22 * size },
      { x: x + 38 * size, y },
      { x, y: y + 22 * size },
      { x: x - 38 * size, y },
    ];
    g.fillStyle(color, alpha).fillPoints(pts, true);
    g.lineStyle(1.5, color, 0.85).strokePoints(pts, true);
  }
  private syncGround(p: ValleyProps) {
    const s = p.state,
      key = JSON.stringify([s.seed, s.unlocked]);
    if (key === this.groundKey) return;
    this.groundKey = key;
    this.ground.forEach((o) => o.destroy());
    this.ground = [];
    for (let t = 0; t < MAP_SIZE * MAP_SIZE; t++) {
      const x = t % MAP_SIZE,
        y = Math.floor(t / MAP_SIZE),
        v = point(x, y),
        known = discovered(s, x, y),
        land = terrain(x, y, s.seed),
        n = noise(x + 23, y, s.seed);
      const k = !known
        ? "terrain.hidden"
        : land === "water"
          ? "terrain.water"
          : `terrain.grass${n > 0.6 ? 1 : n > 0.3 ? 2 : 3}`;
      this.ground.push(this.art(k, v.x, v.y + 22, 76, -100));
      if (known && land === "grass" && n > 0.79 && !s.forest[t])
        this.ground.push(this.art("terrain.flowers", v.x, v.y + 12, 30, -90));
      if (land === "rock")
        this.ground.push(
          this.art("terrain.rock", v.x, v.y, 50, v.y).setAlpha(known ? 1 : 0.3),
        );
    }
    for (let n = 0; n < 49; n++)
      if (!s.unlocked.includes(n)) {
        const x = (n % 7) * 6 + 2.5,
          y = Math.floor(n / 7) * 6 + 2.5,
          v = point(x, y);
        this.ground.push(this.art("terrain.fog", v.x, v.y + 132, 456, 5000));
        if (
          s.unlocked.some(
            (k) =>
              Math.abs((k % 7) - (n % 7)) +
                Math.abs(Math.floor(k / 7) - Math.floor(n / 7)) ===
              1,
          )
        ) {
          this.ground.push(
            this.add
              .circle(v.x, v.y, 16, 0x3a5849, 0.7)
              .setStrokeStyle(1, 0x9aae87)
              .setDepth(5001),
          );
          this.ground.push(this.art("icon.plus", v.x, v.y + 9, 18, 5002));
        }
      }
  }
  private syncTrees(p: ValleyProps) {
    const s = p.state;
    for (let t = 0; t < s.forest.length; t++) {
      const health = s.forest[t]!,
        x = t % MAP_SIZE,
        y = Math.floor(t / MAP_SIZE),
        v = point(x, y),
        known = discovered(s, x, y);
      let sprite = this.trees.get(t);
      if (!health) {
        if (sprite) {
          sprite.disableInteractive();
          this.trees.delete(t);
          if (known && !this.reduced) {
            this.tweens.add({
              targets: sprite,
              angle: 70,
              alpha: 0,
              duration: 700,
              ease: "Cubic.easeIn",
              onComplete: () => sprite!.destroy(),
            });
            this.chips(v.x, v.y);
          } else sprite.destroy();
        }
        continue;
      }
      if (!sprite) {
        sprite = this.art(
          "terrain.tree",
          v.x,
          v.y,
          64 + noise(x, y, s.seed) * 15,
          v.y + 1,
        );
        this.trees.set(t, sprite);
      }
      sprite.setAlpha(known ? 1 : 0.35);
      if (known && !sprite.input) this.hit(sprite, { tile: t });
      if (p.selectedTile === t || this.hover?.tile === t)
        sprite.setTint(0xffe9a5);
      else sprite.clearTint();
    }
  }
  private chips(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const c = this.art("effect.chips", x, y - 15, 12, 9100);
      this.tweens.add({
        targets: c,
        x: x + (i - 2.5) * 9,
        y: y + 15,
        alpha: 0,
        angle: i * 30,
        duration: 500 + i * 40,
        onComplete: () => c.destroy(),
      });
    }
  }
  private syncBuildings(p: ValleyProps) {
    const s = p.state,
      key = JSON.stringify(
        s.buildings.map((b) => [
          b.id,
          b.kind,
          b.x,
          b.y,
          b.level,
          b.readyAt,
          b.enabled,
        ]),
      );
    if (key !== this.buildingsKey) {
      this.buildingsKey = key;
      this.structures.forEach((o) => o.destroy());
      this.structures = [];
      this.buildingSprites.clear();
      for (const b of s.buildings) {
        const c = center(b),
          v = point(c.x, c.y),
          size = BUILDINGS[b.kind].size,
          w = size === 1 ? 73 : 126;
        const ground = this.add.graphics().setDepth(-60);
        this.diamond(ground, v.x, v.y, size, 0xcad49b, 0.1);
        this.structures.push(ground);
        const a = this.art(
          `building.${b.kind}`,
          v.x,
          v.y,
          w,
          point(b.x, b.y).y + size * 22 + 2,
        );
        this.hit(a, { building: b.id });
        this.structures.push(a);
        this.buildingSprites.set(b.id, a);
      }
    }
    const rates = this.rates;
    for (const b of s.buildings) {
      const a = this.buildingSprites.get(b.id)!;
      const busy = rates.find((r) => r.id === b.id),
        building = b.readyAt > p.now;
      a.setAlpha(building ? 0.45 : !b.enabled ? 0.58 : 1);
      this.animate(
        a,
        !building &&
          (!!busy?.running ||
            s.brood?.building === b.id ||
            (["depot", "relay", "market"].includes(b.kind) &&
              s.jobs.some((j) => j.from === b.id || j.to === b.id))),
      );
    }
  }
  private syncRoutes(p: ValleyProps) {
    const s = p.state,
      key = JSON.stringify([
        s.links,
        p.layer,
        p.selected,
        s.buildings.map((b) => [b.id, b.x, b.y]),
      ]);
    if (key === this.linksKey) return;
    this.linksKey = key;
    this.routeObjects.forEach((o) => o.destroy());
    this.routeObjects = [];
    this.routeMotion = [];
    this.routeGraphics.clear();
    for (const l of s.links) {
      const a = s.buildings.find((b) => b.id === l.from),
        b = s.buildings.find((b) => b.id === l.to);
      if (!a || !b) continue;
      if (
        l.kind === "flight" &&
        p.layer === "normal" &&
        p.selected !== a.id &&
        p.selected !== b.id
      )
        continue;
      const pts = l.path.length
        ? l.path.map((t) => point(t % MAP_SIZE, Math.floor(t / MAP_SIZE)))
        : [point(center(a).x, center(a).y), point(center(b).x, center(b).y)];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!,
          b = pts[i]!,
          len = Math.hypot(b.x - a.x, b.y - a.y),
          angle = Math.atan2(b.y - a.y, b.x - a.x),
          width = l.kind === "belt" ? 10 : l.kind === "flight" ? 2 : 5;
        this.routeGraphics
          .lineStyle(width + 4, 0x3a543b, 0.25)
          .lineBetween(a.x, a.y, b.x, b.y);
        const strip = this.add
          .tileSprite(a.x, a.y, len, width, this.texture(`route.${l.kind}`))
          .setOrigin(0, 0.5)
          .setRotation(angle)
          .setDepth(-40)
          .setAlpha(l.kind === "flight" ? 0.5 : 1);
        strip.setData("link", l);
        this.routeObjects.push(strip);
        if (l.kind === "belt") this.routeMotion.push(strip);
      }
    }
  }
  private worker(key: string, role: string, resource?: string) {
    let c = this.workers.get(key);
    if (c) return c;
    c = this.add.container(0, 0).setDepth(7000);
    const flying = !["belt", "pipe"].includes(role);
    const body = this.art(
      flying ? `bee.${role}` : `cargo.${resource}`,
      0,
      0,
      flying ? 36 : 12,
      0,
      flying,
    );
    body.setName("body");
    c.add(body);
    if (flying && resource) {
      const cargo = this.art(`cargo.${resource}`, 0, 16, 14, 0);
      cargo.setName("cargo");
      c.add(cargo);
    }
    if (role === "forester" || role === "builder") {
      const axe = this.art("effect.axe", 15, -4, 28, 0)
        .setName("axe")
        .setVisible(false);
      c.add(axe);
    }
    this.workers.set(key, c);
    return c;
  }
  private syncWorkers(p: ValleyProps, at: number) {
    const live = new Set<string>(),
      s = p.state;
    const engineers = s.units.filter((u) => u.role === "engineer" && !u.job),
      stations = new Map<number, { x: number; y: number }>();
    let ei = 0;
    for (const rate of this.rates) {
      const b = s.buildings.find((b) => b.id === rate.id)!;
      if (BUILDINGS[b.kind].role === "engineer")
        for (let n = 0; n < rate.workers; n++) {
          const u = engineers[ei++];
          if (u) stations.set(u.id, center(b));
        }
    }
    for (const u of s.units)
      if (!u.job) {
        const key = `idle:${u.id}`,
          xy = stations.get(u.id) ?? u.at ?? center(headquarters(s)),
          v = point(xy.x, xy.y),
          c = this.worker(key, u.role);
        live.add(key);
        c.setPosition(v.x + 18 + (u.id % 3) * 8, v.y - 7 - (u.id % 5) * 4)
          .setScale(0.62)
          .setAlpha(0.85);
        this.animate(c.getByName("body") as Sprite, false);
      }
    for (const j of s.jobs) {
      const key = `job:${j.id}`,
        c = this.worker(key, j.role, j.resource),
        xy = sample(j, at),
        v = point(xy.x, xy.y),
        flight = !["belt", "pipe"].includes(j.role);
      live.add(key);
      c.setPosition(v.x, v.y - (flight ? 12 : 2)).setVisible(at <= j.readyAt);
      (c.getByName("cargo") as Sprite | undefined)?.setVisible(
        at >= j.pickupAt,
      );
      const axe = c.getByName("axe") as Sprite | undefined;
      const arrival =
        j.path.length > 1
          ? j.startedAt +
            Math.hypot(
              j.path[1]!.x - j.path[0]!.x,
              j.path[1]!.y - j.path[0]!.y,
            ) *
              1800
          : j.startedAt;
      axe
        ?.setVisible(!!j.harvest && at >= arrival && at < j.pickupAt)
        .setAngle(this.reduced ? 0 : Math.sin(at / 90) * 35 - 25);
    }
    const c = s.clearing;
    if (c && !c.plant) {
      const target = { x: c.tile % MAP_SIZE, y: Math.floor(c.tile / MAP_SIZE) },
        home = center(headquarters(s)),
        from = c.from ?? home,
        arrive = c.arriveAt ?? c.startedAt,
        pickup = c.pickupAt ?? c.readyAt;
      const xy =
        at < arrive
          ? lerp(from, target, (at - c.startedAt) / (arrive - c.startedAt || 1))
          : at >= pickup
            ? lerp(target, home, (at - pickup) / (c.readyAt - pickup || 1))
            : target;
      const v = point(xy.x, xy.y),
        w = this.worker("clearing", c.bee ? "forester" : "builder", "wood");
      live.add("clearing");
      w.setPosition(v.x, v.y - 12);
      (w.getByName("cargo") as Sprite).setVisible(at >= pickup);
      (w.getByName("axe") as Sprite)
        .setVisible(at >= arrive && at < pickup)
        .setAngle(this.reduced ? 0 : Math.sin(at / 90) * 35 - 25);
    }
    for (const [key, c] of this.workers)
      if (!live.has(key)) {
        c.destroy(true);
        this.workers.delete(key);
      }
  }
  private drawOverlay(p: ValleyProps, at: number) {
    const g = this.overlay.clear(),
      s = p.state;
    this.waypointLabels.forEach((t) => t.destroy());
    this.waypointLabels = [];
    if (p.placement || p.connecting) {
      g.lineStyle(1, 0xd6d9ab, 0.22);
      for (let t = 0; t < 1764; t++) {
        const x = t % 42,
          y = Math.floor(t / 42);
        if (discovered(s, x, y)) {
          const v = point(x, y);
          g.strokePoints(
            [
              { x: v.x, y: v.y - 22 },
              { x: v.x + 38, y: v.y },
              { x: v.x, y: v.y + 22 },
              { x: v.x - 38, y: v.y },
            ],
            true,
          );
        }
      }
    }
    const picked = s.buildings.find((b) => b.id === p.selected);
    if (picked) {
      const c = center(picked),
        v = point(c.x, c.y);
      this.diamond(g, v.x, v.y, BUILDINGS[picked.kind].size, 0xffe3a2, 0.15);
      const range = BUILDINGS[picked.kind].range;
      if (range)
        g.lineStyle(1.5, 0xedf1bc, 0.55).strokeEllipse(
          v.x,
          v.y,
          range * 106,
          range * 62,
        );
      this.label(v.x, v.y + 25, `Ур. ${picked.level}`);
    }
    if (p.selectedTile !== null && !p.placement) {
      const x = p.selectedTile % 42,
        y = Math.floor(p.selectedTile / 42),
        known = discovered(s, x, y),
        v = known
          ? point(x, y)
          : point(Math.floor(x / 6) * 6 + 2.5, Math.floor(y / 6) * 6 + 2.5);
      this.diamond(g, v.x, v.y, known ? 1 : 6, 0xf2e1a1, 0.12);
    }
    if (p.draft.length > 1)
      g.lineStyle(4, 0xfff0b8, 0.8).strokePoints(
        p.draft.map((c) => point(c.x, c.y)),
        false,
      );
    p.via.forEach((t, i) => {
      const v = point(t % 42, Math.floor(t / 42));
      g.fillStyle(0xf2d087).fillCircle(v.x, v.y, 9);
      this.label(v.x, v.y, String(i + 1));
    });
    if (p.placement) {
      const q = p.placement,
        size = q.kind === "plant" ? 1 : BUILDINGS[q.kind].size,
        v = point(q.x + (size - 1) / 2, q.y + (size - 1) / 2),
        err =
          q.kind !== "plant" && placementError(s, q.kind, q.x, q.y, q.moving);
      this.diamond(g, v.x, v.y, size, err ? 0xdf9879 : 0xffefb3, 0.3);
      const asset = q.kind === "plant" ? "terrain.tree" : `building.${q.kind}`;
      if (this.ghost?.getData("asset") !== asset) {
        this.ghost?.destroy();
        this.ghost = this.art(
          asset,
          v.x,
          v.y,
          q.kind === "plant" ? 70 : 126,
          9002,
        ).setAlpha(0.6);
      }
      this.ghost?.setPosition(v.x, v.y).setVisible(true);
    } else this.ghost?.setVisible(false);
    const power = this.power,
      rates = this.rates;
    for (const b of s.buildings) {
      const c = center(b),
        v = point(c.x, c.y),
        rate = rates.find((r) => r.id === b.id);
      if (p.layer === "power") {
        const n = [...power.mechanical, ...power.electric].find((n) =>
          n.ids.includes(b.id),
        );
        if (n) {
          g.lineStyle(2, n.ratio ? 0xbddd8a : 0xe28d6b, 0.8).strokeCircle(
            v.x,
            v.y - 35,
            17,
          );
        }
      }
      if (
        b.readyAt <= at &&
        rate?.reason &&
        ![
          "wild",
          "hive",
          "depot",
          "meadow",
          "nursery",
          "relay",
          "market",
        ].includes(b.kind)
      ) {
        g.fillStyle(0xefdb9b).fillCircle(v.x + 36, v.y - 52, 9);
        this.label(v.x + 36, v.y - 52, "!");
      }
    }
  }
  private label(x: number, y: number, text: string) {
    this.waypointLabels.push(
      this.add
        .text(x, y, text, {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#fff2ca",
          stroke: "#43543b",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(9003),
    );
  }
  private drawProgress(p: ValleyProps, at: number) {
    const g = this.progress.clear(),
      bar = (x: number, y: number, f: number) => {
        g.fillStyle(0x3e593b, 0.9).fillRoundedRect(x - 24, y, 48, 5, 2);
        g.fillStyle(0xead392).fillRoundedRect(
          x - 24,
          y,
          48 * Phaser.Math.Clamp(f, 0, 1),
          5,
          2,
        );
      };
    for (const b of p.state.buildings)
      if (b.readyAt > at) {
        const c = center(b),
          v = point(c.x, c.y);
        bar(v.x, v.y - 65, (at - b.startedAt) / (b.readyAt - b.startedAt));
      }
    const c = p.state.clearing;
    if (c) {
      const v = point(c.tile % 42, Math.floor(c.tile / 42));
      bar(v.x, v.y + 10, (at - c.startedAt) / (c.readyAt - c.startedAt));
    }
  }
  private lastState?: ValleyProps;
  private lastRefresh = 0;
  private lastHover: Target | null = null;
  private rates: ReturnType<typeof production> = [];
  private power: ReturnType<typeof networks> = { mechanical: [], electric: [] };
  update(time: number, delta: number) {
    if (!this.loaded) return;
    const p = this.read(),
      at = Date.now() + p.offset;
    if (p !== this.lastState || time - this.lastRefresh > 1000) {
      this.rates = production(p.state, p.now);
      this.power = networks(p.state);
      this.syncGround(p);
      this.syncTrees(p);
      this.syncBuildings(p);
      this.syncRoutes(p);
      this.drawOverlay(p, at);
      this.lastState = p;
      this.lastRefresh = time;
      this.game.canvas.dataset.fps = String(
        Math.round(this.game.loop.actualFps),
      );
      this.game.canvas.dataset.objects = String(this.children.length);
    }
    if (this.hover !== this.lastHover) {
      this.syncTrees(p);
      this.lastHover = this.hover;
    }
    this.syncWorkers(p, at);
    this.drawProgress(p, at);
    if (!this.reduced) {
      const power = this.power;
      for (const strip of this.routeMotion) {
        const link = strip.getData("link");
        if (power.mechanical.some((n) => n.ids.includes(link.from) && n.ratio))
          strip.tilePositionX -= delta * 0.025;
      }
    }
  }
}
