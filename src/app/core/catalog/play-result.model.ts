export type PlayResult = 'win' | 'lose' | 'out-of-lives' | 'draw';

export const VALID_PLAY_RESULTS: readonly PlayResult[] = [
  'win',
  'lose',
  'out-of-lives',
  'draw',
];

export function isValidPlayResult(value: string): value is PlayResult {
  return (VALID_PLAY_RESULTS as readonly string[]).includes(value);
}
