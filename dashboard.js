const STORAGE_KEY = "vice-city-overlay-secret";
const SYNC_INTERVAL = 3000;

const connectView = document.querySelector("#connect-view");
const dashboardView = document.querySelector("#dashboard-view");
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
const resetMissionsButton = document.querySelector("#reset-missions");
const saveMissionTotalButton = document.querySelector("#mission-total-form button");
const actionButtons = [
  toggleTimerButton,
  resetTimerButton,
  decrementMissionButton,
  incrementMissionButton,
  resetMissionsButton,
  saveMissionTotalButton,
];

let secret = localStorage.getItem(STORAGE_KEY) || "";
let state = null;
let requestInFlight = false;

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
  missionTotalInput.value = String(total);
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
  url.hash = secret;
  return url.toString();
}

function showDashboard() {
  setConnected(true);
  overlayUrl.textContent = overlayAddress();
  copyUrlButton.disabled = false;
}

async function connect(value) {
  secret = value.trim();
  if (!secret) throw new Error("Informe a chave configurada na Vercel.");

  const result = await requestState();
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
    button.innerHTML = 'Conectar painel <span aria-hidden="true">→</span>';
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
    render();
    setConnectionStatus(true);
  } catch (error) {
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

document.querySelector("#increment-mission").addEventListener("click", () => postAction("increment_mission"));
document.querySelector("#decrement-mission").addEventListener("click", () => postAction("decrement_mission"));

document.querySelector("#reset-missions").addEventListener("click", () => {
  if (window.confirm("Zerar a contagem de missões?")) postAction("reset_missions");
});

document.querySelector("#mission-total-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const value = Number(missionTotalInput.value);
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    dashboardError.textContent = "A meta deve ser um número entre 1 e 999.";
    dashboardError.hidden = false;
    return;
  }
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
  if (!secret || requestInFlight) return;
  requestInFlight = true;
  updateActionControls();
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
    requestInFlight = false;
    updateActionControls();
  }
}

function tick() {
  if (state) render();
}

if (secret) {
  secretInput.value = secret;
  setConnected(true);
  showDashboard();
  syncState();
  window.setInterval(syncState, SYNC_INTERVAL);
} else {
  setConnected(false);
}

window.setInterval(tick, 1000);
