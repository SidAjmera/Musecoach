import { Session } from "./types";
import { exerciseKey } from "./exercises";
export function comparable(a: Session, b: Session) {
  return (
    a.id !== b.id &&
    a.context !== "free" &&
    a.analysis.version === b.analysis.version &&
    exerciseKey(a.analysis.exercise) === exerciseKey(b.analysis.exercise)
  );
}
export function previousAttempt(session: Session, sessions: Session[]) {
  return sessions
    .filter((s) => s.date < session.date && comparable(s, session))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}
