import type { ProviderUsageSnapshot, UsageSnapshot, UsageWindow } from '@workpulse/shared';
import type { useProviderUsage } from '../hooks/useProviderUsage';
import { USAGE_PROVIDERS, USAGE_STATE_LABELS, getProviderState, getUsageWindowDisplay, selectSummaryWindow } from '../utils/usageState';

export interface UsageProps { providers: UsageSnapshot; now: number }
export type UsageControls = Omit<ReturnType<typeof useProviderUsage>, 'providers'>;

function WindowReading({ window, provider, now, compact }: { window: UsageWindow; provider: ProviderUsageSnapshot; now: number; compact: boolean }) {
  const display = getUsageWindowDisplay(window, provider, now);
  const percentage = display.used !== null;
  const remaining = display.remaining === null ? null : Math.round(display.remaining);
  const amount = display.amount === null ? null : `${display.amount.toLocaleString()}${window.unit ? ` ${window.unit}` : ''} remaining`;
  return <div className="quota-window">
    <div className="row-between caption"><span>{window.label}</span>{!compact && <strong className="allowance-value">{display.available && percentage ? `${Math.round(display.used!)}% used` : display.available ? '' : '—'}</strong>}</div>
    {percentage && <div className="usage-track" role="progressbar" aria-label={`${provider.provider} ${window.label} used allowance`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={display.used!}><span style={{ width: `${display.used}%` }} /></div>}
    <div className="row-between caption"><span>{!display.available ? 'Usage unavailable' : percentage ? `${remaining}% ${compact ? 'left' : 'remaining'}` : amount}</span><span>{display.reset}</span></div>
  </div>;
}

export function ProviderUsage({ providers, now, compact = false, query = '', controls }: UsageProps & { compact?: boolean; query?: string; controls?: UsageControls }) {
  return <div className={compact ? 'allowance-list compact' : 'allowance-list'}>
    {USAGE_PROVIDERS.filter(p => `${p.name} ${p.sourceLabel}`.toLowerCase().includes(query.trim().toLowerCase())).map(provider => {
      const reading = providers[provider.id];
      const state = getProviderState(reading, now);
      const summary = selectSummaryWindow(reading, now);
      const windows = compact ? summary ? [summary] : [] : reading.windows;
      const pending = controls?.pending != null;
      return <section className="allowance-row" key={provider.id} aria-label={`${provider.name} allowance`}>
        <div className="row-between"><h3>{provider.name}</h3>{compact ? <span className="allowance-value">{summary ? `${Math.round(summary.usedPercent!)}%` : '—'}</span> : <span className="status-label">{USAGE_STATE_LABELS[state]}</span>}</div>
        {!compact && <p className="caption allowance-source">{provider.sourceLabel}{reading.plan ? ` · ${reading.plan}` : ''}</p>}
        {windows.map(window => <WindowReading key={window.id} window={window} provider={reading} now={now} compact={compact} />)}
        {windows.length === 0 && <div className="quota-window"><div className="usage-track" aria-label={`${provider.name} allowance unavailable`} /><p className="caption">{compact ? USAGE_STATE_LABELS[state] : 'Usage unavailable'}</p></div>}
        {!compact && <>
          <p className="caption">{reading.receivedAt ? `Last reading ${new Date(reading.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No reading received'}</p>
          {reading.detail && <p className="caption usage-detail">{reading.detail}</p>}
          {controls?.errors[provider.id] && <p className="caption error-copy" role="status">{controls.errors[provider.id]}</p>}
          {controls?.supported && <div className="button-row usage-actions">
            <button className="secondary-button" disabled={pending} onClick={() => controls.connect(provider.id)}>{controls.pending === provider.id ? 'Connecting…' : state === 'not-connected' ? 'Connect' : 'Reconnect'} {provider.name}</button>
            {state !== 'not-connected' && <button className="text-button" disabled={pending} onClick={() => controls.disconnect(provider.id)}>Disconnect</button>}
          </div>}
        </>}
      </section>;
    })}
  </div>;
}
