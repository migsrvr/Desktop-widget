import React, { useState } from 'react';
import {
  AiRun,
  TimelineEvent,
  SpotifyTrack,
  SpotifyPlaybackAction,
  ScreenMode,
  ScreenFrameMeta,
  VisionInference,
  OperatorActionProposal,
} from '@workpulse/shared';

interface StudioConsoleProps {
  aiRun: AiRun | null;
  timeline?: TimelineEvent[];
  operatorWatching?: boolean;
  operatorMode?: ScreenMode;
  operatorFrame?: ScreenFrameMeta | null;
  operatorInference?: VisionInference | null;
  operatorProposal?: OperatorActionProposal | null;
  operatorThumbUrl?: string;
  onToggleOperatorWatching?: () => void;
  onOperatorCapture?: () => void;
  onOperatorApprove?: () => void;
  onOperatorDeny?: () => void;
  spotifyTrack?: SpotifyTrack | null;
  isSpotifyConnected?: boolean;
  isSpotifyConnecting?: boolean;
  onOpenSpotifySetup?: () => void;
  onSpotifyControl?: (action: SpotifyPlaybackAction) => void;
  onDetectSpotifyLocal?: () => void;
}

export const StudioConsole: React.FC<StudioConsoleProps> = ({
  aiRun,
  timeline = [],
  operatorWatching = false,
  operatorMode = 'MONITOR',
  operatorFrame,
  operatorInference,
  operatorProposal,
  operatorThumbUrl = '',
  onToggleOperatorWatching,
  onOperatorCapture,
  onOperatorApprove,
  onOperatorDeny,
  spotifyTrack,
  isSpotifyConnected = false,
  isSpotifyConnecting = false,
  onOpenSpotifySetup,
  onSpotifyControl,
  onDetectSpotifyLocal,
}) => {
  const [activeChannelDetail, setActiveChannelDetail] = useState<'agent' | 'screen' | 'audio' | null>(null);

  // Agent channel details
  const agentName = aiRun?.agentName || 'OpenCode';
  const getAgentStatusText = () => {
    if (!aiRun) return 'Standby';
    switch (aiRun.status) {
      case 'WAITING_INPUT':
        return 'Waiting';
      case 'WORKING':
      case 'RUNNING_TOOLS':
        return 'Working';
      case 'PLANNING':
        return 'Planning';
      case 'COMPLETED':
        return 'Done';
      case 'FAILED':
        return 'Error';
      default:
        return 'Standby';
    }
  };
  const agentStatusText = getAgentStatusText();
  const isAgentWorking = aiRun?.status === 'WORKING' || aiRun?.status === 'RUNNING_TOOLS' || aiRun?.status === 'PLANNING';

  // Screen operator channel details
  const getScreenStatusText = () => {
    if (!operatorWatching) return 'Standby';
    if (operatorMode === 'OPERATOR') return 'Operator';
    if (operatorMode === 'ON_DEMAND') return 'On-demand';
    return 'Monitoring';
  };
  const screenStatusText = getScreenStatusText();
  const screenSubText = operatorWatching && operatorFrame
    ? `${operatorFrame.width}×${operatorFrame.height}`
    : operatorWatching
    ? 'Monitoring'
    : 'Standby';

  // Audio channel details
  const audioTitle = !isSpotifyConnected
    ? 'Connect audio'
    : spotifyTrack
    ? spotifyTrack.name
    : 'Ready';
  const audioSubText = !isSpotifyConnected
    ? 'Offline'
    : spotifyTrack
    ? `${spotifyTrack.isPlaying ? 'Playing' : 'Paused'} · ${spotifyTrack.artist}`
    : 'Connected';

  const toggleDetail = (channel: 'agent' | 'screen' | 'audio') => {
    setActiveChannelDetail((prev) => (prev === channel ? null : channel));
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        backgroundColor: 'var(--session-surface)',
        border: '1px solid var(--session-border)',
        borderRadius: 'var(--radius-md)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* 3 Channels Grid Rack */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          width: '100%',
        }}
      >
        {/* CHANNEL 01: AGENT */}
        <div
          onClick={() => toggleDetail('agent')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            borderRight: '1px solid var(--session-border)',
            cursor: 'pointer',
            backgroundColor: activeChannelDetail === 'agent' ? 'var(--session-surface-active)' : 'transparent',
            transition: 'background 0.12s ease',
          }}
          title="Click to view agent details"
        >
          <span
            className="session-mono"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--session-text-secondary)',
            }}
          >
            01 / AGENT
          </span>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--session-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={agentName}
          >
            {agentName}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {isAgentWorking && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  display: 'inline-block',
                }}
              />
            )}
            <span
              className="session-mono"
              style={{
                fontSize: 12,
                color: isAgentWorking ? '#FFFFFF' : 'var(--session-text-secondary)',
              }}
            >
              {agentStatusText}
            </span>
          </div>

          {/* Graduated step meter or files preview */}
          <div
            className="session-mono"
            style={{
              fontSize: 11,
              color: 'var(--session-text-secondary)',
              marginTop: 2,
              letterSpacing: '1px',
            }}
          >
            {aiRun?.modifiedFiles && aiRun.modifiedFiles.length > 0
              ? `${aiRun.modifiedFiles.length} files`
              : '▯▯▯▯▯▯▯▯▯▯'}
          </div>
        </div>

        {/* CHANNEL 02: SCREEN */}
        <div
          onClick={() => toggleDetail('screen')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            borderRight: '1px solid var(--session-border)',
            cursor: 'pointer',
            backgroundColor: activeChannelDetail === 'screen' ? 'var(--session-surface-active)' : 'transparent',
            transition: 'background 0.12s ease',
          }}
          title="Click to view screen operator controls"
        >
          <span
            className="session-mono"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--session-text-secondary)',
            }}
          >
            02 / SCREEN
          </span>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--session-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Screen operator
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                opacity: operatorWatching ? 1 : 0.35,
                display: 'inline-block',
              }}
            />
            <span
              className="session-mono"
              style={{
                fontSize: 12,
                color: operatorWatching ? '#FFFFFF' : 'var(--session-text-secondary)',
              }}
            >
              {screenStatusText}
            </span>
          </div>
          <span
            className="session-mono"
            style={{
              fontSize: 11,
              color: 'var(--session-text-secondary)',
              marginTop: 2,
            }}
          >
            {screenSubText}
          </span>
        </div>

        {/* CHANNEL 03: AUDIO */}
        <div
          onClick={() => toggleDetail('audio')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '8px 10px',
            cursor: 'pointer',
            backgroundColor: activeChannelDetail === 'audio' ? 'var(--session-surface-active)' : 'transparent',
            transition: 'background 0.12s ease',
          }}
          title="Click to view audio / Spotify controls"
        >
          <span
            className="session-mono"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: 'var(--session-text-secondary)',
            }}
          >
            03 / AUDIO
          </span>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--session-text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Spotify
          </span>
          <span
            className="session-mono"
            style={{
              fontSize: 12,
              color: spotifyTrack ? '#FFFFFF' : 'var(--session-text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={audioTitle}
          >
            {audioTitle}
          </span>
          <span
            className="session-mono"
            style={{
              fontSize: 11,
              color: 'var(--session-text-secondary)',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {audioSubText}
          </span>
        </div>
      </div>

      {/* Expandable Detail Drawer (Opens below the 3 channels when tapped) */}
      {activeChannelDetail && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--session-border)',
            backgroundColor: 'var(--session-bg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {/* Detail Drawer Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              className="session-mono"
              style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.05em' }}
            >
              {activeChannelDetail === 'agent'
                ? 'CHANNEL 01 / AGENT TELEMETRY'
                : activeChannelDetail === 'screen'
                ? 'CHANNEL 02 / SCREEN OPERATOR CONTROLS'
                : 'CHANNEL 03 / SPOTIFY AUDIO PLAYBACK'}
            </span>
            <button
              onClick={() => setActiveChannelDetail(null)}
              className="session-btn"
              style={{ padding: '1px 5px', fontSize: 10 }}
              title="Close channel details"
            >
              ✕
            </button>
          </div>

          {/* AGENT DETAIL DRAWER */}
          {activeChannelDetail === 'agent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--session-text-primary)', lineHeight: 1.4 }}>
                {aiRun?.currentStepDescription || 'Waiting for agent workflow…'}
              </div>
              {aiRun?.goal && (
                <div style={{ fontSize: 11, color: 'var(--session-text-secondary)' }}>
                  Goal: {aiRun.goal}
                </div>
              )}
              {aiRun?.testStatus && aiRun.testStatus !== 'NOT_RUN' && (
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#FFFFFF' }}>
                  Tests: {aiRun.testStatus} {aiRun.testSummary ? `· ${aiRun.testSummary}` : ''}
                </div>
              )}
              {aiRun?.modifiedFiles && aiRun.modifiedFiles.length > 0 && (
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--session-text-secondary)' }}>
                  Changed: {aiRun.modifiedFiles.slice(0, 3).join(', ')}
                  {aiRun.modifiedFiles.length > 3 ? ` +${aiRun.modifiedFiles.length - 3} more` : ''}
                </div>
              )}
            </div>
          )}

          {/* SCREEN DETAIL DRAWER */}
          {activeChannelDetail === 'screen' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onToggleOperatorWatching && (
                  <button
                    onClick={onToggleOperatorWatching}
                    className="session-btn"
                    style={{ fontSize: 11 }}
                  >
                    {operatorWatching ? 'Pause Watching' : 'Start Watching'}
                  </button>
                )}
                {onOperatorCapture && (
                  <button
                    onClick={onOperatorCapture}
                    className="session-btn"
                    style={{ fontSize: 11 }}
                  >
                    Capture Now
                  </button>
                )}
              </div>

              {operatorProposal && (
                <div
                  style={{
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--session-accent-white)',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FFFFFF' }}>Proposal Approval:</div>
                  <div style={{ fontSize: 12, color: 'var(--session-text-primary)', marginTop: 2 }}>
                    {operatorProposal.prompt}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {onOperatorApprove && (
                      <button
                        onClick={onOperatorApprove}
                        className="session-btn-primary"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        Approve
                      </button>
                    )}
                    {onOperatorDeny && (
                      <button
                        onClick={onOperatorDeny}
                        className="session-btn"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                      >
                        Deny
                      </button>
                    )}
                  </div>
                </div>
              )}

              {operatorInference && (
                <div style={{ fontSize: 11, color: 'var(--session-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Vision Inference: {operatorInference.state} ({Math.round(operatorInference.confidence * 100)}%)
                </div>
              )}
            </div>
          )}

          {/* AUDIO DETAIL DRAWER */}
          {activeChannelDetail === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {isSpotifyConnected ? (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF' }}>
                    {spotifyTrack ? `${spotifyTrack.name} — ${spotifyTrack.artist}` : 'Connected (No active playback)'}
                  </div>
                  {onSpotifyControl && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button
                        onClick={() => onSpotifyControl('PREVIOUS')}
                        className="session-btn"
                        style={{ fontSize: 11 }}
                      >
                        ⏮ Prev
                      </button>
                      <button
                        onClick={() => onSpotifyControl(spotifyTrack?.isPlaying ? 'PAUSE' : 'PLAY')}
                        className="session-btn-primary"
                        style={{ fontSize: 11 }}
                      >
                        {spotifyTrack?.isPlaying ? '⏸ Pause' : '▶ Play'}
                      </button>
                      <button
                        onClick={() => onSpotifyControl('NEXT')}
                        className="session-btn"
                        style={{ fontSize: 11 }}
                      >
                        Next ⏭
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--session-text-secondary)' }}>
                    Spotify not connected
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onDetectSpotifyLocal && (
                      <button onClick={onDetectSpotifyLocal} className="session-btn" style={{ fontSize: 11 }}>
                        Detect Windows
                      </button>
                    )}
                    {onOpenSpotifySetup && (
                      <button onClick={onOpenSpotifySetup} className="session-btn-primary" style={{ fontSize: 11 }}>
                        {isSpotifyConnecting ? 'Connecting…' : 'Setup'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
