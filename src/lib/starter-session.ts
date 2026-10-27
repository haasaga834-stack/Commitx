export const STARTER_MINUTES = 15;
export const FIRST_COMPLETION_BONUS = 50;
export function shouldShowStarter(hydrated: boolean, completed: number) {
  return hydrated && completed === 0;
}