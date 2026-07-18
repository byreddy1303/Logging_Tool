// Deterministic pick of one motivational quote per calendar day.
// Tone: "cocky" per Kalyan's ask — sharp, no filler, no emojis.
// Keep the list long enough that a full month doesn't repeat.

export const QUOTES: string[] = [
  "Rank isn't given. It's taken.",
  "Nobody's coming to save you. Sit down and solve.",
  "Your competition is asleep. Are you?",
  "Every mistake you tag today is one you won't make in February.",
  "Focus is the whole game. Everyone else is playing checkers.",
  "Discipline eats motivation for breakfast. Especially at 6 AM.",
  "Compression compounds. Today is one click on the ratchet.",
  "AIR under 100 is not luck. It's inventory + reflex.",
  "Everyone reads the theorem. Very few practice the trigger.",
  "Miss a re-attempt today, and February will collect the debt.",
  "Rank isn't about IQ. It's about not lying to yourself about weak spots.",
  "You don't need more books. You need to close the ones you already opened.",
  "One weekly fix, done ruthlessly, beats twenty half-hearted resolutions.",
  "You're not behind. You're just being honest for the first time.",
  "The pattern is boring only until it costs you 2 marks.",
  "GATE is a scored exam, not a poem. Precision > vibes.",
  "Every 'silly mistake' is a strategy problem in disguise.",
  "Study now with intent, or panic later with excuses.",
  "Solve the question in the paper, not the one you wished they asked.",
  "The rank is decided in July, not in February. February just prints it.",
  "Talent gets you 500 marks. Bookkeeping gets you 900.",
  "Stop rehearsing sympathy. Start rehearsing questions.",
  "You already know the theory. What you owe yourself is the reps.",
  "The people getting AIR 1 today were tagging patterns in July.",
  "You can outwork almost anyone in this exam. Almost.",
  "Motivation is unreliable. Systems are lethal.",
  "Every W-C you skip becomes a W-C on the paper.",
  "Nobody watches your daily grind. That's the point.",
  "Two hours of pattern drills > eight hours of tutorials.",
  "You're not lazy. You're just optimising for comfort. Change the objective.",
  "There is no 'later'. There's this morning.",
  "You want the rank, or you want the story about wanting it?"
];

/** Deterministic per-day pick, seeded by ISO date + user id so multiple
 *  users on the same day see different quotes but each user is stable. */
export function pickQuoteForDay(isoDate: string, seedSalt = ''): string {
  const src = `${isoDate}:${seedSalt}`;
  let h = 2166136261;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return QUOTES[h % QUOTES.length];
}

export function greetingForHour(hour: number, firstName: string): string {
  const who = firstName.trim() ? firstName.trim() : 'friend';
  if (hour < 5) return `Late night, ${who}.`;
  if (hour < 12) return `Good morning, ${who}.`;
  if (hour < 17) return `Good afternoon, ${who}.`;
  if (hour < 21) return `Good evening, ${who}.`;
  return `Late night, ${who}.`;
}
