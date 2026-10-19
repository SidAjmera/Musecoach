import { CoachId, Profile } from "./types";
export const coaches: {
  id: CoachId;
  defaultVersion: "female" | "male";
  role: string;
  traits: string;
  approach: string;
  color: string;
  greeting: string;
}[] = [
  {
    id: "Sunny",
    defaultVersion: "female",
    role: "Your daily dose of possibility",
    traits: "Encouraging · Expressive · Bubbly",
    approach:
      "Celebrate the small wins. Build your voice one comfortable step at a time.",
    color: "#f5bd6a",
    greeting:
      "A little practice. A little courage. A voice that feels more like you.",
  },
  {
    id: "Jules",
    defaultVersion: "male",
    role: "Make every take count",
    traits: "Cool · Practical · Detail focused",
    approach:
      "Work like a studio session: isolate a phrase, refine it, try another take.",
    color: "#96b8d0",
    greeting: "Let’s find one detail to polish in your next take.",
  },
  {
    id: "Nova",
    defaultVersion: "female",
    role: "Find your main-character energy",
    traits: "Charismatic · Ambitious · Playful",
    approach:
      "Explore clear delivery, dynamic contrast, and confident performances.",
    color: "#d2a0de",
    greeting: "Your next performance starts with one brave little take.",
  },
  {
    id: "Sage",
    defaultVersion: "female",
    role: "Room to find your voice",
    traits: "Calm · Warm · Patient",
    approach:
      "Small, unhurried steps and comfortable retries. There is no rush.",
    color: "#a4bf9d",
    greeting: "Take a breath. There’s room to explore at your own pace.",
  },
  {
    id: "Rex",
    defaultVersion: "male",
    role: "Clear targets. Real practice.",
    traits: "Direct · Witty · Fair",
    approach:
      "Straightforward feedback and a clear next target, with a little wit.",
    color: "#c5a58a",
    greeting: "One take, one useful insight. Let’s get to it.",
  },
  {
    id: "Cleo",
    defaultVersion: "female",
    role: "Give every phrase a story",
    traits: "Thoughtful · Soulful · Expressive",
    approach:
      "Explore phrasing and musical choices while keeping your own story at the centre.",
    color: "#cc927d",
    greeting: "What would you like your next phrase to say?",
  },
  {
    id: "Theo",
    defaultVersion: "male",
    role: "Meet the patterns in your voice",
    traits: "Curious · Analytical · Precise",
    approach:
      "Use measured pitch patterns and replayable moments to understand each take.",
    color: "#94b8af",
    greeting: "Let’s turn a recording into something you can understand.",
  },
  {
    id: "Lola",
    defaultVersion: "female",
    role: "A little theatre. A lot of you.",
    traits: "Dramatic · Funny · Imaginative",
    approach: "Try a scene or a character to open up new performance choices.",
    color: "#e8a2af",
    greeting: "The studio is yours. What character are we trying today?",
  },
  {
    id: "Ash",
    defaultVersion: "male",
    role: "Make space for your own sound",
    traits: "Relaxed · Creative · Open minded",
    approach:
      "Experiment without chasing someone else’s sound. Curiosity comes first.",
    color: "#b2b79d",
    greeting: "No need to sound like anyone else. Let’s explore.",
  },
  {
    id: "Kai",
    defaultVersion: "male",
    role: "Small challenges. Steady momentum.",
    traits: "Energetic · Organised · Motivating",
    approach:
      "Turn one useful insight into a short, achievable practice challenge.",
    color: "#8abfc5",
    greeting: "One small challenge today. A little more confidence tomorrow.",
  },
];
export function coachById(id: CoachId) {
  return coaches.find((c) => c.id === id)!;
}
export function measuredIntro(profile: Profile, score: number | null) {
  const intro: Record<CoachId, string> = {
    Sunny: "Here’s a small win to build on!",
    Jules: "Let’s look at this take.",
    Nova: "Ready for your next challenge?",
    Sage: "Let’s take this one step at a time.",
    Rex: "Here are the useful details.",
    Cleo: "Let’s explore the shape of this phrase.",
    Theo: "Here’s what the measurements show.",
    Lola: "Let’s replay a moment from your performance.",
    Ash: "Here’s something to experiment with.",
    Kai: "Your next practice target is ready.",
  };
  return `${intro[profile.coach]} ${score === null ? "There isn’t enough reliable evidence for a score yet." : "Use the measurements below to choose your next step."}`;
}
