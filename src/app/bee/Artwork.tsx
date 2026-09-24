"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import defaults from "../../../public/bee/assets/manifest.json";
export type Asset = {
  src: string;
  activeSrc?: string;
  width: number;
  height: number;
  anchor?: { x: number; y: number };
  hitArea?: number[][];
};
export type Pack = { version: number | string; assets: Record<string, Asset> };
const fallback = defaults as Pack,
  Context = createContext<Pack>(fallback);
export function AssetProvider({ children }: { children: ReactNode }) {
  const [pack, setPack] = useState<Pack>(fallback);
  useEffect(() => {
    const c = new AbortController();
    fetch("/bee/assets/manifest.json", { cache: "no-store", signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((p) => {
        if (p && typeof p.assets === "object")
          setPack({
            version: p.version ?? 1,
            assets: { ...fallback.assets, ...p.assets },
          });
      })
      .catch(() => {});
    return () => c.abort();
  }, []);
  return <Context.Provider value={pack}>{children}</Context.Provider>;
}
export const useAssetPack = () => useContext(Context);
export function useAsset(key: string, active = false) {
  const pack = useContext(Context),
    a = pack.assets[key] ?? fallback.assets["effect.missing"]!;
  const file = active && a.activeSrc ? a.activeSrc : a.src;
  return {
    ...a,
    url: `/bee/assets/${file}?v=${encodeURIComponent(pack.version)}`,
  };
}
export function Sprite({
  name,
  active = false,
  x = 0,
  y = 0,
  width,
  height,
  style,
}: {
  name: string;
  active?: boolean;
  x?: number;
  y?: number;
  width: number;
  height?: number;
  style?: CSSProperties;
}) {
  const a = useAsset(name, active),
    [failed, setFailed] = useState("");
  const url = failed === a.url ? "/bee/assets/effects/missing.svg" : a.url;
  return (
    <image
      href={url}
      x={x}
      y={y}
      width={width}
      height={height ?? (width * a.height) / a.width}
      style={style}
      preserveAspectRatio="xMidYMid meet"
      pointerEvents="none"
      onError={() => setFailed(a.url)}
    />
  );
}
export function AnchoredSprite({
  name,
  active = false,
  x = 0,
  y = 0,
  width,
  style,
}: {
  name: string;
  active?: boolean;
  x?: number;
  y?: number;
  width: number;
  style?: CSSProperties;
}) {
  const a = useAsset(name, active),
    scale = width / a.width;
  return (
    <Sprite
      name={name}
      active={active}
      x={x - (a.anchor?.x ?? a.width / 2) * scale}
      y={y - (a.anchor?.y ?? a.height) * scale}
      width={width}
      style={style}
    />
  );
}
/** Polygon follows the visible sprite; transparent image margins never own clicks. */
export function SpriteHit({
  name,
  x,
  y,
  width,
}: {
  name: string;
  x: number;
  y: number;
  width: number;
}) {
  const a = useAsset(name),
    shape = a.hitArea ?? [
      [-0.4, 0],
      [-0.38, -0.7],
      [0, -0.82],
      [0.38, -0.7],
      [0.4, 0],
      [0, 0.13],
    ];
  return (
    <polygon
      points={shape
        .map(([dx, dy]) => `${x + dx! * width},${y + dy! * width}`)
        .join(" ")}
      fill="transparent"
      pointerEvents="all"
    />
  );
}
