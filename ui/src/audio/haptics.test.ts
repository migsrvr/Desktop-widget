import { describe, it, expect, beforeEach, vi } from 'vitest';
import { haptics } from './haptics';

describe('AudioHapticsEngine', () => {
  beforeEach(() => {
    haptics.setMuted(false);
  });

  it('can toggle mute state', () => {
    expect(haptics.getMuted()).toBe(false);
    haptics.setMuted(true);
    expect(haptics.getMuted()).toBe(true);
  });

  it('executes sound triggers without throwing in headless/SSR environments', () => {
    expect(() => {
      haptics.hapticPop();
      haptics.snapClick();
      haptics.agentAlertChime();
      haptics.successChime();
    }).not.toThrow();
  });
});
