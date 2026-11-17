import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  AtmosphereMode,
  CameraMode,
  GamePhase,
  TelemetrySnapshot,
  ToastNotification,
} from '../game/types';

interface HudOverlayProps {
  phase: GamePhase;
  telemetry: TelemetrySnapshot;
  toast: ToastNotification | null;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  cameraMode: CameraMode;
  onChangeCameraMode: (mode: CameraMode) => void;
  atmosphereMode: AtmosphereMode;
  onChangeAtmosphereMode: (mode: AtmosphereMode) => void;
  audioMuted: boolean;
  onToggleMute: () => void;
  masterVolume: number;
  onChangeVolume: (val: number) => void;
  onPauseToggle: () => void;
  onRestart: () => void;
  onBoost: () => void;
  onSteerPointer: (dir: -1 | 0 | 1) => void;
  onThrottlePointer: (dir: -1 | 0 | 1) => void;
}

export function HudOverlay({
  phase,
  telemetry,
  toast,
  dockCollapsed,
  onToggleDock,
  cameraMode,
  onChangeCameraMode,
  atmosphereMode,
  onChangeAtmosphereMode,
  audioMuted,
  onToggleMute,
  masterVolume,
  onChangeVolume,
  onPauseToggle,
  onRestart,
  onBoost,
  onSteerPointer,
  onThrottlePointer,
}: HudOverlayProps) {
  if (phase === 'title') {
    return null;
  }

  const throttlePct = Math.round(telemetry.throttle * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top-Left Minimalist Unboxed Telemetry Strip */}
      <div className="flex items-start justify-between gap-4">
        <div
          className="pointer-events-auto rounded-xl border border-white/15 px-4 py-2.5 text-slate-50 shadow-sm"
          style={{ backgroundColor: 'rgba(18, 23, 31, 0.76)' }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
            <span className="font-display text-sm font-semibold tracking-tight text-white">
              Paper Drift
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="font-mono-nums text-sm font-medium text-amber-300">
              {telemetry.distance.toLocaleString()} m
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="font-mono-nums text-slate-200">
              {telemetry.altitude.toFixed(1)} m alt
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="font-mono-nums text-slate-200">
              {throttlePct}% throttle
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="inline-flex items-center gap-1 font-mono-nums text-slate-200">
              <Compass className="h-3.5 w-3.5 text-amber-200" aria-hidden="true" />
              {telemetry.headingLabel}
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="text-slate-200">
              {telemetry.planeName}
              {telemetry.hasPropeller ? ' + Propeller' : ''}
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <Wind className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
              {telemetry.windLabel}
            </span>
            <span aria-hidden="true" className="hidden text-slate-500 md:inline">
              ·
            </span>
            <span className="hidden text-slate-400 md:inline">
              {telemetry.timeOfDayLabel}
            </span>
            <span aria-hidden="true" className="hidden text-slate-500 lg:inline">
              ·
            </span>
            <span className="font-mono-nums hidden text-slate-400 lg:inline">
              Best {telemetry.bestDistance.toLocaleString()} m
            </span>
          </div>
        </div>

        {/* Single Clean Pause Action Top-Right */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onPauseToggle}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3.5 text-xs font-medium text-slate-100 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            style={{ backgroundColor: 'rgba(18, 23, 31, 0.76)' }}
            title="Pause Flight (P or Esc)"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pause</span>
          </button>
        </div>
      </div>

      {/* Bottom Area: Quiet Upgrade Toast + Collapsible Control Dock */}
      <div className="flex flex-col items-center gap-2.5">
        {toast && (
          <div
            key={toast.id}
            className="rounded-xl border border-amber-300/30 px-4 py-2 text-center shadow-md transition-opacity duration-200"
            style={{ backgroundColor: 'rgba(20, 26, 35, 0.86)' }}
          >
            <div className="font-display text-sm font-semibold text-amber-200">
              {toast.title}
            </div>
            <div className="text-xs text-slate-300">{toast.detail}</div>
          </div>
        )}

        {/* Collapse / Expand Handle */}
        <button
          type="button"
          onClick={onToggleDock}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-white/15 px-3 py-1 text-xs font-medium text-slate-200 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
          style={{ backgroundColor: 'rgba(18, 23, 31, 0.78)' }}
          title="Toggle HUD Dock (H)"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Unified Collapsible Bottom Dock */}
        {!dockCollapsed && (
          <div
            className="pointer-events-auto flex w-full max-w-[980px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 px-4 py-2.5 text-xs text-slate-200 shadow-lg"
            style={{ backgroundColor: 'rgba(18, 23, 31, 0.84)' }}
          >
            {/* Primary Flight Controls: Left / Right / Throttle Up / Brake Down / Space Boost */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onPointerDown={() => onSteerPointer(-1)}
                onPointerUp={() => onSteerPointer(0)}
                onPointerLeave={() => onSteerPointer(0)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-100 transition-colors hover:bg-white/15 active:bg-amber-400/25 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
                aria-label="Turn Left"
                title="Turn Left (Left Arrow)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                type="button"
                onPointerDown={() => onSteerPointer(1)}
                onPointerUp={() => onSteerPointer(0)}
                onPointerLeave={() => onSteerPointer(0)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-100 transition-colors hover:bg-white/15 active:bg-amber-400/25 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
                aria-label="Turn Right"
                title="Turn Right (Right Arrow)"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="mx-1 flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
                <button
                  type="button"
                  onPointerDown={() => onThrottlePointer(-1)}
                  onPointerUp={() => onThrottlePointer(0)}
                  onPointerLeave={() => onThrottlePointer(0)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-white/5 text-slate-100 transition-colors hover:bg-white/15 active:bg-sky-400/25 cursor-pointer"
                  aria-label="Airbrake and Descend"
                  title="Brake / Descend (Down Arrow)"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="flex flex-col items-center px-1">
                  <span className="font-mono-nums text-[11px] font-medium text-slate-200">
                    {throttlePct}%
                  </span>
                  <div className="mt-0.5 h-1 w-12 overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full bg-amber-300 transition-all duration-100"
                      style={{ width: `${throttlePct}%` }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onPointerDown={() => onThrottlePointer(1)}
                  onPointerUp={() => onThrottlePointer(0)}
                  onPointerLeave={() => onThrottlePointer(0)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/15 bg-white/5 text-slate-100 transition-colors hover:bg-white/15 active:bg-amber-400/25 cursor-pointer"
                  aria-label="Throttle Up and Climb"
                  title="Throttle Up / Climb (Up Arrow)"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={onBoost}
                disabled={telemetry.boostCharges <= 0}
                className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
                  telemetry.boostCharges > 0
                    ? 'border-amber-300/40 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30'
                    : 'border-white/10 bg-white/5 text-slate-400 cursor-not-allowed'
                }`}
                title="Trigger Paper Booster (Spacebar)"
              >
                <span>Space · Boost</span>
                <span className="font-mono-nums text-amber-200">
                  {telemetry.boostCharges}/{telemetry.maxBoostCharges}
                </span>
              </button>
            </div>

            {/* Camera Framing Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              <button
                type="button"
                onClick={() => onChangeCameraMode('chase')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraMode === 'chase'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Chase
              </button>
              <button
                type="button"
                onClick={() => onChangeCameraMode('scenic')}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  cameraMode === 'scenic'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Scenic
              </button>
            </div>

            {/* Sky Atmosphere Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
              {(
                [
                  ['dynamic', 'Auto Sky'],
                  ['morning', 'Morning'],
                  ['dusk', 'Golden Dusk'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeAtmosphereMode(mode)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    atmosphereMode === mode
                      ? 'bg-amber-300 text-slate-900'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Audio & New City Controls */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleMute}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-slate-200 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer"
                aria-label={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
                title={audioMuted ? 'Unmute Soundtrack' : 'Mute Soundtrack'}
              >
                {audioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioMuted ? 0 : masterVolume}
                onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
                aria-label="Soundtrack Volume"
                className="w-16 accent-amber-300 cursor-pointer"
              />

              <button
                type="button"
                onClick={onRestart}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
                title="Generate New Cityscape"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New City</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
