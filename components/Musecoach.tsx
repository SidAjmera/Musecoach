"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  Mic,
  MessageCircle,
  AudioLines,
  ChartNoAxesCombined,
  Sun,
  Moon,
  ArrowUpRight,
  ArrowRight,
  Settings2,
  Sparkles,
  Play,
  ChevronRight,
  ShieldCheck,
  Headphones,
  Music2,
  Trash2,
  Check,
} from "lucide-react";
import { defaultProfile, ExerciseKind, Profile, Session } from "@/lib/types";
import { coachById } from "@/lib/coaches";
import {
  clearData,
  deleteAudio,
  deleteSession,
  listSessions,
  readProfile,
  saveProfile,
  saveSession,
  restoreSessionHistory,
} from "@/lib/storage";
import {
  exerciseInfo,
  makeExercise,
  noteName,
  exerciseKinds,
  exerciseSpan,
} from "@/lib/exercises";
import VoiceVisual from "./VoiceVisual";
import ProfileEditor from "./ProfileEditor";
import Recorder from "./Recorder";
import Review from "./Review";
import Coach from "./Coach";
import ProgressTrend from "./ProgressTrend";
import PitchTuner from "./PitchTuner";
import ExerciseLibrary from "./ExerciseLibrary";
import PracticePlan from "./PracticePlan";
import ExerciseDesigner from "./ExerciseDesigner";
import { readDesignedExercise } from "@/lib/designed-exercise";
import { practicePlan } from "@/lib/practice-plan";
import ProgressExport from "./ProgressExport";
import HistoryBackup, { type RestoreResult } from "./HistoryBackup";
import { type HistoryBackup as Backup } from "@/lib/history-backup";
const navigation = [
  { path: "/", label: "Home", icon: House },
  { path: "/record", label: "Record & Review", icon: Mic },
  { path: "/coach", label: "My Coach", icon: MessageCircle },
  { path: "/practice", label: "Practice", icon: AudioLines },
  { path: "/progress", label: "Progress", icon: ChartNoAxesCombined },
];
export default function Musecoach() {
  const router = useRouter(),
    path = usePathname(),
    [profile, setProfile] = useState<Profile>(defaultProfile),
    [sessions, setSessions] = useState<Session[]>([]),
    [ready, setReady] = useState(false),
    [editing, setEditing] = useState(false),
    [first, setFirst] = useState(false),
    [error, setError] = useState(""),
    [confirm, setConfirm] = useState<"all" | "session" | "audio" | null>(null),
    [notice, setNotice] = useState("");
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    try {
      const p = readProfile();
      if (p) setProfile(p);
    } catch {
      setError(
        "Profile storage is unavailable. Your browser may block local storage.",
      );
    }
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = profile.theme;
  }, [profile.theme]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    const practiceSelection =
      previousPath.current?.startsWith("/practice") &&
      path.startsWith("/practice");
    previousPath.current = path;
    if (!practiceSelection) document.getElementById("page-title")?.focus();
  }, [path]);
  function updateProfile(p: Profile) {
    try {
      saveProfile(p);
      setProfile(p);
      setEditing(false);
      setFirst(false);
      setNotice("Your preferences are saved in this browser.");
    } catch {
      setError(
        "Could not save your preferences. Check browser storage settings.",
      );
    }
  }
  const coach = coachById(profile.coach),
    active = navigation.find((n) =>
      n.path === "/" ? path === "/" : path.startsWith(n.path),
    ),
    parts = path.split("/").filter(Boolean),
    detail =
      parts[0] === "session"
        ? sessions.find((s) => s.id === parts[1])
        : undefined,
    kind = parts[1] as ExerciseKind,
    base = Number(parts[2]),
    recommended = practicePlan(sessions, profile).exercises[0] || "hold";
  function practice(k: ExerciseKind) {
    router.push(`/practice/${k}`, { scroll: !path.startsWith("/practice") });
  }
  async function onSave(session: Session, blob?: Blob) {
    await saveSession(session, blob);
    setSessions(await listSessions());
    router.push(`/session/${session.id}`);
  }
  async function remove() {
    try {
      if (confirm === "all") {
        await clearData();
        setProfile(defaultProfile);
        setSessions([]);
        setFirst(false);
        setEditing(false);
        router.push("/");
        setNotice("All local Musecoach data has been deleted.");
      } else if (detail) {
        if (confirm === "audio") {
          await deleteAudio(detail.id);
          setNotice("Saved audio deleted. Measurements kept.");
        } else {
          await deleteSession(detail.id);
          router.push("/progress");
          setNotice("Session deleted.");
        }
        setSessions(await listSessions());
      }
      setConfirm(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const title =
    parts[0] === "session"
      ? "Your session"
      : parts[0] === "record"
        ? "Record & Review"
        : parts[0] === "coach"
          ? "My Coach"
          : parts[0] === "practice"
            ? "Practice Studio"
            : parts[0] === "progress"
              ? "Your progress"
              : parts.length
                ? "Page not found"
                : "Your studio";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Musecoach home">
          <span className="brand-mark">
            <AudioLines size={23} />
          </span>
          musecoach<span className="brand-period">.</span>
        </Link>
        <p className="sidebar-caption">A LITTLE PRACTICE. MORE YOU.</p>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <Link
              key={n.path}
              href={n.path}
              aria-label={n.label}
              aria-current={active?.path === n.path ? "page" : undefined}
              className={
                active?.path === n.path ? "nav-link active" : "nav-link"
              }
            >
              <n.icon size={20} strokeWidth={1.65} />
              <span>{n.label}</span>
              {active?.path === n.path && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="sun-doodle">✳</span>
            <p>
              A voice doesn’t grow
              <br />
              all at once.
            </p>
            <span>A little today is enough.</span>
          </div>
          <button
            className="profile-button"
            onClick={() => {
              setEditing(true);
              setFirst(false);
            }}
          >
            <span className="profile-initial">
              {profile.name?.[0]?.toUpperCase() || "Y"}
            </span>
            <span>
              <strong>{profile.name || "Your space"}</strong>
              <small>Local profile</small>
            </span>
            <Settings2 size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            My workspace <ChevronRight size={13} /> <span>{title}</span>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <span /> A space for your voice
            </span>
            <button
              className="icon-button"
              aria-label={`Switch to ${profile.theme === "light" ? "dark" : "light"} mode`}
              onClick={() =>
                updateProfile({
                  ...profile,
                  theme: profile.theme === "light" ? "dark" : "light",
                })
              }
            >
              {profile.theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </button>
            <button
              className="small-profile"
              aria-label="Edit your profile"
              onClick={() => {
                setEditing(true);
                setFirst(false);
              }}
            >
              {profile.name?.[0]?.toUpperCase() || "Y"}
            </button>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {path === "/"
                  ? "YOUR PERSONAL SINGING STUDIO"
                  : "MAKE ROOM FOR YOUR VOICE"}
              </span>
              <h1 id="page-title" tabIndex={-1}>
                {path === "/" ? `Hello, ${profile.name || "singer"}.` : title}
                {path === "/" && <span className="hello-spark"> ✧</span>}
              </h1>
              <p className="muted">
                {path === "/"
                  ? "Good things happen when you show up for your voice."
                  : parts[0] === "record"
                    ? "One take. A few useful insights. A little more confidence."
                    : parts[0] === "practice"
                      ? "Small exercises. Real feedback. Progress at your own pace."
                      : parts[0] === "progress"
                        ? "Your practice, one honest step at a time."
                        : parts[0] === "coach"
                          ? "A teaching style that feels like you."
                          : ""}
              </p>
            </div>
            {path === "/" && (
              <button
                className="text-button heading-action"
                onClick={() => {
                  setEditing(true);
                  setFirst(false);
                }}
              >
                <Settings2 size={16} /> Personalise your studio
              </button>
            )}
          </div>
          {error && (
            <div className="notice warning" role="alert">
              {error}
              <button className="text-button" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {notice && (
            <div className="status-toast" role="status">
              <Check size={15} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                ×
              </button>
            </div>
          )}
          {!ready ? (
            <div className="panel loading-state">
              Opening your local studio…
            </div>
          ) : path === "/" ? (
            <>
              <section className="home-top">
                <div className="hero">
                  <div className="hero-content">
                    <span className="tag hero-tag">
                      <Sparkles size={13} /> YOUR VOICE HAS POSSIBILITIES
                    </span>
                    <h2>
                      Find your voice.
                      <br />
                      Make it <em>yours.</em>
                    </h2>
                    <p>
                      No perfect takes required. Just a little curiosity,
                      <br className="desktop-break" /> a coach in your corner,
                      and room to grow.
                    </p>
                    <Link href="/record" className="button primary">
                      <Mic size={17} /> Let’s hear you{" "}
                      <ArrowUpRight size={17} />
                    </Link>
                    <span className="hero-footnote">
                      15–60 seconds. A small start is a real start.
                    </span>
                  </div>
                  <VoiceVisual coach={profile.coach} />
                </div>
                <aside className="next-card">
                  <div className="section-heading">
                    <span className="eyebrow">A LITTLE FOCUS FOR TODAY</span>
                    <span className="small-star">✧</span>
                  </div>
                  <span className="exercise-doodle">
                    {exerciseInfo[recommended].icon}
                  </span>
                  <h3>{exerciseInfo[recommended].name}</h3>
                  <p>{exerciseInfo[recommended].description}</p>
                  <div className="chips">
                    <span className="tag">18 seconds</span>
                    <span className="tag">
                      {exerciseInfo[recommended].focus}
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => practice(recommended)}
                  >
                    Give it a try <ArrowRight size={17} />
                  </button>
                </aside>
              </section>
              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">THE WAY FORWARD</span>
                    <h2>A small practice. A good beginning.</h2>
                  </div>
                  <Link href="/practice" className="text-button">
                    Explore the studio <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="practice-grid">
                  {(["match", "hold", "melody"] as ExerciseKind[]).map(
                    (k, i) => (
                      <button
                        key={k}
                        className={`practice-card practice-${k}`}
                        onClick={() => practice(k)}
                      >
                        <span className="practice-icon">
                          {k === "match" ? (
                            <Headphones size={25} />
                          ) : k === "hold" ? (
                            <AudioLines size={25} />
                          ) : (
                            <Music2 size={25} />
                          )}
                        </span>
                        <div>
                          <span className="eyebrow">
                            0{i + 1} / {exerciseInfo[k].focus.toUpperCase()}
                          </span>
                          <h3>{exerciseInfo[k].label}</h3>
                          <p>{exerciseInfo[k].description}</p>
                        </div>
                        <span className="round-arrow">
                          <ArrowUpRight size={17} />
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </section>
              {profile.favoriteExercises.length > 0 && (
                <section
                  className="panel home-favorites"
                  aria-label="Favourite exercises"
                >
                  <div className="section-heading">
                    <h3>Your favourites</h3>
                    <Link href="/practice" className="text-button">
                      View library <ArrowRight size={15} />
                    </Link>
                  </div>
                  <div className="chips">
                    {profile.favoriteExercises.slice(0, 4).map((kind) => {
                      const unavailable =
                        exerciseSpan(kind) > profile.high - profile.low;
                      return (
                        <button
                          key={kind}
                          className="chip"
                          aria-label={`Open favourite: ${exerciseInfo[kind].label}`}
                          disabled={unavailable}
                          onClick={() => practice(kind)}
                        >
                          {exerciseInfo[kind].label}
                          {unavailable ? " · outside current range" : ""}
                        </button>
                      );
                    })}
                  </div>
                  <p className="small muted">
                    Saved from your practice library. Your current comfortable
                    range still applies.
                  </p>
                </section>
              )}
              <div className="home-bottom">
                <section className="panel recent-panel">
                  <div className="section-heading">
                    <h3>Your latest notes</h3>
                    <Link href="/progress" className="text-button">
                      View progress <ArrowRight size={15} />
                    </Link>
                  </div>
                  {sessions.length ? (
                    <SessionRows sessions={sessions.slice(0, 3)} />
                  ) : (
                    <div className="empty-recent">
                      <span className="empty-icon">
                        <ChartNoAxesCombined size={24} />
                      </span>
                      <div>
                        <h4>Your story starts with one take.</h4>
                        <p>
                          Your recordings and progress will find a home here.
                          <br />
                          No scores yet. Just possibilities.
                        </p>
                      </div>
                      <Link href="/record" className="text-button">
                        Start your first take <ArrowRight size={15} />
                      </Link>
                    </div>
                  )}
                </section>
                <section className="small-coach-note">
                  <span className="eyebrow">
                    A NOTE FROM {coach.id.toUpperCase()}
                  </span>
                  <p>“{coach.greeting}”</p>
                  <Link href="/coach" className="text-button">
                    Meet your coach <ArrowRight size={15} />
                  </Link>
                </section>
              </div>
              <footer className="studio-footer">
                <ShieldCheck size={14} />
                <span>
                  Your voice stays yours. Local analysis. No sign-up needed.
                </span>
                <span>
                  Made for the joy of singing <span aria-hidden="true">✧</span>
                </span>
              </footer>
            </>
          ) : parts[0] === "record" ? (
            <RecordingRoute
              key={path}
              kind={kind}
              base={base}
              profile={profile}
              rangeExploration={(kind as string) === "range"}
              onSave={onSave}
            />
          ) : parts[0] === "coach" ? (
            <Coach
              profile={profile}
              sessions={sessions}
              onCustomize={() => {
                setFirst(false);
                setEditing(true);
              }}
            />
          ) : parts[0] === "practice" ? (
            <Practice
              profile={profile}
              sessions={sessions}
              kind={kind}
              onStart={(k, b) => router.push(`/record/${k}/${b}`)}
              onRange={() => router.push("/record/range")}
              onSelect={practice}
              onDesigned={() => router.push("/record/designed")}
              onFavorites={(favoriteExercises) => {
                try {
                  const next = { ...profile, favoriteExercises };
                  saveProfile(next);
                  setProfile(next);
                } catch {
                  setError(
                    "Could not save your favourite exercises. Check browser storage permissions.",
                  );
                }
              }}
            />
          ) : parts[0] === "progress" ? (
            <Progress
              sessions={sessions}
              profile={profile}
              onProfile={updateProfile}
              onClear={() => setConfirm("all")}
              onRestore={async (backup, replaceProfile) => {
                const result = await restoreSessionHistory(backup.sessions);
                setSessions(await listSessions());
                const restored: RestoreResult = {
                  ...result,
                  profileRestored: false,
                };
                if (replaceProfile) {
                  try {
                    saveProfile(backup.profile);
                    setProfile(backup.profile);
                    restored.profileRestored = true;
                  } catch {
                    restored.profileError =
                      "History was restored, but the profile could not be saved. Check local storage permissions and retry the profile option.";
                  }
                }
                return restored;
              }}
            />
          ) : parts[0] === "session" ? (
            detail ? (
              <>
                <div className="session-heading">
                  <h2>{detail.title}</h2>
                  <p className="muted">
                    {formatDate(detail.date)} ·{" "}
                    {detail.context === "free"
                      ? "Free singing"
                      : exerciseInfo[detail.context].label}
                  </p>
                </div>
                <Review
                  session={detail}
                  sessions={sessions}
                  profile={profile}
                  onPractice={practice}
                  onDelete={() => setConfirm("session")}
                  onDeleteAudio={() => setConfirm("audio")}
                  onReanalyze={async (updated, audio) => {
                    await saveSession(updated, audio);
                    setSessions(await listSessions());
                  }}
                  onRange={(low, high) =>
                    updateProfile({
                      ...profile,
                      low: Math.max(36, low),
                      high: Math.min(88, high),
                      rangeSet: true,
                      rangeProvisional: true,
                    })
                  }
                />
              </>
            ) : (
              <div className="panel empty-state">
                <h2>That session isn’t in this browser.</h2>
                <p>It may have been deleted, or recorded on another device.</p>
                <Link href="/progress" className="button secondary">
                  Back to history
                </Link>
              </div>
            )
          ) : (
            <div className="panel empty-state">
              <h2>This corner of the studio doesn’t exist.</h2>
              <Link href="/" className="button primary">
                Back home
              </Link>
            </div>
          )}
        </main>
      </div>
      {editing && (
        <ProfileEditor
          initial={profile}
          onSave={updateProfile}
          onClose={() => {
            setEditing(false);
            if (first)
              try {
                saveProfile(profile);
              } catch {}
            setFirst(false);
          }}
          onboarding={first}
        />
      )}{" "}
      {confirm && (
        <ConfirmDialog
          kind={confirm}
          onCancel={() => setConfirm(null)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}
function SessionRows({ sessions }: { sessions: Session[] }) {
  return (
    <div className="session-list">
      {sessions.map((s) => (
        <Link href={`/session/${s.id}`} className="session-row" key={s.id}>
          <span className="session-icon">
            {s.context === "free" ? (
              <Mic size={19} />
            ) : (
              <AudioLines size={19} />
            )}
          </span>
          <span>
            <strong>{s.title}</strong>
            <small>
              {formatDate(s.date)} · {s.analysis.duration.toFixed(0)}s
              {s.audioSaved ? " · Audio saved" : ""}
            </small>
          </span>
          <span className="session-score">
            {s.analysis.score ?? "—"}
            <small>{s.context === "free" ? "indicator" : "exercise"}</small>
          </span>
          <ChevronRight size={17} />
        </Link>
      ))}
    </div>
  );
}
function RecordingRoute({
  kind,
  base,
  profile,
  rangeExploration,
  onSave,
}: {
  kind: ExerciseKind;
  base: number;
  profile: Profile;
  rangeExploration: boolean;
  onSave: (s: Session, b?: Blob) => Promise<void>;
}) {
  try {
    const valid = exerciseKinds.includes(kind);
    const exercise =
      (kind as string) === "designed"
        ? readDesignedExercise(profile)
        : valid
          ? makeExercise(kind, Number.isFinite(base) ? base : 60, profile)
          : undefined;
    return (
      <Recorder
        exercise={exercise}
        rangeExploration={rangeExploration}
        onSave={onSave}
      />
    );
  } catch (e) {
    return (
      <div role="alert" className="panel">
        <h2>Let’s choose a comfortable target.</h2>
        <p>{(e as Error).message}</p>
        <Link href="/practice">Return to Practice</Link>
      </div>
    );
  }
}
function Practice({
  profile,
  sessions,
  kind,
  onStart,
  onRange,
  onSelect,
  onDesigned,
  onFavorites,
}: {
  profile: Profile;
  sessions: Session[];
  kind: ExerciseKind;
  onStart: (k: ExerciseKind, b: number) => void;
  onRange: () => void;
  onSelect: (k: ExerciseKind) => void;
  onDesigned: () => void;
  onFavorites: (kinds: ExerciseKind[]) => void;
}) {
  const routeSelection = exerciseKinds.includes(kind) ? kind : "hold";
  const [selected, setSelected] = useState<ExerciseKind>(routeSelection),
    [base, setBase] = useState(
      Math.max(profile.low, Math.min(60, profile.high - 4)),
    ),
    [error, setError] = useState("");
  const current = exerciseInfo[selected];
  const challengeHeading = useRef<HTMLHeadingElement>(null);
  function revealChallenge() {
    challengeHeading.current?.focus({ preventScroll: true });
    challengeHeading.current
      ?.closest("section")
      ?.scrollIntoView({ block: "start", behavior: "auto" });
  }
  // The route can replace the page after the optimistic selection has rendered.
  // Restore the destination heading on the completed route as well.
  useEffect(() => {
    if (!exerciseKinds.includes(kind)) return;
    const frame = requestAnimationFrame(revealChallenge);
    return () => cancelAnimationFrame(frame);
  }, [kind]);
  function choose(kind: ExerciseKind) {
    setSelected(kind);
    onSelect(kind);
    setError("");
    requestAnimationFrame(revealChallenge);
  }
  useEffect(() => setSelected(routeSelection), [routeSelection]);
  useEffect(() => {
    setBase((value) =>
      Math.max(
        profile.low,
        Math.min(value, profile.high - exerciseSpan(selected)),
      ),
    );
  }, [selected, profile.low, profile.high]);
  return (
    <>
      <PracticePlan sessions={sessions} profile={profile} onChoose={choose} />
      <ExerciseDesigner
        sessions={sessions}
        profile={profile}
        onUse={onDesigned}
      />
      <ExerciseLibrary
        selected={selected}
        profile={profile}
        onSelect={choose}
        onFavorites={onFavorites}
      />
      <div className="practice-studio">
        <section className={`panel exercise-main practice-${selected}`}>
          <span className="exercise-doodle">{current.icon}</span>
          <span className="eyebrow">A SMALL CHALLENGE · 18 SECONDS</span>
          <h2 ref={challengeHeading} tabIndex={-1}>
            {current.name}
          </h2>
          <p>{current.description}</p>
          <div className="exercise-steps">
            <div>
              <span>1</span>Listen to the reference
            </div>
            <div>
              <span>2</span>Sing after the count-in
            </div>
            <div>
              <span>3</span>Review your measured result
            </div>
          </div>
          <label className="target-selector">
            Base note{" "}
            <select
              value={base}
              onChange={(e) => setBase(Number(e.target.value))}
            >
              {Array.from(
                {
                  length: Math.max(
                    0,
                    profile.high - profile.low + 1 - exerciseSpan(selected),
                  ),
                },
                (_, i) => profile.low + i,
              ).map((n) => (
                <option key={n} value={n}>
                  {noteName(n)}
                </option>
              ))}
            </select>
          </label>
          <p className="small muted">
            The base anchors the pattern. Descending patterns can begin on a
            higher note; the reference shows every target.
          </p>
          <p className="small muted">
            {profile.rangeSet
              ? `Your ${profile.rangeProvisional ? "provisional " : ""}range`
              : "Starting practice window"}
            : {noteName(profile.low)}–{noteName(profile.high)}. Adjust your
            profile to notes that feel comfortable. Coach presentation never
            sets your range.
          </p>
          <button
            className="button primary"
            onClick={() => {
              try {
                const e = makeExercise(selected, base, profile);
                onStart(selected, e.base);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Play size={17} /> Open exercise <ArrowRight size={17} />
          </button>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </section>
        <aside>
          <PitchTuner />
          <section className="panel">
            <span className="eyebrow">KEEP IT COMFORTABLE</span>
            <h3>Easy is a good place to start.</h3>
            <p className="muted">
              Use a gentle hum or an “oo”. Leave space between phrases. No need
              to push for high notes or volume.
            </p>
            <p className="small muted">
              If singing causes pain, stop. These measurements cannot assess
              vocal health.
            </p>
          </section>
          <section className="panel range-card">
            <AudioLines size={27} />
            <h3>Not sure where to begin?</h3>
            <p className="muted">
              Explore a few easy notes to find a provisional practice window.
            </p>
            <button className="text-button" onClick={onRange}>
              Explore my comfortable range <ArrowRight size={15} />
            </button>
          </section>
        </aside>
      </div>
    </>
  );
}
function Progress({
  sessions,
  profile,
  onClear,
  onProfile,
  onRestore,
}: {
  sessions: Session[];
  profile: Profile;
  onProfile: (p: Profile) => void;
  onRestore: (
    backup: Backup,
    replaceProfile: boolean,
  ) => Promise<RestoreResult>;
  onClear: () => void;
}) {
  const [goal, setGoal] = useState("all");
  const visible = sessions.filter(
    (s) =>
      goal === "all" ||
      (goal === "free" ? s.context === "free" : s.context !== "free"),
  );
  return (
    <>
      <div className="stats-row">
        <div className="panel stat">
          <span>Saved takes</span>
          <strong>{sessions.length}</strong>
          <small>Real sessions, in this browser</small>
        </div>
        <div className="panel stat">
          <span>Exercises completed</span>
          <strong>
            {
              sessions.filter(
                (s) => s.context !== "free" && s.analysis.score !== null,
              ).length
            }
          </strong>
          <small>With enough evidence to score</small>
        </div>
        <div className="panel stat">
          <span>Practice time</span>
          <strong>
            {(
              sessions.reduce((n, s) => n + s.analysis.duration, 0) / 60
            ).toFixed(1)}
            <em> min</em>
          </strong>
          <small>From your reviewed takes</small>
        </div>
      </div>
      <ProgressTrend sessions={sessions} />
      <section className="panel goals-panel">
        <h3>Your practice intentions</h3>
        <div className="chips">
          {profile.goals.length ? (
            profile.goals.map((g) => (
              <button
                className={
                  profile.completedGoals.includes(g) ? "chip selected" : "chip"
                }
                key={g}
                aria-pressed={profile.completedGoals.includes(g)}
                aria-label={g + " goal complete"}
                onClick={() =>
                  onProfile({
                    ...profile,
                    completedGoals: profile.completedGoals.includes(g)
                      ? profile.completedGoals.filter((v) => v !== g)
                      : [...profile.completedGoals, g],
                  })
                }
              >
                {profile.completedGoals.includes(g) ? "✓ " : ""}
                {g}
              </button>
            ))
          ) : (
            <p className="muted">
              Add goals in your profile whenever you’re ready.
            </p>
          )}
        </div>
        <p className="small muted">
          Tap a goal to mark it complete or reopen it. These are your own
          milestones, not automatically measured achievements.
        </p>
      </section>
      <ProgressExport sessions={sessions} />
      <HistoryBackup
        profile={profile}
        sessions={sessions}
        onRestore={onRestore}
      />
      <section className="panel">
        <div className="section-heading">
          <h3>Your session history</h3>
          <label className="sr-only" htmlFor="history-filter">
            Filter history
          </label>
          <select
            id="history-filter"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          >
            <option value="all">All sessions</option>
            <option value="free">Free singing</option>
            <option value="exercise">Exercises</option>
          </select>
        </div>
        {visible.length ? (
          <SessionRows sessions={visible} />
        ) : (
          <div className="empty-inline">
            No sessions here yet. Your next take will be waiting here after
            review.
          </div>
        )}
      </section>
      <div className="history-footer">
        <p className="small muted">
          History belongs to this browser and device. Clearing browser data may
          erase it. Audio is saved only when you choose.
        </p>
        <button className="text-button danger" onClick={onClear}>
          <Trash2 size={15} /> Delete all local data
        </button>
      </div>
    </>
  );
}
function ConfirmDialog({
  kind,
  onCancel,
  onConfirm,
}: {
  kind: "all" | "session" | "audio";
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    document.querySelector<HTMLDialogElement>("#confirm-dialog")?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      id="confirm-dialog"
      className="confirm-dialog"
      onCancel={onCancel}
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title">
        {kind === "all"
          ? "Clear your local studio?"
          : kind === "audio"
            ? "Delete this saved audio?"
            : "Delete this session?"}
      </h2>
      <p>
        {kind === "all"
          ? "This removes your profile, conversations, saved API key, recordings, and measured history from this browser."
          : kind === "audio"
            ? "The audio will be removed from this browser. Your session measurements will stay."
            : "The recording and its measured results will be removed from this browser."}{" "}
        This can’t be undone.
      </p>
      <div className="modal-actions">
        <button autoFocus className="button secondary" onClick={onCancel}>
          Keep it
        </button>
        <button className="button destructive" onClick={onConfirm}>
          Delete{" "}
          {kind === "all"
            ? "all local data"
            : kind === "audio"
              ? "audio"
              : "session"}
        </button>
      </div>
    </dialog>
  );
}
