// Keyboard and pointer input. Held keys give steering and mouse position; one-shot presses (shoot,
// pause, restart, mute) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.

export const ACTION_SHOOT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;

export function createInput(canvas) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let lastShootTime = 0;

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') left = true;
    else if (event.code === 'KeyD' || event.code === 'ArrowRight') right = true;
    else if (event.code === 'KeyW' || event.code === 'ArrowUp') up = true;
    else if (event.code === 'KeyS' || event.code === 'ArrowDown') down = true;
    else if (event.code === 'Space' || event.code === 'Enter') {
      if (!event.repeat) actions |= ACTION_SHOOT;
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    }
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (event.code === 'KeyA' || event.code === 'ArrowLeft') left = false;
    else if (event.code === 'KeyD' || event.code === 'ArrowRight') right = false;
    else if (event.code === 'KeyW' || event.code === 'ArrowUp') up = false;
    else if (event.code === 'KeyS' || event.code === 'ArrowDown') down = false;
  });

  window.addEventListener('blur', () => {
    left = false;
    right = false;
    up = false;
    down = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    mouseDown = true;
    actions |= ACTION_SHOOT;
    e.preventDefault();
  });

  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  return {
    direction() {
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
      };
    },

    get mousePosition() {
      return { x: mouseX, y: mouseY };
    },

    isMouseDown() {
      return mouseDown;
    },

    canShoot(shootTime) {
      return Date.now() / 1000 - lastShootTime >= shootTime;
    },

    shoot() {
      lastShootTime = Date.now() / 1000;
    },

    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}