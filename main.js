// Helpers
window.toggleSection = function(id) {
  const content = document.getElementById(id);
  if (content) content.classList.toggle("hidden");
};

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

function inferTags(project) {
  const source = [
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
  if (source.includes(" rag ")) tags.push("RAG");
  if (source.includes("llms") || source.includes("llm")) tags.push("LLM");
  return [...new Set(tags)].slice(0, 5);
}

// --- Media helpers (NEW) ---
function mediaType(m) {
  const url = (m?.url || "").toLowerCase();
  if (m?.type) return m.type; // "video" | "image"
  if (url.endsWith(".mp4") || url.endsWith(".webm")) return "video";
  return "image";
}

function firstMedia(project) {
  return project.media && project.media.length ? project.media[0] : null;
}

function renderMediaThumb(m, className = "w-full h-40 object-cover border-b border-gray-800") {
  const type = mediaType(m);

  if (type === "video") {
    // NOTE: assumes MP4 (fine for your case). If you use webm, add another <source>.
    return `
      <video class="${className}" autoplay loop muted playsinline preload="metadata">
        <source src="${m.url}" type="video/mp4">
      </video>
    `;
  }

  return `<img src="${m.url}" class="${className}" alt="${m.label || ""}">`;
}

// --- Modal open (NEW) ---
// Requires your HTML to have: #mediaModal, #mediaModalTitle, #mediaModalBody
window.openMedia = function(title, url, type = "image") {
  const modal = document.getElementById("mediaModal");
  const modalTitle = document.getElementById("mediaModalTitle");
  const modalBody = document.getElementById("mediaModalBody");

  if (!modal || !modalTitle || !modalBody) {
    // Fallback: open in new tab if no modal exists
    window.open(url, "_blank");
    return;
  }

  modalTitle.textContent = title || "";

  if (type === "video") {
    modalBody.innerHTML = `
      <video controls autoplay class="w-full rounded-xl">
        <source src="${url}" type="video/mp4">
      </video>
    `;
  } else {
    modalBody.innerHTML = `
      <img src="${url}" class="w-full rounded-xl" alt="${title || ""}">
    `;
  }

  modal.classList.remove("hidden");
};

window.closeMedia = function() {
  const modal = document.getElementById("mediaModal");
  const modalBody = document.getElementById("mediaModalBody");
  if (modalBody) modalBody.innerHTML = "";
  if (modal) modal.classList.add("hidden");
};

// Optional: close modal with ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") window.closeMedia?.();
});

function renderFeatured(projects) {
  const featuredEl = document.getElementById("featured");
  if (!featuredEl) return;

  const priority = ["Play & Learn", "TEC: Virtual Factory", "Bimbo: Professional Driver Workshop"];
  const sorted = [...projects].sort((a, b) => {
    const ai = priority.indexOf(a.title);
    const bi = priority.indexOf(b.title);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const picked = sorted.slice(0, 3);

  featuredEl.innerHTML = picked.map((p) => {
    const thumb = firstMedia(p);
    const tags = inferTags(p);
    const safeTitle = (p.title || "").replace(/'/g, "\\'");

    return `
      <div class="rounded-2xl border border-gray-800 bg-gray-950/40 overflow-hidden hover:shadow-glow transition">
        ${thumb ? `
          <button class="w-full" onclick="openMedia('${safeTitle}', '${thumb.url}', '${mediaType(thumb)}')">
            ${renderMediaThumb(thumb, "w-full h-40 object-cover border-b border-gray-800")}
          </button>
        ` : `
          <div class="h-40 border-b border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950"></div>
        `}
        <div class="p-4">
          <p class="font-semibold text-gray-100">${p.title || ""}</p>
          <p class="text-sm text-gray-400 mt-1 line-clamp-3">${(p.description || "").split("\n")[0]}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${tags.map(tag => `<span class="text-xs px-2 py-1 rounded-full border border-gray-800 bg-gray-900/50 text-gray-200">${tag}</span>`).join("")}
          </div>
          <div class="mt-4">
            <button class="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
              onclick="document.querySelector('.tab-btn[data-tab=\\'${p._tab || "projects"}\\']')?.click();
              setTimeout(()=>{
                  const el = document.getElementById('${p.id}');
                  if (el) {
                    el.classList.remove('hidden');
                    el.scrollIntoView({behavior:'smooth', block:'start'});
                  }
              }, 80);">
              View details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderSoloProjects(projects) {
  const section = document.getElementById("projects");
  if (!section) return;

  section.innerHTML = `
    <div class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
      <h2 class="text-2xl font-bold text-blue-300">Solo Projects</h2>
      <p class="text-gray-300 mt-2">Personal projects showcasing gameplay, tools, and systems design.</p>
    </div>
  `;

  projects.forEach((proj, idx) => {
    const thumb = firstMedia(proj);
    const tags = inferTags(proj);
    const safeTitle = (proj.title || "").replace(/'/g, "\\'");

    section.innerHTML += `
      <article class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow overflow-hidden">
        <div class="grid md:grid-cols-[220px_1fr] gap-0">
          <div class="border-b md:border-b-0 md:border-r border-gray-800 bg-gray-950/40">
            ${thumb ? `
              <button class="w-full" onclick="openMedia('${safeTitle}', '${thumb.url}', '${mediaType(thumb)}')">
                ${renderMediaThumb(thumb, "w-full h-44 md:h-full object-cover")}
              </button>
            ` : `
              <div class="w-full h-44 md:h-full bg-gradient-to-br from-gray-900 to-gray-950"></div>
            `}
          </div>

          <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-100">${proj.title || ""}</h3>
                <p class="text-gray-400 mt-2">${(proj.description || "").split("\n")[0]}</p>

                <div class="mt-3 flex flex-wrap gap-2">
                  ${tags.map(tag => `<span class="text-xs px-2 py-1 rounded-full border border-gray-800 bg-gray-950/40 text-gray-200">${tag}</span>`).join("")}
                </div>
              </div>

              <div class="flex gap-2">
                <button onclick="toggleSection('${proj.id}')"
                        class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition">
                  Details
                </button>
              </div>
            </div>

            <div id="${proj.id}" class="hidden mt-6 space-y-6">
              <section class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
                <div class="flex items-center justify-between">
                  <h4 class="font-semibold text-gray-100">Description</h4>
                  <button onclick="toggleSection('desc${idx}')"
                          class="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                    Toggle
                  </button>
                </div>
                <div id="desc${idx}" class="mt-3">
                  <p class="text-gray-300 leading-relaxed">${(proj.description || "").replace(/\n/g, "<br>")}</p>
                </div>
              </section>

              ${(proj.media && proj.media.length) ? `
                <section class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
                  <div class="flex items-center justify-between">
                    <h4 class="font-semibold text-gray-100">Media</h4>
                    <button onclick="toggleSection('media${idx}')"
                            class="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                      Toggle
                    </button>
                  </div>

                  <div id="media${idx}" class="mt-4 grid md:grid-cols-2 gap-4">
                    ${proj.media.map(m => `
                      <button class="text-left rounded-xl border border-gray-800 bg-gray-900/30 hover:bg-gray-900/60 overflow-hidden transition"
                              onclick="openMedia('${(m.label || proj.title || "").replace(/'/g, "\\'")}', '${m.url}', '${mediaType(m)}')">
                        ${renderMediaThumb(m, "w-full h-40 object-cover border-b border-gray-800")}
                        <div class="p-3">
                          <p class="text-sm font-semibold text-gray-100">${m.label || ""}</p>
                          <p class="text-xs text-gray-400 mt-1">Click to expand</p>
                        </div>
                      </button>
                    `).join("")}
                  </div>
                </section>
              ` : ""}

              ${(proj.codeBlocks && proj.codeBlocks.length) ? `
                <section class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
                  <div class="flex items-center justify-between">
                    <h4 class="font-semibold text-gray-100">Sample Code</h4>
                    <button onclick="toggleSection('codeBlock${idx}')"
                            class="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                      Toggle All
                    </button>
                  </div>

                  <div id="codeBlock${idx}" class="mt-4 space-y-4">
                    ${proj.codeBlocks.map((c, cidx) => {
                      const codeId = `code_${idx}_${cidx}`;
                      const codeText = (c.code || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                      return `
                        <div class="rounded-xl border border-gray-800 bg-black/40 overflow-hidden">
                          <div class="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                            <p class="text-sm font-semibold text-gray-100">${c.label || ""}</p>
                            <div class="flex gap-2">
                              <button onclick="toggleSection('${codeId}')"
                                      class="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                                Toggle
                              </button>
                              <button data-copy="${codeId}" onclick="copyCode('${codeId}')"
                                      class="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white">
                                Copy
                              </button>
                            </div>
                          </div>
                          <pre id="${codeId}" class="hidden p-4 overflow-x-auto text-sm text-green-200 font-mono whitespace-pre">${codeText}</pre>
                        </div>
                      `;
                    }).join("")}
                  </div>
                </section>
              ` : ""}
            </div>
          </div>
        </div>
      </article>
    `;
  });
}

function renderTeamProjects(projects) {
  const section = document.getElementById("teamprojects");
  if (!section) return;

  section.innerHTML = `
    <div class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
      <h2 class="text-2xl font-bold text-blue-300">Team Projects</h2>
      <p class="text-gray-300 mt-2">Professional work: responsibilities, delivery, and impact.</p>
    </div>
  `;

  projects.forEach((proj, idx) => {
    const responsibilities = Array.isArray(proj.responsibilities) ? proj.responsibilities : [];
    const details = Array.isArray(proj.details) ? proj.details : [];
    const tags = inferTags(proj);

    section.innerHTML += `
      <article class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-bold text-gray-100">${proj.title || ""}</h3>
            <p class="text-gray-300 mt-2 leading-relaxed">${proj.description || ""}</p>

            ${tags.length ? `
              <div class="mt-3 flex flex-wrap gap-2">
                ${tags.map(tag => `
                  <span class="text-xs px-2 py-1 rounded-full border border-gray-800 bg-gray-950/40 text-gray-200">
                    ${tag}
                  </span>
                `).join("")}
              </div>
            ` : ""}
          </div>

          <button onclick="toggleSection('${proj.id}')"
                  class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition">
            Details
          </button>
        </div>

        <div id="${proj.id}" class="hidden mt-5 space-y-4">
          ${details.length ? `
            <div class="rounded-xl border border-gray-800 bg-gray-950/30 p-4 space-y-2">
              ${details.map(d => `<p class="text-gray-300">${d}</p>`).join("")}
            </div>
          ` : ""}

          ${(proj.media && proj.media.length) ? `
            <div class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
              <div class="flex items-center justify-between">
                <p class="text-gray-100 font-semibold">Media</p>
                <button onclick="toggleSection('teammedia${idx}')"
                        class="text-xs px-3 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700">
                  Toggle
                </button>
              </div>
              <div id="teammedia${idx}" class="mt-4 grid md:grid-cols-2 gap-4">
                ${proj.media.map(m => `
                  <button class="text-left rounded-xl border border-gray-800 bg-gray-900/30 hover:bg-gray-900/60 overflow-hidden transition"
                          onclick="openMedia('${(m.label || proj.title || "").replace(/'/g, "\\'")}', '${m.url}', '${mediaType(m)}')">
                    ${renderMediaThumb(m, "w-full h-40 object-cover border-b border-gray-800")}
                    <div class="p-3">
                      <p class="text-sm font-semibold text-gray-100">${m.label || ""}</p>
                      <p class="text-xs text-gray-400 mt-1">Click to expand</p>
                    </div>
                  </button>
                `).join("")}
              </div>
            </div>
          ` : ""}

          <div class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
            <p class="text-gray-100 font-semibold mb-2">Key Responsibilities</p>
            ${responsibilities.length ? `
              <ul class="list-disc list-inside text-gray-300 space-y-1">
                ${responsibilities.map(r => `<li>${r}</li>`).join("")}
              </ul>
            ` : `
              <p class="text-gray-400 text-sm">No responsibilities listed in JSON.</p>
            `}
          </div>
        </div>
      </article>
    `;
  });
}

// Boot (wait for DOM so #teamprojects exists 100%)
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = await fetchProjects();

    const solo = data.soloProjects || [];

    // team con id real (y consistente con lo que renderTeamProjects usa)
    const team = (data.teamProjects || []).map((p) => ({
      ...p,
      id: p.id || `team_${slugify(p.title)}`,
      _tab: "teamprojects",
    }));

    // featured híbrido
    const featuredPool = [...solo, ...team];

    renderFeatured(featuredPool);
    renderSoloProjects(solo);
    renderTeamProjects(team);

    console.log("Loaded soloProjects:", solo.length);
    console.log("Loaded teamProjects:", team.length);
  } catch (err) {
    console.error("ERROR fetch projects:", err);
    document.getElementById("projects").innerHTML =
      `<p class='text-red-400'>Could not load project data: ${err.message}</p>`;
    document.getElementById("teamprojects").innerHTML =
      `<p class='text-red-400'>Could not load project data: ${err.message}</p>`;
  }
});
