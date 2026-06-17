import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Mode = 'wave' | 'flipWave' | 'laser' | 'orbit' | 'ship' | 'ufo';
type Difficulty = 'easy' | 'medium' | 'hard';
type SpeedMode = 'normal' | 'fast' | 'superfast';
type Screen = 'menu' | 'playing' | 'paused' | 'result' | 'colors' | 'mods';

type Choice = {
  mode: Mode;
  difficulty: Difficulty;
};

type Obstacle = {
  kind?: 'block' | 'spike' | 'saw' | 'spikedBlock';
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

type ShadowSnapshot = Player & {
  time: number;
  worldX: number;
};

type RecordMap = Record<string, number>;

type ColorSettings = Record<Mode | 'trail', string>;

type ModificationSettings = {
  upsideDown: boolean;
  splitMode: boolean;
  shadow: boolean;
};

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  { id: 'wave', title: 'Волна', subtitle: 'резкие диагонали' },
  { id: 'flipWave', title: 'Flip Wave', subtitle: 'переключение направления' },
  { id: 'laser', title: 'Вектор', subtitle: 'скоростной плавный полёт' },
  { id: 'orbit', title: 'Орбита', subtitle: 'вращение по синусоиде' },
  { id: 'ship', title: 'Корабль', subtitle: 'плавный полёт' },
  { id: 'ufo', title: 'UFO', subtitle: 'прыжки в воздухе' },
];

const DIFFICULTIES: Array<{ id: Difficulty; title: string; multiplier: number }> = [
  { id: 'easy', title: 'Лёгкий', multiplier: 0.72 },
  { id: 'medium', title: 'Средний', multiplier: 1 },
  { id: 'hard', title: 'Тяжёлый', multiplier: 1.32 },
];

const SPEED_MODES: Array<{ id: SpeedMode; title: string; multiplier: number }> = [
  { id: 'normal', title: 'Нормальная', multiplier: 1 },
  { id: 'fast', title: 'Быстрая', multiplier: 1.18 },
  { id: 'superfast', title: 'Супербыстрая', multiplier: 1.36 },
];

const DEFAULT_COLORS: ColorSettings = {
  trail: '#2563eb',
  wave: '#2563eb',
  laser: '#16a34a',
  flipWave: '#9333ea',
  orbit: '#f97316',
  ship: '#dc2626',
  ufo: '#facc15',
};

function getModeColor(colors: ColorSettings, mode: Mode) {
  return colors[mode] || DEFAULT_COLORS[mode];
}

function getTrailColor(colors: ColorSettings) {
  return colors.trail || DEFAULT_COLORS.trail;
}

const DEFAULT_MODIFICATIONS: ModificationSettings = {
  upsideDown: false,
  splitMode: false,
  shadow: false,
};

const COLOR_PALETTE: Array<{ title: string; value: string }> = [
  { title: 'Белый', value: '#ffffff' },
  { title: 'Чёрный', value: '#050505' },
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
  { id: 'flipWave', title: 'Flip Wave' },
  { id: 'laser', title: 'Вектор' },
  { id: 'orbit', title: 'Орбита' },
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
const MODIFICATIONS_KEY = 'dash-practice-modifications-v1';
const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_DEFAULT_X = 142;
const PLAYER_SHADOW_MAX_X = WIDTH - 116;
const SHADOW_DELAY_MS = 2_000;
const PLAYER_MIN_Y = 32;
const PLAYER_MAX_Y = HEIGHT - 82;
const PLAYER_CENTER_Y = (PLAYER_MIN_Y + PLAYER_MAX_Y) / 2;
const SPLIT_PLAYER_OFFSET = 62;
const TRAIL_MAX_POINTS = 360;
const ORBIT_RADIUS_X = 42;
const ORBIT_RADIUS_Y = 78;
const ORBIT_SPEED = 3.35;

function getPlayerStartX(shadowEnabled: boolean, levelSpeed: number) {
  return shadowEnabled
    ? Math.min(PLAYER_SHADOW_MAX_X, PLAYER_DEFAULT_X + levelSpeed * (SHADOW_DELAY_MS / 1000))
    : PLAYER_DEFAULT_X;
}

function findDelayedShadowSnapshot(history: ShadowSnapshot[], elapsed: number) {
  const targetTime = elapsed - SHADOW_DELAY_MS;
  return [...history].reverse().find((point) => point.time <= targetTime) ?? null;
}

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
    if (!saved) return DEFAULT_COLORS;
    const merged = { ...DEFAULT_COLORS, ...(JSON.parse(saved) as Partial<ColorSettings>) };
    saveColors(merged);
    return merged;
  } catch {
    return DEFAULT_COLORS;
  }
}

function saveColors(colors: ColorSettings) {
  window.localStorage.setItem(COLORS_KEY, JSON.stringify(colors));
}

function loadModifications(): ModificationSettings {
  try {
    const saved = window.localStorage.getItem(MODIFICATIONS_KEY);
    return saved
      ? { ...DEFAULT_MODIFICATIONS, ...(JSON.parse(saved) as Partial<ModificationSettings>) }
      : DEFAULT_MODIFICATIONS;
  } catch {
    return DEFAULT_MODIFICATIONS;
  }
}

function saveModifications(modifications: ModificationSettings) {
  window.localStorage.setItem(MODIFICATIONS_KEY, JSON.stringify(modifications));
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

function levelDurationByDifficulty(difficulty: Difficulty) {
  if (difficulty === 'easy') return 60_000;
  if (difficulty === 'medium') return 90_000;
  return 120_000;
}

function buildLevel(choice: Choice, speedMode: SpeedMode, splitMode: boolean): Level {
  const difficulty = DIFFICULTIES.find((item) => item.id === choice.difficulty) ?? DIFFICULTIES[0];
  const speedSettings = SPEED_MODES.find((item) => item.id === speedMode) ?? SPEED_MODES[0];
  const baseSpeed = choice.difficulty === 'hard' ? 255 : choice.difficulty === 'medium' ? 230 : 210;
  const speed = baseSpeed * speedSettings.multiplier;
  const duration = levelDurationByDifficulty(choice.difficulty);
  const levelLength = (speed * duration) / 1000;
  const random = seededRandom(choiceSeed(choice));
  const obstacles: Obstacle[] = [];
  const orbs: Orb[] = [];
  if (!splitMode && choice.mode === 'ship' && choice.difficulty === 'medium') {
    const spacing = 455;
    const width = 64;

    for (let x = 900; x < levelLength - 850; x += spacing) {
      const section = Math.floor(x / spacing);
      const gap = 172 + Math.sin(section * 0.85) * 14;
      const center =
        HEIGHT / 2 +
        Math.sin(x / 1120) * 92 +
        Math.sin(x / 470) * 24 +
        (random() - 0.5) * 34;
      const topHeight = Math.max(58, center - gap / 2);
      const bottomY = Math.min(HEIGHT - 76, center + gap / 2);
      const bottomHeight = HEIGHT - bottomY - 52;
      const color = section % 2 === 0 ? '#243b53' : '#7c314f';

      obstacles.push({ x, y: 0, width, height: topHeight, color });
      obstacles.push({ x, y: bottomY, width, height: bottomHeight, color });

      if (section % 3 !== 1) {
        obstacles.push({
          kind: 'saw',
          x: x + spacing * 0.55,
          y: center - 22 + (section % 2 === 0 ? -54 : 54),
          width: 38,
          height: 38,
          color: '#d9e2ec',
        });
      }

      if (section % 3 === 0) {
        obstacles.push({
          kind: 'saw',
          x: x + spacing * 0.82,
          y: center + (section % 2 === 0 ? 58 : -58),
          width: 34,
          height: 34,
          color: '#d9e2ec',
        });
      }

      if (section % 4 === 2 || section % 5 === 1) {
        obstacles.push({
          kind: 'spikedBlock',
          x: x + spacing * (section % 5 === 1 ? 0.68 : 0.34),
          y: center + (section % 2 === 0 ? -34 : 16),
          width: 50,
          height: 46,
          color: '#6842c2',
        });
      }

      if (section % 5 === 0) {
        const spikeHeight = 34;
        obstacles.push({
          kind: 'spike',
          direction: section % 2 === 0 ? 'up' : 'down',
          x: x + spacing * 0.22,
          y: section % 2 === 0 ? HEIGHT - 52 - spikeHeight : 0,
          width: 42,
          height: spikeHeight,
          color: section % 2 === 0 ? '#8f3d58' : '#2f4f74',
        });
      }
    }

    return { duration, speed, obstacles, orbs };
  }

  const isFlipWave = choice.mode === 'flipWave';
  const isLaser = choice.mode === 'laser';
  const isOrbit = choice.mode === 'orbit';
  const spacing = splitMode ? 560 : isFlipWave ? 520 : isLaser ? 460 : isOrbit ? 500 : choice.mode === 'wave' ? 410 : choice.mode === 'ship' ? 470 : 440;
  const width = splitMode ? 54 + difficulty.multiplier * 12 : isFlipWave || isOrbit ? 54 + difficulty.multiplier * 12 : 62 + difficulty.multiplier * 20;

  for (let x = 920; x < levelLength - 900; x += spacing) {
    const splitGap = choice.difficulty === 'hard' ? 248 : choice.difficulty === 'medium' ? 270 : 296;
    const flipGap = choice.difficulty === 'hard' ? 176 : choice.difficulty === 'medium' ? 202 : 230;
    const orbitGap = choice.difficulty === 'hard' ? 182 : choice.difficulty === 'medium' ? 210 : 238;
    const normalGap = Math.max(96, 198 - difficulty.multiplier * 44 - random() * 26);
    const gap = splitMode ? splitGap : isFlipWave ? flipGap : isOrbit ? orbitGap : normalGap;
    const splitWave = Math.sin(x / 980) * (choice.difficulty === 'hard' ? 40 : 30);
    const centerWave = splitMode
      ? splitWave
      : choice.mode === 'wave'
        ? Math.sin(x / 760) * 118
        : isLaser
          ? Math.sin(x / 880) * 86
        : isOrbit
          ? Math.sin(x / 700) * 96 + Math.sin(x / 340) * 28
        : isFlipWave
          ? Math.sin(x / 980) * 62
        : Math.sin(x / 940) * 86;
    const centerNoise = splitMode ? (random() - 0.5) * 34 : isFlipWave || isOrbit ? (random() - 0.5) * 42 : (random() - 0.5) * 110;
    const center = (splitMode ? PLAYER_CENTER_Y : HEIGHT / 2) + centerWave + centerNoise;
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

    if (choice.mode === 'ufo' && random() > 0.38) {
      orbs.push({ x: x + spacing * 0.45, y: 150 + random() * 240, radius: 14 });
    }

    if (random() > (splitMode ? 0.66 : isFlipWave || isOrbit ? 0.68 : choice.difficulty === 'easy' ? 0.48 : 0.26)) {
      const spikeCount = choice.difficulty === 'hard' ? 4 : choice.difficulty === 'medium' ? 3 : 2;
      const spikeHeight = splitMode ? 26 + difficulty.multiplier * 6 : 32 + difficulty.multiplier * 10;
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

    if (!splitMode && !isFlipWave && !isOrbit && choice.difficulty !== 'easy' && random() > 0.42) {
      obstacles.push({
        x: x + spacing * 0.52,
        y: 170 + random() * 190,
        width: width * 0.82,
        height: 46 + random() * 50,
        color: '#3d2c8d',
      });
    }

    if (!splitMode && isFlipWave && choice.difficulty !== 'easy' && random() > 0.64) {
      obstacles.push({
        x: x + spacing * (0.45 + random() * 0.2),
        y: 178 + random() * 170,
        width: width * 0.72,
        height: 38 + random() * 36,
        color: '#3d2c8d',
      });
    }

    if (!splitMode && isOrbit && choice.difficulty !== 'easy' && random() > 0.58) {
      obstacles.push({
        x: x + spacing * (0.44 + random() * 0.18),
        y: 156 + random() * 210,
        width: width * 0.72,
        height: 36 + random() * 34,
        color: '#3d2c8d',
      });
    }

    if (random() > (splitMode ? 0.62 : isFlipWave || isOrbit ? 0.72 : 0.38)) {
      const sawSize = splitMode ? 34 + difficulty.multiplier * 4 : isFlipWave || isOrbit ? 34 + difficulty.multiplier * 5 : 42 + difficulty.multiplier * 8;
      obstacles.push({
        kind: 'saw',
        x: x + spacing * (0.46 + random() * 0.22),
        y: splitMode ? 190 + random() * 130 : isFlipWave || isOrbit ? 158 + random() * 210 : 128 + random() * 260,
        width: sawSize,
        height: sawSize,
        color: '#d9e2ec',
      });
    }

    if (random() > (splitMode ? 0.78 : isFlipWave || isOrbit ? 0.78 : choice.difficulty === 'easy' ? 0.7 : 0.48)) {
      obstacles.push({
        kind: 'spikedBlock',
        x: x + spacing * (0.3 + random() * 0.35),
        y: splitMode ? 218 + random() * 80 : isFlipWave || isOrbit ? 164 + random() * 190 : 132 + random() * 230,
        width: splitMode ? 42 : isFlipWave || isOrbit ? 42 + difficulty.multiplier * 6 : 52 + difficulty.multiplier * 8,
        height: splitMode ? 42 : isFlipWave || isOrbit ? 40 + difficulty.multiplier * 6 : 46 + difficulty.multiplier * 8,
        color: '#6842c2',
      });
    }
  }

  return { duration, speed, obstacles, orbs };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function collides(player: Player, obstacle: Obstacle, mode: Mode) {
  const isWaveLike = mode === 'wave' || mode === 'flipWave';
  const size = isWaveLike ? 16 : mode === 'laser' || mode === 'orbit' ? 18 : 20;
  const hitboxX = isWaveLike ? player.x + 5 : player.x;

  if (obstacle.kind === 'saw') {
    const sawX = obstacle.x + obstacle.width / 2;
    const sawY = obstacle.y + obstacle.height / 2;
    const sawRadius = obstacle.width / 2 - 4;
    return Math.hypot(hitboxX - sawX, player.y - sawY) <= size + sawRadius;
  }

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

  if (obstacle.kind === 'spikedBlock') {
    const inset = 4;
    return (
      hitboxX + size > obstacle.x + inset &&
      hitboxX - size < obstacle.x + obstacle.width - inset &&
      player.y + size > obstacle.y + inset &&
      player.y - size < obstacle.y + obstacle.height - inset
    );
  }

  return (
    hitboxX + size > obstacle.x &&
    hitboxX - size < obstacle.x + obstacle.width &&
    player.y + size > obstacle.y &&
    player.y - size < obstacle.y + obstacle.height
  );
}

function touchesLevelBounds(player: Player, mode: Mode) {
  const size = mode === 'wave' || mode === 'flipWave' ? 16 : mode === 'laser' || mode === 'orbit' ? 18 : 20;
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

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  mode: Mode,
  active: boolean,
  colors: ColorSettings,
  upsideDown: boolean,
) {
  const color = getModeColor(colors, mode);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  const scale = mode === 'wave' || mode === 'flipWave' ? 0.74 : mode === 'orbit' ? 0.78 : 0.82;
  ctx.scale(scale, upsideDown ? -scale : scale);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = active ? 18 : 8;

  if (mode === 'laser') {
    ctx.beginPath();
    ctx.moveTo(38, 0);
    ctx.lineTo(10, -12);
    ctx.lineTo(-18, -10);
    ctx.lineTo(-30, -4);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-30, 4);
    ctx.lineTo(-18, 10);
    ctx.lineTo(10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.ellipse(9, -2, 7, 4, -0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = active ? getTrailColor(colors) : 'rgba(255,255,255,0.72)';
    ctx.moveTo(-28, -4);
    ctx.lineTo(-52, 0);
    ctx.lineTo(-28, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  } else if (mode === 'orbit') {
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.82)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(10, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = active ? getTrailColor(colors) : 'rgba(255,255,255,0.82)';
    ctx.arc(-18, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  } else if (mode === 'wave' || mode === 'flipWave') {
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
  modifications: ModificationSettings,
  player: Player,
  trail: TrailPoint[],
  splitPlayer: Player | null,
  splitTrail: TrailPoint[],
  shadowSnapshot: ShadowSnapshot | null,
  splitShadowSnapshot: ShadowSnapshot | null,
  shadowTeleportsLeft: number,
  shadowCooldownUntil: number,
  attempt: number,
  elapsed: number,
  inputActive: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  const progress = clamp(elapsed / level.duration, 0, 1);
  const cameraX = progress * level.speed * (level.duration / 1000);
  const accent = getModeColor(colors, choice.mode);

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

    if (obstacle.kind === 'saw') {
      const centerX = screenX + obstacle.width / 2;
      const centerY = obstacle.y + obstacle.height / 2;
      const radius = obstacle.width / 2;
      const teeth = 14;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(cameraX / 34);
      ctx.beginPath();
      for (let index = 0; index < teeth * 2; index += 1) {
        const angle = (index / (teeth * 2)) * Math.PI * 2;
        const pointRadius = index % 2 === 0 ? radius : radius * 0.68;
        const px = Math.cos(angle) * pointRadius;
        const py = Math.sin(angle) * pointRadius;
        if (index === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
      ctx.fillStyle = obstacle.color;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = '#111827';
      ctx.arc(0, 0, radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (obstacle.kind === 'spikedBlock') {
      const tooth = 9;
      ctx.save();
      ctx.fillStyle = obstacle.color;
      ctx.shadowColor = obstacle.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(screenX, obstacle.y, obstacle.width, obstacle.height);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.44)';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX + 1, obstacle.y + 1, obstacle.width - 2, obstacle.height - 2);
      ctx.fillStyle = '#d9e2ec';
      for (let px = screenX + 4; px < screenX + obstacle.width - 4; px += tooth) {
        ctx.beginPath();
        ctx.moveTo(px, obstacle.y);
        ctx.lineTo(px + tooth / 2, obstacle.y - tooth);
        ctx.lineTo(px + tooth, obstacle.y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, obstacle.y + obstacle.height);
        ctx.lineTo(px + tooth / 2, obstacle.y + obstacle.height + tooth);
        ctx.lineTo(px + tooth, obstacle.y + obstacle.height);
        ctx.closePath();
        ctx.fill();
      }
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

  const drawTrail = (points: TrailPoint[], color: string) => {
    if (points.length <= 1) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    points.forEach((point, index) => {
      const screenX = point.x - cameraX + 140;
      if (index === 0) {
        ctx.moveTo(screenX, point.y);
      } else {
        ctx.lineTo(screenX, point.y);
      }
    });
    ctx.stroke();
    ctx.restore();
  };

  drawTrail(trail, getTrailColor(colors));

  const drawOrbitGuide = (orbitPlayer: Player | null, splitDirection: 1 | -1) => {
    if (choice.mode !== 'orbit' || !orbitPlayer) return;
    const gravityDirection = (modifications.upsideDown ? -1 : 1) * splitDirection;
    const centerX = orbitPlayer.x - Math.cos(orbitPlayer.cooldown) * ORBIT_RADIUS_X;
    const centerY = orbitPlayer.y - Math.sin(orbitPlayer.cooldown) * ORBIT_RADIUS_Y * gravityDirection;
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, ORBIT_RADIUS_X, ORBIT_RADIUS_Y, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  drawOrbitGuide(player, 1);

  if (modifications.splitMode) {
    drawOrbitGuide(splitPlayer, -1);
  }

  const drawShadow = (snapshot: ShadowSnapshot | null, upsideDown: boolean) => {
    if (!modifications.shadow || !snapshot) return;
    const shadowX = snapshot.worldX - cameraX + 140;
    if (shadowX <= -80 || shadowX >= WIDTH + 80) return;
    const shadowColors: ColorSettings = {
      trail: 'rgba(156, 163, 175, 0.58)',
      wave: 'rgba(156, 163, 175, 0.58)',
      flipWave: 'rgba(156, 163, 175, 0.58)',
      laser: 'rgba(156, 163, 175, 0.58)',
      orbit: 'rgba(156, 163, 175, 0.58)',
      ship: 'rgba(156, 163, 175, 0.58)',
      ufo: 'rgba(156, 163, 175, 0.58)',
    };
    ctx.save();
    ctx.globalAlpha = 0.58;
    drawPlayer(ctx, { ...snapshot, x: shadowX }, choice.mode, false, shadowColors, upsideDown);
    ctx.restore();
  };

  drawShadow(shadowSnapshot, modifications.upsideDown);

  if (modifications.splitMode) {
    drawShadow(splitShadowSnapshot, !modifications.upsideDown);
  }

  drawPlayer(ctx, player, choice.mode, inputActive, colors, modifications.upsideDown);

  if (modifications.splitMode && splitPlayer) {
    const splitColors = {
      ...colors,
      trail: getModeColor(colors, choice.mode),
      [choice.mode]: getTrailColor(colors),
    };
    drawTrail(splitTrail, splitColors.trail);
    drawPlayer(ctx, splitPlayer, choice.mode, inputActive, splitColors, !modifications.upsideDown);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(24, 22, WIDTH - 48, 10);
  ctx.fillStyle = accent;
  ctx.fillRect(24, 22, (WIDTH - 48) * progress, 10);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 24px Inter, system-ui, sans-serif';
  ctx.fillText(`${Math.round(progress * 100)}%`, 24, 66);

  if (modifications.shadow) {
    const cooldownLeft = Math.max(0, Math.ceil(shadowCooldownUntil - elapsed));
    ctx.fillStyle = 'rgba(10,15,27,0.68)';
    ctx.fillRect(WIDTH - 190, 22, 166, 64);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(WIDTH - 190, 22, 166, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Тень: ${shadowTeleportsLeft}`, WIDTH - 107, 48);
    ctx.font = '700 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = cooldownLeft > 0 ? '#facc15' : '#7df9c2';
    ctx.fillText(
      cooldownLeft > 0 ? `КД: ${(cooldownLeft / 1000).toFixed(1).replace('.', ',')} с` : 'КД: готово',
      WIDTH - 107,
      70,
    );
    ctx.textAlign = 'start';
  }

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

function updatePlayer(
  player: Player,
  mode: Mode,
  inputActive: boolean,
  ufoJumpQueued: boolean,
  upsideDown: boolean,
  splitDirection: 1 | -1,
  dt: number,
) {
  const next = mode === 'orbit' ? { ...player } : { ...player, cooldown: Math.max(0, player.cooldown - dt) };
  const gravityDirection = (upsideDown ? -1 : 1) * splitDirection;

  if (mode === 'wave') {
    next.vy = (inputActive ? -330 : 330) * gravityDirection;
    next.y += next.vy * dt;
    next.angle = (inputActive ? -0.68 : 0.68) * gravityDirection;
  }

  if (mode === 'flipWave') {
    if (Math.abs(next.vy) < 1) {
      next.vy = 330 * gravityDirection;
    }
    if (ufoJumpQueued) {
      next.vy = -next.vy;
    }
    next.y += next.vy * dt;
    next.angle = next.vy < 0 ? -0.68 : 0.68;
  }

  if (mode === 'laser') {
    const targetVy = (inputActive ? -330 : 330) * gravityDirection;
    const response = 12;
    next.vy += (targetVy - next.vy) * Math.min(1, response * dt);
    next.y += next.vy * dt;
    next.angle = clamp(next.vy / 500, -0.62, 0.62);
  }

  if (mode === 'orbit') {
    const direction = Math.abs(next.vy) < 0.01 ? 1 : Math.sign(next.vy);
    const nextDirection = ufoJumpQueued ? -direction : direction;
    const previousPhase = next.cooldown;
    const nextPhase = previousPhase + nextDirection * ORBIT_SPEED * dt;
    next.x += (Math.cos(nextPhase) - Math.cos(previousPhase)) * ORBIT_RADIUS_X;
    next.y += (Math.sin(nextPhase) - Math.sin(previousPhase)) * ORBIT_RADIUS_Y * gravityDirection;
    next.vy = nextDirection;
    next.cooldown = nextPhase;
    next.angle = nextPhase * 0.9 * gravityDirection;
  }

  if (mode === 'ship') {
    next.vy += (inputActive ? -900 : 710) * gravityDirection * dt;
    next.vy = clamp(next.vy, -470, 500);
    next.y += next.vy * dt;
    next.angle = clamp(next.vy / 560, -0.72, 0.72);
  }

  if (mode === 'ufo') {
    if (ufoJumpQueued && next.cooldown <= 0) {
      next.vy = -360 * gravityDirection;
      next.cooldown = 0.2;
    }
    next.vy += 760 * gravityDirection * dt;
    next.vy = clamp(next.vy, -430, 500);
    next.y += next.vy * dt;
    next.angle += 2.8 * dt;
  }

  const minY = PLAYER_MIN_Y;
  const maxY = PLAYER_MAX_Y;
  const slidesOnBounds = mode === 'wave' || mode === 'flipWave' || mode === 'laser' || mode === 'orbit';
  if (!slidesOnBounds && next.y <= minY && next.vy < 0) {
    next.vy = 0;
  }
  if (!slidesOnBounds && next.y >= maxY && next.vy > 0) {
    next.vy = 0;
  }
  next.y = clamp(next.y, minY, maxY);
  return next;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const inputRef = useRef(false);
  const ufoJumpQueuedRef = useRef(false);
  const elapsedRef = useRef(0);
  const attemptRef = useRef(0);
  const playerRef = useRef<Player>({ x: PLAYER_DEFAULT_X, y: PLAYER_CENTER_Y, vy: 0, angle: 0, cooldown: 0 });
  const splitPlayerRef = useRef<Player>({
    x: PLAYER_DEFAULT_X,
    y: PLAYER_CENTER_Y + SPLIT_PLAYER_OFFSET,
    vy: 0,
    angle: 0,
    cooldown: 0,
  });
  const trailRef = useRef<TrailPoint[]>([]);
  const splitTrailRef = useRef<TrailPoint[]>([]);
  const shadowHistoryRef = useRef<ShadowSnapshot[]>([]);
  const splitShadowHistoryRef = useRef<ShadowSnapshot[]>([]);
  const shadowSnapshotRef = useRef<ShadowSnapshot | null>(null);
  const splitShadowSnapshotRef = useRef<ShadowSnapshot | null>(null);
  const shadowTeleportsLeftRef = useRef(5);
  const shadowCooldownUntilRef = useRef(0);
  const [choice, setChoice] = useState<Choice>({ mode: 'wave', difficulty: 'easy' });
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');
  const [screen, setScreen] = useState<Screen>('menu');
  const [records, setRecords] = useState<RecordMap>(() => loadRecords());
  const [colors, setColors] = useState<ColorSettings>(() => loadColors());
  const [modifications, setModifications] = useState<ModificationSettings>(() => loadModifications());
  const [lastResult, setLastResult] = useState<{ progress: number; completed: boolean } | null>(null);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [speedPickerOpen, setSpeedPickerOpen] = useState(false);

  const level = useMemo(() => buildLevel(choice, speedMode, modifications.splitMode), [choice, speedMode, modifications.splitMode]);
  const best = records[recordKey(choice)] ?? 0;
  const selectedMode = MODES.find((mode) => mode.id === choice.mode) ?? MODES[0];
  const selectedSpeed = SPEED_MODES.find((speed) => speed.id === speedMode) ?? SPEED_MODES[0];

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
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    trailRef.current = [];
    splitTrailRef.current = [];
    shadowHistoryRef.current = [];
    splitShadowHistoryRef.current = [];
    shadowSnapshotRef.current = null;
    splitShadowSnapshotRef.current = null;
    shadowTeleportsLeftRef.current = 5;
    shadowCooldownUntilRef.current = 0;
    const playerStartX = getPlayerStartX(modifications.shadow, level.speed);
    playerRef.current = {
      x: playerStartX,
      y: modifications.splitMode ? PLAYER_CENTER_Y - SPLIT_PLAYER_OFFSET : PLAYER_CENTER_Y,
      vy: 0,
      angle: 0,
      cooldown: 0,
    };
    splitPlayerRef.current = {
      x: playerStartX,
      y: PLAYER_CENTER_Y + SPLIT_PLAYER_OFFSET,
      vy: 0,
      angle: 0,
      cooldown: 0,
    };
    setLastResult(null);
    setScreen('playing');
  };

  const pauseRun = () => {
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    setScreen('paused');
  };

  const resumeRun = () => {
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    setScreen('playing');
  };

  const returnToMenu = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setScreen('menu');
  };

  const updateColor = (target: keyof ColorSettings, value: string) => {
    setColors((current) => {
      const next = { ...current, [target]: value };
      saveColors(next);
      return next;
    });
  };

  const toggleUpsideDown = () => {
    setModifications((current) => {
      const next = { ...current, upsideDown: !current.upsideDown };
      saveModifications(next);
      return next;
    });
  };

  const toggleSplitMode = () => {
    setModifications((current) => {
      const next = { ...current, splitMode: !current.splitMode };
      saveModifications(next);
      return next;
    });
  };

  const toggleShadow = () => {
    setModifications((current) => {
      const next = { ...current, shadow: !current.shadow };
      saveModifications(next);
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
      const player = updatePlayer(
        playerRef.current,
        choice.mode,
        inputRef.current,
        ufoJumpQueuedRef.current,
        modifications.upsideDown,
        1,
        dt,
      );
      const splitPlayer = modifications.splitMode
        ? updatePlayer(
            splitPlayerRef.current,
            choice.mode,
            inputRef.current,
            ufoJumpQueuedRef.current,
            modifications.upsideDown,
            -1,
            dt,
          )
        : null;
      ufoJumpQueuedRef.current = false;
      const worldPlayer = { ...player, x: cameraX + player.x - 140 };
      const worldSplitPlayer = splitPlayer ? { ...splitPlayer, x: cameraX + splitPlayer.x - 140 } : null;
      trailRef.current = [...trailRef.current, { x: worldPlayer.x, y: player.y }].slice(-TRAIL_MAX_POINTS);
      if (modifications.shadow) {
        shadowHistoryRef.current = [
          ...shadowHistoryRef.current,
          { ...player, time: elapsedRef.current, worldX: worldPlayer.x },
        ].filter((point) => elapsedRef.current - point.time <= 14_000);
        splitShadowHistoryRef.current =
          splitPlayer && worldSplitPlayer
            ? [
                ...splitShadowHistoryRef.current,
                { ...splitPlayer, time: elapsedRef.current, worldX: worldSplitPlayer.x },
              ].filter((point) => elapsedRef.current - point.time <= 14_000)
            : [];
        const visibleShadow =
          shadowTeleportsLeftRef.current > 0 && elapsedRef.current >= shadowCooldownUntilRef.current;
        shadowSnapshotRef.current = visibleShadow
          ? findDelayedShadowSnapshot(shadowHistoryRef.current, elapsedRef.current)
          : null;
        splitShadowSnapshotRef.current =
          visibleShadow && splitPlayer
            ? findDelayedShadowSnapshot(splitShadowHistoryRef.current, elapsedRef.current)
            : null;
      } else {
        shadowSnapshotRef.current = null;
        splitShadowSnapshotRef.current = null;
      }
      if (splitPlayer && worldSplitPlayer) {
        splitTrailRef.current = [...splitTrailRef.current, { x: worldSplitPlayer.x, y: splitPlayer.y }].slice(-TRAIL_MAX_POINTS);
      }
      const hit =
        touchesLevelBounds(player, choice.mode) ||
        level.obstacles.some((obstacle) => collides(worldPlayer, obstacle, choice.mode)) ||
        (splitPlayer !== null &&
          worldSplitPlayer !== null &&
          (touchesLevelBounds(splitPlayer, choice.mode) ||
            level.obstacles.some((obstacle) => collides(worldSplitPlayer, obstacle, choice.mode))));

      playerRef.current = player;
      if (splitPlayer) {
        splitPlayerRef.current = splitPlayer;
      }
      drawGame(
        canvasRef.current!,
        level,
        choice,
        colors,
        modifications,
        player,
        trailRef.current,
        splitPlayer,
        splitTrailRef.current,
        shadowSnapshotRef.current,
        splitShadowSnapshotRef.current,
        shadowTeleportsLeftRef.current,
        shadowCooldownUntilRef.current,
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
  }, [choice, colors, finishRun, level, modifications, screen]);

  useEffect(() => {
    const isControlKey = (event: KeyboardEvent) => CONTROL_KEYS.has(event.code);
    const activate = (event: KeyboardEvent) => {
      if (!isControlKey(event)) return;
      event.preventDefault();
      if (!inputRef.current) {
        ufoJumpQueuedRef.current = true;
      }
      inputRef.current = true;
    };
    const release = (event: KeyboardEvent) => {
      if (!isControlKey(event)) return;
      event.preventDefault();
      inputRef.current = false;
    };
    const activatePointer = (event: PointerEvent | TouchEvent) => {
      event.preventDefault();
      if (!inputRef.current) {
        ufoJumpQueuedRef.current = true;
      }
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
      drawGame(
        canvasRef.current,
        level,
        choice,
        colors,
        modifications,
        playerRef.current,
        [],
        null,
        [],
        null,
        null,
        shadowTeleportsLeftRef.current,
        0,
        attemptRef.current,
        0,
        false,
      );
    }
  }, [choice, colors, level, modifications, screen]);

  useEffect(() => {
    attemptRef.current = 0;
  }, [choice, speedMode, modifications.splitMode]);

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

  useEffect(() => {
    if (screen !== 'paused') return;

    const resumeOnEnter = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Backspace') return;
      event.preventDefault();
      resumeRun();
    };

    window.addEventListener('keydown', resumeOnEnter);
    return () => window.removeEventListener('keydown', resumeOnEnter);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;

    const pauseOnBackspace = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Backspace') return;
      event.preventDefault();
      pauseRun();
    };

    window.addEventListener('keydown', pauseOnBackspace);
    return () => window.removeEventListener('keydown', pauseOnBackspace);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing' || !modifications.shadow) return;

    const teleportToShadow = (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== 'AltLeft' && event.code !== 'AltRight')) return;
      event.preventDefault();
      const shadow = findDelayedShadowSnapshot(shadowHistoryRef.current, elapsedRef.current);
      if (!shadow || shadowTeleportsLeftRef.current <= 0 || elapsedRef.current < shadowCooldownUntilRef.current) return;
      const splitShadow = modifications.splitMode
        ? findDelayedShadowSnapshot(splitShadowHistoryRef.current, elapsedRef.current)
        : null;
      elapsedRef.current = shadow.time;
      lastTimeRef.current = 0;
      playerRef.current = {
        ...playerRef.current,
        x: shadow.x,
        y: shadow.y,
        vy: shadow.vy,
        angle: shadow.angle,
        cooldown: shadow.cooldown,
      };
      if (splitShadow) {
        splitPlayerRef.current = {
          ...splitPlayerRef.current,
          x: splitShadow.x,
          y: splitShadow.y,
          vy: splitShadow.vy,
          angle: splitShadow.angle,
          cooldown: splitShadow.cooldown,
        };
      }
      shadowHistoryRef.current = shadowHistoryRef.current.filter((point) => point.time <= shadow.time);
      splitShadowHistoryRef.current = splitShadowHistoryRef.current.filter((point) => point.time <= shadow.time);
      trailRef.current = shadowHistoryRef.current.map((point) => ({ x: point.worldX, y: point.y })).slice(-TRAIL_MAX_POINTS);
      splitTrailRef.current = splitShadowHistoryRef.current
        .map((point) => ({ x: point.worldX, y: point.y }))
        .slice(-TRAIL_MAX_POINTS);
      shadowTeleportsLeftRef.current -= 1;
      shadowCooldownUntilRef.current = elapsedRef.current + 10_000;
      shadowSnapshotRef.current = null;
      splitShadowSnapshotRef.current = null;
    };

    window.addEventListener('keydown', teleportToShadow);
    return () => window.removeEventListener('keydown', teleportToShadow);
  }, [screen, modifications.shadow, modifications.splitMode]);

  return (
    <main className={`game-shell ${screen}`}>
      {screen !== 'result' && screen !== 'colors' && screen !== 'mods' && (
        <section className="stage" ref={stageRef}>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Dash practice level" />
          {screen !== 'playing' && screen !== 'paused' && <div className="scanline" />}
          {screen === 'playing' && (
            <button className="pause-button" onClick={pauseRun} type="button">
              Пауза
            </button>
          )}
          {screen === 'paused' && (
            <div className="pause-overlay" role="dialog" aria-label="Пауза">
              <span>Пауза</span>
              <div className="pause-actions">
                <button className="start-button" onClick={resumeRun} type="button">
                  Старт
                </button>
                <button className="menu-button" onClick={returnToMenu} type="button">
                  Меню
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {screen === 'menu' && (
        <section className="control-panel" aria-label="Настройки тренировки">
          <div>
            <p className="eyebrow">Dash Practice</p>
          </div>

          <div className="menu-action-row">
          <button
            className="option mode-trigger"
            onClick={() => {
              setSpeedPickerOpen(false);
              setModePickerOpen(true);
            }}
            type="button"
          >
            <span>Режимы</span>
            <small>{selectedMode.title}</small>
          </button>

          <button
            className="option mode-trigger"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(true);
            }}
            type="button"
          >
            <span>Скорость</span>
            <small>{selectedSpeed.title}</small>
          </button>

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
          <div className="secondary-action-row">
          <button
            className="menu-button"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setScreen('colors');
            }}
            type="button"
          >
            Цвета
          </button>
            <button
              className="menu-button"
              onClick={() => {
                setModePickerOpen(false);
                setSpeedPickerOpen(false);
                setScreen('mods');
              }}
              type="button"
            >
              Модификации
            </button>
          </div>
        </section>
      )}

      {screen === 'menu' && modePickerOpen && (
        <div className="modal-backdrop" onClick={() => setModePickerOpen(false)} role="presentation">
          <section className="mode-modal" aria-label="Выбор режима" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">Dash Practice</p>
              <h1>Режимы</h1>
            </div>

            <div className="picker">
              {MODES.map((mode) => (
                <button
                  className={choice.mode === mode.id ? 'option active' : 'option'}
                  key={mode.id}
                  onClick={() => {
                    setChoice((current) => ({ ...current, mode: mode.id }));
                    setModePickerOpen(false);
                  }}
                  type="button"
                >
                  <span>{mode.title}</span>
                  <small>{mode.subtitle}</small>
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => setModePickerOpen(false)} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'menu' && speedPickerOpen && (
        <div className="modal-backdrop" onClick={() => setSpeedPickerOpen(false)} role="presentation">
          <section className="mode-modal" aria-label="Выбор скорости" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">Dash Practice</p>
              <h1>Скорость</h1>
            </div>

            <div className="picker">
              {SPEED_MODES.map((speed) => (
                <button
                  className={speedMode === speed.id ? 'option active' : 'option'}
                  key={speed.id}
                  onClick={() => {
                    setSpeedMode(speed.id);
                    setSpeedPickerOpen(false);
                  }}
                  type="button"
                >
                  <span>{speed.title}</span>
                  <small>{Math.round(speed.multiplier * 100)}%</small>
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => setSpeedPickerOpen(false)} type="button">
              Закрыть
            </button>
          </section>
        </div>
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

      {screen === 'mods' && (
        <section className="control-panel mods-panel" aria-label="Модификации">
          <div>
            <p className="eyebrow">Dash Practice</p>
            <h1>Модификации</h1>
          </div>

          <div className="mods-list">
            <button
              className={modifications.upsideDown ? 'mod-option active' : 'mod-option'}
              onClick={toggleUpsideDown}
              type="button"
            >
              <span>Upside down</span>
              <small>{modifications.upsideDown ? 'Включено' : 'Выключено'}</small>
            </button>
            <button
              className={modifications.splitMode ? 'mod-option active' : 'mod-option'}
              onClick={toggleSplitMode}
              type="button"
            >
              <span>Split mode</span>
              <small>{modifications.splitMode ? 'Включено' : 'Выключено'}</small>
            </button>
            <button
              className={modifications.shadow ? 'mod-option active' : 'mod-option'}
              onClick={toggleShadow}
              type="button"
            >
              <span>Тень</span>
              <small>{modifications.shadow ? 'Включено' : 'Выключено'}</small>
            </button>
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
