// All drawing: the field, entities, HUD, panels, parallax, hit flashes, particles, and UI.
// The playfield is scaled to fit the window, centred, with parallax stars and nebula gradients.
// Uses caching for text and transforms for performance.

import { FIELD, COLORS, HUD, STEP, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  const starLayers = [];
  for (let i = 0; i < 50; i++) {
    starLayers.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.1,
      alpha: Math.random() * 0.8 + 0.2,
      color: Math.random() > 0.5 ? COLORS.star2 : COLORS.star1,
    });
  }

  const nebulaPoints = [];
  for (let i = 0; i < 20; i++) {
    nebulaPoints.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      r: Math.random() * 150 + 100,
      color: Math.random() > 0.5 ? COLORS.nebula1 : COLORS.nebula2,
    });
  }

  const textCache = new Map();

  function text(value, x, y, size, color, align = 'left', baseline = 'top') {
    const key = `${value}|${size}|${color}|${align}|${baseline}`;
    if (!textCache.has(key)) {
      context.save();
      context.font = `${size}px ${HUD.font}`;
      context.fillStyle = color;
      context.textAlign = align;
      context.textBaseline = baseline;
      context.fillText(value, x, y);
      const metrics = context.measureText(value);
      const width = metrics.width;
      const height = size;
      textCache.set(key, { x, y, width, height });
      context.restore();
    } else {
      const { x: cx, y: cy } = textCache.get(key);
      x = cx;
      y = cy;
    }
    context.save();
    context.font = `${size}px ${HUD.font}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = baseline;
    context.fillText(value, x, y);
    context.restore();
  }

  function drawParallax(dt, now) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);

    for (let i = 0; i < starLayers.length; i++) {
      const star = starLayers[i];
      star.x -= star.speed * dt * 60;
      if (star.x < -star.size) star.x = FIELD.width + star.size;
      context.fillStyle = star.color;
      context.globalAlpha = star.alpha;
      context.fillRect(star.x, star.y, star.size, star.size);
    }

    context.globalAlpha = 1;
    const gradient = context.createRadialGradient(FIELD.width / 2, FIELD.height / 2, 0, FIELD.width / 2, FIELD.height / 2, FIELD.width / 2);
    gradient.addColorStop(0, `rgba(${COLORS.nebula1.r}, ${COLORS.nebula1.g}, ${COLORS.nebula1.b}, 0.3)`);
    gradient.addColorStop(1, `rgba(${COLORS.nebula2.r}, ${COLORS.nebula2.g}, ${COLORS.nebula2.b}, 0.1)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    context.restore();
  }

  function drawPlayer(player, damageFlash, rotation) {
    context.save();
    context.translate(player.x, player.y);
    context.rotate(rotation || 0);

    context.fillStyle = player.color || COLORS.player;
    context.beginPath();
    context.moveTo(0, -player.width / 2);
    context.lineTo(player.width / 2, player.height / 2);
    context.lineTo(-player.width / 2, player.height / 2);
    context.closePath();
    context.fill();

    if (damageFlash > 0) {
      context.globalAlpha = Math.sin(now / 500) * 0.5 + 0.5;
      context.fillStyle = COLORS.hitFlash;
      context.fill();
      context.globalAlpha = 1;
    }

    context.restore();
  }

  function drawBullet(bullet) {
    context.save();
    context.translate(bullet.x, bullet.y);
    context.rotate(bullet.rotation || 0);
    context.fillStyle = bullet.color || COLORS.bullet;
    context.fillRect(-bullet.width / 2, -bullet.height / 2, bullet.width, bullet.height);
    context.restore();
  }

  function drawEnemy(enemy) {
    context.save();
    context.translate(enemy.x, enemy.y);
    context.rotate(enemy.rotation || 0);

    if (enemy.type === 'chaser') {
      context.fillStyle = enemy.color || COLORS.chaser;
      context.beginPath();
      context.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.type === 'wanderer') {
      context.fillStyle = enemy.color || COLORS.wanderer;
      context.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
    } else if (enemy.type === 'splitter') {
      context.fillStyle = enemy.color || COLORS.splitter;
      context.beginPath();
      context.moveTo(0, -enemy.width / 2);
      context.lineTo(enemy.width / 2, enemy.height / 2);
      context.lineTo(-enemy.width / 2, enemy.height / 2);
      context.closePath();
      context.fill();
    } else if (enemy.type === 'shooter') {
      context.fillStyle = enemy.color || COLORS.shooter;
      context.beginPath();
      context.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = COLORS.shooter;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(enemy.width / 2, 0);
      context.lineTo(-enemy.width / 2, 0);
      context.stroke();
    }

    context.restore();
  }

  function drawParticle(particle, now) {
    context.save();
    context.globalAlpha = 1;
    const age = now / 1000 - particle.spawnTime;
    const alpha = Math.max(0, 1 - age / particle.lifetime);
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2, particle.size, particle.size);
    context.restore();
  }

  function drawPowerup(powerup) {
    context.save();
    context.translate(powerup.x, powerup.y);
    context.fillStyle = powerup.color;
    context.beginPath();
    context.arc(0, 0, powerup.width / 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, powerup.width / 2, 0, Math.PI * 2);
    context.stroke();
    const letter = powerup.type === 'rapid' ? 'R' : powerup.type === 'shield' ? 'S' : 'B';
    context.fillStyle = '#fff';
    context.font = `bold ${powerup.width / 2}px monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(letter, 0, 0);
    context.restore();
  }

  function drawHud(state) {
    text(`Score: ${state.score}`, 24, 20, 24, HUD.scoreColor, 'left', 'top');
    text(`Wave: ${state.wave}`, FIELD.width / 2, 20, 24, HUD.waveColor, 'center', 'top');
    text(`HP: ${state.playerHp}/${PLAYER.hp}`, 24, 60, 24, HUD.hpColor, 'left', 'top');
    if (state.combo > 0) {
      text(`Combo: ${state.combo}x`, FIELD.width / 2, 60, 24, HUD.comboColor, 'center', 'top');
    }
    for (let i = 0; i < PLAYER.hp; i++) {
      const x = FIELD.width - 24 - i * 40;
      const color = i < state.playerHp ? HUD.hpColor : HUD.ui;
      context.fillStyle = color;
      context.fillRect(x, 24, 32, 12);
    }
    if (state.rapidActive > 0) {
      const text = `Rapid: ${Math.ceil(state.rapidActive / 1)}`;
      text(text, FIELD.width / 2, FIELD.height - 24, 20, HUD.rapidColor, 'center', 'middle');
    }
    if (state.shieldActive) {
      text('Shield', FIELD.width / 2, FIELD.height - 44, 20, HUD.shieldColor, 'center', 'middle');
    }
  }

  function drawScreenPanel(screen, state, best) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = COLORS.text;
    context.font = 'bold 48px monospace';
    context.textAlign = 'center';
    context.textBaseline = 'top';

    if (screen === SCREEN_TITLE) {
      context.fillText('NEON VOID', FIELD.width / 2, FIELD.height / 2 - 100);
      context.font = '24px monospace';
      context.fillText('WASD/arrows move, mouse aim, space/click to shoot', FIELD.width / 2, FIELD.height / 2 - 50);
      context.fillText('Press Enter or click to start', FIELD.width / 2, FIELD.height / 2);
      context.font = '20px monospace';
      context.fillText(`Best Score: ${best}`, FIELD.width / 2, FIELD.height / 2 + 50);
    } else if (screen === SCREEN_PAUSED) {
      context.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2);
      context.font = '24px monospace';
      context.fillText('Press P or Esc to resume', FIELD.width / 2, FIELD.height / 2 + 50);
    } else if (screen === SCREEN_OVER) {
      context.fillText('GAME OVER', FIELD.width / 2, FIELD.height / 2 - 50);
      context.font = '24px monospace';
      context.fillText(`Final Score: ${state.score}`, FIELD.width / 2, FIELD.height / 2);
      context.fillText(`Wave: ${state.wave}`, FIELD.width / 2, FIELD.height / 2 + 40);
      context.fillText(`Best: ${best}`, FIELD.width / 2, FIELD.height / 2 + 80);
      context.fillText('Press Enter or click to restart', FIELD.width / 2, FIELD.height / 2 + 120);
    } else if (screen === SCREEN_VICTORY) {
      context.fillText('VICTORY!', FIELD.width / 2, FIELD.height / 2 - 50);
      context.font = '24px monospace';
      context.fillText(`Final Score: ${state.score}`, FIELD.width / 2, FIELD.height / 2);
      context.fillText(`Wave: ${state.wave}`, FIELD.width / 2, FIELD.height / 2 + 40);
      context.fillText('Press Enter or click to restart', FIELD.width / 2, FIELD.height / 2 + 80);
    }

    context.restore();
  }

  function draw(state, screen, best) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();
    drawParallax(STEP, now);

    context.save();
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    if (state.screenShake > 0) {
      const dx = (Math.random() - 0.5) * state.screenShake * 10;
      const dy = (Math.random() - 0.5) * state.screenShake * 10;
      context.translate(dx, dy);
    }

    if (state.player) {
      drawPlayer(state.player, state.damageFlash, state.playerRotation);
    }

    for (const bullet of state.bullets) {
      drawBullet(bullet);
    }

    for (const enemy of state.enemies) {
      drawEnemy(enemy);
    }

    for (const particle of state.particles) {
      drawParticle(particle, now);
    }

    for (const powerup of state.powerups) {
      drawPowerup(powerup);
    }

    context.restore();

    if (state.screenShake > 0) {
      state.screenShake = Math.max(0, state.screenShake - 0.1);
    }

    drawHud(state);

    if (screen === SCREEN_TITLE || screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      drawScreenPanel(screen, state, best);
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  return { draw };
}