import { useCallback, useEffect, useRef, useState } from 'react';
import { HudOverlay } from './components/HudOverlay';
import { TitlePauseModal } from './components/TitlePauseModal';
import { PaperDriftAudio } from './game/audio';
import { PaperDriftEngine } from './game/flightEngine';
import {
  AtmosphereMode,
  CameraMode,
  DEFAULT_TELEMETRY,
  GamePhase,
  StoredPreferences,
  TelemetrySnapshot,
  ToastNotification,
} from './game/types';

const STORAGE_KEY = 'paper_drift_prefs_v1';

function loadPreferences(): StoredPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredPreferences>;
      return {
        bestDistance: typeof parsed.bestDistance === 'number' ? parsed.bestDistance : 0,
        audioMuted: Boolean(parsed.audioMuted),
        masterVolume:
          typeof parsed.masterVolume === 'number' ? Math.max(0, Math.min(1, parsed.masterVolume)) : 0.65,
        cameraMode: parsed.cameraMode === 'scenic' ? 'scenic' : 'chase',
        atmosphereMode:
          parsed.atmosphereMode === 'morning' || parsed.atmosphereMode === 'dusk'
            ? parsed.atmosphereMode
            : 'dynamic',
      };
    }
  } catch {
    // Fallback to defaults if storage unavailable
  }
  return {
    bestDistance: 0,
    audioMuted: false,
    masterVolume: 0.65,
    cameraMode: 'chase',
    atmosphereMode: 'dynamic',
  };
}

export default function App() {
  const initialPrefs = useRef<StoredPreferences>(loadPreferences());
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<PaperDriftEngine | null>(null);
  const audioRef = useRef<PaperDriftAudio | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastIdRef = useRef(0);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    ...DEFAULT_TELEMETRY,
    bestDistance: initialPrefs.current.bestDistance,
  });
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const [cameraMode, setCameraMode] = useState<CameraMode>(initialPrefs.current.cameraMode);
  const [atmosphereMode, setAtmosphereMode] = useState<AtmosphereMode>(
    initialPrefs.current.atmosphereMode,
  );
  const [audioMuted, setAudioMuted] = useState(initialPrefs.current.audioMuted);
  const [masterVolume, setMasterVolume] = useState(initialPrefs.current.masterVolume);

  const showToast = useCallback((title: string, detail: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, title, detail });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3400);
  }, []);

  // Initialize Three.js engine & Web Audio once on mount
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const audio = new PaperDriftAudio();
    audio.setVolume(initialPrefs.current.masterVolume);
    audio.setMuted(initialPrefs.current.audioMuted);
    audioRef.current = audio;

    const engine = new PaperDriftEngine(
      container,
      audio,
      {
        onTelemetry: (snapshot) => setTelemetry(snapshot),
        onToast: showToast,
        onContextLost: (lost) => setContextLost(lost),
      },
      initialPrefs.current.bestDistance,
    );
    engine.setCameraMode(initialPrefs.current.cameraMode);
    engine.setAtmosphereMode(initialPrefs.current.atmosphereMode);
    engineRef.current = engine;

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, [showToast]);

  // Persist user preferences & best distance
  useEffect(() => {
    try {
      const payload: StoredPreferences = {
        bestDistance: telemetry.bestDistance,
        audioMuted,
        masterVolume,
        cameraMode,
        atmosphereMode,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [telemetry.bestDistance, audioMuted, masterVolume, cameraMode, atmosphereMode]);

  const handleStartOrResume = useCallback(() => {
    engineRef.current?.setPhase('flying');
    setPhase('flying');
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPhase((prev) => {
      const next = prev === 'flying' ? 'paused' : prev === 'paused' ? 'flying' : prev;
      if (next !== prev) {
        engineRef.current?.setPhase(next);
      }
      return next;
    });
  }, []);

  const handleNewCity = useCallback(() => {
    engineRef.current?.resetCity();
    engineRef.current?.setPhase('flying');
    setPhase('flying');
    showToast('Fresh Cityscape Ready', 'Clear skies ahead — glide gently.');
  }, [showToast]);

  const handleChangeCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleChangeAtmosphereMode = useCallback((mode: AtmosphereMode) => {
    setAtmosphereMode(mode);
    engineRef.current?.setAtmosphereMode(mode);
  }, []);

  const handleToggleMute = useCallback(() => {
    setAudioMuted((prev) => {
      const next = !prev;
      audioRef.current?.init();
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleChangeVolume = useCallback((val: number) => {
    setMasterVolume(val);
    audioRef.current?.init();
    if (val > 0 && audioMuted) {
      setAudioMuted(false);
      audioRef.current?.setMuted(false);
    }
    audioRef.current?.setVolume(val);
  }, [audioMuted]);

  const handleBoost = useCallback(() => {
    engineRef.current?.triggerBoost();
  }, []);

  const handleSteerPointer = useCallback((dir: -1 | 0 | 1) => {
    engineRef.current?.setTouchSteer(dir);
  }, []);

  const handleThrottlePointer = useCallback((dir: -1 | 0 | 1) => {
    engineRef.current?.setTouchThrottle(dir);
  }, []);

  // Global keyboard shortcuts for Pause (P / Esc), HUD collapse (H), and Enter to fly
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && phase !== 'title') {
        setDockCollapsed((prev) => !prev);
      } else if ((e.code === 'KeyP' || e.code === 'Escape') && phase !== 'title') {
        e.preventDefault();
        handlePauseToggle();
      } else if (e.code === 'Enter' && phase !== 'flying') {
        e.preventDefault();
        handleStartOrResume();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handlePauseToggle, handleStartOrResume]);

  return (
    <main className="relative h-full w-full overflow-hidden bg-slate-900">
      {/* Dedicated WebGL Canvas Mount Container */}
      <div
        ref={canvasContainerRef}
        className="h-full w-full"
        aria-label="Paper Drift 3D Cityscape Viewport"
      />

      {contextLost && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-6 text-center"
          style={{ backgroundColor: 'rgba(18, 24, 33, 0.92)' }}
        >
          <div className="max-w-sm space-y-2 rounded-2xl border border-white/15 p-6">
            <h2 className="font-display text-xl font-semibold text-white">
              Graphics Context Paused
            </h2>
            <p className="text-sm text-slate-300">
              Your browser temporarily reclaimed WebGL resources. Reloading or resuming will restore
              the flight scene.
            </p>
          </div>
        </div>
      )}

      <HudOverlay
        phase={phase}
        telemetry={telemetry}
        toast={toast}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((prev) => !prev)}
        cameraMode={cameraMode}
        onChangeCameraMode={handleChangeCameraMode}
        atmosphereMode={atmosphereMode}
        onChangeAtmosphereMode={handleChangeAtmosphereMode}
        audioMuted={audioMuted}
        onToggleMute={handleToggleMute}
        masterVolume={masterVolume}
        onChangeVolume={handleChangeVolume}
        onPauseToggle={handlePauseToggle}
        onRestart={handleNewCity}
        onBoost={handleBoost}
        onSteerPointer={handleSteerPointer}
        onThrottlePointer={handleThrottlePointer}
      />

      <TitlePauseModal
        phase={phase}
        telemetry={telemetry}
        onStartOrResume={handleStartOrResume}
        onNewCity={handleNewCity}
      />
    </main>
  );
}
