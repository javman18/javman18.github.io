// Bug Invaders: a tiny Space Invaders where the enemies are bugs.
(function () {
  const canvas = document.getElementById("bugGame");
  const wrap = document.getElementById("bugWrap");
  if (!canvas || !wrap) return;

  const ctx = canvas.getContext("2d");
  const css = getComputedStyle(document.documentElement);
  const C = {
    accent: css.getPropertyValue("--accent").trim() || "#C8F560",
    bg: css.getPropertyValue("--surface-2").trim() || "#0F1318",
    text: css.getPropertyValue("--text").trim() || "#EDEFF2",
    muted: css.getPropertyValue("--muted").trim() || "#9AA4B1",
    line: css.getPropertyValue("--line-3").trim() || "#2A323D",
    dot: "#1C222A",
    danger: "#FF6B6B",
  };
  const MONO = "'JetBrains Mono', ui-monospace, monospace";
  const DISPLAY = "'Space Grotesk', system-ui, sans-serif";

  // Enemy rows, top to bottom: harder bugs are worth more.
  const BUGS = [
    { label: "segfault", color: "#FF6B6B", points: 50 },
    { label: "NullRef", color: "#FFB86B", points: 30 },
    { label: "404", color: "#5CC8FF", points: 20 },
    { label: "NaN", color: "#B69CFF", points: 10 },
  ];

  const BEST_KEY = "bugInvadersBest";
  let best = 0;
  try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) {}

  // Logical size: wide layout on desktop, taller narrower layout on phones.
  let W = 800, H = 500, cols = 8;
  let scale = 1;

  let state = "idle"; // idle | playing | paused | over
  let visible = false;
  let rafId = null;
  let last = 0;

  let player, shots, enemies, enemyShots, particles, powerups, leak, formation;
  let score, lives, wave, fireTimer, enemyFireTimer, leakTimer, banner, shield, invuln;

  const keys = { left: false, right: false, fire: false };
  let pointerX = null;
  let pointerFire = false;

  // --- Setup ---
  function pickLayout() {
    const narrow = wrap.clientWidth < 640;
    W = narrow ? 480 : 800;
    H = narrow ? 640 : 500;
    cols = narrow ? 5 : 8;
    canvas.style.aspectRatio = `${W} / ${H}`;
  }

  function resize() {
    if (!wrap.clientWidth) return; // tab hidden
    if (state !== "playing" && state !== "paused") pickLayout();
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const cssH = cssW * (H / W);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    scale = (cssW / W) * dpr;
    draw();
  }

  function resetGame() {
    score = 0;
    lives = 3;
    wave = 0;
    player = { x: W / 2, y: H - 44, w: 44, h: 22, speed: 380 };
    shots = [];
    enemyShots = [];
    particles = [];
    powerups = [];
    leak = null;
    shield = 0;
    invuln = 0;
    fireTimer = 0;
    nextWave();
  }

  function nextWave() {
    wave += 1;
    enemies = [];
    const gap = 12;
    const cellW = (W - 80) / cols;
    const bw = cellW - gap;
    const bh = 26;
    for (let r = 0; r < BUGS.length; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          ...BUGS[r],
          row: r,
          col: c,
          ox: 40 + c * cellW + gap / 2,
          oy: 70 + r * (bh + 14),
          w: bw,
          h: bh,
          alive: true,
        });
      }
    }
    formation = { x: 0, y: Math.min((wave - 1) * 12, 60), dir: 1 };
    enemyShots = [];
    enemyFireTimer = 1.2;
    leakTimer = 10 + Math.random() * 8;
    banner = { text: `WAVE ${wave}`, sub: wave === 1 ? "deploying to prod..." : "new bugs reported", t: 1.6 };
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

  // --- Update ---
  function update(dt) {
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    shield = Math.max(0, shield - dt);
    invuln = Math.max(0, invuln - dt);

    // Player movement
    let dx = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    if (dx) {
      player.x += dx * player.speed * dt;
      pointerX = null;
    } else if (pointerX !== null) {
      const diff = pointerX - player.x;
      player.x += Math.sign(diff) * Math.min(Math.abs(diff), player.speed * 1.4 * dt);
    }
    player.x = Math.max(player.w / 2 + 8, Math.min(W - player.w / 2 - 8, player.x));

    // Player fire
    fireTimer -= dt;
    if ((keys.fire || pointerFire) && fireTimer <= 0 && shots.length < 3 && !banner) {
      shots.push({ x: player.x, y: player.y - 16, vy: -560 });
      fireTimer = 0.26;
    }

    for (const s of shots) s.y += s.vy * dt;
    shots = shots.filter(s => s.y > -20);

    if (!banner) updateEnemies(dt);

    // Enemy shots
    for (const s of enemyShots) s.y += s.vy * dt;
    enemyShots = enemyShots.filter(s => s.y < H + 20);
    for (const s of enemyShots) {
      if (hitPlayer(s.x - 3, s.y - 8, 6, 16)) {
        s.y = H + 100;
        damagePlayer();
      }
    }

    // Power-ups
    for (const p of powerups) p.y += 120 * dt;
    for (const p of powerups) {
      if (hitPlayer(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
        p.y = H + 100;
        applyPowerup(p.kind);
      }
    }
    powerups = powerups.filter(p => p.y < H + 20);

    updateLeak(dt);

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updateEnemies(dt) {
    const alive = enemies.filter(e => e.alive);
    if (!alive.length) {
      nextWave();
      return;
    }

    // Formation speeds up as bugs get squashed and as waves go on.
    const ratio = alive.length / enemies.length;
    const speed = (34 + wave * 8) * (1 + (1 - ratio) * 2.2);
    formation.x += formation.dir * speed * dt;

    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of alive) {
      minX = Math.min(minX, e.ox + formation.x);
      maxX = Math.max(maxX, e.ox + formation.x + e.w);
      maxY = Math.max(maxY, e.oy + formation.y + e.h);
    }
    if ((formation.dir > 0 && maxX > W - 12) || (formation.dir < 0 && minX < 12)) {
      formation.dir *= -1;
      formation.y += 16;
    }
    if (maxY >= player.y - player.h) return gameOver();

    // Player shots vs bugs
    for (const s of shots) {
      for (const e of alive) {
        if (!e.alive) continue;
        const ex = e.ox + formation.x, ey = e.oy + formation.y;
        if (s.x > ex && s.x < ex + e.w && s.y > ey && s.y < ey + e.h) {
          killBug(e);
          s.y = -100;
          break;
        }
      }
    }

    // Bugs fire from the bottom of a random column
    enemyFireTimer -= dt;
    if (enemyFireTimer <= 0) {
      const shooters = {};
      for (const e of alive) {
        if (!shooters[e.col] || e.row > shooters[e.col].row) shooters[e.col] = e;
      }
      const list = Object.values(shooters);
      const e = list[Math.floor(Math.random() * list.length)];
      enemyShots.push({ x: e.ox + formation.x + e.w / 2, y: e.oy + formation.y + e.h, vy: 220 + wave * 18, color: e.color });
      enemyFireTimer = Math.max(0.35, 1.1 - wave * 0.09) * (0.6 + Math.random() * 0.8);
    }
  }

  function updateLeak(dt) {
    if (!leak) {
      leakTimer -= dt;
      if (leakTimer <= 0 && !banner) {
        const fromLeft = Math.random() < 0.5;
        leak = { x: fromLeft ? -40 : W + 40, y: 36, vx: fromLeft ? 90 : -90, r: 10 };
      }
      return;
    }

    // The memory leak grows the longer it lives, and so does its value.
    leak.x += leak.vx * dt;
    leak.r = Math.min(26, leak.r + 4 * dt);
    for (const s of shots) {
      if (Math.hypot(s.x - leak.x, s.y - leak.y) < leak.r + 4) {
        const pts = Math.round(leak.r * 8);
        score += pts;
        burst(leak.x, leak.y, C.accent, 24);
        floatText(leak.x, leak.y, `+${pts}`);
        s.y = -100;
        leak = null;
        leakTimer = 14 + Math.random() * 10;
        return;
      }
    }
    if (leak.x < -60 || leak.x > W + 60) {
      leak = null;
      leakTimer = 14 + Math.random() * 10;
    }
  }

  function killBug(e) {
    e.alive = false;
    score += e.points;
    const cx = e.ox + formation.x + e.w / 2, cy = e.oy + formation.y + e.h / 2;
    burst(cx, cy, e.color, 14);
    if (Math.random() < 0.08) {
      const kind = Math.random() < 0.55 ? "TEST" : "HOTFIX";
      powerups.push({ kind, x: cx, y: cy, w: kind === "TEST" ? 50 : 64, h: 22 });
    }
  }

  function applyPowerup(kind) {
    if (kind === "TEST") {
      shield = 8;
      floatText(player.x, player.y - 30, "unit tests: shield");
    } else {
      enemyShots = [];
      const alive = enemies.filter(e => e.alive).sort(() => Math.random() - 0.5);
      alive.slice(0, 6).forEach(killBug);
      floatText(player.x, player.y - 30, "hotfix deployed");
    }
  }

  function hitPlayer(x, y, w, h) {
    const px = player.x - player.w / 2, py = player.y - player.h / 2;
    return x < px + player.w && x + w > px && y < py + player.h && y + h > py;
  }

  function damagePlayer() {
    if (invuln > 0) return;
    if (shield > 0) {
      shield = 0;
      invuln = 0.6;
      burst(player.x, player.y, C.accent, 12);
      return;
    }
    lives -= 1;
    invuln = 1.5;
    enemyShots = [];
    burst(player.x, player.y, C.danger, 20);
    if (lives <= 0) gameOver();
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
      const v = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.35, color, size: 2 + Math.random() * 3 });
    }
  }

  function floatText(x, y, text) {
    particles.push({ x, y, vx: 0, vy: -40, life: 1.1, text });
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

    drawHud();

    for (const e of enemies) {
      if (!e.alive) continue;
      const x = e.ox + formation.x, y = e.oy + formation.y;
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 1.5;
      roundRect(x, y, e.w, e.h, 6);
      ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.font = `600 12px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(e.label, x + e.w / 2, y + e.h / 2 + 1);
    }

    if (leak) {
      ctx.fillStyle = "rgba(200,245,96,0.12)";
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(leak.x, leak.y, leak.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.accent;
      ctx.font = `600 10px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("leak", leak.x, leak.y + 1);
    }

    for (const p of powerups) {
      ctx.fillStyle = C.accent;
      roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 6);
      ctx.fill();
      ctx.fillStyle = C.bg;
      ctx.font = `600 11px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(p.kind, p.x, p.y + 1);
    }

    ctx.font = `600 18px ${MONO}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.accent;
    for (const s of shots) ctx.fillText(";", s.x, s.y);
    for (const s of enemyShots) {
      ctx.fillStyle = s.color;
      ctx.fillText("!", s.x, s.y);
    }

    // Player: a terminal cursor, blinking while invulnerable
    if (state !== "over" && (invuln === 0 || Math.floor(invuln * 10) % 2 === 0)) {
      ctx.fillStyle = C.accent;
      ctx.font = `700 22px ${MONO}`;
      ctx.fillText(">_", player.x, player.y);
      if (shield > 0) {
        ctx.strokeStyle = shield < 2 && Math.floor(shield * 8) % 2 ? "transparent" : C.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      if (p.text) {
        ctx.fillStyle = C.text;
        ctx.font = `600 12px ${MONO}`;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;

    if (banner) {
      overlayText(banner.text, banner.sub, null, 0);
    }
    if (state === "paused") {
      shade();
      overlayText("PAUSED", "click or press P to resume", null, 0);
    }
    if (state === "over") {
      shade();
      overlayText("BUILD FAILED", `score ${score}  ·  best ${best}`, "press R or click to retry", 0, C.danger);
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

    ctx.textAlign = "right";
    ctx.fillStyle = C.accent;
    ctx.fillText("♥".repeat(Math.max(0, lives)), W - 20, 24);
    ctx.fillStyle = C.muted;
    ctx.fillText(`wave ${wave}`, W - 32 - lives * 14, 24);
  }

  function drawIdle() {
    const cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = C.accent;
    ctx.font = `600 13px ${MONO}`;
    ctx.fillText("$ ./bug-invaders", cx, H * 0.28);

    ctx.fillStyle = C.text;
    ctx.font = `700 ${W < 600 ? 44 : 60}px ${DISPLAY}`;
    ctx.fillText("Bug Invaders", cx, H * 0.38);

    // Point table
    ctx.font = `600 12px ${MONO}`;
    const rowW = W < 600 ? 90 : 120;
    const startX = cx - (rowW * (BUGS.length - 1)) / 2;
    BUGS.forEach((b, i) => {
      const x = startX + i * rowW;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      roundRect(x - 36, H * 0.5 - 13, 72, 26, 6);
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.fillText(b.label, x, H * 0.5 + 1);
      ctx.fillStyle = C.muted;
      ctx.fillText(`${b.points} pts`, x, H * 0.5 + 30);
    });

    ctx.fillStyle = C.accent;
    roundRect(cx - 90, H * 0.66 - 22, 180, 44, 12);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.font = `600 15px ${MONO}`;
    ctx.fillText("Click to play", cx, H * 0.66 + 1);

    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${MONO}`;
    ctx.fillText(W < 600 ? "drag to move · hold to shoot" : "← → / A D move · Space shoot · P pause", cx, H * 0.78);
    if (best) ctx.fillText(`best ${best}`, cx, H * 0.78 + 22);
  }

  function shade() {
    ctx.fillStyle = "rgba(10,12,15,0.86)";
    ctx.fillRect(0, 0, W, H);
  }

  function overlayText(title, sub, hint, dy, color) {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color || C.text;
    ctx.font = `700 ${W < 600 ? 40 : 52}px ${DISPLAY}`;
    ctx.fillText(title, W / 2, H / 2 - 20 + dy);
    ctx.fillStyle = C.muted;
    ctx.font = `600 13px ${MONO}`;
    ctx.fillText(sub, W / 2, H / 2 + 22 + dy);
    if (hint) {
      ctx.fillStyle = C.accent;
      ctx.fillText(hint, W / 2, H / 2 + 50 + dy);
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // --- Input ---
  function toLogicalX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * W;
  }

  function primaryAction() {
    if (state === "idle" || state === "over") start();
    else if (state === "paused") setState("playing");
  }

  window.addEventListener("keydown", (e) => {
    if (!visible) return;
    const k = e.key;
    if (state === "playing") {
      if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = true;
      else if (k === "ArrowRight" || k === "d" || k === "D") keys.right = true;
      else if (k === " " || k === "ArrowUp" || k === "w" || k === "W") keys.fire = true;
      else if (k === "p" || k === "P" || k === "Escape") setState("paused");
      else return;
      e.preventDefault();
    } else if (k === "Enter" || ((k === "r" || k === "R") && state === "over") || ((k === "p" || k === "P") && state === "paused")) {
      e.preventDefault();
      primaryAction();
    }
  });

  window.addEventListener("keyup", (e) => {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a" || k === "A") keys.left = false;
    if (k === "ArrowRight" || k === "d" || k === "D") keys.right = false;
    if (k === " " || k === "ArrowUp" || k === "w" || k === "W") keys.fire = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (state === "playing") pointerX = toLogicalX(e.clientX);
  });
  canvas.addEventListener("mousedown", (e) => {
    if (state !== "playing") return primaryAction();
    pointerX = toLogicalX(e.clientX);
    pointerFire = true;
  });
  window.addEventListener("mouseup", () => { pointerFire = false; });

  canvas.addEventListener("touchstart", (e) => {
    if (state !== "playing") {
      e.preventDefault();
      return primaryAction();
    }
    e.preventDefault();
    pointerX = toLogicalX(e.touches[0].clientX);
    pointerFire = true;
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    if (state !== "playing") return;
    e.preventDefault();
    pointerX = toLogicalX(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener("touchend", () => { pointerFire = false; });

  // Pause automatically when the game scrolls out of view or the tab is hidden.
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
