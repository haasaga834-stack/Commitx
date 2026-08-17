/**
 * A short, calm motivational line for the Home screen.
 * One message per calendar day, cycling through the full list before any
 * message repeats. All lines are original CommitX copy.
 */
const MESSAGES = [
  "Small focused hours build big quiet wins.",
  "Begin gently — momentum follows attention.",
  "One page, one problem, one calm hour.",
  "Today only needs your next honest effort.",
  "Progress prefers patience over pressure.",
  "Protect one hour and the day feels lighter.",
  "Consistency is quieter than motivation, and stronger.",
  "Show up softly; finish steadily.",
  "Deep work now, easy evening later.",
  "Your focus is the rarest thing you own.",
  "Let the timer carry the discipline today.",
  "Finish what you promised yourself this morning.",
  "Clear desk, clear mind, one clear goal.",
  "Distraction is loud; results are silent.",
  "Trust the hour you are in.",
  "Effort compounds long before it shows.",
  "Choose the hard hour while it is still early.",
  "You do not need more time, only fewer tabs.",
  "Start before you feel ready — clarity arrives later.",
  "Keep the promise, however small it looks.",
  "Every completed session is proof you can.",
  "Slow, steady sessions beat frantic nights.",
  "Focus is a skill; today is practice.",
  "Leave today a little ahead of yesterday.",
  "Quiet effort today, calm confidence tomorrow.",
  "Do the work your future self will thank you for.",
  "One commitment kept changes the whole day.",
  "Less scrolling, more finishing.",
  "Discipline feels heavy, regret feels heavier.",
  "Sit down, breathe once, begin.",
];

export function dailyMessage(now: Date = new Date()): string {
  const dayIndex = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000,
  );
  return MESSAGES[((dayIndex % MESSAGES.length) + MESSAGES.length) % MESSAGES.length];
}
