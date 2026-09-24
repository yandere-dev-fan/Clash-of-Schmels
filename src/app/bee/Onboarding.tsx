"use client";
import { useEffect, useState } from "react";
import { BUILDINGS, TECH, type BeeState, type BuildingKind } from "@/lib/bee";
import GameIcon from "./GameIcon";
import styles from "./schmels.module.css";
export const GUIDES: Record<BuildingKind, string> = {
  wild: "Сердце колонии. Здесь появляются первые три собирателя, хранится строительный запас и производится мёд.",
  hive: "Увеличивает жильё и производство мёда. Собиратели принесут нектар; для вывоза мёда нужен маршрут грузчиков.",
  meadow:
    "Возобновляемый источник нектара. Ставьте недалеко от ульев: короткий полёт ускоряет сбор.",
  depot:
    "Расширяет запас для строительства и исследований. Ресурсы становятся общим запасом только после доставки сюда.",
  nursery:
    "Выращивает четыре профессии пчёл. Когда маршруты стоят без грузчиков или станки ждут механиков — развивайте расплодник.",
  logging:
    "Автоматизирует древесину. Лесник летит к дереву, рубит его и возвращает груз на станцию. Дальше нужен вывоз в хранилище.",
  workshop:
    "Начальная промышленность без энергии. Рецепт «Доски»: 2 древесины → 1 доска. Рецепт «Шестерни»: 2 доски + 1 воск → 1 шестерня. Две мастерские позволяют соединить эти этапы.",
  press:
    "Источник воска для шестерней, строительства и исследований. Подвозите мёд и вывозите воск, чтобы выход не заполнился.",
  market:
    "Принимает мёд для экспедиционных заказов. Мёд должен прибыть сюда по маршруту; выплаты зависят от фонда игры.",
  sawmill:
    "Производит доски быстрее ручной мастерской. Сначала сделайте шестерни вручную, затем постройте колесо и подключите пилораму валом.",
  pump: "Ускоряет добычу нектара за счёт леса. Требует воды и вращения; после истощения леса придётся расширяться или восстанавливать деревья.",
  sanctuary:
    "Восстанавливает лес вокруг, расходуя воду и мёд. Позволяет поддерживать лесников и помпы без постоянного расширения.",
  waterwheel:
    "Первый источник вращения: 24 мощности за уровень. Строится у реки. Передаёт вращение по валам, а не по маршрутам пчёл.",
  well: "Даёт воду для помп, восстановления леса и паровых котлов. Нужны берег и механик. Сначала воду носят грузчики, позже идут трубы.",
  boiler:
    "Даёт 48 вращения за уровень вдали от реки. Постоянно потребляет древесину и воду — заранее организуйте обе доставки.",
  mine: "Добывает руду для меди рядом с каменной жилой. Нужны механик, вращение и маршрут до плавильни.",
  smelter:
    "Из руды и древесины делает медь — материал для труб, кабелей и электрических машин.",
  dynamo:
    "Превращает 16 вращения в 40 электричества. Подключите вход валом, а потребителей — кабелем.",
  powerplant:
    "Источник 80 электричества за уровень. Нужны непрерывные поставки древесины и воды.",
  centrifuge:
    "Поздняя переработка нектара в мёд и воск. Нужны механик и электричество; вывозите оба продукта.",
  relay:
    "Промежуточный буфер. Удлиняет цепочки маршрутов пчёл и помогает делать ответвления конвейеров.",
};
export function eraProgress(s: BeeState, now: number) {
  const next = TECH[s.era];
  if (!next)
    return {
      value: 1,
      label: "Все эпохи открыты",
      age: 1,
      stock: 1,
      workshop: true,
    };
  if (s.research)
    return {
      value: Math.min(
        1,
        Math.max(
          0,
          (now - s.research.startedAt) /
            (s.research.readyAt - s.research.startedAt),
        ),
      ),
      label: `Исследование: ${next.name}`,
      age: 1,
      stock: 1,
      workshop: true,
    };
  const age = Math.min(1, Math.max(0, (now - s.createdAt) / (next.age * 1000))),
    cost = Object.entries(next.cost),
    stock =
      cost.reduce(
        (n, [r, v]) => n + Math.min(1, s[r as keyof typeof next.cost] / v),
        0,
      ) / Math.max(1, cost.length),
    workshop = s.buildings.some(
      (b) => b.kind === "workshop" && b.readyAt <= now,
    );
  return {
    value: (age + stock + Number(workshop)) / 3,
    label: `Подготовка: ${next.name}`,
    age,
    stock,
    workshop,
  };
}
export default function Onboarding({
  state,
  replay,
  onClose,
  onBuild,
  onSwarm,
  onTech,
}: {
  state: BeeState;
  replay: number;
  onClose: () => void;
  onBuild: (kind: BuildingKind) => void;
  onSwarm: () => void;
  onTech: () => void;
}) {
  const [step, setStep] = useState(0),
    [open, setOpen] = useState(false);
  const key = `schmels:tutorial:v1:${state.createdAt}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      setOpen(saved !== "done");
      if (saved && saved !== "done") setStep(Math.min(4, Number(saved) || 0));
    } catch {
      setOpen(true);
    }
  }, [key]);
  useEffect(() => {
    if (replay) {
      setStep(0);
      setOpen(true);
    }
  }, [replay]);
  function finish() {
    setOpen(false);
    try {
      localStorage.setItem(key, "done");
    } catch {}
    onClose();
  }
  if (!open)
    return (
      <button
        className={styles.guideButton}
        title="Повторить обучение"
        aria-label="Повторить обучение"
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
      >
        <GameIcon name="info" size={19} />
      </button>
    );
  const steps = [
    {
      title: "Добро пожаловать в рой",
      body: "Начните с трёх бесплатных пчёл в маточном улье. Собиратели сами летают на цветы и возвращают нектар.",
      action: "К маточному улью",
      run: () => onBuild("wild"),
      done: state.bees > 0,
    },
    {
      title: "У каждой пчелы своя работа",
      body: "Собиратели добывают нектар, грузчики доставляют сырьё, механики обслуживают станки, лесники рубят лес. Новых специалистов выращивают в расплоднике.",
      action: "Посмотреть рой",
      run: onSwarm,
      done: state.buildings.some((b) => b.kind === "nursery"),
    },
    {
      title: "Мёд не телепортируется",
      body: "Выберите отправителя → «Соединить» → получателя. Укажите груз. Без свободного грузчика сырьё останется у отправителя.",
      action: "Хранилище и маршруты",
      run: () => onBuild("depot"),
      done: state.links.some((l) => l.kind === "flight"),
    },
    {
      title: "Первые шестерни",
      body: "Мастерская делает доски из древесины. Переключите рецепт: 2 доски + 1 воск → шестерня. Воск делает пресс из мёда. Обоим нужен механик.",
      action: "Открыть мастерскую",
      run: () => onBuild("workshop"),
      done: state.gears > 0,
    },
    {
      title: "От улья к фабрике",
      body: "Механика: колесо у реки → валы → станки и конвейеры. Позже откроются пар и электричество. Полоса эпохи показывает время, материалы и готовность мастерской.",
      action: "Эпохи",
      run: onTech,
      done: state.era > 1,
    },
  ];
  const item = steps[step]!;
  return (
    <aside className={styles.tutorial} aria-label="Обучение">
      <header>
        <span>
          {step + 1} / {steps.length}
        </span>
        <strong>{item.title}</strong>
        <button aria-label="Пропустить обучение" onClick={finish}>
          <GameIcon name="close" size={17} />
        </button>
      </header>
      <p>{item.body}</p>
      <footer>
        <button onClick={item.run}>{item.action}</button>
        <button
          onClick={() => {
            if (step === 4) finish();
            else {
              setStep(step + 1);
              try {
                localStorage.setItem(key, String(step + 1));
              } catch {}
            }
          }}
        >
          {step === 4 ? "Играть" : "Дальше"} <GameIcon name="check" size={14} />
        </button>
      </footer>
      <div className={styles.tutorialDots}>
        {steps.map((_, i) => (
          <button
            key={i}
            aria-label={`Шаг ${i + 1}`}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)}
          />
        ))}
      </div>
    </aside>
  );
}
