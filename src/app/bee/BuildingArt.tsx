"use client";
import type { BuildingKind } from "@/lib/bee";
import { AnchoredSprite } from "./Artwork";
export default function BuildingArt({
  kind,
  active = false,
}: {
  kind: BuildingKind;
  id?: string;
  active?: boolean;
}) {
  return (
    <svg viewBox="0 0 160 150" aria-hidden="true" overflow="visible">
      <AnchoredSprite
        name={`building.${kind}`}
        active={active}
        x={80}
        y={126}
        width={160}
      />
    </svg>
  );
}
