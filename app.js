const STAGES = [
  "Backlog",
  "Preparation",
  "Snap Build",
  "Detailing",
  "Paint & Finish",
  "Showcase Ready",
];
const STORAGE_KEY = "gundamBuildTracker.v1";

const state = {
  builds: [],
  filter: "all",
};

const els = {
  form: document.querySelector("#build-form"),
  list: document.querySelector("#build-list"),
  summary: document.querySelector("#summary-grid"),
  filter: document.querySelector("#status-filter"),
  sample: document.querySelector("#sample-builds"),
  clear: document.querySelector("#clear-builds"),
  template: document.querySelector("#build-card-template"),
};

function loadState() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed)) {
        state.builds = parsed;
      }
    }
  } catch (err) {
    console.error("Unable to load saved builds", err);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.builds));
}

function stageIndex(stage) {
  const index = STAGES.indexOf(stage);
  return index === -1 ? 0 : index;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (err) {
    return "—";
  }
}

function renderSummary() {
  const total = state.builds.length;
  const counts = STAGES.reduce(
    (acc, stage) => ({ ...acc, [stage]: 0 }),
    {}
  );

  counts["Showcase Ready"] = 0;
  let finished = 0;

  for (const build of state.builds) {
    const stage = STAGES.includes(build.status) ? build.status : "Backlog";
    counts[stage] = (counts[stage] ?? 0) + 1;
    if (stage === "Showcase Ready") {
      finished += 1;
    }
  }

  const summaryHtml = `
    <article class="summary-card">
      <strong>${total}</strong>
      <span>Total Kits Logged</span>
    </article>
    <article class="summary-card">
      <strong>${counts["Snap Build"] ?? 0}</strong>
      <span>Snapping In Progress</span>
    </article>
    <article class="summary-card">
      <strong>${counts["Paint & Finish"] ?? 0}</strong>
      <span>Painting / Topcoat</span>
    </article>
    <article class="summary-card">
      <strong>${finished}</strong>
      <span>Showcase Ready</span>
    </article>
  `;

  els.summary.innerHTML = summaryHtml;
}

function renderFilterOptions() {
  const fragment = document.createDocumentFragment();
  for (const stage of STAGES) {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage;
    fragment.appendChild(option);
  }
  els.filter.appendChild(fragment);
}

function renderList() {
  const fragment = document.createDocumentFragment();
  const builds = [...state.builds]
    .filter((build) => {
      if (state.filter === "all") return true;
      return build.status === state.filter;
    })
    .sort((a, b) => {
      const stageDiff = stageIndex(a.status) - stageIndex(b.status);
      if (stageDiff !== 0) return stageDiff;
      return (
        new Date(b.updatedAt ?? b.createdAt ?? 0) -
        new Date(a.updatedAt ?? a.createdAt ?? 0)
      );
    });

  if (builds.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      state.builds.length === 0
        ? "Log your first build above to see it appear here."
        : "No builds match this filter. Try a different stage.";
    els.list.replaceChildren(empty);
    return;
  }

  for (const build of builds) {
    const instance = els.template.content.cloneNode(true);
    const getField = (name) => instance.querySelector(`[data-field="${name}"]`);

    getField("kitName").textContent = build.kitName;
    getField("gradeScale").textContent = `${build.grade} • ${build.scale}`;
    getField("statusTag").textContent = build.status;
    getField("started").textContent = formatDate(build.started);
    getField("target").textContent = formatDate(build.target);
    getField("updated").textContent = formatDate(
      build.updatedAt ?? build.createdAt
    );
    getField("notes").textContent =
      build.notes?.trim() || "No notes yet. Add some ideas!";

    const index = stageIndex(build.status);
    const progressPercent = Math.round((index / (STAGES.length - 1)) * 100);
    getField("stageLabel").textContent = `Stage ${index + 1} of ${STAGES.length}`;
    getField("progressValue").textContent = `${progressPercent}%`;
    getField("progressBar").style.width = `${progressPercent}%`;

    const card = instance.querySelector(".build-card");
    card.dataset.id = build.id;

    const prevButton = instance.querySelector('[data-action="step-back"]');
    const nextButton = instance.querySelector('[data-action="step-forward"]');

    prevButton.disabled = index === 0;
    nextButton.disabled = index === STAGES.length - 1;

    fragment.appendChild(instance);
  }

  els.list.replaceChildren(fragment);
}

function render() {
  renderSummary();
  renderList();
}

function addBuild(build) {
  state.builds.push(build);
  persistState();
  render();
}

function updateBuild(id, changes) {
  state.builds = state.builds.map((build) =>
    build.id === id ? { ...build, ...changes, updatedAt: new Date() } : build
  );
  persistState();
  render();
}

function deleteBuild(id) {
  state.builds = state.builds.filter((build) => build.id !== id);
  persistState();
  render();
}

function resetTracker() {
  if (
    confirm("This will remove every build saved on this device. Continue?")
  ) {
    state.builds = [];
    persistState();
    render();
  }
}

function randomId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `build-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildFromForm(formData) {
  const now = new Date();
  return {
    id: randomId(),
    kitName: formData.get("kitName").trim(),
    grade: formData.get("grade"),
    scale: formData.get("scale").trim(),
    status: formData.get("status"),
    started: formData.get("started") || null,
    target: formData.get("target") || null,
    notes: formData.get("notes") || "",
    createdAt: now,
    updatedAt: now,
  };
}

function advanceStage(id, direction) {
  const build = state.builds.find((entry) => entry.id === id);
  if (!build) return;
  const index = stageIndex(build.status);
  const next = Math.min(Math.max(index + direction, 0), STAGES.length - 1);
  if (next === index) return;
  updateBuild(id, { status: STAGES[next] });
}

function handleCardClick(event) {
  const action = event.target.dataset.action;
  if (!action) return;

  const card = event.target.closest(".build-card");
  if (!card) return;
  const { id } = card.dataset;

  if (action === "delete") {
    if (confirm("Remove this build from the tracker?")) {
      deleteBuild(id);
    }
    return;
  }

  if (action === "step-forward") {
    advanceStage(id, 1);
  } else if (action === "step-back") {
    advanceStage(id, -1);
  }
}

function loadSamples() {
  const sampleBuilds = [
    {
      kitName: "RX-93 Nu Gundam Ver.Ka",
      grade: "Master Grade",
      scale: "1/100",
      status: "Snap Build",
      notes: "Metallic frame, matte topcoat planned.",
      started: "2024-02-10",
      target: "2024-04-01",
    },
    {
      kitName: "Gundam Barbatos Lupus Rex",
      grade: "High Grade",
      scale: "1/144",
      status: "Paint & Finish",
      notes:
        "Custom weathering with soot pastels. Add chipped paint around claws.",
      started: "2024-01-14",
      target: "2024-03-05",
    },
    {
      kitName: "MS-06 Zaku II",
      grade: "Real Grade",
      scale: "1/144",
      status: "Preparation",
      notes: "Test fitting color-matched third-party decals.",
      started: "2024-03-01",
      target: "2024-04-20",
    },
    {
      kitName: "Wing Gundam Zero EW",
      grade: "Perfect Grade",
      scale: "1/60",
      status: "Showcase Ready",
      notes: "Pearl clear coat + LED kit installed.",
      started: "2023-11-02",
      target: "2024-02-15",
    },
  ];

  const now = new Date();
  const hydrated = sampleBuilds.map((entry, idx) => ({
    ...entry,
    id: randomId(),
    createdAt: new Date(now.getTime() - idx * 2 * 86_400_000),
    updatedAt: new Date(now.getTime() - idx * 86_400_000),
  }));

  state.builds = hydrated;
  persistState();
  render();
}

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(els.form);
  const kitName = formData.get("kitName")?.trim();
  const scale = formData.get("scale")?.trim();
  if (!kitName || !scale) {
    alert("Kit name and scale are required.");
    return;
  }

  addBuild(buildFromForm(formData));
  els.form.reset();
});

els.list.addEventListener("click", handleCardClick);

els.filter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderList();
});

els.sample.addEventListener("click", loadSamples);
els.clear.addEventListener("click", resetTracker);

renderFilterOptions();
loadState();
render();
