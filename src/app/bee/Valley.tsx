"use client";
import { useEffect, useRef, useState } from "react";
import type { Game } from "phaser";
import { useAssetPack } from "./Artwork";
import GameIcon from "./GameIcon";
import type { ColonyScene } from "./phaser/ColonyScene";
import type { ValleyProps } from "./phaser/model";
import styles from "./schmels.module.css";
export { RESOURCE_COLORS, point } from "./phaser/model";
export type { Placement } from "./phaser/model";
/** React owns the accessible HUD; Phaser exclusively owns the game world. */
export default function Valley(props: ValleyProps) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props),
    scene = useRef<ColonyScene | undefined>(undefined);
  const pack = useAssetPack(),
    [failure, setFailure] = useState(""),
    [ready, setReady] = useState(false);
  latest.current = props;
  useEffect(() => {
    let cancelled = false,
      game: Game | undefined;
    setReady(false);
    setFailure("");
    void Promise.all([import("phaser"), import("./phaser/ColonyScene")])
      .then(([Phaser, { ColonyScene }]) => {
        if (cancelled || !host.current) return;
        const world = new ColonyScene(
          () => latest.current,
          pack,
          () => setReady(true),
        );
        scene.current = world;
        game = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host.current,
          backgroundColor: "#4c6650",
          scale: {
            mode: Phaser.Scale.RESIZE,
            width: host.current.clientWidth,
            height: host.current.clientHeight,
          },
          render: { antialias: true, roundPixels: false },
          input: { activePointers: 3 },
          audio: { noAudio: true },
          scene: [world],
          banner: false,
          fps: { target: 60 },
        });
      })
      .catch((e) => {
        if (!cancelled)
          setFailure(
            e instanceof Error ? e.message : "Не удалось запустить карту",
          );
      });
    return () => {
      cancelled = true;
      scene.current = undefined;
      game?.destroy(true);
    };
  }, [pack]);
  return (
    <>
      <div
        className={styles.world}
        ref={host}
        role="application"
        aria-label="Карта Clash of Schmels — Phaser"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!e.key.startsWith("Arrow")) return;
          e.preventDefault();
          const p = latest.current.placement;
          if (p)
            latest.current.onPlacement(
              Math.max(
                0,
                Math.min(
                  41,
                  p.x +
                    (e.key === "ArrowRight"
                      ? 1
                      : e.key === "ArrowLeft"
                        ? -1
                        : 0),
                ),
              ),
              Math.max(
                0,
                Math.min(
                  41,
                  p.y +
                    (e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0),
                ),
              ),
            );
          else scene.current?.nudge(e.key);
        }}
      />
      {!ready && (
        <div className={styles.phaserLoading} role="status">
          {failure
            ? "Не удалось загрузить карту. Обновите страницу."
            : "Загружаем долину…"}
        </div>
      )}
      <div className={styles.mapControls}>
        <button
          aria-label="Приблизить"
          onClick={() => scene.current?.zoomBy(1.2)}
        >
          <GameIcon name="plus" size={17} />
        </button>
        <button
          aria-label="Отдалить"
          onClick={() => scene.current?.zoomBy(1 / 1.2)}
        >
          <GameIcon name="minus" size={17} />
        </button>
        <button aria-label="К матке" onClick={() => scene.current?.home()}>
          <GameIcon name="target" size={17} />
        </button>
      </div>
    </>
  );
}
