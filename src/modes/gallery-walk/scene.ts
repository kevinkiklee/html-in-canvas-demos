import * as THREE from 'three';

/** All dimensions in meters. 1 Three.js unit = 1 meter. */
const ROOM_W = 12;
const ROOM_D = 10;
const ROOM_H = 4;
const WALL_THICKNESS = 0.15;
const PASSAGE_W = 3;
const PASSAGE_D = 4;
const PASSAGE_H = 3.5;
const MOLDING_SIZE = 0.12;

// Material palette — classical museum
const wallMat = new THREE.MeshStandardMaterial({ color: 0x3d342b, roughness: 0.8 });
const moldingMat = new THREE.MeshStandardMaterial({ color: 0x5a4f42, roughness: 0.8 });
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d2620, roughness: 0.6 });
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.9 });
const frameMat = new THREE.MeshStandardMaterial({ color: 0xb8960c, roughness: 0.35, metalness: 0.7 });

export interface PhotoSlot {
  /** World position of the photo center */
  position: THREE.Vector3;
  /** Normal direction the photo faces (into the room) */
  normal: THREE.Vector3;
  /** Width of the photo in meters */
  width: number;
  /** Height of the photo in meters */
  height: number;
  /** The Three.js mesh for the photo plane */
  mesh: THREE.Mesh;
  /** The Three.js mesh for the frame */
  frameMesh: THREE.Mesh;
  /** SpotLight aimed at this photo */
  spotLight: THREE.SpotLight;
}

export interface GalleryScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  photoSlots: PhotoSlot[];
  /** Wall AABBs for collision detection: { min: {x,z}, max: {x,z} } */
  wallColliders: Array<{ min: { x: number; z: number }; max: { x: number; z: number } }>;
  /** World position of the kiosk top surface center */
  kioskTopCenter: THREE.Vector3;
  kioskTopMesh: THREE.Mesh;
  /** World position of the info panel center */
  infoPanelCenter: THREE.Vector3;
  infoPanelMesh: THREE.Mesh;
  /** Ticker strip meshes */
  tickerMeshes: THREE.Mesh[];
  /** Detail panel mesh (initially invisible) */
  detailPanelMesh: THREE.Mesh;
  /** All disposable Three.js objects for cleanup */
  disposables: Array<{ dispose(): void }>;
}

/** East wing X offset from origin */
export const EX_OFF = ROOM_W + PASSAGE_W;

export function createGalleryScene(aspect: number): GalleryScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0b);

  const camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 100);
  // Spawn: 1m inside entrance (south wall of west wing), facing north
  camera.position.set(0, 1.6, ROOM_D / 2 - 1);
  camera.rotation.order = 'YXZ';

  const disposables: Array<{ dispose(): void }> = [
    wallMat, moldingMat, floorMat, ceilingMat, frameMat,
  ];

  const wallColliders: GalleryScene['wallColliders'] = [];

  // --- Helper: create a wall segment ---
  function addWall(
    x: number, z: number,
    w: number, h: number, d: number,
    _rotY = 0,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, wallMat);
    mesh.position.set(x, h / 2, z);
    scene.add(mesh);
    disposables.push(geo);
    return mesh;
  }

  // --- Helper: add wall collider (AABB in XZ plane) ---
  function addCollider(cx: number, cz: number, hw: number, hd: number) {
    wallColliders.push({
      min: { x: cx - hw, z: cz - hd },
      max: { x: cx + hw, z: cz + hd },
    });
  }

  // ============================
  // WEST WING (centered at x=0)
  // ============================
  const wxCenter = 0;
  const wzCenter = 0;

  // North wall (full width)
  addWall(wxCenter, wzCenter - ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter, wzCenter - ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // South wall (split for entrance: left segment + right segment, 4m gap center)
  const entranceW = 4;
  const southSegW = (ROOM_W - entranceW) / 2;
  // Left segment
  addWall(wxCenter - ROOM_W / 2 + southSegW / 2, wzCenter + ROOM_D / 2, southSegW, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter - ROOM_W / 2 + southSegW / 2, wzCenter + ROOM_D / 2, southSegW / 2, WALL_THICKNESS / 2);
  // Right segment
  addWall(wxCenter + ROOM_W / 2 - southSegW / 2, wzCenter + ROOM_D / 2, southSegW, ROOM_H, WALL_THICKNESS);
  addCollider(wxCenter + ROOM_W / 2 - southSegW / 2, wzCenter + ROOM_D / 2, southSegW / 2, WALL_THICKNESS / 2);

  // West wall (full height)
  addWall(wxCenter - ROOM_W / 2, wzCenter, WALL_THICKNESS, ROOM_H, ROOM_D);
  addCollider(wxCenter - ROOM_W / 2, wzCenter, WALL_THICKNESS / 2, ROOM_D / 2);

  // East wall (split for passage: top segment + bottom segment)
  const passageZStart = -PASSAGE_D / 2;
  const passageZEnd = PASSAGE_D / 2;
  const topSegD = ROOM_D / 2 + passageZStart; // from north wall to passage
  const botSegD = ROOM_D / 2 - passageZEnd;   // from passage to south wall
  // Top segment (north side of passage)
  addWall(wxCenter + ROOM_W / 2, wzCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS, ROOM_H, topSegD);
  addCollider(wxCenter + ROOM_W / 2, wzCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS / 2, topSegD / 2);
  // Bottom segment (south side of passage)
  addWall(wxCenter + ROOM_W / 2, wzCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS, ROOM_H, botSegD);
  addCollider(wxCenter + ROOM_W / 2, wzCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS / 2, botSegD / 2);

  // =============================
  // EAST WING (centered at x = ROOM_W + PASSAGE_W)
  // =============================
  const exOff = EX_OFF;
  const ezCenter = 0;

  // North wall
  addWall(exOff, ezCenter - ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(exOff, ezCenter - ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // South wall (full)
  addWall(exOff, ezCenter + ROOM_D / 2, ROOM_W, ROOM_H, WALL_THICKNESS);
  addCollider(exOff, ezCenter + ROOM_D / 2, ROOM_W / 2, WALL_THICKNESS / 2);

  // East wall (full)
  addWall(exOff + ROOM_W / 2, ezCenter, WALL_THICKNESS, ROOM_H, ROOM_D);
  addCollider(exOff + ROOM_W / 2, ezCenter, WALL_THICKNESS / 2, ROOM_D / 2);

  // West wall (split for passage, mirrors west wing east wall)
  addWall(exOff - ROOM_W / 2, ezCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS, ROOM_H, topSegD);
  addCollider(exOff - ROOM_W / 2, ezCenter - ROOM_D / 2 + topSegD / 2, WALL_THICKNESS / 2, topSegD / 2);
  addWall(exOff - ROOM_W / 2, ezCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS, ROOM_H, botSegD);
  addCollider(exOff - ROOM_W / 2, ezCenter + ROOM_D / 2 - botSegD / 2, WALL_THICKNESS / 2, botSegD / 2);

  // ============================
  // PASSAGE WALLS (north and south sides)
  // ============================
  const passXStart = ROOM_W / 2 + WALL_THICKNESS / 2;
  const passXEnd = exOff - ROOM_W / 2 - WALL_THICKNESS / 2;
  const passWidth = passXEnd - passXStart;
  const passCenterX = (passXStart + passXEnd) / 2;

  // North passage wall
  addWall(passCenterX, -PASSAGE_D / 2, passWidth, ROOM_H, WALL_THICKNESS);
  addCollider(passCenterX, -PASSAGE_D / 2, passWidth / 2, WALL_THICKNESS / 2);

  // South passage wall
  addWall(passCenterX, PASSAGE_D / 2, passWidth, ROOM_H, WALL_THICKNESS);
  addCollider(passCenterX, PASSAGE_D / 2, passWidth / 2, WALL_THICKNESS / 2);

  // ============================
  // FLOORS & CEILINGS
  // ============================
  // West wing floor
  const floorGeoW = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const floorW = new THREE.Mesh(floorGeoW, floorMat);
  floorW.rotation.x = -Math.PI / 2;
  floorW.position.set(wxCenter, 0, wzCenter);
  scene.add(floorW);
  disposables.push(floorGeoW);

  // East wing floor
  const floorGeoE = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const floorE = new THREE.Mesh(floorGeoE, floorMat);
  floorE.rotation.x = -Math.PI / 2;
  floorE.position.set(exOff, 0, ezCenter);
  scene.add(floorE);
  disposables.push(floorGeoE);

  // Passage floor
  const passFloorGeo = new THREE.PlaneGeometry(PASSAGE_W, PASSAGE_D);
  const passFloor = new THREE.Mesh(passFloorGeo, floorMat);
  passFloor.rotation.x = -Math.PI / 2;
  passFloor.position.set(ROOM_W / 2 + PASSAGE_W / 2, 0, 0);
  scene.add(passFloor);
  disposables.push(passFloorGeo);

  // West wing ceiling
  const ceilGeoW = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const ceilW = new THREE.Mesh(ceilGeoW, ceilingMat);
  ceilW.rotation.x = Math.PI / 2;
  ceilW.position.set(wxCenter, ROOM_H, wzCenter);
  scene.add(ceilW);
  disposables.push(ceilGeoW);

  // East wing ceiling
  const ceilGeoE = new THREE.PlaneGeometry(ROOM_W, ROOM_D);
  const ceilE = new THREE.Mesh(ceilGeoE, ceilingMat);
  ceilE.rotation.x = Math.PI / 2;
  ceilE.position.set(exOff, ROOM_H, ezCenter);
  scene.add(ceilE);
  disposables.push(ceilGeoE);

  // Passage ceiling (lower)
  const passCeilGeo = new THREE.PlaneGeometry(PASSAGE_W, PASSAGE_D);
  const passCeil = new THREE.Mesh(passCeilGeo, ceilingMat);
  passCeil.rotation.x = Math.PI / 2;
  passCeil.position.set(ROOM_W / 2 + PASSAGE_W / 2, PASSAGE_H, 0);
  scene.add(passCeil);
  disposables.push(passCeilGeo);

  // ============================
  // LIGHTING
  // ============================
  const ambient = new THREE.AmbientLight(0x2a2018, 0.15);
  scene.add(ambient);

  // Passage point light
  const passLight = new THREE.PointLight(0xfff0d0, 0.5, 15);
  passLight.position.set(ROOM_W / 2 + PASSAGE_W / 2, PASSAGE_H - 0.3, 0);
  scene.add(passLight);

  // ============================
  // PHOTO SLOTS
  // ============================
  const photoSlots: PhotoSlot[] = [];

  // Photo placement helper
  function addPhotoSlot(
    cx: number, cy: number, cz: number,
    normalX: number, normalZ: number,
    width: number, height: number,
  ): PhotoSlot {
    const normal = new THREE.Vector3(normalX, 0, normalZ);

    // Photo plane — recessed 0.02m into frame
    const photoGeo = new THREE.PlaneGeometry(width, height);
    const photoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      emissive: new THREE.Color(0x0a0808),
      emissiveIntensity: 0.1,
    });
    const photoMesh = new THREE.Mesh(photoGeo, photoMat);
    photoMesh.position.set(cx + normalX * 0.02, cy, cz + normalZ * 0.02);
    photoMesh.lookAt(cx + normalX, cy, cz + normalZ);
    scene.add(photoMesh);
    disposables.push(photoGeo, photoMat);

    // Frame — extruded rectangle around photo
    const border = 0.08;
    const frameW = width + border * 2;
    const frameH = height + border * 2;
    const frameDepth = 0.04;
    const frameGeo = new THREE.BoxGeometry(frameW, frameH, frameDepth);
    const frameMeshObj = new THREE.Mesh(frameGeo, frameMat);
    frameMeshObj.position.set(cx, cy, cz);
    frameMeshObj.lookAt(cx + normalX, cy, cz + normalZ);
    scene.add(frameMeshObj);
    disposables.push(frameGeo);

    // SpotLight aimed at photo
    const spot = new THREE.SpotLight(0xfff0d0, 2.0, 8, Math.PI / 6, 0.5);
    spot.position.set(cx, ROOM_H - 0.5, cz + normalZ * 0.5);
    spot.target = photoMesh;
    spot.castShadow = false;
    scene.add(spot);
    scene.add(spot.target);

    const slot: PhotoSlot = {
      position: new THREE.Vector3(cx, cy, cz),
      normal,
      width,
      height,
      mesh: photoMesh,
      frameMesh: frameMeshObj,
      spotLight: spot,
    };
    photoSlots.push(slot);
    return slot;
  }

  // Photo height center = 1.5m (eye level)
  const photoY = 1.5;

  // --- West Wing photos ---
  // North wall: 3 photos
  const wnWallZ = wzCenter - ROOM_D / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(-3, photoY, wnWallZ, 0, 1, 1.5, 1.0);  // hero
  addPhotoSlot(0, photoY, wnWallZ, 0, 1, 0.9, 0.7);
  addPhotoSlot(3, photoY, wnWallZ, 0, 1, 0.8, 1.0);

  // South wall: 2 photos (entrance takes center space)
  const wsWallZ = wzCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(-4.5, photoY, wsWallZ, 0, -1, 0.9, 0.7);
  addPhotoSlot(4.5, photoY, wsWallZ, 0, -1, 0.8, 0.6);

  // West wall: 2 photos
  const wwWallX = wxCenter - ROOM_W / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(wwWallX, photoY, -2.5, 1, 0, 1.0, 0.8);
  addPhotoSlot(wwWallX, photoY, 2.5, 1, 0, 0.8, 1.0);

  // East wall (segments above/below passage): 2 photos
  const weWallX = wxCenter + ROOM_W / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(weWallX, photoY, -3.5, -1, 0, 0.8, 0.6);
  addPhotoSlot(weWallX, photoY, 3.5, -1, 0, 0.9, 0.7);

  // --- East Wing photos ---
  // North wall: 3 photos
  const enWallZ = ezCenter - ROOM_D / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(exOff - 3, photoY, enWallZ, 0, 1, 0.8, 1.0);
  addPhotoSlot(exOff, photoY, enWallZ, 0, 1, 1.5, 1.0);  // hero
  addPhotoSlot(exOff + 3, photoY, enWallZ, 0, 1, 0.9, 0.7);

  // South wall: 3 photos
  const esWallZ = ezCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(exOff - 3, photoY, esWallZ, 0, -1, 0.9, 0.7);
  addPhotoSlot(exOff, photoY, esWallZ, 0, -1, 1.0, 0.8);
  addPhotoSlot(exOff + 3, photoY, esWallZ, 0, -1, 0.8, 0.6);

  // East wall: 2 photos
  const eeWallX = exOff + ROOM_W / 2 - WALL_THICKNESS / 2;
  addPhotoSlot(eeWallX, photoY, -2.5, -1, 0, 1.0, 0.8);
  addPhotoSlot(eeWallX, photoY, 2.5, -1, 0, 0.8, 1.0);

  // --- Passage photos: 1 per side ---
  const passLeftX = ROOM_W / 2 - WALL_THICKNESS / 2;
  const passRightX = exOff - ROOM_W / 2 + WALL_THICKNESS / 2;
  addPhotoSlot(passLeftX, photoY, 0, 1, 0, 0.6, 0.9);
  addPhotoSlot(passRightX, photoY, 0, -1, 0, 0.6, 0.9);

  // ============================
  // KIOSK
  // ============================
  // Pedestal in west wing center
  const kioskBaseGeo = new THREE.BoxGeometry(0.8, 1.0, 0.5);
  const kioskBase = new THREE.Mesh(kioskBaseGeo, wallMat);
  kioskBase.position.set(0, 0.5, 0);
  scene.add(kioskBase);
  disposables.push(kioskBaseGeo);
  addCollider(0, 0, 0.5, 0.35); // prevent walking through kiosk

  // Angled top surface
  const kioskTopGeo = new THREE.PlaneGeometry(0.7, 0.5);
  const kioskTopMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const kioskTopMesh = new THREE.Mesh(kioskTopGeo, kioskTopMat);
  kioskTopMesh.position.set(0, 1.05, -0.05);
  kioskTopMesh.rotation.x = -Math.PI / 6; // 30 degrees
  scene.add(kioskTopMesh);
  disposables.push(kioskTopGeo, kioskTopMat);

  // Kiosk spotlight
  const kioskSpot = new THREE.SpotLight(0xfff0d0, 1.5, 6, Math.PI / 5, 0.5);
  kioskSpot.position.set(0, ROOM_H - 0.5, 0);
  kioskSpot.target = kioskTopMesh;
  scene.add(kioskSpot);
  scene.add(kioskSpot.target);

  // ============================
  // BENCH (East Wing center)
  // ============================
  const benchGeo = new THREE.BoxGeometry(1.5, 0.45, 0.5);
  const bench = new THREE.Mesh(benchGeo, wallMat);
  bench.position.set(exOff, 0.225, 0);
  scene.add(bench);
  disposables.push(benchGeo);
  addCollider(exOff, 0, 0.85, 0.35);

  // ============================
  // INFO PANEL
  // ============================
  const infoPanelGeo = new THREE.PlaneGeometry(1.5, 1.2);
  const infoPanelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  // South wall, left of entrance
  const infoPanelX = wxCenter - ROOM_W / 2 + southSegW / 2;
  const infoPanelZ = wzCenter + ROOM_D / 2 - WALL_THICKNESS / 2;
  const infoPanelMesh = new THREE.Mesh(infoPanelGeo, infoPanelMat);
  infoPanelMesh.position.set(infoPanelX, 1.5, infoPanelZ);
  infoPanelMesh.rotation.y = Math.PI; // face into room (south wall faces north)
  scene.add(infoPanelMesh);
  disposables.push(infoPanelGeo, infoPanelMat);

  // Info panel spotlight
  const infoSpot = new THREE.SpotLight(0xfff0d0, 1.5, 6, Math.PI / 5, 0.5);
  infoSpot.position.set(infoPanelX, ROOM_H - 0.5, infoPanelZ - 0.5);
  infoSpot.target = infoPanelMesh;
  scene.add(infoSpot);
  scene.add(infoSpot.target);

  // ============================
  // TICKER STRIPS
  // ============================
  const tickerMeshes: THREE.Mesh[] = [];
  const tickerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  disposables.push(tickerMat);

  // West wing — north wall, below crown molding
  const tickerGeoW = new THREE.PlaneGeometry(ROOM_W - 0.5, 0.2);
  const tickerW = new THREE.Mesh(tickerGeoW, tickerMat);
  tickerW.position.set(wxCenter, ROOM_H - MOLDING_SIZE - 0.15, wzCenter - ROOM_D / 2 + WALL_THICKNESS / 2 + 0.01);
  scene.add(tickerW);
  tickerMeshes.push(tickerW);
  disposables.push(tickerGeoW);

  // East wing — north wall
  const tickerGeoE = new THREE.PlaneGeometry(ROOM_W - 0.5, 0.2);
  const tickerE = new THREE.Mesh(tickerGeoE, tickerMat);
  tickerE.position.set(exOff, ROOM_H - MOLDING_SIZE - 0.15, ezCenter - ROOM_D / 2 + WALL_THICKNESS / 2 + 0.01);
  scene.add(tickerE);
  tickerMeshes.push(tickerE);
  disposables.push(tickerGeoE);

  // ============================
  // DETAIL PANEL (initially hidden)
  // ============================
  const detailGeo = new THREE.PlaneGeometry(2.0, 1.5);
  const detailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, visible: false });
  const detailPanelMesh = new THREE.Mesh(detailGeo, detailMat);
  detailPanelMesh.visible = false;
  scene.add(detailPanelMesh);
  disposables.push(detailGeo, detailMat);

  return {
    scene,
    camera,
    photoSlots,
    wallColliders,
    kioskTopCenter: new THREE.Vector3(0, 1.05, -0.05),
    kioskTopMesh,
    infoPanelCenter: new THREE.Vector3(infoPanelX, 1.5, infoPanelZ),
    infoPanelMesh,
    tickerMeshes,
    detailPanelMesh,
    disposables,
  };
}
