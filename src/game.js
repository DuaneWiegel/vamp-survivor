const stages = [
  {
    name: 'Petal Shrine',
    realm: 'Moonlit sanctuary',
    background: '/assets/petal-shrine.webp',
    accent: '#ff8eb9',
    enemies: [0, 1, 2],
    boss: 3,
    bossName: 'Blossom Jelly Queen',
    spawnEvery: 1.15,
  },
  {
    name: 'Candy Blossom Fair',
    realm: 'Festival of sweets',
    background: '/assets/candy-garden.webp',
    accent: '#b9f0da',
    enemies: [1, 2, 3],
    boss: 4,
    bossName: 'The Drowsy Moon Owl',
    spawnEvery: 1.03,
  },
  {
    name: 'Moonwell Skybridge',
    realm: 'A path above the clouds',
    background: '/assets/moonbridge.webp',
    accent: '#b6bbff',
    enemies: [0, 2, 3],
    boss: 5,
    bossName: 'Celestial Kitsune',
    spawnEvery: 0.92,
  },
];

const upgradePool = [
  {
    id: 'star-power',
    name: 'Star Power',
    description: 'Your star bolts shine brighter and hit harder.',
    icon: '✦',
    stat: 'damage',
    max: 5,
  },
  {
    id: 'swift-casting',
    name: 'Swift Casting',
    description: 'Cast your next spell a little sooner.',
    icon: '➶',
    stat: 'attackSpeed',
    max: 5,
  },
  {
    id: 'moon-dash',
    name: 'Moon Dash',
    description: 'Glide faster between the spirits.',
    icon: '☾',
    stat: 'speed',
    max: 4,
  },
  {
    id: 'lucky-charm',
    name: 'Lucky Charm',
    description: 'Gather moon crystals from farther away.',
    icon: '◇',
    stat: 'magnet',
    max: 4,
  },
  {
    id: 'heart-bloom',
    name: 'Heart Bloom',
    description: 'Restore a heart and grow a little tougher.',
    icon: '♥',
    stat: 'health',
    max: 3,
  },
];

const image = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`Could not load ${src}`));
  img.src = src;
});

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class MoonpetalGame {
  constructor(canvas, onUI) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onUI = onUI;
    this.assets = {};
    this.destroyed = false;
    this.phase = 'title';
    this.stageIndex = 0;
    this.keys = new Set();
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.ambientPetals = [];
    this.player = null;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.lastFrame = 0;
    this.lastHud = 0;
    this.spawnTimer = 0;
    this.attackTimer = 0;
    this.damageTimer = 0;
    this.toastTimer = 0;
    this.transitionTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.upgradeChoices = [];
    this.kills = 0;
    this.totalTime = 0;
    this.stageTime = 0;
    this.seedAmbient();

    this.handleResize = () => this.resize();
    this.handleKeyDown = (event) => this.keyDown(event);
    this.handleKeyUp = (event) => this.keyUp(event);
    this.handleBlur = () => this.keys.clear();
    this.loop = (now) => this.frame(now);
  }

  async load() {
    const [hero, shrine, fair, skybridge, spirits, pickups] = await Promise.all([
      image('/assets/heroine.png'),
      image('/assets/petal-shrine.webp'),
      image('/assets/candy-garden.webp'),
      image('/assets/moonbridge.webp'),
      image('/assets/spirits-sheet.png'),
      image('/assets/pickups-sheet.png'),
    ]);
    if (this.destroyed) return;
    this.assets = { hero, shrine, fair, skybridge, spirits, pickups };
    this.resize();
    this.player = this.createPlayer();
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    this.lastFrame = performance.now();
    this.frame(this.lastFrame);
    this.publish(true);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  get stage() {
    return stages[this.stageIndex];
  }

  createPlayer() {
    return {
      x: this.width / 2,
      y: this.height / 2 + 18,
      hp: 5,
      maxHp: 5,
      speed: 230,
      damage: 2,
      attackDelay: 0.74,
      magnet: 126,
      level: 1,
      xp: 0,
      xpNeeded: 6,
      auto: true,
      invulnerable: 0,
      upgrades: {
        'star-power': 0,
        'swift-casting': 0,
        'moon-dash': 0,
        'lucky-charm': 0,
        'heart-bloom': 0,
      },
    };
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.width = rect.width;
    this.height = rect.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.player) {
      this.player.x = clamp(this.player.x, 55, this.width - 55);
      this.player.y = clamp(this.player.y, 65, this.height - 50);
    }
  }

  seedAmbient() {
    this.ambientPetals = Array.from({ length: 24 }, (_, index) => ({
      x: Math.random() * 1600,
      y: Math.random() * 1000,
      size: 3 + Math.random() * 4,
      speed: 8 + Math.random() * 18,
      sway: Math.random() * Math.PI * 2,
      tint: index % 3 === 0 ? 'rgba(255, 194, 219, .42)' : 'rgba(255, 238, 219, .32)',
    }));
  }

  frame(now) {
    if (!this.assets.hero) return;
    const dt = Math.min((now - this.lastFrame) / 1000, 0.045);
    this.lastFrame = now;
    this.update(dt);
    this.draw(now / 1000);
    if (now - this.lastHud > 90) this.publish();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.ambientPetals.forEach((petal) => {
      petal.y += petal.speed * dt;
      petal.x += Math.sin(performance.now() / 850 + petal.sway) * 10 * dt;
      if (petal.y > this.height + 10) {
        petal.y = -10;
        petal.x = Math.random() * this.width;
      }
    });

    if (this.phase === 'transition') {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) this.startNextStage();
      return;
    }
    if (this.phase !== 'playing') return;

    this.totalTime += dt;
    this.stageTime += dt;
    this.spawnTimer -= dt;
    this.attackTimer -= dt;
    this.damageTimer -= dt;
    this.toastTimer = Math.max(0, this.toastTimer - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);

    this.movePlayer(dt);
    this.spawnSpiritIfNeeded();
    this.moveEnemies(dt);
    this.attackIfReady();
    this.moveProjectiles(dt);
    this.movePickups(dt);

    if (!this.bossSpawned && this.stageTime >= 27) this.spawnBoss();
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.phase = 'gameover';
      this.keys.clear();
    }
  }

  movePlayer(dt) {
    const left = this.keys.has('a') || this.keys.has('arrowleft');
    const right = this.keys.has('d') || this.keys.has('arrowright');
    const up = this.keys.has('w') || this.keys.has('arrowup');
    const down = this.keys.has('s') || this.keys.has('arrowdown');
    let dx = Number(right) - Number(left);
    let dy = Number(down) - Number(up);
    if (!dx && !dy) return;
    const magnitude = Math.hypot(dx, dy);
    dx /= magnitude;
    dy /= magnitude;
    this.player.x = clamp(this.player.x + dx * this.player.speed * dt, 48, this.width - 48);
    this.player.y = clamp(this.player.y + dy * this.player.speed * dt, 72, this.height - 48);
  }

  spawnPoint() {
    const edge = Math.floor(Math.random() * 4);
    const pad = 32;
    if (edge === 0) return { x: Math.random() * this.width, y: -pad };
    if (edge === 1) return { x: this.width + pad, y: Math.random() * this.height };
    if (edge === 2) return { x: Math.random() * this.width, y: this.height + pad };
    return { x: -pad, y: Math.random() * this.height };
  }

  spawnSpiritIfNeeded() {
    if (this.spawnTimer > 0 || this.enemies.length > 26) return;
    this.spawnTimer = this.stage.spawnEvery;
    const point = this.spawnPoint();
    const type = this.stage.enemies[Math.floor(Math.random() * this.stage.enemies.length)];
    this.enemies.push({
      ...point,
      type,
      hp: 2 + Math.floor(this.stageIndex * 0.4),
      maxHp: 2 + Math.floor(this.stageIndex * 0.4),
      speed: 43 + Math.random() * 18 + this.stageIndex * 7,
      size: 58 + Math.random() * 12,
      damage: 1,
      isBoss: false,
      hitFlash: 0,
    });
  }

  spawnBoss() {
    this.bossSpawned = true;
    const point = this.spawnPoint();
    const hp = 28 + this.stageIndex * 14;
    this.boss = {
      ...point,
      type: this.stage.boss,
      hp,
      maxHp: hp,
      speed: 35 + this.stageIndex * 7,
      size: 152 + this.stageIndex * 10,
      damage: 1.5,
      isBoss: true,
      hitFlash: 0,
    };
    this.enemies.push(this.boss);
    this.toastTimer = 3.2;
  }

  moveEnemies(dt) {
    this.enemies.forEach((enemy) => {
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distanceToPlayer = Math.hypot(dx, dy) || 1;
      enemy.x += (dx / distanceToPlayer) * enemy.speed * dt;
      enemy.y += (dy / distanceToPlayer) * enemy.speed * dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      const touchDistance = enemy.isBoss ? 76 : 38;
      if (distanceToPlayer < touchDistance && this.damageTimer <= 0 && this.player.invulnerable <= 0) {
        this.player.hp -= enemy.damage;
        this.player.invulnerable = 0.95;
        this.damageTimer = 0.5;
      }
    });
  }

  nearestEnemy(maxDistance = 640) {
    let target = null;
    let closest = maxDistance;
    this.enemies.forEach((enemy) => {
      const d = distance(this.player, enemy);
      if (d < closest) {
        target = enemy;
        closest = d;
      }
    });
    return target;
  }

  attackIfReady() {
    if (!this.player.auto || this.attackTimer > 0) return;
    const target = this.nearestEnemy();
    if (!target) return;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const angle = Math.atan2(dy, dx);
    const shots = this.player.upgrades['star-power'] >= 4 ? [-0.12, 0.12] : [0];
    shots.forEach((offset) => {
      const shotAngle = angle + offset;
      this.projectiles.push({
        x: this.player.x + Math.cos(shotAngle) * 24,
        y: this.player.y + Math.sin(shotAngle) * 24,
        vx: Math.cos(shotAngle) * 600,
        vy: Math.sin(shotAngle) * 600,
        damage: this.player.damage,
        rotation: shotAngle,
        life: 1.2,
      });
    });
    this.attackTimer = this.player.attackDelay;
  }

  moveProjectiles(dt) {
    this.projectiles.forEach((projectile) => {
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= dt;
      const target = this.enemies.find((enemy) => enemy.hp > 0 && distance(projectile, enemy) < (enemy.isBoss ? 54 : 28));
      if (target) {
        target.hp -= projectile.damage;
        target.hitFlash = 0.14;
        projectile.life = 0;
        if (target.hp <= 0) this.defeatEnemy(target);
      }
    });
    this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
  }

  defeatEnemy(enemy) {
    this.kills += 1;
    if (enemy.isBoss) {
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        this.pickups.push({ x: enemy.x + Math.cos(angle) * 34, y: enemy.y + Math.sin(angle) * 34, type: 'xp', value: 1 });
      }
      this.pickups.push({ x: enemy.x, y: enemy.y + 20, type: 'heart', value: 1 });
      this.boss = null;
      if (this.stageIndex === stages.length - 1) {
        this.phase = 'victory';
      } else {
        this.phase = 'transition';
        this.transitionTimer = 4;
      }
      this.keys.clear();
      return;
    }
    this.pickups.push({ x: enemy.x, y: enemy.y, type: 'xp', value: 1 });
    if (Math.random() < 0.055 && this.player.hp < this.player.maxHp) {
      this.pickups.push({ x: enemy.x + 16, y: enemy.y, type: 'heart', value: 1 });
    }
  }

  movePickups(dt) {
    this.pickups.forEach((pickup) => {
      if (this.phase !== 'playing') return;
      const d = distance(pickup, this.player);
      if (d < this.player.magnet && d > 0.01) {
        const pull = 260 + (this.player.magnet - d) * 1.8;
        pickup.x += ((this.player.x - pickup.x) / d) * pull * dt;
        pickup.y += ((this.player.y - pickup.y) / d) * pull * dt;
      }
      if (d < 24) {
        if (pickup.type === 'xp') this.addXp(pickup.value);
        if (pickup.type === 'heart') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        pickup.collected = true;
      }
    });
    this.pickups = this.pickups.filter((pickup) => !pickup.collected);
  }

  addXp(value) {
    this.player.xp += value;
    if (this.player.xp >= this.player.xpNeeded) {
      this.player.xp -= this.player.xpNeeded;
      this.player.level += 1;
      this.player.xpNeeded = Math.round(this.player.xpNeeded * 1.32 + 1);
      this.openUpgradeChoices();
    }
  }

  openUpgradeChoices() {
    const available = upgradePool.filter((upgrade) => this.player.upgrades[upgrade.id] < upgrade.max);
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    this.upgradeChoices = shuffled.slice(0, Math.min(3, shuffled.length));
    if (!this.upgradeChoices.length) return;
    this.phase = 'upgrade';
    this.keys.clear();
  }

  chooseUpgrade(index) {
    if (this.phase !== 'upgrade') return;
    const upgrade = this.upgradeChoices[index];
    if (!upgrade) return;
    const level = this.player.upgrades[upgrade.id] + 1;
    this.player.upgrades[upgrade.id] = level;
    if (upgrade.stat === 'damage') this.player.damage += 1;
    if (upgrade.stat === 'attackSpeed') this.player.attackDelay = Math.max(0.3, this.player.attackDelay - 0.09);
    if (upgrade.stat === 'speed') this.player.speed += 22;
    if (upgrade.stat === 'magnet') this.player.magnet += 46;
    if (upgrade.stat === 'health') {
      this.player.maxHp += 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2);
    }
    this.phase = 'playing';
    this.upgradeChoices = [];
    if (this.player.xp >= this.player.xpNeeded) {
      this.player.xp -= this.player.xpNeeded;
      this.player.level += 1;
      this.player.xpNeeded = Math.round(this.player.xpNeeded * 1.32 + 1);
      this.openUpgradeChoices();
    }
  }

  startRun() {
    this.stageIndex = 0;
    this.phase = 'playing';
    this.player = this.createPlayer();
    this.player.x = this.width / 2;
    this.player.y = this.height / 2 + 18;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.kills = 0;
    this.totalTime = 0;
    this.stageTime = 0;
    this.spawnTimer = 0.7;
    this.attackTimer = 0;
    this.damageTimer = 0;
    this.toastTimer = 2.8;
    this.transitionTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.keys.clear();
    for (let i = 0; i < 4; i += 1) this.spawnSpiritIfNeededAtStart(i);
    this.publish(true);
  }

  spawnSpiritIfNeededAtStart(index) {
    const side = index % 4;
    const margin = 42;
    const point = side === 0
      ? { x: margin, y: 110 + Math.random() * (this.height - 210) }
      : side === 1
        ? { x: this.width - margin, y: 110 + Math.random() * (this.height - 210) }
        : side === 2
          ? { x: 140 + Math.random() * (this.width - 280), y: margin }
          : { x: 140 + Math.random() * (this.width - 280), y: this.height - margin };
    const type = this.stage.enemies[Math.floor(Math.random() * this.stage.enemies.length)];
    this.enemies.push({ ...point, type, hp: 2, maxHp: 2, speed: 48, size: 62, damage: 1, isBoss: false, hitFlash: 0 });
  }

  startNextStage() {
    this.stageIndex = Math.min(stages.length - 1, this.stageIndex + 1);
    this.phase = 'playing';
    this.stageTime = 0;
    this.spawnTimer = 0.9;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
    this.player.x = this.width / 2;
    this.player.y = this.height / 2 + 18;
    this.player.invulnerable = 1.5;
    this.toastTimer = 3.2;
    this.keys.clear();
    for (let i = 0; i < 4; i += 1) this.spawnSpiritIfNeededAtStart(i);
    this.publish(true);
  }

  toggleAuto() {
    if (this.phase !== 'playing') return;
    this.player.auto = !this.player.auto;
    this.publish(true);
  }

  togglePause() {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.keys.clear();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
    }
    this.publish(true);
  }

  resume() {
    if (this.phase === 'paused') this.phase = 'playing';
    this.publish(true);
  }

  continueStage() {
    if (this.phase === 'transition') {
      this.transitionTimer = 0;
      this.startNextStage();
    }
  }

  keyDown(event) {
    const key = event.key.toLowerCase();
    const buttonTarget = event.target instanceof HTMLElement && Boolean(event.target.closest('button'));
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) || (key === ' ' && !buttonTarget)) event.preventDefault();
    if (event.repeat && key !== 'w' && key !== 'a' && key !== 's' && key !== 'd') return;

    if (key === ' ') {
      if (buttonTarget) return;
      if (this.phase === 'playing') this.toggleAuto();
      else if (this.phase === 'title') this.startRun();
      else if (this.phase === 'transition') this.continueStage();
      else if (this.phase === 'paused') this.resume();
      return;
    }
    if (key === 'escape') {
      if (this.phase === 'playing' || this.phase === 'paused') this.togglePause();
      return;
    }
    if (key === 'enter' && buttonTarget) return;
    if (this.phase === 'title' && key === 'enter') {
      this.startRun();
      return;
    }
    if (this.phase === 'transition' && key === 'enter') {
      this.continueStage();
      return;
    }
    if (this.phase === 'paused' && key === 'enter') {
      this.resume();
      return;
    }
    if ((this.phase === 'gameover' || this.phase === 'victory') && key === 'enter') {
      this.startRun();
      return;
    }
    if (this.phase === 'upgrade' && ['1', '2', '3'].includes(key)) {
      this.chooseUpgrade(Number(key) - 1);
      return;
    }
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      this.keys.add(key);
    }
  }

  keyUp(event) {
    this.keys.delete(event.key.toLowerCase());
  }

  stageBackground() {
    if (this.stageIndex === 0) return this.assets.shrine;
    if (this.stageIndex === 1) return this.assets.fair;
    return this.assets.skybridge;
  }

  draw(time) {
    const ctx = this.context;
    const image = this.stageBackground();
    if (!ctx || !image) return;
    ctx.clearRect(0, 0, this.width, this.height);
    const scale = Math.max(this.width / image.width, this.height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    ctx.drawImage(image, (this.width - drawWidth) / 2, (this.height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.fillStyle = this.stageIndex === 1 ? 'rgba(39, 22, 55, .12)' : 'rgba(20, 14, 45, .11)';
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawPetals(ctx, time);
    if (this.phase === 'title') {
      this.drawTitleScene(ctx, time);
      return;
    }
    this.drawPickups(ctx, time);
    this.drawEnemies(ctx, time);
    this.drawProjectiles(ctx, time);
    this.drawPlayer(ctx, time);
  }

  drawPetals(ctx, time) {
    this.ambientPetals.forEach((petal) => {
      const x = (petal.x + Math.sin(time * 0.5 + petal.sway) * 22) % (this.width + 20);
      ctx.save();
      ctx.translate(x, petal.y % (this.height + 20));
      ctx.rotate(Math.sin(time * 0.7 + petal.sway));
      ctx.fillStyle = petal.tint;
      ctx.beginPath();
      ctx.ellipse(0, 0, petal.size, petal.size * 0.56, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawTitleScene(ctx, time) {
    const x = this.width * 0.71;
    const y = this.height * 0.56;
    const bob = Math.sin(time * 1.3) * 6;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(x, y + 40, 66, 21, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 140, 186, .3)';
    ctx.fill();
    ctx.shadowColor = 'rgba(255, 190, 96, .65)';
    ctx.shadowBlur = 36;
    ctx.drawImage(this.assets.hero, x - 113, y - 166 + bob, 226, 248);
    ctx.restore();
    for (let i = 0; i < 5; i += 1) {
      const angle = time * 0.6 + i * (Math.PI * 2 / 5);
      const sx = x + Math.cos(angle) * 90;
      const sy = y - 42 + Math.sin(angle) * 74;
      this.drawStar(ctx, sx, sy, 5 + (i % 2) * 2, '#fff0a8', 0.92);
    }
  }

  drawPlayer(ctx, time) {
    if (!this.player) return;
    const { x, y, invulnerable } = this.player;
    const blink = invulnerable > 0 && Math.floor(time * 15) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.56 : 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 24, 37, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 132, 184, .36)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 44, 23, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 236, 177, .48)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowColor = 'rgba(255, 153, 211, .52)';
    ctx.shadowBlur = 20;
    const bob = Math.sin(time * 7) * 2.2;
    ctx.drawImage(this.assets.hero, x - 70, y - 104 + bob, 140, 150);
    ctx.restore();
  }

  drawEnemies(ctx, time) {
    this.enemies.forEach((enemy) => {
      const size = enemy.size;
      const sx = (enemy.type % 3) * 512;
      const sy = Math.floor(enemy.type / 3) * 512;
      const float = Math.sin(time * (enemy.isBoss ? 2.2 : 3.6) + enemy.x * 0.02) * (enemy.isBoss ? 4 : 3);
      ctx.save();
      ctx.globalAlpha = enemy.hitFlash > 0 ? 0.55 + enemy.hitFlash : 1;
      ctx.shadowColor = enemy.isBoss ? 'rgba(255, 197, 118, .68)' : 'rgba(154, 121, 246, .38)';
      ctx.shadowBlur = enemy.isBoss ? 26 : 13;
      ctx.drawImage(this.assets.spirits, sx, sy, 512, 512, enemy.x - size / 2, enemy.y - size / 2 + float, size, size);
      ctx.restore();
      if (enemy.isBoss) {
        const barWidth = 116;
        const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
        ctx.fillStyle = 'rgba(37, 22, 53, .7)';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barWidth / 2, enemy.y - size / 2 - 9, barWidth, 7, 5);
        ctx.fill();
        ctx.fillStyle = '#ff9dbf';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barWidth / 2, enemy.y - size / 2 - 9, barWidth * ratio, 7, 5);
        ctx.fill();
      }
    });
  }

  drawProjectiles(ctx, time) {
    this.projectiles.forEach((projectile) => {
      ctx.save();
      ctx.translate(projectile.x, projectile.y);
      ctx.rotate(projectile.rotation + time * 1.4);
      ctx.shadowColor = 'rgba(255, 218, 103, .95)';
      ctx.shadowBlur = 16;
      ctx.drawImage(this.assets.pickups, 1448, 0, 724, 724, -13, -13, 26, 26);
      ctx.restore();
    });
  }

  drawPickups(ctx, time) {
    this.pickups.forEach((pickup) => {
      const sourceX = pickup.type === 'heart' ? 724 : 0;
      const size = pickup.type === 'heart' ? 29 : 25;
      const bob = Math.sin(time * 4 + pickup.x * 0.1) * 2;
      ctx.save();
      ctx.shadowColor = pickup.type === 'heart' ? 'rgba(255, 113, 160, .82)' : 'rgba(111, 226, 255, .85)';
      ctx.shadowBlur = 14;
      ctx.drawImage(this.assets.pickups, sourceX, 0, 724, 724, pickup.x - size / 2, pickup.y - size / 2 + bob, size, size);
      ctx.restore();
    });
  }

  drawStar(ctx, x, y, radius, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 11;
    ctx.beginPath();
    for (let point = 0; point < 10; point += 1) {
      const r = point % 2 === 0 ? radius : radius * 0.43;
      const angle = -Math.PI / 2 + (point * Math.PI) / 5;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  formatTime(seconds) {
    const whole = Math.floor(seconds);
    return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
  }

  snapshot() {
    return {
      phase: this.phase,
      stageName: this.stage.name,
      stageNumber: this.stageIndex + 1,
      stageRealm: this.stage.realm,
      accent: this.stage.accent,
      time: this.formatTime(this.stageTime),
      totalTime: this.formatTime(this.totalTime),
      hp: this.player?.hp ?? 5,
      maxHp: this.player?.maxHp ?? 5,
      xp: this.player?.xp ?? 0,
      xpNeeded: this.player?.xpNeeded ?? 6,
      level: this.player?.level ?? 1,
      auto: this.player?.auto ?? true,
      kills: this.kills,
      boss: Boolean(this.boss && this.boss.hp > 0),
      bossName: this.stage.bossName,
      bossHp: this.boss?.hp ?? 0,
      bossMaxHp: this.boss?.maxHp ?? 1,
      toast: this.toastTimer > 0 && this.bossSpawned ? `A guardian appears · ${this.stage.bossName}` : '',
      choices: this.upgradeChoices.map((upgrade) => ({
        id: upgrade.id,
        name: upgrade.name,
        description: upgrade.description,
        icon: upgrade.icon,
        level: (this.player?.upgrades[upgrade.id] ?? 0) + 1,
      })),
      upgrades: this.player?.upgrades ?? {},
    };
  }

  publish(force = false) {
    if (!this.onUI) return;
    const now = performance.now();
    if (!force) this.lastHud = now;
    this.onUI(this.snapshot());
  }
}

export { stages };
