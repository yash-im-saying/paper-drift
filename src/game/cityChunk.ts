import * as THREE from 'three';
import { CityPaletteMaterials } from './materials';
import { UpgradeKind } from './types';

export const TILE_SIZE = 72;
export const GRID_RADIUS = 2; // 5x5 grid = 25 tiles covering 360x360m around plane

export interface BoxCollider {
  kind: 'building' | 'house' | 'tree' | 'pole';
  x: number; // tile-local [-36, 36]
  z: number; // tile-local [-36, 36]
  halfW: number;
  halfD: number;
  maxY: number;
}

export interface ThermalRingItem {
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  radius: number;
  triggered: boolean;
}

export interface UpgradePickupItem {
  id: string;
  group: THREE.Group;
  innerMesh: THREE.Object3D;
  kind: UpgradeKind;
  x: number;
  y: number;
  z: number;
  collected: boolean;
}

interface WindRibbonItem {
  mesh: THREE.Mesh;
  localOffset: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  speed: number;
  phase: number;
}

export function sampleWindAt(x: number, z: number, worldSeed: number): { wx: number; wz: number } {
  const s = worldSeed * 0.017;
  const wx = Math.sin(x * 0.011 + z * 0.008 + s) * 1.45 + Math.cos(z * 0.005 - s) * 0.65;
  const wz = Math.cos(z * 0.011 - x * 0.007 + s) * 1.45 + Math.sin(x * 0.005 + s) * 0.65;
  return {
    wx: THREE.MathUtils.clamp(wx, -2.2, 2.2),
    wz: THREE.MathUtils.clamp(wz, -2.2, 2.2),
  };
}

export class SharedCityGeometries {
  public readonly groundGeo: THREE.PlaneGeometry;
  public readonly nsRoadGeo: THREE.PlaneGeometry;
  public readonly ewRoadArmGeo: THREE.PlaneGeometry;
  public readonly sidewalkStripGeo: THREE.BoxGeometry;
  public readonly stripeNsGeo: THREE.PlaneGeometry;
  public readonly stripeEwGeo: THREE.PlaneGeometry;

  public readonly unitBoxGeo: THREE.BoxGeometry;
  public readonly roofPrismGeo: THREE.ConeGeometry;
  public readonly trunkGeo: THREE.CylinderGeometry;
  public readonly coneCrownGeo: THREE.ConeGeometry;
  public readonly roundCrownGeo: THREE.IcosahedronGeometry;
  public readonly poleGeo: THREE.CylinderGeometry;
  public readonly lanternGeo: THREE.IcosahedronGeometry;
  public readonly windRibbonGeo: THREE.PlaneGeometry;
  public readonly thermalTorusGeo: THREE.TorusGeometry;
  public readonly pickupHaloGeo: THREE.TorusGeometry;
  public readonly pickupOctaGeo: THREE.OctahedronGeometry;
  public readonly pickupPropBladeGeo: THREE.BoxGeometry;

  constructor() {
    this.groundGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    this.groundGeo.rotateX(-Math.PI / 2);

    // Non-overlapping N-S road + two E-W road arms so zero Z-fighting at intersections
    this.nsRoadGeo = new THREE.PlaneGeometry(11, TILE_SIZE);
    this.nsRoadGeo.rotateX(-Math.PI / 2);

    const armLen = (TILE_SIZE - 11) / 2; // 30.5
    this.ewRoadArmGeo = new THREE.PlaneGeometry(armLen, 11);
    this.ewRoadArmGeo.rotateX(-Math.PI / 2);

    // Sidewalk frame strips around each 29x29 corner block (leaving 1.5m outer margin)
    this.sidewalkStripGeo = new THREE.BoxGeometry(2.6, 0.14, 29.5);

    this.stripeNsGeo = new THREE.PlaneGeometry(0.3, 3.4);
    this.stripeNsGeo.rotateX(-Math.PI / 2);

    this.stripeEwGeo = new THREE.PlaneGeometry(3.4, 0.3);
    this.stripeEwGeo.rotateX(-Math.PI / 2);

    this.unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

    this.roofPrismGeo = new THREE.ConeGeometry(0.78, 1, 4);
    this.roofPrismGeo.rotateY(Math.PI / 4);

    this.trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
    this.coneCrownGeo = new THREE.ConeGeometry(1, 1, 6);
    this.roundCrownGeo = new THREE.IcosahedronGeometry(1, 0);

    this.poleGeo = new THREE.CylinderGeometry(0.08, 0.13, 1, 6);
    this.lanternGeo = new THREE.IcosahedronGeometry(0.24, 0);

    this.windRibbonGeo = new THREE.PlaneGeometry(0.16, 2.8, 1, 6);
    this.windRibbonGeo.rotateX(-Math.PI / 2);
    const wPos = this.windRibbonGeo.attributes.position;
    for (let i = 0; i < wPos.count; i++) {
      const pz = wPos.getZ(i);
      wPos.setY(i, wPos.getY(i) + Math.sin(pz * 1.4) * 0.14);
    }
    this.windRibbonGeo.computeVertexNormals();

    this.thermalTorusGeo = new THREE.TorusGeometry(2.7, 0.17, 6, 18);
    this.pickupHaloGeo = new THREE.TorusGeometry(1.25, 0.065, 6, 16);
    this.pickupOctaGeo = new THREE.OctahedronGeometry(0.68, 0);
    this.pickupPropBladeGeo = new THREE.BoxGeometry(1.45, 0.21, 0.06);
  }

  public dispose(): void {
    this.groundGeo.dispose();
    this.nsRoadGeo.dispose();
    this.ewRoadArmGeo.dispose();
    this.sidewalkStripGeo.dispose();
    this.stripeNsGeo.dispose();
    this.stripeEwGeo.dispose();
    this.unitBoxGeo.dispose();
    this.roofPrismGeo.dispose();
    this.trunkGeo.dispose();
    this.coneCrownGeo.dispose();
    this.roundCrownGeo.dispose();
    this.poleGeo.dispose();
    this.lanternGeo.dispose();
    this.windRibbonGeo.dispose();
    this.thermalTorusGeo.dispose();
    this.pickupHaloGeo.dispose();
    this.pickupOctaGeo.dispose();
    this.pickupPropBladeGeo.dispose();
  }
}

export class CityChunk {
  public readonly group: THREE.Group;
  public tileX = 0;
  public tileZ = 0;
  public windX = 0;
  public windZ = 0;

  public colliders: BoxCollider[] = [];
  public thermals: ThermalRingItem[] = [];
  public pickups: UpgradePickupItem[] = [];
  private windRibbons: WindRibbonItem[] = [];
  private dynamicGroup: THREE.Group;

  private readonly geos: SharedCityGeometries;
  private readonly mats: CityPaletteMaterials;

  constructor(geos: SharedCityGeometries, mats: CityPaletteMaterials) {
    this.geos = geos;
    this.mats = mats;
    this.group = new THREE.Group();
    this.dynamicGroup = new THREE.Group();
    this.group.add(this.dynamicGroup);

    this.buildBaseIntersectionGrid();
  }

  private buildBaseIntersectionGrid(): void {
    const ground = new THREE.Mesh(this.geos.groundGeo, this.mats.ground);
    ground.receiveShadow = true;
    this.group.add(ground);

    // North-South continuous street at x = 0
    const nsRoad = new THREE.Mesh(this.geos.nsRoadGeo, this.mats.road);
    nsRoad.position.set(0, 0.03, 0);
    nsRoad.receiveShadow = true;
    this.group.add(nsRoad);

    // East-West road arms at z = 0 (split around central 11x11 intersection)
    const armOffset = 5.5 + (TILE_SIZE - 11) / 4; // 5.5 + 15.25 = 20.75
    const ewLeft = new THREE.Mesh(this.geos.ewRoadArmGeo, this.mats.road);
    ewLeft.position.set(-armOffset, 0.03, 0);
    ewLeft.receiveShadow = true;
    this.group.add(ewLeft);

    const ewRight = new THREE.Mesh(this.geos.ewRoadArmGeo, this.mats.road);
    ewRight.position.set(armOffset, 0.03, 0);
    ewRight.receiveShadow = true;
    this.group.add(ewRight);

    // Dashed center stripes along N-S and E-W streets (skip central intersection)
    for (const offset of [-30, -20, -10, 10, 20, 30]) {
      const sNs = new THREE.Mesh(this.geos.stripeNsGeo, this.mats.roadStripe);
      sNs.position.set(0, 0.055, offset);
      this.group.add(sNs);

      const sEw = new THREE.Mesh(this.geos.stripeEwGeo, this.mats.roadStripe);
      sEw.position.set(offset, 0.055, 0);
      this.group.add(sEw);
    }

    // Sidewalks framing each of the 4 city block quadrants
    const quadCenter = 5.5 + 2.6 / 2 + 29.5 / 2; // ~21.55
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const swVert = new THREE.Mesh(this.geos.sidewalkStripGeo, this.mats.sidewalk);
        swVert.position.set(sx * (5.5 + 1.3), 0.07, sz * quadCenter);
        swVert.receiveShadow = true;
        this.group.add(swVert);

        const swHoriz = new THREE.Mesh(this.geos.sidewalkStripGeo, this.mats.sidewalk);
        swHoriz.rotation.y = Math.PI / 2;
        swHoriz.position.set(sx * quadCenter, 0.07, sz * (5.5 + 1.3));
        swHoriz.receiveShadow = true;
        this.group.add(swHoriz);
      }
    }
  }

  private createTileRng(tileX: number, tileZ: number, worldSeed: number): () => number {
    // Deterministic 32-bit hash for any (tileX, tileZ) in [-inf, +inf]
    let h = (tileX * 374761393) ^ (tileZ * 668265263) ^ (worldSeed * 1442695041);
    h = (h ^ (h >>> 13)) * 1274126177;
    let state = (h ^ (h >>> 16)) >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  public populate(
    tileX: number,
    tileZ: number,
    worldSeed: number,
    hasPropellerAlready: boolean,
    planeStage: number,
    collectedIds: Set<string>,
  ): void {
    this.tileX = tileX;
    this.tileZ = tileZ;
    this.group.position.set(tileX * TILE_SIZE, 0, tileZ * TILE_SIZE);

    while (this.dynamicGroup.children.length > 0) {
      this.dynamicGroup.remove(this.dynamicGroup.children[0]);
    }
    this.colliders = [];
    this.thermals = [];
    this.pickups = [];
    this.windRibbons = [];

    const rand = this.createTileRng(tileX, tileZ, worldSeed);
    const centerWorldX = tileX * TILE_SIZE;
    const centerWorldZ = tileZ * TILE_SIZE;
    const wind = sampleWindAt(centerWorldX, centerWorldZ, worldSeed);
    this.windX = wind.wx;
    this.windZ = wind.wz;

    const isOriginTile = tileX === 0 && tileZ === 0;

    // 1. Corner streetlamps & avenue utility poles
    this.spawnIntersectionPoles(rand);

    // 2. Populate the 4 city-block quadrants in this tile
    // Quadrant centers sit at (±21.5, ±21.5), usable interior ~22x22m
    const districtFactor =
      0.5 + 0.5 * Math.sin(tileX * 0.52 + worldSeed * 0.03) * Math.cos(tileZ * 0.48 - worldSeed * 0.02);

    for (const qx of [-1, 1]) {
      for (const qz of [-1, 1]) {
        const blockCx = qx * 21.5;
        const blockCz = qz * 21.5;
        const qRoll = rand();

        // Keep origin tile low-height & welcoming right around takeoff
        if (isOriginTile) {
          this.spawnHouse(blockCx - qx * 4, blockCz - qz * 4, rand);
          this.spawnTree(blockCx + qx * 4.5, blockCz + qz * 4.5, rand);
          this.spawnTree(blockCx - qx * 4, blockCz + qz * 5.2, rand);
          continue;
        }

        if (qRoll < 0.24) {
          // City Park / Tree Grove Quadrant
          const treeCount = 4 + Math.floor(rand() * 3);
          for (let t = 0; t < treeCount; t++) {
            const tx = blockCx + (rand() - 0.5) * 16;
            const tz = blockCz + (rand() - 0.5) * 16;
            this.spawnTree(tx, tz, rand);
          }
        } else if (qRoll < 0.56 + districtFactor * 0.22) {
          // Downtown Commercial Quadrant (1–2 towers + trees)
          const mainH = 10 + districtFactor * 14 + rand() * 8;
          this.spawnBuilding(blockCx + (rand() - 0.5) * 4, blockCz + (rand() - 0.5) * 4, rand, mainH);

          // Secondary companion mid-rise or park tree
          if (rand() > 0.35) {
            const offX = qx * 6.2;
            const offZ = -qz * 6.2;
            this.spawnBuilding(blockCx + offX, blockCz + offZ, rand, 7 + rand() * 9);
          } else {
            this.spawnTree(blockCx - qx * 6.5, blockCz + qz * 6.5, rand);
          }
          this.spawnTree(blockCx + qx * 7.2, blockCz + qz * 7.2, rand);
        } else {
          // Cozy Residential Neighborhood Quadrant (2–3 houses + garden trees)
          const slots: [number, number][] = [
            [blockCx - 5.2, blockCz - 5.2],
            [blockCx + 5.2, blockCz - 4.8],
            [blockCx - 4.8, blockCz + 5.2],
            [blockCx + 5.2, blockCz + 5.2],
          ];
          slots.forEach(([sx, sz]) => {
            if (rand() < 0.62) {
              this.spawnHouse(sx + (rand() - 0.5) * 1.4, sz + (rand() - 0.5) * 1.4, rand);
            } else {
              this.spawnTree(sx, sz, rand);
            }
          });
        }
      }
    }

    // 3. Visible wind ribbons drifting in local (windX, windZ) direction
    this.spawnWindRibbons(rand);

    // 4. Multi-altitude Golden Thermal Rings & Special Paper Upgrades
    this.spawnMultiAltitudeItems(
      tileX,
      tileZ,
      rand,
      isOriginTile,
      hasPropellerAlready,
      planeStage,
      collectedIds,
    );
  }

  private spawnBuilding(x: number, z: number, rand: () => number, height: number): void {
    const w = 5.4 + rand() * 3.0;
    const d = 5.4 + rand() * 3.0;
    const wallMat = this.mats.buildingWalls[Math.floor(rand() * this.mats.buildingWalls.length)];

    const bGroup = new THREE.Group();
    bGroup.position.set(x, 0, z);

    const plinthH = 1.4;
    const plinth = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.buildingTrim);
    plinth.scale.set(w + 0.45, plinthH, d + 0.45);
    plinth.position.y = plinthH / 2;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    bGroup.add(plinth);

    const shaftH = height - plinthH;
    const shaft = new THREE.Mesh(this.geos.unitBoxGeo, wallMat);
    shaft.scale.set(w, shaftH, d);
    shaft.position.y = plinthH + shaftH / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    const floors = Math.max(2, Math.floor(shaftH / 3.3));
    for (let f = 1; f < floors; f++) {
      const wy = plinthH + f * 3.1;
      if (wy > height - 1.2) break;
      const band = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.buildingWindows);
      band.scale.set(w + 0.08, 0.85, d + 0.08);
      band.position.y = wy;
      bGroup.add(band);
    }

    const parapet = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.buildingTrim);
    parapet.scale.set(w + 0.3, 0.45, d + 0.3);
    parapet.position.y = height + 0.22;
    bGroup.add(parapet);

    const pentW = w * (0.42 + rand() * 0.2);
    const pentD = d * (0.42 + rand() * 0.2);
    const pentH = 1.2 + rand() * 1.4;
    const pent = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.rooftopAccent);
    pent.scale.set(pentW, pentH, pentD);
    pent.position.set((rand() - 0.5) * 0.8, height + 0.45 + pentH / 2, (rand() - 0.5) * 0.8);
    pent.castShadow = true;
    bGroup.add(pent);

    this.dynamicGroup.add(bGroup);

    this.colliders.push({
      kind: 'building',
      x,
      z,
      halfW: w * 0.52,
      halfD: d * 0.52,
      maxY: height + pentH + 0.4,
    });
  }

  private spawnHouse(x: number, z: number, rand: () => number): void {
    const w = 3.5 + rand() * 1.2;
    const d = 3.7 + rand() * 1.2;
    const wallH = 2.6 + rand() * 1.0;
    const roofH = 1.8 + rand() * 0.7;

    const wallMat = this.mats.houseWalls[Math.floor(rand() * this.mats.houseWalls.length)];
    const roofMat = this.mats.houseRoofs[Math.floor(rand() * this.mats.houseRoofs.length)];

    const hGroup = new THREE.Group();
    hGroup.position.set(x, 0, z);
    hGroup.rotation.y = (rand() > 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.14;

    const base = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.housePorch);
    base.scale.set(w + 0.45, 0.35, d + 0.55);
    base.position.y = 0.175;
    base.receiveShadow = true;
    hGroup.add(base);

    const body = new THREE.Mesh(this.geos.unitBoxGeo, wallMat);
    body.scale.set(w, wallH, d);
    body.position.y = 0.35 + wallH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    hGroup.add(body);

    const win = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.buildingWindows);
    win.scale.set(w + 0.08, 0.8, d * 0.42);
    win.position.y = 0.35 + wallH * 0.55;
    hGroup.add(win);

    const roof = new THREE.Mesh(this.geos.roofPrismGeo, roofMat);
    roof.scale.set(w * 1.15, roofH, d * 1.15);
    roof.position.y = 0.35 + wallH + roofH / 2;
    roof.castShadow = true;
    hGroup.add(roof);

    const chimney = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.buildingTrim);
    chimney.scale.set(0.45, 1.25, 0.45);
    chimney.position.set(w * 0.25, 0.35 + wallH + roofH * 0.55, -d * 0.18);
    hGroup.add(chimney);

    this.dynamicGroup.add(hGroup);

    this.colliders.push({
      kind: 'house',
      x,
      z,
      halfW: Math.max(w, d) * 0.55,
      halfD: Math.max(w, d) * 0.55,
      maxY: 0.35 + wallH + roofH,
    });
  }

  private spawnTree(x: number, z: number, rand: () => number): void {
    const scale = 0.85 + rand() * 0.5;
    const isConifer = rand() > 0.45;
    const tGroup = new THREE.Group();
    tGroup.position.set(x, 0, z);

    const tint = new THREE.Color().setHSL(
      0.32 + (rand() - 0.5) * 0.06,
      0.28 + rand() * 0.12,
      0.52 + rand() * 0.1,
    );

    const trunkH = (isConifer ? 1.8 : 2.1) * scale;
    const trunk = new THREE.Mesh(this.geos.trunkGeo, this.mats.treeTrunk);
    trunk.scale.set(scale, trunkH, scale);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tGroup.add(trunk);

    let maxH = trunkH;
    const crownColorMat = this.mats.treeFoliage.clone();
    crownColorMat.color.copy(tint);

    if (isConifer) {
      for (let tier = 0; tier < 3; tier++) {
        const radius = (1.6 - tier * 0.36) * scale;
        const ch = (1.8 - tier * 0.25) * scale;
        const cone = new THREE.Mesh(this.geos.coneCrownGeo, crownColorMat);
        cone.scale.set(radius, ch, radius);
        cone.position.y = trunkH + tier * 1.02 * scale + ch * 0.35;
        cone.rotation.y = tier * 0.55;
        cone.castShadow = true;
        tGroup.add(cone);
        maxH = Math.max(maxH, cone.position.y + ch * 0.5);
      }
    } else {
      const c1 = new THREE.Mesh(this.geos.roundCrownGeo, crownColorMat);
      c1.scale.setScalar(1.42 * scale);
      c1.position.set(0, trunkH + 1.0 * scale, 0);
      c1.castShadow = true;
      tGroup.add(c1);

      const c2 = new THREE.Mesh(this.geos.roundCrownGeo, crownColorMat);
      c2.scale.setScalar(1.02 * scale);
      c2.position.set(0.52 * scale, trunkH + 1.52 * scale, 0.32 * scale);
      c2.castShadow = true;
      tGroup.add(c2);
      maxH = trunkH + 2.5 * scale;
    }

    this.dynamicGroup.add(tGroup);

    this.colliders.push({
      kind: 'tree',
      x,
      z,
      halfW: 1.3 * scale,
      halfD: 1.3 * scale,
      maxY: maxH,
    });
  }

  private spawnIntersectionPoles(rand: () => number): void {
    // Corner streetlamps + mid-avenue utility poles along sidewalk perimeters
    const spots: { x: number; z: number; armX: number; armZ: number; utility: boolean }[] = [
      { x: -6.8, z: -6.8, armX: 0.75, armZ: 0, utility: false },
      { x: 6.8, z: 6.8, armX: -0.75, armZ: 0, utility: false },
      { x: -6.8, z: 24, armX: 0.75, armZ: 0, utility: rand() > 0.65 },
      { x: 6.8, z: -24, armX: -0.75, armZ: 0, utility: rand() > 0.65 },
      { x: -24, z: 6.8, armX: 0, armZ: -0.75, utility: rand() > 0.65 },
      { x: 24, z: -6.8, armX: 0, armZ: 0.75, utility: rand() > 0.65 },
    ];

    spots.forEach((sp) => {
      const poleH = sp.utility ? 7.0 : 5.2;
      const pGroup = new THREE.Group();
      pGroup.position.set(sp.x, 0.14, sp.z);

      const shaft = new THREE.Mesh(this.geos.poleGeo, this.mats.poleMetal);
      shaft.scale.set(1, poleH, 1);
      shaft.position.y = poleH / 2;
      shaft.castShadow = true;
      pGroup.add(shaft);

      if (sp.utility) {
        const crossbar = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.poleMetal);
        crossbar.scale.set(sp.armX !== 0 ? 0.14 : 1.5, 0.12, sp.armX !== 0 ? 1.5 : 0.14);
        crossbar.position.y = poleH - 0.55;
        pGroup.add(crossbar);
      } else {
        const arm = new THREE.Mesh(this.geos.unitBoxGeo, this.mats.poleMetal);
        arm.scale.set(sp.armX !== 0 ? 0.9 : 0.1, 0.1, sp.armZ !== 0 ? 0.9 : 0.1);
        arm.position.set(sp.armX * 0.5, poleH - 0.1, sp.armZ * 0.5);
        pGroup.add(arm);

        const lantern = new THREE.Mesh(this.geos.lanternGeo, this.mats.poleLantern);
        lantern.position.set(sp.armX, poleH - 0.28, sp.armZ);
        pGroup.add(lantern);
      }

      this.dynamicGroup.add(pGroup);

      this.colliders.push({
        kind: 'pole',
        x: sp.x,
        z: sp.z,
        halfW: 0.45,
        halfD: 0.45,
        maxY: poleH + 0.3,
      });
    });
  }

  private spawnWindRibbons(rand: () => number): void {
    const windAngle = Math.atan2(this.windX, this.windZ);
    const windSpeed = Math.hypot(this.windX, this.windZ);

    for (let i = 0; i < 6; i++) {
      const ribbon = new THREE.Mesh(this.geos.windRibbonGeo, this.mats.windRibbon);
      const bx = (rand() - 0.5) * (TILE_SIZE - 8);
      const by = 4.5 + rand() * 22;
      const bz = (rand() - 0.5) * (TILE_SIZE - 8);
      ribbon.position.set(bx, by, bz);
      ribbon.rotation.y = windAngle;
      this.dynamicGroup.add(ribbon);

      this.windRibbons.push({
        mesh: ribbon,
        localOffset: 0,
        baseX: bx,
        baseY: by,
        baseZ: bz,
        speed: 4.0 + windSpeed * 2.8 + rand() * 2.0,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  private spawnMultiAltitudeItems(
    tileX: number,
    tileZ: number,
    rand: () => number,
    isOriginTile: boolean,
    hasPropellerAlready: boolean,
    planeStage: number,
    collectedIds: Set<string>,
  ): void {
    // Three balanced altitude bands so low, mid, and high flyers all find collectibles
    const bands: [number, number][] = [
      [4.8, 9.0],   // Low avenue canyon
      [11.5, 18.0], // Mid skyline
      [20.5, 29.5], // High rooftop sky
    ];

    // Pick 2 distinct altitude bands per tile for upgrade pickups (plus 1 complementary thermal band)
    const bandOffset = Math.abs(tileX * 3 + tileZ * 5) % 3;
    const pickupBands = [bandOffset, (bandOffset + 1) % 3];
    const thermalBand = (bandOffset + 2) % 3;

    // Safe avenue/open positions for low altitude vs anywhere for mid/high
    const getPosForBand = (bandIdx: number): { x: number; y: number; z: number } => {
      const [minY, maxY] = bands[bandIdx];
      const y = minY + rand() * (maxY - minY);
      if (bandIdx === 0) {
        // Low canyon pickups sit cleanly along open N-S or E-W street corridors
        if (rand() > 0.5) {
          return { x: (rand() - 0.5) * 6.5, y, z: (rand() - 0.5) * 56 };
        }
        return { x: (rand() - 0.5) * 56, y, z: (rand() - 0.5) * 6.5 };
      }
      return { x: (rand() - 0.5) * 54, y, z: (rand() - 0.5) * 54 };
    };

    // Thermal updraft ring (always present on non-origin tiles, or ahead on origin)
    const thPos = isOriginTile ? { x: 0, y: 11, z: -26 } : getPosForBand(thermalBand);
    this.spawnThermalRing(thPos.x, thPos.y, thPos.z, rand() * Math.PI);

    // Spawn 2 upgrade pickups per tile across different altitude bands
    pickupBands.forEach((bandIdx, slotIdx) => {
      const id = `${tileX},${tileZ},${slotIdx}`;
      if (collectedIds.has(id)) return;

      let kind: UpgradeKind;
      const distFromOrigin = Math.hypot(tileX, tileZ);

      if (isOriginTile && slotIdx === 0) {
        kind = 'booster';
      } else if (distFromOrigin <= 1.6 && !hasPropellerAlready && slotIdx === 1) {
        kind = 'propeller';
      } else if (distFromOrigin <= 1.6 && planeStage < 2 && slotIdx === 0) {
        kind = 'airframe';
      } else {
        const r = rand();
        if (!hasPropellerAlready && r < 0.24) kind = 'propeller';
        else if (planeStage < 3 && r < 0.5) kind = 'airframe';
        else if (r < 0.82) kind = 'booster';
        else kind = 'tailwind';
      }

      const pos =
        isOriginTile && slotIdx === 0
          ? { x: 0, y: 11.5, z: -16 }
          : isOriginTile && slotIdx === 1
            ? { x: 0, y: 8.0, z: -28 }
            : getPosForBand(bandIdx);

      this.spawnUpgradePickup(id, kind, pos.x, pos.y, pos.z);
    });
  }

  private spawnThermalRing(x: number, y: number, z: number, rotY: number): void {
    const rGroup = new THREE.Group();
    rGroup.position.set(x, y, z);
    rGroup.rotation.y = rotY;

    const ring = new THREE.Mesh(this.geos.thermalTorusGeo, this.mats.thermalRing);
    rGroup.add(ring);

    const innerRing = new THREE.Mesh(this.geos.pickupHaloGeo, this.mats.windRibbon);
    innerRing.scale.setScalar(1.65);
    rGroup.add(innerRing);

    this.dynamicGroup.add(rGroup);

    this.thermals.push({
      group: rGroup,
      x,
      y,
      z,
      radius: 3.4,
      triggered: false,
    });
  }

  private spawnUpgradePickup(
    id: string,
    kind: UpgradeKind,
    x: number,
    y: number,
    z: number,
  ): void {
    const pGroup = new THREE.Group();
    pGroup.position.set(x, y, z);

    const haloMat =
      kind === 'airframe'
        ? this.mats.paperTrimTerracotta
        : kind === 'propeller'
          ? this.mats.thermalRing
          : kind === 'booster'
            ? this.mats.paperMain
            : this.mats.paperTrimSage;

    const halo = new THREE.Mesh(this.geos.pickupHaloGeo, haloMat);
    pGroup.add(halo);

    let innerMesh: THREE.Object3D;
    if (kind === 'propeller') {
      const propObj = new THREE.Group();
      const b1 = new THREE.Mesh(this.geos.pickupPropBladeGeo, this.mats.propellerBlade);
      const b2 = new THREE.Mesh(this.geos.pickupPropBladeGeo, this.mats.propellerBlade);
      b2.rotation.z = Math.PI / 2;
      propObj.add(b1, b2);
      pGroup.add(propObj);
      innerMesh = propObj;
    } else {
      const gem = new THREE.Mesh(this.geos.pickupOctaGeo, haloMat);
      pGroup.add(gem);
      innerMesh = gem;
    }

    this.dynamicGroup.add(pGroup);

    this.pickups.push({
      id,
      group: pGroup,
      innerMesh,
      kind,
      x,
      y,
      z,
      collected: false,
    });
  }

  public updateVisuals(dt: number, elapsed: number): void {
    const wLen = Math.hypot(this.windX, this.windZ);
    const dirX = wLen > 0.001 ? this.windX / wLen : 0;
    const dirZ = wLen > 0.001 ? this.windZ / wLen : 1;

    for (let i = 0; i < this.windRibbons.length; i++) {
      const wr = this.windRibbons[i];
      wr.localOffset = (wr.localOffset + wr.speed * dt) % 24;
      const drift = wr.localOffset - 12;
      wr.mesh.position.x = wr.baseX + dirX * drift;
      wr.mesh.position.z = wr.baseZ + dirZ * drift;
      wr.mesh.position.y = wr.baseY + Math.sin(elapsed * 1.8 + wr.phase) * 0.45;
    }

    for (let i = 0; i < this.thermals.length; i++) {
      const th = this.thermals[i];
      if (!th.triggered) {
        th.group.rotation.z += dt * 0.9;
        th.group.position.y = th.y + Math.sin(elapsed * 2 + i) * 0.25;
      }
    }

    for (let i = 0; i < this.pickups.length; i++) {
      const pk = this.pickups[i];
      if (!pk.collected) {
        pk.innerMesh.rotation.y += dt * 1.8;
        pk.group.rotation.y += dt * 0.65;
        if (pk.kind === 'propeller') {
          pk.innerMesh.rotation.z += dt * 4.5;
        }
        pk.group.position.y = pk.y + Math.sin(elapsed * 2.4 + pk.x) * 0.35;
      }
    }
  }
}
