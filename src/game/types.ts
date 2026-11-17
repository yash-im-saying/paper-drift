export type GamePhase = 'title' | 'flying' | 'paused';

export type CameraMode = 'chase' | 'scenic';

export type AtmosphereMode = 'dynamic' | 'morning' | 'dusk';

export type PlaneStage = 1 | 2 | 3;

export type UpgradeKind = 'airframe' | 'propeller' | 'booster' | 'tailwind';

export interface TelemetrySnapshot {
  distance: number;
  bestDistance: number;
  altitude: number;
  speed: number;
  throttle: number; // 0..1
  headingLabel: string;
  windStrength: number;
  windLabel: string;
  planeStage: PlaneStage;
  planeName: string;
  hasPropeller: boolean;
  tailwindLevel: number;
  boostCharges: number;
  maxBoostCharges: number;
  boostActiveRatio: number;
  dayProgress: number; // 0 = crisp morning, 0.5 = golden dusk, 1 = morning wrap
  timeOfDayLabel: string;
  upgradesCollected: number;
}

export interface ToastNotification {
  id: number;
  title: string;
  detail: string;
}

export interface StoredPreferences {
  bestDistance: number;
  audioMuted: boolean;
  masterVolume: number;
  cameraMode: CameraMode;
  atmosphereMode: AtmosphereMode;
}

export const PLANE_STAGE_NAMES: Record<PlaneStage, string> = {
  1: 'Classic Fold',
  2: 'Twin-Crease Glider',
  3: 'Aero Tailfin',
};

export const DEFAULT_TELEMETRY: TelemetrySnapshot = {
  distance: 0,
  bestDistance: 0,
  altitude: 14,
  speed: 18,
  throttle: 0.5,
  headingLabel: 'N',
  windStrength: 0,
  windLabel: 'Calm Air',
  planeStage: 1,
  planeName: PLANE_STAGE_NAMES[1],
  hasPropeller: false,
  tailwindLevel: 0,
  boostCharges: 1,
  maxBoostCharges: 2,
  boostActiveRatio: 0,
  dayProgress: 0.08,
  timeOfDayLabel: 'Morning Light',
  upgradesCollected: 0,
};
