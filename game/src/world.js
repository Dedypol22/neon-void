// Game world and rules: player, bullets, enemies, particles, power-ups, spawning, collisions, scoring, waves.
// Advances the simulation with the fixed step. Returns events as bit flags for the main loop to react.
// Uses a pool pattern for efficiency. All logic here, no browser knowledge.

import { FIELD, PLAYER, BULLET, ENEMY, PARTICLE, POWERUP, STEP, COLORS } from './config.js';
import { ENTITY_TYPES } from './entities.js';

export const EVENT_HIT = 1;
export const EVENT_SCORE = 2;
export const EVENT_POWERUP = 4;
export const EVENT_BOMB = 8;
export const EVENT_GAME_OVER = 16;
export const EVENT_VICTORY = 32;

export function createWorld(random) {
  const entities = {
    player: null,
    bullets: [],
    enemies: [],
    particles: [],
    powerups: [],
  };

  const state = {
    score: 0,
    wave: 1,
    combo: 0,
    highCombo: 0,
    playerHp: PLAYER.hp,
    rapidActive: 0,
    shieldActive: false,
    bombActive: false,
    invincible: 0,
    screenShake: 0,
    enemiesSpawned: 0,
    maxEnemies: 8,
    spawnTimer: 0,
    spawnInterval: 2.0,
    levelTimer: 0,
    canShoot: true,
    lastShotTime: 0,
    bulletSpeed: BULLET.speed,
    enemySpeed: ENEMY.chaser.speed,
    lastHitTime: 0,
  };

  Object.defineProperties(state, {
    player: { get: () => entities.player },
    bullets: { get: () => entities.bullets },
    enemies: { get: () => entities.enemies },
    particles: { get: () => entities.particles },
    powerups: { get: () => entities.powerups },
    playerRotation: { get: () => (entities.player ? entities.player.rotation : 0) },
    damageFlash: { get: () => 0 },
  });

  function reset() {
    entities.player = null;
    entities.bullets = [];
    entities.enemies = [];
    entities.particles = [];
    entities.powerups = [];
    Object.assign(state, {
      score: 0,
      wave: 1,
      combo: 0,
      highCombo: 0,
      playerHp: PLAYER.hp,
      rapidActive: 0,
      shieldActive: false,
      bombActive: false,
      invincible: 0,
      screenShake: 0,
      enemiesSpawned: 0,
      maxEnemies: 8,
      spawnTimer: 0,
      spawnInterval: 2.0,
      levelTimer: 0,
      canShoot: true,
      lastShotTime: 0,
      bulletSpeed: BULLET.speed,
      enemySpeed: ENEMY.chaser.speed,
      lastHitTime: 0,
    });
  }

  function spawnPlayer() {
    entities.player = { type: ENTITY_TYPES.PLAYER, x: FIELD.width / 2, y: FIELD.height / 2, rotation: 0, width: PLAYER.width, height: PLAYER.height };
  }

  function spawnBullet(x, y, vx, vy, rotation, color) {
    entities.bullets.push({ type: ENTITY_TYPES.BULLET, x, y, vx, vy, rotation, color, lifetime: BULLET.lifetime, spawnTime: Date.now() / 1000, width: BULLET.width, height: BULLET.height });
  }

  function spawnParticle(x, y, type, size, color) {
    entities.particles.push({ type: ENTITY_TYPES.PARTICLE, x, y, size, color, lifetime: PARTICLE.lifetime, spawnTime: Date.now() / 1000 });
  }

  function spawnPowerup(x, y, type) {
    const color = type === 'rapid' ? '#0f0' : type === 'shield' ? '#0ff' : '#f00';
    entities.powerups.push({ type: ENTITY_TYPES.POWERUP, x, y, type, color, duration: POWERUP[type].duration, width: POWERUP.width, height: POWERUP.height });
  }

  function spawnEnemy(type, x, y) {
    const config = ENEMY[type];
    const color = type === 'chaser' ? '#f0f' : type === 'wanderer' ? '#f80' : type === 'splitter' ? '#0f0' : '#0ff';
    const enemy = { type: type === 'chaser' ? ENTITY_TYPES.ENEMY_CHASER : type === 'wanderer' ? ENTITY_TYPES.ENEMY_WANDERER : type === 'splitter' ? ENTITY_TYPES.ENEMY_SPLITTER : ENTITY_TYPES.ENEMY_SHOTER, x, y, vx: 0, vy: 0, rotation: 0, hp: config.hp, maxHp: config.hp, color, width: config.width, height: config.height };
    if (type === 'wanderer' || type === 'splitter') enemy.wanderTimer = Math.random() * Math.PI * 2;
    entities.enemies.push(enemy);
    state.enemiesSpawned++;
  }

  function updateBullets(dt, now) {
    for (let i = entities.bullets.length - 1; i >= 0; i--) {
      const bullet = entities.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (now / 1000 - bullet.spawnTime > bullet.lifetime) {
        entities.bullets.splice(i, 1);
        spawnParticle(bullet.x, bullet.y, 'explosion', PARTICLE.explosionSize, COLORS.explosion);
      }
    }
  }

  function updateEnemies(dt, playerPos, now) {
    for (let i = entities.enemies.length - 1; i >= 0; i--) {
      const enemy = entities.enemies[i];
      const chasers = entities.enemies.filter(e => e.type === 'chaser');

      if (enemy.type === 'chaser') {
        const dx = playerPos.x - enemy.x;
        const dy = playerPos.y - enemy.y;
        const angle = Math.atan2(dy, dx);
        enemy.vx = Math.cos(angle) * ENEMY.chaser.speed * (1 + (state.wave - 1) * 0.2);
        enemy.vy = Math.sin(angle) * ENEMY.chaser.speed * (1 + (state.wave - 1) * 0.2);
        enemy.rotation = angle;
      }

      if (enemy.type === 'wanderer') {
        const wanderAngle = enemy.wanderTimer + Math.sin(now / 1000) * Math.PI;
        enemy.vx = Math.cos(wanderAngle) * ENEMY.wanderer.speed * (1 + (state.wave - 1) * 0.1);
        enemy.vy = Math.sin(wanderAngle) * ENEMY.wanderer.speed * (1 + (state.wave - 1) * 0.1);
        enemy.wanderTimer += dt;
      }

      if (enemy.type === 'splitter') {
        const dx = playerPos.x - enemy.x;
        const dy = playerPos.y - enemy.y;
        const angle = Math.atan2(dy, dx);
        enemy.vx = Math.cos(angle) * ENEMY.splitter.speed * (1 + (state.wave - 1) * 0.15);
        enemy.vy = Math.sin(angle) * ENEMY.splitter.speed * (1 + (state.wave - 1) * 0.15);
      }

      if (enemy.type === 'shooter') {
        const dx = playerPos.x - enemy.x;
        const dy = playerPos.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        if (distance > 50) {
          enemy.vx += Math.cos(angle) * 50 * dt;
          enemy.vy += Math.sin(angle) * 50 * dt;
        }
        enemy.vx *= 0.98;
        enemy.vy *= 0.98;
        enemy.rotation = angle;
        if (now / 1000 - state.lastShotTime > ENEMY.shooter.fireRate * (state.rapidActive > 0 ? 0.5 : 1)) {
          entities.bullets.push({ type: 'orb', x: enemy.x, y: enemy.y, vx: Math.cos(enemy.rotation) * ENEMY.shooter.orbSpeed, vy: Math.sin(enemy.rotation) * ENEMY.shooter.orbSpeed, rotation: enemy.rotation, color: COLORS.shooter, lifetime: BULLET.lifetime, spawnTime: Date.now() / 1000, width: BULLET.width, height: BULLET.height });
          return;
        }
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
    }
  }

  function updatePowerups(dt, now) {
    for (let i = entities.powerups.length - 1; i >= 0; i--) {
      const powerup = entities.powerups[i];
      powerup.y += 50 * dt;
      if (powerup.y > FIELD.height) {
        entities.powerups.splice(i, 1);
      }
    }
  }

  function checkCollisions(playerPos, now) {
    let events = 0;

    // Player bullets damage enemies.
    for (let i = entities.bullets.length - 1; i >= 0; i--) {
      const bullet = entities.bullets[i];
      if (bullet.type !== ENTITY_TYPES.BULLET) continue;
      for (let j = entities.enemies.length - 1; j >= 0; j--) {
        const enemy = entities.enemies[j];
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        if (Math.sqrt(dx * dx + dy * dy) < enemy.width / 2 + 6) {
          entities.bullets.splice(i, 1);
          enemy.hp--;
          spawnParticle(bullet.x, bullet.y, 'hit', PARTICLE.hitSize, COLORS.hitFlash);
          if (enemy.hp <= 0) {
            entities.enemies.splice(j, 1);
            state.score += ENEMY[enemy.type].score;
            state.combo++;
            if (state.combo > state.highCombo) state.highCombo = state.combo;
            spawnParticle(enemy.x, enemy.y, 'explosion', PARTICLE.explosionSize, COLORS.explosion);
            if (Math.random() < POWERUP.chance) {
              const kinds = ['rapid', 'shield', 'bomb'];
              spawnPowerup(enemy.x, enemy.y, kinds[Math.floor(Math.random() * kinds.length)]);
            }
          }
          break;
        }
      }
    }

    // Enemy orbs threaten the player.
    for (let i = entities.bullets.length - 1; i >= 0; i--) {
      const bullet = entities.bullets[i];
      if (bullet.type !== 'orb') continue;
      const dx = playerPos.x - bullet.x;
      const dy = playerPos.y - bullet.y;
      if (Math.sqrt(dx * dx + dy * dy) < 20) {
        events |= EVENT_HIT;
        spawnParticle(bullet.x, bullet.y, 'hit', PARTICLE.hitSize, COLORS.hitFlash);
        entities.bullets.splice(i, 1);
        spawnParticle(bullet.x, bullet.y, 'explosion', PARTICLE.explosionSize, COLORS.explosion);
      }
    }

    // Enemy contact: the enemy is destroyed; the player takes at most one hit per invincibility window (damage itself is applied by processEvents).
    for (let i = entities.enemies.length - 1; i >= 0; i--) {
      const enemy = entities.enemies[i];
      const dx = playerPos.x - enemy.x;
      const dy = playerPos.y - enemy.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        entities.enemies.splice(i, 1);
        spawnParticle(enemy.x, enemy.y, 'explosion', PARTICLE.explosionSize, COLORS.explosion);
        if (state.invincible <= 0) {
          events |= EVENT_HIT;
          state.invincible = 1.0;
          state.screenShake = 0.5;
        }
      }
    }

    // Power-ups are applied on pickup.
    for (let i = entities.powerups.length - 1; i >= 0; i--) {
      const powerup = entities.powerups[i];
      const dx = playerPos.x - powerup.x;
      const dy = playerPos.y - powerup.y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        entities.powerups.splice(i, 1);
        applyPowerup(powerup.type);
      }
    }

    return events;
  }

  function spawnWave() {
    const enemyTypes = ['chaser', 'wanderer', 'splitter', 'shooter'];
    const count = Math.min(state.maxEnemies, 3 + state.wave);
    for (let i = 0; i < count; i++) {
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      const angle = (Math.PI * 2 / count) * i;
      const radius = FIELD.width / 2 + 100;
      const x = FIELD.width / 2 + Math.cos(angle) * radius;
      const y = FIELD.height / 2 + Math.sin(angle) * radius;
      spawnEnemy(type, x, y);
    }
    state.enemiesSpawned = entities.enemies.length;
    state.spawnTimer = state.spawnInterval;
    state.levelTimer = 5.0;
    return 'wave';
  }

  function applyPowerup(type) {
    switch (type) {
      case 'rapid':
        state.rapidActive = POWERUP.rapidTime;
        state.bulletSpeed = BULLET.speed * 0.5;
        break;
      case 'shield':
        state.shieldActive = true;
        state.invincible = POWERUP.shieldDuration;
        break;
      case 'bomb':
        entities.enemies = [];
        state.bombActive = true;
        state.screenShake = 1.0;
        break;
    }
  }

  function updatePowerupEffects(dt, now) {
    if (state.rapidActive > 0) state.rapidActive -= dt;
    if (state.invincible > 0) state.invincible -= dt;
    if (state.bombActive && state.screenShake > 0) state.screenShake -= dt;

    if (state.rapidActive <= 0) state.bulletSpeed = BULLET.speed;
  }

  function processEvents(events) {
    if (events & EVENT_HIT) {
      if (state.shieldActive) {
        state.shieldActive = false;
        spawnParticle(entities.player.x, entities.player.y, 'hit', PARTICLE.hitSize, COLORS.hitFlash);
      } else {
        state.playerHp--;
        if (state.playerHp <= 0) return EVENT_GAME_OVER;
      }
      state.combo = 0;
      state.screenShake = 0.3;
    }

    if (events & EVENT_POWERUP) {
      return 'powerup';
    }

    if (events & EVENT_BOMB) {
      state.combo = 0;
      state.screenShake = 1.0;
    }

    return null;
  }

  function step(dt, input, playerPos) {
    let events = 0;

    if (state.wave === 10) return EVENT_VICTORY;

    state.levelTimer -= dt;
    if (state.levelTimer <= 0) {
      if (entities.enemies.length === 0) {
        events |= spawnWave();
      }
    }

    if (input.isMouseDown() && (Date.now() / 1000 - state.lastShotTime > BULLET.spawnTime * (state.rapidActive > 0 ? 0.5 : 1))) {
      const shootX = playerPos.x + Math.cos(playerPos.rotation) * 30;
      const shootY = playerPos.y + Math.sin(playerPos.rotation) * 30;
      spawnBullet(shootX, shootY, Math.cos(playerPos.rotation) * state.bulletSpeed, Math.sin(playerPos.rotation) * state.bulletSpeed, playerPos.rotation, COLORS.bullet);
      events |= EVENT_SCORE;
      state.lastShotTime = Date.now() / 1000;
    }

    if (input.takeActions() & 1) {
      if (input.canShoot()) {
        input.shoot();
      }
    }

    updateBullets(dt, Date.now());

    updateEnemies(dt, playerPos, Date.now());

    updatePowerups(dt, Date.now());

    const collisionEvents = checkCollisions(playerPos, Date.now());
    if (collisionEvents & EVENT_HIT) {
      const result = processEvents(collisionEvents);
      if (result) events |= result;
    } else if (collisionEvents & EVENT_POWERUP) {
      const powerup = entities.powerups.find(p => p.type === ENTITY_TYPES.POWERUP);
      if (powerup) {
        applyPowerup(powerup.type);
        events |= EVENT_POWERUP;
      }
    }

    updatePowerupEffects(dt, Date.now());

    if (entities.enemies.length === 0 && state.enemiesSpawned === 0) {
      if (state.wave === 10) {
        return EVENT_VICTORY;
      } else {
        events |= spawnWave();
      }
    }

    return events;
  }

  return {
    state,
    reset: reset,
    step: step,
    spawnPlayer: spawnPlayer,
    spawnBullet: spawnBullet,
    spawnParticle: spawnParticle,
    spawnPowerup: spawnPowerup,
    spawnEnemy: spawnEnemy,
    applyPowerup: applyPowerup,
  };
}