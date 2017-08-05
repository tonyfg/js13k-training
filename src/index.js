const CIRCLE = Math.PI * 2;
const MOBILE = (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i).test(navigator.userAgent);

function Controls() {
  this.codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
  this.states = { left: false, right: false, forward: false, backward: false };
  document.addEventListener('keydown', this.onKey.bind(this, true), false);
  document.addEventListener('keyup', this.onKey.bind(this, false), false);
  document.addEventListener('touchstart', this.onTouch.bind(this), false);
  document.addEventListener('touchmove', this.onTouch.bind(this), false);
  document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
}

Controls.prototype.onTouch = function(e) {
  const t = e.touches[0];
  this.onTouchEnd(e);
  if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
  else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
  else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
};

Controls.prototype.onTouchEnd = function(e) {
  this.states = { left: false, right: false, forward: false, backward: false };
  e.preventDefault();
  e.stopPropagation();
};

Controls.prototype.onKey = function(val, e) {
  const state = this.codes[e.keyCode];
  if (typeof state === 'undefined') return;
  this.states[state] = val;
  e.preventDefault && e.preventDefault();
  e.stopPropagation && e.stopPropagation();
};

function Bitmap(src, width, height) {
  this.image = new Image();
  this.image.src = src;
  this.width = width;
  this.height = height;
}

function Player(x, y, direction) {
  this.x = x;
  this.y = y;
  this.direction = direction;
  this.weapon = new Bitmap('assets/knife_hand.png', 319, 320);
  this.paces = 0;
}

Player.prototype.rotate = function(angle) {
  this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
};

Player.prototype.walk = function(distance, map) {
  const dx = Math.cos(this.direction) * distance;
  const dy = Math.sin(this.direction) * distance;
  if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
  if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
  this.paces += distance;
};

Player.prototype.update = function(controls, map, seconds) {
  if (controls.left) this.rotate(-Math.PI * seconds);
  if (controls.right) this.rotate(Math.PI * seconds);
  if (controls.forward) this.walk(3 * seconds, map);
  if (controls.backward) this.walk(-3 * seconds, map);
};

function Map(size) {
  this.size = size;
  this.wallGrid = new Uint8Array(size * size);
  this.skybox = new Bitmap('assets/deathvalley_panorama.jpg', 2000, 750);
  this.wallTexture = new Bitmap('assets/wall_texture.jpg', 1024, 1024);
  this.light = 0;
}

Map.prototype.get = function(xs, ys) {
  const x = Math.floor(xs);
  const y = Math.floor(ys);
  if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
  return this.wallGrid[y * this.size + x];
};

Map.prototype.randomize = function() {
  for (let i = 0; i < this.size * this.size; i++) {
    this.wallGrid[i] = Math.random() < 0.3 ? 1 : 0;
  }
};

Map.prototype.cast = function(point, angle, range) {
  const self = this;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  const noWall = { length2: Infinity };

  return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

  function ray(origin) {
    const stepX = step(sin, cos, origin.x, origin.y);
    const stepY = step(cos, sin, origin.y, origin.x, true);
    const nextStep = stepX.length2 < stepY.length2
      ? inspect(stepX, 1, 0, origin.distance, stepX.y)
      : inspect(stepY, 0, 1, origin.distance, stepY.x);

    if (nextStep.distance > range) return [origin];
    return [origin].concat(ray(nextStep));
  }

  function step(rise, run, x, y, inverted) {
    if (run === 0) return noWall;
    const dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
    const dy = dx * (rise / run);
    return {
      x: inverted ? y + dy : x + dx,
      y: inverted ? x + dx : y + dy,
      length2: dx * dx + dy * dy
    };
  }

  function inspect(stepSize, shiftX, shiftY, distance, offset) {
    const dx = cos < 0 ? shiftX : 0;
    const dy = sin < 0 ? shiftY : 0;
    stepSize.height = self.get(stepSize.x - dx, stepSize.y - dy);
    stepSize.distance = distance + Math.sqrt(stepSize.length2);
    if (shiftX) stepSize.shading = cos < 0 ? 2 : 0;
    else stepSize.shading = sin < 0 ? 2 : 1;
    stepSize.offset = offset - Math.floor(offset);
    return stepSize;
  }
};

Map.prototype.update = function(seconds) {
  if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
  else if (Math.random() * 5 < seconds) this.light = 2;
};

function Camera(canvas, resolution, focalLength) {
  this.ctx = canvas.getContext('2d');
  this.width = canvas.width = window.innerWidth * 0.5;
  this.height = canvas.height = window.innerHeight * 0.5;
  this.resolution = resolution;
  this.spacing = this.width / resolution;
  this.focalLength = focalLength || 0.8;
  this.range = MOBILE ? 8 : 14;
  this.lightRange = 5;
  this.scale = (this.width + this.height) / 1200;
}

Camera.prototype.render = function(player, map) {
  this.drawSky(player.direction, map.skybox, map.light);
  this.drawColumns(player, map);
  this.drawWeapon(player.weapon, player.paces);
};

Camera.prototype.drawSky = function(direction, sky, ambient) {
  const width = sky.width * (this.height / sky.height) * 2;
  const left = (direction / CIRCLE) * -width;

  this.ctx.save();
  this.ctx.drawImage(sky.image, left, 0, width, this.height);
  if (left < width - this.width) {
    this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
  }
  if (ambient > 0) {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.globalAlpha = ambient * 0.1;
    this.ctx.fillRect(0, this.height * 0.5, this.width, this.height * 0.5);
  }
  this.ctx.restore();
};

Camera.prototype.drawColumns = function(player, map) {
  this.ctx.save();
  for (let column = 0; column < this.resolution; column++) {
    const x = column / this.resolution - 0.5;
    const angle = Math.atan2(x, this.focalLength);
    const ray = map.cast(player, player.direction + angle, this.range);
    this.drawColumn(column, ray, angle, map);
  }
  this.ctx.restore();
};

Camera.prototype.drawWeapon = function(weapon, paces) {
  const bobX = Math.cos(paces * 2) * this.scale * 6;
  const bobY = Math.sin(paces * 4) * this.scale * 6;
  const left = this.width * 0.66 + bobX;
  const top = this.height * 0.6 + bobY;
  this.ctx.drawImage(
    weapon.image,
    left,
    top,
    weapon.width * this.scale,
    weapon.height * this.scale
  );
};

// eslint-disable-next-line
Camera.prototype.drawColumn = function(column, ray, angle, map) {
  const ctx = this.ctx;
  const texture = map.wallTexture;
  const left = Math.floor(column * this.spacing);
  const width = Math.ceil(this.spacing);
  let hit = -1;

  while (++hit < ray.length && ray[hit].height <= 0);

  for (let s = ray.length - 1; s >= 0; s--) {
    const step = ray[s];
    let rainDrops = Math.pow(Math.random(), 3) * s;
    const rain = (rainDrops > 0) && this.project(0.1, angle, step.distance);

    if (s === hit) {
      const textureX = Math.floor(texture.width * step.offset);
      const wall = this.project(step.height, angle, step.distance);

      ctx.globalAlpha = 1;
      ctx.drawImage(
        texture.image,
        textureX,
        0,
        1,
        texture.height,
        left,
        wall.top,
        width,
        wall.height
      );

      ctx.fillStyle = '#000000';
      ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
      ctx.fillRect(left, wall.top, width, wall.height);
    }

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.15;
    while (--rainDrops > 0) ctx.fillRect(left, Math.random() * rain.top, 1, rain.height);
  }
};

Camera.prototype.project = function(height, angle, distance) {
  const z = distance * Math.cos(angle);
  const wallHeight = this.height * height / z;
  const bottom = this.height / 2 * (1 + 1 / z);
  return {
    top: bottom - wallHeight,
    height: wallHeight
  };
};

function GameLoop() {
  this.frame = this.frame.bind(this);
  this.lastTime = 0;
  this.callback = function() {};
}

GameLoop.prototype.start = function(callback) {
  this.callback = callback;
  requestAnimationFrame(this.frame);
};

GameLoop.prototype.frame = function(time) {
  const seconds = (time - this.lastTime) / 1000;
  this.lastTime = time;
  if (seconds < 0.2) this.callback(seconds);
  requestAnimationFrame(this.frame);
};

const display = document.getElementById('display');
const player = new Player(15.3, -1.2, Math.PI * 0.3);
const map = new Map(32);
const controls = new Controls();
const camera = new Camera(display, MOBILE ? 160 : 320, 0.8);
const loop = new GameLoop();

map.randomize();

loop.start((seconds) => {
  map.update(seconds);
  player.update(controls.states, map, seconds);
  camera.render(player, map);
});
