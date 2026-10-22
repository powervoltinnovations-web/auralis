"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Disc3,
  Ellipsis,
  FolderHeart,
  Headphones,
  Heart,
  Library,
  ListMusic,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Music2,
  Pause,
  Play,
  Plus,
  Repeat2,
  Search,
  ShieldCheck,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { supabase, supabaseConfigError } from "@/lib/supabase";
import { loginError, ownerError } from "@/lib/auth";
import {
  MAX_FILE_BYTES,
  validateFile,
  validateSignature,
} from "@/lib/security";
type Track = {
  id: string;
  title: string;
  artist: string;
  kind: "audio" | "video";
  object_path: string;
  size: number;
  favorite: boolean;
  created_at: string;
  localUrl?: string;
  duration?: string;
};
const samples: Track[] = [
  {
    id: "sample-1",
    title: "Weightless",
    artist: "Marconi Union",
    kind: "audio",
    object_path: "",
    size: 0,
    favorite: true,
    created_at: "",
    duration: "8:09",
  },
  {
    id: "sample-2",
    title: "A Walk",
    artist: "Tycho",
    kind: "audio",
    object_path: "",
    size: 0,
    favorite: false,
    created_at: "",
    duration: "5:16",
  },
  {
    id: "sample-3",
    title: "Space Song",
    artist: "Beach House",
    kind: "audio",
    object_path: "",
    size: 0,
    favorite: true,
    created_at: "",
    duration: "5:20",
  },
  {
    id: "sample-4",
    title: "Sunset Lover",
    artist: "Petit Biscuit",
    kind: "audio",
    object_path: "",
    size: 0,
    favorite: false,
    created_at: "",
    duration: "3:58",
  },
];
const clock = (n: number) =>
  Number.isFinite(n)
    ? `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`
    : "0:00";
export default function Auralis() {
  const [ready, setReady] = useState(false),
    [authorized, setAuthorized] = useState(false),
    [signedIn, setSignedIn] = useState(false),
    [demo, setDemo] = useState(!supabase);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factor, setFactor] = useState(""),
    [qr, setQr] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]),
    [view, setView] = useState("Overview"),
    [query, setQuery] = useState(""),
    [tab, setTab] = useState("All files");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [uploadOpen, setUploadOpen] = useState(false),
    [help, setHelp] = useState(false),
    [progress, setProgress] = useState("");
  const [current, setCurrent] = useState<Track | null>(null),
    [source, setSource] = useState(""),
    [playing, setPlaying] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [duration, setDuration] = useState(0),
    [volume, setVolume] = useState(0.8),
    [repeat, setRepeat] = useState(false),
    [shuffle, setShuffle] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>([]),
    [listDialog, setListDialog] = useState(false),
    [listName, setListName] = useState("My collection"),
    [newListName, setNewListName] = useState(""),
    [deleteTrack, setDeleteTrack] = useState<Track | null>(null);
  const audio = useRef<HTMLAudioElement>(null),
    video = useRef<HTMLVideoElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    urls = useRef<string[]>([]),
    playRequest = useRef(0);
  const notify = (s: string) => setNotice(s);
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("tracks")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setTracks(data ?? []);
    const p = await supabase
      .from("playlists")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (p.error) throw p.error;
    if (p.data) {
      setPlaylist(p.data.track_ids);
      setListName(p.data.name);
    }
  }, []);
  const checkAuth = useCallback(async () => {
    if (!supabase) {
      setReady(true);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(!!user);
      if (!user) {
        setAuthorized(false);
        setFactor("");
        setQr("");
        setReady(true);
        return;
      }
      const owner = await supabase
        .from("app_owner")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (owner.error || !owner.data) {
        await supabase?.auth.signOut();
        throw new Error(ownerError(owner.error));
      }
      const { data, error } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data.currentLevel === "aal2") {
        setAuthorized(true);
        setDemo(false);
        await load();
      } else {
        setAuthorized(false);
        const factors = await supabase.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        setFactor(
          factors.data.totp.find((f) => f.status === "verified")?.id ?? "",
        );
      }
    } catch (e) {
      setAuthorized(false);
      setNotice(
        e instanceof Error
          ? e.message
          : "Unable to verify your account. Check your connection and Supabase configuration.",
      );
    } finally {
      setReady(true);
    }
  }, [load]);
  useEffect(() => {
    void checkAuth();
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        setSignedIn(false);
        setFactor("");
        setQr("");
        setCode("");
        setPassword("");
        ++playRequest.current;
        audio.current?.pause();
        video.current?.pause();
        setTracks([]);
        setSource("");
        setCurrent(null);
        setPlaylist([]);
        for (const url of urls.current) URL.revokeObjectURL(url);
        urls.current = [];
      }
      if (event === "TOKEN_REFRESHED") setTimeout(() => void checkAuth(), 0);
    });
    return () => {
      sub?.data.subscription.unsubscribe();
      for (const u of urls.current) URL.revokeObjectURL(u);
    };
  }, [checkAuth]);
  useEffect(() => {
    if (!uploadOpen && !help && !listDialog && !deleteTrack) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>(
      "[role=dialog], [role=alertdialog]",
    );
    const selectors =
      'button:not([disabled]), input:not([hidden]):not([disabled]), a[href], [tabindex="0"]';
    dialog?.querySelector<HTMLElement>(selectors)?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        setUploadOpen(false);
        setHelp(false);
        setListDialog(false);
        setDeleteTrack(null);
      }
      if (event.key === "Tab" && dialog) {
        const elements = Array.from(
          dialog.querySelectorAll<HTMLElement>(selectors),
        );
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [uploadOpen, help, listDialog, deleteTrack, busy]);
  useEffect(() => {
    if (!notice || (!authorized && !demo)) return;
    const id = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(id);
  }, [notice, authorized, demo]);
  useEffect(() => {
    const el = current?.kind === "video" ? video.current : audio.current;
    if (el) el.volume = volume;
  }, [volume, current, source]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setPassword("");
      if (error) throw new Error(loginError(error));
      await checkAuth();
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Cannot reach Supabase. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    if (!supabase) return;
    setBusy(true);
    setNotice("");
    try {
      const existing = await supabase.auth.mfa.listFactors();
      if (existing.error) throw existing.error;
      for (const f of existing.data.all.filter(
        (f) => f.factor_type === "totp" && f.status === "unverified",
      )) {
        const r = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (r.error) throw r.error;
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Auralis authenticator",
      });
      if (error) throw error;
      setFactor(data.id);
      setQr(data.totp.qr_code);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !factor) return;
    setBusy(true);
    setNotice("");
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error)
        throw new Error(
          "That code was not accepted. Use the latest authenticator code.",
        );
      setCode("");
      setQr("");
      await checkAuth();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let complete = 0;
    try {
      for (const file of Array.from(files)) {
        setProgress(`Checking ${file.name}…`);
        const err = validateFile(file);
        if (err) throw new Error(err);
        const ext = file.name.split(".").pop()!.toLowerCase();
        if (!(await validateSignature(file, ext)))
          throw new Error(
            "The file contents do not match a supported media format.",
          );
        const title = file.name.replace(/\.[^.]+$/, "").slice(0, 150),
          kind = file.type.startsWith("video") ? "video" : "audio";
        if (demo) {
          const url = URL.createObjectURL(file);
          urls.current.push(url);
          setTracks((t) => [
            {
              id: crypto.randomUUID(),
              title,
              artist: "Personal upload",
              kind,
              object_path: "",
              size: file.size,
              favorite: false,
              created_at: new Date().toISOString(),
              localUrl: url,
            },
            ...t,
          ]);
        } else if (supabase) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) throw new Error("Please sign in again.");
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
          setProgress(`Uploading ${file.name}…`);
          const result = await supabase.storage
            .from("media")
            .upload(path, file, {
              contentType: file.type,
              upsert: false,
              cacheControl: "0",
            });
          if (result.error) throw result.error;
          const inserted = await supabase.from("tracks").insert({
            title,
            artist: "Personal upload",
            kind,
            object_path: path,
            size: file.size,
            owner_id: user.id,
          });
          if (inserted.error) {
            await supabase.storage.from("media").remove([path]);
            throw inserted.error;
          }
        }
        complete++;
      }
      if (!demo) await load();
      setUploadOpen(false);
      notify(
        `${complete} file${complete === 1 ? "" : "s"} added${demo ? " to this local preview" : ""}.`,
      );
    } catch (e) {
      notify(
        `${complete ? `${complete} uploaded. ` : ""}${(e as Error).message}`,
      );
    } finally {
      setBusy(false);
      setProgress("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function play(track: Track) {
    const request = ++playRequest.current;
    if (track.id.startsWith("sample")) {
      notify(
        "These are illustrative titles. Upload your own file to start listening.",
      );
      setUploadOpen(true);
      return;
    }
    try {
      let url = track.localUrl;
      if (!url && supabase) {
        const { data, error } = await supabase.storage
          .from("media")
          .createSignedUrl(track.object_path, 60);
        if (error) throw error;
        url = data.signedUrl;
      }
      if (!url) throw new Error("No playable file is available.");
      if (request !== playRequest.current) return;
      audio.current?.pause();
      video.current?.pause();
      setCurrent(track);
      setElapsed(0);
      setDuration(0);
      setSource(url);
      setPlaying(false);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const visible = tracks.filter(
    (t) =>
      (view !== "Favorites" || t.favorite) &&
      (view !== "Videos" || t.kind === "video") &&
      (view !== "Music" || t.kind === "audio") &&
      (view !== "Collection" || playlist.includes(t.id)) &&
      (tab !== "Music" || t.kind === "audio") &&
      (tab !== "Videos" || t.kind === "video") &&
      `${t.title} ${t.artist}`.toLowerCase().includes(query.toLowerCase()),
  );
  const display = tracks.length
    ? visible
    : view === "Overview" && !query && tab !== "Videos"
      ? samples
      : [];
  function next(offset = 1) {
    const pool = visible.length ? visible : tracks;
    if (!pool.length) return;
    const index = shuffle
      ? Math.floor(Math.random() * pool.length)
      : (pool.findIndex((t) => t.id === current?.id) + offset + pool.length) %
        pool.length;
    void play(pool[index]);
  }
  function togglePlay() {
    const el = current?.kind === "video" ? video.current : audio.current;
    if (!current) {
      if (tracks[0]) void play(tracks[0]);
      else setUploadOpen(true);
      return;
    }
    if (el?.paused)
      void el
        .play()
        .catch(() => notify("Tap play in the player to begin playback."));
    else el?.pause();
  }
  async function favorite(track: Track) {
    if (track.id.startsWith("sample"))
      return notify("Upload a file to save your favorites.");
    if (!demo && supabase) {
      const { error } = await supabase
        .from("tracks")
        .update({ favorite: !track.favorite })
        .eq("id", track.id);
      if (error) return notify(error.message);
    }
    setTracks((t) =>
      t.map((x) => (x.id === track.id ? { ...x, favorite: !x.favorite } : x)),
    );
  }
  async function saveList(ids: string[], name = listName) {
    if (!demo && supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("playlists")
        .upsert(
          { owner_id: user.id, name, track_ids: ids },
          { onConflict: "owner_id" },
        );
      if (error) return notify(error.message);
    }
    setPlaylist(ids);
    setListName(name);
    notify("Collection saved.");
  }
  async function remove(track: Track) {
    setBusy(true);
    try {
      if (!demo && supabase) {
        const deleted = await supabase.storage
          .from("media")
          .remove([track.object_path]);
        if (deleted.error) throw deleted.error;
        const { error } = await supabase
          .from("tracks")
          .delete()
          .eq("id", track.id);
        if (error) throw error;
      }
      if (current?.id === track.id) {
        setSource("");
        setCurrent(null);
      }
      if (track.localUrl) URL.revokeObjectURL(track.localUrl);
      setTracks((t) => t.filter((x) => x.id !== track.id));
      if (playlist.includes(track.id))
        await saveList(playlist.filter((id) => id !== track.id));
      setDeleteTrack(null);
      notify("File deleted.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: "Auralis",
    });
    navigator.mediaSession.setActionHandler("play", () => {
      const el = current.kind === "video" ? video.current : audio.current;
      void el?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audio.current?.pause();
      video.current?.pause();
    });
    return () => {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
    };
  }, [current]);
  const mediaEvents = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      setElapsed(e.currentTarget.currentTime),
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) =>
      setDuration(e.currentTarget.duration),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => {
      if (!repeat) next();
    },
    onError: () =>
      notify(
        "Playback failed. Try opening the track again to refresh access. iPhone supports MP3/AAC audio and H.264/AAC MP4 video.",
      ),
  };
  if (supabaseConfigError)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Finish connecting Auralis</h1>
          <p role="alert">{supabaseConfigError}</p>
          <p>
            Your account password belongs only in Supabase Auth, never in the
            website configuration.
          </p>
        </section>
      </main>
    );
  if (!ready)
    return (
      <div className="loading">
        <Activity /> Opening your space…
      </div>
    );
  if (supabase && !authorized && !demo)
    return (
      <main className="auth-page">
        <div className="auth-art">
          <div className="brand">
            <span className="brandmark">
              <Activity />
            </span>
            Auralis<span className="brand-dot">®</span>
          </div>
          <div className="auth-orb" />
          <h1>
            Your world.
            <br />
            On your frequency.
          </h1>
          <p>A private home for the sounds and stories you love.</p>
        </div>
        <section className="auth-card">
          <span className="eyebrow">
            <LockKeyhole size={14} /> YOUR PRIVATE SPACE
          </span>
          <h2>{signedIn ? "One more layer of you." : "Welcome back."}</h2>
          <p>
            {signedIn
              ? "Verify with your authenticator to unlock your library."
              : "Sign in to your personal music and video library."}
          </p>
          {!signedIn ? (
            <form onSubmit={login}>
              <label>
                Email
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="primary wide" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <LockKeyhole size={16} />
                )}{" "}
                Unlock my space
              </button>
            </form>
          ) : (
            <>
              {qr && (
                <div className="qr">
                  <img
                    src={qr}
                    alt="Scan this private QR code with your authenticator app"
                  />
                  <p>
                    Scan with your authenticator, then enter its code. Never
                    share this QR.
                  </p>
                </div>
              )}
              {factor ? (
                <form onSubmit={verify}>
                  <label>
                    Authenticator code
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, ""))
                      }
                    />
                  </label>
                  <button className="primary wide" disabled={busy}>
                    Verify & enter <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                <button
                  className="primary wide"
                  onClick={() => void enroll()}
                  disabled={busy}
                >
                  Set up authenticator
                </button>
              )}
              <button
                className="text-button"
                onClick={() => void supabase?.auth.signOut()}
              >
                Return to sign in
              </button>
            </>
          )}
          <div className="auth-foot">
            <ShieldCheck size={16} /> One owner. No public sign-ups.
          </div>
          <button className="text-button" onClick={() => setDemo(true)}>
            Explore a local preview <ArrowRight size={14} />
          </button>
        </section>
        {notice && (
          <div role="status" className="toast">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
      </main>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Auralis home">
          <span className="brandmark">
            <Activity size={23} />
          </span>
          Auralis<span className="brand-dot">®</span>
        </a>
        <span className="nav-label">YOUR SPACE</span>
        <nav>
          {[
            { name: "Overview", icon: Library },
            { name: "Music", icon: Music2 },
            { name: "Videos", icon: Video },
            { name: "Favorites", icon: Heart },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={view === name ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(name);
                setTab("All files");
              }}
            >
              <Icon size={19} />
              {name}
              {name === "Overview" && (
                <span className="nav-count">{tracks.length || "—"}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label playlist-label">
          COLLECTIONS
          <button
            aria-label="Create collection"
            onClick={() => setListDialog(true)}
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          className={view === "Collection" ? "nav-item active" : "nav-item"}
          onClick={() => setView("Collection")}
        >
          <ListMusic size={18} />
          {listName}
        </button>
        <button className="create-list" onClick={() => setListDialog(true)}>
          <Plus size={15} /> Create collection
        </button>
        <div className="sidebar-bottom">
          <div className="storage">
            <div>
              <span>
                <span className="green-dot" />{" "}
                {demo ? "LOCAL PREVIEW" : "PRIVATE CLOUD"}
              </span>
              <ShieldCheck size={15} />
            </div>
            <p>
              {demo
                ? "Your files stay in this browser."
                : "Only you have library access."}
            </p>
            <div className="storage-bar">
              <i
                style={{
                  width: `${Math.min(100, (tracks.reduce((a, t) => a + t.size, 0) / 1024 / 1024 / 1024) * 100)}%`,
                }}
              />
            </div>
            <small>
              {(tracks.reduce((a, t) => a + t.size, 0) / 1024 / 1024).toFixed(
                1,
              )}{" "}
              MB in your library
            </small>
          </div>
          <button className="profile" onClick={() => setHelp(true)}>
            <span className="avatar">{demo ? "Y" : "O"}</span>
            <span>
              Your personal space
              <small>{demo ? "Preview mode" : "Owner account"}</small>
            </span>
            <Ellipsis size={19} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            Your space <ChevronRight size={13} />
            <strong>{view === "Collection" ? listName : view}</strong>
          </div>
          <div className="top-actions">
            <span className="private-badge">
              <LockKeyhole size={12} />
              {demo ? "Local preview" : "Private library"}
            </span>
            <button
              className="icon-button"
              aria-label="Help and security"
              onClick={() => setHelp(true)}
            >
              <CircleHelp size={19} />
            </button>
            <span className="avatar small">Y</span>
          </div>
        </header>
        <main className="main-content">
          <div className="heading">
            <div>
              <span className="eyebrow">A LITTLE SPACE, JUST FOR YOU</span>
              <h1>
                {view === "Overview"
                  ? "Your own frequency."
                  : view === "Collection"
                    ? listName
                    : view === "Favorites"
                      ? "Always on repeat."
                      : view === "Videos"
                        ? "A world in motion."
                        : "Find your rhythm."}
              </h1>
              <p>Your music. Your moments. Wherever you are.</p>
            </div>
            <button
              className="primary upload-top"
              onClick={() => setUploadOpen(true)}
            >
              <Plus size={18} /> Upload files
            </button>
          </div>
          {view === "Overview" && (
            <section className="hero">
              <div className="hero-copy">
                <span className="hero-tag">
                  <span className="green-dot" /> MADE FOR YOUR EVERYDAY
                </span>
                <h2>
                  Less noise.
                  <br />
                  More <em>you.</em>
                </h2>
                <p>
                  A soundtrack for every version of your day.
                  <br />
                  Bring your favorites. Make yourself at home.
                </p>
                <button
                  className="light-button"
                  onClick={() =>
                    tracks[0] ? void play(tracks[0]) : setUploadOpen(true)
                  }
                >
                  <Play size={14} fill="currentColor" />{" "}
                  {tracks.length ? "Start listening" : "Add your first track"}
                  <ArrowRight size={16} />
                </button>
              </div>
              <div className="hero-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="record">
                  <div className="record-label">
                    <Activity size={32} />
                    <span>
                      AURALIS
                      <br />
                      SIDE A · YOUR WORLD
                    </span>
                  </div>
                </div>
                <div className="floating-note">
                  <span className="tiny-bars">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>{" "}
                  A little closer to your world.
                </div>
                <span className="art-coordinate">
                  EST. 2026 &nbsp; / &nbsp; ALWAYS YOURS
                </span>
              </div>
            </section>
          )}
          {view === "Overview" && (
            <div className="quick-grid">
              <button
                className="quick-card"
                onClick={() => {
                  setView("Music");
                  setTab("All files");
                }}
              >
                <span className="quick-icon lilac">
                  <Music2 size={23} />
                </span>
                <span>
                  Made of music
                  <small>
                    {tracks.filter((t) => t.kind === "audio").length} tracks ·
                    Endless possibilities
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
              <button
                className="quick-card"
                onClick={() => {
                  setView("Videos");
                  setTab("All files");
                }}
              >
                <span className="quick-icon peach">
                  <Video size={23} />
                </span>
                <span>
                  Moments in motion
                  <small>
                    {tracks.filter((t) => t.kind === "video").length} videos · A
                    different perspective
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
              <button
                className="quick-card"
                onClick={() => setView("Favorites")}
              >
                <span className="quick-icon lime">
                  <Heart size={23} />
                </span>
                <span>
                  The ones you love
                  <small>
                    {tracks.filter((t) => t.favorite).length} favorites · Keep
                    them close
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            </div>
          )}
          <section className="library-section">
            <div className="section-heading">
              <div>
                <h2>
                  {view === "Overview"
                    ? "Your library"
                    : view === "Collection"
                      ? listName
                      : view}
                </h2>
                <span>
                  {!tracks.length && view === "Overview"
                    ? "A little inspiration. Your uploads will live here."
                    : `${visible.length} files, all yours.`}
                </span>
              </div>
              <label className="search">
                <Search size={16} />
                <input
                  aria-label="Search your library"
                  placeholder="Search your library"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>⌕</kbd>
              </label>
            </div>
            <div className="library-tools">
              <div className="tabs">
                {["All files", "Music", "Videos"].map((x) => (
                  <button
                    key={x}
                    className={tab === x ? "selected" : ""}
                    onClick={() => setTab(x)}
                  >
                    {x}
                  </button>
                ))}
              </div>
              <span className="sort-label">
                Recently added <ArrowDownToLine size={13} />
              </span>
            </div>
            <div className="track-table">
              <div className="table-head">
                <span>#</span>
                <span>TITLE</span>
                <span>TYPE</span>
                <span>SIZE / LENGTH</span>
                <span />
              </div>
              {display.map((t, i) => (
                <div
                  className={`track-row ${current?.id === t.id ? "current" : ""}`}
                  key={t.id}
                >
                  <span className="track-number">
                    {current?.id === t.id && playing ? (
                      <Activity size={14} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <button className="track-title" onClick={() => void play(t)}>
                    <span className={`cover cover-${i % 4}`}>
                      <span>
                        {t.kind === "video" ? (
                          <Video size={18} />
                        ) : (
                          <Disc3 size={20} />
                        )}
                      </span>
                      <i>
                        <Play size={16} fill="currentColor" />
                      </i>
                    </span>
                    <span>
                      {t.title}
                      <small>{t.artist}</small>
                    </span>
                  </button>
                  <span className="type-pill">
                    {t.kind === "audio" ? "Audio" : "Video"}
                  </span>
                  <span className="track-length">
                    {t.duration ?? `${(t.size / 1024 / 1024).toFixed(1)} MB`}
                  </span>
                  <div className="row-actions">
                    <button
                      aria-label={`${t.favorite ? "Unfavorite" : "Favorite"} ${t.title}`}
                      className={t.favorite ? "liked" : ""}
                      onClick={() => void favorite(t)}
                    >
                      <Heart
                        size={16}
                        fill={t.favorite ? "currentColor" : "none"}
                      />
                    </button>
                    {!t.id.startsWith("sample") && (
                      <>
                        <button
                          aria-label={`Add ${t.title} to collection`}
                          onClick={() =>
                            void saveList(
                              playlist.includes(t.id)
                                ? playlist.filter((id) => id !== t.id)
                                : [...playlist, t.id],
                            )
                          }
                        >
                          {playlist.includes(t.id) ? (
                            <Check size={16} />
                          ) : (
                            <Plus size={16} />
                          )}
                        </button>
                        <button
                          aria-label={`Delete ${t.title}`}
                          onClick={() => setDeleteTrack(t)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {display.length === 0 && (
                <div className="empty">
                  <FolderHeart size={32} />
                  <h3>
                    {query
                      ? "No matching files"
                      : "Your next favorite belongs here."}
                  </h3>
                  <p>
                    {query
                      ? "Try another title or artist."
                      : "Upload something you love, then take it anywhere."}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setUploadOpen(true)}
                  >
                    Add files <Plus size={15} />
                  </button>
                </div>
              )}
            </div>
            {!tracks.length && view === "Overview" && (
              <div className="sample-caption">
                Illustrative library · Sample titles contain no audio. Upload
                your own files to listen.
              </div>
            )}
          </section>
          <footer className="content-footer">
            <span>
              <ShieldCheck size={14} />{" "}
              {demo
                ? "Local preview · Nothing is uploaded to a server"
                : "Private by design. Yours by nature."}
            </span>
            <span>
              GOOD SOUNDS. YOUR SPACE. <Activity size={14} />
            </span>
          </footer>
        </main>
      </div>
      <footer className="player">
        <div className="now-playing">
          <span className="player-cover">
            <Music2 size={22} />
          </span>
          <div>
            <strong>{current?.title ?? "A little quiet, for now."}</strong>
            <span>{current?.artist ?? "Pick a track and make it yours"}</span>
          </div>
          {current && (
            <button
              aria-label="Favorite current track"
              className={
                tracks.find((t) => t.id === current.id)?.favorite ? "liked" : ""
              }
              onClick={() =>
                void favorite(
                  tracks.find((t) => t.id === current.id) ?? current,
                )
              }
            >
              <Heart size={17} />
            </button>
          )}
        </div>
        <div className="player-center">
          <div className="transport">
            <button
              aria-label="Shuffle"
              aria-pressed={shuffle}
              className={shuffle ? "enabled" : ""}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={16} />
            </button>
            <button aria-label="Previous track" onClick={() => next(-1)}>
              <SkipBack size={18} fill="currentColor" />
            </button>
            <button
              aria-label={playing ? "Pause" : "Play"}
              className="play-main"
              onClick={togglePlay}
            >
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <button aria-label="Next track" onClick={() => next()}>
              <SkipForward size={18} fill="currentColor" />
            </button>
            <button
              aria-label="Repeat"
              aria-pressed={repeat}
              className={repeat ? "enabled" : ""}
              onClick={() => setRepeat(!repeat)}
            >
              <Repeat2 size={17} />
            </button>
          </div>
          <div className="timeline">
            <span>{clock(elapsed)}</span>
            <input
              aria-label="Seek"
              type="range"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              step="0.1"
              value={elapsed}
              onChange={(e) => {
                const el =
                  current?.kind === "video" ? video.current : audio.current;
                if (el && Number.isFinite(el.duration))
                  el.currentTime = +e.target.value;
                setElapsed(+e.target.value);
              }}
            />
            <span>{clock(duration)}</span>
          </div>
        </div>
        <div className="player-right">
          <Headphones size={16} />
          <Volume2 size={18} />
          <input
            aria-label="Volume"
            type="range"
            min={0}
            max={1}
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(+e.target.value)}
          />
          <button
            aria-label="Open collection"
            onClick={() => setView("Collection")}
          >
            <ListMusic size={18} />
          </button>
        </div>
      </footer>
      <audio
        ref={audio}
        src={current?.kind === "audio" ? source : undefined}
        autoPlay
        loop={repeat}
        {...mediaEvents}
      />
      {current?.kind === "video" && source && (
        <div className="video-window">
          <div>
            <span>{current.title}</span>
            <button
              aria-label="Close video"
              onClick={() => {
                setSource("");
                setCurrent(null);
              }}
            >
              <X size={18} />
            </button>
          </div>
          <video
            ref={video}
            src={source}
            controls
            playsInline
            autoPlay
            loop={repeat}
            {...mediaEvents}
          />
        </div>
      )}
      {uploadOpen && (
        <div className="overlay" onClick={() => !busy && setUploadOpen(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close upload"
              disabled={busy}
              onClick={() => setUploadOpen(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <Upload />
            </span>
            <h2 id="upload-title">Bring your world with you.</h2>
            <p>Music for the journey. Videos worth keeping.</p>
            <div
              className="drop-zone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!busy) void upload(e.dataTransfer.files);
              }}
            >
              <Upload size={28} />
              <strong>Drop your files here</strong>
              <span>or choose them from your device</span>
              <button
                className="primary"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}{" "}
                Choose files
              </button>
              <input
                ref={fileInput}
                type="file"
                accept=".mp3,.m4a,.aac,.wav,.mp4"
                multiple
                hidden
                onChange={(e) => void upload(e.target.files)}
              />
            </div>
            <small>
              MP3, M4A, AAC, WAV, MP4 · Up to {MAX_FILE_BYTES / 1024 / 1024} MB
              each
            </small>
            {progress && <p role="status">{progress}</p>}
            <div className="modal-info">
              <ShieldCheck size={17} />
              {demo
                ? "Preview files stay on this device and disappear on reload. Connect Supabase to sync across devices."
                : "Encrypted in transit. Stored in your private cloud library."}
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="overlay" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <ShieldCheck />
            </span>
            <h2 id="help-title">Your space. Protected.</h2>
            <p>
              {demo
                ? "You’re exploring a local preview. Connect your own Supabase project to enable private cloud storage and sign-in."
                : "Your library requires the owner account and authenticator verification. Playback uses temporary private links."}
            </p>
            <div className="help-list">
              <p>
                <LockKeyhole size={18} /> Password + authenticator MFA
              </p>
              <p>
                <ShieldCheck size={18} /> Private storage and database access
                rules
              </p>
              <p>
                <Headphones size={18} /> iPhone: tap play; use MP3 or AAC for
                best results
              </p>
            </div>
            <p className="subtle">
              Keep your authenticator backed up securely. For lost access, use
              your Supabase dashboard to recover your account. Never share a
              playback link or this device while signed in.
            </p>
            {supabase && (
              <button
                className="primary wide"
                onClick={async () => {
                  if (authorized || signedIn) await supabase?.auth.signOut();
                  setDemo(false);
                  setTracks([]);
                  setSource("");
                  setCurrent(null);
                  setHelp(false);
                }}
              >
                <LogOut size={16} />
                {authorized ? "Sign out" : "Go to secure sign-in"}
              </button>
            )}
          </section>
        </div>
      )}
      {listDialog && (
        <div className="overlay">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collection-title"
            onSubmit={(e) => {
              e.preventDefault();
              void saveList(playlist, newListName.trim() || "My collection");
              setListDialog(false);
              setView("Collection");
            }}
          >
            <button
              type="button"
              className="close"
              aria-label="Close collection dialog"
              onClick={() => setListDialog(false)}
            >
              <X size={20} />
            </button>
            <span className="modal-icon">
              <ListMusic />
            </span>
            <h2 id="collection-title">Make it a collection.</h2>
            <p>
              Your personal queue. Add tracks using the + beside each upload.
              This version includes one collection.
            </p>
            <label>
              Collection name
              <input
                maxLength={80}
                required
                placeholder={listName}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            </label>
            <button className="primary wide">
              Save collection <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
      {deleteTrack && (
        <div className="overlay">
          <section
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
          >
            <h2 id="delete-title">Delete this file?</h2>
            <p>
              “{deleteTrack.title}” will be removed from your library and
              storage. This cannot be undone.
            </p>
            <div className="dialog-actions">
              <button
                className="text-button"
                disabled={busy}
                onClick={() => setDeleteTrack(null)}
              >
                Keep file
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() => void remove(deleteTrack)}
              >
                Delete file
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && (
        <div role="status" className="toast">
          {notice}
          <button aria-label="Dismiss" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
