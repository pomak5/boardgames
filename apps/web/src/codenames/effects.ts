import confetti from 'canvas-confetti';
import type { Team } from '@boardgames/shared';

const TEAM_COLORS: Record<Team, string[]> = {
  red: ['#d44b32', '#e8654c', '#f2b3a4', '#e8b14a'],
  blue: ['#3a6ea5', '#4f86bf', '#a9c6e2', '#e8b14a'],
};

/** Залп конфетти в цветах команды-победителя: два боковых пушечных выстрела. */
export function fireWinConfetti(team: Team): void {
  const colors = TEAM_COLORS[team];
  const shot = (x: number, angle: number) =>
    confetti({
      particleCount: 90,
      spread: 65,
      startVelocity: 48,
      gravity: 0.9,
      scalar: 0.95,
      ticks: 220,
      origin: { x, y: 0.75 },
      angle,
      colors,
    });
  shot(0.12, 62);
  shot(0.88, 118);
  setTimeout(() => shot(0.5, 90), 280);
}
