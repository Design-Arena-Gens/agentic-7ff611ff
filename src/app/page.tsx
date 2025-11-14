"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FallingType = "yarn" | "treat" | "puddle";

type FallingItem = {
  id: number;
  x: number;
  y: number;
  speed: number;
  type: FallingType;
};

const GAME_WIDTH = 720;
const GAME_HEIGHT = 540;
const CAT_WIDTH = 110;
const CAT_HEIGHT = 86;
const ITEM_SIZE = 56;
const TOTAL_TIME = 60;
const MAX_LIVES = 5;
const CAT_Y = GAME_HEIGHT - CAT_HEIGHT - 12;

export default function Home() {
  const [gameState, setGameState] = useState<"ready" | "running" | "ended">(
    "ready",
  );
  const [catX, setCatX] = useState((GAME_WIDTH - CAT_WIDTH) / 2);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [streak, setStreak] = useState(0);
  const [message, setMessage] = useState(
    "Use ← → or A/D to move. Catch yarn & fish biscuits, dodge puddles!",
  );
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") {
      return 0;
    }
    const stored = window.localStorage.getItem("cat-highscore");
    const parsed = Number(stored);
    return Number.isNaN(parsed) ? 0 : parsed;
  });

  const catXRef = useRef(catX);
  const scoreRef = useRef(score);
  const livesRef = useRef(lives);
  const timeRef = useRef(timeLeft);
  const streakRef = useRef(streak);
  const itemsRef = useRef<FallingItem[]>([]);
  const nextIdRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const difficultyRef = useRef(0);
  const directionRef = useRef(0);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const resetGame = useCallback(() => {
    const startX = (GAME_WIDTH - CAT_WIDTH) / 2;
    catXRef.current = startX;
    setCatX(startX);

    scoreRef.current = 0;
    setScore(0);

    livesRef.current = 3;
    setLives(3);

    timeRef.current = TOTAL_TIME;
    setTimeLeft(TOTAL_TIME);

    streakRef.current = 0;
    setStreak(0);

    setMessage("Catch yarn for points, fish biscuits for boosts, avoid puddles!");

    itemsRef.current = [];
    setItems([]);

    nextIdRef.current = 0;
    spawnTimerRef.current = 0;
    difficultyRef.current = 0;
    velocityRef.current = 0;
    directionRef.current = 0;
  }, []);

  const registerHighScore = useCallback(() => {
    setHighScore((previous) => {
      const best = Math.max(previous, scoreRef.current);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cat-highscore", String(best));
      }
      return best;
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("running");
  }, [resetGame]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        directionRef.current = -1;
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        directionRef.current = 1;
      } else if (event.key === " " && gameState !== "running") {
        startGame();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key.toLowerCase() === "a" ||
        event.key.toLowerCase() === "d"
      ) {
        if (directionRef.current !== 0) {
          directionRef.current = 0;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState, startGame]);

  useEffect(() => {
    if (gameState !== "running") {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let previous = performance.now();

    const loop = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;

      difficultyRef.current += delta;
      spawnTimerRef.current += delta;

      const baseSpeed = 420;
      const maxVelocity = 520;
      const accel = 1400;
      const friction = 1600;
      const target = directionRef.current * baseSpeed;
      const velocity = velocityRef.current;

      let nextVelocity = velocity;
      if (directionRef.current !== 0) {
        const diff = target - velocity;
        nextVelocity = Math.max(
          Math.min(velocity + Math.sign(diff) * accel * delta, maxVelocity),
          -maxVelocity,
        );
      } else if (velocity !== 0) {
        const reduce = Math.sign(velocity) * friction * delta;
        const result = velocity - reduce;
        nextVelocity = Math.sign(velocity) !== Math.sign(result) ? 0 : result;
      }

      velocityRef.current = nextVelocity;
      catXRef.current = Math.min(
        Math.max(catXRef.current + nextVelocity * delta, 0),
        GAME_WIDTH - CAT_WIDTH,
      );
      setCatX(catXRef.current);

      const spawnInterval = Math.max(
        0.45,
        1.1 - difficultyRef.current * 0.03,
      );
      if (spawnTimerRef.current >= spawnInterval) {
        spawnTimerRef.current = 0;
        const roll = Math.random();
        const type: FallingType =
          roll < 0.15 ? "puddle" : roll > 0.82 ? "treat" : "yarn";
        const speed =
          type === "puddle"
            ? 140 + difficultyRef.current * 16
            : 220 + difficultyRef.current * 20;
        const widthPadding = type === "puddle" ? ITEM_SIZE * 1.2 : ITEM_SIZE;
        const x =
          Math.random() * (GAME_WIDTH - widthPadding) +
          (type === "puddle" ? widthPadding / 2 : 0);
        const item: FallingItem = {
          id: nextIdRef.current++,
          x,
          y: -ITEM_SIZE,
          speed,
          type,
        };
        itemsRef.current = [...itemsRef.current, item];
        setItems(itemsRef.current);
      }

      const catLeft = catXRef.current + 12;
      const catRight = catXRef.current + CAT_WIDTH - 12;
      const catTop = CAT_Y + 18;
      const catBottom = CAT_Y + CAT_HEIGHT;

      const updatedItems: FallingItem[] = [];
      let gainedMessage: string | null = null;
      let lostLife = false;

      for (const item of itemsRef.current) {
        const nextY = item.y + item.speed * delta;
        const itemLeft = item.x + 8;
        const itemRight = item.x + ITEM_SIZE - 8;
        const itemTop = nextY;
        const itemBottom =
          nextY + (item.type === "puddle" ? ITEM_SIZE * 0.55 : ITEM_SIZE);

        const intersects =
          itemRight >= catLeft &&
          itemLeft <= catRight &&
          itemBottom >= catTop &&
          itemTop <= catBottom;

        if (intersects) {
          if (item.type === "puddle") {
            livesRef.current = Math.max(0, livesRef.current - 1);
            streakRef.current = 0;
            lostLife = true;
            gainedMessage = "Oh no! Puddles make paws soggy.";
          } else if (item.type === "treat") {
            scoreRef.current += 35 + streakRef.current * 3;
            streakRef.current += 2;
            if (livesRef.current < MAX_LIVES) {
              livesRef.current += 1;
            }
            gainedMessage = "Fish biscuits! Extra energy!";
          } else {
            scoreRef.current += 12 + streakRef.current * 2;
            streakRef.current += 1;
            gainedMessage = streakRef.current > 1 ? "Combo meow!" : "Nice catch!";
          }
          continue;
        }

        if (nextY < GAME_HEIGHT + ITEM_SIZE) {
          updatedItems.push({ ...item, y: nextY });
        }
      }

      itemsRef.current = updatedItems;
      setItems(updatedItems);

      scoreRef.current = Math.max(scoreRef.current, 0);
      setScore(scoreRef.current);

      livesRef.current = Math.min(livesRef.current, MAX_LIVES);
      setLives(livesRef.current);

      streakRef.current = Math.max(streakRef.current, 0);
      setStreak(streakRef.current);

      timeRef.current = Math.max(0, timeRef.current - delta);
      setTimeLeft(timeRef.current);

      if (gainedMessage) {
        setMessage(gainedMessage);
      } else if (lostLife) {
        setMessage("Careful! Stay fluffy and dry.");
      } else if (itemsRef.current.length === 0 && Math.random() < 0.01) {
        setMessage("Keep chasing! 🐾");
      }

      if (timeRef.current <= 0 || livesRef.current <= 0) {
        setGameState("ended");
        registerHighScore();
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [gameState, registerHighScore]);

  const formattedTime = useMemo(() => {
    const seconds = Math.ceil(timeLeft);
    const minutes = Math.floor(seconds / 60);
    const remainder = String(seconds % 60).padStart(2, "0");
    return `${minutes}:${remainder}`;
  }, [timeLeft]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-start bg-gradient-to-br from-sky-100 via-rose-50 to-amber-100 pb-16 pt-12 text-neutral-900">
      <div className="w-full max-w-5xl px-6">
        <header className="flex flex-col items-center gap-3 pb-8 text-center">
          <h1 className="text-4xl font-black tracking-tight text-amber-700 drop-shadow-sm sm:text-5xl">
            Cozy Cat Arcade
          </h1>
          <p className="max-w-3xl text-lg text-neutral-700 sm:text-xl">
            Help Miso the cat catch yarn and biscuits before bedtime. Collect
            treats for bonus points, dodge puddles, and keep your paws dry!
          </p>
        </header>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-white/70 px-6 py-4 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:text-base">
            <span className="rounded-full bg-amber-500/10 px-4 py-1 text-amber-700">
              Time: {formattedTime}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-4 py-1 text-emerald-700">
              Score: {score}
            </span>
            <span className="rounded-full bg-rose-500/10 px-4 py-1 text-rose-700">
              Lives: {lives}
            </span>
            <span className="rounded-full bg-indigo-500/10 px-4 py-1 text-indigo-700">
              Streak: {streak}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-amber-300 px-4 py-1 text-sm font-semibold text-amber-700 shadow-sm">
              High Score: {highScore}
            </span>
            <button
              type="button"
              onClick={startGame}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-amber-600 active:scale-95"
            >
              {gameState === "running" ? "Restart" : "Start"}
            </button>
          </div>
        </div>

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6">
          <div
            className="relative w-full overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-b from-sky-100 via-amber-50 to-rose-100 shadow-2xl"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          >
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-amber-200 via-amber-100/80 to-transparent" />
            {gameState === "ready" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl bg-white/80 px-10 py-8 text-center shadow-xl backdrop-blur">
                  <p className="text-lg font-semibold text-amber-700">
                    Press Start or Space to begin!
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Move with ← → or A/D. Catch yarn and biscuits, avoid puddles.
                    Each biscuit grants a bonus life!
                  </p>
                </div>
              </div>
            )}
            {gameState === "ended" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl bg-white/80 px-12 py-10 text-center shadow-xl backdrop-blur">
                  <h2 className="text-2xl font-bold text-amber-700">
                    Time&apos;s up!
                  </h2>
                  <p className="mt-3 text-lg text-neutral-700">
                    Final score: {score}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    Press Start or Space to try again. Keep those paws nimble!
                  </p>
                </div>
              </div>
            )}

            <div
              className="absolute transition-transform duration-75 ease-out"
              style={{
                transform: `translate3d(${catX}px, ${CAT_Y}px, 0)`,
              }}
            >
              <CatSprite />
            </div>

            {items.map((item) => (
              <div
                key={item.id}
                className="absolute transition-transform"
                style={{
                  transform: `translate3d(${item.x}px, ${item.y}px, 0)`,
                }}
              >
                <FallingSprite item={item} />
              </div>
            ))}
          </div>

          <div className="w-full rounded-3xl border border-amber-200 bg-white/70 px-6 py-4 text-center text-sm text-neutral-700 shadow-lg backdrop-blur">
            {message}
          </div>

          <div className="w-full rounded-3xl border border-sky-200 bg-white/70 px-6 py-5 shadow">
            <h3 className="text-left text-lg font-semibold text-amber-700">
              Playground Rules
            </h3>
            <ul className="mt-3 grid grid-cols-1 gap-3 text-left text-sm text-neutral-700 sm:grid-cols-3">
              <li className="flex items-start gap-2 rounded-2xl bg-amber-100/60 px-4 py-3">
                <span className="text-2xl leading-none">🧶</span>
                <span>
                  Yarn: +12 points (+combo). Keep streaks going for bigger gains.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-2xl bg-emerald-100/60 px-4 py-3">
                <span className="text-2xl leading-none">🐟</span>
                <span>
                  Fish biscuit: +35 points, streak boost, bonus life up to {MAX_LIVES}.
                </span>
              </li>
              <li className="flex items-start gap-2 rounded-2xl bg-rose-100/60 px-4 py-3">
                <span className="text-2xl leading-none">💧</span>
                <span>
                  Puddle: minus one life, streak reset. Watch those paws!
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatSprite() {
  return (
    <div className="relative h-[86px] w-[110px]">
      <div className="absolute -top-2 left-6 h-8 w-8 rotate-3 rounded-t-full bg-amber-400 shadow-inner" />
      <div className="absolute -top-2 right-6 h-8 w-8 -rotate-3 rounded-t-full bg-amber-400 shadow-inner" />
      <div className="absolute left-0 top-4 h-[58px] w-full rounded-[45px] bg-gradient-to-br from-amber-400 via-amber-300 to-amber-200 shadow-lg" />
      <div className="absolute left-6 top-6 h-10 w-10 rounded-full bg-amber-300 shadow-inner">
        <div className="absolute left-2 top-2 h-3 w-3 rounded-full bg-amber-500" />
      </div>
      <div className="absolute right-6 top-6 h-10 w-10 rounded-full bg-amber-300 shadow-inner">
        <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-amber-500" />
      </div>
      <div className="absolute left-[42px] top-10 h-4 w-12 rounded-full bg-pink-200 shadow-inner" />
      <div className="absolute left-[36px] top-[52px] h-4 w-16 rounded-full bg-amber-400" />
      <div className="absolute left-[18px] top-[50px] h-8 w-10 rounded-full bg-amber-400 shadow-inner" />
      <div className="absolute right-[18px] top-[50px] h-8 w-10 rounded-full bg-amber-400 shadow-inner" />
      <div className="absolute left-3 top-[62px] h-4 w-16 rounded-full bg-amber-500" />
      <div className="absolute right-3 top-[62px] h-4 w-16 rounded-full bg-amber-500" />
      <div className="absolute bottom-0 left-8 h-4 w-8 rounded-full bg-amber-600" />
      <div className="absolute bottom-0 right-8 h-4 w-8 rounded-full bg-amber-600" />
    </div>
  );
}

function FallingSprite({ item }: { item: FallingItem }) {
  if (item.type === "yarn") {
    return (
      <div className="relative h-[56px] w-[56px]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-400 via-amber-300 to-rose-200 shadow-lg" />
        <div className="absolute left-8 top-6 h-3 w-10 rounded-full bg-amber-500/70 blur-[1px]" />
        <div className="absolute left-10 top-3 h-2 w-10 rotate-45 rounded-full bg-amber-500/50 blur-[1px]" />
      </div>
    );
  }
  if (item.type === "treat") {
    return (
      <div className="relative h-[48px] w-[64px]">
        <div className="absolute inset-0 -rotate-12 rounded-[32px] bg-gradient-to-br from-emerald-400 via-emerald-300 to-emerald-200 shadow-lg" />
        <div className="absolute left-1/2 top-[14px] h-2 w-10 -translate-x-1/2 rounded-full bg-emerald-500/80" />
        <div className="absolute left-1/2 top-[24px] h-2 w-10 -translate-x-1/2 rounded-full bg-emerald-500/50" />
      </div>
    );
  }
  return (
    <div className="relative h-[32px] w-[96px]">
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400/80 via-sky-500/70 to-sky-400/80 opacity-80 shadow-lg" />
      <div className="absolute inset-0 rounded-full blur-lg bg-sky-300/80" />
    </div>
  );
}
