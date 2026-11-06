// Zombie XR Survival: top-down arena where zombies hunt you with steering behaviors
// (seek + separation + a bit of wander), the same technique as my RTS Agent Generator.
(function () {
  const canvas = document.getElementById("zombieGame");
  const wrap = document.getElementById("zombieWrap");
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const C = {
    accent: css.getPropertyValue("--accent").trim() || "#C8F560",
    bg: css.getPropertyValue("--surface-2").trim() || "#0F1318",
    text: css.getPropertyValue("--text").trim() || "#EDEFF2",
    muted: css.getPropertyValue("--muted").trim() || "#9AA4B1",
    dot: "#1C222A",
    danger: "#FF6B6B",
    seek: "#5CC8FF",
    separate: "#FFB86B",
  };
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const DISPLAY = "'Space Grotesk', system-ui, sans-serif";

  const TYPES = {
    walker: { label: "walker", color: "#B69CFF", r: 11, speed: 52, force: 140, hp: 1, points: 10 },
    runner: { label: "runner", color: "#FFB86B", r: 9, speed: 108, force: 260, hp: 1, points: 20 },
    tank: { label: "tank", color: "#FF6B6B", r: 18, speed: 34, force: 90, hp: 6, points: 60 },
  };

  const BEST_KEY = "zombieXrBest";
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}

  let W = 800, H = 500, narrow = false;
  let scale = 1;

  let state = "idle"; // idle | playing | paused | over
  let visible = false;
  let rafId = null;
  let last = 0;
  let showVectors = false;

  let player, bullets, zombies, particles, pickups;
  let score, kills, wave, toSpawn, spawnTimer, fireTimer, rapid, invuln, banner;

  const keys = { up: false, down: false, left: false, right: false };
  let aim = { x: 0, y: 0 };
  let firing = false;

  // --- Setup ---
  function pickLayout() {
    narrow = wrap.clientWidth < 640;
    W = narrow ? 480 : 800;
    H = narrow ? 640 : 500;
    canvas.style.aspectRatio = `${W} / ${H}`;
  }

  function resize() {
    if (!wrap.clientWidth) return; // tab hidden
    if (state !== "playing" && state !== "paused") pickLayout();
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssW * (H / W) * dpr);
    scale = (cssW / W) * dpr;
    draw();
  }

  function resetGame() {
    player = { x: W / 2, y: H / 2, r: 11, hp: 100, speed: 210 };
    aim = { x: W / 2, y: H / 2 - 100 };
    bullets = [];
    zombies = [];
    particles = [];
    pickups = [];
    score = 0;
    kills = 0;
    wave = 0;
    fireTimer = 0;
    rapid = 0;
    invuln = 0;
    nextWave();
  }

  function nextWave() {
    wave += 1;
    toSpawn = 6 + wave * 4;
    spawnTimer = 0;
    banner = { text: `WAVE ${wave}`, sub: wave === 1 ? "headset on. survive." : `${toSpawn} incoming`, t: 1.8 };
  }

  function spawnZombie() {
    const roll = Math.random();
    let type = TYPES.walker;
    if (wave >= 3 && roll < 0.12) type = TYPES.tank;
    else if (wave >= 2 && roll < 0.42) type = TYPES.runner;

    // Spawn just outside a random edge.
    const side = Math.floor(Math.random() * 4);
    const m = 30;
    const x = side === 0 ? -m : side === 1 ? W + m : Math.random() * W;
    const y = side === 2 ? -m : side === 3 ? H + m : Math.random() * H;
    const speedBoost = 1 + Math.min(wave - 1, 8) * 0.05;

    zombies.push({
      ...type,
      x, y, vx: 0, vy: 0,
      maxSpeed: type.speed * speedBoost * (0.85 + Math.random() * 0.3),
      hp: type.hp,
      maxHp: type.hp,
      wander: Math.random() * Math.PI * 2,
      hit: 0,
      seekF: { x: 0, y: 0 },
      sepF: { x: 0, y: 0 },
    });
  }

  // --- Loop ---
  function start() {
    resetGame();
    setState("playing");
  }

  function setState(next) {
    state = next;
    canvas.style.touchAction = state === "playing" ? "none" : "auto";
    if (state === "playing") {
      if (!rafId) {
        last = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      firing = false;
      draw();
    }
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    rafId = state === "playing" ? requestAnimationFrame(tick) : null;
  }

  // --- Steering ---
  function limit(v, max) {
    const m = Math.hypot(v.x, v.y);
    if (m > max) { v.x = (v.x / m) * max; v.y = (v.y / m) * max; }
    return v;
  }

  function seek(z, tx, ty) {
    const dx = tx - z.x, dy = ty - z.y;
    const d = Math.hypot(dx, dy) || 1;
    return limit({ x: (dx / d) * z.maxSpeed - z.vx, y: (dy / d) * z.maxSpeed - z.vy }, z.force);
  }

  function separate(z) {
    let sx = 0, sy = 0, n = 0;
    for (const o of zombies) {
      if (o === z) continue;
      const dx = z.x - o.x, dy = z.y - o.y;
      const d = Math.hypot(dx, dy);
      const range = (z.r + o.r) * 1.6;
      if (d > 0 && d < range) {
        sx += (dx / d) / d;
        sy += (dy / d) / d;
        n++;
      }
    }
    if (!n) return { x: 0, y: 0 };
    const m = Math.hypot(sx, sy) || 1;
    return limit({ x: (sx / m) * z.maxSpeed - z.vx, y: (sy / m) * z.maxSpeed - z.vy }, z.force * 1.5);
  }

  // --- Update ---
  function update(dt) {
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    invuln = Math.max(0, invuln - dt);
    rapid = Math.max(0, rapid - dt);

    // Player movement (keyboard only; on touch you hold your ground)
    let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
    if (mx || my) {
      const m = Math.hypot(mx, my);
      player.x += (mx / m) * player.speed * dt;
      player.y += (my / m) * player.speed * dt;
      player.x = Math.max(player.r, Math.min(W - player.r, player.x));
      player.y = Math.max(player.r + 40, Math.min(H - player.r, player.y));
    }

    // Shooting
    fireTimer -= dt;
    if (firing && fireTimer <= 0) {
      const dx = aim.x - player.x, dy = aim.y - player.y;
      const d = Math.hypot(dx, dy) || 1;
      const spread = (Math.random() - 0.5) * 0.06;
      const a = Math.atan2(dy, dx) + spread;
      bullets.push({ x: player.x + (dx / d) * 16, y: player.y + (dy / d) * 16, vx: Math.cos(a) * 720, vy: Math.sin(a) * 720, life: 0.9 });
      fireTimer = rapid > 0 ? 0.07 : 0.15;
    }

    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }

    // Spawning
    if (!banner && toSpawn > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnZombie();
        toSpawn--;
        spawnTimer = Math.max(0.18, 0.9 - wave * 0.07) * (0.5 + Math.random());
      }
    }

    // Zombies: seek the player, keep apart from each other, wander a little.
    for (const z of zombies) {
      const s = seek(z, player.x, player.y);
      const p = separate(z);
      z.wander += (Math.random() - 0.5) * 3 * dt;
      const wx = Math.cos(z.wander) * z.force * 0.15;
      const wy = Math.sin(z.wander) * z.force * 0.15;
      z.seekF = s;
      z.sepF = p;
      z.vx += (s.x + p.x * 1.4 + wx) * dt;
      z.vy += (s.y + p.y * 1.4 + wy) * dt;
      const v = limit({ x: z.vx, y: z.vy }, z.maxSpeed);
      z.vx = v.x;
      z.vy = v.y;
      z.x += z.vx * dt;
      z.y += z.vy * dt;
      z.hit = Math.max(0, z.hit - dt);

      // Bite
      const d = Math.hypot(z.x - player.x, z.y - player.y);
      if (d < z.r + player.r) {
        if (invuln === 0) {
          player.hp -= z.label === "tank" ? 30 : 18;
          invuln = 0.8;
          burst(player.x, player.y, C.danger, 14);
          if (player.hp <= 0) return gameOver();
        }
        // Knock the zombie back so it doesn't stick to you.
        const k = 60 / (d || 1);
        z.x += (z.x - player.x) * k * dt * 6;
        z.y += (z.y - player.y) * k * dt * 6;
        z.vx *= -0.4;
        z.vy *= -0.4;
      }
    }

    // Bullets vs zombies
    for (const b of bullets) {
      if (b.life <= 0) continue;
      for (const z of zombies) {
        if (z.hp <= 0) continue;
        if (Math.hypot(b.x - z.x, b.y - z.y) < z.r + 3) {
          z.hp -= 1;
          z.hit = 0.08;
          z.vx += b.vx * 0.04;
          z.vy += b.vy * 0.04;
          b.life = 0;
          burst(b.x, b.y, z.color, 4);
          if (z.hp <= 0) killZombie(z);
          break;
        }
      }
    }
    bullets = bullets.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20);
    zombies = zombies.filter(z => z.hp > 0);

    // Pickups
    for (const p of pickups) {
      p.t -= dt;
      if (Math.hypot(p.x - player.x, p.y - player.y) < player.r + 16) {
        p.t = 0;
        if (p.kind === "MEDKIT") {
          player.hp = Math.min(100, player.hp + 35);
          floatText(player.x, player.y - 24, "+35 hp");
        } else {
          rapid = 6;
          floatText(player.x, player.y - 24, "rapid fire");
        }
      }
    }
    pickups = pickups.filter(p => p.t > 0);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    if (!banner && toSpawn === 0 && zombies.length === 0) nextWave();
  }

  function killZombie(z) {
    kills++;
    score += z.points;
    burst(z.x, z.y, z.color, z.label === "tank" ? 26 : 14);
    if (Math.random() < 0.07) {
      pickups.push({ kind: Math.random() < 0.5 ? "MEDKIT" : "RAPID", x: z.x, y: z.y, t: 8 });
    }
  }

  function gameOver() {
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    setState("over");
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 50 + Math.random() * 170;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.35, color, size: 2 + Math.random() * 3 });
    }
  }

  function floatText(x, y, text) {
    particles.push({ x, y, vx: 0, vy: -36, life: 1.1, text });
  }

  // --- Draw ---
  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.dot;
    for (let x = 11; x < W; x += 22) {
      for (let y = 11; y < H; y += 22) ctx.fillRect(x, y, 1.2, 1.2);
    }

    if (state === "idle") return drawIdle();

    for (const p of pickups) {
      if (p.t < 2 && Math.floor(p.t * 8) % 2) continue;
      ctx.fillStyle = C.accent;
      roundRect(p.x - 30, p.y - 11, 60, 22, 6);
      ctx.fill();
      ctx.fillStyle = C.bg;
      ctx.font = `600 11px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.kind, p.x, p.y + 1);
    }

    for (const z of zombies) {
      ctx.fillStyle = z.hit > 0 ? C.text : hexAlpha(z.color, 0.18);
      ctx.strokeStyle = z.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes look where the zombie is heading.
      const h = Math.atan2(z.vy, z.vx);
      ctx.fillStyle = z.color;
      for (const side of [-0.5, 0.5]) {
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(h + side) * z.r * 0.55, z.y + Math.sin(h + side) * z.r * 0.55, Math.max(1.6, z.r * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }

      if (z.maxHp > 1) {
        ctx.strokeStyle = z.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * z.hp) / z.maxHp);
        ctx.stroke();
      }

      if (showVectors) {
        vector(z.x, z.y, z.vx * 0.5, z.vy * 0.5, C.text);
        vector(z.x, z.y, z.seekF.x * 0.25, z.seekF.y * 0.25, C.seek);
        vector(z.x, z.y, z.sepF.x * 0.25, z.sepF.y * 0.25, C.separate);
      }
    }

    // Bullets
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
      ctx.stroke();
    }

    // Player with aim line
    if (state !== "over" && (invuln === 0 || Math.floor(invuln * 12) % 2 === 0)) {
      const a = Math.atan2(aim.y - player.y, aim.x - player.x);
      ctx.strokeStyle = hexAlpha(C.accent, 0.35);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(a) * 18, player.y + Math.sin(a) * 18);
      ctx.lineTo(player.x + Math.cos(a) * 90, player.y + Math.sin(a) * 90);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(a) * 18, player.y + Math.sin(a) * 18);
      ctx.stroke();
      if (rapid > 0) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, player.r + 6, 0, Math.PI * 2 * (rapid / 6));
        ctx.stroke();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.text) {
        ctx.fillStyle = C.text;
        ctx.font = `600 12px ${MONO}`;
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    drawHud();

    if (banner) overlayText(banner.text, banner.sub, null);
    if (state === "paused") {
      shade();
      overlayText("PAUSED", "click or press P to resume", null);
    }
    if (state === "over") {
      shade();
      overlayText("SESSION ENDED", `score ${score}  ·  ${kills} kills  ·  best ${best}`, "press R or click to retry", C.danger);
    }
  }

  function drawHud() {
    ctx.font = `600 13px ${MONO}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = C.muted;
    ctx.fillText("score", 20, 24);
    ctx.fillStyle = C.text;
    ctx.fillText(String(score).padStart(6, "0"), 68, 24);

    // HP bar
    const bw = narrow ? 90 : 140;
    const bx = W - 20 - bw;
    ctx.fillStyle = "#232A33";
    roundRect(bx, 18, bw, 12, 6);
    ctx.fill();
    ctx.fillStyle = player.hp > 35 ? C.accent : C.danger;
    roundRect(bx, 18, Math.max(0, (bw * player.hp) / 100), 12, 6);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = C.muted;
    ctx.fillText(`wave ${wave}`, bx - 14, 24);

    if (showVectors && !narrow) {
      ctx.textAlign = "left";
      ctx.font = `400 11px ${MONO}`;
      ctx.fillStyle = C.seek;
      ctx.fillText("— seek", 20, H - 44);
      ctx.fillStyle = C.separate;
      ctx.fillText("— separation", 20, H - 28);
      ctx.fillStyle = C.text;
      ctx.fillText("— velocity", 20, H - 12);
    }
  }

  function drawIdle() {
    const cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = C.accent;
    ctx.font = `600 13px ${MONO}`;
    ctx.fillText("$ ./zombie-xr --survive", cx, H * 0.26);

    ctx.fillStyle = C.text;
    ctx.font = `700 ${narrow ? 44 : 60}px ${DISPLAY}`;
    ctx.fillText("Zombie XR", cx, H * 0.36);

    ctx.font = `600 12px ${MONO}`;
    const list = Object.values(TYPES);
    const gap = narrow ? 120 : 150;
    const startX = cx - (gap * (list.length - 1)) / 2;
    list.forEach((t, i) => {
      const x = startX + i * gap;
      ctx.fillStyle = hexAlpha(t.color, 0.18);
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(x, H * 0.48, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.fillText(t.label, x, H * 0.48 + 32);
      ctx.fillStyle = C.muted;
      ctx.fillText(`${t.points} pts`, x, H * 0.48 + 50);
    });

    ctx.fillStyle = C.accent;
    roundRect(cx - 90, H * 0.66 - 22, 180, 44, 12);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.font = `600 15px ${MONO}`;
    ctx.fillText("Click to play", cx, H * 0.66 + 1);

    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${MONO}`;
    ctx.fillText(narrow ? "touch to aim · hold to shoot" : "WASD move · mouse aim · hold click shoot · V vectors · P pause", cx, H * 0.78);
    if (best) ctx.fillText(`best ${best}`, cx, H * 0.78 + 22);
  }

  function vector(x, y, vx, vy, color) {
    if (Math.hypot(vx, vy) < 1) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + vx, y + vy);
    ctx.stroke();
  }

  function shade() {
    ctx.fillStyle = "rgba(10,12,15,0.86)";
    ctx.fillRect(0, 0, W, H);
  }

  function overlayText(title, sub, hint, color) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color || C.text;
    ctx.font = `700 ${narrow ? 38 : 52}px ${DISPLAY}`;
    ctx.fillText(title, W / 2, H / 2 - 20);
    ctx.fillStyle = C.muted;
    ctx.font = `600 13px ${MONO}`;
    ctx.fillText(sub, W / 2, H / 2 + 22);
    if (hint) {
      ctx.fillStyle = C.accent;
      ctx.fillText(hint, W / 2, H / 2 + 50);
    }
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function hexAlpha(hex, a) {
    const n = parseInt(hex.replace("#", ""), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // --- Input ---
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((clientX - rect.left) / rect.width) * W, y: ((clientY - rect.top) / rect.height) * H };
  }

  function primaryAction() {
    if (state === "idle" || state === "over") start();
    else if (state === "paused") setState("playing");
  }

  const MOVE_KEYS = {
    w: "up", W: "up", ArrowUp: "up",
    s: "down", S: "down", ArrowDown: "down",
    a: "left", A: "left", ArrowLeft: "left",
    d: "right", D: "right", ArrowRight: "right",
  };

  window.addEventListener("keydown", (e) => {
    if (!visible) return;
    const k = e.key;
    if (state === "playing") {
      if (MOVE_KEYS[k]) keys[MOVE_KEYS[k]] = true;
      else if (k === " ") firing = true;
      else if (k === "v" || k === "V") showVectors = !showVectors;
      else if (k === "p" || k === "P" || k === "Escape") setState("paused");
      else return;
      e.preventDefault();
    } else if (k === "Enter" || ((k === "r" || k === "R") && state === "over") || ((k === "p" || k === "P") && state === "paused")) {
      e.preventDefault();
      primaryAction();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (MOVE_KEYS[e.key]) keys[MOVE_KEYS[e.key]] = false;
    if (e.key === " ") firing = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (state === "playing") aim = toLogical(e.clientX, e.clientY);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return primaryAction();
    aim = toLogical(e.clientX, e.clientY);
    firing = true;
  });
  window.addEventListener("mouseup", () => { firing = false; });

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (state !== "playing") return primaryAction();
    aim = toLogical(e.touches[0].clientX, e.touches[0].clientY);
    firing = true;
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    if (state !== "playing") return;
    e.preventDefault();
    aim = toLogical(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });
  canvas.addEventListener("touchend", () => { firing = false; });

  // Pause automatically when the game scrolls out of view, its tab is hidden, or the page is hidden.
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (!visible && state === "playing") setState("paused");
  }, { threshold: 0.35 }).observe(canvas);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") setState("paused");
  });

  new ResizeObserver(resize).observe(wrap);
  document.fonts?.ready.then(draw);
  resize();
})();
