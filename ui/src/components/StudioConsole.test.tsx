import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FleetSession, FleetTelemetry } from '@workpulse/shared';
import { FleetSessionCards, StudioConsole } from './StudioConsole';
import {
  FLEET_FRESHNESS_MS,
} from '../utils/fleetTelemetry';

const NOW = Date.parse('2026-10-11T14:00:00Z');
const session = (id: string, status: string, overrides: Partial<FleetSession> = {}): FleetSession => ({
  id, name: `Agent ${id}`, tool: 'codex', status, lastStatusAt: NOW - 65000, ...overrides,
});
const fleet = (sessions: FleetSession[], lastUpdated = NOW): FleetTelemetry => ({
  groupName: 'Project fleet', sessions, lastUpdated: new Date(lastUpdated).toISOString(),
});
const summary = (telemetry: FleetTelemetry | null, receivedAt: number | null = NOW) => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
  return renderToStaticMarkup(<StudioConsole aiRun={null} fleetTelemetry={telemetry} fleetReceivedAt={receivedAt} />);
};
const cards = (telemetry: FleetTelemetry | null, now = NOW, receivedAt: number | null = NOW) =>
  renderToStaticMarkup(<FleetSessionCards fleetTelemetry={telemetry} now={now} receivedAt={receivedAt} />);
const dots = (html: string) => (html.match(/class="fleet-breathing-dot"/g) ?? []).length;

afterEach(() => vi.restoreAllMocks());

describe('live fleet summary', () => {
  it('counts real working and standby sessions and renders each actual chip', () => {
    const html = summary(fleet([
      session('working-id', 'working'), session('tools-id', 'running_tools'),
      session('idle-id', 'idle'), session('dead-id', 'dead'), session('waiting-id', 'waiting_input'),
    ]));
    expect(html).toContain('2 Working · 1 Standby');
    for (const id of ['working-id', 'tools-id', 'idle-id', 'dead-id', 'waiting-id']) {
      expect(html).toContain(`Agent ${id}`);
    }
    expect(html).toContain('Agent waiting-id · Waiting for input');
    expect(html).toContain('Agent dead-id · Offline');
    expect(dots(html)).toBe(1);
  });

  it('does not animate an idle, waiting or offline fleet', () => {
    const html = summary(fleet([session('idle', 'idle'), session('wait', 'waiting_input'), session('dead', 'dead')]));
    expect(html).toContain('0 Working · 1 Standby');
    expect(dots(html)).toBe(0);
  });

  it('distinguishes unavailable and live empty fleets without fabricated roles', () => {
    expect(summary(null)).toContain('Telemetry unavailable');
    expect(summary(fleet([]))).toContain('No active sessions');
    for (const html of [summary(null), summary(fleet([]))]) {
      expect(dots(html)).toBe(0);
      expect(html).not.toContain('Senior');
      expect(html).not.toContain('Frontend');
      expect(html).not.toContain('Backend');
      expect(html).not.toContain('Testing');
    }
  });

  it('suppresses working counts and the animation when heartbeat or local receipt expires', () => {
    for (const html of [
      summary(fleet([session('old', 'working')], NOW - FLEET_FRESHNESS_MS)),
      summary(fleet([session('old', 'working')]), NOW - FLEET_FRESHNESS_MS),
    ]) {
      expect(html).toContain('Telemetry unavailable');
      expect(html).not.toContain('1 Working');
      expect(dots(html)).toBe(0);
    }
  });
});

describe('fleet session cards', () => {
  it('shows reported identity, model, role, state and status age in milliseconds', () => {
    const html = cards(fleet([
      session('session-42', 'working', { name: 'Live worker', model: 'gpt-6.1-sol', role: 'Reviewer' }),
      session('idle', 'idle'), session('dead', 'dead'), session('waiting', 'waiting_input'),
    ]));
    for (const text of ['Live worker', '#session-42 · codex', 'Model: gpt-6.1-sol', 'Reviewer',
      'Working', 'Standby', 'Offline', 'Waiting for input', 'Status changed 1m ago', 'Model: Not reported']) {
      expect(html).toContain(text);
    }
    expect(dots(html)).toBe(1);
  });

  it('keeps a long-running unchanged status live when the heartbeat is fresh', () => {
    const html = cards(fleet([session('long', 'working', { lastStatusAt: NOW - 3 * 3600000 })]));
    expect(html).toContain('Status changed 3h 0m ago');
    expect(html).toContain('Working');
    expect(dots(html)).toBe(1);
  });

  it('handles absent, empty and stale snapshots explicitly', () => {
    expect(cards(null)).toContain('Waiting for a fleet update');
    expect(cards(fleet([]))).toContain('No active sessions reported');
    expect(cards(fleet([], NOW - FLEET_FRESHNESS_MS))).toContain('Last update is stale');
    const stale = cards(fleet([session('retained', 'working')], NOW - FLEET_FRESHNESS_MS));
    expect(stale).toContain('#retained');
    expect(stale).toContain('Telemetry unavailable');
    expect(dots(stale)).toBe(0);
  });

  it('preserves unknown tools and status safely and does not invent model or status times', () => {
    const html = cards(fleet([session('new', '<new-status>', {
      name: '', tool: '<new-tool>', model: undefined, lastStatusAt: undefined,
    })]));
    expect(html).toContain('&lt;new-tool&gt;');
    expect(html).toContain('&lt;new-status&gt;');
    expect(html).toContain('Model: Not reported');
    expect(html).toContain('Status time unavailable');
    expect(html).not.toContain('<new-status>');
    expect(dots(html)).toBe(0);
    for (const lastStatusAt of [NaN, Infinity, -1, NOW + 1, NOW * 1000000]) {
      expect(cards(fleet([session('invalid-time', 'idle', { lastStatusAt })]))).toContain('Status time unavailable');
    }
  });
});

