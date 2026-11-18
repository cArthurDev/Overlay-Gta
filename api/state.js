const { timingSafeEqual } = require("node:crypto");

function matchesSecret(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

async function supabaseRequest(path, options = {}) {
  const baseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceKey) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_SECRET_KEY (ou SUPABASE_SERVICE_ROLE_KEY) na Vercel.");
  }

  let response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    console.error("Supabase indisponível:", error);
    throw new Error("Não foi possível conectar ao Supabase.");
  }

  if (!response.ok) {
    const details = await response.text();
    console.error("Erro de resposta do Supabase:", response.status, details);
    throw new Error("O Supabase recusou a operação. Confira o SQL e as variáveis de ambiente.");
  }

  return response.json();
}

async function readState() {
  const rows = await supabaseRequest(
    "overlay_state?select=id,mission_count,mission_total,accumulated_seconds,timer_started_at,updated_at&id=eq.true",
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Estado não encontrado. Execute o SQL de configuração no Supabase.");
  }
  return rows[0];
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "Método não permitido.");
  }

  const expectedSecret = process.env.OVERLAY_SECRET;
  const authorization = req.headers.authorization || "";
  const providedSecret = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!matchesSecret(providedSecret, expectedSecret)) {
    return sendError(res, 401, "Chave inválida. Confira o OVERLAY_SECRET.");
  }

  try {
    if (req.method === "GET") {
      const state = await readState();
      return res.status(200).json({ state });
    }

    const body = parseBody(req);
    if (!body || typeof body.action !== "string") {
      return sendError(res, 400, "Envie uma ação válida.");
    }
    const supportedActions = new Set([
      "start",
      "pause",
      "reset_timer",
      "add_time",
      "increment_mission",
      "decrement_mission",
      "reset_missions",
      "set_mission_total",
    ]);
    if (!supportedActions.has(body.action)) {
      return sendError(res, 400, "Ação não reconhecida.");
    }
    if (body.action === "set_mission_total"
        && (!Number.isInteger(body.value) || body.value < 1 || body.value > 999)) {
      return sendError(res, 400, "A meta de missões deve ser um número inteiro entre 1 e 999.");
    }
    if (body.action === "add_time" && ![600, 1800, 3600].includes(body.value)) {
      return sendError(res, 400, "O tempo adicionado deve ser 10, 30 ou 60 minutos.");
    }

    const rows = await supabaseRequest("rpc/apply_overlay_action", {
      method: "POST",
      body: JSON.stringify({ p_action: body.action, p_value: body.value ?? null }),
    });
    const updatedState = Array.isArray(rows) ? rows[0] : rows;
    if (!updatedState) throw new Error("O Supabase não retornou o estado atualizado.");
    return res.status(200).json({ state: updatedState });
  } catch (error) {
    console.error("Falha na API da overlay:", error);
    const isConfigurationError = error.message.includes("Configure ")
      || error.message.includes("Estado não encontrado");
    return sendError(res, isConfigurationError ? 503 : 502, error.message);
  }
};
