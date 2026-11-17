// Entity definitions: player ship, bullets, enemies, particles and power-ups.
// All entities share the same structure: position, velocity, dimensions, lifespan, etc.
// Uses types to distinguish entity kinds for collision and rendering.

import { FIELD, PLAYER, BULLET, ENEMY, PARTICLE, POWERUP, COLORS } from './config.js';

export const ENTITY_TYPES = {
  PLAYER: 'player',
  BULLET: 'bullet',
  ENEMY_CHASER: 'chaser',
  ENEMY_WANDERER: 'wanderer',
  ENEMY_SPLITTER: 'splitter',
  ENEMY_SHOTER: 'shooter',
  PARTICLE: 'particle',
  POWERUP: 'powerup',
};

export class EntityPool {
  constructor(config) {
    this.config = config;
    this.entities = [];
    this.activeIndices = [];
  }

  create(type, x, y, vx = 0, vy = 0, rotation = 0, color = null, extra = {}) {
    const entity = {
      type,
      x,
      y,
      vx,
      vy,
      rotation,
      rotationSpeed: 0,
      width: this.config[type] ? this.config[type].width : 0,
      height: this.config[type] ? this.config[type].height : 0,
      active: true,
      lifespan: this.config[type] ? this.config[type].lifetime || 0 : 0,
      spawnTime: Date.now() / 1000,
      ...extra,
    };

    if (color) entity.color = color;
    this.entities.push(entity);
    this.activeIndices.push(this.entities.length - 1);
    return entity;
  }

  get(index) {
    return this.entities[index];
  }

  update(dt, now) {
    for (let i = this.activeIndices.length - 1; i >= 0; i--) {
      const index = this.activeIndices[i];
      const entity = this.entities[index];
      if (!entity.active) {
        this.activeIndices.splice(i, 1);
        continue;
      }

      entity.x += entity.vx * dt;
      entity.y += entity.vy * dt;
      entity.rotation += (entity.rotationSpeed || 0) * dt;

      if (entity.lifespan > 0) {
        const age = (now - entity.spawnTime) / 1000;
        if (age > entity.lifespan) entity.active = false;
      }
    }
  }

  remove(index) {
    const entity = this.entities[index];
    if (!entity.active) return false;
    entity.active = false;
    const activeIndex = this.activeIndices.indexOf(index);
    if (activeIndex !== -1) {
      this.activeIndices.splice(activeIndex, 1);
    }
    return true;
  }

  getActive() {
    const result = [];
    for (const index of this.activeIndices) {
      result.push(this.entities[index]);
    }
    return result;
  }

  clear() {
    this.entities = [];
    this.activeIndices = [];
  }
}

export class Player {
  constructor(entityPool) {
    this.entityPool = entityPool;
    this.radius = PLAYER.radius;
    this.maxSpeed = PLAYER.speed;
    this.currentSpeed = 0;
    this.targetRotation = 0;
    this.hp = PLAYER.hp;
    this.shootCooldown = PLAYER.shootCooldown;
    this.lastShootTime = 0;
    this.invulnerable = 0;
    this.damageFlash = 0;
  }

  create() {
    return this.entityPool.create(
      ENTITY_TYPES.PLAYER,
      FIELD.width / 2,
      FIELD.height / 2,
      0,
      0,
      0,
      COLORS.player,
      { hp: this.hp }
    );
  }

  update(dt, input, now) {
    const dir = input.direction();
    const targetSpeed = Math.sqrt(dir.x * dir.x + dir.y * dir.y) * this.maxSpeed;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * PLAYER.inertiaDamping * 10 * dt;

    const speed = Math.sqrt(this.currentSpeed * this.currentSpeed);
    let rotation = 0;
    if (speed > 0.01) {
      rotation = Math.atan2(dir.y, dir.x);
    }

    this.targetRotation = rotation;
    const player = this.entityPool.get(0);
    if (player) {
      player.rotation = this.interpolateRotation(player.rotation, rotation, PLAYER.rotationSpeed * dt);
      player.vx = Math.cos(player.rotation) * this.currentSpeed;
      player.vy = Math.sin(player.rotation) * this.currentSpeed;
    }

    this.invulnerable -= dt;
    this.damageFlash -= dt;
  }

  interpolateRotation(from, to, speed) {
    let diff = to - from;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return from + Math.sign(diff) * Math.min(Math.abs(diff), speed);
  }

  aimAt(x, y) {
    const player = this.entityPool.get(0);
    if (player) {
      const dx = x - player.x;
      const dy = y - player.y;
      this.targetRotation = Math.atan2(dy, dx);
    }
  }

  canShoot() {
    const now = Date.now() / 1000;
    return now - this.lastShootTime >= this.shootCooldown;
  }

  shoot(input) {
    const now = Date.now() / 1000;
    if (!this.canShoot()) return null;

    this.lastShootTime = now;
    const player = this.entityPool.get(0);
    if (!player) return null;

    const bulletX = player.x + Math.cos(player.rotation) * player.width / 2;
    const bulletY = player.y + Math.sin(player.rotation) * player.width / 2;
    const bullet = this.entityPool.create(
      ENTITY_TYPES.BULLET,
      bulletX,
      bulletY,
      Math.cos(player.rotation) * BULLET.speed,
      Math.sin(player.rotation) * BULLET.speed,
      player.rotation,
      COLORS.bullet,
      { lifetime: BULLET.lifetime }
    );
    return bullet;
  }

  damage() {
    if (this.invulnerable > 0) return false;
    this.hp--;
    this.invulnerable = PLAYER.invulnerable;
    this.damageFlash = 0.5;
    return true;
  }

  heal(damage) {
    this.hp = Math.min(this.hp + damage, PLAYER.hp);
  }

  isDead() {
    return this.hp <= 0;
  }
}

export class Enemy {
  constructor(entityPool, type) {
    this.entityPool = entityPool;
    this.type = type;
    this.config = ENEMY[type];
    this.factionTimer = 0;
    this.sineOffset = Math.random() * Math.PI * 2;
  }

  create(x, y) {
    const color = type === 'chaser' ? COLORS.chaser :
                  type === 'wanderer' ? COLORS.wanderer :
                  type === 'splitter' ? COLORS.splitter :
                  COLORS.shooter;

    const entity = this.entityPool.create(
      type === 'chaser' ? ENTITY_TYPES.ENEMY_CHASER :
      type === 'wanderer' ? ENTITY_TYPES.ENEMY_WANDERER :
      type === 'splitter' ? ENTITY_TYPES.ENEMY_SPLITTER :
      ENTITY_TYPES.ENEMY_SHOTER,
      x,
      y,
      0,
      0,
      0,
      color,
      { hp: this.config.hp, maxHp: this.config.hp }
    );

    if (type === 'wanderer' || type === 'splitter') {
      entity.wanderTimer = Math.random() * Math.PI * 2;
    }

    return entity;
  }

  update(dt, playerPos, chasers) {
    const entity = this.entityPool.get(0);
    if (!entity || !entity.active) return;

    const dx = playerPos.x - entity.x;
    const dy = playerPos.y - entity.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      entity.rotationSpeed = 0.05;
      if (this.type === 'chaser') {
        const angle = Math.atan2(dy, dx);
        entity.vx = Math.cos(angle) * this.config.speed;
        entity.vy = Math.sin(angle) * this.config.speed;
      } else if (this.type === 'wanderer') {
        const wanderAngle = this.sineOffset + Math.sin(Date.now() / 1000 + this.sineOffset) * Math.PI * 0.5;
        const wanderSpeed = this.config.speed * (0.5 + Math.sin(Date.now() / 500) * 0.5);
        entity.vx = Math.cos(wanderAngle) * wanderSpeed;
        entity.vy = Math.sin(wanderAngle) * wanderSpeed;
      } else if (this.type === 'splitter') {
        const angle = (playerPos.x - entity.x) / (playerPos.y - entity.y + 0.001);
        entity.vx = Math.cos(angle) * this.config.speed;
        entity.vy = Math.sin(angle) * this.config.speed;
      } else if (this.type === 'shooter') {
        const pursuitFactor = 0.02;
        const angle = Math.atan2(dy, dx);
        entity.vx = entity.vx * (1 - pursuitFactor) + Math.cos(angle) * this.config.speed * pursuitFactor;
        entity.vy = entity.vy * (1 - pursuitFactor) + Math.sin(angle) * this.config.speed * pursuitFactor;

        this.factionTimer += dt;
        if (this.factionTimer > this.config.fireRate) {
          return 'fire';
        }
      }
    }

    if (this.type === 'shooter' && distance > 100 && distance < 300) {
      return 'fire';
    }

    return null;
  }

  takeDamage() {
    const entity = this.entityPool.get(0);
    if (!entity || !entity.active) return false;

    entity.hp--;
    if (entity.hp <= 0) {
      return 'kill';
    }
    return true;
  }

  spawnSplit() {
    const entity = this.entityPool.get(0);
    if (!entity || !entity.active) return [];

    const splitEntities = [];
    for (let i = 0; i < 2; i++) {
      const angle = (Math.PI * 2 / 2) * i;
      const splitEntity = this.entityPool.create(
        ENTITY_TYPES.ENEMY_CHASER,
        entity.x,
        entity.y,
        Math.cos(angle) * 150,
        Math.sin(angle) * 150,
        0,
        COLORS.chaser,
        { hp: ENEMY.chaser.hp, maxHp: ENEMY.chaser.hp }
      );
      splitEntities.push(splitEntity);
    }
    return splitEntities;
  }

  fire(playerPos) {
    const entity = this.entityPool.get(0);
    if (!entity || !entity.active) return null;

    const bulletX = entity.x;
    const bulletY = entity.y;
    const dx = playerPos.x - bulletX;
    const dy = playerPos.y - bulletY;
    const angle = Math.atan2(dy, dx);

    const bullet = this.entityPool.create(
      'orb',
      bulletX,
      bulletY,
      Math.cos(angle) * ENEMY.shooter.orbSpeed,
      Math.sin(angle) * ENEMY.shooter.orbSpeed,
      angle,
      COLORS.shooter,
      { lifetime: BULLET.lifetime }
    );
    return bullet;
  }
}

export class Particle {
  constructor(entityPool) {
    this.entityPool = entityPool;
  }

  create(x, y, type, size, color) {
    return this.entityPool.create(
      ENTITY_TYPES.PARTICLE,
      x,
      y,
      0,
      0,
      0,
      color,
      {
        size,
        lifetime: PARTICLE.lifetime,
        fadeRate: size / PARTICLE.lifetime,
      }
    );
  }
}

export class Powerup {
  constructor(entityPool) {
    this.entityPool = entityPool;
  }

  create(x, y, type) {
    const config = POWERUP[type];
    const color = type === 'rapid' ? COLORS.powerupRapid :
                  type === 'shield' ? COLORS.powerupShield :
                  COLORS.powerupBomb;

    return this.entityPool.create(
      ENTITY_TYPES.POWERUP,
      x,
      y,
      0,
      0,
      0,
      color,
      { type, duration: config.duration }
    );
  }
}