// server/index.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import crypto from "crypto";
import cookieParser from "cookie-parser";

const app = express();
app.use(cookieParser());
app.use(cors());
app.use(express.json());

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI; // e.g. https://your-sandbox-id-3002.csb.app/auth/callback
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN; // e.g. https://your-sandbox-id-5173.csb.app

// super-light in-memory sessions (fine for sandbox/testing)
const sessions = new Map();
// Start login: redirect to Spotify
app.get("/auth/login", (_req, res) => {
  const state = crypto.randomBytes(8).toString("hex");
  const scopes = [
    "playlist-modify-public",
    "playlist-modify-private",
    "user-read-email",
    "user-read-private",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
  ].join(" ");

  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);

  res.cookie("st", state, { httpOnly: true, sameSite: "lax" });
  res.redirect(url.toString());
});

// Exchange code → tokens, store session, bounce back to front-end
app.get("/auth/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state || state !== req.cookies.st) {
      return res.status(400).send("Bad state");
    }

    const auth = Buffer.from(
      `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code.toString(),
      redirect_uri: REDIRECT_URI,
    });

    const r = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const tok = await r.json();
    if (!r.ok) {
      console.error(tok);
      return res.status(500).send("Token exchange failed");
    }

    // Grab user profile
    const meRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = await meRes.json();

    const sid = crypto.randomBytes(16).toString("hex");
    sessions.set(sid, {
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      expires_at: Date.now() + tok.expires_in * 1000 - 60_000,
      user: { id: me.id, name: me.display_name || me.id },
    });

    res.cookie("sid", sid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
    });
    res.redirect(`${FRONTEND_ORIGIN}/#logged-in=1`);
  } catch (e) {
    console.error(e);
    res.status(500).send("Auth failed");
  }
});

function requireAuth(req, res, next) {
  const sid = req.cookies.sid;
  if (!sid || !sessions.get(sid))
    return res.status(401).json({ error: "auth_required" });
  req.sid = sid;
  next();
}

async function getUserAccessToken(sid) {
  const s = sessions.get(sid);
  if (!s) return null;
  if (Date.now() < s.expires_at) return s.access_token;

  const auth = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: s.refresh_token,
  });

  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const tok = await r.json();
  if (!r.ok) {
    console.error("refresh failed", tok);
    return null;
  }
  s.access_token = tok.access_token;
  s.expires_at = Date.now() + tok.expires_in * 1000 - 60_000;
  return s.access_token;
}

app.get("/api/auth/status", requireAuth, (req, res) => {
  const s = sessions.get(req.sid);
  res.json({ user: s.user });
});
app.post("/api/spotify/save-playlist", requireAuth, async (req, res) => {
  try {
    const { title, trackIds } = req.body || {};
    if (!Array.isArray(trackIds) || !trackIds.length)
      return res.status(400).json({ error: "no_tracks" });

    const access = await getUserAccessToken(req.sid);
    const s = sessions.get(req.sid);
    const userId = s.user.id;

    // Create playlist
    const createRes = await fetch(
      `https://api.spotify.com/v1/users/${encodeURIComponent(
        userId
      )}/playlists`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: title || "My Mix",
          description: "Created with Mix Maker",
          public: false,
        }),
      }
    );
    const pl = await createRes.json();
    if (!createRes.ok) {
      console.error(pl);
      return res.status(500).json({ error: "create_failed" });
    }

    // Add tracks (100 max per call)
    const uris = trackIds.map((id) => `spotify:track:${id}`);
    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100);
      const addRes = await fetch(
        `https://api.spotify.com/v1/playlists/${pl.id}/tracks`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: chunk }),
        }
      );
      if (!addRes.ok) console.error(await addRes.json());
    }

    res.json({
      id: pl.id,
      url: pl.external_urls?.spotify,
      embedUrl: `https://open.spotify.com/embed/playlist/${pl.id}`,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "save_playlist_failed" });
  }
});
app.get("/api/spotify/token", requireAuth, async (req, res) => {
  const access = await getUserAccessToken(req.sid);
  res.json({ access_token: access });
});
// ---- quick diagnostics ----
app.get("/_debug/env", (_req, res) => {
  res.json({
    has_SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
    has_SPOTIFY_CLIENT_SECRET: !!process.env.SPOTIFY_CLIENT_SECRET,
    has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    node_version: process.version,
  });
});

app.get("/_debug/spotify-token", async (_req, res) => {
  try {
    const t = await getAppToken();
    res.json({ ok: true, token_preview: t ? t.slice(0, 12) + "…" : null });
  } catch (e) {
    res.status(500).json({ ok: false, message: String(e.message) });
  }
});

/* ---------------- OpenAI planner (no SDK) ---------------- */
/* ---------------- OpenAI planner (gpt-5, no SDK) ---------------- */
const OPENAI_KEY = process.env.OPENAI_API_KEY;

app.post("/api/plan", async (req, res) => {
  try {
    const { prompt, profile, ui } = req.body || {};
    console.log("Planner call. ui.instrumentalOnly =", !!ui?.instrumentalOnly);

    // HARD constraint from the UI checkbox (lyrics off)
    const uiInstrumental = !!ui?.instrumentalOnly;

    const system = [
      "You are an expert music mix planner that turns a short user request plus a profile into a strict JSON plan.",
      "Output STRICT JSON only (no markdown, comments, or extra keys).",
      "Schema fields: minutes (int 10..120), instrumentalOnly (bool), energy ('low'|'medium'|'high'),",
      "genresPreferred (string[]), keywords (string[]), allowExplicit (bool), excludeArtists (string[]), languages (string[]).",
      "Rules:",
      "- Treat ui.instrumentalOnly=true as a HARD constraint (must set instrumentalOnly=true).",
      "- Map the user's description to energy: sleep/meditate/reading → low; study/focus/lofi → low/medium; walk/drive/chill → medium; run/gym/party/dance → high.",
      "- Use profile.favoriteGenre, languages, doNotPlay, and allowExplicit as defaults unless user clearly overrides.",
      "- keywords should be search-ready tokens: mood words (e.g., 'uplifting','moody'), subgenres ('lo-fi','synthwave','deep house'), activity tags ('study','workout'), and era cues ('80s','90s','y2k') when relevant.",
      "- If user says 'no lyrics', prefer instrumental subgenres in keywords (instrumental, ambient, lo-fi beats, jazz trio, cinematic).",
      "- If minutes aren’t implied, pick 30.",
      "- Never include duplicates in arrays. Trim whitespace. Lowercase keywords/genres.",
      "Think carefully, but return only the final JSON per schema.",
    ].join(" ");

    const schema = {
      name: "MixPlan",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          minutes: { type: "integer", minimum: 10, maximum: 120 },
          instrumentalOnly: { type: "boolean" },
          energy: { type: "string", enum: ["low", "medium", "high"] },
          genresPreferred: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
          keywords: { type: "array", items: { type: "string" }, default: [] },
          allowExplicit: { type: "boolean" },
          excludeArtists: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
          languages: { type: "array", items: { type: "string" }, default: [] },
        },
        required: ["minutes", "instrumentalOnly", "energy"],
      },
    };

    const body = {
      model: "gpt-5",
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: JSON.stringify(
            {
              prompt,
              profile, // {favoriteGenre, energy, languages, allowExplicit, doNotPlay}
              ui, // {instrumentalOnly}
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: "json_schema", json_schema: schema },
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("OpenAI error:", data);
      return res.status(500).json({ error: "plan_failed_openai" });
    }

    // Extract the JSON text robustly
    let text = data.output_text;
    if (!text && Array.isArray(data.output)) {
      const c = data.output[0]?.content?.find?.(
        (x) => x.type === "output_text"
      );
      text = c?.text;
    }

    const plan = JSON.parse(text || "{}");

    // Enforce UI checkbox on the server (cannot be relaxed by the model)
    plan.instrumentalOnly = uiInstrumental;

    // Fill defaults from profile if the model omitted any
    // ✅ default to true if not provided
    if (plan.allowExplicit == null)
      plan.allowExplicit = profile?.allowExplicit ?? true;

    if (!Array.isArray(plan.excludeArtists) || !plan.excludeArtists.length)
      plan.excludeArtists = profile?.doNotPlay || [];
    if (!Array.isArray(plan.languages) || !plan.languages.length)
      plan.languages = profile?.languages || [];
    if (
      (!Array.isArray(plan.genresPreferred) || !plan.genresPreferred.length) &&
      profile?.favoriteGenre
    ) {
      plan.genresPreferred = [String(profile.favoriteGenre)];
    }

    // Normalize: lowercase keywords/genres, unique
    const dedupe = (arr = []) =>
      Array.from(new Set(arr.map((s) => String(s).trim()))).filter(Boolean);
    plan.genresPreferred = dedupe(plan.genresPreferred).map((s) =>
      s.toLowerCase()
    );
    plan.keywords = dedupe(plan.keywords).map((s) => s.toLowerCase());
    plan.excludeArtists = dedupe(plan.excludeArtists);

    // Bounds check minutes just in case
    if (
      typeof plan.minutes !== "number" ||
      plan.minutes < 10 ||
      plan.minutes > 120
    )
      plan.minutes = 30;

    res.json(plan);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "plan_failed" });
  }
});

/* ---------------- Spotify helpers ---------------- */
let appToken = null;
let appTokenExp = 0;

async function getAppToken() {
  const now = Date.now();

  // Reuse token if still valid
  if (appToken && now < appTokenExp - 15000) return appToken;

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  console.log("Fetching new Spotify token...");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error("Spotify token response parse error:", err);
    throw err;
  }

  if (!res.ok) {
    console.error("Spotify token failed:", res.status, data);
    throw new Error(
      `Spotify token failed: ${res.status} ${JSON.stringify(data)}`
    );
  }

  appToken = data.access_token;
  appTokenExp = Date.now() + data.expires_in * 1000;
  console.log("Spotify token acquired, expires in", data.expires_in, "seconds");

  return appToken;
}

// ---------- de-dupe helpers ----------
/* ===== DEDUPE HELPERS v2 (REPLACE OLD ONES) ===== */
function _toAscii(s = "") {
  try {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    return s;
  }
}
function _base(str = "") {
  return _toAscii(String(str).toLowerCase())
    .replace(/&/g, " and ")
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function _stripFeat(s = "") {
  return s
    .replace(/\b(feat|featuring|ft)\.\s*[^-()]+/gi, "")
    .replace(/\b(with|x)\s+[^-()]+/gi, "");
}
function _stripQualifiers(s = "") {
  return s
    .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, " ")
    .replace(
      /\s*-\s*(remaster(?:ed)?(?:\s*\d{2,4})?|remix|mix|edit|radio\s*edit|extended|live|acoustic|sped\s*up|slowed|nightcore|version|mono|stereo|demo|karaoke)\b.*$/i,
      " "
    );
}
function _normTitle(title = "") {
  return _base(_stripQualifiers(_stripFeat(title)));
}
function _normArtists(artistStr = "") {
  const s = _base(_stripFeat(artistStr));
  const parts = s.split(/\s*,\s*|\s*&\s*|\s+and\s+|\s+with\s+|\s+x\s+/i);
  return parts[0] || s; // primary artist only
}
function trackKey(t) {
  return `${_normArtists(t.artist)} • ${_normTitle(t.title)}`;
}
function uniqByIdAndKey(list) {
  const out = [],
    ids = new Set(),
    keys = new Set();
  for (const t of list) {
    if (!t) continue;
    const key = trackKey(t);
    if (ids.has(t.spotifyId) || keys.has(key)) continue;
    ids.add(t.spotifyId);
    keys.add(key);
    out.push(t);
  }
  return out;
}

function energyToRange(energy) {
  if (energy === "high") return [0.66, 1];
  if (energy === "low") return [0, 0.34];
  return [0.34, 0.74];
}
async function fetchLyrics(track) {
  try {
    const q = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
    }).toString();
    const url = `https://lrclib.net/api/get?${q}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.plainLyrics || j?.syncedLyrics || null;
  } catch {
    return null;
  }
}

async function classifyLyricsFitness({ lyrics, desired }, OPENAI_KEY) {
  if (!lyrics || !OPENAI_KEY) return { fit: "unknown", score: 0.0 };

  const system =
    "Score if these lyrics fit the desired vibe. Output JSON {fit:'yes'|'no'|'unknown', score:0..1} only.";
  const body = {
    model: "gpt-5",
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: JSON.stringify({ desired, lyrics: lyrics.slice(0, 4000) }),
      },
    ],
    response_format: { type: "json_object" },
  };
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  const text =
    data.output_text ||
    data.output?.[0]?.content?.find?.((x) => x.type === "output_text")?.text ||
    "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { fit: "unknown", score: 0.0 };
  }
}

// ---------- Target ranges & scoring ----------
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// closeness in [0..1] to a [lo, hi] range (1 = at center; 0 = far outside)
function closenessToRange(val, [lo, hi]) {
  if (val == null || Number.isNaN(val)) return 0.5;
  const mid = (lo + hi) / 2;
  const half = (hi - lo) / 2 || 1e-6;
  const d = Math.abs(val - mid) / half; // 0 at center, 1 at edge
  return clamp01(1 - d); // 1 center → 0 outside
}

// Map the plan + context into target feature bands
function buildTargets(plan, wantInstrumental) {
  const energy = plan?.energy || "medium";
  let tempo, energyR, dance, acoustic, valence;

  // baselines by energy
  if (energy === "high") {
    tempo = [130, 175];
    energyR = [0.66, 1.01];
    dance = [0.6, 1.01];
    acoustic = [0.0, 0.4];
    valence = [0.4, 0.9];
  } else if (energy === "low") {
    tempo = [55, 95];
    energyR = [0.0, 0.4];
    dance = [0.1, 0.55];
    acoustic = [0.4, 1.01];
    valence = [0.2, 0.7];
  } else {
    tempo = [90, 125];
    energyR = [0.35, 0.75];
    dance = [0.4, 0.85];
    acoustic = [0.2, 0.7];
    valence = [0.3, 0.8];
  }

  // keyword nudges
  const kw = (plan?.keywords || []).join(" ");
  const k = kw.toLowerCase();
  if (/study|focus|read|work\b/.test(k)) {
    tempo = [60, 105];
    energyR = [0.15, 0.5];
    dance = [0.2, 0.6];
    acoustic = [0.4, 1.01];
  }
  if (/sleep|meditat|yoga|calm|ambient/.test(k)) {
    tempo = [50, 85];
    energyR = [0.0, 0.35];
    dance = [0.0, 0.4];
    acoustic = [0.5, 1.01];
    valence = [0.2, 0.7];
  }
  if (/run|gym|cardio|workout|hiit|party|dance/.test(k)) {
    tempo = [120, 175];
    energyR = [0.6, 1.01];
    dance = [0.6, 1.01];
    acoustic = [0.0, 0.4];
  }
  if (/sad|moody|melancholy/.test(k)) valence = [0.1, 0.45];
  if (/uplift|happy|feel.?good|sunny/.test(k)) valence = [0.55, 0.95];

  // if user wants no lyrics, bias towards acoustic/lo-fi textures too
  if (wantInstrumental) {
    acoustic = [Math.max(acoustic[0], 0.35), 1.01];
  }

  return { tempo, energyR, dance, acoustic, valence };
}

// Weighted score for one track vs targets (uses Spotify audio features)
function scoreTrackAgainstTargets(
  track,
  feats,
  targets,
  { wantInstrumental, allowExplicit }
) {
  const f = feats.get(track.spotifyId);
  if (!f) return -1; // prefer tracks we have features for

  // hard constraints first
  if (allowExplicit === false && track.explicit) return -2;

  // instrumental enforcement is handled separately (keep it), but also reward
  let s = 0;
  s += 2.0 * closenessToRange(f.tempo, targets.tempo);
  s += 1.7 * closenessToRange(f.energy, targets.energyR);
  s += 1.3 * closenessToRange(f.danceability, targets.dance);
  s += 1.1 * closenessToRange(f.acousticness, targets.acoustic);
  s += 1.5 * closenessToRange(f.valence, targets.valence);

  if (wantInstrumental) s += 2.0 * (f.instrumentalness ?? 0);
  // avoid spoken-word if lyrics matter
  if (!wantInstrumental) s -= 1.0 * (f.speechiness ?? 0);

  // small boost for shorter remaining duration packing happens later
  s += 0.1 * clamp01(1 - (track.duration || 180) / 420);

  return s;
}

// language → market bias
const MARKET_BY_LANG = new Map([
  ["en", "US"],
  ["ko", "KR"],
  ["jp", "JP"],
  ["ja", "JP"],
  ["es", "ES"],
  ["fr", "FR"],
  ["de", "DE"],
  ["pt", "BR"],
  ["it", "IT"],
]);

function buildQueries(prompt, plan, profile) {
  const out = new Set();

  // base: up to 5 prompt words (no quotes)
  const base = (prompt || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");
  if (base) out.add(base);

  // genres + keywords as plain tokens
  const genres = [
    ...(plan?.genresPreferred || []),
    ...(profile?.favoriteGenre ? [profile.favoriteGenre] : []),
  ];
  for (const g of genres) {
    const s = String(g).trim();
    if (s) out.add(s); // <-- NO extra quotes
  }

  for (const k of (plan?.keywords || []).slice(0, 3)) {
    const s = String(k).trim();
    if (s) out.add(s); // <-- NO extra quotes
  }

  if (plan?.instrumentalOnly) out.add("instrumental");

  // strong defaults by energy so we always have usable queries
  const energy = plan?.energy || profile?.energy || "medium";
  if (out.size < 2) {
    if (energy === "high") {
      out.add("dance");
      out.add("workout");
      out.add("party");
    } else if (energy === "low") {
      out.add("chill");
      out.add("lofi");
      out.add("ambient");
    } else {
      out.add("chill");
      out.add("indie");
    }
  }

  return Array.from(out).slice(0, 4);
}

async function spotifySearchTracks(q, market = "US", limit = 20) {
  const token = await getAppToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", q);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", market);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));

  return (data.tracks?.items || []).map((t) => ({
    spotifyId: t.id,
    title: t.name,
    artist: t.artists?.map((a) => a.name).join(", "),
    duration: Math.round((t.duration_ms || 0) / 1000),
    explicit: !!t.explicit,
    preview: t.preview_url || null,
  }));
}

async function audioFeatures(ids) {
  const token = await getAppToken();
  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const out = new Map();
  for (const c of chunks) {
    const res = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${c.join(",")}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    (data.audio_features || []).forEach((f) => {
      if (f?.id) out.set(f.id, f);
    });
  }
  return out;
}
// -------- Fetch track metadata (ISRC) and de-dupe by ISRC --------
async function fetchTrackMeta(ids) {
  // ids: string[]
  const token = await getAppToken();
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const res = await fetch(
      `https://api.spotify.com/v1/tracks?ids=${chunk.join(",")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    (data.tracks || []).forEach((t) => {
      if (!t || !t.id) return;
      out.set(t.id, {
        isrc: t.external_ids?.isrc || null,
        name: t.name,
        artists: (t.artists || []).map((a) => a.name).join(", "),
      });
    });
  }
  return out; // Map<id, {isrc, name, artists}>
}

function dedupeByISRC(tracks, idToMeta, log = false) {
  const seenIsrc = new Set();
  const result = [];
  for (const t of tracks) {
    const meta = idToMeta.get(t.spotifyId);
    const isrc = meta?.isrc ? String(meta.isrc).toUpperCase() : null;
    if (isrc) {
      if (seenIsrc.has(isrc)) {
        if (log)
          console.log("[DEDUP:ISRC] drop", isrc, "→", t.artist, "-", t.title);
        continue;
      }
      seenIsrc.add(isrc);
    }
    result.push(t);
  }
  return result;
}

/* ---------------- Smarter mix (constraints enforced) ---------------- */
/* ---------------- Smarter mix (constraints enforced) ---------------- */
app.post("/api/spotify/mix", async (req, res) => {
  try {
    const { prompt, profile, plan, ui } = req.body || {};
    const wantInstrumental = !!(ui?.instrumentalOnly ?? plan?.instrumentalOnly);

    const firstLang = (
      plan?.languages?.[0] ||
      profile?.languages?.[0] ||
      "en"
    ).toLowerCase();
    const market = MARKET_BY_LANG.get(firstLang) || "US";

    // 1) Build query set and search
    const queries = buildQueries(prompt, plan, profile);
    const bags = await Promise.all(
      queries.map((q) => spotifySearchTracks(q, market, 20))
    );

    // 2) Pool + base filters + first de-dupe (by spotifyId AND normalized key)
    const pool = [];
    const seenIds = new Set();
    const seenKeys = new Set();
    const banned = (plan?.excludeArtists || []).map((a) => a.toLowerCase());

    for (const bag of bags) {
      for (const t of bag) {
        if (plan?.allowExplicit === false && t.explicit) continue;
        if (
          banned.length &&
          banned.some((b) => t.artist.toLowerCase().includes(b))
        )
          continue;
        const key = trackKey(t);
        if (seenIds.has(t.spotifyId) || seenKeys.has(key)) continue;
        seenIds.add(t.spotifyId);
        seenKeys.add(key);
        pool.push(t);
      }
    }

    // 3) Audio features
    const feats = await audioFeatures(pool.map((p) => p.spotifyId));

    // 4) Instrumental hard filter (if requested)
    let candidatePool = pool.filter((t) => {
      if (!wantInstrumental) return true;
      const f = feats.get(t.spotifyId);
      if (f) return (f.instrumentalness ?? 0) >= 0.9;
      return (t.title || "").toLowerCase().includes("instrumental");
    });
    candidatePool = uniqByIdAndKey(candidatePool);

    // 4b) If too few instrumentals, fetch more targeted results and relax threshold
    if (wantInstrumental && candidatePool.length < 8) {
      const hardInstQueries = [
        "lofi instrumental",
        "ambient instrumental",
        "piano instrumental",
        "jazz trio instrumental",
        "cinematic instrumental",
      ];
      const moreBags = await Promise.all(
        hardInstQueries.map((q) => spotifySearchTracks(q, market, 15))
      );
      for (const bag of moreBags) {
        for (const t of bag) {
          const key = trackKey(t);
          if (seenIds.has(t.spotifyId) || seenKeys.has(key)) continue;
          seenIds.add(t.spotifyId);
          seenKeys.add(key);
          pool.push(t);
        }
      }
      // features for any new ids
      const moreIds = pool
        .filter((p) => !feats.has(p.spotifyId))
        .map((p) => p.spotifyId);
      if (moreIds.length) {
        const extraFeats = await audioFeatures(moreIds);
        for (const [id, f] of extraFeats) feats.set(id, f);
      }
      candidatePool = pool.filter((t) => {
        const f = feats.get(t.spotifyId);
        return f
          ? (f.instrumentalness ?? 0) >= 0.8
          : (t.title || "").toLowerCase().includes("instrumental");
      });
      candidatePool = uniqByIdAndKey(candidatePool);
    }

    // 4c) Broad fallback if still nothing
    if (candidatePool.length === 0) {
      const primaryGenre =
        plan?.genresPreferred?.[0] ||
        profile?.favoriteGenre ||
        (wantInstrumental ? "lofi" : "pop");

      const fallbackQs = wantInstrumental
        ? ["instrumental", "lofi beats", "ambient", "piano instrumental"]
        : [primaryGenre, "chill", "indie", "pop"];

      const extra = await Promise.all(
        fallbackQs.map((q) => spotifySearchTracks(q, market, 25))
      );
      for (const bag of extra) {
        for (const t of bag) {
          const key = trackKey(t);
          if (seenIds.has(t.spotifyId) || seenKeys.has(key)) continue;
          seenIds.add(t.spotifyId);
          seenKeys.add(key);
          pool.push(t);
        }
      }
      const newIds2 = pool
        .filter((p) => !feats.has(p.spotifyId))
        .map((p) => p.spotifyId);
      if (newIds2.length) {
        const extraFeats = await audioFeatures(newIds2);
        for (const [id, f] of extraFeats) feats.set(id, f);
      }
      candidatePool = uniqByIdAndKey(pool);
    }

    // 5) Score (tempo/energy/danceability/acousticness/valence + instrumentality)
    const targets = buildTargets(plan, wantInstrumental);
    const allowExplicit = plan?.allowExplicit ?? profile?.allowExplicit ?? true;

    // Keep tracks even if features are missing: give them a neutral score.
    // Only hard-drop explicit tracks when explicit content is not allowed.
    let scoredPairs = candidatePool.map((t) => {
      const raw = scoreTrackAgainstTargets(t, feats, targets, {
        wantInstrumental,
        allowExplicit,
      });
      const s = !allowExplicit && t.explicit ? -999 : raw < 0 ? 0.35 : raw; // neutral ≈ 0.35
      return { t, s };
    });

    let ordered = scoredPairs
      .filter((x) => x.s > -900) // drop only explicit violations
      .sort((a, b) => b.s - a.s)
      .map((x) => x.t);

    if (!ordered.length) {
      // if scoring somehow nuked everything, keep the candidates
      ordered = candidatePool.length ? candidatePool.slice() : pool.slice();
    }

    // 6) Greedy pack with strict uniqueness
    const targetSec = Math.max(10, Math.min(120, plan?.minutes || 30)) * 60;
    const chosenIds = new Set();
    const chosenKeys = new Set();
    let picked = [];
    let remain = targetSec;

    for (const t of ordered) {
      const key = trackKey(t);
      if (chosenIds.has(t.spotifyId) || chosenKeys.has(key)) continue;
      if (t.duration <= remain) {
        picked.push(t);
        chosenIds.add(t.spotifyId);
        chosenKeys.add(key);
        remain -= t.duration;
      }
      if (remain <= 20) break;
    }

    if (picked.length === 0) {
      picked = uniqByIdAndKey(ordered).slice(0, 12);
    }

    // 7) De-dupe again (keys) + ISRC-level de-dupe
    let finalTracks = uniqByIdAndKey(picked);

    // If packing found nothing, try ordered first
    if (!finalTracks.length) {
      finalTracks = uniqByIdAndKey(ordered).slice(0, 12);
    }

    const dedupeIsrc = async (list) => {
      try {
        const idToMeta = await fetchTrackMeta(list.map((t) => t.spotifyId));
        const logIt = process.env.LOG_DEDUP === "1";
        return dedupeByISRC(list, idToMeta, logIt);
      } catch (e) {
        console.warn("ISRC dedupe skipped:", e?.message || e);
        return list;
      }
    };

    // ISRC de-dupe the current set
    finalTracks = await dedupeIsrc(finalTracks);

    // Last-resort fallback (respect instrumentalOnly) + de-dupe again
    if (!finalTracks.length) {
      const source = wantInstrumental ? candidatePool : pool;
      const fallback = uniqByIdAndKey(source).slice(0, 12);
      finalTracks = await dedupeIsrc(fallback);
      if (!finalTracks.length) finalTracks = fallback; // absolute last guard
    }

    // 8) Response
    const mix = {
      title: `${
        prompt?.trim() ? prompt.trim().slice(0, 36) : "Custom"
      } · ${Math.round(targetSec / 60)}m`,
      prompt,
      tracks: finalTracks.map((t) => {
        const f = feats.get(t.spotifyId) || {};
        const e = f.energy ?? 0.5;
        const energyTxt = e >= 0.66 ? "high" : e <= 0.34 ? "low" : "medium";
        return {
          id: t.spotifyId,
          title: t.title,
          artist: t.artist,
          genre: "",
          language: "en",
          energy: energyTxt,
          explicit: t.explicit,
          tags: [],
          duration: t.duration,
          decade: 0,
          spotifyId: t.spotifyId,
        };
      }),
    };

    console.log("[MIX]", {
      queries,
      pool: pool.length,
      candidates: candidatePool.length,
      ordered: ordered.length,
      picked: finalTracks.length,
      market,
      wantInstrumental,
    });

    res.json(mix);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "spotify_mix_failed" });
  }
});

// --- version probe (place ABOVE app.listen) ---
const BUILD_ID = Math.random().toString(36).slice(2);
app.get("/__version", (_req, res) => {
  res.json({ build: BUILD_ID, time: new Date().toISOString() });
});
console.log("BUILD_ID:", BUILD_ID);

/* ---------------- Health check ---------------- */
app.get("/", (_req, res) => res.send("API OK"));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ Server ready on http://localhost:${PORT}`);
});
