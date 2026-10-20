"use client";
import Link from "next/link";
import { practicePlan } from "@/lib/practice-plan";
import { exerciseInfo } from "@/lib/exercises";
import { ExerciseKind, Profile, Session } from "@/lib/types";

export default function PracticePlan({
  sessions,
  profile,
  onChoose,
}: {
  sessions: Session[];
  profile: Profile;
  onChoose: (kind: ExerciseKind) => void;
}) {
  const plan = practicePlan(sessions, profile);
  return (
    <section className="panel practice-plan" aria-label="Your practice focus">
      <span className="eyebrow">A NEXT STEP THAT FITS YOUR PRACTICE</span>
      <h3>{plan.title}</h3>
      <p className="small muted">{plan.reason}</p>
      <div className="chips">
        {plan.exercises.map((kind) => (
          <button key={kind} className="chip" onClick={() => onChoose(kind)}>
            Try {exerciseInfo[kind].label.toLowerCase()}
          </button>
        ))}
      </div>
      {plan.pointers.length > 0 && (
        <details>
          <summary>Keep your latest pointers in mind</summary>
          <ul>
            {plan.pointers.map((pointer, index) => (
              <li key={index}>{pointer}</li>
            ))}
          </ul>
        </details>
      )}
      {plan.evidence.length > 0 && (
        <details>
          <summary>Why this focus?</summary>
          <p className="small muted">
            Only measured dimensions are considered. Missing metrics do not
            count as zero, and older detector versions are excluded. These are
            suggestions across recent practice, not a progress comparison.
          </p>
          <ul>
            {plan.evidence.map((e) => (
              <li key={e.sessionId}>
                <Link href={`/session/${e.sessionId}`}>
                  {e.label}: {e.score}/100 — view take
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="small muted">
        Uses measurements saved in this browser. No API key needed.
      </p>
    </section>
  );
}
