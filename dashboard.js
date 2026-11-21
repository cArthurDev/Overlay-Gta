const STORAGE_KEY = "vice-city-overlay-secret";
const TEXT_COLOR_KEY = "vice-city-overlay-text-color";
const GRADIENT_ENABLED_KEY = "vice-city-overlay-gradient-enabled";
const GRADIENT_START_KEY = "vice-city-overlay-gradient-start";
const GRADIENT_END_KEY = "vice-city-overlay-gradient-end";
const TEMPLATE_STORAGE_KEY = "vice-city-overlay-template";
const DEFAULT_TEXT_COLOR = "#ffffff";
const DEFAULT_GRADIENT_START = "#b6f36b";
const DEFAULT_GRADIENT_END = "#ffffff";
const TEMPLATE_CONFIG = window.OVERLAY_TEMPLATE_CONFIG;
const DEFAULT_TEMPLATE_ID = TEMPLATE_CONFIG.defaultId;
const SYNC_INTERVAL = 3000;

const connectView = document.querySelector("#connect-view");
const dashboardView = document.querySelector("#dashboard-view");
const dashboardContent = document.querySelector("#dashboard-content");
const dashboardTab = document.querySelector("#dashboard-tab");
const templatesTab = document.querySelector("#templates-tab");
const templatesView = document.querySelector("#templates-view");
const collaboratorsGrid = document.querySelector("#collaborators-grid");
const collaboratorsCount = document.querySelector("#collaborators-count");
const collaboratorsError = document.querySelector("#collaborators-error");
const templateGrid = document.querySelector("#template-grid");
const templateSelectionStatus = document.querySelector("#template-selection-status");
const overlayPreviews = document.querySelectorAll(".overlay-template");
const connectForm = document.querySelector("#connect-form");
const connectError = document.querySelector("#connect-error");
const dashboardError = document.querySelector("#dashboard-error");
const secretInput = document.querySelector("#secret-input");
const overlayUrl = document.querySelector("#overlay-url");
const copyUrlButton = document.querySelector("#copy-url");
const copyFeedback = document.querySelector("#copy-feedback");
const connectionStatus = document.querySelector("#connection-status");
const timerDisplay = document.querySelector("#timer-title");
const timerState = document.querySelector("#timer-state");
const toggleTimerButton = document.querySelector("#toggle-timer");
const missionCount = document.querySelector("#mission-count");
const missionTotal = document.querySelector("#mission-total");
const missionTotalInput = document.querySelector("#mission-total-input");
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector("#progress-fill");
const previewMissions = document.querySelector("#preview-missions");
const previewTime = document.querySelector("#preview-time");
const decrementMissionButton = document.querySelector("#decrement-mission");
const incrementMissionButton = document.querySelector("#increment-mission");
const resetTimerButton = document.querySelector("#reset-timer");
const add10MinutesButton = document.querySelector("#add-10-min");
const add30MinutesButton = document.querySelector("#add-30-min");
const add1HourButton = document.querySelector("#add-1-hour");
const remove10MinutesButton = document.querySelector("#remove-10-min");
const remove30MinutesButton = document.querySelector("#remove-30-min");
const remove1HourButton = document.querySelector("#remove-1-hour");
const resetMissionsButton = document.querySelector("#reset-missions");
const saveMissionTotalButton = document.querySelector("#mission-total-form button");
const textColorInput = document.querySelector("#text-color");
const textColorValue = document.querySelector("#text-color-value");
const resetTextColorButton = document.querySelector("#reset-text-color");
const gradientEnabledInput = document.querySelector("#gradient-enabled");
const gradientStartInput = document.querySelector("#gradient-start");
const gradientEndInput = document.querySelector("#gradient-end");
const actionButtons = [
  toggleTimerButton,
  resetTimerButton,
  add10MinutesButton,
  add30MinutesButton,
  add1HourButton,
  remove10MinutesButton,
  remove30MinutesButton,
  remove1HourButton,
  decrementMissionButton,
  incrementMissionButton,
  resetMissionsButton,
  saveMissionTotalButton,
];

let secret = localStorage.getItem(STORAGE_KEY) || "";
let overlayTextColor = localStorage.getItem(TEXT_COLOR_KEY) || DEFAULT_TEXT_COLOR;
let gradientEnabled = localStorage.getItem(GRADIENT_ENABLED_KEY) === "true";
let gradientStart = localStorage.getItem(GRADIENT_START_KEY) || DEFAULT_GRADIENT_START;
let gradientEnd = localStorage.getItem(GRADIENT_END_KEY) || DEFAULT_GRADIENT_END;
let selectedTemplateId = DEFAULT_TEMPLATE_ID;
let state = null;
let requestInFlight = false;
let syncInFlight = false;
let missionTotalEditing = false;
let collaboratorAvatarsRequested = false;

function isHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function applyOverlayTextColor(color) {
  const safeColor = isHexColor(color) ? color : DEFAULT_TEXT_COLOR;
  overlayTextColor = safeColor;
  textColorInput.value = safeColor;
  localStorage.setItem(TEXT_COLOR_KEY, safeColor);
  applyOverlayAppearance();
}

function applyOverlayAppearance() {
  const root = document.documentElement;
  root.style.setProperty("--overlay-text", overlayTextColor);
  root.style.setProperty("--overlay-gradient-start", gradientStart);
  root.style.setProperty("--overlay-gradient-end", gradientEnd);
  root.classList.toggle("overlay-gradient", gradientEnabled);
  textColorInput.hidden = gradientEnabled;
  gradientStartInput.hidden = !gradientEnabled;
  gradientEndInput.hidden = !gradientEnabled;
  textColorValue.textContent = gradientEnabled
    ? `DEGRADE · ${gradientStart.toUpperCase()} → ${gradientEnd.toUpperCase()}`
    : `COR SÓLIDA · ${overlayTextColor.toUpperCase()}`;
  textColorInput.value = overlayTextColor;
  gradientStartInput.value = gradientStart;
  gradientEndInput.value = gradientEnd;
  gradientEnabledInput.checked = gradientEnabled;
  localStorage.setItem(GRADIENT_ENABLED_KEY, String(gradientEnabled));
  localStorage.setItem(GRADIENT_START_KEY, gradientStart);
  localStorage.setItem(GRADIENT_END_KEY, gradientEnd);
}

applyOverlayAppearance();

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function elapsedSeconds(currentState) {
  const startedAt = currentState.timer_started_at ? Date.parse(currentState.timer_started_at) : null;
  const runningSeconds = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  return Number(currentState.accumulated_seconds) + runningSeconds;
}

function setConnected(connected) {
  connectView.hidden = connected;
  dashboardView.hidden = !connected;
}

function storedTemplateFor(userSecret) {
  const savedTemplateId = localStorage.getItem(`${TEMPLATE_STORAGE_KEY}:${userSecret}`);
  return TEMPLATE_CONFIG.templates.some((template) => template.id === savedTemplateId)
    ? savedTemplateId
    : DEFAULT_TEMPLATE_ID;
}

function applyTemplate(templateId) {
  const template = TEMPLATE_CONFIG.templates.find((item) => item.id === templateId)
    || TEMPLATE_CONFIG.templates.find((item) => item.id === DEFAULT_TEMPLATE_ID);
  if (!template) throw new Error("Nenhum template padrão foi configurado.");

  selectedTemplateId = template.id;
  const background = `url("${template.image}")`;
  overlayPreviews.forEach((preview) => {
    preview.style.setProperty("--template-background", background);
  });
  templateSelectionStatus.textContent = `EM USO · ${template.name.toUpperCase()}`;
  templateGrid.querySelectorAll(".template-card").forEach((card) => {
    const selected = card.dataset.templateId === template.id;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", String(selected));
    card.querySelector(".template-card-state").textContent = selected ? "EM USO" : "SELECIONAR";
  });
  return template;
}

function renderTemplateOptions() {
  TEMPLATE_CONFIG.templates.forEach((template) => {
    const card = document.createElement("button");
    card.className = "template-card";
    card.type = "button";
    card.dataset.templateId = template.id;
    card.setAttribute("aria-pressed", "false");

    const art = document.createElement("span");
    art.className = "template-card-art";
    art.style.setProperty("--template-image", `url("${template.image}")`);
    art.setAttribute("aria-hidden", "true");

    const metadata = document.createElement("span");
    metadata.className = "template-card-meta";

    const name = document.createElement("span");
    name.className = "template-card-name";
    name.textContent = template.name;

    const status = document.createElement("span");
    status.className = "template-card-state";
    status.textContent = "SELECIONAR";

    const description = document.createElement("span");
    description.className = "template-card-description";
    description.textContent = template.description;

    metadata.append(name, status);
    card.append(art, metadata, description);
    card.addEventListener("click", () => selectTemplate(template.id));
    templateGrid.append(card);
  });
}

function selectTemplate(templateId) {
  const template = applyTemplate(templateId);
  localStorage.setItem(`${TEMPLATE_STORAGE_KEY}:${secret}`, template.id);
  overlayUrl.textContent = overlayAddress();
  copyUrlButton.disabled = false;
  copyFeedback.textContent = "Template selecionado. Copie a URL atualizada e substitua-a no OBS.";
}

function setDashboardSection(section) {
  dashboardContent.hidden = section !== "dashboard";
  templatesView.hidden = section !== "templates";

  const tabs = [
    [dashboardTab, "dashboard"],
    [templatesTab, "templates"],
  ];

  tabs.forEach(([tab, tabSection]) => {
    const active = tabSection === section;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
}

function safeCollaboratorUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function getTwitchChannelName(value) {
  try {
    const url = new URL(value);
    if (!["www.twitch.tv", "twitch.tv"].includes(url.hostname.toLowerCase())) return null;
    return url.pathname.split("/").filter(Boolean)[0] || null;
  } catch {
    return null;
  }
}

function safeTwitchAvatarUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "static-cdn.jtvnw.net"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function renderCollaborators() {
  const collaborators = Array.isArray(window.OVERLAY_COLLABORATORS)
    ? window.OVERLAY_COLLABORATORS
    : [];
  collaboratorsGrid.replaceChildren();

  const validCollaborators = collaborators.filter((collaborator) =>
    collaborator?.name
    && typeof collaborator.url === "string"
    && safeCollaboratorUrl(collaborator.url),
  );

  collaboratorsCount.textContent = `${validCollaborators.length} ${validCollaborators.length === 1 ? "CANAL" : "CANAIS"}`;

  if (validCollaborators.length === 0) {
    const empty = document.createElement("div");
    empty.className = "collaborators-empty";
    empty.innerHTML = "<strong>Nenhum colaborador cadastrado</strong><span>Adicione os streamers no arquivo de configuração do projeto.</span>";
    collaboratorsGrid.append(empty);
    return;
  }

  validCollaborators.forEach((collaborator) => {
    const url = safeCollaboratorUrl(collaborator.url);
    const card = document.createElement("article");
    card.className = "collaborator-card";

    const channelName = getTwitchChannelName(url);
    if (channelName) {
      card.dataset.twitchLogin = channelName.toLowerCase();
      const preview = document.createElement("iframe");
      preview.className = "collaborator-preview";
      const parent = window.location.hostname || "localhost";
      preview.src = `https://player.twitch.tv/?channel=${encodeURIComponent(channelName)}&parent=${encodeURIComponent(parent)}&muted=true&autoplay=false`;
      preview.title = `Live de ${collaborator.name} na Twitch`;
      preview.allow = "autoplay; fullscreen";
      preview.loading = "lazy";
      card.append(preview);
    }

    const identity = document.createElement("div");
    identity.className = "collaborator-identity";

    const mark = document.createElement("span");
    mark.className = "collaborator-mark";
    mark.setAttribute("aria-hidden", "true");

    const avatar = document.createElement("img");
    avatar.className = "collaborator-avatar";
    avatar.alt = "";
    avatar.decoding = "async";

    const initials = document.createElement("span");
    initials.className = "collaborator-initials";
    initials.textContent = collaborator.name.trim().slice(0, 2).toUpperCase();
    mark.append(avatar, initials);

    const person = document.createElement("div");
    person.className = "collaborator-person";

    const name = document.createElement("h3");
    name.textContent = collaborator.name;
    const platform = document.createElement("span");
    platform.textContent = collaborator.platform || "LIVE";

    person.append(name, platform);
    identity.append(mark, person);

    const link = document.createElement("a");
    link.className = "collaborator-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Abrir live";

    card.append(identity, link);
    collaboratorsGrid.append(card);
  });
}

async function loadCollaboratorAvatars() {
  if (collaboratorAvatarsRequested) return;
  collaboratorAvatarsRequested = true;
  collaboratorsError.hidden = true;

  if (!collaboratorsGrid.querySelector(".collaborator-card[data-twitch-login]")) return;

  try {
    const response = await fetch("/api/twitch-profiles", { cache: "force-cache" });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Não foi possível carregar os perfis da Twitch.");
    }
    if (!result?.profiles || typeof result.profiles !== "object" || Array.isArray(result.profiles)) {
      throw new Error("A API de perfis da Twitch retornou dados inválidos.");
    }

    let missingProfile = false;
    collaboratorsGrid.querySelectorAll(".collaborator-card[data-twitch-login]").forEach((card) => {
      const login = card.dataset.twitchLogin;
      const avatarUrl = safeTwitchAvatarUrl(result.profiles[login]);
      if (!avatarUrl) {
        missingProfile = true;
        return;
      }

      const avatar = card.querySelector(".collaborator-avatar");
      const mark = card.querySelector(".collaborator-mark");
      avatar.addEventListener("load", () => mark.classList.add("has-avatar"), { once: true });
      avatar.addEventListener("error", () => {
        collaboratorsError.textContent = "A Twitch não retornou a imagem de perfil de um dos canais.";
        collaboratorsError.hidden = false;
      }, { once: true });
      avatar.src = avatarUrl;
    });

    if (missingProfile) {
      collaboratorsError.textContent = "A Twitch não retornou a imagem de perfil de um dos canais.";
      collaboratorsError.hidden = false;
    }
  } catch (error) {
    console.error("Não foi possível carregar as fotos de perfil da Twitch:", error);
    collaboratorsError.textContent = error.message;
    collaboratorsError.hidden = false;
  }
}

function setConnectionStatus(connected) {
  connectionStatus.innerHTML = connected
    ? '<span class="status-dot"></span> CONECTADO'
    : '<span class="status-dot status-dot-off"></span> SEM CONEXÃO';
  connectionStatus.classList.toggle("is-offline", !connected);
}

function render() {
  if (!state) return;

  const time = formatTime(elapsedSeconds(state));
  const completed = Number(state.mission_count);
  const total = Number(state.mission_total);
  const progress = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const formattedCount = String(completed).padStart(2, "0");

  timerDisplay.textContent = time;
  previewTime.textContent = time;
  previewMissions.innerHTML = `${formattedCount}<span class="overlay-total">/${total}</span>`;
  missionCount.textContent = String(completed);
  missionTotal.textContent = String(total);
  if (!missionTotalEditing) {
    missionTotalInput.value = String(total);
  }
  progressFill.style.width = `${progress}%`;
  progressTrack.setAttribute("aria-valuemax", String(total));
  progressTrack.setAttribute("aria-valuenow", String(completed));

  const running = Boolean(state.timer_started_at);
  timerState.textContent = running ? "EM ANDAMENTO" : "PAUSADO";
  timerState.classList.toggle("is-running", running);
  toggleTimerButton.textContent = running ? "Pausar cronômetro" : "Iniciar cronômetro";
  updateActionControls();
}

function updateActionControls() {
  const disabled = requestInFlight || !state;
  actionButtons.forEach((button) => { button.disabled = disabled; });
  decrementMissionButton.disabled = disabled || Number(state?.mission_count) === 0;
  incrementMissionButton.disabled = disabled
    || Number(state?.mission_count) >= Number(state?.mission_total);
}

async function requestState() {
  const response = await fetch("/api/state", {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Não foi possível carregar o painel.");
  }
  return result.state;
}

function overlayAddress() {
  const url = new URL("/overlay.html", window.location.origin);
  url.searchParams.set("template", selectedTemplateId);
  url.searchParams.set("textColor", overlayTextColor);
  url.searchParams.set("textGradient", String(gradientEnabled));
  url.searchParams.set("gradientStart", gradientStart);
  url.searchParams.set("gradientEnd", gradientEnd);
  url.hash = secret;
  return url.toString();
}

function showDashboard() {
  setConnected(true);
  loadCollaboratorAvatars();
  applyTemplate(selectedTemplateId);
  overlayUrl.textContent = overlayAddress();
  copyUrlButton.disabled = false;
}

async function connect(value) {
  secret = value.trim();
  if (!secret) throw new Error("Informe a sua chave.");

  const result = await requestState();
  selectedTemplateId = storedTemplateFor(secret);
  localStorage.setItem(STORAGE_KEY, secret);
  state = result;
  showDashboard();
  render();
  setConnectionStatus(true);
}

connectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  connectError.hidden = true;
  const button = connectForm.querySelector("button");
  button.disabled = true;
  button.textContent = "Conectando...";

  try {
    await connect(secretInput.value);
  } catch (error) {
    connectError.textContent = error.message;
    connectError.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Entrar no painel <span aria-hidden="true">→</span>';
  }
});

document.querySelector("#disconnect-button").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  secret = "";
  state = null;
  setConnected(false);
  secretInput.value = "";
  secretInput.focus();
});

dashboardTab.addEventListener("click", () => setDashboardSection("dashboard"));
templatesTab.addEventListener("click", () => setDashboardSection("templates"));

async function postAction(action, value) {
  if (requestInFlight || !state) return;
  requestInFlight = true;
  dashboardError.hidden = true;
  updateActionControls();

  try {
    const response = await fetch("/api/state", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o painel.");
    state = result.state;
    if (action === "set_mission_total") missionTotalEditing = false;
    render();
    setConnectionStatus(true);
  } catch (error) {
    if (action === "set_mission_total") {
      missionTotalEditing = false;
      if (state) missionTotalInput.value = String(state.mission_total);
    }
    dashboardError.textContent = error.message;
    dashboardError.hidden = false;
    setConnectionStatus(false);
  } finally {
    requestInFlight = false;
    updateActionControls();
    render();
  }
}

toggleTimerButton.addEventListener("click", () => {
  postAction(state && state.timer_started_at ? "pause" : "start");
});

document.querySelector("#reset-timer").addEventListener("click", () => {
  if (window.confirm("Zerar todo o tempo jogado?")) postAction("reset_timer");
});

add10MinutesButton.addEventListener("click", () => postAction("add_time", 600));
add30MinutesButton.addEventListener("click", () => postAction("add_time", 1800));
add1HourButton.addEventListener("click", () => postAction("add_time", 3600));
remove10MinutesButton.addEventListener("click", () => postAction("remove_time", 600));
remove30MinutesButton.addEventListener("click", () => postAction("remove_time", 1800));
remove1HourButton.addEventListener("click", () => postAction("remove_time", 3600));

document.querySelector("#increment-mission").addEventListener("click", () => postAction("increment_mission"));
document.querySelector("#decrement-mission").addEventListener("click", () => postAction("decrement_mission"));

document.querySelector("#reset-missions").addEventListener("click", () => {
  if (window.confirm("Zerar a contagem de missões?")) postAction("reset_missions");
});

textColorInput.addEventListener("input", (event) => {
  applyOverlayTextColor(event.target.value);
  if (overlayUrl.textContent !== "A URL privada aparece depois de conectar.") {
    overlayUrl.textContent = overlayAddress();
  }
});

gradientEnabledInput.addEventListener("change", (event) => {
  gradientEnabled = event.target.checked;
  applyOverlayAppearance();
  if (overlayUrl.textContent !== "A URL privada aparece depois de conectar.") {
    overlayUrl.textContent = overlayAddress();
  }
});

gradientStartInput.addEventListener("input", (event) => {
  if (!isHexColor(event.target.value)) return;
  gradientStart = event.target.value;
  applyOverlayAppearance();
  if (overlayUrl.textContent !== "A URL privada aparece depois de conectar.") {
    overlayUrl.textContent = overlayAddress();
  }
});

gradientEndInput.addEventListener("input", (event) => {
  if (!isHexColor(event.target.value)) return;
  gradientEnd = event.target.value;
  applyOverlayAppearance();
  if (overlayUrl.textContent !== "A URL privada aparece depois de conectar.") {
    overlayUrl.textContent = overlayAddress();
  }
});

resetTextColorButton.addEventListener("click", () => {
  gradientEnabled = false;
  gradientStart = DEFAULT_GRADIENT_START;
  gradientEnd = DEFAULT_GRADIENT_END;
  applyOverlayTextColor(DEFAULT_TEXT_COLOR);
  if (overlayUrl.textContent !== "A URL privada aparece depois de conectar.") {
    overlayUrl.textContent = overlayAddress();
  }
});

missionTotalInput.addEventListener("focus", () => {
  missionTotalEditing = true;
});

missionTotalInput.addEventListener("input", () => {
  missionTotalEditing = true;
});

missionTotalInput.addEventListener("blur", () => {
  missionTotalEditing = false;
});

document.querySelector("#mission-total-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = Number(missionTotalInput.value);
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    dashboardError.textContent = "A meta deve ser um número entre 1 e 999.";
    dashboardError.hidden = false;
    return;
  }
  missionTotalEditing = true;
  postAction("set_mission_total", value);
});

copyUrlButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(overlayAddress());
    copyFeedback.textContent = "URL privada copiada.";
  } catch (error) {
    copyFeedback.textContent = "Não foi possível copiar. Selecione e copie a URL acima.";
  }
});

async function syncState() {
  if (!secret || syncInFlight || requestInFlight) return;
  syncInFlight = true;
  try {
    state = await requestState();
    dashboardError.hidden = true;
    setConnectionStatus(true);
    render();
  } catch (error) {
    dashboardError.textContent = error.message;
    dashboardError.hidden = false;
    setConnectionStatus(false);
  } finally {
    syncInFlight = false;
    updateActionControls();
  }
}

function tick() {
  if (state) render();
}

renderTemplateOptions();
renderCollaborators();

if (secret) {
  selectedTemplateId = storedTemplateFor(secret);
  secretInput.value = secret;
  setConnected(true);
  showDashboard();
  syncState();
  window.setInterval(syncState, SYNC_INTERVAL);
} else {
  setConnected(false);
}

window.setInterval(tick, 1000);
