// Helpers
async function fetchProjects() {
  const response = await fetch("./projects.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load projects.json (HTTP ${response.status})`);
  return await response.json();
}

function slugify(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inferTags(project) {
  const source = [
    project.title || "",
    project.description || "",
    Array.isArray(project.details) ? project.details.join(" ") : "",
    Array.isArray(project.responsibilities) ? project.responsibilities.join(" ") : "",
  ]
    .join(" ")
    .toLowerCase();

  const tags = [];
  if (source.includes("vr")) tags.push("VR");
  if (source.includes("cave")) tags.push("CAVE");
  if (source.includes("addressable")) tags.push("Addressables");
  if (source.includes("behavior tree") || source.includes("behaviour tree")) tags.push("Behavior Trees");
  if (source.includes("firebase")) tags.push("Firebase");
  if (source.includes("mobile") || source.includes("android") || source.includes("ios") || source.includes("app store") || source.includes("google play")) tags.push("Mobile");
  if (source.includes("timeline")) tags.push("Timeline");
  if (source.includes("pathfinding") || source.includes("a*")) tags.push("Pathfinding");
  if (source.includes(" ai ")) tags.push("AI");
  if (source.includes(" rag ") || source.includes("rag chatbot")) tags.push("RAG");
  if (source.includes("llms") || source.includes("llm")) tags.push("LLM");
  return [...new Set(tags)].slice(0, 5);
}

// --- Media helpers ---
function mediaType(m) {
  const url = (m?.url || "").toLowerCase();
  if (m?.type) return m.type; // "video" | "image"
  if (url.endsWith(".mp4") || url.endsWith(".webm")) return "video";
  return "image";
}

function firstMedia(project) {
  return project.media && project.media.length ? project.media[0] : null;
}

function renderMedia(m, { controls = false } = {}) {
  if (mediaType(m) === "video") {
    return controls
      ? `<video controls playsinline preload="metadata"><source src="${esc(m.url)}" type="video/mp4"></video>`
      : `<video autoplay loop muted playsinline preload="metadata"><source src="${esc(m.url)}" type="video/mp4"></video>`;
  }
  return `<img src="${esc(m.url)}" alt="${esc(m.label || "")}" loading="lazy">`;
}

// --- Marquee ---
const SKILLS = [
  "C# / .NET", "Unity", "XR (VR/AR/Quest)", "Python", "LLMs", "RAG",
  "LLM Evaluation", "Mobile (Android/iOS)", "Firebase", "Performance Optimization", "QA / Testing", "Git",
];

function renderMarquee() {
  const el = document.getElementById("marquee");
  if (!el) return;
  const run = SKILLS.map(s => `<span>${esc(s)}</span><span class="acc">✦</span>`).join("");
  el.innerHTML = run + run; // duplicated so the -50% loop is seamless
}

// --- Projects ---
// Team projects first, in this order; anything not listed keeps its JSON order after these.
const TEAM_PRIORITY = [
  "Sedena: Exposure Therapies",
  "TEC: Virtual Factory",
  "TIST: WhatsApp RAG Chatbot",
  "LLM Personality Evaluation Framework",
  "Bimbo: Professional Driver Workshop",
  "Yeltic App",
  "ILCE: We Are the Future",
];

let allProjects = [];
let currentFilter = "all";

function byPriority(list, priority) {
  return [...list].sort((a, b) => {
    const ai = priority.indexOf(a.title);
    const bi = priority.indexOf(b.title);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

function renderProjects() {
  const grid = document.getElementById("projectGrid");
  if (!grid) return;

  const list = currentFilter === "all"
    ? allProjects
    : allProjects.filter(p => p._kind === currentFilter);

  grid.innerHTML = list.map((p) => {
    const thumb = firstMedia(p);
    const tags = inferTags(p);
    const kind = tags.slice(0, 2).join(" · ") || (p._kind === "team" ? "Team" : "Solo");
    const num = String(allProjects.indexOf(p) + 1).padStart(2, "0");

    return `
      <article class="card project">
        <button type="button" class="project-media ${thumb ? "" : "empty dots"}" data-open="${esc(p.id)}" aria-label="Open ${esc(p.title)}">
          ${thumb ? renderMedia(thumb) : ""}
          <span class="project-media-overlay">
            <span class="project-num">${num}</span>
            <span class="kind">${esc(kind)}</span>
          </span>
        </button>
        <div class="project-body">
          <span class="project-client">${p._kind === "team" ? "Team project" : "Solo project"}</span>
          <h3>${esc(p.title)}</h3>
          <p class="project-desc">${esc((p.description || "").split("\n")[0])}</p>
          <div class="project-foot">
            <div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>
            <button type="button" class="link-btn" data-open="${esc(p.id)}">View details →</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll("[data-filter]").forEach(b => {
    b.setAttribute("aria-pressed", String(b.dataset.filter === filter));
  });
  renderProjects();
}

// --- Game tabs ---
// Hiding a panel also pauses its game (each game pauses itself when its canvas leaves view).
function setGameTab(game) {
  document.querySelectorAll("[data-game]").forEach(b => {
    b.setAttribute("aria-pressed", String(b.dataset.game === game));
  });
  document.querySelectorAll(".game-panel").forEach(p => {
    p.classList.toggle("hidden", p.dataset.panel !== game);
  });
}

// --- Project modal ---
function openProject(id) {
  const p = allProjects.find(x => x.id === id);
  const modal = document.getElementById("projectModal");
  const body = document.getElementById("projectModalBody");
  if (!p || !modal || !body) return;

  document.getElementById("projectModalTitle").textContent = p.title || "";

  const details = Array.isArray(p.details) ? p.details : [];
  const responsibilities = Array.isArray(p.responsibilities) ? p.responsibilities : [];
  const media = Array.isArray(p.media) ? p.media : [];
  const code = Array.isArray(p.codeBlocks) ? p.codeBlocks : [];

  body.innerHTML = `
    <section>
      <h4>Description</h4>
      ${(p.description || "").split("\n").filter(Boolean).map(l => `<p>${esc(l)}</p>`).join("")}
      ${details.map(d => `<p>${esc(d)}</p>`).join("")}
    </section>

    ${media.length ? `
      <section>
        <h4>Media</h4>
        <div class="media-grid">
          ${media.map(m => `
            <figure class="media-item">
              ${renderMedia(m, { controls: true })}
              ${m.label ? `<figcaption>${esc(m.label)}</figcaption>` : ""}
            </figure>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${responsibilities.length ? `
      <section>
        <h4>Key Responsibilities</h4>
        <ul>${responsibilities.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
      </section>
    ` : ""}

    ${code.length ? `
      <section>
        <h4>Sample Code</h4>
        ${code.map((c, i) => `
          <div class="code-block">
            <div class="code-block-head">
              <span>${esc(c.label || "")}</span>
              <button type="button" class="small-btn" data-copy="code_${i}">Copy</button>
            </div>
            <pre id="code_${i}">${esc(c.code || "")}</pre>
          </div>
        `).join("")}
      </section>
    ` : ""}
  `;

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modal.scrollTop = 0;
}

function closeProject() {
  const modal = document.getElementById("projectModal");
  const body = document.getElementById("projectModalBody");
  if (body) body.innerHTML = "";
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";
}

async function copyCode(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  await navigator.clipboard.writeText(el.innerText);
  const old = btn.textContent;
  btn.textContent = "Copied!";
  setTimeout(() => (btn.textContent = old), 900);
}

// --- Events ---
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open]");
  if (open) return openProject(open.dataset.open);

  const gameTab = e.target.closest("[data-game]");
  if (gameTab) return setGameTab(gameTab.dataset.game);

  const filter = e.target.closest("[data-filter]");
  if (filter) return setFilter(filter.dataset.filter);

  const copy = e.target.closest("[data-copy]");
  if (copy) return copyCode(copy.dataset.copy, copy);

  if (e.target.id === "projectModalClose" || e.target.id === "projectModal") closeProject();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProject();
});

// Boot
document.addEventListener("DOMContentLoaded", async () => {
  renderMarquee();

  try {
    const data = await fetchProjects();

    const solo = (data.soloProjects || []).map(p => ({ ...p, _kind: "solo" }));
    const team = (data.teamProjects || []).map(p => ({
      ...p,
      id: p.id || `team_${slugify(p.title)}`,
      _kind: "team",
    }));

    allProjects = [...byPriority(team, TEAM_PRIORITY), ...solo];

    document.getElementById("statTeam").textContent = team.length;
    document.getElementById("statSolo").textContent = solo.length;

    renderProjects();
  } catch (err) {
    console.error("ERROR fetch projects:", err);
    document.getElementById("projectGrid").innerHTML =
      `<p class="section-note">Could not load project data: ${esc(err.message)}</p>`;
  }
});
