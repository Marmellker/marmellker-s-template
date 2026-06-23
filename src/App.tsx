import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import chromeFurnaceWaveHard from './assets/audio/chrome-furnace-wave-hard.mp3';
import chromeFurnaceWaveMedium from './assets/audio/chrome-furnace-wave-medium.mp3';
import chromeRiftInfinite from './assets/audio/chrome-rift-infinite.mp3';
import eventHorizonLatticeMenu from './assets/audio/event-horizon-lattice-menu.mp3';
import glitchArcadeRiftUfoHard from './assets/audio/glitch-arcade-rift-ufo-hard.mp3';
import neonCircuitRiteLaserEasy from './assets/audio/neon-circuit-rite-laser-easy.mp3';
import neonCircuitRiteLaserHard from './assets/audio/neon-circuit-rite-laser-hard.mp3';
import neonCircuitRiteLaserMedium from './assets/audio/neon-circuit-rite-laser-medium.mp3';
import neonExitVectorShipHard from './assets/audio/neon-exit-vector-ship-hard.mp3';
import neonFreefallOrbitHard from './assets/audio/neon-freefall-orbit-hard.mp3';
import neonFreefallOrbitMedium from './assets/audio/neon-freefall-orbit-medium.mp3';
import neonDriftProtocol from './assets/audio/neon-drift-protocol.mp3';
import neonDriftProtocolShipMedium from './assets/audio/neon-drift-protocol-ship-medium.mp3';
import neonDriftProtocolUfoEasy from './assets/audio/neon-drift-protocol-ufo-easy.mp3';
import neonDriftProtocolUfoMedium from './assets/audio/neon-drift-protocol-ufo-medium.mp3';
import neonSpikeCircuitFlipWaveEasy from './assets/audio/neon-spike-circuit-flip-wave-easy.mp3';
import neonSpikeCircuitFlipWaveHard from './assets/audio/neon-spike-circuit-flip-wave-hard.mp3';
import neonSpikeCircuitFlipWaveMedium from './assets/audio/neon-spike-circuit-flip-wave-medium.mp3';
import neonSpikeCircuitWaveEasy from './assets/audio/neon-spike-circuit-wave-easy.mp3';
import orbitCarnivalOrbitEasy from './assets/audio/orbit-carnival-orbit-easy.mp3';

type Mode = 'wave' | 'flipWave' | 'laser' | 'orbit' | 'ship' | 'ufo';
type Difficulty = 'easy' | 'medium' | 'hard';
type SpeedMode = 'normal' | 'fast' | 'superfast';
type Screen =
  | 'home'
  | 'levelSelect'
  | 'tutorialSelect'
  | 'menu'
  | 'playing'
  | 'paused'
  | 'result'
  | 'colors'
  | 'mods'
  | 'records'
  | 'infiniteRecords'
  | 'leaderboard';
type AuthMode = 'signin' | 'signup';
type SoundName =
  | 'click'
  | 'select'
  | 'toggle'
  | 'start'
  | 'pause'
  | 'resume'
  | 'checkpoint'
  | 'removeCheckpoint'
  | 'teleport'
  | 'death'
  | 'respawn'
  | 'win';

type ActiveMusic =
  | {
      kind: 'synth';
      master: GainNode;
      timers: number[];
      targetVolume: number;
    }
  | {
      kind: 'file';
      audio: HTMLAudioElement;
      targetVolume: number;
    };

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
  infinite?: boolean;
  generatedUntil?: number;
  tutorial?: TutorialInfo;
};

type TutorialInfo = {
  title: string;
  steps: TutorialStep[];
};

type TutorialStep = {
  start: number;
  end: number;
  instruction: string;
  hint: string;
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

type LeaderboardEntry = {
  id: string;
  user_id: string;
  mode: Mode;
  nickname: string;
  seconds: number;
};

type FeedbackReview = {
  id: string;
  user_id: string;
  email: string | null;
  nickname: string | null;
  body: string;
  created_at: string;
};

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
  infiniteMode?: boolean;
  infiniteLevel?: Level | null;
  tutorialMode?: boolean;
  tutorialLevel?: Level | null;
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

type AudioSettings = {
  menuMusic: boolean;
  levelMusic: boolean;
  soundEffects: boolean;
};

const MODES: Array<{ id: Mode; title: string; subtitle: string }> = [
  { id: 'wave', title: 'Искра', subtitle: 'резкие диагонали' },
  { id: 'flipWave', title: 'Flip Wave', subtitle: 'переключение направления' },
  { id: 'laser', title: 'Вектор', subtitle: 'скоростной плавный полёт' },
  { id: 'orbit', title: 'Орбита', subtitle: 'вращение по пунктирной орбите' },
  { id: 'ship', title: 'Глайдер', subtitle: 'плавный полёт' },
  { id: 'ufo', title: 'Капсула', subtitle: 'прыжки в воздухе' },
];

const DIFFICULTIES: Array<{ id: Difficulty; title: string; multiplier: number }> = [
  { id: 'easy', title: 'Лёгкий', multiplier: 0.72 },
  { id: 'medium', title: 'Средний', multiplier: 1 },
  { id: 'hard', title: 'Сложный', multiplier: 1.32 },
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

const TUTORIALS: Record<Mode, TutorialInfo> = {
  wave: {
    title: 'Туториал: Искра',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Зажми кнопку действия, чтобы лететь вверх по диагонали.',
        hint: 'Отпусти кнопку, чтобы Искра пошла вниз.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Чередуй короткие нажатия и отпускания.',
        hint: 'Так получится ровный зигзаг между стенами.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Перед узким проходом меняй направление заранее.',
        hint: 'Не жди, пока моделька окажется прямо у стены.',
      },
    ],
  },
  flipWave: {
    title: 'Туториал: Flip Wave',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Нажми один раз, чтобы поменять направление полёта.',
        hint: 'Удерживать кнопку в этом режиме не нужно.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Каждое новое нажатие снова разворачивает диагональ.',
        hint: 'Нажимай перед стеной, а не после касания.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Лови ритм одиночных нажатий.',
        hint: 'Один проход - одно точное переключение.',
      },
    ],
  },
  laser: {
    title: 'Туториал: Вектор',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Зажми кнопку действия, чтобы плавно подниматься.',
        hint: 'Отпусти кнопку, чтобы Вектор начал снижаться.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Движение сглаженное, поэтому реагируй заранее.',
        hint: 'Нажимай чуть раньше, чем в резких режимах.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Веди Вектор по центру коридора.',
        hint: 'Маленькие корректировки безопаснее долгого удержания.',
      },
    ],
  },
  orbit: {
    title: 'Туториал: Орбита',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Нажми, чтобы сменить направление вращения.',
        hint: 'Моделька движется по пунктирной орбите.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Смотри на дугу орбиты перед моделькой.',
        hint: 'Она показывает, куда тебя вынесет дальше.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Переключайся до входа в узкий проход.',
        hint: 'Так проще пролетать между верхом и низом.',
      },
    ],
  },
  ship: {
    title: 'Туториал: Глайдер',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Зажми кнопку действия, чтобы Глайдер поднимался.',
        hint: 'Отпусти, чтобы он начал планировать вниз.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Держи высоту короткими мягкими касаниями.',
        hint: 'Долгое удержание быстро унесёт вверх.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Выравнивайся перед каждым коридором.',
        hint: 'Центр прохода - самая спокойная траектория.',
      },
    ],
  },
  ufo: {
    title: 'Туториал: Капсула',
    steps: [
      {
        start: 0,
        end: 9_000,
        instruction: 'Каждое нажатие делает один прыжок в воздухе.',
        hint: 'Между прыжками Капсула падает.',
      },
      {
        start: 10_000,
        end: 20_000,
        instruction: 'Нажимай ритмично, чтобы держаться на нужной высоте.',
        hint: 'Слишком частые прыжки поднимут тебя к потолку.',
      },
      {
        start: 21_000,
        end: 31_000,
        instruction: 'Зелёные орбы помогают сделать дополнительный прыжок.',
        hint: 'Заходи в них по центру и нажимай вовремя.',
      },
    ],
  },
};

function getModeColor(colors: ColorSettings, mode: Mode) {
  return colors[mode] || DEFAULT_COLORS[mode];
}

function ModeModelIcon({ mode }: { mode: Mode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = 92;
    const height = 58;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawPlayer(
      ctx,
      {
        x: mode === 'laser' ? 48 : mode === 'ship' ? 45 : 46,
        y: height / 2,
        vy: 0,
        angle: mode === 'wave' || mode === 'flipWave' ? -0.28 : 0,
        cooldown: 0,
      },
      mode,
      false,
      DEFAULT_COLORS,
      false,
    );
  }, [mode]);

  return <canvas className="mode-model-icon" ref={canvasRef} aria-hidden="true" />;
}

function ModeTitle({ mode, title }: { mode: Mode; title: string }) {
  return (
    <span className="mode-title">
      <ModeModelIcon mode={mode} />
      <span className="mode-title-label">{title}</span>
    </span>
  );
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

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  menuMusic: true,
  levelMusic: true,
  soundEffects: true,
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
  { id: 'wave', title: 'Искра' },
  { id: 'flipWave', title: 'Flip Wave' },
  { id: 'laser', title: 'Вектор' },
  { id: 'orbit', title: 'Орбита' },
  { id: 'ship', title: 'Глайдер' },
  { id: 'ufo', title: 'Капсула' },
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
const INFINITE_RECORD_KEY = 'beatshift-infinite-records-v1';
const COLORS_KEY = 'dash-practice-colors-v1';
const MODIFICATIONS_KEY = 'dash-practice-modifications-v1';
const AUDIO_SETTINGS_KEY = 'beatshift-audio-settings-v1';
const PAUSED_RUN_KEY = 'beatshift-paused-run-v1';
const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_DEFAULT_X = 142;
const PLAYER_SHADOW_MAX_X = WIDTH - 116;
const SHADOW_DELAY_MS = 2_000;
const SHADOW_FADE_MS = 600;
const PRACTICE_AUTO_CHECKPOINT_MS = 5_000;
const PRACTICE_RESPAWN_DELAY_MS = 500;
const DEATH_ANIMATION_MS = 900;
const WIN_ANIMATION_MS = 1_000;
const LEVEL_MUSIC_VOLUME = 0.36;
const LEVEL_MUSIC_FADE_IN_MS = 650;
const LEVEL_MUSIC_FADE_OUT_MS = 450;
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
const INFINITE_DURATION = 24 * 60 * 60 * 1000;
const INFINITE_SEGMENT_LENGTH = 2_200;
const INFINITE_GENERATE_AHEAD = 2_800;
const ADMIN_EMAIL = 'boldinar2@gmail.com';
const REVIEW_LIMIT = 700;

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

function infiniteRecordKey(mode: Mode) {
  return `infinite-${mode}`;
}

function loadInfiniteRecords(): RecordMap {
  try {
    const saved = window.localStorage.getItem(INFINITE_RECORD_KEY);
    return saved ? (JSON.parse(saved) as RecordMap) : {};
  } catch {
    return {};
  }
}

function saveInfiniteRecord(mode: Mode, seconds: number) {
  const records = loadInfiniteRecords();
  const key = infiniteRecordKey(mode);
  const next = Math.max(records[key] ?? 0, Math.round(seconds));
  window.localStorage.setItem(INFINITE_RECORD_KEY, JSON.stringify({ ...records, [key]: next }));
  return next;
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const restSeconds = rounded % 60;
  return minutes > 0 ? `${minutes} мин. ${restSeconds} сек.` : `${restSeconds} сек.`;
}

function formatReviewDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFallbackNickname(user: User) {
  const metadata = user.user_metadata;
  return (
    metadata.full_name ??
    metadata.name ??
    metadata.user_name ??
    user.email?.split('@')[0] ??
    'Игрок'
  ).toString();
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

function loadAudioSettings(): AudioSettings {
  try {
    const saved = window.localStorage.getItem(AUDIO_SETTINGS_KEY);
    return saved ? { ...DEFAULT_AUDIO_SETTINGS, ...(JSON.parse(saved) as Partial<AudioSettings>) } : DEFAULT_AUDIO_SETTINGS;
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function saveAudioSettings(settings: AudioSettings) {
  window.localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(settings));
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

  if (!splitMode && choice.mode === 'flipWave' && choice.difficulty === 'hard') {
    const spacing = 430;
    const width = 58;
    const centers = [270, 212, 326, 236, 304, 184, 352, 246, 318, 206, 286, 342];

    for (let x = 900; x < levelLength - 880; x += spacing) {
      const section = Math.floor((x - 900) / spacing);
      const center =
        centers[section % centers.length] +
        Math.sin(section * 0.66) * 12 +
        Math.sin(x / 820) * 10;
      const gap = 164 + Math.sin(section * 0.84) * 8;
      const topHeight = Math.max(58, center - gap / 2);
      const bottomY = Math.min(HEIGHT - 76, center + gap / 2);
      const bottomHeight = HEIGHT - bottomY - 52;
      const color = section % 2 === 0 ? '#243b53' : '#7c314f';

      obstacles.push({ x, y: 0, width, height: topHeight, color });
      obstacles.push({ x, y: bottomY, width, height: bottomHeight, color });

      const spikeHeight = 32;
      const spikeWidth = 38;
      const fromTop = section % 4 === 1 || section % 4 === 2;
      for (let index = 0; index < (section % 5 === 0 ? 3 : 2); index += 1) {
        obstacles.push({
          kind: 'spike',
          direction: fromTop ? 'down' : 'up',
          x: x + 78 + index * (spikeWidth + 10),
          y: fromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: spikeWidth,
          height: spikeHeight,
          color: fromTop ? '#2f4f74' : '#8f3d58',
        });
      }

      if (section % 3 !== 1) {
        obstacles.push({
          x: x + 206,
          y: center + (section % 2 === 0 ? 42 : -74),
          width: 42,
          height: 32,
          color: '#3d2c8d',
        });
      }

      if (section % 4 !== 0) {
        obstacles.push({
          kind: 'saw',
          x: x + 292,
          y: center + (section % 4 === 1 ? 52 : section % 4 === 2 ? -82 : 18),
          width: 32,
          height: 32,
          color: '#d9e2ec',
        });
      }

      if (section % 6 === 3) {
        obstacles.push({
          kind: 'spikedBlock',
          x: x + 346,
          y: center - 18,
          width: 38,
          height: 36,
          color: '#6842c2',
        });
      }
    }

    return { duration, speed, obstacles, orbs };
  }

  if (!splitMode && choice.mode === 'laser') {
    const spacing = choice.difficulty === 'easy' ? 380 : choice.difficulty === 'medium' ? 350 : 320;
    const width = choice.difficulty === 'easy' ? 72 : choice.difficulty === 'medium' ? 78 : 96;
    const baseGap = choice.difficulty === 'easy' ? 158 : choice.difficulty === 'medium' ? 138 : 114;
    const straightCenters = choice.difficulty === 'easy'
      ? [270, 246, 294, 262, 312]
      : choice.difficulty === 'medium'
        ? [270, 230, 310, 252, 330, 218]
        : [270, 232, 310, 250, 326, 238, 302, 226];

    for (let x = 900; x < levelLength - 880; x += spacing) {
      const section = Math.floor((x - 900) / spacing);
      const straightRun = section % 6 < (choice.difficulty === 'easy' ? 3 : choice.difficulty === 'medium' ? 4 : 5);
      const straightCenter = straightCenters[Math.floor(section / (choice.difficulty === 'hard' ? 3 : 2)) % straightCenters.length];
      const center = straightRun
        ? straightCenter + Math.sin(x / 1120) * (choice.difficulty === 'hard' ? 5 : 8)
        : PLAYER_CENTER_Y + Math.sin(x / 560) * (choice.difficulty === 'hard' ? 116 : 72) + (random() - 0.5) * 28;
      const gap = baseGap + Math.sin(section * 0.78) * (choice.difficulty === 'easy' ? 10 : choice.difficulty === 'medium' ? 7 : 5);
      const topHeight = Math.max(58, center - gap / 2);
      const bottomY = Math.min(HEIGHT - 76, center + gap / 2);
      const bottomHeight = HEIGHT - bottomY - 52;
      const color = straightRun ? '#203047' : '#7c314f';

      obstacles.push({ x, y: 0, width, height: topHeight, color });
      obstacles.push({ x, y: bottomY, width, height: bottomHeight, color });

      const shouldAddStraightMarker =
        straightRun && section % (choice.difficulty === 'easy' ? 2 : 1) === 0;
      if (shouldAddStraightMarker) {
        obstacles.push({
          x: x + spacing * 0.56,
          y: center + (section % 4 < 2 ? gap / 2 + 18 : -gap / 2 - (choice.difficulty === 'hard' ? 64 : 56)),
          width: choice.difficulty === 'hard' ? 58 : 42,
          height: choice.difficulty === 'hard' ? 48 : 36,
          color: '#3d2c8d',
        });
      }

      if (choice.difficulty !== 'easy' || section % 3 === 1) {
        const sawSize = choice.difficulty === 'easy' ? 30 : choice.difficulty === 'hard' ? 42 : 36;
        obstacles.push({
          kind: 'saw',
          x: x + spacing * 0.72,
          y: center + (section % 2 === 0 ? -gap / 2 - (choice.difficulty === 'hard' ? 44 : 34) : gap / 2 + 8),
          width: sawSize,
          height: sawSize,
          color: '#d9e2ec',
        });
      }

      if (choice.difficulty === 'hard' && section % 3 !== 0) {
        const spikeHeight = 34;
        const fromTop = section % 2 === 0;
        obstacles.push({
          kind: 'spike',
          direction: fromTop ? 'down' : 'up',
          x: x + spacing * 0.28,
          y: fromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: 42,
          height: spikeHeight,
          color: fromTop ? '#2f4f74' : '#8f3d58',
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
  const hardUfoSpikeCoverSections = new Set([0.46, 0.62].map((progress) => Math.round((levelLength * progress - 920) / spacing)));
  const mediumOrbitReworkSection = Math.round((levelLength * 0.32 - 920) / spacing);

  for (let x = 920; x < levelLength - 900; x += spacing) {
    const section = Math.round((x - 920) / spacing);
    const mediumOrbitRework = choice.mode === 'orbit' && choice.difficulty === 'medium' && section === mediumOrbitReworkSection;
    const splitGap = choice.difficulty === 'hard' ? 248 : choice.difficulty === 'medium' ? 270 : 296;
    const flipGap = choice.difficulty === 'hard' ? 176 : choice.difficulty === 'medium' ? 202 : 230;
    const orbitGap = choice.difficulty === 'hard' ? 182 : choice.difficulty === 'medium' ? (mediumOrbitRework ? 242 : 210) : 238;
    const normalGap = Math.max(96, 198 - difficulty.multiplier * 44 - random() * 26);
    const hardUfoEase = choice.mode === 'ufo' && choice.difficulty === 'hard';
    const ufoGap = normalGap + (hardUfoEase ? 34 : 24);
    const gap = splitMode ? splitGap : isFlipWave ? flipGap : isOrbit ? orbitGap : choice.mode === 'ufo' ? ufoGap : normalGap;
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

    const skipHardUfoSpikeCover =
      choice.mode === 'ufo' && choice.difficulty === 'hard' && hardUfoSpikeCoverSections.has(section);
    const centerBlockEligible = !splitMode && !isFlipWave && !isOrbit && choice.difficulty !== 'easy';
    const shouldAddCenterBlock = centerBlockEligible ? random() > (hardUfoEase ? 0.54 : 0.42) : false;
    const centerBlockY = shouldAddCenterBlock ? 170 + random() * 190 : 0;
    const centerBlockHeight = shouldAddCenterBlock ? 46 + random() * 50 : 0;
    if (centerBlockEligible && !skipHardUfoSpikeCover && shouldAddCenterBlock) {
      obstacles.push({
        x: x + spacing * 0.52,
        y: centerBlockY,
        width: width * 0.82,
        height: centerBlockHeight,
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

    const shouldAddOrbitBlock = !splitMode && isOrbit && choice.difficulty !== 'easy' ? random() > 0.58 : false;
    const orbitBlockX = shouldAddOrbitBlock ? x + spacing * (0.44 + random() * 0.18) : 0;
    const orbitBlockY = shouldAddOrbitBlock ? 156 + random() * 210 : 0;
    const orbitBlockHeight = shouldAddOrbitBlock ? 36 + random() * 34 : 0;
    if (shouldAddOrbitBlock && !mediumOrbitRework) {
      obstacles.push({
        x: orbitBlockX,
        y: orbitBlockY,
        width: width * 0.72,
        height: orbitBlockHeight,
        color: '#3d2c8d',
      });
    }

    const shouldAddSaw = random() > (splitMode ? 0.62 : isFlipWave || isOrbit ? 0.72 : hardUfoEase ? 0.48 : 0.38);
    if (shouldAddSaw) {
      const sawSize = splitMode ? 34 + difficulty.multiplier * 4 : isFlipWave || isOrbit ? 34 + difficulty.multiplier * 5 : 42 + difficulty.multiplier * 8;
      const sawX = x + spacing * (0.46 + random() * 0.22);
      const sawY = splitMode ? 190 + random() * 130 : isFlipWave || isOrbit ? 158 + random() * 210 : 128 + random() * 260;
      if (!mediumOrbitRework) {
        obstacles.push({
          kind: 'saw',
          x: sawX,
          y: sawY,
          width: sawSize,
          height: sawSize,
          color: '#d9e2ec',
        });
      }
    }

    const shouldAddSpikedBlock = random() > (splitMode ? 0.78 : isFlipWave || isOrbit ? 0.78 : choice.difficulty === 'easy' ? 0.7 : 0.48);
    if (shouldAddSpikedBlock) {
      const spikedBlockX = x + spacing * (0.3 + random() * 0.35);
      const spikedBlockY = splitMode ? 218 + random() * 80 : isFlipWave || isOrbit ? 164 + random() * 190 : 132 + random() * 230;
      if (!mediumOrbitRework) {
        obstacles.push({
          kind: 'spikedBlock',
          x: spikedBlockX,
          y: spikedBlockY,
          width: splitMode ? 42 : isFlipWave || isOrbit ? 42 + difficulty.multiplier * 6 : 52 + difficulty.multiplier * 8,
          height: splitMode ? 42 : isFlipWave || isOrbit ? 40 + difficulty.multiplier * 6 : 46 + difficulty.multiplier * 8,
          color: '#6842c2',
        });
      }
    }
  }

  return { duration, speed, obstacles, orbs };
}

function buildTutorialLevel(mode: Mode): Level {
  const speed = mode === 'laser' ? 195 : 185;
  const duration = 38_000;
  const levelLength = (speed * duration) / 1000;
  const gapByMode: Record<Mode, number> = {
    wave: 260,
    flipWave: 270,
    laser: 238,
    orbit: 270,
    ship: 265,
    ufo: 310,
  };
  const centersByMode: Record<Mode, number[]> = {
    wave: [270, 218, 322, 236, 302, 258, 332],
    flipWave: [270, 326, 220, 312, 236, 292, 248],
    laser: [270, 246, 298, 258, 316, 240, 286],
    orbit: [270, 226, 316, 246, 334, 254, 302],
    ship: [270, 236, 310, 252, 326, 246, 292],
    ufo: [300, 250, 336, 266, 318, 238, 292],
  };
  const obstacles: Obstacle[] = [];
  const orbs: Orb[] = [];
  const spacing = 720;
  const wallWidth = mode === 'laser' ? 76 : 64;
  const gap = gapByMode[mode];
  const centers = centersByMode[mode];

  for (let x = 1_160; x < levelLength - 520; x += spacing) {
    const section = Math.floor((x - 1_160) / spacing);
    const center = centers[section % centers.length];
    const topHeight = Math.max(42, center - gap / 2);
    const bottomY = Math.min(HEIGHT - 76, center + gap / 2);
    const bottomHeight = HEIGHT - bottomY - 52;
    const color = section % 2 === 0 ? '#243b53' : '#7c314f';

    obstacles.push({ x, y: 0, width: wallWidth, height: topHeight, color });
    obstacles.push({ x, y: bottomY, width: wallWidth, height: bottomHeight, color });

    if (section > 0 && section % 2 === 0) {
      obstacles.push({
        kind: 'spike',
        direction: section % 4 === 0 ? 'down' : 'up',
        x: x + 250,
        y: section % 4 === 0 ? 0 : HEIGHT - 86,
        width: 38,
        height: 34,
        color: section % 4 === 0 ? '#2f4f74' : '#8f3d58',
      });
    }

    if (mode === 'ufo') {
      orbs.push({ x: x + spacing * 0.46, y: center - 28, radius: 14 });
    }
  }

  return {
    duration,
    speed,
    obstacles,
    orbs,
    tutorial: TUTORIALS[mode],
  };
}

function normalizeObstacle(obstacle: Partial<Obstacle>, fallbackX: number): Obstacle {
  const kind = obstacle.kind && ['block', 'spike', 'saw', 'spikedBlock'].includes(obstacle.kind) ? obstacle.kind : 'block';
  const width = clamp(Number(obstacle.width) || 56, 24, 120);
  const height = clamp(Number(obstacle.height) || 48, 24, kind === 'spike' ? 88 : HEIGHT - 68);
  const x = Math.max(760, Number(obstacle.x) || fallbackX);
  const y = clamp(Number(obstacle.y) || 0, 0, HEIGHT - 52);
  const color = typeof obstacle.color === 'string' && /^#[0-9a-f]{6}$/i.test(obstacle.color) ? obstacle.color : '#243b53';
  const direction = obstacle.direction === 'down' ? 'down' : 'up';

  return { kind, direction, x, y, width, height, color };
}

function normalizeOrb(orb: Partial<Orb>, fallbackX: number): Orb {
  return {
    x: Math.max(760, Number(orb.x) || fallbackX),
    y: clamp(Number(orb.y) || PLAYER_CENTER_Y, PLAYER_MIN_Y + 28, PLAYER_MAX_Y - 28),
    radius: clamp(Number(orb.radius) || 14, 10, 18),
  };
}

function buildFallbackInfiniteSegment(choice: Choice, _speedMode: SpeedMode, fromX: number, segmentLength = INFINITE_SEGMENT_LENGTH) {
  const hardChoice: Choice = { mode: choice.mode, difficulty: 'hard' };
  const random = seededRandom(choiceSeed(hardChoice) + Math.floor(fromX / 37));
  const sectionCount = Math.max(4, Math.floor(segmentLength / 430));
  const spacing = segmentLength / sectionCount;
  const obstacles: Obstacle[] = [];
  const orbs: Orb[] = [];

  for (let section = 0; section < sectionCount; section += 1) {
    const x = fromX + 240 + section * spacing;
    const center =
      PLAYER_CENTER_Y +
      Math.sin((fromX + section * 431) / (choice.mode === 'laser' ? 760 : 620)) * (choice.mode === 'ship' ? 76 : 104) +
      (random() - 0.5) * 52;
    const gap =
      choice.mode === 'orbit'
        ? 192
        : choice.mode === 'ship'
          ? 178
          : choice.mode === 'laser'
            ? 126
            : choice.mode === 'flipWave'
              ? 162
              : choice.mode === 'wave'
                ? 148
                : 208;
    const width = choice.mode === 'laser' ? 92 : choice.mode === 'orbit' ? 58 : 66;
    const topHeight = Math.max(54, center - gap / 2);
    const bottomY = Math.min(HEIGHT - 78, center + gap / 2);
    const color = section % 2 === 0 ? '#243b53' : '#7c314f';

    obstacles.push({ x, y: 0, width, height: topHeight, color });
    obstacles.push({ x, y: bottomY, width, height: HEIGHT - bottomY - 52, color });

    if (section % 2 === 0 || random() > 0.42) {
      const sawSize = choice.mode === 'laser' ? 42 : 36;
      obstacles.push({
        kind: 'saw',
        x: x + spacing * (0.48 + random() * 0.18),
        y: clamp(center + (random() > 0.5 ? -84 : 54), PLAYER_MIN_Y + 18, PLAYER_MAX_Y - 52),
        width: sawSize,
        height: sawSize,
        color: '#d9e2ec',
      });
    }

    if (random() > 0.36) {
      const spikeHeight = 34;
      const fromTop = random() > 0.5;
      const spikeCount = random() > 0.6 ? 3 : 2;
      for (let index = 0; index < spikeCount; index += 1) {
        obstacles.push({
          kind: 'spike',
          direction: fromTop ? 'down' : 'up',
          x: x + 96 + index * 46,
          y: fromTop ? 0 : HEIGHT - 52 - spikeHeight,
          width: 40,
          height: spikeHeight,
          color: fromTop ? '#2f4f74' : '#8f3d58',
        });
      }
    }

    if (random() > 0.55) {
      obstacles.push({
        kind: 'spikedBlock',
        x: x + spacing * (0.34 + random() * 0.28),
        y: clamp(center + (random() > 0.5 ? -92 : 54), PLAYER_MIN_Y + 16, PLAYER_MAX_Y - 72),
        width: 46,
        height: 42,
        color: '#6842c2',
      });
    }

    if (choice.mode === 'ufo' && random() > 0.35) {
      orbs.push({ x: x + spacing * 0.42, y: clamp(center, PLAYER_MIN_Y + 48, PLAYER_MAX_Y - 48), radius: 14 });
    }
  }

  return { obstacles, orbs };
}

async function generateInfiniteSegment(choice: Choice, speedMode: SpeedMode, fromX: number) {
  try {
    const response = await fetch('/api/generate-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: choice.mode,
        difficulty: 'hard',
        speedMode,
        fromX,
        segmentLength: INFINITE_SEGMENT_LENGTH,
        seed: choiceSeed({ mode: choice.mode, difficulty: 'hard' }) + Math.floor(fromX),
      }),
    });
    if (!response.ok) throw new Error(`AI level request failed: ${response.status}`);
    const data = (await response.json()) as { obstacles?: Partial<Obstacle>[]; orbs?: Partial<Orb>[] };
    const obstacles = Array.isArray(data.obstacles)
      ? data.obstacles.map((obstacle, index) => normalizeObstacle(obstacle, fromX + 260 + index * 48))
      : [];
    const orbs = Array.isArray(data.orbs)
      ? data.orbs.map((orb, index) => normalizeOrb(orb, fromX + 360 + index * 120))
      : [];
    if (obstacles.length > 0) return { obstacles, orbs };
  } catch {
    // Локально Vite не поднимает Vercel route, поэтому оставляем быстрый встроенный генератор.
  }

  return buildFallbackInfiniteSegment(choice, speedMode, fromX);
}

function createInfiniteLevel(choice: Choice, speedMode: SpeedMode, firstSegment: { obstacles: Obstacle[]; orbs: Orb[] }): Level {
  const baseLevel = buildLevel({ mode: choice.mode, difficulty: 'hard' }, speedMode, false);
  return {
    duration: INFINITE_DURATION,
    speed: baseLevel.speed,
    obstacles: firstSegment.obstacles,
    orbs: choice.mode === 'ufo' ? firstSegment.orbs : [],
    infinite: true,
    generatedUntil: 900 + INFINITE_SEGMENT_LENGTH,
  };
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
  if (mode === 'orbit') return 18;
  if (mode === 'ufo') return 18;
  return 20;
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

function drawCenteredWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = nextLine;
    }
  });

  if (line) {
    lines.push(line);
  }

  lines.forEach((item, index) => {
    if (ctx.lineWidth > 0) {
      ctx.strokeText(item, x, y + index * lineHeight);
    }
    ctx.fillText(item, x, y + index * lineHeight);
  });

  return lines.length;
}

function getTutorialStep(tutorial: TutorialInfo, elapsed: number) {
  return tutorial.steps.find((step) => elapsed >= step.start && elapsed <= step.end) ?? null;
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
  const hudProgress = level.infinite ? (elapsed % 30_000) / 30_000 : progress;
  const cameraX = (elapsed / 1000) * level.speed;
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
    const appearProgress = clamp((WIDTH + 120 - screenX) / 220, 0, 1);
    const appearEase = 1 - (1 - appearProgress) ** 3;
    const fromCeiling =
      obstacle.kind === 'spike' ? obstacle.direction === 'down' : obstacle.y + obstacle.height / 2 < HEIGHT / 2;
    const spawnDistance = obstacle.kind === 'saw' ? 88 : clamp(obstacle.height * 0.72, 64, 190);
    const animatedX = screenX;
    const animatedY = obstacle.y + (1 - appearEase) * (fromCeiling ? -spawnDistance : spawnDistance);
    const scale = 0.92 + appearEase * 0.08;
    ctx.save();
    ctx.globalAlpha *= appearEase;

    if (obstacle.kind === 'spike') {
      const baseY = obstacle.direction === 'down' ? animatedY : animatedY + obstacle.height;
      const tipY = obstacle.direction === 'down' ? animatedY + obstacle.height : animatedY;
      const centerX = animatedX + obstacle.width / 2;
      const anchorY = obstacle.direction === 'down' ? animatedY : animatedY + obstacle.height;
      ctx.save();
      ctx.translate(centerX, anchorY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -anchorY);
      ctx.beginPath();
      ctx.moveTo(animatedX, baseY);
      ctx.lineTo(animatedX + obstacle.width / 2, tipY);
      ctx.lineTo(animatedX + obstacle.width, baseY);
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
      ctx.restore();
      return;
    }

    if (obstacle.kind === 'saw') {
      const centerX = animatedX + obstacle.width / 2;
      const centerY = animatedY + obstacle.height / 2;
      const radius = obstacle.width / 2;
      const teeth = 14;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
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
      ctx.restore();
      return;
    }

    if (obstacle.kind === 'spikedBlock') {
      const tooth = 9;
      const toothPadding = 4;
      const toothCount = Math.max(1, Math.floor((obstacle.width - toothPadding * 2) / tooth));
      const teethWidth = toothCount * tooth;
      const teethStartX = animatedX + (obstacle.width - teethWidth) / 2;
      const centerX = animatedX + obstacle.width / 2;
      const centerY = animatedY + obstacle.height / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
      ctx.fillStyle = obstacle.color;
      ctx.shadowColor = obstacle.color;
      ctx.shadowBlur = 10;
      ctx.fillRect(animatedX, animatedY, obstacle.width, obstacle.height);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.44)';
      ctx.lineWidth = 2;
      ctx.strokeRect(animatedX + 1, animatedY + 1, obstacle.width - 2, obstacle.height - 2);
      ctx.fillStyle = '#d9e2ec';
      for (let index = 0; index < toothCount; index += 1) {
        const px = teethStartX + index * tooth;
        ctx.beginPath();
        ctx.moveTo(px, animatedY);
        ctx.lineTo(px + tooth / 2, animatedY - tooth);
        ctx.lineTo(px + tooth, animatedY);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, animatedY + obstacle.height);
        ctx.lineTo(px + tooth / 2, animatedY + obstacle.height + tooth);
        ctx.lineTo(px + tooth, animatedY + obstacle.height);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();
      return;
    }

    const centerX = animatedX + obstacle.width / 2;
    const centerY = animatedY + obstacle.height / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);
    ctx.fillStyle = obstacle.color;
    ctx.fillRect(animatedX, animatedY, obstacle.width, obstacle.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 2;
    ctx.strokeRect(animatedX + 1, animatedY + 1, obstacle.width - 2, obstacle.height - 2);
    ctx.restore();
    ctx.restore();
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
    if (!level.infinite) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(24, 22, WIDTH - 48, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(24, 22, (WIDTH - 48) * hudProgress, 10);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(level.infinite ? `∞ ${Math.floor(elapsed / 1000)} с` : `${Math.round(progress * 100)}%`, 24, level.infinite ? 42 : 66);
  }

  const tutorialStep = level.tutorial ? getTutorialStep(level.tutorial, elapsed) : null;
  if (showHud && level.tutorial && tutorialStep) {
    const fadeIn = clamp((elapsed - tutorialStep.start) / 900, 0, 1);
    const fadeOut = clamp((tutorialStep.end - elapsed) / 1_400, 0, 1);
    const fade = Math.min(fadeIn, fadeOut);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.shadowColor = 'rgba(0,0,0,0.86)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,0.52)';
    ctx.textAlign = 'center';
    ctx.font = '900 18px Inter, system-ui, sans-serif';
    ctx.strokeText(level.tutorial.title, WIDTH / 2, 94);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(level.tutorial.title, WIDTH / 2, 94);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 18px Inter, system-ui, sans-serif';
    const instructionY = 122;
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';
    const instructionLines = drawCenteredWrappedText(ctx, tutorialStep.instruction, WIDTH / 2, instructionY, 560, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 14px Inter, system-ui, sans-serif';
    drawCenteredWrappedText(ctx, tutorialStep.hint, WIDTH / 2, 150 + Math.max(0, instructionLines - 1) * 18, 560, 18);
    ctx.restore();
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

  if (showHud && (level.infinite ? elapsed < 2_700 : progress < 0.045) && attempt > 0) {
    const fade = level.infinite ? clamp((2_700 - elapsed) / 1_200, 0, 1) : clamp((0.045 - progress) / 0.02, 0, 1);
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
    if (ufoJumpQueued) {
      next.vy = -315 * gravityDirection;
    }
    next.vy += 900 * gravityDirection * dt;
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

  const { data: currentAccount } = await supabase
    .from('accounts')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const provider = user.app_metadata.provider;
  const { error } = await supabase.from('accounts').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      display_name: currentAccount?.display_name ?? getFallbackNickname(user),
      avatar_url: user.user_metadata.avatar_url ?? user.user_metadata.picture ?? null,
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
  const lastCheckpointAtRef = useRef(0);
  const nextAutoCheckpointAtRef = useRef(PRACTICE_AUTO_CHECKPOINT_MS);
  const practiceRespawnUntilRef = useRef(0);
  const practiceRespawnMusicPendingRef = useRef(false);
  const deathAnimationRef = useRef<DeathAnimation | null>(null);
  const winAnimationRef = useRef<WinAnimation | null>(null);
  const teleportEffectRef = useRef<TeleportEffect | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeMusicRef = useRef<ActiveMusic | null>(null);
  const menuMusicRef = useRef<HTMLAudioElement | null>(null);
  const infiniteGeneratingRef = useRef(false);
  const screenRef = useRef<Screen>('home');
  const [choice, setChoice] = useState<Choice>({ mode: 'wave', difficulty: 'easy' });
  const [homePreview, setHomePreview] = useState<HomePreview>(() => createHomePreview());
  const [homePreviewTransitioning, setHomePreviewTransitioning] = useState(false);
  const [speedMode, setSpeedMode] = useState<SpeedMode>('normal');
  const [practiceMode, setPracticeMode] = useState(false);
  const [infiniteMode, setInfiniteMode] = useState(false);
  const [infiniteLevel, setInfiniteLevel] = useState<Level | null>(null);
  const [infiniteLoading, setInfiniteLoading] = useState(false);
  const [tutorialMode, setTutorialMode] = useState(false);
  const [tutorialLevel, setTutorialLevel] = useState<Level | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [records, setRecords] = useState<RecordMap>(() => loadRecords());
  const [infiniteRecords, setInfiniteRecords] = useState<RecordMap>(() => loadInfiniteRecords());
  const [colors, setColors] = useState<ColorSettings>(() => loadColors());
  const [modifications, setModifications] = useState<ModificationSettings>(() => loadModifications());
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => loadAudioSettings());
  const [lastResult, setLastResult] = useState<
    { progress: number; completed: boolean; attempts: number; infinite?: boolean; tutorialMode?: boolean; mode?: Mode } | null
  >(null);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const [speedPickerOpen, setSpeedPickerOpen] = useState(false);
  const [difficultyPickerOpen, setDifficultyPickerOpen] = useState(false);
  const [controlsPickerOpen, setControlsPickerOpen] = useState(false);
  const [audioSettingsOpen, setAudioSettingsOpen] = useState(false);
  const [menuAnimationDisabled, setMenuAnimationDisabled] = useState(false);
  const [modalClosing, setModalClosing] = useState(false);
  const [checkpointButtonActive, setCheckpointButtonActive] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [nickname, setNickname] = useState('');
  const [nicknameMessage, setNicknameMessage] = useState('');
  const [leaderboardMode, setLeaderboardMode] = useState<Mode>('wave');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardMessage, setLeaderboardMessage] = useState('');
  const [leaderboardListOpen, setLeaderboardListOpen] = useState(false);
  const [guestInfiniteNoticeOpen, setGuestInfiniteNoticeOpen] = useState(false);
  const [guestInfiniteNoticeSeen, setGuestInfiniteNoticeSeen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [ownReviews, setOwnReviews] = useState<FeedbackReview[]>([]);
  const [adminReviewsOpen, setAdminReviewsOpen] = useState(false);
  const [adminReviews, setAdminReviews] = useState<FeedbackReview[]>([]);
  const [adminReviewsLoading, setAdminReviewsLoading] = useState(false);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const regularLevel = useMemo(() => buildLevel(choice, speedMode, modifications.splitMode), [choice, speedMode, modifications.splitMode]);
  const level = infiniteMode && infiniteLevel ? infiniteLevel : tutorialMode && tutorialLevel ? tutorialLevel : regularLevel;
  const homePreviewLevel = useMemo(() => buildLevel(homePreview.choice, 'normal', false), [homePreview.choice]);
  const best = records[recordKey(choice)] ?? 0;
  const infiniteBest = infiniteRecords[infiniteRecordKey(choice.mode)] ?? 0;
  const selectedMode = MODES.find((mode) => mode.id === choice.mode) ?? MODES[0];
  const selectedSpeed = SPEED_MODES.find((speed) => speed.id === speedMode) ?? SPEED_MODES[0];
  const selectedDifficulty = DIFFICULTIES.find((difficulty) => difficulty.id === choice.difficulty) ?? DIFFICULTIES[0];
  const previewMode = MODES.find((mode) => mode.id === homePreview.choice.mode) ?? MODES[0];
  const userEmail = session?.user.email ?? '';
  const visibleNickname = nickname.trim() || (session ? getFallbackNickname(session.user) : '');
  const isAdmin = session?.user.email?.toLowerCase() === ADMIN_EMAIL;

  const loadAccountNickname = useCallback(async (user: User) => {
    if (!supabase) {
      setNickname(getFallbackNickname(user));
      return;
    }

    const { data, error } = await supabase.from('accounts').select('display_name').eq('id', user.id).maybeSingle();
    if (error) {
      console.warn('Не удалось загрузить никнейм:', error.message);
      setNickname(getFallbackNickname(user));
      return;
    }
    setNickname(data?.display_name?.trim() || getFallbackNickname(user));
  }, []);

  const loadOwnReviews = useCallback(async () => {
    if (!session || !supabase) {
      setOwnReviews([]);
      return;
    }

    const { data, error } = await supabase
      .from('feedback_reviews')
      .select('id, user_id, email, nickname, body, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      setReviewMessage('Не удалось загрузить отзывы.');
      setOwnReviews([]);
    } else {
      setOwnReviews((data ?? []) as FeedbackReview[]);
    }
  }, [session]);

  const openReviewModal = useCallback(() => {
    setReviewOpen(true);
    setReviewMessage('');
    setReviewText('');
    void loadOwnReviews();
  }, [loadOwnReviews]);

  const submitReview = useCallback(async () => {
    const body = reviewText.trim();
    if (!session) {
      setReviewMessage('Войдите в аккаунт, чтобы оставить отзыв.');
      return;
    }
    if (!supabase) {
      setReviewMessage('Supabase не настроен.');
      return;
    }
    if (body.length === 0) {
      setReviewMessage('Напишите отзыв.');
      return;
    }
    if (body.length > REVIEW_LIMIT) {
      setReviewMessage(`Максимум ${REVIEW_LIMIT} символов.`);
      return;
    }

    setReviewBusy(true);
    setReviewMessage('');
    const { error } = await supabase.from('feedback_reviews').insert({
      user_id: session.user.id,
      email: session.user.email ?? null,
      nickname: visibleNickname || null,
      body,
    });
    setReviewBusy(false);

    if (error) {
      setReviewMessage('Не удалось сохранить отзыв.');
    } else {
      setReviewText('');
      setReviewMessage('Отзыв сохранён.');
      void loadOwnReviews();
    }
  }, [loadOwnReviews, reviewText, session, visibleNickname]);

  const loadAdminReviews = useCallback(async () => {
    if (!isAdmin || !supabase) return;

    setAdminReviewsLoading(true);
    const { data, error } = await supabase
      .from('feedback_reviews')
      .select('id, user_id, email, nickname, body, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    setAdminReviewsLoading(false);

    if (error) {
      setAdminReviews([]);
    } else {
      setAdminReviews((data ?? []) as FeedbackReview[]);
    }
  }, [isAdmin]);

  const openAdminReviews = useCallback(() => {
    if (!isAdmin) return;
    setAdminReviewsOpen(true);
    void loadAdminReviews();
  }, [isAdmin, loadAdminReviews]);

  const loadLeaderboard = useCallback(async (mode: Mode) => {
    setLeaderboardMode(mode);
    setLeaderboardLoading(true);
    setLeaderboardMessage('');

    if (!supabase) {
      setLeaderboardEntries([]);
      setLeaderboardMessage('Supabase не настроен.');
      setLeaderboardLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('infinite_leaderboard')
      .select('id, user_id, mode, nickname, seconds')
      .eq('mode', mode)
      .order('seconds', { ascending: false })
      .limit(10);

    if (error) {
      setLeaderboardEntries([]);
      setLeaderboardMessage('Не удалось загрузить лидерборд.');
    } else {
      setLeaderboardEntries((data ?? []) as LeaderboardEntry[]);
    }
    setLeaderboardLoading(false);
  }, []);

  const updateNickname = useCallback(async () => {
    if (!session || !supabase) return;
    const nextNickname = nickname.trim().slice(0, 24);
    if (!nextNickname) {
      setNicknameMessage('Никнейм не может быть пустым.');
      return;
    }

    setNickname(nextNickname);
    setNicknameMessage('');
    const { error } = await supabase.from('accounts').upsert(
      {
        id: session.user.id,
        email: session.user.email ?? null,
        display_name: nextNickname,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) {
      setNicknameMessage('Не удалось сохранить никнейм.');
    } else {
      await supabase
        .from('infinite_leaderboard')
        .update({ nickname: nextNickname, updated_at: new Date().toISOString() })
        .eq('user_id', session.user.id);
      if (screen === 'leaderboard') {
        void loadLeaderboard(leaderboardMode);
      }
      setNicknameMessage('Никнейм сохранён.');
      window.setTimeout(() => setNicknameMessage(''), 1800);
    }
  }, [leaderboardMode, loadLeaderboard, nickname, screen, session]);

  const saveLeaderboardResult = useCallback(
    async (mode: Mode, seconds: number) => {
      if (!session || !supabase) return;
      const roundedSeconds = Math.round(seconds);
      if (roundedSeconds <= 0) return;

      const nextNickname = visibleNickname.trim().slice(0, 24);
      if (!nextNickname) return;

      const { data } = await supabase
        .from('infinite_leaderboard')
        .select('seconds')
        .eq('user_id', session.user.id)
        .eq('mode', mode)
        .maybeSingle();
      if ((data?.seconds ?? 0) >= roundedSeconds) return;

      const { error } = await supabase.from('infinite_leaderboard').upsert(
        {
          user_id: session.user.id,
          mode,
          nickname: nextNickname,
          seconds: roundedSeconds,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,mode' },
      );

      if (error) {
        console.warn('Не удалось сохранить результат в лидерборд:', error.message);
      } else if (mode === leaderboardMode) {
        void loadLeaderboard(mode);
      }
    },
    [leaderboardMode, loadLeaderboard, session, visibleNickname],
  );

  const getAudioContext = useCallback(() => {
    const AudioContextConstructor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const context = audioContextRef.current ?? new AudioContextConstructor();
    audioContextRef.current = context;
    void context.resume().catch(() => undefined);
    return context;
  }, []);

  const stopMenuMusic = useCallback(() => {
    const menuMusic = menuMusicRef.current;
    if (!menuMusic) return;

    menuMusic.pause();
    menuMusicRef.current = null;
  }, []);

  const startMenuMusic = useCallback(() => {
    const currentMusic = menuMusicRef.current;
    if (currentMusic) {
      if (currentMusic.paused) {
        void currentMusic.play().catch(() => undefined);
      }
      return;
    }

    const audio = new Audio(eventHorizonLatticeMenu);
    audio.loop = true;
    audio.volume = 0.28;
    menuMusicRef.current = audio;
    void audio.play().catch(() => {
      if (menuMusicRef.current === audio) {
        menuMusicRef.current = null;
      }
    });
  }, []);

  const fadeFileAudio = (audio: HTMLAudioElement, toVolume: number, durationMs: number, afterFade?: () => void) => {
    const fromVolume = audio.volume;
    const startedAt = performance.now();

    const step = () => {
      const progress = clamp((performance.now() - startedAt) / durationMs, 0, 1);
      audio.volume = fromVolume + (toVolume - fromVolume) * progress;
      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }
      afterFade?.();
    };

    step();
  };

  const seekFileAudioToElapsed = (audio: HTMLAudioElement, elapsed: number) => {
    const targetSeconds = (elapsed / 1000) * audio.playbackRate;
    const duration = audio.duration;
    try {
      audio.currentTime = Number.isFinite(duration) && duration > 0 ? targetSeconds % duration : targetSeconds;
    } catch {
      // Some browsers reject seeking before metadata is ready.
    }
  };

  const stopSoundtrack = useCallback(() => {
    const activeMusic = activeMusicRef.current;
    if (!activeMusic) return;

    if (activeMusic.kind === 'file') {
      const audio = activeMusic.audio;
      activeMusicRef.current = null;
      fadeFileAudio(audio, 0, LEVEL_MUSIC_FADE_OUT_MS, () => {
        audio.pause();
        audio.currentTime = 0;
      });
      return;
    }

    activeMusic.timers.forEach((timer) => window.clearInterval(timer));
    const now = audioContextRef.current?.currentTime ?? 0;
    activeMusic.master.gain.cancelScheduledValues(now);
    activeMusic.master.gain.setValueAtTime(Math.max(0.0001, activeMusic.master.gain.value), now);
    activeMusic.master.gain.exponentialRampToValueAtTime(0.0001, now + LEVEL_MUSIC_FADE_OUT_MS / 1000);
    window.setTimeout(() => activeMusic.master.disconnect(), LEVEL_MUSIC_FADE_OUT_MS + 80);
    activeMusicRef.current = null;
  }, []);

  const startSoundtrack = useCallback(
    (
      trackChoice: Choice,
      trackSpeedMode: SpeedMode,
      options: { fadeIn?: boolean; infinite?: boolean; startElapsed?: number; paused?: boolean } = {},
    ) => {
      stopSoundtrack();
      const fadeIn = options.fadeIn ?? true;
      const fileTrack = options.infinite
        ? chromeRiftInfinite
        : trackChoice.mode === 'ship' && trackChoice.difficulty === 'easy'
          ? neonDriftProtocol
          : trackChoice.mode === 'ship' && trackChoice.difficulty === 'medium'
            ? neonDriftProtocolShipMedium
            : trackChoice.mode === 'ship' && trackChoice.difficulty === 'hard'
            ? neonExitVectorShipHard
            : trackChoice.mode === 'ufo' && trackChoice.difficulty === 'easy'
              ? neonDriftProtocolUfoEasy
              : trackChoice.mode === 'ufo' && trackChoice.difficulty === 'medium'
                ? neonDriftProtocolUfoMedium
                : trackChoice.mode === 'ufo' && trackChoice.difficulty === 'hard'
                  ? glitchArcadeRiftUfoHard
                  : trackChoice.mode === 'orbit' && trackChoice.difficulty === 'easy'
                    ? orbitCarnivalOrbitEasy
                    : trackChoice.mode === 'orbit' && trackChoice.difficulty === 'medium'
                      ? neonFreefallOrbitMedium
                      : trackChoice.mode === 'orbit' && trackChoice.difficulty === 'hard'
                        ? neonFreefallOrbitHard
                        : trackChoice.mode === 'laser' && trackChoice.difficulty === 'easy'
                          ? neonCircuitRiteLaserEasy
                          : trackChoice.mode === 'laser' && trackChoice.difficulty === 'medium'
                            ? neonCircuitRiteLaserMedium
                            : trackChoice.mode === 'laser' && trackChoice.difficulty === 'hard'
                              ? neonCircuitRiteLaserHard
                              : trackChoice.mode === 'wave' && trackChoice.difficulty === 'easy'
                                ? neonSpikeCircuitWaveEasy
                                : trackChoice.mode === 'wave' && trackChoice.difficulty === 'medium'
                                  ? chromeFurnaceWaveMedium
                                  : trackChoice.mode === 'wave' && trackChoice.difficulty === 'hard'
                                    ? chromeFurnaceWaveHard
                                    : trackChoice.mode === 'flipWave' && trackChoice.difficulty === 'easy'
                                      ? neonSpikeCircuitFlipWaveEasy
                                      : trackChoice.mode === 'flipWave' && trackChoice.difficulty === 'medium'
                                        ? neonSpikeCircuitFlipWaveMedium
                                        : trackChoice.mode === 'flipWave' && trackChoice.difficulty === 'hard'
                                          ? neonSpikeCircuitFlipWaveHard
                                          : null;
      if (fileTrack) {
        const speedSettings = SPEED_MODES.find((item) => item.id === trackSpeedMode) ?? SPEED_MODES[0];
        const audio = new Audio(fileTrack);
        audio.loop = true;
        audio.volume = fadeIn ? 0 : LEVEL_MUSIC_VOLUME;
        audio.playbackRate = speedSettings.multiplier;
        if (typeof options.startElapsed === 'number') {
          seekFileAudioToElapsed(audio, options.startElapsed);
          audio.addEventListener('loadedmetadata', () => seekFileAudioToElapsed(audio, options.startElapsed ?? 0), {
            once: true,
          });
        }
        activeMusicRef.current = { kind: 'file', audio, targetVolume: LEVEL_MUSIC_VOLUME };
        if (!options.paused) {
          void audio.play().then(() => {
            if (fadeIn && activeMusicRef.current?.kind === 'file' && activeMusicRef.current.audio === audio) {
              fadeFileAudio(audio, LEVEL_MUSIC_VOLUME, LEVEL_MUSIC_FADE_IN_MS);
            }
          }).catch(() => {
            if (activeMusicRef.current?.kind === 'file' && activeMusicRef.current.audio === audio) {
              activeMusicRef.current = null;
            }
          });
        }
        return;
      }

      const context = getAudioContext();
      if (!context) return;

      const bpm =
        156 +
        (trackChoice.difficulty === 'hard' ? 18 : trackChoice.difficulty === 'medium' ? 9 : 0) +
        (trackSpeedMode === 'superfast' ? 14 : trackSpeedMode === 'fast' ? 7 : 0);
      const beat = 60 / bpm;
      const sixteenth = beat / 4;
      const roots: Record<Mode, number> = {
        wave: 220,
        flipWave: 233.08,
        laser: 185,
        orbit: 207.65,
        ship: 196,
        ufo: 246.94,
      };
      const scales: Record<Mode, number[]> = {
        wave: [0, 2, 3, 7, 10, 12, 14, 15],
        flipWave: [0, 3, 5, 7, 10, 12, 15, 17],
        laser: [0, 2, 5, 7, 10, 12, 14, 17],
        orbit: [0, 3, 7, 10, 12, 15, 19, 22],
        ship: [0, 2, 4, 7, 9, 12, 16, 19],
        ufo: [0, 4, 5, 7, 11, 12, 16, 19],
      };
      const motifs: Record<Mode, number[]> = {
        wave: [0, 4, 7, 11, 9, 7, 4, 2, 0, 7, 12, 11, 9, 4, 7, 2],
        flipWave: [0, 7, 3, 10, 5, 12, 7, 14, 3, 10, 15, 12, 7, 5, 2, 0],
        laser: [0, 5, 7, 12, 10, 7, 5, 3, 0, 7, 10, 14, 12, 10, 7, 5],
        orbit: [0, 7, 12, 15, 12, 10, 7, 3, 0, 10, 15, 19, 15, 12, 10, 7],
        ship: [0, 4, 7, 9, 12, 9, 7, 4, 2, 7, 9, 14, 16, 14, 9, 7],
        ufo: [0, 4, 7, 11, 12, 11, 7, 4, 5, 7, 12, 16, 19, 16, 12, 7],
      };
      const root = roots[trackChoice.mode];
      const scale = scales[trackChoice.mode];
      const motif = motifs[trackChoice.mode];
      const master = context.createGain();
      const filter = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();

      const targetVolume = trackChoice.difficulty === 'hard' ? 0.058 : 0.048;
      master.gain.setValueAtTime(fadeIn ? 0.0001 : targetVolume, context.currentTime);
      if (fadeIn) {
        master.gain.exponentialRampToValueAtTime(targetVolume, context.currentTime + LEVEL_MUSIC_FADE_IN_MS / 1000);
      }
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(trackChoice.difficulty === 'hard' ? 7600 : 6400, context.currentTime);
      master.connect(filter);
      filter.connect(compressor);
      compressor.connect(context.destination);

      const note = (degree: number, octave = 1) => {
        const semitone = scale[((degree % scale.length) + scale.length) % scale.length] + Math.floor(degree / scale.length) * 12;
        return root * octave * 2 ** (semitone / 12);
      };

      const tone = (
        frequency: number,
        start: number,
        duration: number,
        type: OscillatorType,
        volume: number,
        endFrequency = frequency,
      ) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.03);
      };

      const supersaw = (frequency: number, start: number, duration: number, volume: number) => {
        [-0.014, -0.006, 0.004, 0.013].forEach((detune, index) => {
          tone(frequency * (1 + detune), start + index * 0.003, duration, 'sawtooth', volume / 4);
        });
      };

      const noise = (start: number, duration: number, volume: number) => {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < data.length; index += 1) {
          data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
        }
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        source.connect(gain);
        gain.connect(master);
        source.start(start);
        source.stop(start + duration);
      };

      let bar = 0;
      const scheduleBar = () => {
        const startAt = context.currentTime + 0.05;
        const bassDegree = motif[(bar * 5) % motif.length] % 7;
        const tranceBar = bar % 2 === 1;
        const bassSteps =
          trackChoice.difficulty === 'hard'
            ? [0, 1, 3, 4, 6, 8, 9, 11, 12, 14]
            : trackChoice.difficulty === 'medium'
              ? [0, 2, 3, 6, 8, 10, 11, 14]
              : [0, 3, 6, 8, 10, 13];

        for (let beatIndex = 0; beatIndex < 4; beatIndex += 1) {
          const beatAt = startAt + beatIndex * beat;
          tone(72, beatAt, 0.075, 'sine', 0.72, 36);
          if (beatIndex === 1 || beatIndex === 3) {
            noise(beatAt, 0.065, 0.18);
            tone(180, beatAt, 0.07, 'triangle', 0.14, 85);
          }
        }

        for (let step = 0; step < 16; step += 1) {
          const stepAt = startAt + step * sixteenth;
          if (step % 2 === 1 || (tranceBar && step % 4 === 0)) {
            noise(stepAt, 0.018, tranceBar ? 0.095 : 0.07);
          }
          if (bassSteps.includes(step)) {
            const degree = bassDegree + (tranceBar && step % 8 === 6 ? 1 : 0);
            tone(note(degree, 0.5), stepAt, sixteenth * 0.78, 'sawtooth', 0.25);
            tone(note(bassDegree, 0.25), stepAt, sixteenth * 0.42, 'square', 0.1, note(bassDegree, step % 4 === 3 ? 0.72 : 0.5));
          }
        }

        for (let step = 0; step < 16; step += tranceBar ? 2 : 4) {
          const stepAt = startAt + step * sixteenth;
          const degree = motif[(step + bar * 3) % motif.length];
          if (tranceBar) {
            tone(note(degree, 2), stepAt, sixteenth * 0.82, 'square', step % 8 === 0 ? 0.14 : 0.09);
            if (step % 4 === 2) supersaw(note(degree + 5, 2), stepAt, sixteenth * 0.55, 0.075);
          } else {
            supersaw(note(degree, 2), stepAt, sixteenth * 1.7, step % 8 === 0 ? 0.12 : 0.085);
          }
        }

        if (bar % 4 === 3) {
          noise(startAt + beat * 3.5, beat * 0.28, 0.16);
          supersaw(note(motif[(bar * 7) % motif.length] + 8, 2), startAt + beat * 3, beat * 0.5, 0.14);
        }

        bar += 1;
      };

      scheduleBar();
      const timer = window.setInterval(scheduleBar, beat * 4 * 1000);
      activeMusicRef.current = { kind: 'synth', master, timers: [timer], targetVolume };
    },
    [getAudioContext, stopSoundtrack],
  );

  const syncSoundtrackToElapsed = useCallback(
    (elapsed: number, options: { fadeIn?: boolean; pauseAfterSeek?: boolean } = {}) => {
      const activeMusic = activeMusicRef.current;
      if (!activeMusic) {
        startSoundtrack(choice, speedMode, {
          fadeIn: options.fadeIn ?? false,
          paused: options.pauseAfterSeek,
          startElapsed: elapsed,
        });
        return;
      }

      if (activeMusic.kind === 'file') {
        seekFileAudioToElapsed(activeMusic.audio, elapsed);
        if (options.pauseAfterSeek) {
          activeMusic.audio.pause();
        } else if (activeMusic.audio.paused) {
          activeMusic.audio.volume = activeMusic.targetVolume;
          void activeMusic.audio.play().catch(() => undefined);
        }
        return;
      }

      startSoundtrack(choice, speedMode, { fadeIn: options.fadeIn ?? false, startElapsed: elapsed });
    },
    [choice, speedMode, startSoundtrack],
  );

  const playSound = useCallback((sound: SoundName) => {
    if (!audioSettings.soundEffects) return;

    const context = getAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.16, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (sound === 'win' ? 0.74 : 0.34));
    master.connect(context.destination);

    const playTone = (
      frequency: number,
      start: number,
      duration: number,
      type: OscillatorType = 'sine',
      volume = 1,
      endFrequency = frequency,
    ) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now + start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + start + duration);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + start);
      oscillator.stop(now + start + duration + 0.02);
    };

    const playNoise = (start: number, duration: number, volume = 0.8) => {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(volume, now + start);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      source.connect(gain);
      gain.connect(master);
      source.start(now + start);
      source.stop(now + start + duration);
    };

    if (sound === 'click') playTone(520, 0, 0.06, 'triangle', 0.5, 680);
    if (sound === 'select') {
      playTone(460, 0, 0.07, 'triangle', 0.45, 620);
      playTone(760, 0.055, 0.08, 'sine', 0.38, 920);
    }
    if (sound === 'toggle') playTone(380, 0, 0.11, 'square', 0.35, 760);
    if (sound === 'start') {
      playTone(330, 0, 0.08, 'triangle', 0.5, 440);
      playTone(660, 0.075, 0.12, 'sine', 0.42, 990);
    }
    if (sound === 'pause') playTone(520, 0, 0.12, 'sine', 0.45, 260);
    if (sound === 'resume') playTone(280, 0, 0.11, 'triangle', 0.45, 620);
    if (sound === 'checkpoint') {
      playTone(640, 0, 0.08, 'triangle', 0.45, 840);
      playTone(980, 0.07, 0.1, 'sine', 0.35, 1180);
    }
    if (sound === 'removeCheckpoint') playTone(440, 0, 0.12, 'sawtooth', 0.35, 220);
    if (sound === 'teleport') {
      playTone(880, 0, 0.16, 'sawtooth', 0.34, 220);
      playTone(1320, 0.025, 0.12, 'triangle', 0.26, 420);
      playNoise(0.02, 0.1, 0.24);
    }
    if (sound === 'death') {
      playTone(220, 0, 0.22, 'sawtooth', 0.48, 70);
      playNoise(0.03, 0.18, 0.32);
    }
    if (sound === 'respawn') {
      playTone(260, 0, 0.08, 'triangle', 0.38, 420);
      playTone(520, 0.08, 0.1, 'sine', 0.34, 760);
    }
    if (sound === 'win') {
      playTone(523, 0, 0.11, 'square', 0.34, 523);
      playTone(659, 0.08, 0.11, 'square', 0.32, 659);
      playTone(784, 0.16, 0.13, 'square', 0.32, 784);
      playTone(1047, 0.27, 0.18, 'triangle', 0.36, 1319);
      playTone(1568, 0.42, 0.2, 'sine', 0.22, 2093);
      playNoise(0.03, 0.06, 0.12);
      playNoise(0.28, 0.08, 0.1);
    }
  }, [audioSettings.soundEffects, getAudioContext]);

  const openAuth = (mode: AuthMode) => {
    playSound('click');
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
    playSound('click');
    setModalClosing(true);
    window.setTimeout(() => {
      close();
      setModalClosing(false);
    }, MODAL_FADE_OUT_MS);
  };

  const continueAsGuest = () => {
    playSound('start');
    closeAuth();
    setMenuAnimationDisabled(false);
    setScreen('levelSelect');
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
      setScreen('levelSelect');
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
    playSound('click');
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setNickname('');
    setLeaderboardEntries([]);
    setLeaderboardListOpen(false);
    setGuestInfiniteNoticeOpen(false);
    setReviewOpen(false);
    setAdminReviewsOpen(false);
    setOwnReviews([]);
    setAdminReviews([]);
    closeAuth();
    setScreen('home');
  };

  const finishRun = useCallback(
    (progress: number, completed: boolean, saveProgress = true) => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearPausedRun();
      if (saveProgress && infiniteMode) {
        const saved = saveInfiniteRecord(choice.mode, progress);
        setInfiniteRecords((current) => ({ ...current, [infiniteRecordKey(choice.mode)]: saved }));
        void saveLeaderboardResult(choice.mode, progress);
      } else if (saveProgress && !tutorialMode) {
        const saved = saveRecord(choice, completed ? 100 : progress);
        setRecords((current) => ({ ...current, [recordKey(choice)]: saved }));
      }
      setLastResult({
        progress: Math.round(infiniteMode ? progress : completed ? 100 : progress),
        completed,
        attempts: attemptRef.current,
        infinite: infiniteMode,
        tutorialMode,
        mode: choice.mode,
      });
      setInfiniteMode(false);
      setTutorialMode(false);
      setTutorialLevel(null);
      setScreen('result');
    },
    [choice, infiniteMode, saveLeaderboardResult, session, tutorialMode],
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
    practiceRespawnMusicPendingRef.current = false;
  };

  const saveCurrentRun = () => {
    if (screen !== 'playing' && screen !== 'paused') return;
    if (deathAnimationRef.current || winAnimationRef.current) return;

    const pausedRun: SavedPausedRun = {
      choice,
      speedMode,
      practiceMode,
      modifications,
      infiniteMode,
      infiniteLevel,
      tutorialMode,
      tutorialLevel,
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
    setInfiniteMode(Boolean(saved.infiniteMode && saved.infiniteLevel));
    setInfiniteLevel(saved.infiniteLevel ?? null);
    setTutorialMode(Boolean(saved.tutorialMode && saved.tutorialLevel));
    setTutorialLevel(saved.tutorialLevel ?? null);
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

  const addPracticeCheckpoint = () => {
    if (!practiceMode || screen !== 'playing') return false;
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
    playSound('checkpoint');
    return true;
  };

  const removePracticeCheckpoint = () => {
    if (!practiceMode || screen !== 'playing') return;
    if (checkpointsRef.current.length === 0) return;
    checkpointsRef.current = checkpointsRef.current.slice(0, -1);
    playSound('removeCheckpoint');
  };

  const markCheckpointButtonActive = () => {
    setCheckpointButtonActive(true);
    window.setTimeout(() => setCheckpointButtonActive(false), 180);
  };

  const respawnPractice = () => {
    const checkpoint = checkpointsRef.current[checkpointsRef.current.length - 1];
    const shadowTeleportsLeft = shadowTeleportsLeftRef.current;
    const shadowCooldownUntil = shadowCooldownUntilRef.current;
    attemptRef.current += 1;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    resetRunState();
    shadowTeleportsLeftRef.current = shadowTeleportsLeft;
    shadowCooldownUntilRef.current = shadowCooldownUntil;

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

    if (audioSettings.levelMusic) {
      syncSoundtrackToElapsed(elapsedRef.current, { fadeIn: false, pauseAfterSeek: true });
      practiceRespawnMusicPendingRef.current = true;
    } else {
      practiceRespawnMusicPendingRef.current = false;
    }
    lastTimeRef.current = 0;
    practiceRespawnUntilRef.current = performance.now() + PRACTICE_RESPAWN_DELAY_MS;
    playSound('respawn');
  };

  const startRun = () => {
    playSound('start');
    clearPausedRun();
    setInfiniteMode(false);
    setInfiniteLevel(null);
    setTutorialMode(false);
    setTutorialLevel(null);
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setGuestInfiniteNoticeOpen(false);
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    resetRunState();
    checkpointsRef.current = [];
    lastCheckpointAtRef.current = 0;
    nextAutoCheckpointAtRef.current = PRACTICE_AUTO_CHECKPOINT_MS;
    practiceRespawnUntilRef.current = 0;
    const playerStartX = getPlayerStartX(modifications.shadow, regularLevel.speed);
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

  const startTutorial = (mode: Mode) => {
    playSound('start');
    const nextChoice: Choice = { mode, difficulty: 'easy' };
    const nextLevel = buildTutorialLevel(mode);
    clearPausedRun();
    setChoice(nextChoice);
    setSpeedMode('normal');
    setPracticeMode(false);
    setModifications(DEFAULT_MODIFICATIONS);
    setInfiniteMode(false);
    setInfiniteLevel(null);
    setTutorialMode(true);
    setTutorialLevel(nextLevel);
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setGuestInfiniteNoticeOpen(false);
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    resetRunState();
    checkpointsRef.current = [];
    lastCheckpointAtRef.current = 0;
    nextAutoCheckpointAtRef.current = PRACTICE_AUTO_CHECKPOINT_MS;
    practiceRespawnUntilRef.current = 0;
    const playerStartX = getPlayerStartX(false, nextLevel.speed);
    playerRef.current = {
      x: playerStartX,
      y: PLAYER_CENTER_Y,
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
    setMenuAnimationDisabled(false);
    setScreen('playing');
  };

  const startInfiniteRun = async () => {
    if (infiniteLoading) return;
    playSound('start');
    setGuestInfiniteNoticeOpen(false);
    setInfiniteLoading(true);
    const infiniteChoice: Choice = { mode: choice.mode, difficulty: 'hard' };
    const infiniteSpeedMode: SpeedMode = 'normal';
    const firstSegment = await generateInfiniteSegment(infiniteChoice, infiniteSpeedMode, 900);
    const nextLevel = createInfiniteLevel(infiniteChoice, infiniteSpeedMode, firstSegment);
    clearPausedRun();
    setChoice(infiniteChoice);
    setSpeedMode(infiniteSpeedMode);
    setPracticeMode(false);
    setInfiniteLevel(nextLevel);
    setInfiniteMode(true);
    setTutorialMode(false);
    setTutorialLevel(null);
    setModePickerOpen(false);
    setSpeedPickerOpen(false);
    setDifficultyPickerOpen(false);
    setControlsPickerOpen(false);
    setGuestInfiniteNoticeOpen(false);
    attemptRef.current += 1;
    elapsedRef.current = 0;
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    resetRunState();
    checkpointsRef.current = [];
    lastCheckpointAtRef.current = 0;
    nextAutoCheckpointAtRef.current = PRACTICE_AUTO_CHECKPOINT_MS;
    practiceRespawnUntilRef.current = 0;
    infiniteGeneratingRef.current = false;
    const playerStartX = getPlayerStartX(modifications.shadow, nextLevel.speed);
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
    setInfiniteLoading(false);
    setScreen('playing');
  };

  const requestInfiniteRun = () => {
    if (!session && !guestInfiniteNoticeSeen) {
      playSound('click');
      setGuestInfiniteNoticeOpen(true);
      return;
    }
    void startInfiniteRun();
  };

  const acceptGuestInfiniteNotice = () => {
    setGuestInfiniteNoticeSeen(true);
    setGuestInfiniteNoticeOpen(false);
    void startInfiniteRun();
  };

  const openAuthFromGuestInfiniteNotice = (mode: AuthMode) => {
    playSound('click');
    setGuestInfiniteNoticeOpen(false);
    setAuthMode(mode);
    setMenuAnimationDisabled(false);
    setScreen('home');
  };

  const pauseRun = () => {
    playSound('pause');
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    practiceRespawnUntilRef.current = 0;
    deathAnimationRef.current = null;
    winAnimationRef.current = null;
    saveCurrentRun();
    setScreen('paused');
  };

  const resumeRun = () => {
    playSound('resume');
    lastTimeRef.current = 0;
    inputRef.current = false;
    ufoJumpQueuedRef.current = false;
    setScreen('playing');
  };

  const returnToMenu = () => {
    playSound('click');
    const targetScreen: Screen = tutorialMode || lastResult?.tutorialMode ? 'tutorialSelect' : 'menu';
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
    setLeaderboardListOpen(false);
    setMenuAnimationDisabled(false);
    setInfiniteMode(false);
    setInfiniteLevel(null);
    setTutorialMode(false);
    setTutorialLevel(null);
    clearPausedRun();
    setScreen(targetScreen);
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
    setLeaderboardListOpen(false);
    setMenuAnimationDisabled(true);
    setInfiniteMode(false);
    setInfiniteLevel(null);
    setTutorialMode(false);
    setTutorialLevel(null);
    clearPausedRun();
    setScreen('menu');
  };

  const returnToHome = () => {
    playSound('click');
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
    setInfiniteMode(false);
    setInfiniteLevel(null);
    setTutorialMode(false);
    setTutorialLevel(null);
    clearPausedRun();
    setScreen('home');
  };

  const openCustomLevels = () => {
    playSound('start');
    setMenuAnimationDisabled(false);
    setScreen('menu');
  };

  const openTutorialLevels = () => {
    playSound('start');
    setScreen('tutorialSelect');
  };

  const updateColor = (target: keyof ColorSettings, value: string) => {
    playSound('select');
    setColors((current) => {
      const next = { ...current, [target]: value };
      saveColors(next);
      return next;
    });
  };

  const toggleUpsideDown = () => {
    playSound('toggle');
    setModifications((current) => {
      const next = { ...current, upsideDown: !current.upsideDown };
      saveModifications(next);
      return next;
    });
  };

  const toggleSplitMode = () => {
    playSound('toggle');
    setModifications((current) => {
      const next = { ...current, splitMode: !current.splitMode };
      saveModifications(next);
      return next;
    });
  };

  const toggleShadow = () => {
    playSound('toggle');
    setModifications((current) => {
      const next = { ...current, shadow: !current.shadow };
      saveModifications(next);
      return next;
    });
  };

  const toggleHitboxes = () => {
    playSound('toggle');
    setModifications((current) => {
      const next = { ...current, showHitboxes: !current.showHitboxes };
      saveModifications(next);
      return next;
    });
  };

  const toggleAudioSetting = (setting: keyof AudioSettings) => {
    playSound('toggle');
    setAudioSettings((current) => {
      const next = { ...current, [setting]: !current[setting] };
      saveAudioSettings(next);
      return next;
    });
  };

  useEffect(() => {
    if (screen === 'playing' || screen === 'paused' || !audioSettings.menuMusic) {
      stopMenuMusic();
      return;
    }

    startMenuMusic();
  }, [audioSettings.menuMusic, screen, startMenuMusic, stopMenuMusic]);

  useEffect(() => () => stopMenuMusic(), [stopMenuMusic]);

  useEffect(() => {
    if (screen !== 'playing' || !audioSettings.levelMusic) {
      stopSoundtrack();
      return;
    }

    startSoundtrack(choice, speedMode, { infinite: infiniteMode });
    return () => stopSoundtrack();
  }, [audioSettings.levelMusic, choice, infiniteMode, screen, speedMode, startSoundtrack, stopSoundtrack]);

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
      if (practiceRespawnMusicPendingRef.current) {
        syncSoundtrackToElapsed(elapsedRef.current, { fadeIn: false });
        practiceRespawnMusicPendingRef.current = false;
      }
      const lastTime = lastTimeRef.current || time;
      const dt = Math.min((time - lastTime) / 1000, 0.032);
      lastTimeRef.current = time;
      elapsedRef.current += dt * 1000;

      const cameraX = (elapsedRef.current / 1000) * level.speed;
      if (
        level.infinite &&
        typeof level.generatedUntil === 'number' &&
        cameraX + INFINITE_GENERATE_AHEAD > level.generatedUntil &&
        !infiniteGeneratingRef.current
      ) {
        const fromX = level.generatedUntil;
        infiniteGeneratingRef.current = true;
        void generateInfiniteSegment({ mode: choice.mode, difficulty: 'hard' }, speedMode, fromX)
          .then((segment) => {
            setInfiniteLevel((current) => {
              if (!current || !current.infinite || (current.generatedUntil ?? 0) > fromX) return current;
              const keepFrom = Math.max(0, cameraX - 1_200);
              return {
                ...current,
                generatedUntil: fromX + INFINITE_SEGMENT_LENGTH,
                obstacles: [
                  ...current.obstacles.filter((obstacle) => obstacle.x + obstacle.width >= keepFrom),
                  ...segment.obstacles,
                ],
                orbs: [
                  ...current.orbs.filter((orb) => orb.x + orb.radius >= keepFrom),
                  ...(choice.mode === 'ufo' ? segment.orbs : []),
                ],
              };
            });
          })
          .finally(() => {
            infiniteGeneratingRef.current = false;
          });
      }
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
        stopSoundtrack();
        playSound('death');
        deathAnimationRef.current = {
          startedAt: time,
          progress: 0,
          player,
          splitPlayer,
          levelProgress: level.infinite ? elapsedRef.current / 1000 : (elapsedRef.current / level.duration) * 100,
        };
        inputRef.current = false;
        ufoJumpQueuedRef.current = false;
        animationRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!level.infinite && elapsedRef.current >= level.duration) {
        stopSoundtrack();
        playSound('win');
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
  }, [choice, colors, finishRun, level, modifications, playSound, practiceMode, screen, stopSoundtrack]);

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
      if (data.session && !loadPausedRun() && screenRef.current === 'home') {
        void saveAccount(data.session.user);
        setMenuAnimationDisabled(false);
        setScreen('levelSelect');
      } else if (data.session) {
        void saveAccount(data.session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && !loadPausedRun() && _event === 'SIGNED_IN' && screenRef.current === 'home') {
        void saveAccount(nextSession.user);
        setAuthMode(null);
        setMenuAnimationDisabled(false);
        setScreen('levelSelect');
      } else if (nextSession) {
        void saveAccount(nextSession.user);
        setAuthMode(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      void loadAccountNickname(session.user);
    } else {
      setNickname('');
    }
  }, [loadAccountNickname, session]);

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
  }, [choice, modifications, practiceMode, screen, speedMode, tutorialLevel, tutorialMode]);

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
    const timers: number[] = [];
    const interval = window.setInterval(() => {
      setHomePreviewTransitioning(true);
      timers.push(
        window.setTimeout(() => {
          setHomePreview((previous) => createHomePreview(previous));
          timers.push(window.setTimeout(() => setHomePreviewTransitioning(false), 90));
        }, 360),
      );
    }, 5200);
    return () => {
      window.clearInterval(interval);
      timers.forEach((timer) => window.clearTimeout(timer));
      setHomePreviewTransitioning(false);
    };
  }, [lastResult, screen]);

  useEffect(() => {
    attemptRef.current = 0;
  }, [choice, speedMode, modifications.splitMode, practiceMode, tutorialMode]);

  useEffect(() => {
    if (screen !== 'result') return;

    const restartOnEnter = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Enter' && event.code !== 'Space') return;
      event.preventDefault();
      if (lastResult?.tutorialMode && lastResult.mode) {
        startTutorial(lastResult.mode);
      } else {
        startRun();
      }
    };

    window.addEventListener('keydown', restartOnEnter);
    return () => window.removeEventListener('keydown', restartOnEnter);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'paused') return;

    const resumeOnPauseKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Backspace' && event.code !== 'KeyP') return;
      event.preventDefault();
      resumeRun();
    };

    window.addEventListener('keydown', resumeOnPauseKey);
    return () => window.removeEventListener('keydown', resumeOnPauseKey);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;

    const toggleHitboxesOnKey = (event: KeyboardEvent) => {
      if (event.repeat || event.code !== 'KeyH') return;
      event.preventDefault();
      toggleHitboxes();
    };

    window.addEventListener('keydown', toggleHitboxesOnKey);
    return () => window.removeEventListener('keydown', toggleHitboxesOnKey);
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing') return;

    const pauseOnPauseKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code !== 'Backspace' && event.code !== 'KeyP') return;
      event.preventDefault();
      pauseRun();
    };

    window.addEventListener('keydown', pauseOnPauseKey);
    return () => window.removeEventListener('keydown', pauseOnPauseKey);
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
      syncSoundtrackToElapsed(elapsedRef.current);
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
      playSound('teleport');
    };

    window.addEventListener('keydown', teleportToShadow);
    return () => window.removeEventListener('keydown', teleportToShadow);
  }, [screen, modifications.shadow, modifications.splitMode, level.speed, playSound, syncSoundtrackToElapsed]);

  return (
    <main className={`game-shell ${screen}`}>
      {audioSettingsOpen && (
        <div
          className={modalClosing ? 'modal-backdrop audio-settings-backdrop modal-closing' : 'modal-backdrop audio-settings-backdrop'}
          onClick={() => closeModalWithFade(() => setAudioSettingsOpen(false))}
          role="presentation"
        >
          <section
            aria-label="Настройки звука"
            className="mode-modal audio-settings-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Звук</h1>
            </div>

            <div className="audio-settings-list">
              <button
                className={audioSettings.menuMusic ? 'audio-setting active' : 'audio-setting'}
                onClick={() => toggleAudioSetting('menuMusic')}
                type="button"
              >
                <span>Музыка в меню</span>
                <small>{audioSettings.menuMusic ? 'Включено' : 'Выключено'}</small>
              </button>
              <button
                className={audioSettings.levelMusic ? 'audio-setting active' : 'audio-setting'}
                onClick={() => toggleAudioSetting('levelMusic')}
                type="button"
              >
                <span>Музыка в уровнях</span>
                <small>{audioSettings.levelMusic ? 'Включено' : 'Выключено'}</small>
              </button>
              <button
                className={audioSettings.soundEffects ? 'audio-setting active' : 'audio-setting'}
                onClick={() => toggleAudioSetting('soundEffects')}
                type="button"
              >
                <span>Звуковые эффекты</span>
                <small>{audioSettings.soundEffects ? 'Включено' : 'Выключено'}</small>
              </button>
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(() => setAudioSettingsOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'home' && (
        <>
          <section
            className={[
              'home-preview',
              homePreviewTransitioning ? 'home-preview-switching' : '',
              authMode || reviewOpen || adminReviewsOpen ? 'home-panel-blurred' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
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

          <section
            className={authMode || reviewOpen || adminReviewsOpen ? 'home-auth home-panel-blurred' : 'home-auth'}
            aria-label="Главный экран"
          >
            <div>
              <p className="eyebrow home-title">BeatShift</p>
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
              <button className="auth-button" onClick={openReviewModal} type="button">
                Оставить отзыв
              </button>
              {isAdmin && (
                <button className="auth-button" onClick={openAdminReviews} type="button">
                  Админ панель
                </button>
              )}
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

      {screen === 'home' && reviewOpen && (
        <div
          className={modalClosing ? 'modal-backdrop auth-modal-backdrop modal-closing' : 'modal-backdrop auth-modal-backdrop'}
          onClick={() => closeModalWithFade(() => setReviewOpen(false))}
          role="presentation"
        >
          <section className="auth-form review-modal" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Отзыв</h1>
            </div>
            <textarea
              maxLength={REVIEW_LIMIT}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Напиши отзыв"
              value={reviewText}
            />
            <div className="review-meta">
              <span>{reviewText.length}/{REVIEW_LIMIT}</span>
              {reviewMessage && <strong>{reviewMessage}</strong>}
            </div>
            <div className="auth-form-actions">
              <button className="auth-button primary" disabled={reviewBusy} onClick={submitReview} type="button">
                {reviewBusy ? '...' : 'Отправить'}
              </button>
              <button className="auth-button" onClick={() => closeModalWithFade(() => setReviewOpen(false))} type="button">
                Закрыть
              </button>
            </div>

            <div className="review-list">
              <h2>Мои отзывы</h2>
              {!session && <p>Войдите, чтобы видеть и сохранять свои отзывы.</p>}
              {session && ownReviews.length === 0 && <p>Пока нет отзывов.</p>}
              {session &&
                ownReviews.map((review) => (
                  <article className="review-item" key={review.id}>
                    <time>{formatReviewDate(review.created_at)}</time>
                    <p>{review.body}</p>
                  </article>
                ))}
            </div>
          </section>
        </div>
      )}

      {screen === 'home' && isAdmin && adminReviewsOpen && (
        <div
          className={modalClosing ? 'modal-backdrop auth-modal-backdrop modal-closing' : 'modal-backdrop auth-modal-backdrop'}
          onClick={() => closeModalWithFade(() => setAdminReviewsOpen(false))}
          role="presentation"
        >
          <section className="auth-form review-modal admin-reviews-modal" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Отзывы</h1>
            </div>
            <div className="review-list admin-review-list">
              {adminReviewsLoading && <p>Загрузка...</p>}
              {!adminReviewsLoading && adminReviews.length === 0 && <p>Пока нет отзывов.</p>}
              {!adminReviewsLoading &&
                adminReviews.map((review) => (
                  <article className="review-item" key={review.id}>
                    <header>
                      <strong>{review.nickname || review.email || 'Пользователь'}</strong>
                      <time>{formatReviewDate(review.created_at)}</time>
                    </header>
                    <small>{review.email || review.user_id}</small>
                    <p>{review.body}</p>
                  </article>
                ))}
            </div>
            <button className="auth-button" onClick={() => closeModalWithFade(() => setAdminReviewsOpen(false))} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'levelSelect' && (
        <section className="control-panel level-select-panel" aria-label="Выбор типа уровней">
          <div>
            <p className="eyebrow">BeatShift</p>
            <h1>Уровни</h1>
          </div>

          <div className="level-select-actions">
            <button className="level-select-button tutorial-overview" onClick={openTutorialLevels} type="button">
              <span>Туториал</span>
              <small>Лёгкие уровни с подсказками по управлению</small>
            </button>
            <button className="level-select-button active" onClick={openCustomLevels} type="button">
              <span>Кастом</span>
              <small>Выбери режим и параметры уровня под себя</small>
            </button>
          </div>

          <button className="menu-button" onClick={returnToHome} type="button">
            Главный экран
          </button>
        </section>
      )}

      {screen === 'tutorialSelect' && (
        <section className="tutorial-menu-panel" aria-label="Выбор туториала">
          <div className="tutorial-menu-header">
            <p className="eyebrow">BeatShift</p>
            <h1>Туториал</h1>
          </div>

          {MODES.map((mode) => (
            <button className="level-select-button tutorial-button" key={mode.id} onClick={() => startTutorial(mode.id)} type="button">
              <ModeTitle mode={mode.id} title={mode.title} />
            </button>
          ))}

          <div className="tutorial-menu-actions">
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
            <button className="menu-button" onClick={() => setScreen('levelSelect')} type="button">
              Назад
            </button>
          </div>
        </section>
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
              <div className="practice-tool-wrap">
                <button
                  className={checkpointButtonActive ? 'practice-tool active' : 'practice-tool'}
                  onClick={() => {
                    if (addPracticeCheckpoint()) {
                      markCheckpointButtonActive();
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.repeat) event.preventDefault();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Поставить чекпоинт"
                  type="button"
                >
                  <span className="checkpoint-diamond" />
                </button>
                <span className="practice-key">C</span>
              </div>
              <div className="practice-tool-wrap">
                <button
                  className="practice-tool"
                  onClick={removePracticeCheckpoint}
                  onKeyDown={(event) => {
                    if (event.repeat) event.preventDefault();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Удалить последний чекпоинт"
                  type="button"
                >
                  <span className="checkpoint-diamond disabled" />
                </button>
                <span className="practice-key">D</span>
              </div>
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
          <div className="menu-title">
            <p className="eyebrow">BeatShift</p>
          </div>
          <div className="menu-account-row">
            <span>{session ? `${visibleNickname} · ${userEmail}` : 'Гость'}</span>
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
          <button
            aria-label="Настройки звука"
            className={audioSettingsOpen ? 'menu-button audio-settings-button active' : 'menu-button audio-settings-button'}
            onClick={() => {
              setAudioSettingsOpen(true);
              if (audioSettings.menuMusic) {
                startMenuMusic();
              }
            }}
            title="Настройки звука"
            type="button"
          >
            ♪
          </button>
          <div className="menu-back-wrap">
            {session && (
              <label className="menu-nickname-row">
                <span>Никнейм</span>
                <input
                  maxLength={24}
                  onBlur={updateNickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setNicknameMessage('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Твой никнейм"
                  value={nickname}
                />
                {nicknameMessage && <small>{nicknameMessage}</small>}
              </label>
            )}
            <button className="menu-button menu-back-button" onClick={() => setScreen('levelSelect')} type="button">
              Назад
            </button>
          </div>

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
            <small className="mode-summary">
              <ModeModelIcon mode={selectedMode.id} />
              {selectedMode.title}
            </small>
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

          <button
            className="option mode-trigger"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
              setControlsPickerOpen(false);
              setScreen('records');
            }}
            type="button"
          >
            <span>Рекорды</span>
            <small>Обычные уровни</small>
          </button>

          <button
            className="option mode-trigger"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
              setControlsPickerOpen(false);
              setScreen('infiniteRecords');
            }}
            type="button"
          >
            <span>Бесконечные рекорды</span>
            <small>Время в секундах</small>
          </button>

          <button
            aria-label="Лидерборд бесконечного уровня"
            className="menu-button leaderboard-menu-button"
            onClick={() => {
              setModePickerOpen(false);
              setSpeedPickerOpen(false);
              setDifficultyPickerOpen(false);
              setControlsPickerOpen(false);
              setLeaderboardListOpen(false);
              setLeaderboardMode(choice.mode);
              setScreen('leaderboard');
            }}
            title="Лидерборд"
            type="button"
          >
            <span className="podium-icon" aria-hidden="true">
              <span data-place="2" />
              <span data-place="1" />
              <span data-place="3" />
            </span>
          </button>

          <button
            className={practiceMode ? 'menu-button practice-menu-button active' : 'menu-button practice-menu-button'}
            onClick={() => setPracticeMode((current) => !current)}
            type="button"
          >
            Практика: {practiceMode ? 'вкл' : 'выкл'}
          </button>

          </div>

          <button className="start-button" onClick={startRun} type="button">
            Старт
          </button>
          <button className="infinite-button" disabled={infiniteLoading} onClick={requestInfiniteRun} type="button">
            {infiniteLoading ? 'Генерация...' : 'Бесконечный уровень'}
          </button>
          <div className="secondary-action-row">
            <button className="menu-button" onClick={returnToHome} type="button">
              Главный экран
            </button>
          </div>
        </section>
      )}

      {screen === 'menu' && guestInfiniteNoticeOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="control-panel guest-infinite-modal" aria-label="Гостевой режим">
            <p>Войдите, чтобы сохранить ваш результат и попасть в списки лидеров</p>
            <div className="guest-infinite-actions">
              <button className="menu-button" onClick={() => openAuthFromGuestInfiniteNotice('signin')} type="button">
                Войти
              </button>
              <button className="menu-button" onClick={() => openAuthFromGuestInfiniteNotice('signup')} type="button">
                Зарегистрироваться
              </button>
              <button className="menu-button" onClick={acceptGuestInfiniteNotice} type="button">
                Продолжить
              </button>
            </div>
          </section>
        </div>
      )}

      {screen === 'menu' && modePickerOpen && (
        <div
          className={modalClosing ? 'modal-backdrop modal-closing' : 'modal-backdrop'}
          onClick={() => closeModalWithFade(() => setModePickerOpen(false))}
          role="presentation"
        >
          <section className="mode-modal mode-picker-modal" aria-label="Выбор режима" onClick={(event) => event.stopPropagation()}>
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
                  <ModeTitle mode={mode.id} title={mode.title} />
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

      {(screen === 'menu' || screen === 'tutorialSelect') && controlsPickerOpen && (
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
                <strong>Backspace или P</strong>
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
                <span>Хитбоксы</span>
                <strong>H</strong>
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

      {screen === 'infiniteRecords' && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel infinite-records-panel"
            aria-label="Рекорды бесконечного уровня"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Рекорды</h1>
            </div>

            <div className="infinite-records-list">
              {MODES.map((mode) => {
                const seconds = infiniteRecords[infiniteRecordKey(mode.id)] ?? 0;
                return (
                  <div className={choice.mode === mode.id ? 'infinite-record-row active' : 'infinite-record-row'} key={mode.id}>
                    <span>{mode.title}</span>
                    <strong>{seconds > 0 ? `${seconds} с` : '0 с'}</strong>
                  </div>
                );
              })}
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(closeMenuWindow)} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'leaderboard' && !leaderboardListOpen && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel leaderboard-panel"
            aria-label="Лидерборд бесконечного уровня"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Лидерборд</h1>
            </div>

            <div className="leaderboard-mode-grid" aria-label="Выбор режима лидерборда">
              {MODES.map((mode) => (
                <button
                  className={leaderboardMode === mode.id ? 'leaderboard-mode active' : 'leaderboard-mode'}
                  key={mode.id}
                  onClick={() => {
                    setLeaderboardListOpen(true);
                    void loadLeaderboard(mode.id);
                  }}
                  type="button"
                >
                  <ModeTitle mode={mode.id} title={mode.title} />
                </button>
              ))}
            </div>

            <button className="menu-button" onClick={() => closeModalWithFade(closeMenuWindow)} type="button">
              Закрыть
            </button>
          </section>
        </div>
      )}

      {screen === 'leaderboard' && leaderboardListOpen && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel leaderboard-panel leaderboard-list-panel"
            aria-label="Список лидерборда бесконечного уровня"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="leaderboard-list">
              <h2>{MODES.find((mode) => mode.id === leaderboardMode)?.title ?? 'Режим'}</h2>
              {leaderboardLoading && <p className="leaderboard-empty">Загрузка...</p>}
              {!leaderboardLoading && leaderboardMessage && <p className="leaderboard-empty">{leaderboardMessage}</p>}
              {!leaderboardLoading && !leaderboardMessage && leaderboardEntries.length === 0 && (
                <p className="leaderboard-empty">Пока нет результатов.</p>
              )}
              {!leaderboardLoading &&
                !leaderboardMessage &&
                leaderboardEntries.map((entry, index) => (
                  <div className="leaderboard-row" key={entry.id}>
                    <span>
                      {index + 1}. {entry.nickname}
                    </span>
                    <strong>{formatDuration(entry.seconds)}</strong>
                  </div>
                ))}
            </div>

            <div className="leaderboard-actions">
              <button className="menu-button" onClick={() => setLeaderboardListOpen(false)} type="button">
                Режимы
              </button>
              <button className="menu-button" onClick={() => closeModalWithFade(closeMenuWindow)} type="button">
                Закрыть
              </button>
            </div>
          </section>
        </div>
      )}

      {screen === 'records' && (
        <div
          className={
            modalClosing ? 'modal-backdrop menu-screen-backdrop modal-closing' : 'modal-backdrop menu-screen-backdrop'
          }
          onClick={() => closeModalWithFade(closeMenuWindow)}
          role="presentation"
        >
          <section
            className="control-panel records-panel"
            aria-label="Рекорды обычных уровней"
            onClick={(event) => event.stopPropagation()}
          >
            <div>
              <p className="eyebrow">BeatShift</p>
              <h1>Рекорды</h1>
            </div>

            <div className="records-table">
              {DIFFICULTIES.map((difficulty) => (
                <section className="records-row" key={difficulty.id}>
                  <div className="records-difficulty">
                    <span>{difficulty.title}</span>
                  </div>
                  <div className="records-mode-grid">
                    {MODES.map((mode) => {
                      const percent = records[recordKey({ mode: mode.id, difficulty: difficulty.id })] ?? 0;
                      const isCurrent = choice.mode === mode.id && choice.difficulty === difficulty.id;
                      return (
                        <div className={isCurrent ? 'records-mode-cell active' : 'records-mode-cell'} key={mode.id}>
                          <span>{mode.title}</span>
                          <strong>{percent}%</strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
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
            <span>{lastResult.infinite ? 'Время' : 'Результат'}</span>
            <strong>{lastResult.infinite ? `${lastResult.progress} с` : `${lastResult.progress}%`}</strong>
          </div>

          <div className="score-row">
            <span>Рекорд</span>
            <strong>{lastResult.infinite ? `${infiniteBest} с` : `${best}%`}</strong>
          </div>

          <div className="score-row">
            <span>Попытки</span>
            <strong>{lastResult.attempts}</strong>
          </div>

          <div className="result-actions">
            <button
              className="start-button"
              onClick={lastResult.infinite ? startInfiniteRun : lastResult.tutorialMode && lastResult.mode ? () => startTutorial(lastResult.mode!) : startRun}
              type="button"
            >
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
