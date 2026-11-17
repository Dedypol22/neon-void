// Boot and the main loop: input is read every frame, the world advances in fixed 1/60s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// The main loop handles:
// 1. Input reading (keyboard and mouse)
// 2. Fixed timestep game logic
// 3. Screen state management
// 4. Audio synthesis
// 5. Screen drawing
// 6. Accessibility announcements

import { STEP, BEST_KEY, PLAYER } from './config.js';
import { ACTION_SHOOT, ACTION_PAUSE, ACTION_MUTE, createInput } from './input.js';
import { SCREEN_PLAY, SCREEN_PAUSED, SCREEN_TITLE, SCREEN_OVER, SCREEN_VICTORY, createRenderer } from './render.js';
import { createWorld, EVENT_HIT, EVENT_GAME_OVER, EVENT_VICTORY as EVENT_VICTORY_WORLD } from './world.js';
import { AudioSystem } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);

const audio = new AudioSystem();
const canvas = document.getElementById('game');
const status = document.getElementById('status');

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  const world = createWorld(() => Math.random() * 4294967296);

  world.spawnPlayer();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.spawnPlayer();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${PLAYER.hp} HP.`);
    audio.scheduleSound('wave', Date.now() / 1000);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}. Wave ${world.state.wave} reached.`);
    audio.scheduleSound('hit', Date.now() / 1000);
  }

  function victory() {
    screen = SCREEN_VICTORY;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Victory! Score ${world.state.score}. Best ${best}. Wave ${world.state.wave} completed.`);
    audio.scheduleSound('powerup', Date.now() / 1000);
  }

  function pauseGame() {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  }

  function resumeGame() {
    if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleInput(dt) {
    const actions = input.takeActions();

    if (actions & ACTION_MUTE) {
      audio.muted = audio.toggleMute();
      announce(audio.muted ? 'Muted' : 'Unmuted');
    }

    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      pauseGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      resumeGame();
    } else if (actions & ACTION_SHOOT && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
    } else if (actions & ACTION_SHOOT && screen === SCREEN_VICTORY) {
      startGame();
    }

    if (screen === SCREEN_PLAY) {
      const direction = input.direction();
      const player = world.state.player;
      if (player) {
        player.vx = direction.x * PLAYER.speed;
        player.vy = direction.y * PLAYER.speed;
        player.rotation = Math.atan2(direction.y, direction.x);
      }

      const mousePos = input.mousePosition;
      if (player && mousePos) {
        player.rotation = Math.atan2(mousePos.y - player.y, mousePos.x - player.x);
      }

      if (input.isMouseDown()) {
        const player = world.state.player;
        if (player && world.state.canShoot) {
          world.spawnBullet(
            player.x + Math.cos(player.rotation) * 30,
            player.y + Math.sin(player.rotation) * 30,
            Math.cos(player.rotation) * world.state.bulletSpeed,
            Math.sin(player.rotation) * world.state.bulletSpeed,
            player.rotation,
            '#fff'
          );
          audio.scheduleSound('shoot', Date.now() / 1000);
          world.state.canShoot = false;
        }
      }

      const now = Date.now() / 1000;
      if (input.canShoot() && now - world.state.lastShotTime >= PLAYER.shootCooldown) {
        input.shoot();
        audio.scheduleSound('shoot', now);
        world.state.lastShotTime = now;
      }
    }

    if (actions & ACTION_SHOOT && screen === SCREEN_VICTORY) {
      startGame();
    }
  }

  function step(dt) {
    const player = world.state.player;
    if (!player) return 0;

    const events = world.step(dt, input, player);

    if (events & EVENT_HIT) {
      audio.scheduleSound('damage', Date.now() / 1000);
    }

    if (events & EVENT_GAME_OVER) {
      endGame();
      return 0;
    }

    if (events & EVENT_VICTORY_WORLD) {
      victory();
      return 0;
    }

    return events;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    handleInput(STEP);
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }

    renderer.draw(world.state, screen, best);

    window.requestAnimationFrame(() => {
      audio.rhythm();
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      pauseGame();
    }
  });

  announce('NEON VOID. Move with WASD/arrows, aim with mouse, shoot with space or click.');
  requestAnimationFrame(frame);
}

const renderer = createRenderer(canvas);

if (params.get('shot')) {
  console.log('Screenshot mode not implemented in this version');
} else {
  runGame();
}