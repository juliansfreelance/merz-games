export type PlayResult = 'win' | 'lose' | 'out-of-lives';

export const VALID_PLAY_RESULTS: readonly PlayResult[] = [
  'win',
  'lose',
  'out-of-lives',
];

export function isValidPlayResult(value: string): value is PlayResult {
  return (VALID_PLAY_RESULTS as readonly string[]).includes(value);
}
