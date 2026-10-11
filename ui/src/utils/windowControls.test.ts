import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyWindowLayering, exitApplication, shouldKeepWindowOnTop } from './windowControls';

const native = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(), close: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke, isTauri: native.isTauri }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ close: native.close }) }));

describe('window mode and exit controls', () => {
  const browserClose = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    native.isTauri.mockReturnValue(true);
    native.invoke.mockResolvedValue(undefined);
    native.close.mockResolvedValue(undefined);
    vi.stubGlobal('window', { close: browserClose });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps Dock and Focus above other windows and restores the Board pin preference', async () => {
    expect(shouldKeepWindowOnTop('DOCK', false)).toBe(true);
    expect(shouldKeepWindowOnTop('FOCUS', false)).toBe(true);
    expect(shouldKeepWindowOnTop('BOARD', false)).toBe(false);
    expect(shouldKeepWindowOnTop('BOARD', true)).toBe(true);
    await applyWindowLayering('DOCK', false);
    await applyWindowLayering('BOARD', false);
    await applyWindowLayering('FOCUS', false);
    await applyWindowLayering('BOARD', true);
    expect(native.invoke.mock.calls).toEqual([
      ['toggle_always_on_top', { enable: true }],
      ['toggle_always_on_top', { enable: false }],
      ['toggle_always_on_top', { enable: true }],
      ['toggle_always_on_top', { enable: true }],
    ]);
  });

  it('waits for pending task saves before requesting native exit', async () => {
    let finishSaving!: () => void;
    const flush = vi.fn(() => new Promise<void>((resolve) => { finishSaving = resolve; }));
    const exiting = exitApplication(flush);
    expect(flush).toHaveBeenCalledOnce();
    expect(native.invoke).not.toHaveBeenCalled();
    finishSaving();
    await exiting;
    expect(native.invoke).toHaveBeenCalledWith('exit_app');
    expect(native.close).not.toHaveBeenCalled();
    expect(browserClose).not.toHaveBeenCalled();
  });

  it('falls back to the current window when the native exit command fails', async () => {
    native.invoke.mockRejectedValue(new Error('command unavailable'));
    await exitApplication(async () => {});
    expect(native.close).toHaveBeenCalledOnce();
    expect(browserClose).not.toHaveBeenCalled();
  });

  it('uses browser close as the last fallback and avoids native APIs in browser preview', async () => {
    native.invoke.mockRejectedValue(new Error('command unavailable'));
    native.close.mockRejectedValue(new Error('window close unavailable'));
    await exitApplication(async () => {});
    expect(browserClose).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    native.isTauri.mockReturnValue(false);
    await applyWindowLayering('DOCK', false);
    const flush = vi.fn(async () => {});
    await exitApplication(flush);
    expect(flush).toHaveBeenCalledOnce();
    expect(native.invoke).not.toHaveBeenCalled();
    expect(native.close).not.toHaveBeenCalled();
    expect(browserClose).toHaveBeenCalledOnce();
  });
});
