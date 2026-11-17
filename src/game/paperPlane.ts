import * as THREE from 'three';
import { CityPaletteMaterials } from './materials';
import { PlaneStage } from './types';

function createTriangleGeometry(
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    c[0], c[1], c[2],
  ]);
  const uvs = new Float32Array([
    0.5, 1.0,
    0.0, 0.0,
    1.0, 0.0,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

export class PaperPlaneRig {
  public readonly group: THREE.Group;
  private readonly bodyGroup: THREE.Group;
  private readonly stage2Group: THREE.Group;
  private readonly stage3Group: THREE.Group;
  private readonly propellerGroup: THREE.Group;
  private readonly propellerSpinner: THREE.Group;
  private readonly leftRibbon: THREE.Mesh;
  private readonly rightRibbon: THREE.Mesh;
  private readonly ribbonMaterial: THREE.MeshBasicMaterial;
  private readonly geometries: THREE.BufferGeometry[] = [];

  private stage: PlaneStage = 1;
  private hasPropeller = false;
  private flutterTimer = 0;

  constructor(materials: CityPaletteMaterials) {
    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group();
    this.group.add(this.bodyGroup);

    // Nose points along -Z, tail at +Z
    const nose: [number, number, number] = [0, 0.02, -1.15];
    const centerTail: [number, number, number] = [0, 0.06, 0.92];
    const keelBottom: [number, number, number] = [0, -0.28, 0.65];

    const leftInnerCrease: [number, number, number] = [-0.14, 0.01, 0.88];
    const rightInnerCrease: [number, number, number] = [0.14, 0.01, 0.88];
    const leftWingTip: [number, number, number] = [-0.98, 0.14, 0.82];
    const rightWingTip: [number, number, number] = [0.98, 0.14, 0.82];

    // Stage 1: Classic Folded Paper Dart (6 distinct folded facets)
    const addFacet = (
      parent: THREE.Group,
      p1: [number, number, number],
      p2: [number, number, number],
      p3: [number, number, number],
      mat: THREE.Material,
    ) => {
      const geo = createTriangleGeometry(p1, p2, p3);
      this.geometries.push(geo);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Main outer wings
    addFacet(this.bodyGroup, nose, leftWingTip, leftInnerCrease, materials.paperMain);
    addFacet(this.bodyGroup, nose, rightInnerCrease, rightWingTip, materials.paperMain);

    // Inner valley folds
    addFacet(this.bodyGroup, nose, leftInnerCrease, centerTail, materials.paperInner);
    addFacet(this.bodyGroup, nose, centerTail, rightInnerCrease, materials.paperInner);

    // Central lower keel spine
    addFacet(this.bodyGroup, nose, keelBottom, centerTail, materials.paperInner);
    addFacet(this.bodyGroup, nose, centerTail, keelBottom, materials.paperInner);

    // Subtle crease fold accent along nose ridge
    const noseCapGeo = createTriangleGeometry([0, 0.03, -1.16], [-0.22, 0.04, -0.35], [0.22, 0.04, -0.35]);
    this.geometries.push(noseCapGeo);
    const noseCap = new THREE.Mesh(noseCapGeo, materials.paperTrimTerracotta);
    noseCap.position.y = 0.004;
    noseCap.castShadow = true;
    this.bodyGroup.add(noseCap);

    // Stage 2: Reinforced Twin-Crease Wingtip Extensions & Winglets
    this.stage2Group = new THREE.Group();
    this.stage2Group.visible = false;
    this.bodyGroup.add(this.stage2Group);

    const leftExtMid: [number, number, number] = [-0.55, 0.09, 0.05];
    const rightExtMid: [number, number, number] = [0.55, 0.09, 0.05];
    const leftExtTip: [number, number, number] = [-1.42, 0.24, 0.86];
    const rightExtTip: [number, number, number] = [1.42, 0.24, 0.86];
    const leftWingletPeak: [number, number, number] = [-1.46, 0.52, 0.92];
    const rightWingletPeak: [number, number, number] = [1.46, 0.52, 0.92];

    addFacet(this.stage2Group, leftExtMid, leftExtTip, leftWingTip, materials.paperMain);
    addFacet(this.stage2Group, rightExtMid, rightWingTip, rightExtTip, materials.paperMain);
    // Terracotta upturned winglets
    addFacet(this.stage2Group, leftExtTip, leftWingletPeak, [-1.18, 0.19, 0.45], materials.paperTrimTerracotta);
    addFacet(this.stage2Group, rightExtTip, [1.18, 0.19, 0.45], rightWingletPeak, materials.paperTrimTerracotta);

    // Stage 3: Twin Dorsal Tailfins & Rear Stabilizers
    this.stage3Group = new THREE.Group();
    this.stage3Group.visible = false;
    this.bodyGroup.add(this.stage3Group);

    addFacet(this.stage3Group, [-0.14, 0.02, 0.28], [-0.26, 0.42, 0.94], [-0.14, 0.02, 0.92], materials.paperTrimSage);
    addFacet(this.stage3Group, [0.14, 0.02, 0.28], [0.14, 0.02, 0.92], [0.26, 0.42, 0.94], materials.paperTrimSage);
    // Rear elevator trim tabs
    addFacet(this.stage3Group, [-0.14, 0.03, 0.74], [-0.55, 0.08, 1.06], [-0.14, 0.03, 1.02], materials.paperInner);
    addFacet(this.stage3Group, [0.14, 0.03, 0.74], [0.14, 0.03, 1.02], [0.55, 0.08, 1.06], materials.paperInner);

    // Always-On Light Pinwheel Propeller Assembly
    this.propellerGroup = new THREE.Group();
    this.propellerGroup.position.set(0, 0.02, -1.16);
    this.propellerGroup.visible = false;
    this.bodyGroup.add(this.propellerGroup);

    const mountPinGeo = new THREE.CylinderGeometry(0.024, 0.032, 0.14, 8);
    mountPinGeo.rotateX(Math.PI / 2);
    this.geometries.push(mountPinGeo);
    const mountPin = new THREE.Mesh(mountPinGeo, materials.propellerHub);
    mountPin.position.z = -0.05;
    this.propellerGroup.add(mountPin);

    this.propellerSpinner = new THREE.Group();
    this.propellerSpinner.position.z = -0.11;
    this.propellerGroup.add(this.propellerSpinner);

    const hubCapGeo = new THREE.ConeGeometry(0.045, 0.09, 8);
    hubCapGeo.rotateX(-Math.PI / 2);
    this.geometries.push(hubCapGeo);
    const hubCap = new THREE.Mesh(hubCapGeo, materials.propellerHub);
    hubCap.position.z = -0.03;
    this.propellerSpinner.add(hubCap);

    // 2 folded-paper pinwheel blades
    const bladeGeo = new THREE.BoxGeometry(0.46, 0.075, 0.014);
    this.geometries.push(bladeGeo);

    const bladeA = new THREE.Mesh(bladeGeo, materials.propellerBlade);
    bladeA.position.x = 0.24;
    bladeA.rotation.x = 0.34;
    this.propellerSpinner.add(bladeA);

    const bladeB = new THREE.Mesh(bladeGeo, materials.propellerBlade);
    bladeB.position.x = -0.24;
    bladeB.rotation.x = -0.34;
    this.propellerSpinner.add(bladeB);

    // Wingtip air ribbon trails
    this.ribbonMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const ribbonGeo = new THREE.PlaneGeometry(0.045, 1.4);
    ribbonGeo.rotateX(Math.PI / 2);
    ribbonGeo.translate(0, 0, 0.7);
    this.geometries.push(ribbonGeo);

    this.leftRibbon = new THREE.Mesh(ribbonGeo, this.ribbonMaterial);
    this.rightRibbon = new THREE.Mesh(ribbonGeo, this.ribbonMaterial);
    this.leftRibbon.position.set(-0.96, 0.14, 0.82);
    this.rightRibbon.position.set(0.96, 0.14, 0.82);
    this.bodyGroup.add(this.leftRibbon);
    this.bodyGroup.add(this.rightRibbon);
  }

  public setEvolution(stage: PlaneStage, hasPropeller: boolean): void {
    this.stage = stage;
    this.hasPropeller = hasPropeller;

    this.stage2Group.visible = stage >= 2;
    this.stage3Group.visible = stage >= 3;
    this.propellerGroup.visible = hasPropeller;

    const tipX = stage >= 2 ? 1.42 : 0.96;
    const tipY = stage >= 2 ? 0.24 : 0.14;
    this.leftRibbon.position.set(-tipX, tipY, 0.82);
    this.rightRibbon.position.set(tipX, tipY, 0.82);
  }

  public triggerFlutter(): void {
    this.flutterTimer = 0.55;
  }

  public update(
    dt: number,
    speed: number,
    boostRatio: number,
    elapsed: number,
    throttleRatio = 0.5,
  ): void {
    // Subtle organic air breathing bob on inner body group
    const bob = Math.sin(elapsed * 2.3) * 0.025;
    this.bodyGroup.position.y = bob;

    // Gentle paper flutter on forgiving obstacle bounce
    if (this.flutterTimer > 0) {
      this.flutterTimer = Math.max(0, this.flutterTimer - dt);
      const decay = this.flutterTimer / 0.55;
      this.bodyGroup.rotation.z = Math.sin(elapsed * 38) * 0.28 * decay;
      this.bodyGroup.rotation.x = Math.cos(elapsed * 30) * 0.14 * decay;
    } else {
      this.bodyGroup.rotation.z = THREE.MathUtils.damp(this.bodyGroup.rotation.z, 0, 10, dt);
      this.bodyGroup.rotation.x = THREE.MathUtils.damp(this.bodyGroup.rotation.x, 0, 10, dt);
    }

    // Spin always-on light propeller proportional to throttle + airspeed + boost
    if (this.hasPropeller) {
      const rpmSpeed = 6 + throttleRatio * 24 + speed * 0.65 + boostRatio * 22;
      this.propellerSpinner.rotation.z += rpmSpeed * dt;
    }

    // Wingtip ribbons stretch & glow warm gold during Spacebar boost
    const targetScaleZ = 0.75 + (speed / 25) * 0.6 + boostRatio * 1.4;
    this.leftRibbon.scale.z = THREE.MathUtils.damp(this.leftRibbon.scale.z, targetScaleZ, 8, dt);
    this.rightRibbon.scale.z = this.leftRibbon.scale.z;

    if (boostRatio > 0.05) {
      this.ribbonMaterial.color.setHex(0xffd07b);
      this.ribbonMaterial.opacity = 0.35 + boostRatio * 0.35;
    } else {
      this.ribbonMaterial.color.setHex(0xffffff);
      this.ribbonMaterial.opacity = 0.18 + Math.min(0.18, (speed - 12) * 0.012);
    }
  }

  public getStage(): PlaneStage {
    return this.stage;
  }

  public dispose(): void {
    this.geometries.forEach((g) => g.dispose());
    this.ribbonMaterial.dispose();
  }
}
