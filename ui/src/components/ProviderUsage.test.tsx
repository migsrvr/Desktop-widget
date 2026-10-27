import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProviderUsage } from './ProviderUsage';
import { emptyUsage } from '../utils/usageState';

const now = Date.parse('2026-10-26T10:00:00Z');
function readings() {
  const providers = emptyUsage();
  providers.codex = { ...providers.codex, status: 'current', receivedAt: '2026-10-26T09:59:00Z', windows: [
    { id: 'session', label: '5-hour', usedPercent: 20, remainingAmount: null, unit: null, resetAt: '2026-10-26T12:00:00Z' },
    { id: 'weekly', label: 'Weekly', usedPercent: 90, remainingAmount: null, unit: null, resetAt: '2026-11-01T12:00:00Z' },
  ] };
  return providers;
}

describe('provider usage view', () => {
  it('shows both Codex windows while another provider is disconnected', () => {
    const html = renderToStaticMarkup(<ProviderUsage providers={readings()} now={now} />);
    expect(html).toContain('5-hour'); expect(html).toContain('Weekly');
    expect(html).toContain('80% remaining'); expect(html).toContain('10% remaining');
    expect(html).toContain('Not connected');
  });
  it('does not present expired source readings as current progress bars or alerts', () => {
    const html = renderToStaticMarkup(<ProviderUsage providers={readings()} now={now + 16 * 60_000} />);
    expect(html).toContain('Stale'); expect(html).not.toContain('role="progressbar"');
  });
  it('shows an absolute remaining amount without inventing a quota percentage', () => {
    const providers = readings(); providers.gemini = { ...providers.gemini, status: 'current', receivedAt: '2026-10-26T09:59:00Z', windows: [{ id: 'gemini-count', label: 'Requests', usedPercent: null, remainingAmount: 17, unit: 'requests', resetAt: null }] };
    const html = renderToStaticMarkup(<ProviderUsage providers={providers} now={now} query="Gemini" />);
    expect(html).toContain('17 requests remaining'); expect(html).not.toContain('role="progressbar"');
  });
});
