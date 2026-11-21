const collaborators = require("../overlay-collaborators");

let cachedAccessToken = "";
let accessTokenExpiresAt = 0;
let cachedProfiles = null;
let profilesExpiresAt = 0;

function getTwitchLogin(value) {
  try {
    const url = new URL(value);
    if (!["www.twitch.tv", "twitch.tv"].includes(url.hostname.toLowerCase())) return null;
    const login = url.pathname.split("/").filter(Boolean)[0] || "";
    return /^[a-z0-9_]{1,25}$/i.test(login) ? login.toLowerCase() : null;
  } catch {
    return null;
  }
}

async function getAppAccessToken(clientId, clientSecret) {
  if (cachedAccessToken && accessTokenExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });
  if (!response.ok) {
    throw new Error(`A autenticação da Twitch respondeu HTTP ${response.status}.`);
  }

  const result = await response.json();
  if (typeof result.access_token !== "string" || !Number.isFinite(result.expires_in)) {
    throw new Error("A Twitch retornou um token de aplicação inválido.");
  }

  cachedAccessToken = result.access_token;
  accessTokenExpiresAt = Date.now() + result.expires_in * 1000;
  return cachedAccessToken;
}

async function readProfiles(clientId, clientSecret) {
  if (cachedProfiles && profilesExpiresAt > Date.now()) return cachedProfiles;

  const logins = [...new Set(collaborators
    .map((collaborator) => getTwitchLogin(collaborator.url))
    .filter(Boolean))];
  const accessToken = await getAppAccessToken(clientId, clientSecret);
  const profiles = Object.create(null);

  for (let offset = 0; offset < logins.length; offset += 100) {
    const url = new URL("https://api.twitch.tv/helix/users");
    logins.slice(offset, offset + 100).forEach((login) => {
      url.searchParams.append("login", login);
    });

    const response = await fetch(url, {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`A consulta de perfis da Twitch respondeu HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (!Array.isArray(result.data)) {
      throw new Error("A Twitch retornou uma lista de perfis inválida.");
    }

    result.data.forEach((user) => {
      if (typeof user.login === "string" && typeof user.profile_image_url === "string") {
        profiles[user.login.toLowerCase()] = user.profile_image_url;
      }
    });
  }

  cachedProfiles = profiles;
  profilesExpiresAt = Date.now() + 60 * 60 * 1000;
  return profiles;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(503).json({
      error: "Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET na Vercel para carregar as fotos.",
    });
  }

  try {
    const profiles = await readProfiles(clientId, clientSecret);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ profiles });
  } catch (error) {
    console.error("Falha ao carregar perfis da Twitch:", error);
    return res.status(502).json({ error: "Não foi possível carregar os perfis da Twitch." });
  }
};
