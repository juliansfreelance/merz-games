import { isChromeDevtoolsStartTimeNoise } from './app-error';

describe('isChromeDevtoolsStartTimeNoise', () => {
  it('reconoce el TypeError aunque Chrome no adjunte stack ni filename VM', () => {
    expect(
      isChromeDevtoolsStartTimeNoise(
        "Uncaught TypeError: Cannot read properties of undefined (reading 'startTime')",
      ),
    ).toBe(true);
  });

  it('no oculta un error real de la app con startTime en el mensaje', () => {
    const error = new Error("Cannot read properties of undefined (reading 'startTime')");
    error.stack = 'TypeError: ... startTime\n    at Splash.runPreloader (splash.ts:192)';
    expect(isChromeDevtoolsStartTimeNoise(error, 'http://localhost:4200/main.js')).toBe(false);
  });
});
