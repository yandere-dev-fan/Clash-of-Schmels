import type { CSSProperties } from "react";
import { Sprite } from "./Artwork";
export type IconName =
  | "nectar"
  | "water"
  | "planks"
  | "gears"
  | "ore"
  | "copper"
  | "honey"
  | "wood"
  | "wax"
  | "bee"
  | "hammer"
  | "leaf"
  | "road"
  | "up"
  | "move"
  | "pause"
  | "play"
  | "close"
  | "check"
  | "back"
  | "coin"
  | "flask"
  | "axe"
  | "plus"
  | "minus"
  | "target"
  | "info"
  | "trash"
  | "star"
  | "lock"
  | "clock"
  | "settings";

export default function GameIcon({
  name,
  size = 24,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style}
      aria-hidden="true"
    >
      <Sprite name={`icon.${name}`} width={24} height={24} />
    </svg>
  );
}
