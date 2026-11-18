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
  for (let i = 0; i < 110; i++) {
    starLayers.push({
      x: Math.random() * FIELD.width,
      y: Math.random() * FIELD.height,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.1,
      alpha: Math.random() * 0.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
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

    // Device pixels per logical field unit, so the backdrop fills the
    // canvas at any window size instead of only at 1280x800.
    const sx = canvas.width / FIELD.width;
    const sy = canvas.height / FIELD.height;

    // Deep-space base: near-black violet at the top, blue-black below.
    const base = context.createLinearGradient(0, 0, 0, canvas.height);
    base.addColorStop(0, '#070313');
    base.addColorStop(0.55, '#05051a');
    base.addColorStop(1, '#02020c');
    context.fillStyle = base;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Nebula clouds: the generated points become soft colour blobs, so
    // the void has depth instead of reading as flat black.
    for (const point of nebulaPoints) {
      const radius = point.r * sx;
      const blob = context.createRadialGradient(point.x * sx, point.y * sy, 0, point.x * sx, point.y * sy, radius);
      blob.addColorStop(0, `rgba(${point.color.r}, ${point.color.g}, ${point.color.b}, 0.55)`);
      blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = blob;
      context.fillRect(point.x * sx - radius, point.y * sy - radius, radius * 2, radius * 2);
    }

    // Stars drift left and twinkle on their own phase.
    for (let i = 0; i < starLayers.length; i++) {
      const star = starLayers[i];
      star.x -= star.speed * dt * 60;
      if (star.x < -star.size) star.x = FIELD.width + star.size;
      const twinkle = 0.65 + 0.35 * Math.sin(now / 400 + star.phase);
      context.fillStyle = star.color;
      context.globalAlpha = star.alpha * twinkle;
      context.fillRect(star.x * sx, star.y * sy, star.size * sx, star.size * sx);
    }

    context.globalAlpha = 1;
    context.restore();
  }

  function drawPlayer(player, damageFlash, rotation, now) {
    context.save();
    context.translate(player.x, player.y);
    // The ship's path is drawn tip-up, but a rotation of 0 means the
    // ship flies and fires toward +x: without this quarter-turn the
    // sprite always pointed 90 degrees away from its own gunfire.
    context.rotate((rotation || 0) + Math.PI / 2);

    // Engine flame: a flickering plume behind the ship whenever it moves.
    const speed = Math.hypot(player.vx || 0, player.vy || 0);
    if (speed > 20) {
      const flame = player.height / 2 + 10 + Math.sin(now / 40) * 5 + Math.random() * 4;
      context.fillStyle = '#f80';
      context.globalAlpha = 0.85;
      context.beginPath();
      context.moveTo(0, player.height / 2);
      context.lineTo(player.width / 5, player.height / 2 + flame * 0.55);
      context.lineTo(-player.width / 5, player.height / 2 + flame * 0.55);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }

    // The ship itself, glowing cyan with a hot white core: the old flat
    // triangle read as a placeholder, the glow is the game's namesake.
    context.shadowColor = COLORS.player;
    context.shadowBlur = 22;
    context.fillStyle = player.color || COLORS.player;
    context.beginPath();
    context.moveTo(0, -player.width / 2);
    context.lineTo(player.width / 2, player.height / 2);
    context.lineTo(-player.width / 2, player.height / 2);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;

    context.fillStyle = 'rgba(255, 255, 255, 0.9)';
    context.beginPath();
    context.arc(0, 2, 5, 0, Math.PI * 2);
    context.fill();

    if (damageFlash > 0) {
      context.globalAlpha = Math.sin(now / 500) * 0.5 + 0.5;
      context.fillStyle = COLORS.hitFlash;
      context.beginPath();
      context.moveTo(0, -player.width / 2);
      context.lineTo(player.width / 2, player.height / 2);
      context.lineTo(-player.width / 2, player.height / 2);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    }

    context.restore();
  }

  function drawBullet(bullet) {
    context.save();
    context.translate(bullet.x, bullet.y);
    context.rotate(bullet.rotation || 0);
    const glowColor = bullet.color || COLORS.bullet;
    context.shadowColor = glowColor;
    context.shadowBlur = 14;
    if (bullet.type === 'orb') {
      // Enemy orbs are glowing spheres, not streaks.
      context.fillStyle = glowColor;
      context.beginPath();
      context.arc(0, 0, bullet.width / 2 + 2, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255, 255, 255, 0.9)';
      context.beginPath();
      context.arc(0, 0, 2.5, 0, Math.PI * 2);
      context.fill();
    } else {
      // Player shots are tracer streaks: the old 8x8 squares rendered as
      // a dotted line that read as a rendering bug in screenshots.
      context.fillStyle = glowColor;
      context.fillRect(-16, -2.5, 32, 5);
      context.shadowBlur = 0;
      context.fillStyle = 'rgba(255, 255, 255, 0.95)';
      context.fillRect(-11, -1.2, 22, 2.4);
    }
    context.restore();
  }

  function drawEnemy(enemy) {
    context.save();
    context.translate(enemy.x, enemy.y);
    // The splitter's triangle is drawn tip-up like the player's ship, so
    // it takes the same quarter-turn to face its direction of travel.
    const facing = enemy.type === 'splitter' ? (enemy.rotation || 0) + Math.PI / 2 : (enemy.rotation || 0);
    context.rotate(facing);

    // Every enemy glows in its own colour and carries a bright core, so
    // the field reads as neon shapes hunting the ship, not flat clip-art.
    const color = enemy.color || COLORS.chaser;
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = color;

    if (enemy.type === 'chaser') {
      context.beginPath();
      context.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
      context.fill();
    } else if (enemy.type === 'wanderer') {
      context.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
    } else if (enemy.type === 'splitter') {
      context.beginPath();
      context.moveTo(0, -enemy.width / 2);
      context.lineTo(enemy.width / 2, enemy.height / 2);
      context.lineTo(-enemy.width / 2, enemy.height / 2);
      context.closePath();
      context.fill();
    } else if (enemy.type === 'shooter') {
      context.beginPath();
      context.arc(0, 0, enemy.width / 2, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(enemy.width / 2, 0);
      context.lineTo(-enemy.width / 2, 0);
      context.stroke();
    }

    context.shadowBlur = 0;
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    context.beginPath();
    context.arc(0, 0, 3.5, 0, Math.PI * 2);
    context.fill();

    // Damaged multi-HP enemies show a small health arc so hits register.
    if (enemy.maxHp > 1 && enemy.hp < enemy.maxHp) {
      context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(0, 0, enemy.width / 2 + 5, -Math.PI / 2, -Math.PI / 2 + (enemy.hp / enemy.maxHp) * Math.PI * 2);
      context.stroke();
    }

    context.restore();
  }

  function drawParticle(particle, now) {
    // Drawn inside the caller's additive ('lighter') pass: sparks shrink
    // and fade over their lifetime instead of blinking out at full size.
    const age = now / 1000 - particle.spawnTime;
    const life = Math.max(0, 1 - age / particle.lifetime);
    context.globalAlpha = life;
    context.fillStyle = particle.color;
    context.shadowColor = particle.color;
    context.shadowBlur = 8;
    const size = Math.max(1, particle.size * (0.4 + 0.6 * life));
    context.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
    context.shadowBlur = 0;
    context.globalAlpha = 1;
  }

  function drawPowerup(powerup, now) {
    context.save();
    context.translate(powerup.x, powerup.y);
    // A pulsing halo makes pickups impossible to miss mid-fight.
    const pulse = 1 + 0.18 * Math.sin(now / 180);
    context.strokeStyle = powerup.color;
    context.globalAlpha = 0.55;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(0, 0, (powerup.width / 2 + 6) * pulse, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;
    context.shadowColor = powerup.color;
    context.shadowBlur = 16;
    context.fillStyle = powerup.color;
    context.beginPath();
    context.arc(0, 0, powerup.width / 2, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
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
      const rapidText = `Rapid: ${Math.ceil(state.rapidActive / 1)}`;
      text(rapidText, FIELD.width / 2, FIELD.height - 24, 20, HUD.rapidColor, 'center', 'middle');
    }
    if (state.shieldActive) {
      text('Shield', FIELD.width / 2, FIELD.height - 44, 20, HUD.shieldColor, 'center', 'middle');
    }
  }

  function drawScreenPanel(screen, state, best, now) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);

    // Translucent, so the starfield and the ship stay visible behind the
    // panel: the old 0.8 black sheet made the title shot a void.
    context.fillStyle = 'rgba(2, 2, 12, 0.55)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const pulse = 0.6 + 0.4 * Math.sin(now / 350);
    context.textAlign = 'center';
    context.textBaseline = 'top';

    if (screen === SCREEN_TITLE) {
      const gradient = context.createLinearGradient(cx - 260, 0, cx + 260, 0);
      gradient.addColorStop(0, '#0ff');
      gradient.addColorStop(0.5, '#a5f3fc');
      gradient.addColorStop(1, '#f0f');
      context.font = 'bold 84px monospace';
      context.shadowColor = '#f0f';
      context.shadowBlur = 36;
      context.fillStyle = gradient;
      context.fillText('NEON VOID', cx, cy - 190);
      context.shadowBlur = 0;
      context.font = '22px monospace';
      context.fillStyle = '#9be8ff';
      context.fillText('Survive 10 waves of the void', cx, cy - 92);
      context.fillStyle = '#e8e8f5';
      context.fillText('WASD / arrows move · mouse aim · space or click to shoot', cx, cy - 48);
      context.font = 'bold 26px monospace';
      context.shadowColor = '#0ff';
      context.shadowBlur = 18;
      context.globalAlpha = pulse;
      context.fillStyle = '#0ff';
      context.fillText('PRESS ENTER OR CLICK TO START', cx, cy + 16);
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.font = '20px monospace';
      context.fillStyle = '#ffd76a';
      context.fillText(`Best Score: ${best}`, cx, cy + 72);
    } else if (screen === SCREEN_PAUSED) {
      context.font = 'bold 56px monospace';
      context.shadowColor = '#0ff';
      context.shadowBlur = 24;
      context.fillStyle = '#e8e8f5';
      context.fillText('PAUSED', cx, cy - 40);
      context.shadowBlur = 0;
      context.font = '22px monospace';
      context.fillText('Press P or Esc to resume', cx, cy + 40);
    } else if (screen === SCREEN_OVER) {
      context.font = 'bold 72px monospace';
      context.shadowColor = '#f00';
      context.shadowBlur = 34;
      context.fillStyle = '#ff5a5a';
      context.fillText('GAME OVER', cx, cy - 170);
      context.shadowBlur = 0;
      context.font = '26px monospace';
      context.fillStyle = '#e8e8f5';
      context.fillText(`Final Score: ${state.score}`, cx, cy - 70);
      context.fillText(`Wave reached: ${state.wave}`, cx, cy - 26);
      context.fillStyle = '#ffd76a';
      context.fillText(`Best: ${best}`, cx, cy + 18);
      context.font = 'bold 24px monospace';
      context.shadowColor = '#0ff';
      context.shadowBlur = 16;
      context.globalAlpha = pulse;
      context.fillStyle = '#0ff';
      context.fillText('PRESS ENTER OR CLICK TO RESTART', cx, cy + 78);
      context.globalAlpha = 1;
      context.shadowBlur = 0;
    } else if (screen === SCREEN_VICTORY) {
      context.font = 'bold 72px monospace';
      context.shadowColor = '#ffd76a';
      context.shadowBlur = 34;
      context.fillStyle = '#ffd76a';
      context.fillText('VICTORY!', cx, cy - 170);
      context.shadowBlur = 0;
      context.font = '26px monospace';
      context.fillStyle = '#e8e8f5';
      context.fillText(`Final Score: ${state.score}`, cx, cy - 70);
      context.fillText(`All ${state.wave} waves cleared`, cx, cy - 26);
      context.font = 'bold 24px monospace';
      context.globalAlpha = pulse;
      context.fillStyle = '#0ff';
      context.fillText('PRESS ENTER OR CLICK TO PLAY AGAIN', cx, cy + 40);
      context.globalAlpha = 1;
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
      // Post-hit invincibility blinks the ship; an active shield instead
      // draws a steady protective ring (the shield lasts 10 seconds, and
      // blinking for all of it would look like a rendering fault).
      const blinkOff = state.invincible > 0 && !state.shieldActive && Math.floor(now / 90) % 2 === 0;
      if (!blinkOff) {
        drawPlayer(state.player, state.damageFlash, state.playerRotation, now);
      }
      if (state.shieldActive) {
        context.save();
        context.strokeStyle = '#0ff';
        context.globalAlpha = 0.55 + 0.25 * Math.sin(now / 200);
        context.lineWidth = 3;
        context.shadowColor = '#0ff';
        context.shadowBlur = 14;
        context.beginPath();
        context.arc(state.player.x, state.player.y, 46, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }
    }

    for (const bullet of state.bullets) {
      drawBullet(bullet);
    }

    for (const enemy of state.enemies) {
      drawEnemy(enemy);
    }

    // Sparks blend additively so overlapping bursts bloom instead of
    // stacking into grey squares.
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      drawParticle(particle, now);
    }
    context.restore();

    for (const powerup of state.powerups) {
      drawPowerup(powerup, now);
    }

    context.restore();

    if (state.screenShake > 0) {
      state.screenShake = Math.max(0, state.screenShake - 0.1);
    }

    // The HUD belongs to gameplay only: on the title and game-over
    // panels it used to bleed through the overlay as stray clutter.
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state);
    }

    if (screen === SCREEN_TITLE || screen === SCREEN_PAUSED || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      drawScreenPanel(screen, state, best, now);
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