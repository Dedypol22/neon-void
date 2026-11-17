// Every tuning number and colour in one place. The playfield is a fixed 1280x800 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 800 };
export const BEST_KEY = 'neon-void-best-score';

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 60,
  height: 60,
  speed: 400,
  rotationSpeed: 0.08,
  inertiaDamping: 0.92,
  radius: 30,
  hp: 5,
  shootCooldown: 0.3,
};

export const BULLET = {
  width: 8,
  height: 8,
  speed: 600,
  lifetime: 2.0,
  spawnTime: 0.05,
  rapidTime: 8.0,
};

export const ENEMY = {
  chaser: { width: 32, height: 32, speed: 200, hp: 1, score: 100 },
  wanderer: { width: 28, height: 28, speed: 120, hp: 2, score: 75 },
  splitter: { width: 40, height: 40, speed: 150, hp: 3, score: 150 },
  shooter: { width: 36, height: 36, speed: 180, hp: 2, orbSpeed: 250, fireRate: 1.5, score: 200 },
};

export const PARTICLE = {
  lifetime: 1.0,
  explosion: 0.5,
  score: 1.5,
  spawnInterval: 0.02,
  hitSize: 4,
  explosionSize: 8,
};

export const POWERUP = {
  width: 20,
  height: 20,
  rapidTime: 8.0,
  shieldDuration: 10.0,
  bombRadius: 300,
  bombEffectDuration: 1.0,
  spawnInterval: 15.0,
  chance: 0.15,
};

export const HUD = {
  font: '12px monospace',
  scoreColor: '#0ff',
  waveColor: '#f0f',
  hpColor: '#f00',
  comboColor: '#ff0',
  rapidColor: '#0f0',
  shieldColor: '#0ff',
  bombColor: '#f00',
};

export const COLORS = {
  backdrop: { r: 5, g: 5, b: 15 },
 star1: '#fff',
 star2: '#ccf',
 star3: '#f0f',
 nebula1: { r: 30, g: 0, b: 60 },
 nebula2: { r: 0, g: 30, b: 60 },
 player: '#0ff',
 bullet: '#fff',
 chaser: '#f0f',
 wanderer: '#f80',
 splitter: '#0f0',
 shooter: '#0ff',
 powerupRapid: '#0f0',
 powerupShield: '#0ff',
 powerupBomb: '#f00',
 hitFlash: '#fff',
 explosion: '#f0f',
 text: '#fff',
 ui: '#888',
};