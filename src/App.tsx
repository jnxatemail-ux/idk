import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useContext,
  createContext,
  useId,
} from "react";

import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";

// In Codesandbox the frontend runs on port 5173 and the backend on 3002.
// Derive the API base URL from the current origin unless an explicit override
// is provided via VITE_API_BASE.
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (window.location.origin.includes("csb.app")
    ? window.location.origin.replace(/-\d+(?=\.csb\.app)/, "-3002")
    : window.location.origin.replace(/:\d+$/, ":3002"));
// TEMP: expose so you can see it in the console
console.log("API_BASE =", API_BASE);
(window as any).API_BASE = API_BASE;

// =========================== Auth (demo-ready) ===========================
export type User = { id: string; name: string; email: string } | null;

type AuthContextType = {
  user: User;
  signInDemo: (name: string, email: string) => Promise<void>;
  signOut: () => Promise<void>;
  // signInWithGoogle?: () => Promise<void>; // TODO(provider)
};
const AuthContext = createContext<AuthContextType | undefined>(undefined);
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useLocalStorage<User>("moodmix_user", null);
  const signInDemo = async (name: string, email: string) =>
    setUser({ id: "demo_" + Date.now(), name, email });
  const signOut = async () => setUser(null);
  return (
    <AuthContext.Provider value={{ user, signInDemo, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

function SpotifyLoginButton({ loggedIn }: { loggedIn?: boolean }) {
  return (
    <button
      onClick={() => (window.location.href = `${API_BASE}/auth/login`)}
      className={`px-2 py-1 text-xs rounded-lg border bg-zinc-900/70 inline-flex items-center ${
        loggedIn
          ? "border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
          : "border-zinc-700/80"
      }`}
    >
      {loggedIn && (
        <span
          className="mr-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"
          aria-hidden
        />
      )}
      Spotify
    </button>
  );
}

function AppleMusicLoginButton({
  loggedIn,
  onLogin,
}: {
  loggedIn?: boolean;
  onLogin: () => void;
}) {
  return (
    <button
      onClick={onLogin}
      className={`px-2 py-1 text-xs rounded-lg border bg-zinc-900/70 inline-flex items-center ${
        loggedIn
          ? "border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
          : "border-zinc-700/80"
      }`}
    >
      {loggedIn && (
        <span
          className="mr-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"
          aria-hidden
        />
      )}
      Apple Music
    </button>
  );
}

function YouTubeMusicLoginButton({
  loggedIn,
  onLogin,
}: {
  loggedIn?: boolean;
  onLogin: () => void;
}) {
  return (
    <button
      onClick={onLogin}
      className={`px-2 py-1 text-xs rounded-lg border bg-zinc-900/70 inline-flex items-center ${
        loggedIn
          ? "border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"
          : "border-zinc-700/80"
      }`}
    >
      {loggedIn && (
        <span
          className="mr-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"
          aria-hidden
        />
      )}
      YouTube Music
    </button>
  );
}

async function saveToSpotify(mix: Mix) {
  const r = await fetch(`${API_BASE}/api/spotify/save-playlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // IMPORTANT: send cookies
    body: JSON.stringify({
      title: mix.title,
      trackIds: mix.tracks.map((t) => t.spotifyId ?? t.id),
    }),
  });
  if (!r.ok) throw new Error("save failed");
  return r.json(); // { id, url, embedUrl }
}

// ========================= Accent palettes (full) =========================
// ========================= Accent palettes (full) =========================
type Accent = "indigo" | "emerald" | "rose" | "amber" | "sky";
const ACCENTS: Record<
  Accent,
  {
    gradientText: string;
    button: string;
    chipActive: string;
    cardBorder: string;
    ring: string;
    glowHero: string; // <- always-on hero glow now
    glowCard: string;
    softBg: string;
  }
> = {
  indigo: {
    gradientText: "bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-sky-300",
    button: "bg-indigo-600 hover:bg-indigo-500",
    chipActive: "border-indigo-400 bg-indigo-400/10",
    cardBorder: "border-indigo-400/25 shadow-[0_0_0_1px_rgba(99,102,241,0.25)]",
    ring: "hover:ring-2 hover:ring-indigo-400/50",
    // was: "shadow-[0_0_22px_rgba(99,102,241,0.35)] hover:shadow-[0_0_34px_rgba(99,102,241,0.5)]"
    glowHero: "shadow-[0_0_34px_rgba(99,102,241,0.50)]",
    glowCard:
      "shadow-[0_0_10px_rgba(99,102,241,0.28)] hover:shadow-[0_0_16px_rgba(99,102,241,0.40)]",
    softBg:
      "bg-[radial-gradient(120%_160%_at_0%_0%,rgba(99,102,241,0.10),transparent_60%)]",
  },
  emerald: {
    gradientText: "bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300",
    button: "bg-emerald-600 hover:bg-emerald-500",
    chipActive: "border-emerald-400 bg-emerald-400/10",
    cardBorder:
      "border-emerald-400/25 shadow-[0_0_0_1px_rgba(52,211,153,0.25)]",
    ring: "hover:ring-2 hover:ring-emerald-400/50",
    glowHero: "shadow-[0_0_34px_rgba(16,185,129,0.50)]",
    glowCard:
      "shadow-[0_0_10px_rgba(16,185,129,0.28)] hover:shadow-[0_0_16px_rgba(16,185,129,0.40)]",
    softBg:
      "bg-[radial-gradient(120%_160%_at_0%_0%,rgba(16,185,129,0.10),transparent_60%)]",
  },
  rose: {
    gradientText: "bg-gradient-to-r from-rose-300 via-fuchsia-300 to-pink-300",
    button: "bg-rose-600 hover:bg-rose-500",
    chipActive: "border-rose-400 bg-rose-400/10",
    cardBorder: "border-rose-400/25 shadow-[0_0_0_1px_rgba(251,113,133,0.25)]",
    ring: "hover:ring-2 hover:ring-rose-400/50",
    glowHero: "shadow-[0_0_34px_rgba(244,63,94,0.50)]",
    glowCard:
      "shadow-[0_0_10px_rgba(244,63,94,0.28)] hover:shadow-[0_0_16px_rgba(244,63,94,0.40)]",
    softBg:
      "bg-[radial-gradient(120%_160%_at_0%_0%,rgba(244,63,94,0.10),transparent_60%)]",
  },
  amber: {
    gradientText:
      "bg-gradient-to-r from-amber-300 via-orange-300 to-yellow-300",
    button: "bg-amber-600 hover:bg-amber-500",
    chipActive: "border-amber-400 bg-amber-400/10",
    cardBorder: "border-amber-400/25 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]",
    ring: "hover:ring-2 hover:ring-amber-400/50",
    glowHero: "shadow-[0_0_34px_rgba(245,158,11,0.50)]",
    glowCard:
      "shadow-[0_0_10px_rgba(245,158,11,0.28)] hover:shadow-[0_0_16px_rgba(245,158,11,0.40)]",
    softBg:
      "bg-[radial-gradient(120%_160%_at_0%_0%,rgba(245,158,11,0.10),transparent_60%)]",
  },
  sky: {
    gradientText: "bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300",
    button: "bg-sky-600 hover:bg-sky-500",
    chipActive: "border-sky-400 bg-sky-400/10",
    cardBorder: "border-sky-400/25 shadow-[0_0_0_1px_rgba(56,189,248,0.25)]",
    ring: "hover:ring-2 hover:ring-sky-400/50",
    glowHero: "shadow-[0_0_34px_rgba(2,132,199,0.50)]",
    glowCard:
      "shadow-[0_0_10px_rgba(2,132,199,0.28)] hover:shadow-[0_0_16px_rgba(2,132,199,0.40)]",
    softBg:
      "bg-[radial-gradient(120%_160%_at_0%_0%,rgba(2,132,199,0.10),transparent_60%)]",
  },
};

/**
 * MoodMix — Polished UI/UX (export/import removed)
 * - Full visual polish (glows, accent borders, gradients)
 * - Persistent theme & accent
 * - Profile with Do-Not-Play chips
 * - Saved Library (save/delete)
 * - Demo sign-in modal; header switches to avatar + sign-out
 */

export default function App() {
  return (
    <AuthProvider>
      <RootApp />
    </AuthProvider>
  );
}

function RootApp() {
  // Responsive by aspect ratio
  const { width, height } = useWindowSize();
  const aspect = useMemo(() => (height ? width / height : 1), [width, height]);
  const bucket = useMemo(() => {
    if (!height) return "square" as const;
    if (aspect >= 1.4) return "wide" as const;
    if (aspect <= 0.85) return "tall" as const;
    return "square" as const;
  }, [aspect, height]);

  // Theme & Accent (persisted)
  const [theme] = useLocalStorage<"dark" | "light">(
    "moodmix_theme",
    "dark"
  );
  const [accent, setAccent] = useLocalStorage<Accent>(
    "moodmix_accent",
    "indigo"
  );
  const ac = useMemo(() => ACCENTS[accent], [accent]);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  // Accent → gradient background for buttons
  const GRAD_BTN: Record<Accent, string> = {
    indigo: "bg-gradient-to-br from-indigo-500 to-sky-400",
    emerald: "bg-gradient-to-br from-emerald-500 to-teal-400",
    rose: "bg-gradient-to-br from-rose-500 to-fuchsia-400",
    amber: "bg-gradient-to-br from-amber-500 to-orange-400",
    sky: "bg-gradient-to-br from-sky-500 to-cyan-400",
  };

  async function startPlayback() {
    if (!currentMix || !deviceId) return;

    const tokRes = await fetch(`${API_BASE}/api/spotify/token`, {
      credentials: "include",
    });
    if (!tokRes.ok) {
      alert("Please log in to Spotify first.");
      return;
    }
    const { access_token } = await tokRes.json();

    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: currentMix.tracks.map(
            (t) => `spotify:track:${t.spotifyId ?? t.id}`
          ),
        }),
      }
    );
  }

  // App state
  const [prompt, setPrompt] = useState("");
  const [targetMinutes, setTargetMinutes] = useState<number | "">(30);
  const [instrumentalOnly, setInstrumentalOnly] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [currentMix, setCurrentMix] = useState<Mix | null>(null);
  const [mixes, setMixes] = useLocalStorage<Mix[]>("moodmix_mixes", []);
  const [profile, setProfile] = useLocalStorage<UserProfile>(
    "moodmix_profile",
    {
      name: "Guest",
      age: "",
      favoriteGenre: "",
      languages: ["en"],
      energy: "medium",
      allowExplicit: false,
      doNotPlay: [],
    }
  );
  type Service = "spotify" | "apple" | "youtube";
  const [serviceLogins, setServiceLogins] = useState<Record<Service, boolean>>({
    spotify: false,
    apple: false,
    youtube: false,
  });

  const handleAppleLogin = () => {
    setServiceLogins((s) => ({ ...s, apple: true }));
    try {
      localStorage.setItem("moodmix_login_apple", "1");
    } catch {}
  };
  const handleYouTubeLogin = () => {
    setServiceLogins((s) => ({ ...s, youtube: true }));
    try {
      localStorage.setItem("moodmix_login_youtube", "1");
    } catch {}
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/api/auth/status`, {
          credentials: "include",
        });
        if (r.ok) setServiceLogins((s) => ({ ...s, spotify: true }));
      } catch {}
    })();

    const match = window.location.hash.match(/logged-in=([^&]+)/);
    let svc = match ? match[1] : null;
    if (svc) {
      if (svc === "1") svc = "spotify";
      setServiceLogins((s) => ({ ...s, [svc as Service]: true }));
      try {
        localStorage.setItem(`moodmix_login_${svc}`, "1");
      } catch {}
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    } else {
      for (const s of ["spotify", "apple", "youtube"] as const) {
        try {
          if (localStorage.getItem(`moodmix_login_${s}`) === "1") {
            setServiceLogins((v) => ({ ...v, [s]: true }));
          }
        } catch {}
      }
    }
  }, []);
  useEffect(() => {
    const onReady = async () => {
      // Needs a logged-in Spotify cookie from /auth/callback
      const tokRes = await fetch(`${API_BASE}/api/spotify/token`, {
        credentials: "include",
      });
      if (!tokRes.ok) return; // not logged in yet
      const { access_token } = await tokRes.json();

      const player = new (window as any).Spotify.Player({
        name: "YEET music",
        getOAuthToken: (cb: (t: string) => void) => cb(access_token),
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
      });

      player.connect();
    };

    if ((window as any).Spotify) onReady();
    else (window as any).onSpotifyWebPlaybackSDKReady = onReady;

    return () => {
      (window as any).onSpotifyWebPlaybackSDKReady = null;
    };
  }, []);
  const { user, signInDemo, signOut } = useAuth();

  // Generate mix

  const createMix = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);

    try {
      // quick local plan (we can add OpenAI later)
      const localPlan = {
        minutes: Number(targetMinutes) || 30,
        instrumentalOnly,
        energy: profile.energy,
      };
      const res = await fetch(`${API_BASE}/api/spotify/mix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          profile,
          plan: localPlan, // minutes, energy, instrumentalOnly (soft)
          ui: { instrumentalOnly }, // <-- HARD constraint flag
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Mix error:", res.status, text);
        alert(`Mix failed: ${res.status} ${text}`);
        return;
      }

      const mix: Mix = await res.json();
      setCurrentMix(mix); // updates your "Now Playing" section
    } catch (e) {
      console.error(e);
      alert("Could not build Spotify mix.");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveCurrentMix = () => {
    if (!currentMix) return;
    const saved: Mix = { ...currentMix, id: "mix_" + Date.now() };
    setMixes([saved, ...mixes]);
  };

  const deleteMix = (id: string) => {
    setMixes(mixes.filter((m) => m.id !== id));
    if (currentMix?.id === id) setCurrentMix(null);
  };

  const renameMix = (id: string, title: string) => {
    setMixes(mixes.map((m) => (m.id === id ? { ...m, title } : m)));
    if (currentMix?.id === id) setCurrentMix({ ...currentMix, title });
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 min-h-screen">
      {/* Background gradient + blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_20%_0%,rgba(99,102,241,0.20),transparent_60%),radial-gradient(40%_40%_at_100%_20%,rgba(236,72,153,0.15),transparent_60%)]" />
        <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/20 to-sky-400/20 blur-2xl" />
        <div className="absolute -bottom-16 right-0 h-72 w-72 rounded-full bg-gradient-to-tr from-fuchsia-500/15 to-purple-500/15 blur-2xl" />
      </div>

      <header className="relative px-4 py-5 sm:py-7 lg:py-8 border-b border-zinc-800/70 backdrop-blur-sm bg-zinc-950/40 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2">
        {/* LEFT: music service logins */}
        <div className="hidden sm:flex items-center gap-2">
          <SpotifyLoginButton loggedIn={serviceLogins.spotify} />
          <AppleMusicLoginButton
            loggedIn={serviceLogins.apple}
            onLogin={handleAppleLogin}
          />
          <YouTubeMusicLoginButton
            loggedIn={serviceLogins.youtube}
            onLogin={handleYouTubeLogin}
          />
        </div>

        {/* CENTER: Logo (stays centered) */}
        <div className="justify-self-center origin-center scale-100 md:scale-[1.25] lg:scale-[1.4]">
          <Logo accent={accent} size={30} line1="YEET" line2="music" />
        </div>

        {/* RIGHT: Desktop controls (unchanged) */}
        <div className="hidden sm:flex justify-self-end items-center gap-2">
          <AccentPicker value={accent} onChange={setAccent} />
          {user ? (
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-sky-400"
                title={user.name}
              />
              <span className="text-sm text-zinc-300 max-w-[10ch] truncate">
                {user.name}
              </span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1 rounded border border-zinc-700/80 hover:bg-zinc-900/70 transition"
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className={`${
                GRAD_BTN?.[accent] ?? "bg-indigo-600"
              } text-white px-3 py-1 rounded-xl shadow-sm active:scale-95 transition focus:outline-none focus:ring-2 focus:ring-white/40`}
            >
              Sign in
            </button>
          )}
        </div>

        {/* MOBILE: Accent picker centered UNDER the logo */}
        <div className="sm:hidden mt-2 flex items-center justify-center">
          <AccentPicker value={accent} onChange={setAccent} />
        </div>

        {/* MOBILE: music service logins pinned to top-left */}
        <div className="sm:hidden absolute left-3 top-3 flex gap-2">
          <SpotifyLoginButton loggedIn={serviceLogins.spotify} />
          <AppleMusicLoginButton
            loggedIn={serviceLogins.apple}
            onLogin={handleAppleLogin}
          />
          <YouTubeMusicLoginButton
            loggedIn={serviceLogins.youtube}
            onLogin={handleYouTubeLogin}
          />
        </div>

        {/* MOBILE: ONLY the sign button pinned to top-right */}
        <div className="sm:hidden absolute right-3 top-3">
          {user ? (
            <button
              onClick={() => signOut()}
              className="px-3 py-1 rounded-lg text-xs border border-zinc-700/80 bg-zinc-900/70"
            >
              Sign out
            </button>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className={`${
                GRAD_BTN?.[accent] ?? "bg-indigo-600"
              } text-white px-3 py-1 rounded-lg text-xs shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/40`}
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-4 sm:px-6 pt-14 pb-10 sm:pt-24 sm:pb-14">
        <Card
          data-accent={accent}
          className={`hero-glow mx-auto max-w-6xl ${ac.cardBorder} bg-zinc-800/60 backdrop-blur-md shadow-xl ${ac.glowHero}`}
        >
          <CardContent className="px-4 sm:px-8 pt-14 sm:pt-28 pb-12 sm:pb-28 text-center">
            <div className="flex items-center justify-center flex-wrap gap-3">
              <h1
                className={`mt-2 sm:mt-0 text-[28px] sm:text-[44px] font-semibold tracking-tight bg-clip-text text-transparent ${ac.gradientText}`}
              >
                What are you up to?
              </h1>
            </div>

            <div className="mt-3 sm:mt-3 flex justify-center">
              <ProvidersRow />
            </div>

            <p className="mt-2 sm:mt-2 text-sm sm:text-base text-zinc-400">
              I’ll generate a playlist tailored to your situation.
            </p>

            <div className="mt-6 sm:mt-6 grid gap-3">
              {/* input + button */}
              {/* input + button */}
              {/* Input + Button (stack on mobile, row on sm+) */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center justify-center">
                <label className="sr-only" htmlFor="mood-input">
                  Describe your mood/activity/place
                </label>
                <input
                  id="mood-input"
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., high-energy night run by the river, no lyrics"
                  className="w-full max-w-3xl h-12 sm:h-14 text-base sm:text-lg p-3 sm:p-4 rounded-xl border border-zinc-700 bg-transparent placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 transition"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") createMix();
                  }}
                />
                <Button
                  onClick={createMix}
                  className={`${ac.button} w-full sm:w-auto px-5 sm:px-6 py-3 sm:py-4 rounded-xl text-white text-base transition active:scale-95`}
                  disabled={!prompt.trim() || !targetMinutes || isGenerating}
                  aria-busy={isGenerating}
                >
                  {isGenerating ? <Spinner /> : "Create Mix"}
                </Button>
              </div>

              {/* Options row (wraps on mobile) */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <ToggleField
                  label="Instrumental only (no lyrics)"
                  checked={instrumentalOnly}
                  onChange={setInstrumentalOnly}
                />
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label="Quick length"
                >
                  {[15, 30, 45, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setTargetMinutes(m)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${
                        Number(targetMinutes) === m
                          ? ac.chipActive
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                      aria-pressed={Number(targetMinutes) === m}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <main className="px-4 sm:px-6 pb-8 space-y-6">
        {/* Now Playing */}
        <section className="p-0">
          <Card
            className={`mx-4 sm:mx-6 mb-6 ${ac.cardBorder} ${ac.softBg} bg-zinc-800/60 backdrop-blur-md shadow-2xl ${ac.glowCard}`}
          >
            <CardHeader className="pb-2">
              <CardTitle>Now Playing</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {currentMix ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded bg-gradient-to-br from-fuchsia-500 to-purple-700 shadow-inner" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{currentMix.title}</p>
                      <p className="text-xs text-zinc-400 truncate">
                        {currentMix.tracks.length} tracks ·{" "}
                        {Math.round(totalDuration(currentMix) / 60)} min
                      </p>
                    </div>
                    <div className="ml-auto flex gap-2">
                      <Button
                        onClick={saveCurrentMix}
                        variant="outline"
                        className="border-zinc-600 hover:border-indigo-400/60"
                      >
                        Save (local)
                      </Button>

                      <Button
                        onClick={async () => {
                          if (!currentMix) return;
                          try {
                            const res = await saveToSpotify(currentMix);
                            setEmbedUrl(res.embedUrl ?? null);
                          } catch (e) {
                            alert(
                              "Please log in to Spotify (use the ‘Log in with Spotify’ button in the header)."
                            );
                          }
                        }}
                        className="bg-green-600 hover:bg-green-500"
                      >
                        Save to Spotify
                      </Button>

                      <Button
                        onClick={startPlayback}
                        disabled={!deviceId || !currentMix}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
                        title={
                          !deviceId
                            ? "Login and wait for player to be ready"
                            : ""
                        }
                      >
                        Play here
                      </Button>
                    </div>
                  </div>
                  <ul
                    className={`max-h-56 overflow-auto divide-y divide-zinc-800 rounded border border-zinc-800 bg-zinc-950/30 ${ac.glowCard}`}
                  >
                    {currentMix.tracks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center gap-3 p-2 hover:bg-zinc-800/40 transition"
                      >
                        <span className="h-8 w-8 rounded bg-zinc-800" />
                        <div className="min-w-0">
                          <p className="truncate text-sm">{t.title}</p>
                          <p className="truncate text-xs text-zinc-500">
                            {t.artist} · {t.genre} · {t.energy}
                          </p>
                        </div>
                        <span className="ml-auto text-xs text-zinc-500">
                          {formatSeconds(t.duration)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {embedUrl && (
                    <div className="mt-3">
                      <iframe
                        title="Spotify playlist preview"
                        src={embedUrl}
                        width="100%"
                        height="400"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-400">
                  No mix yet. Enter how you feel above, pick a length & lyrics
                  setting, then Create Mix.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Saved Library */}
        <section className="p-0">
          <Card
            className={`mx-4 sm:mx-6 mb-6 ${ac.cardBorder} ${ac.softBg} bg-zinc-800/60 backdrop-blur-md shadow-2xl ${ac.glowCard}`}
          >
            <CardHeader className="pb-2">
              <CardTitle>Your Saved Mixes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {mixes.length === 0 ? (
                <p className="text-sm text-zinc-400">Nothing saved yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mixes.map((m) => (
                    <MixCard
                      key={m.id}
                      mix={m}
                      onOpen={() => setCurrentMix(m)}
                      onDelete={() => m.id && deleteMix(m.id)}
                      onRename={(title) => m.id && renameMix(m.id, title)} // <-- added
                      accentGlow={ac.glowCard}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Profile & Preferences */}
        <section className="p-0">
          <Card
            className={`mx-4 sm:mx-6 mb-6 ${ac.cardBorder} ${ac.softBg} bg-zinc-800/60 backdrop-blur-md shadow-2xl ${ac.glowCard}`}
          >
            <CardHeader className="pb-2">
              <CardTitle>Your Profile & Preferences</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-xs text-zinc-400 mb-3">
                These influence recommendations. Stored locally in your browser.
              </p>
              <div
                className={
                  bucket === "wide"
                    ? "grid grid-cols-3 gap-3"
                    : "grid grid-cols-1 gap-3"
                }
              >
                <Input
                  label="Name"
                  value={profile.name}
                  onChange={(v) => setProfile({ ...profile, name: v })}
                />
                <Select
                  label="Favorite Genre"
                  value={profile.favoriteGenre}
                  onChange={(v) => setProfile({ ...profile, favoriteGenre: v })}
                  options={[
                    "",
                    "lo-fi",
                    "jazz",
                    "synthwave",
                    "house",
                    "hip-hop",
                    "k-pop",
                    "r&b",
                    "indie",
                    "ambient",
                  ]}
                />
                <LanguagesField
                  selected={profile.languages}
                  onChange={(langs) =>
                    setProfile({ ...profile, languages: langs })
                  }
                />
                <Select
                  label="Energy"
                  value={profile.energy}
                  onChange={(v) =>
                    setProfile({ ...profile, energy: v as Energy })
                  }
                  options={["low", "medium", "high"]}
                />
                <div className={bucket === "wide" ? "mt-6" : ""}>
                  <Checkbox
                    label="Allow explicit lyrics"
                    checked={profile.allowExplicit}
                    onChange={(v) =>
                      setProfile({ ...profile, allowExplicit: v })
                    }
                  />
                </div>
                <DoNotPlayField
                  artists={profile.doNotPlay}
                  onChange={(list) =>
                    setProfile({ ...profile, doNotPlay: list })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSubmit={async (n, e) => {
            await signInDemo(n, e);
            setAuthOpen(false);
          }}
        />
      )}
    </div>
  );
}
/* =============================== UI bits =============================== */

function Logo({
  accent = "indigo",
  size = 26, // ↑ slightly bigger icon
  line1 = "YEET",
  line2 = "Music",
}: {
  accent?: Accent;
  size?: number;
  line1?: string;
  line2?: string;
}) {
  const id = useId();
  const GRADIENTS: Record<Accent, [string, string]> = {
    indigo: ["#6366f1", "#22d3ee"],
    emerald: ["#10b981", "#06b6d4"],
    rose: ["#f43f5e", "#ec4899"],
    amber: ["#f59e0b", "#fbbf24"],
    sky: ["#0284c7", "#60a5fa"],
  };
  const [from, to] = GRADIENTS[accent];
  const gradId = `mm-wave-${id}`;
  const gradientStyle = {
    backgroundImage: `linear-gradient(90deg, ${from}, ${to})`,
  };

  return (
    // tighter gap to pull text closer to the icon
    <div className="flex items-center gap-1">
      {/* icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden
        className="shrink-0"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* remove this rect if you don't want the rounded square */}
        <rect
          x="2"
          y="3"
          width="40"
          height="40"
          rx="5"
          fill={`url(#${gradId})`}
        />
        <path
          d="M4 12c2.5-3 4.5 3 7 0s4.5-3 7 0"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      </svg>

      {/* two-line wordmark: LEFT-aligned + bigger + tighter */}
      <div className="flex flex-col items-start justify-center select-none">
        <span
          className="block font-extrabold text-[20px] leading-none bg-clip-text text-transparent tracking-tight"
          style={gradientStyle}
        >
          {line1}
        </span>
        <span
          className="block font-semibold text-[16px] leading-none -mt-0.5 bg-clip-text text-transparent tracking-tight"
          style={gradientStyle}
        >
          {line2}
        </span>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-white"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-20"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      ></path>
    </svg>
  );
}
function ProvidersRow() {
  const Item = ({ label }: { label: string }) => (
    <span className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300">
      <span className="size-2 rounded-full bg-zinc-500" aria-hidden /> {label}
    </span>
  );
  return (
    <div
      className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 justify-center"
      aria-label="Connected providers"
    >
      <Item label="YouTube Music" />
      <Item label="Spotify" />
      <Item label="Apple Music" />
    </div>
  );
}
function AccentPicker({
  value,
  onChange,
}: {
  value: Accent;
  onChange: (v: Accent) => void;
}) {
  const swatches: { key: Accent; className: string }[] = [
    {
      key: "indigo",
      className: "bg-gradient-to-br from-indigo-500 to-sky-400",
    },
    {
      key: "emerald",
      className: "bg-gradient-to-br from-emerald-500 to-teal-400",
    },
    {
      key: "rose",
      className: "bg-gradient-to-br from-rose-500 to-fuchsia-400",
    },
    {
      key: "amber",
      className: "bg-gradient-to-br from-amber-500 to-orange-400",
    },
    { key: "sky", className: "bg-gradient-to-br from-sky-500 to-cyan-400" },
  ];
  return (
    <div
      className="flex items-center gap-2"
      title="Accent colors"
      role="group"
      aria-label="Accent colors"
    >
      {swatches.map(({ key, className }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          aria-label={key}
          className={`h-5 w-5 rounded-full border border-white/20 ${className} ${
            value === key ? "ring-2 ring-white/70" : ""
          }`}
          aria-pressed={value === key}
        />
      ))}
    </div>
  );
}
function LanguagesField({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (langs: string[]) => void;
}) {
  const options = [
    { code: "en", label: "English" },
    { code: "ko", label: "Korean" },
    { code: "es", label: "Spanish" },
    { code: "fr", label: "French" },
    { code: "jp", label: "Japanese" },
    { code: "de", label: "German" },
    { code: "pt", label: "Portuguese" },
    { code: "it", label: "Italian" },
  ];
  const toggle = (code: string) => {
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code));
    else onChange([...selected, code]);
  };
  return (
    <div className="text-sm">
      <div className="mb-1 text-zinc-400">Languages (multi-select)</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.code}
            type="button"
            onClick={() => toggle(o.code)}
            className={`px-2 py-1 rounded-full border text-xs transition ${
              selected.includes(o.code)
                ? "border-indigo-400 bg-indigo-400/10"
                : "border-zinc-700 hover:border-zinc-500"
            }`}
            aria-pressed={selected.includes(o.code)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <div className="mb-1 text-zinc-400">{label}</div>
      <input
        value={value}
        type={type || "text"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-zinc-600 rounded bg-transparent"
      />
    </label>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
  freeText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  freeText?: boolean;
}) {
  return (
    <label className="text-sm">
      <div className="mb-1 text-zinc-400">{label}</div>
      {freeText ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-zinc-600 rounded bg-transparent"
        />
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-zinc-600 rounded bg-transparent"
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o || "Select"}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded border border-zinc-700 px-3 h-10 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function ToggleField({
  label,
  checked,
  onChange,
  className,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded border border-zinc-600 hover:border-zinc-500
                  px-2 h-8 bg-transparent cursor-pointer select-none ${
                    className || ""
                  }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-indigo-500"
        aria-label={label}
      />
      <span className="text-xs text-zinc-200">{label}</span>
    </label>
  );
}

function DoNotPlayField({
  artists,
  onChange,
}: {
  artists: string[];
  onChange: (list: string[]) => void;
}) {
  const [entry, setEntry] = useState("");
  const add = () => {
    const v = entry.trim();
    if (!v) return;
    if (!artists.some((a) => a.toLowerCase() === v.toLowerCase())) {
      onChange([...artists, v]);
    }
    setEntry("");
  };
  const remove = (name: string) => onChange(artists.filter((a) => a !== name));
  return (
    <div className="text-sm">
      <div className="mb-1 text-zinc-400">Do Not Play (artists)</div>
      <div className="flex gap-2 mb-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          className="w-full p-2 border border-zinc-600 rounded bg-transparent"
          placeholder="Add an artist and press Enter"
        />
        <Button onClick={add} variant="outline" className="border-zinc-600">
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {artists.map((a) => (
          <span
            key={a}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-2 py-1 text-xs"
          >
            {a}
            <button
              onClick={() => remove(a)}
              className="rounded-full px-1 hover:bg-zinc-800"
              aria-label={`Remove ${a}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
function MixCard({
  mix,
  onOpen,
  onDelete,
  onRename,
  accentGlow,
}: {
  mix: Mix;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  accentGlow: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mix.title);
  const justSavedRef = useRef(false);

  useEffect(() => setValue(mix.title), [mix.title]);

  const save = () => {
    const t = value.trim();
    if (t && t !== mix.title) onRename(t);
    setEditing(false);
    // Block the next click so it can't hit the new "Edit" button
    justSavedRef.current = true;
    setTimeout(() => (justSavedRef.current = false), 220);
  };

  return (
    <div
      className={`rounded p-3 text-left transition active:scale-[0.99] bg-zinc-800/50 border border-zinc-700 hover:bg-zinc-900/70 ${accentGlow}`}
    >
      <div className="flex items-center gap-3">
        {/* Left side */}
        {editing ? (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded bg-gradient-to-br from-indigo-500 to-blue-700" />
            <div className="min-w-0 text-left">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") {
                    setValue(mix.title);
                    setEditing(false);
                  }
                }}
                className="w-full rounded border border-zinc-600 bg-transparent px-2 py-1 text-sm"
                autoFocus
              />
              <p className="truncate text-xs text-zinc-500">
                {mix.tracks.length} tracks ·{" "}
                {Math.round(totalDuration(mix) / 60)} min
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !editing && onOpen()}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="h-10 w-10 rounded bg-gradient-to-br from-indigo-500 to-blue-700" />
            <div className="min-w-0 text-left">
              <p
                className="truncate text-sm"
                title={mix.title}
                onDoubleClick={() => setEditing(true)}
              >
                {mix.title}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {mix.tracks.length} tracks ·{" "}
                {Math.round(totalDuration(mix) / 60)} min
              </p>
            </div>
          </button>
        )}

        {/* Right controls */}
        {editing ? (
          <div
            className="ml-auto flex gap-2"
            onMouseDown={(e) => e.stopPropagation()} // keep clicks self-contained
            onClickCapture={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                save();
              }}
              variant="outline"
              className="border-zinc-600"
            >
              Save
            </Button>
            <Button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setValue(mix.title);
                setEditing(false);
                justSavedRef.current = true;
                setTimeout(() => (justSavedRef.current = false), 220);
              }}
              variant="outline"
              className="border-zinc-600"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex gap-2">
            <Button
              type="button"
              onClick={(e) => {
                // Ignore the click that happens right after saving
                if (justSavedRef.current) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                setEditing(true);
              }}
              variant="outline"
              className="border-zinc-600"
            >
              Edit
            </Button>
            <Button
              type="button"
              onClick={onDelete}
              variant="outline"
              className="border-zinc-600"
            >
              Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function AuthModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string, email: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-700/60 bg-zinc-900 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sign in (demo)</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-zinc-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-400">
          This preview doesn’t connect to real auth yet. Swap to
          Supabase/Firebase/NextAuth later.
        </p>
        <div className="mt-3 grid gap-2">
          <Input label="Name" value={name} onChange={setName} />
          <Input label="Email" value={email} onChange={setEmail} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-700/60 px-3 py-2 text-sm hover:bg-zinc-800"
          >
            Cancel
          </button>
          <Button
            onClick={() => onSubmit(name, email)}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ========================== Recommendation ========================== */
export type Energy = "low" | "medium" | "high";
export type Track = {
  id: string;
  spotifyId?: string;
  title: string;
  artist: string;
  genre: string;
  language: string;
  energy: Energy;
  explicit: boolean;
  tags: string[];
  duration: number;
  decade: number;
  preview?: string; // optional audio preview URL
};
export type Mix = {
  id?: string;
  title: string;
  prompt: string;
  tracks: Track[];
};
export type UserProfile = {
  name: string;
  age: string;
  favoriteGenre: string;
  languages: string[];
  energy: Energy;
  allowExplicit: boolean;
  doNotPlay: string[];
};
export type MixOptions = { targetSeconds: number; instrumentalOnly: boolean };

const CATALOG: Track[] = [
  makeTrack(
    "Midnight Drive",
    "Neon Rivers",
    "synthwave",
    "en",
    "high",
    false,
    ["night", "drive", "retro", "city"],
    224,
    1980
  ),
  makeTrack(
    "Lo Fi Rain",
    "Kumo",
    "lo-fi",
    "en",
    "low",
    false,
    ["study", "rain", "cafe", "focus"],
    186,
    2020
  ),
  makeTrack(
    "Sunset Breeze",
    "Mira",
    "indie",
    "en",
    "medium",
    false,
    ["chill", "sunset", "beach"],
    208,
    2010
  ),
  makeTrack(
    "Coffee Shop Jazz",
    "Blue Trio",
    "jazz",
    "en",
    "low",
    false,
    ["morning", "cafe", "reading"],
    240,
    1970
  ),
  makeTrack(
    "River Run",
    "Pulse City",
    "house",
    "en",
    "high",
    true,
    ["run", "gym", "cardio"],
    210,
    2010
  ),
  makeTrack(
    "Late Night Coding",
    "Loopsmith",
    "lo-fi",
    "en",
    "low",
    false,
    ["coding", "focus", "night"],
    192,
    2020
  ),
  makeTrack(
    "Street Lights",
    "VHS Dreams",
    "synthwave",
    "en",
    "medium",
    false,
    ["drive", "city", "retro"],
    230,
    1980
  ),
  makeTrack(
    "Seoul Skies",
    "Haneul",
    "k-pop",
    "ko",
    "medium",
    false,
    ["chill", "city", "walk"],
    205,
    2020
  ),
  makeTrack(
    "Rain Room",
    "Lilac",
    "r&b",
    "en",
    "low",
    false,
    ["rain", "late", "mood"],
    218,
    2010
  ),
  makeTrack(
    "Morning Lift",
    "Anaerobe",
    "hip-hop",
    "en",
    "high",
    true,
    ["gym", "pump", "workout"],
    190,
    2010
  ),
  makeTrack(
    "Coastal Cruise",
    "Waveform",
    "indie",
    "en",
    "medium",
    false,
    ["roadtrip", "beach", "day"],
    236,
    2010
  ),
  makeTrack(
    "Quiet Library",
    "Paper Notes",
    "ambient",
    "en",
    "low",
    false,
    ["study", "library", "focus"],
    260,
    2020
  ),
  makeTrack(
    "Cherry Blossoms",
    "Sakura Dream",
    "lo-fi",
    "jp",
    "low",
    false,
    ["spring", "park", "walk"],
    200,
    2020
  ),
  makeTrack(
    "Neon Runner",
    "Retrograde",
    "synthwave",
    "en",
    "high",
    false,
    ["run", "night", "neon"],
    206,
    1980
  ),
  makeTrack(
    "Cloud Kitchen",
    "Stir Fry",
    "house",
    "en",
    "high",
    false,
    ["cooking", "party", "home"],
    212,
    2020
  ),
  makeTrack(
    "Golden Hour",
    "Vista",
    "indie",
    "en",
    "medium",
    false,
    ["sunset", "chill", "balcony"],
    228,
    2020
  ),
  makeTrack(
    "Zen Garden",
    "Moss",
    "ambient",
    "en",
    "low",
    false,
    ["meditation", "yoga", "calm"],
    300,
    2010
  ),
  makeTrack(
    "Night Market",
    "Neon Seoul",
    "k-pop",
    "ko",
    "high",
    false,
    ["party", "city", "dance"],
    198,
    2020
  ),
  makeTrack(
    "Snowed In",
    "Cozy Cabin",
    "indie",
    "en",
    "low",
    false,
    ["winter", "home", "reading"],
    242,
    2010
  ),
  makeTrack(
    "Focus Flow",
    "Headspace",
    "lo-fi",
    "en",
    "low",
    false,
    ["study", "deep", "work"],
    204,
    2020
  ),
  makeTrack(
    "Rooftop Party",
    "Skyline",
    "house",
    "en",
    "high",
    false,
    ["party", "summer", "rooftop"],
    216,
    2020
  ),
  makeTrack(
    "City Walk",
    "Footsteps",
    "indie",
    "en",
    "medium",
    false,
    ["walk", "downtown", "day"],
    207,
    2010
  ),
  makeTrack(
    "Deep Breath",
    "Waves",
    "ambient",
    "en",
    "low",
    false,
    ["calm", "sleep", "relax"],
    360,
    2020
  ),
];

function makeTrack(
  title: string,
  artist: string,
  genre: string,
  language: string,
  energy: Energy,
  explicit: boolean,
  tags: string[],
  duration: number,
  decade: number
): Track {
  return {
    id: (title + "_" + artist).split(" ").join("-"),
    title,
    artist,
    genre,
    language,
    energy,
    explicit,
    tags,
    duration,
    decade,
  };
}
function simpleTokenize(text: string) {
  const chars = text.toLowerCase().split("");
  const norm: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const isAlnum =
      (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-";
    norm.push(isAlnum ? c : " ");
  }
  return norm
    .join("")
    .split(" ")
    .filter((t) => t.length > 0);
}
function scoreTrack(
  track: Track,
  tokens: string[],
  profile: UserProfile,
  opts: MixOptions
) {
  let s = 0;
  for (const tok of tokens) {
    for (const tag of track.tags) if (tag.indexOf(tok) !== -1) s += 3;
    if (track.genre.indexOf(tok) !== -1) s += 2;
    if (track.artist.toLowerCase().indexOf(tok) !== -1) s += 2;
  }
  if (profile.energy === track.energy) s += 2;
  if (profile.favoriteGenre && profile.favoriteGenre === track.genre) s += 2.5;
  if (
    profile.languages.length &&
    profile.languages.indexOf(track.language) !== -1
  )
    s += 1.5;
  if (!profile.allowExplicit && track.explicit) s -= 3;
  for (const banned of profile.doNotPlay) {
    if (banned.toLowerCase() === track.artist.toLowerCase()) s -= 100;
  }
  if (opts.instrumentalOnly) {
    const instrumentalGenres = new Set(["lo-fi", "ambient", "jazz"]);
    if (instrumentalGenres.has(track.genre)) s += 2.5;
    else s -= 1.5;
  }
  return s;
}
function titleFrom(tokens: string[], mins: number, instrumentalOnly: boolean) {
  const stop = ["the", "a", "an", "for", "to", "at", "in", "on", "by", "of"];
  const words = tokens.filter((t) => stop.indexOf(t) === -1);
  const cap = words
    .slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const lyric = instrumentalOnly ? "(Instrumental) " : "";
  return (cap ? cap + " Mix" : "Custom Mix") + ` · ${lyric}${mins} min`;
}
  export function recommendFromPrompt(
    prompt: string,
    profile: UserProfile,
    opts: MixOptions
  ): Mix {
  const tokens = simpleTokenize(prompt);
  const ranked = CATALOG.map((tr) => ({
    tr,
    s: scoreTrack(tr, tokens, profile, opts),
  }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.tr);
  // Dedupe & greedy pack
  const seen = new Set<string>();
  const tracks: Track[] = [];
  let remain = opts.targetSeconds;
  for (const t of ranked) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (t.duration <= remain) {
      tracks.push(t);
      remain -= t.duration;
    }
    if (remain <= 20) break;
  }
  if (tracks.length === 0) tracks.push(...ranked.slice(0, 5));
  return {
    title: titleFrom(
      tokens,
      Math.round(opts.targetSeconds / 60),
      opts.instrumentalOnly
    ),
    prompt,
    tracks,
  };
}
function totalDuration(mix: Mix) {
  return mix.tracks.reduce((acc, t) => acc + t.duration, 0);
}
function formatSeconds(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + ":" + String(s).padStart(2, "0");
}

/* ============================== Hooks ============================== */
function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const update = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}
function useLocalStorage<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}
