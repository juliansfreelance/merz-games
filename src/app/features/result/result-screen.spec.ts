import { isValidPlayResult } from '../../core/catalog/play-result.model';

describe('isValidPlayResult', () => {
  it('should return true for valid results', () => {
    expect(isValidPlayResult('win')).toBe(true);
    expect(isValidPlayResult('lose')).toBe(true);
    expect(isValidPlayResult('out-of-lives')).toBe(true);
  });

  it('should return false for unknown values', () => {
    expect(isValidPlayResult('draw')).toBe(false);
    expect(isValidPlayResult('')).toBe(false);
    expect(isValidPlayResult('WIN')).toBe(false);
    expect(isValidPlayResult('nones')).toBe(false);
  });
});
