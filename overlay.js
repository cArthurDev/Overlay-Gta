const secret = decodeURIComponent(window.location.hash.slice(1));
const missionDisplay = document.querySelector("#overlay-missions");
const timeDisplay = document.querySelector("#overlay-time");
const errorDisplay = document.querySelector("#overlay-error");

let state = null;
let requestInFlight = false;

const requestedTextColor = new URL(window.location.href).searchParams.get("textColor");
if (/^#[0-9a-f]{6}$/i.test(requestedTextColor || "")) {
  document.documentElement.style.setProperty("--overlay-text", requestedTextColor);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainder = safeSeconds % 60;
  return [hours, minutes, remainder].map((part) => String(part).padStart(2, "0")).join(":");
}

function render() {
  if (!state) return;

  const startedAt = state.timer_started_at ? Date.parse(state.timer_started_at) : null;
  const runningSeconds = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const totalSeconds = Number(state.accumulated_seconds) + runningSeconds;
  const completed = Number(state.mission_count);
  const total = Number(state.mission_total);

  missionDisplay.innerHTML = `${String(completed).padStart(2, "0")}<span class="overlay-total">/${total}</span>`;
  timeDisplay.textContent = formatTime(totalSeconds);
}

async function syncState() {
  if (!secret || requestInFlight) {
    errorDisplay.textContent = "Overlay sem chave de acesso.";
    errorDisplay.hidden = false;
    return;
  }

  requestInFlight = true;
  try {
    const response = await fetch("/api/state", {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha ao sincronizar.");
    state = result.state;
    errorDisplay.hidden = true;
    render();
  } catch (error) {
    errorDisplay.textContent = "Sem conexão com o painel.";
    errorDisplay.hidden = false;
  } finally {
    requestInFlight = false;
  }
}

syncState();
window.setInterval(syncState, 3000);
window.setInterval(render, 1000);
