import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PaperDriftAudio } from './audio';
import {
  CityChunk,
  GRID_RADIUS,
  sampleWindAt,
  SharedCityGeometries,
  TILE_SIZE,
} from './cityChunk';
import { CityPaletteMaterials, createCityPaletteMaterials } from './materials';
import { PaperPlaneRig } from './paperPlane';
import {
  AtmosphereMode,
  CameraMode,
  GamePhase,
  PLANE_STAGE_NAMES,
  PlaneStage,
  TelemetrySnapshot,
} from './types';

export interface EngineCallbacks {
  onTelemetry: (snapshot: TelemetrySnapshot) => void;
  onToast: (title: string, detail: string) => void;
  onContextLost: (lost: boolean) => void;
}

interface ConfettiParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

const _skyMorning = new THREE.Color(0xcfe6f7);
const _skyNoon = new THREE.Color(0xb8dcf5);
const _skyDusk = new THREE.Color(0xf2b588);
const _skyTwilight = new THREE.Color(0x9b86a8);

const _fogMorning = new THREE.Color(0xdbeaf6);
const _fogNoon = new THREE.Color(0xd2e7f7);
const _fogDusk = new THREE.Color(0xf4c49b);
const _fogTwilight = new THREE.Color(0xb29cb8);

const _sunMorning = new THREE.Color(0xfff1d6);
const _sunDusk = new THREE.Color(0xffa663);

const _hemiSkyMorning = new THREE.Color(0xdff1ff);
const _hemiSkyDusk = new THREE.Color(0xf5b895);
const _hemiGroundMorning = new THREE.Color(0x8fa38c);
const _hemiGroundDusk = new THREE.Color(0x6e5a63);

const _workColor = new THREE.Color();
const _workColor2 = new THREE.Color();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _planeEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class PaperDriftEngine {
  private readonly container: HTMLElement;
  private readonly callbacks: EngineCallbacks;
  public readonly audio: PaperDriftAudio;

  private readonly isSoftwareGl: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly envTexture: THREE.Texture;

  private readonly materials: CityPaletteMaterials;
  private readonly sharedGeos: SharedCityGeometries;
  private readonly plane: PaperPlaneRig;
  private readonly tilePool: CityChunk[] = [];
  private readonly activeTiles = new Map<string, CityChunk>();
  private readonly collectedPickups = new Set<string>();
  private readonly particles: ConfettiParticle[] = [];
  private readonly particleGeo: THREE.PlaneGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;

  private phase: GamePhase = 'title';
  private cameraMode: CameraMode = 'chase';
  private atmosphereMode: AtmosphereMode = 'dynamic';

  // 360-degree flight physics state
  private worldSeed = 1042;
  private planeX = 0;
  private planeY = 12;
  private planeZ = 0;
  private velY = 0;
  private headingAngle = 0; // 0 = -Z (North), +PI/2 = -X (West)
  private turnRate = 0;
  private forwardSpeed = 18;
  private throttle = 0.5; // 0 = Airbrake, 0.5 = Balanced Cruise, 1 = Full Throttle
  private bankAngle = 0;
  private pitchAngle = 0;

  private distance = 0;
  private distanceFloat = 0;
  private bestDistance = 0;
  private planeStage: PlaneStage = 1;
  private hasPropeller = false;
  private tailwindLevel = 0;
  private boostCharges = 1;
  private readonly maxBoostCharges = 2;
  private boostTimer = 0;
  private bounceCooldown = 0;
  private currentWindX = 0;
  private currentWindZ = 0;
  private upgradesCollected = 0;
  private dayProgress = 0.08;
  private currentCenterTileX = 9999;
  private currentCenterTileZ = 9999;

  // Input flags
  private inputLeft = false;
  private inputRight = false;
  private inputUp = false;
  private inputDown = false;
  private touchSteer: -1 | 0 | 1 = 0;
  private touchThrottle: -1 | 0 | 1 = 0;

  private frameId = 0;
  private disposed = false;
  private lastTimestamp = 0;
  private elapsed = 0;
  private hudSyncAccum = 0;

  constructor(
    container: HTMLElement,
    audio: PaperDriftAudio,
    callbacks: EngineCallbacks,
    initialBestDistance: number,
  ) {
    this.container = container;
    this.audio = audio;
    this.callbacks = callbacks;
    this.bestDistance = initialBestDistance;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = _skyMorning.clone();
    this.scene.fog = new THREE.FogExp2(_fogMorning.getHex(), 0.0052);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(58, width / height, 0.25, 420);
    this.camera.position.set(0, 15.5, 8);

    this.hemiLight = new THREE.HemisphereLight(0xdff1ff, 0x8fa38c, 0.88);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 1.45);
    this.sunLight.position.set(45, 70, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 210;
    const d = 56;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0xd8e8ff, 0.42);
    this.rimLight.position.set(-30, 28, -40);
    this.scene.add(this.rimLight);

    this.materials = createCityPaletteMaterials(this.renderer);
    this.sharedGeos = new SharedCityGeometries();

    this.plane = new PaperPlaneRig(this.materials);
    this.plane.group.position.set(this.planeX, this.planeY, this.planeZ);
    this.scene.add(this.plane.group);

    this.particleGeo = new THREE.PlaneGeometry(0.24, 0.24);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffd782,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });

    const totalTiles = (GRID_RADIUS * 2 + 1) * (GRID_RADIUS * 2 + 1);
    for (let i = 0; i < totalTiles; i++) {
      const tile = new CityChunk(this.sharedGeos, this.materials);
      this.tilePool.push(tile);
      this.scene.add(tile.group);
    }

    this.syncTileGrid(true);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.emitTelemetry();
    this.startLoop();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.inputLeft = true;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.inputRight = true;
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      if (this.phase === 'flying') e.preventDefault();
      this.inputUp = true;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      if (this.phase === 'flying') e.preventDefault();
      this.inputDown = true;
    } else if (e.code === 'Space') {
      if (this.phase === 'flying') {
        e.preventDefault();
        this.triggerBoost();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      this.inputLeft = false;
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      this.inputRight = false;
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.inputUp = false;
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.inputDown = false;
    }
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  public setPhase(phase: GamePhase): void {
    this.phase = phase;
    if (phase === 'flying') {
      this.audio.init();
    }
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public setAtmosphereMode(mode: AtmosphereMode): void {
    this.atmosphereMode = mode;
  }

  public setTouchSteer(dir: -1 | 0 | 1): void {
    this.touchSteer = dir;
  }

  public setTouchThrottle(dir: -1 | 0 | 1): void {
    this.touchThrottle = dir;
  }

  public triggerBoost(): boolean {
    if (this.phase !== 'flying') return false;
    if (this.boostCharges <= 0 || this.boostTimer > 0.25) return false;

    this.boostCharges -= 1;
    this.boostTimer = 2.6;
    this.velY = Math.max(this.velY + 2.8, 3.2);
    this.audio.playBoostWhoosh();
    this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 12, 0xffd07b);
    this.emitTelemetry();
    return true;
  }

  public resetCity(): void {
    this.worldSeed = Math.floor(Math.random() * 90000) + 1000;
    this.planeX = 0;
    this.planeY = 12;
    this.planeZ = 0;
    this.velY = 0;
    this.headingAngle = 0;
    this.turnRate = 0;
    this.forwardSpeed = 18;
    this.throttle = 0.5;
    this.bankAngle = 0;
    this.pitchAngle = 0;
    this.distance = 0;
    this.distanceFloat = 0;
    this.planeStage = 1;
    this.hasPropeller = false;
    this.tailwindLevel = 0;
    this.boostCharges = 1;
    this.boostTimer = 0;
    this.bounceCooldown = 0;
    this.currentWindX = 0;
    this.currentWindZ = 0;
    this.upgradesCollected = 0;
    this.dayProgress = 0.08;
    this.collectedPickups.clear();

    this.plane.setEvolution(1, false);
    this.plane.group.position.set(this.planeX, this.planeY, this.planeZ);
    this.plane.group.rotation.set(0, 0, 0);

    this.syncTileGrid(true);
    this.emitTelemetry();
  }

  private syncTileGrid(forceAll = false): void {
    const cx = Math.round(this.planeX / TILE_SIZE);
    const cz = Math.round(this.planeZ / TILE_SIZE);

    if (!forceAll && cx === this.currentCenterTileX && cz === this.currentCenterTileZ) {
      return;
    }
    this.currentCenterTileX = cx;
    this.currentCenterTileZ = cz;

    const neededCoords: { tx: number; tz: number; key: string }[] = [];
    const neededKeys = new Set<string>();
    for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
      for (let dz = -GRID_RADIUS; dz <= GRID_RADIUS; dz++) {
        const tx = cx + dx;
        const tz = cz + dz;
        const key = `${tx},${tz}`;
        neededKeys.add(key);
        neededCoords.push({ tx, tz, key });
      }
    }

    if (forceAll) {
      this.activeTiles.clear();
      neededCoords.forEach((coord, idx) => {
        const tile = this.tilePool[idx];
        tile.populate(
          coord.tx,
          coord.tz,
          this.worldSeed,
          this.hasPropeller,
          this.planeStage,
          this.collectedPickups,
        );
        this.activeTiles.set(coord.key, tile);
      });
      return;
    }

    // Collect tiles that moved outside the 5x5 window around the plane
    const freeTiles: CityChunk[] = [];
    for (const [key, tile] of this.activeTiles.entries()) {
      if (!neededKeys.has(key)) {
        freeTiles.push(tile);
        this.activeTiles.delete(key);
      }
    }

    // Assign freed tiles to newly entered coordinates
    for (const coord of neededCoords) {
      if (!this.activeTiles.has(coord.key)) {
        const tile = freeTiles.pop();
        if (tile) {
          tile.populate(
            coord.tx,
            coord.tz,
            this.worldSeed,
            this.hasPropeller,
            this.planeStage,
            this.collectedPickups,
          );
          this.activeTiles.set(coord.key, tile);
        }
      }
    }
  }

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(0.05, Math.max(0.001, rawDt));

      this.step(dt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private step(dt: number): void {
    if (this.phase !== 'paused') {
      this.elapsed += dt;
    }

    if (this.phase === 'flying') {
      if (this.atmosphereMode === 'dynamic') {
        this.dayProgress = (this.dayProgress + dt / 95) % 1;
      } else if (this.atmosphereMode === 'morning') {
        this.dayProgress = THREE.MathUtils.damp(this.dayProgress, 0.08, 2.2, dt);
      } else {
        this.dayProgress = THREE.MathUtils.damp(this.dayProgress, 0.52, 2.2, dt);
      }
    } else if (this.phase === 'title') {
      if (this.atmosphereMode === 'morning') {
        this.dayProgress = THREE.MathUtils.damp(this.dayProgress, 0.08, 2.2, dt);
      } else if (this.atmosphereMode === 'dusk') {
        this.dayProgress = THREE.MathUtils.damp(this.dayProgress, 0.52, 2.2, dt);
      }
    }
    this.updateAtmosphereVisuals();

    if (this.phase !== 'paused') {
      for (const tile of this.activeTiles.values()) {
        tile.updateVisuals(dt, this.elapsed);
      }
    }

    if (this.phase === 'title') {
      this.stepTitleShowcase(dt);
    } else if (this.phase === 'flying') {
      this.stepFlight(dt);
    }

    this.updateParticles(dt);

    const speedRatio = THREE.MathUtils.clamp((this.forwardSpeed - 10) / 20, 0, 1);
    const windMag = Math.hypot(this.currentWindX, this.currentWindZ) / 2.2;
    this.audio.updateFlightDynamics(
      speedRatio,
      windMag,
      this.boostTimer > 0,
      this.dayProgress,
      this.phase === 'flying',
    );

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.1) {
      this.hudSyncAccum = 0;
      this.emitTelemetry();
    }
  }

  private stepTitleShowcase(dt: number): void {
    const swayX = Math.sin(this.elapsed * 0.42) * 4.5;
    const swayY = 12.2 + Math.sin(this.elapsed * 0.85) * 0.65;
    this.plane.group.position.set(swayX, swayY, -4);
    this.plane.group.rotation.set(
      Math.cos(this.elapsed * 0.85) * 0.05,
      -Math.cos(this.elapsed * 0.42) * 0.14,
      -Math.cos(this.elapsed * 0.42) * 0.22,
    );
    this.plane.update(dt, 18, 0, this.elapsed, 0.5);

    _camTargetPos.set(swayX * 0.6 + Math.sin(this.elapsed * 0.25) * 3.5, swayY + 2.4, 4);
    this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-3 * dt));
    _camLookTarget.set(swayX, swayY + 0.3, -20);
    this.camera.lookAt(_camLookTarget);
  }

  private stepFlight(dt: number): void {
    // 1. Sample 2D spatial wind current at current position
    const wind = sampleWindAt(this.planeX, this.planeZ, this.worldSeed);
    this.currentWindX = THREE.MathUtils.damp(this.currentWindX, wind.wx, 1.5, dt);
    this.currentWindZ = THREE.MathUtils.damp(this.currentWindZ, wind.wz, 1.5, dt);

    // 2. 360-degree Heading Turn (Left / Right)
    let steer = 0;
    if (this.inputLeft || this.touchSteer === -1) steer += 1; // +Y yaw turns left toward -X
    if (this.inputRight || this.touchSteer === 1) steer -= 1; // -Y yaw turns right toward +X

    const maxTurnRate = this.planeStage === 1 ? 1.15 : this.planeStage === 2 ? 1.32 : 1.48;
    this.turnRate = THREE.MathUtils.damp(this.turnRate, steer * maxTurnRate, 7.2, dt);
    this.headingAngle = (this.headingAngle + this.turnRate * dt) % (Math.PI * 2);
    if (this.headingAngle < 0) this.headingAngle += Math.PI * 2;

    // 3. Up / Down Arrow Throttle & Brake Control (zero autopilot lock)
    let throttleInput = 0;
    if (this.inputUp || this.touchThrottle === 1) throttleInput += 1;
    if (this.inputDown || this.touchThrottle === -1) throttleInput -= 1;

    if (throttleInput !== 0) {
      this.throttle = THREE.MathUtils.clamp(this.throttle + throttleInput * 0.72 * dt, 0, 1);
    }

    if (this.boostTimer > 0) this.boostTimer = Math.max(0, this.boostTimer - dt);
    if (this.bounceCooldown > 0) this.bounceCooldown = Math.max(0, this.bounceCooldown - dt);

    // Compute forward airspeed & aerodynamic vertical lift from throttle + upgrades
    const stageCruise = 16.5 + (this.planeStage - 1) * 1.4 + this.tailwindLevel * 0.9;
    let throttleSpeedDelta: number;
    let targetClimbRate: number;

    if (this.hasPropeller) {
      // With Light Propeller: throttle spans 0% airbrake (-6.5 m/s, -3.4 m/s sink)
      // through 50% balanced cruise (0 m/s level hold) up to 100% climb (+10 m/s, +4.8 m/s climb)
      throttleSpeedDelta = (this.throttle - 0.5) * 16.5 + 2.5;
      if (this.throttle >= 0.5) {
        const upFrac = (this.throttle - 0.5) * 2;
        targetClimbRate = upFrac * 4.8;
      } else {
        const downFrac = (0.5 - this.throttle) * 2;
        targetClimbRate = -downFrac * 3.4;
      }
    } else {
      // Unpowered glider: Up tucks for brisker glide, Down airbrakes to descend smoothly
      throttleSpeedDelta = (this.throttle - 0.5) * 9.5;
      const baseSink = this.planeStage === 1 ? -0.62 : this.planeStage === 2 ? -0.4 : -0.24;
      if (this.throttle >= 0.5) {
        const upFrac = (this.throttle - 0.5) * 2;
        const tuckLift = this.planeStage >= 2 ? 0.95 : 0.48;
        targetClimbRate = baseSink + upFrac * tuckLift;
      } else {
        const downFrac = (0.5 - this.throttle) * 2;
        targetClimbRate = baseSink - downFrac * 2.75;
      }
    }

    const boostBonus = this.boostTimer > 0 ? 11.5 * Math.min(1, this.boostTimer / 0.6) : 0;
    const bounceDip = this.bounceCooldown > 0 ? -5.0 * (this.bounceCooldown / 0.65) : 0;
    const desiredSpeed = Math.max(9.5, stageCruise + throttleSpeedDelta + boostBonus + bounceDip);
    this.forwardSpeed = THREE.MathUtils.damp(this.forwardSpeed, desiredSpeed, 4.2, dt);

    // Move along 360-degree forward vector + gentle 2D wind drift
    const fwdX = -Math.sin(this.headingAngle);
    const fwdZ = -Math.cos(this.headingAngle);
    const windScale = this.planeStage === 3 ? 0.68 : 1.0;

    this.planeX += (fwdX * this.forwardSpeed + this.currentWindX * windScale) * dt;
    this.planeZ += (fwdZ * this.forwardSpeed + this.currentWindZ * windScale) * dt;

    this.distanceFloat += this.forwardSpeed * dt;
    this.distance = Math.round(this.distanceFloat);
    if (this.distance > this.bestDistance) {
      this.bestDistance = this.distance;
    }

    // Soft ground-effect cushion near pavement (y < 3.0) and gentle upper air thinning (y > 35)
    let softBoundaryLift = 0;
    if (this.planeY < 3.0) {
      softBoundaryLift = (3.0 - this.planeY) * 2.4;
    } else if (this.planeY > 35) {
      softBoundaryLift = -(this.planeY - 35) * 0.95;
    }

    const boostLift = this.boostTimer > 0 ? 1.8 : 0;
    const desiredVy = targetClimbRate + softBoundaryLift + boostLift;
    this.velY = THREE.MathUtils.damp(this.velY, desiredVy, 2.8, dt);
    this.planeY = THREE.MathUtils.clamp(this.planeY + this.velY * dt, 1.9, 41);

    // Smooth bank and pitch orientation using YXZ Euler order so yaw + pitch + bank align cleanly
    const targetBank = THREE.MathUtils.clamp(this.turnRate * 0.38, -0.58, 0.58);
    const targetPitch = THREE.MathUtils.clamp(this.velY * 0.068, -0.3, 0.36);

    this.bankAngle = THREE.MathUtils.damp(this.bankAngle, targetBank, 8.5, dt);
    this.pitchAngle = THREE.MathUtils.damp(this.pitchAngle, targetPitch, 6.5, dt);

    this.plane.group.position.set(this.planeX, this.planeY, this.planeZ);
    _planeEuler.set(this.pitchAngle, this.headingAngle, this.bankAngle, 'YXZ');
    this.plane.group.quaternion.setFromEuler(_planeEuler);
    this.plane.update(
      dt,
      this.forwardSpeed,
      Math.min(1, this.boostTimer / 2.6),
      this.elapsed,
      this.throttle,
    );

    // Keep shadow frustum centered ahead of plane in any direction
    this.sunLight.target.position.set(
      this.planeX + fwdX * 22,
      0,
      this.planeZ + fwdZ * 22,
    );
    this.updateSunPositionRelativeToPlane();

    // Stream 5x5 city grid tiles and test collisions/pickups
    this.syncTileGrid(false);
    this.checkInteractions();

    // Smooth 360-degree trailing camera
    const isScenic = this.cameraMode === 'scenic';
    const camDist = isScenic ? 10.6 : 6.8;
    const camHeight = isScenic ? 4.3 : 2.35;
    const lookAhead = isScenic ? 26 : 21;

    _camTargetPos.set(
      this.planeX - fwdX * camDist,
      this.planeY + camHeight,
      this.planeZ - fwdZ * camDist,
    );

    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _camTargetPos.x, 7.2, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _camTargetPos.y, 6.2, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _camTargetPos.z, 7.2, dt);

    _camLookTarget.set(
      this.planeX + fwdX * lookAhead,
      this.planeY + 0.35,
      this.planeZ + fwdZ * lookAhead,
    );
    this.camera.lookAt(_camLookTarget);

    const targetFov = (isScenic ? 62 : 58) + (this.boostTimer > 0 ? 7.5 : (this.throttle - 0.5) * 4.5);
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4.5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private checkInteractions(): void {
    const planeRadius = this.planeStage >= 2 ? 0.95 : 0.72;
    const cx = Math.round(this.planeX / TILE_SIZE);
    const cz = Math.round(this.planeZ / TILE_SIZE);

    // Check current tile and immediate 8 neighbors around tile boundaries
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const tile = this.activeTiles.get(`${cx + dx},${cz + dz}`);
        if (!tile) continue;

        const localX = this.planeX - tile.tileX * TILE_SIZE;
        const localZ = this.planeZ - tile.tileZ * TILE_SIZE;

        // 1. Thermal Updraft Rings
        for (let t = 0; t < tile.thermals.length; t++) {
          const th = tile.thermals[t];
          if (th.triggered) continue;
          const distSq =
            (localX - th.x) * (localX - th.x) +
            (this.planeY - th.y) * (this.planeY - th.y) +
            (localZ - th.z) * (localZ - th.z);
          if (distSq < (th.radius + 0.9) * (th.radius + 0.9)) {
            th.triggered = true;
            th.group.visible = false;
            this.velY = Math.max(this.velY + 5.2, 5.8);
            this.forwardSpeed += 2.2;
            this.audio.playThermalSwell();
            this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 10, 0xf7cf72);
          }
        }

        // 2. Special Paper Upgrades
        for (let p = 0; p < tile.pickups.length; p++) {
          const pk = tile.pickups[p];
          if (pk.collected) continue;
          const distSq =
            (localX - pk.x) * (localX - pk.x) +
            (this.planeY - pk.y) * (this.planeY - pk.y) +
            (localZ - pk.z) * (localZ - pk.z);
          if (distSq < 2.8 * 2.8) {
            pk.collected = true;
            pk.group.visible = false;
            this.collectedPickups.add(pk.id);
            this.applyUpgrade(pk.kind);
          }
        }

        // 3. Forgiving 360° Obstacle Recovery
        if (this.bounceCooldown <= 0) {
          for (let c = 0; c < tile.colliders.length; c++) {
            const col = tile.colliders[c];
            if (this.planeY - 0.35 > col.maxY) continue;

            const offX = localX - col.x;
            const offZ = localZ - col.z;
            const overlapX = col.halfW + planeRadius - Math.abs(offX);
            const overlapZ = col.halfD + planeRadius - Math.abs(offZ);

            if (overlapX > 0 && overlapZ > 0) {
              const topGap = col.maxY - this.planeY;
              if (topGap < 1.35) {
                this.planeY = col.maxY + 0.85;
                this.velY = Math.max(this.velY, 3.6);
              } else if (overlapX < overlapZ) {
                const pushX = offX >= 0 ? 1 : -1;
                this.planeX += pushX * (overlapX + 0.95);
                this.velY = Math.max(this.velY, 1.4);
              } else {
                const pushZ = offZ >= 0 ? 1 : -1;
                this.planeZ += pushZ * (overlapZ + 0.95);
                this.velY = Math.max(this.velY, 1.4);
              }

              this.bounceCooldown = 0.65;
              this.plane.triggerFlutter();
              this.audio.playSoftBounce();
              this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 8, 0xfaf8f1);
              break;
            }
          }
        }
      }
    }
  }

  private applyUpgrade(kind: 'airframe' | 'propeller' | 'booster' | 'tailwind'): void {
    this.upgradesCollected += 1;
    this.audio.playUpgradeChime(kind);

    if (kind === 'airframe') {
      if (this.planeStage < 3) {
        this.planeStage = (this.planeStage + 1) as PlaneStage;
        this.plane.setEvolution(this.planeStage, this.hasPropeller);
        this.callbacks.onToast(
          `Design Evolved: ${PLANE_STAGE_NAMES[this.planeStage]}`,
          this.planeStage === 2
            ? 'Wider folded wingtips improve glide lift and turn agility.'
            : 'Twin tail stabilizers calm shifting crosswinds.',
        );
      } else {
        this.boostCharges = Math.min(this.maxBoostCharges, this.boostCharges + 1);
        this.callbacks.onToast('Origami Mastery', 'Bonus Spacebar booster charge added.');
      }
      this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 14, 0xd97a54);
    } else if (kind === 'propeller') {
      if (!this.hasPropeller) {
        this.hasPropeller = true;
        this.plane.setEvolution(this.planeStage, true);
        this.callbacks.onToast(
          'Light Propeller Mounted',
          'Use Up / Down Arrows to throttle climb or brake into descent.',
        );
      } else {
        this.velY += 2.5;
        this.callbacks.onToast('Propeller Tune-Up', 'Gentle upward airstream lift.');
      }
      this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 14, 0xf7cf72);
    } else if (kind === 'booster') {
      if (this.boostCharges < this.maxBoostCharges) {
        this.boostCharges += 1;
        this.callbacks.onToast(
          'Paper Booster Ready',
          'Press Spacebar anytime for a gentle speed & lift surge.',
        );
      } else {
        this.boostTimer = Math.max(this.boostTimer, 1.5);
        this.callbacks.onToast('Instant Gust Surge', 'Booster slot full — surging forward!');
      }
      this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 12, 0xffffff);
    } else {
      this.tailwindLevel = Math.min(4, this.tailwindLevel + 1);
      this.velY = Math.max(this.velY, 2.2);
      this.callbacks.onToast(
        'Tailwind Charm Collected',
        'Crisper cruise speed and buoyant lift.',
      );
      this.spawnBurstParticles(this.planeX, this.planeY, this.planeZ, 12, 0x6f9e8b);
    }

    this.emitTelemetry();
  }

  private spawnBurstParticles(x: number, y: number, z: number, count: number, hex: number): void {
    for (let i = 0; i < count; i++) {
      const mat = this.particleMat.clone();
      mat.color.setHex(hex);
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 6.5,
        vy: Math.random() * 4.0 - 0.5,
        vz: (Math.random() - 0.5) * 6.5,
        life: 0.75 + Math.random() * 0.35,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        (pt.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.mesh.rotation.x += dt * 5;
      pt.mesh.rotation.y += dt * 4;
      (pt.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, pt.life / 0.45);
    }
  }

  private updateAtmosphereVisuals(): void {
    const p = this.dayProgress;
    let duskGlow = 0;

    if (p < 0.25) {
      const t = p / 0.25;
      _workColor.copy(_skyMorning).lerp(_skyNoon, t);
      _workColor2.copy(_fogMorning).lerp(_fogNoon, t);
      this.sunLight.color.copy(_sunMorning);
      this.hemiLight.color.copy(_hemiSkyMorning);
      this.hemiLight.groundColor.copy(_hemiGroundMorning);
    } else if (p < 0.52) {
      const t = (p - 0.25) / 0.27;
      _workColor.copy(_skyNoon).lerp(_skyDusk, t);
      _workColor2.copy(_fogNoon).lerp(_fogDusk, t);
      this.sunLight.color.copy(_sunMorning).lerp(_sunDusk, t);
      this.hemiLight.color.copy(_hemiSkyMorning).lerp(_hemiSkyDusk, t);
      this.hemiLight.groundColor.copy(_hemiGroundMorning).lerp(_hemiGroundDusk, t);
      duskGlow = t * 0.9;
    } else if (p < 0.75) {
      const t = (p - 0.52) / 0.23;
      _workColor.copy(_skyDusk).lerp(_skyTwilight, t);
      _workColor2.copy(_fogDusk).lerp(_fogTwilight, t);
      this.sunLight.color.copy(_sunDusk);
      this.hemiLight.color.copy(_hemiSkyDusk).lerp(_skyTwilight, t * 0.6);
      this.hemiLight.groundColor.copy(_hemiGroundDusk);
      duskGlow = 0.9 + t * 0.35;
    } else {
      const t = (p - 0.75) / 0.25;
      _workColor.copy(_skyTwilight).lerp(_skyMorning, t);
      _workColor2.copy(_fogTwilight).lerp(_fogMorning, t);
      this.sunLight.color.copy(_sunDusk).lerp(_sunMorning, t);
      this.hemiLight.color.copy(_skyTwilight).lerp(_hemiSkyMorning, t);
      this.hemiLight.groundColor.copy(_hemiGroundDusk).lerp(_hemiGroundMorning, t);
      duskGlow = (1 - t) * 1.25;
    }

    (this.scene.background as THREE.Color).copy(_workColor);
    if (this.scene.fog) {
      (this.scene.fog as THREE.FogExp2).color.copy(_workColor2);
    }

    this.materials.buildingWindows.emissiveIntensity = 0.05 + duskGlow * 0.72;
    this.materials.poleLantern.emissiveIntensity = 0.15 + duskGlow * 1.35;
    this.sunLight.intensity = 1.48 - duskGlow * 0.32;
    this.updateSunPositionRelativeToPlane();
  }

  private updateSunPositionRelativeToPlane(): void {
    const elevation = 66 - Math.sin(this.dayProgress * Math.PI) * 34;
    this.sunLight.position.set(this.planeX + 42, elevation, this.planeZ + 24);
  }

  private getTimeOfDayLabel(): string {
    const p = this.dayProgress;
    if (p < 0.22) return 'Morning Light';
    if (p < 0.42) return 'Sunlit Noon';
    if (p < 0.68) return 'Golden Dusk';
    return 'Soft Twilight';
  }

  private getHeadingLabel(): string {
    // 0 = North (-Z), +PI/2 = West (-X), PI = South (+Z), 3PI/2 = East (+X)
    const deg = ((360 - THREE.MathUtils.radToDeg(this.headingAngle)) % 360 + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return dirs[Math.round(deg / 45) % 8];
  }

  private getWindLabel(): string {
    const mag = Math.hypot(this.currentWindX, this.currentWindZ);
    if (mag < 0.45) return 'Calm Air';
    const deg = ((Math.atan2(this.currentWindX, -this.currentWindZ) * 180) / Math.PI + 360) % 360;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const dirLabel = dirs[Math.round(deg / 45) % 8];
    return mag > 1.5 ? `${dirLabel} Breeze` : `Light ${dirLabel}`;
  }

  private emitTelemetry(): void {
    this.callbacks.onTelemetry({
      distance: this.distance,
      bestDistance: this.bestDistance,
      altitude: Math.round(this.planeY * 10) / 10,
      speed: Math.round(this.forwardSpeed * 10) / 10,
      throttle: this.throttle,
      headingLabel: this.getHeadingLabel(),
      windStrength: Math.hypot(this.currentWindX, this.currentWindZ),
      windLabel: this.getWindLabel(),
      planeStage: this.planeStage,
      planeName: PLANE_STAGE_NAMES[this.planeStage],
      hasPropeller: this.hasPropeller,
      tailwindLevel: this.tailwindLevel,
      boostCharges: this.boostCharges,
      maxBoostCharges: this.maxBoostCharges,
      boostActiveRatio: Math.min(1, this.boostTimer / 2.6),
      dayProgress: this.dayProgress,
      timeOfDayLabel: this.getTimeOfDayLabel(),
      upgradesCollected: this.upgradesCollected,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.particles.forEach((pt) => {
      this.scene.remove(pt.mesh);
      (pt.mesh.material as THREE.Material).dispose();
    });
    this.particles.length = 0;

    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.plane.dispose();
    this.sharedGeos.dispose();
    this.materials.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
