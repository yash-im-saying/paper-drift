import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Play,
  RotateCcw,
  Sparkles,
  Wind,
} from 'lucide-react';
import { GamePhase, TelemetrySnapshot } from '../game/types';

interface TitlePauseModalProps {
  phase: GamePhase;
  telemetry: TelemetrySnapshot;
  onStartOrResume: () => void;
  onNewCity: () => void;
}

export function TitlePauseModal({
  phase,
  telemetry,
  onStartOrResume,
  onNewCity,
}: TitlePauseModalProps) {
  if (phase === 'flying') {
    return null;
  }

  const isPaused = phase === 'paused';

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center p-6">
      <div
        className="w-full max-w-xl rounded-2xl border border-white/15 p-7 text-slate-100 shadow-2xl sm:p-8"
        style={{ backgroundColor: 'rgba(18, 24, 33, 0.84)' }}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-amber-300">
            {isPaused ? 'Flight Paused' : 'Open-World 3D City Glider'}
          </p>
          <h1
            className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            style={{ textWrap: 'balance' }}
          >
            Paper Drift
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            {isPaused
              ? 'Take a quiet breath above the skyline. Resume gliding in any direction whenever you are ready.'
              : 'Pilot a handcrafted paper plane freely in 360° across an endless city of avenues, neighborhoods, and parks as morning drifts into golden dusk.'}
          </p>
        </div>

        {/* Simple Key Controls */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-1.5 text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10">
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="ml-1 text-xs font-semibold text-white">Turn 360°</span>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Carve smooth turns in any compass direction over the city.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-1.5 text-slate-100">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10">
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-white/10">
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="ml-1 text-xs font-semibold text-white">Throttle</span>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Speed up to climb higher or airbrake to descend down streets.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
            <div className="flex items-center gap-2 text-slate-100">
              <span className="inline-flex h-7 items-center rounded-md border border-white/20 bg-white/10 px-2.5 font-mono-nums text-xs font-medium">
                Space
              </span>
              <span className="text-xs font-semibold text-white">Boost</span>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Trigger stored paper boosters for an instant lift and speed surge.
            </p>
          </div>
        </div>

        {/* Upgrade & Wind Guide */}
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs text-slate-300">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            <span>
              Collect upgrades scattered across low avenues, mid rooftops, and high skies to evolve
              your wings and unlock <strong className="font-medium text-white">Propeller</strong>{' '}
              throttle power.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Wind className="h-4 w-4 shrink-0 text-sky-300" aria-hidden="true" />
            <span>
              Ride <strong className="font-medium text-white">Golden Thermal Rings</strong> and
              shifting 2D breezes; bumping obstacles gently bounces you clear.
            </span>
          </div>
        </div>

        {/* Session Stats if Paused or Returning */}
        {(isPaused || telemetry.bestDistance > 0) && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-4 text-xs text-slate-300">
            {isPaused && (
              <>
                <span className="font-mono-nums">
                  Current <strong className="text-white">{telemetry.distance.toLocaleString()} m</strong>
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span>{telemetry.planeName}</span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
              </>
            )}
            <span className="font-mono-nums">
              Personal Best{' '}
              <strong className="text-amber-300">{telemetry.bestDistance.toLocaleString()} m</strong>
            </span>
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onStartOrResume}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-amber-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            <span>{isPaused ? 'Resume Flight' : 'Take Flight'}</span>
          </button>

          {isPaused && (
            <button
              type="button"
              onClick={onNewCity}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>New City</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
