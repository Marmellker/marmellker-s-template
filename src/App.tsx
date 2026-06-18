import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

type Mode = 'wave' | 'flipWave' | 'laser' | 'orbit' | 'ship' | 'ufo';
type Difficulty = 'easy' | 'medium' | 'hard';
type SpeedMode = 'normal' | 'fast' | 'superfast';
type Screen = 'home' | 'menu' | 'playing' | 'paused' | 'result' | 'colors' | 'mods';
type AuthMode = 'signin' | 'signup';

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

type Point = {
  x: number;
  y: number;
};

type OrientedRect = {
  points: Point[];
};

type ShadowSnapshot = Player & {
  time: number;
  worldX: number;
};

type PracticeCheckpoint = {
  time: number;
  player: Player;
  splitPlayer: Player | null;
  worldX: number;
  y: number;
};

type DeathAnimation = {
  startedAt: number;
  progress: number;
  player: Player;
  splitPlayer: Player | null;
  levelProgress: number;
};

type WinAnimation = {
  startedAt: number;
  progress: number;
  player: Player;
  splitPlayer: Player | null;
};

type TeleportEffect = {
  startedAt: number;
  progress: number;
  from: Point;
  to: Point;
  splitFrom: Point | null;
  splitTo: Point | null;
};

type RecordMap = Record<string, number>;

type ColorSettings = Record<Mode | 'trail', string>;

type HomePreview = {
  choice: Choice;
  elapsed: number;
  percent: number;
  colors: ColorSettings;
};

type SavedPausedRun = {
  choice: Choice;
  speedMode: SpeedMode;
  practiceMode: boolean;
  modifications: ModificationSettings;
  elapsed: number;
  attempt: number;
  player: Player;
  splitPlayer: Player;
  trail: TrailPoint[];
  splitTrail: TrailPoint[];
  shadowHistory: ShadowSnapshot[];
  splitShadowHistory: ShadowSnapshot[];
  shadowTeleportsLeft: number;
  shadowCooldownUntil: number;
  checkpoints: PracticeCheckpoint[];
  lastCheckpointAt: number;
  nextAutoCheckpointAt: number;
};

type ModificationSettings = {
  upsideDown: boolean;
  splitMode: boolean;
  shadow: boolean;
  showHitboxes: boolean;
};

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  { id: 'wave', title: 'Волна', subtitle: 'резкие диагонали' },
  { id: 'flipWave', title: 'Flip Wave', subtitle: 'переключение направления' },
  { id: 'laser', title: 'Вектор', subtitle: 'скоростной плавный полёт' },
  { id: 'orbit', title: 'Орбита', subtitle: 'вращение по пунктирной орбите' },
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
  showHitboxes: false,
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
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const RECORD_KEY = 'dash-practice-records-v1';
const COLORS_KEY = 'dash-practice-colors-v1';
const MODIFICATIONS_KEY = 'dash-practice-modifications-v1';
const PAUSED_RUN_KEY = 'beatshift-paused-run-v1';
const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_DEFAULT_X = 142;
const PLAYER_SHADOW_MAX_X = WIDTH - 116;
const SHADOW_DELAY_MS = 2_000;
const SHADOW_FADE_MS = 600;
const PRACTICE_CHECKPOINT_COOLDOWN_MS = 2_000;
const PRACTICE_AUTO_CHECKPOINT_MS = 5_000;
const PRACTICE_RESPAWN_DELAY_MS = 500;
const DEATH_ANIMATION_MS = 900;
const WIN_ANIMATION_MS = 1_000;
const TELEPORT_EFFECT_MS = 520;
const MODAL_FADE_OUT_MS = 180;
const PLAYER_MIN_Y = 32;
const PLAYER_MAX_Y = HEIGHT - 82;
const PLAYER_CENTER_Y = (PLAYER_MIN_Y + PLAYER_MAX_Y) / 2;
const SPLIT_PLAYER_OFFSET = 62;
const TRAIL_MAX_POINTS = 360;
const ORBIT_RADIUS_X = 42;
const ORBIT_RADIUS_Y = 78;
const ORBIT_SPEED = 3.35;

function pickDifferent<T>(items: T[], previous?: T) {
  const variants = previous === undefined ? items : items.filter((item) => item !== previous);
  return variants[Math.floor(Math.random() * variants.length)] ?? items[0];
}

function createHomePreview(previous?: HomePreview): HomePreview {
  const mode = pickDifferent(
    MODES.map((item) => item.id),
    previous?.choice.mode,
  );
  const difficulty = DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)].id;
  const previewLevel = buildLevel({ mode, difficulty }, 'normal', false);
  const percent = 15 + Math.floor(Math.random() * 66);
  const palette = COLOR_PALETTE.map((color) => color.value);
  const previousTrail = previous?.colors.trail;
  const previousModel = previous ? getModeColor(previous.colors, previous.choice.mode) : undefined;
  const trailColor = pickDifferent(palette, previousTrail);
  const modelColor = pickDifferent(
    palette.filter((color) => color !== trailColor),
    previousModel,
  );
  return {
    choice: { mode, difficulty },
    elapsed: (previewLevel.duration * percent) / 100,
    percent,
    colors: {
      ...DEFAULT_COLORS,
      trail: trailColor,
      [mode]: modelColor,
    },
  };
}

function getPreviewPathY(mode: Mode, elapsed: number) {
  const center = PLAYER_CENTER_Y;
  if (mode === 'wave' || mode === 'flipWave') {
    const period = mode === 'wave' ? 680 : 560;
    const phase = ((elapsed % period) + period) % period;
    const t = phase / period;
    const triangle = t < 0.5 ? t * 2 : 2 - t * 2;
    return center - 108 + triangle * 216;
  }
  if (mode === 'ufo') {
    const period = 820;
    const phase = (((elapsed % period) + period) % period) / period;
    const hop = 1 - (phase * 2 - 1) ** 2;
    return center + 94 - hop * 158 + Math.sin(elapsed / 1320) * 20;
  }
  if (mode === 'ship') {
    return center + Math.sin(elapsed / 520) * 92 + Math.sin(elapsed / 1240) * 28;
  }
  if (mode === 'laser') {
    return center + Math.sin(elapsed / 700) * 104;
  }
  if (mode === 'orbit') {
    return center + Math.sin(elapsed / 420) * 78;
  }
  return center;
}

function getWavePreviewDirection(mode: Mode, elapsed: number) {
  const period = mode === 'wave' ? 680 : 560;
  const phase = (((elapsed % period) + period) % period) / period;
  return phase < 0.5 ? 1 : -1;
}

function getSafePreviewY(level: Level, cameraX: number, baseY: number) {
  const playerWorldX = cameraX + PLAYER_DEFAULT_X - 140;
  const marginX = 72;
  const marginY = 54;
  const minY = PLAYER_MIN_Y + 18;
  const maxY = PLAYER_MAX_Y - 18;
  const blockers = level.obstacles.filter(
    (obstacle) => playerWorldX >= obstacle.x - marginX && playerWorldX <= obstacle.x + obstacle.width + marginX,
  );
  const candidates = [
    baseY,
    PLAYER_CENTER_Y,
    PLAYER_CENTER_Y - 116,
    PLAYER_CENTER_Y + 116,
    PLAYER_MIN_Y + 84,
    PLAYER_MAX_Y - 84,
    PLAYER_CENTER_Y - 58,
    PLAYER_CENTER_Y + 58,
    ...Array.from({ length: 13 }, (_, index) => minY + ((maxY - minY) * index) / 12),
  ].map((candidate) => clamp(candidate, minY, maxY));

  return (
    candidates.find((candidate) =>
      blockers.every((obstacle) => candidate < obstacle.y - marginY || candidate > obstacle.y + obstacle.height + marginY),
    ) ?? PLAYER_CENTER_Y
  );
}

function buildPreviewTrail(mode: Mode, cameraX: number, elapsed: number, currentY: number) {
  if (mode === 'wave' || mode === 'flipWave') {
    const minY = PLAYER_MIN_Y + 38;
    const maxY = PLAYER_MAX_Y - 38;
    let y = clamp(currentY, minY, maxY);
    let direction = getWavePreviewDirection(mode, elapsed);
    const slope = Math.tan(0.68);

    return Array.from({ length: 52 }, (_, index) => {
      if (index > 0) {
        y -= direction * 18 * slope;
        if (y <= minY) {
          y = minY + (minY - y);
          direction = -direction;
        }
        if (y >= maxY) {
          y = maxY - (y - maxY);
          direction = -direction;
        }
      }

      return {
        x: cameraX + PLAYER_DEFAULT_X - 140 - index * 18,
        y,
      };
    });
  }

  const baseY = getPreviewPathY(mode, elapsed);
  const yOffset = currentY - baseY;
  return Array.from({ length: 52 }, (_, index) => {
    const pointElapsed = elapsed - index * 58;
    return {
      x: cameraX + PLAYER_DEFAULT_X - 140 - index * 18,
      y: clamp(getPreviewPathY(mode, pointElapsed) + yOffset, PLAYER_MIN_Y + 8, PLAYER_MAX_Y - 8),
    };
  });
}

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

function loadPausedRun(): SavedPausedRun | null {
  try {
    const saved = window.sessionStorage.getItem(PAUSED_RUN_KEY);
    return saved ? (JSON.parse(saved) as SavedPausedRun) : null;
  } catch {
    return null;
  }
}

function clearPausedRun() {
  try {
    window.sessionStorage.removeItem(PAUSED_RUN_KEY);
  } catch {
    // В приватном режиме sessionStorage может быть недоступен.
  }
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

  if (!splitMode && choice.mode === 'wave' && choice.difficulty === 'hard') {
    const spacing = 360;
    const width = 64;
    const centers = [270, 188, 332, 214, 306, 158, 360, 242, 326, 182, 292, 214];

    for (let x = 880; x < levelLength - 860; x += spacing) {
      const section = Math.floor((x - 880) / spacing);
      const center =
        centers[section % centers.length] +
        Math.sin(section * 0.72) * 18 +
        Math.sin(x / 560) * 12;
      const gap = 150 + Math.sin(section * 0.9) * 12;
      const topHeight = Math.max(54, center - gap / 2);
      const bottomY = Math.min(HEIGHT - 78, center + gap / 2);
      const bottomHeight = HEIGHT - bottomY - 52;
      const color = section % 2 === 0 ? '#243b53' : '#7c314f';

      obstacles.push({ x, y: 0, width, height: topHeight, color });
      obstacles.push({ x, y: bottomY, width, height: bottomHeight, color });

      const spikeHeight = 36;
      const spikeWidth = 42;
      const spikeFromTop = section % 3 === 1;
      for (let index = 0; index < (section % 4 === 0 ? 3 : 2); index += 1) {
        obstacles.push({
          kind: 'spike',
          direction: spikeFromTop ? 'down' : 'up',
          x: x + 108 + index * (spikeWidth + 7),
          y: spikeFromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: spikeWidth,
          height: spikeHeight,
          color: spikeFromTop ? '#2f4f74' : '#8f3d58',
        });
      }

      if (section % 2 === 0) {
        obstacles.push({
          kind: 'saw',
          x: x + 210,
          y: center + (section % 4 === 0 ? -76 : 52),
          width: 42,
          height: 42,
          color: '#d9e2ec',
        });
      } else {
        obstacles.push({
          x: x + 186,
          y: center + (section % 4 === 1 ? 48 : -88),
          width: 54,
          height: 44,
          color: '#3d2c8d',
        });
      }

      if (section % 3 !== 2) {
        obstacles.push({
          kind: 'spikedBlock',
          x: x + 270,
          y: center + (section % 2 === 0 ? 18 : -66),
          width: 46,
          height: 42,
          color: '#6842c2',
        });
      }

      if (section % 5 === 3) {
        obstacles.push({
          kind: 'saw',
          x: x + 308,
          y: center + (section % 2 === 0 ? 64 : -96),
          width: 36,
          height: 36,
          color: '#d9e2ec',
        });
      }
    }

    return { duration, speed, obstacles, orbs };
  }

  if (!splitMode && choice.mode === 'orbit' && choice.difficulty === 'hard') {
    const spacing = 470;
    const width = 54;
    const centers = [270, 230, 304, 352, 286, 214, 176, 248, 322, 364, 296, 222];

    for (let x = 900; x < levelLength - 900; x += spacing) {
      const section = Math.floor((x - 900) / spacing);
      const center =
        centers[section % centers.length] +
        Math.sin(section * 0.72) * 14 +
        Math.sin(x / 760) * 8;
      const gap = 218 + Math.sin(section * 0.8) * 12;
      const topHeight = Math.max(58, center - gap / 2);
      const bottomY = Math.min(HEIGHT - 76, center + gap / 2);
      const bottomHeight = HEIGHT - bottomY - 52;
      const color = section % 2 === 0 ? '#243b53' : '#7c314f';

      obstacles.push({ x, y: 0, width, height: topHeight, color });
      obstacles.push({ x, y: bottomY, width, height: bottomHeight, color });

      const spikeHeight = 32;
      const spikeWidth = 38;
      const fromTop = section % 5 === 1 || section % 5 === 4;
      for (let index = 0; index < (section % 6 === 2 ? 3 : 2); index += 1) {
        obstacles.push({
          kind: 'spike',
          direction: fromTop ? 'down' : 'up',
          x: x + 72 + index * (spikeWidth + 10),
          y: fromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: spikeWidth,
          height: spikeHeight,
          color: fromTop ? '#2f4f74' : '#8f3d58',
        });
      }

      obstacles.push({
        kind: 'saw',
        x: x + 178,
        y: center + (section % 4 === 0 ? -82 : section % 4 === 1 ? 66 : section % 4 === 2 ? -46 : 34),
        width: 34,
        height: 34,
        color: '#d9e2ec',
      });

      if (section % 3 !== 1) {
        obstacles.push({
          x: x + 264,
          y: center + (section % 2 === 0 ? 76 : -118),
          width: 44,
          height: 34,
          color: '#3d2c8d',
        });
      }

      obstacles.push({
        kind: 'spikedBlock',
        x: x + 350,
        y: center + (section % 4 === 0 ? 58 : section % 4 === 1 ? -106 : section % 4 === 2 ? 88 : -82),
        width: 40,
        height: 38,
        color: '#6842c2',
      });

      if (section % 4 === 1 || section % 7 === 4) {
        obstacles.push({
          kind: 'saw',
          x: x + 410,
          y: center + (section % 2 === 0 ? -118 : 96),
          width: 30,
          height: 30,
          color: '#d9e2ec',
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
  if (isWaveLike) {
    const hitboxes = getWaveHitboxes(player);
    return (
      circleCollidesObstacle(hitboxes.nose.x, hitboxes.nose.y, hitboxes.nose.radius, obstacle) ||
      orientedRectCollidesObstacle(hitboxes.tail, obstacle)
    );
  }

  if (mode === 'laser' || mode === 'ship') {
    return polygonCollidesObstacle(getFlattenedHitbox(player, mode).points, obstacle);
  }

  const size = getCircularHitboxRadius(mode);
  return circleCollidesObstacle(player.x, player.y, size, obstacle);
}

function touchesLevelBounds(player: Player, mode: Mode) {
  if (mode === 'wave' || mode === 'flipWave') {
    const hitboxes = getWaveHitboxes(player);
    return (
      hitboxes.nose.y - hitboxes.nose.radius <= 0 ||
      hitboxes.nose.y + hitboxes.nose.radius >= HEIGHT - 52 ||
      hitboxes.tail.points.some((point) => point.y <= 0 || point.y >= HEIGHT - 52)
    );
  }

  if (mode === 'laser' || mode === 'ship') {
    return getFlattenedHitbox(player, mode).points.some((point) => point.y <= 0 || point.y >= HEIGHT - 52);
  }

  const size = getCircularHitboxRadius(mode);
  return player.y - size <= 0 || player.y + size >= HEIGHT - 52;
}

function getCircularHitboxRadius(mode: Mode) {
  return mode === 'orbit' ? 18 : 20;
}

function rotateAroundPlayer(player: Player, x: number, y: number) {
  const cos = Math.cos(player.angle);
  const sin = Math.sin(player.angle);
  return {
    x: player.x + x * cos - y * sin,
    y: player.y + x * sin + y * cos,
  };
}

function getWaveHitboxes(player: Player) {
  return {
    nose: {
      ...rotateAroundPlayer(player, 11, 0),
      radius: 10,
    },
    tail: {
      points: [
        rotateAroundPlayer(player, -16, -5),
        rotateAroundPlayer(player, 2, -5),
        rotateAroundPlayer(player, 2, 5),
        rotateAroundPlayer(player, -16, 5),
      ],
    },
  };
}

function getFlattenedHitbox(player: Player, mode: Mode) {
  const radiusX = mode === 'ship' ? 27 : 25;
  const radiusY = mode === 'ship' ? 12 : 11;
  const points = Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return rotateAroundPlayer(player, Math.cos(angle) * radiusX, Math.sin(angle) * radiusY);
  });
  return { radiusX, radiusY, points };
}

function circleCollidesObstacle(circleX: number, circleY: number, radius: number, obstacle: Obstacle) {
  if (obstacle.kind === 'saw') {
    const sawX = obstacle.x + obstacle.width / 2;
    const sawY = obstacle.y + obstacle.height / 2;
    const sawRadius = obstacle.width / 2 - 4;
    return Math.hypot(circleX - sawX, circleY - sawY) <= radius + sawRadius;
  }

  if (obstacle.kind === 'spike') {
    return circleIntersectsTriangle(circleX, circleY, radius, spikeTriangle(obstacle));
  }

  if (obstacle.kind === 'spikedBlock') {
    const inset = 4;
    return (
      circleX + radius > obstacle.x + inset &&
      circleX - radius < obstacle.x + obstacle.width - inset &&
      circleY + radius > obstacle.y + inset &&
      circleY - radius < obstacle.y + obstacle.height - inset
    );
  }

  return (
    circleX + radius > obstacle.x &&
    circleX - radius < obstacle.x + obstacle.width &&
    circleY + radius > obstacle.y &&
    circleY - radius < obstacle.y + obstacle.height
  );
}

function orientedRectCollidesObstacle(rect: OrientedRect, obstacle: Obstacle) {
  return polygonCollidesObstacle(rect.points, obstacle);
}

function polygonCollidesObstacle(points: Point[], obstacle: Obstacle) {
  if (obstacle.kind === 'saw') {
    const sawX = obstacle.x + obstacle.width / 2;
    const sawY = obstacle.y + obstacle.height / 2;
    const sawRadius = obstacle.width / 2 - 4;
    return polygonIntersectsCircle(points, sawX, sawY, sawRadius);
  }

  if (obstacle.kind === 'spike') {
    return polygonsIntersect(points, spikeTriangle(obstacle));
  }

  const inset = obstacle.kind === 'spikedBlock' ? 4 : 0;
  return polygonIntersectsRect(points, {
    x: obstacle.x + inset,
    y: obstacle.y + inset,
    width: obstacle.width - inset * 2,
    height: obstacle.height - inset * 2,
  });
}

function spikeTriangle(obstacle: Obstacle) {
  const padding = 5;
  const left = obstacle.x + padding;
  const right = obstacle.x + obstacle.width - padding;
  const baseY = obstacle.direction === 'down' ? obstacle.y : obstacle.y + obstacle.height;
  const tipY = obstacle.direction === 'down' ? obstacle.y + obstacle.height : obstacle.y;
  const centerX = obstacle.x + obstacle.width / 2;
  return [
    { x: left, y: baseY },
    { x: right, y: baseY },
    { x: centerX, y: tipY },
  ];
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

function polygonIntersectsCircle(points: Point[], circleX: number, circleY: number, radius: number) {
  return (
    pointInPolygon({ x: circleX, y: circleY }, points) ||
    points.some((point, index) => {
      const next = points[(index + 1) % points.length];
      return distanceToSegment(circleX, circleY, point.x, point.y, next.x, next.y) <= radius;
    })
  );
}

function polygonIntersectsRect(points: Point[], rect: { x: number; y: number; width: number; height: number }) {
  const rectPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  return polygonsIntersect(points, rectPoints);
}

function polygonsIntersect(first: Point[], second: Point[]) {
  const firstEdges = first.map((point, index) => [point, first[(index + 1) % first.length]] as const);
  const secondEdges = second.map((point, index) => [point, second[(index + 1) % second.length]] as const);

  return (
    first.some((point) => pointInPolygon(point, second)) ||
    second.some((point) => pointInPolygon(point, first)) ||
    firstEdges.some(([a, b]) => secondEdges.some(([c, d]) => segmentsIntersect(a, b, c, d)))
  );
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crosses =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
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

function segmentsIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) {
  const direction = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
    (r.x - p.x) * (q.y - p.y) - (q.x - p.x) * (r.y - p.y);
  const d1 = direction(c, d, a);
  const d2 = direction(c, d, b);
  const d3 = direction(a, b, c);
  const d4 = direction(a, b, d);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
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

function drawHitbox(ctx: CanvasRenderingContext2D, player: Player, mode: Mode) {
  ctx.save();
  ctx.strokeStyle = '#22d3ee';
  ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 8;

  if (mode === 'wave' || mode === 'flipWave') {
    const hitboxes = getWaveHitboxes(player);
    ctx.beginPath();
    ctx.arc(hitboxes.nose.x, hitboxes.nose.y, hitboxes.nose.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    hitboxes.tail.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (mode === 'laser' || mode === 'ship') {
    const hitbox = getFlattenedHitbox(player, mode);
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, hitbox.radiusX, hitbox.radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, getCircularHitboxRadius(mode), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawDeathEffect(
  ctx: CanvasRenderingContext2D,
  player: Player,
  modelColor: string,
  trailColor: string,
  progress: number,
) {
  const particleColors = [modelColor, trailColor, '#ffffff'];
  const eased = 1 - (1 - progress) ** 3;
  ctx.save();
  ctx.translate(player.x, player.y);

  for (let index = 0; index < 14; index += 1) {
    const angle = (index / 14) * Math.PI * 2 + player.angle * 0.35;
    const distance = 10 + eased * (34 + (index % 5) * 8);
    const size = 5 + (index % 3) * 2;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + progress * 5);
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.92);
    ctx.fillStyle = particleColors[index % particleColors.length];
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.font = '900 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 + progress * 1.7;
    const distance = 28 + eased * (30 + (index % 4) * 7);
    const flicker = Math.sin(progress * 34 + index * 1.7);
    const digit = Math.floor(progress * 12 + index) % 2 === 0 ? '1' : '0';
    ctx.globalAlpha = clamp(0.28 + Math.abs(flicker) * 0.62 - progress * 0.16, 0, 0.95);
    ctx.fillStyle = digit === '1' ? modelColor : trailColor;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.fillText(digit, Math.cos(angle) * distance, Math.sin(angle) * distance);
  }

  ctx.globalAlpha = Math.max(0, 0.55 - progress * 0.55);
  ctx.strokeStyle = trailColor;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, 22 + eased * 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTeleportEffect(
  ctx: CanvasRenderingContext2D,
  effect: TeleportEffect,
  cameraX: number,
  modelColor: string,
  trailColor: string,
) {
  const drawBurst = (point: Point, reverse = false) => {
    const screenX = point.x - cameraX + 140;
    if (screenX < -120 || screenX > WIDTH + 120) return;
    const eased = 1 - (1 - effect.progress) ** 3;
    const alpha = Math.max(0, 1 - effect.progress);
    ctx.save();
    ctx.translate(screenX, point.y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = reverse ? trailColor : modelColor;
    ctx.fillStyle = reverse ? modelColor : trailColor;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3;
    for (let index = 0; index < 3; index += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 18 + eased * (22 + index * 14), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.font = '900 16px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let index = 0; index < 10; index += 1) {
      const angle = (index / 10) * Math.PI * 2 + effect.progress * 2.6;
      const distance = 20 + eased * (20 + (index % 3) * 8);
      ctx.globalAlpha = alpha * (0.4 + (index % 2) * 0.32);
      ctx.fillStyle = index % 2 === 0 ? trailColor : modelColor;
      ctx.fillText(index % 2 === 0 ? '0' : '1', Math.cos(angle) * distance, Math.sin(angle) * distance);
    }
    ctx.restore();
  };

  const drawBeam = (from: Point, to: Point) => {
    const fromX = from.x - cameraX + 140;
    const toX = to.x - cameraX + 140;
    if ((fromX < -160 && toX < -160) || (fromX > WIDTH + 160 && toX > WIDTH + 160)) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.45 - effect.progress * 0.45);
    ctx.strokeStyle = trailColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.shadowColor = trailColor;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(fromX, from.y);
    ctx.lineTo(toX, to.y);
    ctx.stroke();
    ctx.restore();
  };

  drawBeam(effect.from, effect.to);
  drawBurst(effect.from, true);
  drawBurst(effect.to);
  if (effect.splitFrom && effect.splitTo) {
    drawBeam(effect.splitFrom, effect.splitTo);
    drawBurst(effect.splitFrom, true);
    drawBurst(effect.splitTo);
  }
}

function drawWinEffect(
  ctx: CanvasRenderingContext2D,
  player: Player,
  mode: Mode,
  colors: ColorSettings,
  progress: number,
) {
  const modelColor = getModeColor(colors, mode);
  const trailColor = getTrailColor(colors);
  const eased = 1 - (1 - progress) ** 3;
  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.globalAlpha = Math.max(0, 0.82 - progress * 0.45);
  ctx.strokeStyle = trailColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = trailColor;
  ctx.shadowBlur = 18;
  for (let index = 0; index < 4; index += 1) {
    ctx.beginPath();
    ctx.arc(0, 0, 22 + eased * (34 + index * 18), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let index = 0; index < 22; index += 1) {
    const angle = (index / 22) * Math.PI * 2 + progress * 2.4;
    const distance = 18 + eased * (48 + (index % 5) * 9);
    const size = 4 + (index % 4);
    ctx.save();
    ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance);
    ctx.rotate(angle + progress * 4);
    ctx.globalAlpha = Math.max(0, 1 - progress * 0.72);
    ctx.fillStyle = index % 2 === 0 ? modelColor : trailColor;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 14;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  ctx.font = '900 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2 - progress * 1.8;
    const distance = 34 + eased * (36 + (index % 3) * 10);
    ctx.globalAlpha = Math.max(0, 0.9 - progress * 0.4);
    ctx.fillStyle = index % 2 === 0 ? trailColor : modelColor;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.fillText(index % 2 === 0 ? '1' : '0', Math.cos(angle) * distance, Math.sin(angle) * distance);
  }

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
  practiceMode: boolean,
  checkpoints: PracticeCheckpoint[],
  deathAnimation: DeathAnimation | null,
  winAnimation: WinAnimation | null,
  attempt: number,
  elapsed: number,
  inputActive: boolean,
  showHud = true,
  teleportEffect: TeleportEffect | null = null,
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

  if (!showHud) {
    drawTrail(trail, getTrailColor(colors));
  }

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
      const toothPadding = 4;
      const toothCount = Math.max(1, Math.floor((obstacle.width - toothPadding * 2) / tooth));
      const teethWidth = toothCount * tooth;
      const teethStartX = screenX + (obstacle.width - teethWidth) / 2;
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
      for (let index = 0; index < toothCount; index += 1) {
        const px = teethStartX + index * tooth;
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

  if (showHud) {
    drawTrail(trail, getTrailColor(colors));
  }

  if (practiceMode) {
    checkpoints.forEach((checkpoint) => {
      const checkpointX = checkpoint.worldX - cameraX + 140;
      if (checkpointX < -40 || checkpointX > WIDTH + 40) return;
      ctx.save();
      ctx.translate(checkpointX, checkpoint.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 12;
      ctx.fillRect(-8, -8, 16, 16);
      ctx.shadowBlur = 0;
      ctx.strokeRect(-8, -8, 16, 16);
      ctx.restore();
    });
  }

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
    const shadowVisibleSince = Math.max(SHADOW_DELAY_MS, shadowCooldownUntil);
    const fade = clamp((elapsed - shadowVisibleSince) / SHADOW_FADE_MS, 0, 1);
    if (fade <= 0) return;
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
    ctx.globalAlpha = 0.58 * fade;
    drawPlayer(ctx, { ...snapshot, x: shadowX }, choice.mode, false, shadowColors, upsideDown);
    ctx.restore();
  };

  drawShadow(shadowSnapshot, modifications.upsideDown);

  if (modifications.splitMode) {
    drawShadow(splitShadowSnapshot, !modifications.upsideDown);
  }

  if (teleportEffect) {
    drawTeleportEffect(ctx, teleportEffect, cameraX, getModeColor(colors, choice.mode), getTrailColor(colors));
  }

  if (deathAnimation) {
    drawDeathEffect(
      ctx,
      deathAnimation.player,
      getModeColor(colors, choice.mode),
      getTrailColor(colors),
      deathAnimation.progress,
    );
  } else {
    drawPlayer(ctx, player, choice.mode, inputActive, colors, modifications.upsideDown);
    if (winAnimation) {
      drawWinEffect(ctx, player, choice.mode, colors, winAnimation.progress);
    }
  }
  if (modifications.showHitboxes && !deathAnimation) {
    drawHitbox(ctx, player, choice.mode);
  }

  if (modifications.splitMode && splitPlayer) {
    const splitColors = {
      ...colors,
      trail: getModeColor(colors, choice.mode),
      [choice.mode]: getTrailColor(colors),
    };
    drawTrail(splitTrail, splitColors.trail);
    if (deathAnimation?.splitPlayer) {
      drawDeathEffect(
        ctx,
        deathAnimation.splitPlayer,
        getModeColor(splitColors, choice.mode),
        getTrailColor(splitColors),
        deathAnimation.progress,
      );
    } else {
      drawPlayer(ctx, splitPlayer, choice.mode, inputActive, splitColors, !modifications.upsideDown);
      if (winAnimation?.splitPlayer) {
        drawWinEffect(ctx, splitPlayer, choice.mode, splitColors, winAnimation.progress);
      }
    }
    if (modifications.showHitboxes && !deathAnimation) {
      drawHitbox(ctx, splitPlayer, choice.mode);
    }
  }

  if (showHud) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(24, 22, WIDTH - 48, 10);
    ctx.fillStyle = accent;
    ctx.fillRect(24, 22, (WIDTH - 48) * progress, 10);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(`${Math.round(progress * 100)}%`, 24, 66);
  }

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

  if (showHud && progress < 0.045 && attempt > 0) {
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

async function saveAccount(user: User) {
  if (!supabase) return;

  const metadata = user.user_metadata;
  const provider = user.app_metadata.provider;
  const { error } = await supabase.from('accounts').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: metadata.full_name ?? metadata.name ?? metadata.user_name ?? null,
      avatar_url: metadata.avatar_url ?? metadata.picture ?? null,
      provider: typeof provider === 'string' ? provider : null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn('Не удалось сохранить аккаунт в Supabase:', error.message);
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const homePreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const checkpointsRef = useRef<PracticeCheckpoint[]>([]);
  const lastCheckpointAtRef = useRef(-PRACTICE_CHECKPOINT_COOLDOWN_MS);
  const nextAutoCheckpointAtRef = useRef(PRACTICE_AUTO_CHECKPOINT_MS);
  const practiceRespawnUntilRef = useRef(0);
  const deathAnimationRef = useRef<DeathAnimation | null>(null);
  const winAnimationRef = useRef<WinAnimation | null>(null);
  const teleportEffectRef = useRef<TeleportEffect | null>(null);
  const [choice, setChoice] = useState<Choice>({ mode: 'wave', difficulty: 'easy' });
  const [homePreview, setHomePreview] = useState<HomePreview>(() => createHomePreview());
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');
  const [practiceMode, setPracticeMode] = useState(false);
  const [screen, setScreen] = useState<Screen>('home');
  const [records, setRecords] = useState<RecordMap>(() => loadRecords());
  const [colors, setColors] = useState<ColorSettings>(() => loadColors());
  const [modifications, setModifications] = useState<ModificationSettings>(() => loadModifications());
  const [lastResult, setLastResult] = useState<{ progress: number; completed: boolean } | null>(null);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [speedPickerOpen, setSpeedPickerOpen] = useState(false);
  const [difficultyPickerOpen, setDifficultyPickerOpen] = useState(false);
  const [controlsPickerOpen, setControlsPickerOpen] = useState(false);
  const [menuAnimationDisabled, setMenuAnimationDisabled] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [checkpointButtonActive, setCheckpointButtonActive] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const level = useMemo(() => buildLevel(choice, speedMode, modifications.splitMode), [choice, speedMode, modifications.splitMode]);
  const homePreviewLevel = useMemo(() => buildLevel(homePreview.choice, 'normal', false), [homePreview.choice]);
  const best = records[recordKey(choice)] ?? 0;
  const selectedMode = MODES.find((mode) => mode.id === choice.mode) ?? MODES[0];
  const selectedSpeed = SPEED_MODES.find((speed) => speed.id === speedMode) ?? SPEED_MODES[0];
  const selectedDifficulty = DIFFICULTIES.find((difficulty) => difficulty.id === choice.difficulty) ?? DIFFICULTIES[0];
  const previewMode = MODES.find((mode) => mode.id === homePreview.choice.mode) ?? MODES[0];
  const userEmail = session?.user.email ?? '';

  const openAuth = (mode: AuthMode) => {
    setModalClosing(false);
    setAuthMode(mode);
    setAuthMessage('');
  };

  const closeAuth = () => {
    setAuthMode(null);
    setAuthMessage('');
    setAuthPassword('');
  };

  const closeModalWithFade = (close: () => void) => {
    if (modalClosing) return;
    setModalClosing(true);
    window.setTimeout(() => {
      close();
      setModalClosing(false);
    }, MODAL_FADE_OUT_MS);
  };

  const continueAsGuest = () => {
    closeAuth();
    setMenuAnimationDisabled(false);
    setScreen('menu');
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authMode) return;
    if (!supabase) {
      setAuthMessage('Supabase не настроен. Можно играть без аккаунта.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage('');
    const credentials = { email: authEmail.trim(), password: authPassword };
    const { data, error } =
      authMode === 'signup'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setAuthMessage(error.message);
    } else {
      if (data.user) {
        await saveAccount(data.user);
      }
      setAuthMessage(authMode === 'signup' ? 'Аккаунт создан. Если Supabase попросит подтверждение, проверь почту.' : '');
      closeAuth();
      setMenuAnimationDisabled(false);
      setScreen('menu');
    }
    setAuthBusy(false);
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setAuthMessage('Supabase не настроен. Можно играть без аккаунта.');
      return;
    }

    setAuthBusy(true);
    setAuthMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      setAuthMessage(error.message);
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    closeAuth();
    setScreen('home');
  };

  const finishRun = useCallback(
    (progress: number, completed: boolean, saveProgress = true) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearPausedRun();
      if (saveProgress) {
        const saved = saveRecord(choice, completed ? 100 : progress);
        setRecords((current) => ({ ...current, [recordKey(choice)]: saved }));
      }
      setLastResult({ progress: Math.round(completed ? 100 : progress), completed });
      setScreen('result');
    },
    [choice],
  );

  const resetRunState = () => {
    trailRef.current = [];
    splitTrailRef.current = [];
    shadowHistoryRef.current = [];
    splitShadowHistoryRef.current = [];
    shadowSnapshotRef.current = null;
    splitShadowSnapshotRef.current = null;
    shadowTeleportsLeftRef.current = 5;
    shadowCooldownUntilRef.current = 0;
    winAnimationRef.current = null;
    teleportEffectRef.current = null;
  };

  const saveCurrentRun = () => {
    if (screen !== 'playing' && screen !== 'paused') return;
    if (deathAnimationRef.current || winAnimationRef.current) return;

    const pausedRun: SavedPausedRun = {
      choice,
      speedMode,
      practiceMode,
      modifications,
      elapsed: elapsedRef.current,
      attempt: attemptRef.current,
      player: playerRef.current,
      splitPlayer: splitPlayerRef.current,
      trail: trailRef.current,
      splitTrail: splitTrailRef.current,
      shadowHistory: shadowHistoryRef.current,
      splitShadowHistory: splitShadowHistoryRef.current,
      shadowTeleportsLeft: shadowTeleportsLeftRef.current,
      shadowCooldownUntil: shadowCooldownUntilRef.current,
      checkpoints: checkpointsRef.current,
      lastCheckpointAt: lastCheckpointAtRef.current,
      nextAutoCheckpointAt: nextAutoCheckpointAtRef.current,
    };

    try {
      window.sessionStorage.setItem(PAUSED_RUN_KEY, JSON.stringify(pausedRun));
    } catch {
      // Если браузер запретил sessionStorage, просто продолжаем без восстановления.
    }
  };

  const restorePausedRun = (saved: SavedPausedRun) => {
    setChoice(saved.choice);
    setSpeedMode(saved.speedMode);
    setPracticeMode(saved.practiceMode);
    setModifications({ ...DEFAULT_MODIFICATIONS, ...saved.modifications });
    elapsedRef.current = saved.elapsed;
    attemptRef.current = saved.attempt;
    playerRef.current = saved.player;
    splitPlayerRef.current = saved.splitPlayer;
    trailRef.current = saved.trail;
    splitTrailRef.current = saved.splitTrail;
    shadowHistoryRef.current = saved.shadowHistory;
    splitShadowHistoryRef.current = saved.splitShadowHistory;
    shadowTeleportsLeftRef.current = saved.shadowTeleportsLeft;
    shadowCooldownUntilRef.current = saved.shadowCooldownUntil;
    checkpointsRef.current = saved.checkpoints;
    lastCheckpointAtRef.current = saved.lastCheckpointAt;
    nextAutoCheckpointAtRef.current = saved.nextAutoCheckpointAt;
    shadowSnapshotRef.current = null;
    splitShadowSnapshotRef.current = null;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    teleportEffectRef.current = null;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    practiceRespawnUntilRef.current = 0;
    setLastResult(null);
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setMenuAnimationDisabled(true);
    setScreen('paused');
  };

  const addPracticeCheckpoint = (force = false) => {
    if (!practiceMode || screen !== 'playing') return false;
    if (!force && elapsedRef.current - lastCheckpointAtRef.current < PRACTICE_CHECKPOINT_COOLDOWN_MS) return false;
    const cameraX = (elapsedRef.current / 1000) * level.speed;
    const player = playerRef.current;
    const splitPlayer = modifications.splitMode ? splitPlayerRef.current : null;
    checkpointsRef.current = [
      ...checkpointsRef.current,
      {
        time: elapsedRef.current,
        player: { ...player },
        splitPlayer: splitPlayer ? { ...splitPlayer } : null,
        worldX: cameraX + player.x - 140,
        y: player.y,
      },
    ];
    lastCheckpointAtRef.current = elapsedRef.current;
    return true;
  };

  const removePracticeCheckpoint = () => {
    if (!practiceMode || screen !== 'playing') return;
    checkpointsRef.current = checkpointsRef.current.slice(0, -1);
  };

  const markCheckpointButtonActive = () => {
    setCheckpointButtonActive(true);
    window.setTimeout(() => setCheckpointButtonActive(false), 180);
  };

  const respawnPractice = () => {
    const checkpoint = checkpointsRef.current[checkpointsRef.current.length - 1];
    attemptRef.current += 1;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    resetRunState();

    if (checkpoint) {
      elapsedRef.current = checkpoint.time;
      playerRef.current = { ...checkpoint.player };
      if (checkpoint.splitPlayer) {
        splitPlayerRef.current = { ...checkpoint.splitPlayer };
      }
      nextAutoCheckpointAtRef.current = checkpoint.time + PRACTICE_AUTO_CHECKPOINT_MS;
    } else {
      elapsedRef.current = 0;
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
      nextAutoCheckpointAtRef.current = PRACTICE_AUTO_CHECKPOINT_MS;
    }

    lastTimeRef.current = 0;
    practiceRespawnUntilRef.current = performance.now() + PRACTICE_RESPAWN_DELAY_MS;
  };

  const startRun = () => {
    clearPausedRun();
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    resetRunState();
    checkpointsRef.current = [];
    lastCheckpointAtRef.current = -PRACTICE_CHECKPOINT_COOLDOWN_MS;
    nextAutoCheckpointAtRef.current = PRACTICE_AUTO_CHECKPOINT_MS;
    practiceRespawnUntilRef.current = 0;
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
    practiceRespawnUntilRef.current = 0;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    saveCurrentRun();
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
    practiceRespawnUntilRef.current = 0;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setMenuAnimationDisabled(false);
    clearPausedRun();
    setScreen('menu');
  };

  const closeMenuWindow = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    practiceRespawnUntilRef.current = 0;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setMenuAnimationDisabled(true);
    clearPausedRun();
    setScreen('menu');
  };

  const returnToHome = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    practiceRespawnUntilRef.current = 0;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    closeAuth();
    clearPausedRun();
    setScreen('home');
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

  const toggleHitboxes = () => {
    setModifications((current) => {
      const next = { ...current, showHitboxes: !current.showHitboxes };
      saveModifications(next);
      return next;
    });
  };

  useEffect(() => {
    if (screen !== 'playing') return;

    const tick = (time: number) => {
      const teleportEffect = teleportEffectRef.current;
      if (teleportEffect) {
        const progress = clamp((time - teleportEffect.startedAt) / TELEPORT_EFFECT_MS, 0, 1);
        teleportEffectRef.current = progress >= 1 ? null : { ...teleportEffect, progress };
      }

      const deathAnimation = deathAnimationRef.current;
      if (deathAnimation) {
        const progress = clamp((time - deathAnimation.startedAt) / DEATH_ANIMATION_MS, 0, 1);
        deathAnimationRef.current = { ...deathAnimation, progress };
        lastTimeRef.current = time;
        drawGame(
          canvasRef.current!,
          level,
          choice,
          colors,
          modifications,
          deathAnimation.player,
          trailRef.current,
          deathAnimation.splitPlayer,
          splitTrailRef.current,
          shadowSnapshotRef.current,
          splitShadowSnapshotRef.current,
          shadowTeleportsLeftRef.current,
          shadowCooldownUntilRef.current,
          practiceMode,
          checkpointsRef.current,
          deathAnimationRef.current,
          null,
          attemptRef.current,
          elapsedRef.current,
          false,
          true,
          teleportEffectRef.current,
        );

        if (progress >= 1) {
          deathAnimationRef.current = null;
          if (practiceMode) {
            respawnPractice();
            animationRef.current = requestAnimationFrame(tick);
          } else {
            finishRun(deathAnimation.levelProgress, false);
          }
          return;
        }

        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      const winAnimation = winAnimationRef.current;
      if (winAnimation) {
        const progress = clamp((time - winAnimation.startedAt) / WIN_ANIMATION_MS, 0, 1);
        winAnimationRef.current = { ...winAnimation, progress };
        lastTimeRef.current = time;
        drawGame(
          canvasRef.current!,
          level,
          choice,
          colors,
          modifications,
          winAnimation.player,
          trailRef.current,
          winAnimation.splitPlayer,
          splitTrailRef.current,
          shadowSnapshotRef.current,
          splitShadowSnapshotRef.current,
          shadowTeleportsLeftRef.current,
          shadowCooldownUntilRef.current,
          practiceMode,
          checkpointsRef.current,
          null,
          winAnimationRef.current,
          attemptRef.current,
          elapsedRef.current,
          false,
          true,
          teleportEffectRef.current,
        );

        if (progress >= 1) {
          winAnimationRef.current = null;
          finishRun(100, true, !practiceMode);
          return;
        }

        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      if (practiceRespawnUntilRef.current > time) {
        lastTimeRef.current = time;
        drawGame(
          canvasRef.current!,
          level,
          choice,
          colors,
          modifications,
          playerRef.current,
          trailRef.current,
          modifications.splitMode ? splitPlayerRef.current : null,
          splitTrailRef.current,
          shadowSnapshotRef.current,
          splitShadowSnapshotRef.current,
          shadowTeleportsLeftRef.current,
          shadowCooldownUntilRef.current,
          practiceMode,
          checkpointsRef.current,
          null,
          winAnimationRef.current,
          attemptRef.current,
          elapsedRef.current,
          false,
          true,
          teleportEffectRef.current,
        );
        animationRef.current = requestAnimationFrame(tick);
        return;
      }
      practiceRespawnUntilRef.current = 0;
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
      if (practiceMode && elapsedRef.current >= nextAutoCheckpointAtRef.current) {
        addPracticeCheckpoint();
        nextAutoCheckpointAtRef.current = elapsedRef.current + PRACTICE_AUTO_CHECKPOINT_MS;
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
        practiceMode,
        checkpointsRef.current,
        null,
        winAnimationRef.current,
        attemptRef.current,
        elapsedRef.current,
        inputRef.current,
        true,
        teleportEffectRef.current,
      );

      if (hit) {
        deathAnimationRef.current = {
          startedAt: time,
          progress: 0,
          player,
          splitPlayer,
          levelProgress: (elapsedRef.current / level.duration) * 100,
        };
        inputRef.current = false;
        ufoJumpQueuedRef.current = false;
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      if (elapsedRef.current >= level.duration) {
        winAnimationRef.current = {
          startedAt: time,
          progress: 0,
          player,
          splitPlayer,
        };
        inputRef.current = false;
        ufoJumpQueuedRef.current = false;
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [choice, colors, finishRun, level, modifications, practiceMode, screen]);

  useEffect(() => {
    const saved = loadPausedRun();
    if (saved) {
      restorePausedRun(saved);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session && !loadPausedRun()) {
        void saveAccount(data.session.user);
        setMenuAnimationDisabled(false);
        setScreen('menu');
      } else if (data.session) {
        void saveAccount(data.session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && !loadPausedRun()) {
        void saveAccount(nextSession.user);
        setAuthMode(null);
        setMenuAnimationDisabled(false);
        setScreen('menu');
      } else if (nextSession) {
        void saveAccount(nextSession.user);
        setAuthMode(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const isInteractiveTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest('button, input, select, textarea, a'));
    const isControlKey = (event: KeyboardEvent) => CONTROL_KEYS.has(event.code);
    const activate = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      if (!isControlKey(event)) return;
      event.preventDefault();
      if (!inputRef.current) {
        ufoJumpQueuedRef.current = true;
      }
      inputRef.current = true;
    };
    const release = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      if (!isControlKey(event)) return;
      event.preventDefault();
      inputRef.current = false;
    };
    const activatePointer = (event: PointerEvent | TouchEvent) => {
      if (isInteractiveTarget(event.target)) return;
      event.preventDefault();
      if (!inputRef.current) {
        ufoJumpQueuedRef.current = true;
      }
      inputRef.current = true;
    };
    const releasePointer = (event: PointerEvent | TouchEvent) => {
      if (isInteractiveTarget(event.target)) return;
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
    if (screen !== 'playing' && screen !== 'paused') return;

    const saveOnHide = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentRun();
      }
    };
    const saveOnPageLeave = () => saveCurrentRun();

    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', saveOnPageLeave);
    window.addEventListener('beforeunload', saveOnPageLeave);
    return () => {
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', saveOnPageLeave);
      window.removeEventListener('beforeunload', saveOnPageLeave);
    };
  }, [choice, modifications, practiceMode, screen, speedMode]);

  useEffect(() => {
    if (screen !== 'paused' || !canvasRef.current) return;

    drawGame(
      canvasRef.current,
      level,
      choice,
      colors,
      modifications,
      playerRef.current,
      trailRef.current,
      modifications.splitMode ? splitPlayerRef.current : null,
      splitTrailRef.current,
      shadowSnapshotRef.current,
      splitShadowSnapshotRef.current,
      shadowTeleportsLeftRef.current,
      shadowCooldownUntilRef.current,
      practiceMode,
      checkpointsRef.current,
      null,
      null,
      attemptRef.current,
      elapsedRef.current,
      false,
      true,
      teleportEffectRef.current,
    );
  }, [choice, colors, level, modifications, practiceMode, screen]);

  useEffect(() => {
    if (screen === 'home' && homePreviewCanvasRef.current) {
      const cameraX = (homePreview.elapsed / homePreviewLevel.duration) * homePreviewLevel.speed * (homePreviewLevel.duration / 1000);
      const baseY = getPreviewPathY(homePreview.choice.mode, homePreview.elapsed);
      const y = getSafePreviewY(homePreviewLevel, cameraX, baseY);
      const nextY = getPreviewPathY(homePreview.choice.mode, homePreview.elapsed + 58) + (y - baseY);
      const isWavePreview = homePreview.choice.mode === 'wave' || homePreview.choice.mode === 'flipWave';
      const previewPlayer: Player = {
        x: PLAYER_DEFAULT_X,
        y,
        vy: 0,
        angle: isWavePreview ? getWavePreviewDirection(homePreview.choice.mode, homePreview.elapsed) * 0.68 : clamp((nextY - y) / 90, -0.75, 0.75),
        cooldown: 0,
      };
      const previewTrail = buildPreviewTrail(homePreview.choice.mode, cameraX, homePreview.elapsed, y);
      drawGame(
        homePreviewCanvasRef.current,
        homePreviewLevel,
        homePreview.choice,
        homePreview.colors,
        DEFAULT_MODIFICATIONS,
        previewPlayer,
        previewTrail,
        null,
        [],
        null,
        null,
        shadowTeleportsLeftRef.current,
        0,
        false,
        [],
        null,
        null,
        1,
        homePreview.elapsed,
        false,
        false,
      );
    }
  }, [homePreview, homePreviewLevel, screen]);

  useEffect(() => {
    if (screen !== 'home') return;
    const interval = window.setInterval(() => setHomePreview((previous) => createHomePreview(previous)), 4200);
    return () => window.clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    attemptRef.current = 0;
  }, [choice, speedMode, modifications.splitMode, practiceMode]);

  useEffect(() => {
    if (screen !== 'result') return;

    const restartOnEnter = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Enter' && event.code !== 'Space') return;
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
    if (screen !== 'playing' || !practiceMode) return;

    const handlePracticeKeys = (event: KeyboardEvent) => {
      if (event.code !== 'KeyC' && event.code !== 'KeyD') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;

      if (event.code === 'KeyC') {
        if (addPracticeCheckpoint()) {
          markCheckpointButtonActive();
        }
      } else {
        removePracticeCheckpoint();
      }
    };

    window.addEventListener('keydown', handlePracticeKeys, true);
    return () => window.removeEventListener('keydown', handlePracticeKeys, true);
  }, [screen, practiceMode]);

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
      const cameraX = (elapsedRef.current / 1000) * level.speed;
      const from: Point = { x: cameraX + playerRef.current.x - 140, y: playerRef.current.y };
      const splitFrom: Point | null = modifications.splitMode
        ? { x: cameraX + splitPlayerRef.current.x - 140, y: splitPlayerRef.current.y }
        : null;
      teleportEffectRef.current = {
        startedAt: performance.now(),
        progress: 0,
        from,
        to: { x: shadow.worldX, y: shadow.y },
        splitFrom,
        splitTo: splitShadow ? { x: splitShadow.worldX, y: splitShadow.y } : null,
      };
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
      {screen === 'home' && (
        <>
          <section className={authMode ? 'home-preview home-panel-blurred' : 'home-preview'}>
            <canvas
              ref={homePreviewCanvasRef}
              width={WIDTH}
              height={HEIGHT}
              aria-label="Случайное превью уровня"
            />
            <div className="home-preview-overlay">
              <span>{previewMode.title}</span>
            </div>
          </section>

          <section className={authMode ? 'home-auth home-panel-blurred' : 'home-auth'} aria-label="Главный экран">
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Выбери вход</h1>
            </div>
            <div className="home-auth-actions">
              <button className="auth-button" onClick={() => openAuth('signup')} type="button">
                Регистрация
              </button>
              <button className="auth-button" onClick={() => openAuth('signin')} type="button">
                Вход
              </button>
              <button className="auth-button" onClick={continueAsGuest} type="button">
                Играть без аккаунта
              </button>
            </div>
          </section>
        </>
      )}

      {screen === 'home' && authMode && (
        <div
          className={modalClosing ? 'modal-backdrop auth-modal-backdrop modal-closing' : 'modal-backdrop auth-modal-backdrop'}
          onClick={() => closeModalWithFade(closeAuth)}
          role="presentation"
        >
          <form
            className="auth-form auth-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitAuth}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>{authMode === 'signin' ? 'Вход' : 'Регистрация'}</h1>
            </div>
            <button className="auth-button google-auth-button" disabled={authBusy} onClick={signInWithGoogle} type="button">
              Войти через Google
            </button>
            <input
              autoFocus
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="email"
              required
              type="email"
              value={authEmail}
            />
            <input
              minLength={6}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="пароль"
              required
              type="password"
              value={authPassword}
            />
            <div className="auth-form-actions">
              <button className="auth-button primary" disabled={authBusy} type="submit">
                {authBusy ? '...' : authMode === 'signin' ? 'Войти' : 'Создать'}
              </button>
              <button className="auth-button" onClick={() => closeModalWithFade(closeAuth)} type="button">
                Закрыть
              </button>
            </div>
            {authMessage && <p className="auth-message">{authMessage}</p>}
          </form>
        </div>
      )}

      {(screen === 'playing' || screen === 'paused') && (
        <section className="stage" ref={stageRef}>
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="BeatShift level" />
          {screen !== 'playing' && screen !== 'paused' && <div className="scanline" />}
          {screen === 'playing' && (
            <button className="pause-button" onClick={pauseRun} type="button">
              Пауза
            </button>
          )}
          {screen === 'playing' && practiceMode && (
            <div className="practice-panel" aria-label="Практика">
              <button
                className={checkpointButtonActive ? 'practice-tool active' : 'practice-tool'}
                onClick={() => {
                  if (addPracticeCheckpoint()) {
                    markCheckpointButtonActive();
                  }
                }}
                onPointerDown={(event) => event.stopPropagation()}
                title="Поставить чекпоинт"
                type="button"
              >
                <span className="checkpoint-diamond" />
              </button>
              <button
                className="practice-tool"
                onClick={removePracticeCheckpoint}
                onPointerDown={(event) => event.stopPropagation()}
                title="Удалить последний чекпоинт"
                type="button"
              >
                <span className="checkpoint-diamond disabled" />
              </button>
            </div>
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
        <section
          className={menuAnimationDisabled ? 'control-panel menu-panel menu-panel-static' : 'control-panel menu-panel'}
          aria-label="Настройки тренировки"
        >
          <div>
            <p className="eyebrow">BeatShift</p>
          </div>
          <div className="menu-account-row">
            <span>{session ? userEmail : 'Гость'}</span>
            {session && (
              <button className="menu-account-button" onClick={signOut} type="button">
                Выйти
              </button>
            )}
          </div>
          <button
            className="menu-button controls-menu-button"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
              setControlsPickerOpen(true);
            }}
            type="button"
          >
            Управление
          </button>

          <div className="menu-action-row">
          <button
            className="option mode-trigger"
            onClick={() => {
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
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
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(true);
            }}
            type="button"
          >
            <span>Сложность</span>
            <small>{selectedDifficulty.title}</small>
          </button>

          <button
            className="option mode-trigger"
            onClick={() => {
              setModePickerOpen(false);
              setDifficultyPickerOpen(false);
              setSpeedPickerOpen(true);
            }}
            type="button"
          >
            <span>Скорость</span>
            <small>{selectedSpeed.title}</small>
          </button>

          <button
            className="option mode-trigger"
            onClick={() => {
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
              setScreen('colors');
            }}
            type="button"
          >
            <span>Цвета</span>
            <small>След и модельки</small>
          </button>

          <button
            className="option mode-trigger"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
              setScreen('mods');
            }}
            type="button"
          >
            <span>Модификации</span>
            <small>Правила уровня</small>
          </button>

          </div>

          <button className="start-button" onClick={startRun} type="button">
            Старт
          </button>
          <button
            className={practiceMode ? 'menu-button active' : 'menu-button'}
            onClick={() => setPracticeMode((current) => !current)}
            type="button"
          >
            Практика: {practiceMode ? 'вкл' : 'выкл'}
          </button>
          <div className="secondary-action-row">
            <button className="menu-button" onClick={returnToHome} type="button">
              Главный экран
            </button>
          </div>
          <div className="score-row">
            <span>Рекорд</span>
            <strong>{best}%</strong>
          </div>
        </section>
      )}

      {screen === 'menu' && modePickerOpen && (
        <div
          className={modalClosing ? 'modal-backdrop modal-closing' : 'modal-backdrop'}
          onClick={() => closeModalWithFade(() => setModePickerOpen(false))}
          role="presentation"
        >
          <section className="mode-modal" aria-label="Выбор режима" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Режимы</h1>
            </div>

            <div className="picker">
              {MODES.map((mode) => (
                <button
                  className={choice.mode === mode.id ? 'option active' : 'option'}
                  key={mode.id}
                  onClick={() => {
                    setChoice((current) => ({ ...current, mode: mode.id }));
                    closeModalWithFade(() => setModePickerOpen(false));
                  }}
                  type="button"
                >
                  <span>{mode.title}</span>
                  <small>{mode.subtitle}</small>
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(() => setModePickerOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'menu' && difficultyPickerOpen && (
        <div
          className={modalClosing ? 'modal-backdrop modal-closing' : 'modal-backdrop'}
          onClick={() => closeModalWithFade(() => setDifficultyPickerOpen(false))}
          role="presentation"
        >
          <section className="mode-modal" aria-label="Выбор сложности" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Сложность</h1>
            </div>

            <div className="picker">
              {DIFFICULTIES.map((difficulty) => (
                <button
                  className={choice.difficulty === difficulty.id ? 'option active' : 'option'}
                  key={difficulty.id}
                  onClick={() => {
                    setChoice((current) => ({ ...current, difficulty: difficulty.id }));
                    closeModalWithFade(() => setDifficultyPickerOpen(false));
                  }}
                  type="button"
                >
                  <span>{difficulty.title}</span>
                  <small>{Math.round(difficulty.multiplier * 100)}%</small>
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(() => setDifficultyPickerOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'menu' && speedPickerOpen && (
        <div
          className={modalClosing ? 'modal-backdrop modal-closing' : 'modal-backdrop'}
          onClick={() => closeModalWithFade(() => setSpeedPickerOpen(false))}
          role="presentation"
        >
          <section className="mode-modal" aria-label="Выбор скорости" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Скорость</h1>
            </div>

            <div className="picker">
              {SPEED_MODES.map((speed) => (
                <button
                  className={speedMode === speed.id ? 'option active' : 'option'}
                  key={speed.id}
                  onClick={() => {
                    setSpeedMode(speed.id);
                    closeModalWithFade(() => setSpeedPickerOpen(false));
                  }}
                  type="button"
                >
                  <span>{speed.title}</span>
                  <small>{Math.round(speed.multiplier * 100)}%</small>
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(() => setSpeedPickerOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'menu' && controlsPickerOpen && (
        <div
          className={modalClosing ? 'modal-backdrop modal-closing' : 'modal-backdrop'}
          onClick={() => closeModalWithFade(() => setControlsPickerOpen(false))}
          role="presentation"
        >
          <section className="mode-modal controls-modal" aria-label="Управление" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Управление</h1>
            </div>

            <div className="controls-list">
              <div className="control-row">
                <span>Полёт / действие</span>
                <strong>Пробел, W/A/S/D, стрелки, мышь, касание</strong>
              </div>
              <div className="control-row">
                <span>Пауза / продолжить</span>
                <strong>Backspace</strong>
              </div>
              <div className="control-row">
                <span>Рестарт после смерти</span>
                <strong>Enter или пробел</strong>
              </div>
              <div className="control-row">
                <span>Чекпоинт в практике</span>
                <strong>C</strong>
              </div>
              <div className="control-row">
                <span>Удалить чекпоинт</span>
                <strong>D</strong>
              </div>
              <div className="control-row">
                <span>Телепорт к тени</span>
                <strong>Alt</strong>
              </div>
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(() => setControlsPickerOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'colors' && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel colors-panel"
            aria-label="Настройки цветов"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
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

            <button className="menu-button" onClick={() => closeModalWithFade(closeMenuWindow)} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'mods' && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel mods-panel"
            aria-label="Модификации"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
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
              <button
                className={modifications.showHitboxes ? 'mod-option active' : 'mod-option'}
                onClick={toggleHitboxes}
                type="button"
              >
                <span>Хитбоксы</span>
                <small>{modifications.showHitboxes ? 'Включено' : 'Выключено'}</small>
              </button>
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(closeMenuWindow)} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'result' && lastResult && (
        <section className="control-panel result-panel" aria-label="Результат попытки">
          <div>
            <p className="eyebrow">BeatShift</p>
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
