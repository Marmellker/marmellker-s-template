import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'wave' | 'ship' | 'ufo';
type Difficulty = 'easy' | 'medium' | 'hard';
type Screen = 'menu' | 'playing' | 'result' | 'colors';

type Choice = {
  mode: Mode;
  difficulty: Difficulty;
};

type Obstacle = {
  kind?: 'block' | 'spike';
  direction?: 'up' | 'down';
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

type Orb = {
  x: number;
  y: number;
  radius: number;
};

type Level = {
  duration: number;
  speed: number;
  obstacles: Obstacle[];
  orbs: Orb[];
};

type Player = {
  x: number;
  y: number;
  vy: number;
  angle: number;
  cooldown: number;
};

type TrailPoint = {
  x: number;
  y: number;
};

type RecordMap = Record<string, number>;

type ColorSettings = Record<Mode | 'trail', string>;

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  { id: 'wave', title: 'Волна', subtitle: 'резкие диагонали' },
  { id: 'ship', title: 'Корабль', subtitle: 'плавный полёт' },
  { id: 'ufo', title: 'UFO', subtitle: 'прыжки в воздухе' },
];

const DIFFICULTIES: Array<{ id: Difficulty; title: string; multiplier: number }> = [
  { id: 'easy', title: 'Лёгкий', multiplier: 0.72 },
  { id: 'medium', title: 'Средний', multiplier: 1 },
  { id: 'hard', title: 'Тяжёлый', multiplier: 1.32 },
];

const DEFAULT_COLORS: ColorSettings = {
  trail: '#2563eb',
  wave: '#2563eb',
  ship: '#dc2626',
  ufo: '#facc15',
};

const COLOR_PALETTE: Array<{ title: string; value: string }> = [
  { title: 'Жёлтый', value: '#facc15' },
  { title: 'Оранжевый', value: '#f97316' },
  { title: 'Красный', value: '#dc2626' },
  { title: 'Фиолетовый', value: '#9333ea' },
  { title: 'Синий', value: '#2563eb' },
  { title: 'Зелёный', value: '#16a34a' },
];

const COLOR_TARGETS: Array<{ id: keyof ColorSettings; title: string }> = [
  { id: 'trail', title: 'След' },
  { id: 'wave', title: 'Волна' },
  { id: 'ship', title: 'Корабль' },
  { id: 'ufo', title: 'UFO' },
];

const CONTROL_KEYS = new Set([
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'BracketLeft',
  'BracketRight',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'Quote',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const RECORD_KEY = 'dash-practice-records-v1';
const COLORS_KEY = 'dash-practice-colors-v1';
const LEVEL_DURATION = 120_000;
const WIDTH = 960;
const HEIGHT = 540;

function recordKey(choice: Choice) {
  return `${choice.mode}-${choice.difficulty}`;
}

function loadRecords(): RecordMap {
  try {
    const saved = window.localStorage.getItem(RECORD_KEY);
    return saved ? (JSON.parse(saved) as RecordMap) : {};
  } catch {
    return {};
  }
}

function saveRecord(choice: Choice, progress: number) {
  const records = loadRecords();
  const key = recordKey(choice);
  const next = Math.max(records[key] ?? 0, Math.round(progress));
  window.localStorage.setItem(RECORD_KEY, JSON.stringify({ ...records, [key]: next }));
  return next;
}

function loadColors(): ColorSettings {
  try {
    const saved = window.localStorage.getItem(COLORS_KEY);
    return saved ? { ...DEFAULT_COLORS, ...(JSON.parse(saved) as Partial<ColorSettings>) } : DEFAULT_COLORS;
  } catch {
    return DEFAULT_COLORS;
  }
}

function saveColors(colors: ColorSettings) {
  window.localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
}

function seededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

function choiceSeed(choice: Choice) {
  const text = recordKey(choice);
  return text.split('').reduce((total, letter) => total + letter.charCodeAt(0), 17);
}

function buildLevel(choice: Choice): Level {
  const difficulty = DIFFICULTIES.find((item) => item.id === choice.difficulty) ?? DIFFICULTIES[0];
  const speed = choice.difficulty === 'hard' ? 255 : choice.difficulty === 'medium' ? 230 : 210;
  const levelLength = (speed * LEVEL_DURATION) / 1000;
  const random = seededRandom(choiceSeed(choice));
  const obstacles: Obstacle[] = [];
  const orbs: Orb[] = [];
  const spacing = choice.mode === 'wave' ? 470 : choice.mode === 'ship' ? 540 : 500;
  const width = 54 + difficulty.multiplier * 18;

  for (let x = 920; x < levelLength - 900; x += spacing) {
    const gap = Math.max(112, 220 - difficulty.multiplier * 42 - random() * 24);
    const centerWave = choice.mode === 'wave' ? Math.sin(x / 760) * 118 : Math.sin(x / 940) * 86;
    const center = HEIGHT / 2 + centerWave + (random() - 0.5) * 110;
    const topHeight = Math.max(60, center - gap / 2);
    const bottomY = Math.min(HEIGHT - 74, center + gap / 2);
    const bottomHeight = HEIGHT - bottomY - 52;

    obstacles.push({
      x,
      y: 0,
      width,
      height: topHeight,
      color: x % (spacing * 2) < spacing ? '#243b53' : '#7c314f',
    });
    obstacles.push({
      x,
      y: bottomY,
      width,
      height: bottomHeight,
      color: x % (spacing * 2) < spacing ? '#243b53' : '#7c314f',
    });

    if (choice.mode === 'ufo' && random() > 0.45) {
      orbs.push({ x: x + spacing * 0.45, y: 150 + random() * 240, radius: 14 });
    }

    if (random() > (choice.difficulty === 'easy' ? 0.62 : 0.42)) {
      const spikeCount = choice.difficulty === 'hard' ? 3 : choice.difficulty === 'medium' ? 2 : 1;
      const spikeHeight = 32 + difficulty.multiplier * 10;
      const spikeWidth = 38 + difficulty.multiplier * 8;
      const startX = x + spacing * (0.22 + random() * 0.18);
      const fromTop = random() > 0.56;

      for (let index = 0; index < spikeCount; index += 1) {
        obstacles.push({
          kind: 'spike',
          direction: fromTop ? 'down' : 'up',
          x: startX + index * (spikeWidth + 6),
          y: fromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: spikeWidth,
          height: spikeHeight,
          color: fromTop ? '#2f4f74' : '#8f3d58',
        });
      }
    }

    if (choice.difficulty !== 'easy' && random() > 0.58) {
      obstacles.push({
        x: x + spacing * 0.52,
        y: 170 + random() * 190,
        width: width * 0.82,
        height: 46 + random() * 50,
        color: '#3d2c8d',
      });
    }
  }

  return { duration: LEVEL_DURATION, speed, obstacles, orbs };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function collides(player: Player, obstacle: Obstacle, mode: Mode) {
  const size = mode === 'wave' ? 18 : 20;
  const hitboxX = mode === 'wave' ? player.x + 5 : player.x;

  if (obstacle.kind === 'spike') {
    const padding = 5;
    const left = obstacle.x + padding;
    const right = obstacle.x + obstacle.width - padding;
    const baseY = obstacle.direction === 'down' ? obstacle.y : obstacle.y + obstacle.height;
    const tipY = obstacle.direction === 'down' ? obstacle.y + obstacle.height : obstacle.y;
    const centerX = obstacle.x + obstacle.width / 2;
    const triangle = [
      { x: left, y: baseY },
      { x: right, y: baseY },
      { x: centerX, y: tipY },
    ];

    return circleIntersectsTriangle(hitboxX, player.y, size, triangle);
  }

  return (
    hitboxX + size > obstacle.x &&
    hitboxX - size < obstacle.x + obstacle.width &&
    player.y + size > obstacle.y &&
    player.y - size < obstacle.y + obstacle.height
  );
}

function touchesLevelBounds(player: Player, mode: Mode) {
  const size = mode === 'wave' ? 18 : 20;
  return player.y - size <= 0 || player.y + size >= HEIGHT - 52;
}

function circleIntersectsTriangle(
  circleX: number,
  circleY: number,
  radius: number,
  triangle: Array<{ x: number; y: number }>,
) {
  if (pointInTriangle(circleX, circleY, triangle)) return true;

  return triangle.some((point, index) => {
    const next = triangle[(index + 1) % triangle.length];
    return distanceToSegment(circleX, circleY, point.x, point.y, next.x, next.y) <= radius;
  });
}

function pointInTriangle(x: number, y: number, triangle: Array<{ x: number; y: number }>) {
  const [a, b, c] = triangle;
  const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  const alpha = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / area;
  const beta = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / area;
  const gamma = 1 - alpha - beta;
  return alpha >= 0 && beta >= 0 && gamma >= 0;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / length, 0, 1);
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, mode: Mode, active: boolean, colors: ColorSettings) {
  const color = colors[mode];
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  ctx.scale(0.82, 0.82);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 18 : 8;

  if (mode === 'wave') {
    ctx.beginPath();
    ctx.moveTo(27, 0);
    ctx.lineTo(-20, -18);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-20, 18);
    ctx.closePath();
  } else if (mode === 'ship') {
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(8, -16);
    ctx.lineTo(-18, -15);
    ctx.lineTo(-27, -7);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-27, 7);
    ctx.lineTo(-18, 15);
    ctx.lineTo(8, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.ellipse(7, -2, 8, 5, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = active ? '#ffd166' : '#ff9f43';
    ctx.moveTo(-27, -7);
    ctx.lineTo(-45, 0);
    ctx.lineTo(-27, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 18, 0, 0, Math.PI * 2);
    ctx.moveTo(-14, -4);
    ctx.arc(-14, -4, 4, 0, Math.PI * 2);
    ctx.moveTo(14, -4);
    ctx.arc(14, -4, 4, 0, Math.PI * 2);
  }

  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawGame(
  canvas: HTMLCanvasElement,
  level: Level,
  choice: Choice,
  colors: ColorSettings,
  player: Player,
  trail: TrailPoint[],
  attempt: number,
  elapsed: number,
  inputActive: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const progress = clamp(elapsed / level.duration, 0, 1);
  const cameraX = progress * level.speed * (level.duration / 1000);
  const accent = colors[choice.mode];

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, '#111827');
  sky.addColorStop(0.52, '#182236');
  sky.addColorStop(1, '#10151f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = -((cameraX * 0.35) % 80); x < WIDTH; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 60; y < HEIGHT; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, HEIGHT - 52, WIDTH, 52);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(0, HEIGHT - 56, WIDTH, 4);
  ctx.globalAlpha = 1;

  level.obstacles.forEach((obstacle) => {
    const screenX = obstacle.x - cameraX + 140;
    if (screenX < -120 || screenX > WIDTH + 120) return;

    if (obstacle.kind === 'spike') {
      const baseY = obstacle.direction === 'down' ? obstacle.y : obstacle.y + obstacle.height;
      const tipY = obstacle.direction === 'down' ? obstacle.y + obstacle.height : obstacle.y;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(screenX, baseY);
      ctx.lineTo(screenX + obstacle.width / 2, tipY);
      ctx.lineTo(screenX + obstacle.width, baseY);
      ctx.closePath();
      ctx.fillStyle = obstacle.color;
      ctx.shadowColor = obstacle.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.48)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      return;
    }

    ctx.fillStyle = obstacle.color;
    ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX + 1, obstacle.y + 1, obstacle.width - 2, obstacle.height - 2);
  });

  level.orbs.forEach((orb) => {
    const screenX = orb.x - cameraX + 140;
    if (screenX < -40 || screenX > WIDTH + 40) return;
    ctx.beginPath();
    ctx.fillStyle = '#7df9c2';
    ctx.shadowColor = '#7df9c2';
    ctx.shadowBlur = 16;
    ctx.arc(screenX, orb.y, orb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  if (trail.length > 1) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = colors.trail;
    ctx.lineWidth = 4;
    ctx.shadowColor = colors.trail;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    trail.forEach((point, index) => {
      const screenX = point.x - cameraX + 140;
      if (index === 0) {
        ctx.moveTo(screenX, point.y);
      } else {
        ctx.lineTo(screenX, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  }

  drawPlayer(ctx, player, choice.mode, inputActive, colors);

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(24, 22, WIDTH - 48, 10);
  ctx.fillStyle = accent;
  ctx.fillRect(24, 22, (WIDTH - 48) * progress, 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px Inter, system-ui, sans-serif';
  ctx.fillText(`${Math.round(progress * 100)}%`, 24, 66);

  if (progress < 0.045 && attempt > 0) {
    const fade = clamp((0.045 - progress) / 0.02, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, fade);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 42px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.fillText(`Попытка ${attempt}`, WIDTH / 2, 118);
    ctx.restore();
  }
}

function updatePlayer(player: Player, mode: Mode, inputActive: boolean, dt: number) {
  const next = { ...player, cooldown: Math.max(0, player.cooldown - dt) };

  if (mode === 'wave') {
    next.vy = inputActive ? -330 : 330;
    next.y += next.vy * dt;
    next.angle = inputActive ? -0.68 : 0.68;
  }

  if (mode === 'ship') {
    next.vy += (inputActive ? -900 : 710) * dt;
    next.vy = clamp(next.vy, -470, 500);
    next.y += next.vy * dt;
    next.angle = clamp(next.vy / 560, -0.72, 0.72);
  }

  if (mode === 'ufo') {
    if (inputActive && next.cooldown <= 0) {
      next.vy = -360;
      next.cooldown = 0.2;
    }
    next.vy += 760 * dt;
    next.vy = clamp(next.vy, -430, 500);
    next.y += next.vy * dt;
    next.angle += 2.8 * dt;
  }

  next.y = clamp(next.y, 32, HEIGHT - 82);
  return next;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const inputRef = useRef(false);
  const elapsedRef = useRef(0);
  const attemptRef = useRef(0);
  const playerRef = useRef<Player>({ x: 142, y: HEIGHT / 2, vy: 0, angle: 0, cooldown: 0 });
  const trailRef = useRef<TrailPoint[]>([]);
  const [choice, setChoice] = useState<Choice>({ mode: 'wave', difficulty: 'easy' });
  const [screen, setScreen] = useState<Screen>('menu');
  const [records, setRecords] = useState<RecordMap>(() => loadRecords());
  const [colors, setColors] = useState<ColorSettings>(() => loadColors());
  const [lastResult, setLastResult] = useState<{ progress: number; completed: boolean } | null>(null);

  const level = useMemo(() => buildLevel(choice), [choice]);
  const best = records[recordKey(choice)] ?? 0;

  const finishRun = useCallback(
    (progress: number, completed: boolean) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      const saved = saveRecord(choice, completed ? 100 : progress);
      setRecords((current) => ({ ...current, [recordKey(choice)]: saved }));
      setLastResult({ progress: Math.round(completed ? 100 : progress), completed });
      setScreen('result');
    },
    [choice],
  );

  const startRun = () => {
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    trailRef.current = [];
    playerRef.current = { x: 142, y: HEIGHT / 2, vy: 0, angle: 0, cooldown: 0 };
    setLastResult(null);
    setScreen('playing');
  };

  const returnToMenu = () => {
    inputRef.current = false;
    setScreen('menu');
  };

  const updateColor = (target: keyof ColorSettings, value: string) => {
    setColors((current) => {
      const next = { ...current, [target]: value };
      saveColors(next);
      return next;
    });
  };

  useEffect(() => {
    if (screen !== 'playing') return;

    const tick = (time: number) => {
      const lastTime = lastTimeRef.current || time;
      const dt = Math.min((time - lastTime) / 1000, 0.032);
      lastTimeRef.current = time;
      elapsedRef.current += dt * 1000;

      const cameraX = (elapsedRef.current / 1000) * level.speed;
      const player = updatePlayer(playerRef.current, choice.mode, inputRef.current, dt);
      const worldPlayer = { ...player, x: cameraX + player.x - 140 };
      trailRef.current = [...trailRef.current, { x: worldPlayer.x, y: player.y }].slice(-140);
      const hit =
        touchesLevelBounds(player, choice.mode) ||
        level.obstacles.some((obstacle) => collides(worldPlayer, obstacle, choice.mode));

      playerRef.current = player;
      drawGame(
        canvasRef.current!,
        level,
        choice,
        colors,
        player,
        trailRef.current,
        attemptRef.current,
        elapsedRef.current,
        inputRef.current,
      );

      if (hit) {
        finishRun((elapsedRef.current / level.duration) * 100, false);
        return;
      }

      if (elapsedRef.current >= level.duration) {
        finishRun(100, true);
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [choice, colors, finishRun, level, screen]);

  useEffect(() => {
    const isControlKey = (event: KeyboardEvent) => CONTROL_KEYS.has(event.code);
    const activate = (event: KeyboardEvent) => {
      if (!isControlKey(event)) return;
      event.preventDefault();
      inputRef.current = true;
    };
    const release = (event: KeyboardEvent) => {
      if (!isControlKey(event)) return;
      event.preventDefault();
      inputRef.current = false;
    };
    const activatePointer = (event: PointerEvent | TouchEvent) => {
      event.preventDefault();
      inputRef.current = true;
    };
    const releasePointer = (event: PointerEvent | TouchEvent) => {
      event.preventDefault();
      inputRef.current = false;
    };
    window.addEventListener('keydown', activate);
    window.addEventListener('keyup', release);
    window.addEventListener('pointerdown', activatePointer);
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('touchstart', activatePointer, { passive: false });
    window.addEventListener('touchend', releasePointer, { passive: false });
    return () => {
      window.removeEventListener('keydown', activate);
      window.removeEventListener('keyup', release);
      window.removeEventListener('pointerdown', activatePointer);
      window.removeEventListener('pointerup', releasePointer);
      window.removeEventListener('touchstart', activatePointer);
      window.removeEventListener('touchend', releasePointer);
    };
  }, []);

  useEffect(() => {
    if (screen === 'menu' && canvasRef.current) {
      drawGame(canvasRef.current, level, choice, colors, playerRef.current, [], attemptRef.current, 0, false);
    }
  }, [choice, colors, level, screen]);

  useEffect(() => {
    attemptRef.current = 0;
  }, [choice]);

  useEffect(() => {
    if (screen !== 'result') return;

    const restartOnEnter = (event: KeyboardEvent) => {
      if (event.code !== 'Enter') return;
      event.preventDefault();
      startRun();
    };

    window.addEventListener('keydown', restartOnEnter);
    return () => window.removeEventListener('keydown', restartOnEnter);
  }, [screen]);

  return (
    <main className={`game-shell ${screen}`}>
      {screen !== 'result' && screen !== 'colors' && (
        <section className="stage" ref={stageRef}>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Dash practice level" />
          {screen !== 'playing' && <div className="scanline" />}
        </section>
      )}

      {screen === 'menu' && (
        <section className="control-panel" aria-label="Настройки тренировки">
          <div>
            <p className="eyebrow">Dash Practice</p>
            <h1>Тренировка режимов</h1>
          </div>

          <div className="picker">
            {MODES.map((mode) => (
              <button
                className={choice.mode === mode.id ? 'option active' : 'option'}
                key={mode.id}
                onClick={() => setChoice((current) => ({ ...current, mode: mode.id }))}
                type="button"
              >
                <span>{mode.title}</span>
                <small>{mode.subtitle}</small>
              </button>
            ))}
          </div>

          <div className="difficulty-row">
            {DIFFICULTIES.map((difficulty) => (
              <button
                className={choice.difficulty === difficulty.id ? 'chip active' : 'chip'}
                key={difficulty.id}
                onClick={() => setChoice((current) => ({ ...current, difficulty: difficulty.id }))}
                type="button"
              >
                {difficulty.title}
              </button>
            ))}
          </div>

          <div className="score-row">
            <span>Рекорд</span>
            <strong>{best}%</strong>
          </div>


          <button className="start-button" onClick={startRun} type="button">
            Старт
          </button>
          <button className="menu-button" onClick={() => setScreen('colors')} type="button">
            Цвета
          </button>
        </section>
      )}

      {screen === 'colors' && (
        <section className="control-panel colors-panel" aria-label="Настройки цветов">
          <div>
            <p className="eyebrow">Dash Practice</p>
            <h1>Цвета</h1>
          </div>

          <div className="color-settings">
            {COLOR_TARGETS.map((target) => (
              <div className="color-row" key={target.id}>
                <span>{target.title}</span>
                <div className="color-swatches">
                  {COLOR_PALETTE.map((color) => (
                    <button
                      aria-label={`${target.title}: ${color.title}`}
                      className={colors[target.id] === color.value ? 'swatch active' : 'swatch'}
                      key={color.value}
                      onClick={() => updateColor(target.id, color.value)}
                      style={{ backgroundColor: color.value }}
                      title={color.title}
                      type="button"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button className="start-button" onClick={returnToMenu} type="button">
            Меню
          </button>
        </section>
      )}

      {screen === 'result' && lastResult && (
        <section className="control-panel result-panel" aria-label="Результат попытки">
          <div>
            <p className="eyebrow">Dash Practice</p>
            <h1>{lastResult.completed ? 'Уровень пройден' : 'Попытка завершена'}</h1>
          </div>

          <div className={lastResult.completed ? 'result win' : 'result'}>
            <span>Результат</span>
            <strong>{lastResult.progress}%</strong>
          </div>

          <div className="score-row">
            <span>Рекорд</span>
            <strong>{best}%</strong>
          </div>

          <div className="result-actions">
            <button className="start-button" onClick={startRun} type="button">
              Рестарт
            </button>
            <button className="menu-button" onClick={returnToMenu} type="button">
              Меню
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
