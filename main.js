window.toggleSection = function(id) {
  const content = document.getElementById(id);
  if (content) content.classList.toggle('hidden');
};

async function fetchProjects() {
  const response = await fetch('projects.json');
  if (!response.ok) throw new Error("Could not load projects.json");
  return await response.json();
}

// Heurística simple para tags (sin tocar tu JSON)
function inferTags(project) {
  const t = (project.description || "").toLowerCase();
  const tags = [];
  if (t.includes("vr")) tags.push("VR");
  if (t.includes("cave")) tags.push("CAVE");
  if (t.includes("addressable")) tags.push("Addressables");
  if (t.includes("behavior tree")) tags.push("Behavior Trees");
  if (t.includes("firebase")) tags.push("Firebase");
  if (t.includes("mobile") || t.includes("android") || t.includes(" ios")) tags.push("Mobile");
  if (t.includes("timeline")) tags.push("Timeline");
  if (t.includes("pathfinding") || t.includes("a*")) tags.push("Pathfinding");
  if (t.includes("ai")) tags.push ("AI");
  if (t.includes("steering behaviors")) tags.push ("Steering Behaviors");
  return [...new Set(tags)].slice(0, 5);
}

function firstMediaUrl(project) {
  return project.media && project.media.length ? project.media[0].url : null;
}

function renderFeatured(projects) {
  const featuredEl = document.getElementById("featured");
  if (!featuredEl) return;

  // Elige tus top 3 (ajústalo a gusto)
  const priority = ["Play & Learn", "The Lost Lantern", "Way of the Wolf"];
  const sorted = [...projects].sort((a, b) => {
    const ai = priority.indexOf(a.title);
    const bi = priority.indexOf(b.title);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const picked = sorted.slice(0, 3);

  featuredEl.innerHTML = picked.map((p) => {
    const thumb = firstMediaUrl(p);
    const tags = inferTags(p);
    return `
      <div class="rounded-2xl border border-gray-800 bg-gray-950/40 overflow-hidden hover:shadow-glow transition">
        ${thumb ? `
          <button class="w-full" onclick="openMedia('${p.title.replace(/'/g,"\\'")}', '${thumb}')">
            <img src="${thumb}" alt="${p.title}" class="w-full h-40 object-cover border-b border-gray-800"/>
          </button>
        ` : `
          <div class="h-40 border-b border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950"></div>
        `}
        <div class="p-4">
          <p class="font-semibold text-gray-100">${p.title}</p>
          <p class="text-sm text-gray-400 mt-1 line-clamp-3">${(p.description || "").split("\n")[0]}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            ${tags.map(tag => `<span class="text-xs px-2 py-1 rounded-full border border-gray-800 bg-gray-900/50 text-gray-200">${tag}</span>`).join("")}
          </div>
          <div class="mt-4">
            <button class="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition"
                    onclick="document.querySelector('.tab-btn[data-tab=\\'projects\\']')?.click(); setTimeout(()=>{document.getElementById('${p.id}')?.classList.remove('hidden'); document.getElementById('${p.id}')?.scrollIntoView({behavior:'smooth', block:'start'});}, 80);">
              View details
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderSoloProjects(projects) {
  const section = document.getElementById('projects');
  if (!section) return;

  section.innerHTML = `
    <div class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
      <h2 class="text-2xl font-bold text-blue-300">Solo Projects</h2>
      <p class="text-gray-300 mt-2">Personal projects showcasing gameplay, tools, and systems design.</p>
    </div>
  `;

  projects.forEach((proj, idx) => {
    const thumb = firstMediaUrl(proj);
    const tags = inferTags(proj);

    section.innerHTML += `
      <article class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow overflow-hidden">
        <div class="grid md:grid-cols-[220px_1fr] gap-0">
          <div class="border-b md:border-b-0 md:border-r border-gray-800 bg-gray-950/40">
            ${thumb ? `
              <button class="w-full" onclick="openMedia('${proj.title.replace(/'/g,"\\'")}', '${thumb}')">
                <img src="${thumb}" class="w-full h-44 md:h-full object-cover" alt="${proj.title}">
              </button>
            ` : `
              <div class="w-full h-44 md:h-full bg-gradient-to-br from-gray-900 to-gray-950"></div>
            `}
          </div>

          <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 class="text-2xl font-bold text-gray-100">${proj.title}</h3>
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
              <!-- Description -->
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

              <!-- Media -->
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
                              onclick="openMedia('${(m.label || proj.title).replace(/'/g,"\\'")}', '${m.url}')">
                        <img src="${m.url}" class="w-full h-40 object-cover border-b border-gray-800" alt="${m.label}">
                        <div class="p-3">
                          <p class="text-sm font-semibold text-gray-100">${m.label}</p>
                          <p class="text-xs text-gray-400 mt-1">Click to expand</p>
                        </div>
                      </button>
                    `).join('')}
                  </div>
                </section>
              ` : ''}

              <!-- Code -->
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
                      return `
                        <div class="rounded-xl border border-gray-800 bg-black/40 overflow-hidden">
                          <div class="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                            <p class="text-sm font-semibold text-gray-100">${c.label}</p>
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
                          <pre id="${codeId}" class="hidden p-4 overflow-x-auto text-sm text-green-200 font-mono whitespace-pre">${(c.code || "").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
                        </div>
                      `;
                    }).join('')}
                  </div>
                </section>
              ` : ''}

            </div>
          </div>
        </div>
      </article>
    `;
  });
}

function renderTeamProjects(projects) {
  const section = document.getElementById('teamprojects');
  if (!section) return;

  section.innerHTML = `
    <div class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
      <h2 class="text-2xl font-bold text-blue-300">Team Projects</h2>
      <p class="text-gray-300 mt-2">Professional work: responsibilities, delivery, and impact.</p>
    </div>
  `;

  projects.forEach((proj, idx) => {
    section.innerHTML += `
      <article class="mb-6 rounded-2xl border border-gray-800 bg-gray-900/40 backdrop-blur-lg shadow-glow p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="text-2xl font-bold text-gray-100">${proj.title}</h3>
            <p class="text-gray-300 mt-2 leading-relaxed">${proj.description}</p>
          </div>
          <button onclick="toggleSection('team_${idx}')"
                  class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm transition">
            Details
          </button>
        </div>

        <div id="team_${idx}" class="hidden mt-5 space-y-4">
          ${proj.details && proj.details.length ? `
            <div class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
              ${proj.details.map(d => `<p class="text-gray-300">${d}</p>`).join('')}
            </div>
          ` : ''}

          <div class="rounded-xl border border-gray-800 bg-gray-950/30 p-4">
            <p class="text-gray-100 font-semibold mb-2">Key Responsibilities</p>
            <ul class="list-disc list-inside text-gray-300 space-y-1">
              ${proj.responsibilities.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        </div>
      </article>
    `;
  });
}

// Init
fetchProjects()
  .then(data => {
    const solo = data.soloProjects || [];
    renderFeatured(solo);
    renderSoloProjects(solo);
    renderTeamProjects(data.teamProjects || []);
  })
  .catch(err => {
  console.error("ERROR fetch projects:", err);
  document.getElementById('projects').innerHTML =
    `<p class='text-red-400'>Could not load project data: ${err.message}</p>`;
  document.getElementById('teamprojects').innerHTML =
    `<p class='text-red-400'>Could not load project data: ${err.message}</p>`;
});
