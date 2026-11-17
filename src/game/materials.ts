import * as THREE from 'three';

export interface CityPaletteMaterials {
  paperMain: THREE.MeshStandardMaterial;
  paperInner: THREE.MeshStandardMaterial;
  paperTrimTerracotta: THREE.MeshStandardMaterial;
  paperTrimSage: THREE.MeshStandardMaterial;
  propellerHub: THREE.MeshStandardMaterial;
  propellerBlade: THREE.MeshStandardMaterial;

  ground: THREE.MeshStandardMaterial;
  road: THREE.MeshStandardMaterial;
  sidewalk: THREE.MeshStandardMaterial;
  roadStripe: THREE.MeshStandardMaterial;

  buildingWalls: THREE.MeshStandardMaterial[];
  buildingTrim: THREE.MeshStandardMaterial;
  buildingWindows: THREE.MeshStandardMaterial;
  rooftopAccent: THREE.MeshStandardMaterial;

  houseWalls: THREE.MeshStandardMaterial[];
  houseRoofs: THREE.MeshStandardMaterial[];
  housePorch: THREE.MeshStandardMaterial;

  treeTrunk: THREE.MeshStandardMaterial;
  treeFoliage: THREE.MeshStandardMaterial;

  poleMetal: THREE.MeshStandardMaterial;
  poleLantern: THREE.MeshStandardMaterial;

  windRibbon: THREE.MeshBasicMaterial;
  thermalRing: THREE.MeshStandardMaterial;

  paperTexture: THREE.CanvasTexture;
  paperBumpTexture: THREE.CanvasTexture;
  dispose: () => void;
}

function createPaperTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  aCtx.fillStyle = '#faf7f0';
  aCtx.fillRect(0, 0, size, size);

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle organic paper fibers
  for (let i = 0; i < 1800; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    const shade = Math.random() > 0.5 ? 'rgba(225,218,204,0.35)' : 'rgba(255,255,255,0.45)';
    aCtx.strokeStyle = shade;
    aCtx.lineWidth = 0.8;
    aCtx.beginPath();
    aCtx.moveTo(x, y);
    aCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    aCtx.stroke();

    const bVal = 116 + Math.floor(Math.random() * 26);
    bCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.lineWidth = 1;
    bCtx.beginPath();
    bCtx.moveTo(x, y);
    bCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    bCtx.stroke();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = maxAnisotropy;

  return { albedo, bump };
}

export function createCityPaletteMaterials(renderer: THREE.WebGLRenderer): CityPaletteMaterials {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const { albedo: paperTexture, bump: paperBumpTexture } = createPaperTextures(maxAniso);

  const paperMain = new THREE.MeshStandardMaterial({
    color: 0xfbf8f1,
    map: paperTexture,
    bumpMap: paperBumpTexture,
    bumpScale: 0.015,
    roughness: 0.84,
    metalness: 0.02,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const paperInner = new THREE.MeshStandardMaterial({
    color: 0xeae2d2,
    map: paperTexture,
    bumpMap: paperBumpTexture,
    bumpScale: 0.012,
    roughness: 0.88,
    metalness: 0.02,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const paperTrimTerracotta = new THREE.MeshStandardMaterial({
    color: 0xd97a54,
    bumpMap: paperBumpTexture,
    bumpScale: 0.015,
    roughness: 0.78,
    metalness: 0.05,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const paperTrimSage = new THREE.MeshStandardMaterial({
    color: 0x6f9e8b,
    bumpMap: paperBumpTexture,
    bumpScale: 0.015,
    roughness: 0.78,
    metalness: 0.05,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const propellerHub = new THREE.MeshStandardMaterial({
    color: 0xc99c62,
    roughness: 0.32,
    metalness: 0.72,
  });

  const propellerBlade = new THREE.MeshStandardMaterial({
    color: 0xf4c370,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const ground = new THREE.MeshStandardMaterial({
    color: 0xd2dcc8,
    roughness: 0.94,
    metalness: 0.0,
  });

  const road = new THREE.MeshStandardMaterial({
    color: 0x697380,
    roughness: 0.88,
    metalness: 0.04,
  });

  const sidewalk = new THREE.MeshStandardMaterial({
    color: 0xd9d5ca,
    roughness: 0.86,
    metalness: 0.02,
  });

  const roadStripe = new THREE.MeshStandardMaterial({
    color: 0xf2ede2,
    roughness: 0.75,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const buildingWalls = [
    new THREE.MeshStandardMaterial({ color: 0xebe6db, roughness: 0.84, metalness: 0.03 }),
    new THREE.MeshStandardMaterial({ color: 0xdce3e8, roughness: 0.82, metalness: 0.04 }),
    new THREE.MeshStandardMaterial({ color: 0xe6dcd2, roughness: 0.85, metalness: 0.02 }),
    new THREE.MeshStandardMaterial({ color: 0xd4ddd8, roughness: 0.83, metalness: 0.03 }),
  ];

  const buildingTrim = new THREE.MeshStandardMaterial({
    color: 0x9aa4ae,
    roughness: 0.56,
    metalness: 0.25,
  });

  const buildingWindows = new THREE.MeshStandardMaterial({
    color: 0x6d8499,
    emissive: new THREE.Color(0xffc978),
    emissiveIntensity: 0.05,
    roughness: 0.22,
    metalness: 0.35,
  });

  const rooftopAccent = new THREE.MeshStandardMaterial({
    color: 0xb6bec6,
    roughness: 0.45,
    metalness: 0.4,
  });

  const houseWalls = [
    new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.88, metalness: 0.01 }),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.88, metalness: 0.01 }),
    new THREE.MeshStandardMaterial({ color: 0xdfe7e5, roughness: 0.86, metalness: 0.01 }),
  ];

  const houseRoofs = [
    new THREE.MeshStandardMaterial({ color: 0xc97b63, roughness: 0.78, metalness: 0.04, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x6a7d8f, roughness: 0.78, metalness: 0.05, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: 0x829980, roughness: 0.8, metalness: 0.03, flatShading: true }),
  ];

  const housePorch = new THREE.MeshStandardMaterial({
    color: 0xc2b29b,
    roughness: 0.85,
    metalness: 0.02,
  });

  const treeTrunk = new THREE.MeshStandardMaterial({
    color: 0x8a6d56,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
  });

  // Base white so per-instance setColorAt tints cleanly
  const treeFoliage = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.0,
    flatShading: true,
  });

  const poleMetal = new THREE.MeshStandardMaterial({
    color: 0x5c6773,
    roughness: 0.38,
    metalness: 0.65,
  });

  const poleLantern = new THREE.MeshStandardMaterial({
    color: 0xfff3d1,
    emissive: new THREE.Color(0xffc76b),
    emissiveIntensity: 0.15,
    roughness: 0.2,
    metalness: 0.1,
  });

  const windRibbon = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const thermalRing = new THREE.MeshStandardMaterial({
    color: 0xf7cf72,
    emissive: new THREE.Color(0xf2a74b),
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.35,
    flatShading: true,
  });

  const allMaterials: THREE.Material[] = [
    paperMain,
    paperInner,
    paperTrimTerracotta,
    paperTrimSage,
    propellerHub,
    propellerBlade,
    ground,
    road,
    sidewalk,
    roadStripe,
    ...buildingWalls,
    buildingTrim,
    buildingWindows,
    rooftopAccent,
    ...houseWalls,
    ...houseRoofs,
    housePorch,
    treeTrunk,
    treeFoliage,
    poleMetal,
    poleLantern,
    windRibbon,
    thermalRing,
  ];

  return {
    paperMain,
    paperInner,
    paperTrimTerracotta,
    paperTrimSage,
    propellerHub,
    propellerBlade,
    ground,
    road,
    sidewalk,
    roadStripe,
    buildingWalls,
    buildingTrim,
    buildingWindows,
    rooftopAccent,
    houseWalls,
    houseRoofs,
    housePorch,
    treeTrunk,
    treeFoliage,
    poleMetal,
    poleLantern,
    windRibbon,
    thermalRing,
    paperTexture,
    paperBumpTexture,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      paperTexture.dispose();
      paperBumpTexture.dispose();
    },
  };
}
