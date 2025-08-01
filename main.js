window.toggleSection = function(id) {
    const content = document.getElementById(id);
    if (content) content.classList.toggle('hidden');
};

async function fetchProjects() {
    const response = await fetch('projects.json');
    if (!response.ok) throw new Error("No se pudo cargar projects.json");
    return await response.json();
}

function renderSoloProjects(projects) {
    const section = document.getElementById('projects');
    if (!section) return;
    section.innerHTML = '';
    projects.forEach((proj, idx) => {
        section.innerHTML += `
<article class="mb-12 bg-gray-700/40 backdrop-blur-lg shadow-lg p-6 rounded-xl border border-gray-600">
  <div class="flex items-center justify-between mb-4">
    <h3 class="text-2xl font-semibold text-blue-300 mb-4">${proj.title}</h3>
    <button onclick="toggleSection('${proj.id}')" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Show / Hide Project</button>
  </div>
  <div id="${proj.id}" class="hidden space-y-6">
    <section class="mb-6">
      <div class="flex justify-between items-center mb-2">
        <h4 class="text-lg font-bold">🧾 Description</h4>
        <button onclick="toggleSection('desc${idx}')" class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Toggle</button>
      </div>
      <div id="desc${idx}" class="hidden"><p class="text-gray-300 leading-relaxed">${(proj.description||'').replace(/\n/g,'<br>')}</p></div>
    </section>
    ${(proj.media && proj.media.length) ? `
    <section class="mb-6">
      <div class="flex justify-between items-center mb-2">
        <h4 class="text-lg font-bold">🖼️ Media</h4>
        <button onclick="toggleSection('media${idx}')" class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Toggle</button>
      </div>
      <div id="media${idx}" class="hidden grid gap-6">
        ${proj.media.map(m=>`
          <div>
            <h5 class="text-center font-medium mb-1">${m.label}</h5>
            <img src="${m.url}" class="rounded shadow w-full max-w-xl mx-auto" alt="${m.label}">
          </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
    ${(proj.codeBlocks && proj.codeBlocks.length) ? `
    <section>
      <div class="flex justify-between items-center mb-2">
        <h4 class="text-lg font-bold">💻 Sample Code</h4>
        <button onclick="toggleSection('codeBlock${idx}')" class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Toggle All</button>
      </div>
      <div id="codeBlock${idx}" class="hidden space-y-6">
        ${proj.codeBlocks.map((c, cidx)=>`
        <div>
          <div class="flex justify-between items-center mb-2">
            <h5 class="text-md font-semibold">${c.label}</h5>
            <button onclick="toggleSection('code${idx}_${cidx}')" class="text-xs bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600">Toggle</button>
          </div>
          <pre id="code${idx}_${cidx}" class="hidden bg-black text-green-200 text-sm rounded p-4 overflow-x-auto">${c.code}</pre>
        </div>
        `).join('')}
      </div>
    </section>
    ` : ''}
  </div>
</article>
        `;
    });
}

function renderTeamProjects(projects) {
    const section = document.getElementById('teamprojects');
    if (!section) return;
    section.innerHTML = '';
    projects.forEach((proj, idx) => {
        section.innerHTML += `
<article class="mb-12 bg-gray-700/40 backdrop-blur-lg shadow-lg p-6 rounded-xl border border-gray-600">
  <h3 class="text-2xl font-semibold text-blue-300 mb-4">${proj.title}</h3>
  <p class="text-gray-300 leading-relaxed mb-2">${proj.description}</p>
  ${proj.details && proj.details.length ? proj.details.map(d=>`<p class="text-gray-300 mb-4">${d}</p>`).join('') : ''}
  <p class="text-gray-300 font-medium mb-2">Key Responsibilities:</p>
  <ul class="list-disc list-inside text-gray-300">
    ${proj.responsibilities.map(r=>`<li>${r}</li>`).join('')}
  </ul>
</article>
        `;
    });
}

// Inicializa todo al cargar
fetchProjects()
    .then(data => {
        renderSoloProjects(data.soloProjects || []);
        renderTeamProjects(data.teamProjects || []);
    })
    .catch(err => {
        document.getElementById('projects').innerHTML = "<p class='text-red-400'>Could not load project data.</p>";
        document.getElementById('teamprojects').innerHTML = "<p class='text-red-400'>Could not load project data.</p>";
        console.error(err);
    });
