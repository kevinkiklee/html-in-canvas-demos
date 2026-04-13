import * as THREE from 'three';
import type { PhotoSlot } from './scene';

export type InteractionState = 'walking' | 'detail' | 'kiosk' | 'info';

export interface InteractionTarget {
  type: 'photo' | 'kiosk' | 'info';
  index?: number; // photo index
  distance: number;
}

export interface InteractionSystem {
  state: InteractionState;
  /** Current target the crosshair is on (or null) */
  target: InteractionTarget | null;
  /** Run proximity + raycaster checks (throttled externally) */
  update(camera: THREE.PerspectiveCamera): void;
  /** Handle E key press */
  interact(): InteractionTarget | null;
  /** Dismiss current interaction */
  dismiss(): void;
  /** Get photo indices within proximity for plaque reveal */
  getProximityPhotos(camera: THREE.PerspectiveCamera, radius: number): Set<number>;
  /** Project a mesh to screen coords for CSS passthrough */
  projectToScreen(
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null;
  dispose(): void;
}

export function createInteractionSystem(
  photoSlots: PhotoSlot[],
  kioskMesh: THREE.Mesh,
  _kioskCenter: THREE.Vector3,
  infoPanelMesh: THREE.Mesh,
  _infoPanelCenter: THREE.Vector3,
): InteractionSystem {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 5;

  // Build list of interactable meshes
  const photoMeshes = photoSlots.map(s => s.frameMesh);
  const allTargets = [...photoMeshes, kioskMesh, infoPanelMesh];

  let state: InteractionState = 'walking';
  let target: InteractionTarget | null = null;

  function update(camera: THREE.PerspectiveCamera) {
    if (state !== 'walking') return;

    // Cast ray from camera center
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(allTargets, false);

    target = null;
    if (hits.length > 0) {
      const hit = hits[0];
      const obj = hit.object;
      const dist = hit.distance;

      const photoIdx = photoMeshes.indexOf(obj as THREE.Mesh);
      if (photoIdx >= 0 && dist <= 3) {
        target = { type: 'photo', index: photoIdx, distance: dist };
      } else if (obj === kioskMesh && dist <= 2) {
        target = { type: 'kiosk', distance: dist };
      } else if (obj === infoPanelMesh && dist <= 2) {
        target = { type: 'info', distance: dist };
      }
    }
  }

  function interact(): InteractionTarget | null {
    if (state !== 'walking' || !target) return null;
    if (target.type === 'photo') {
      state = 'detail';
    } else if (target.type === 'kiosk') {
      state = 'kiosk';
    } else if (target.type === 'info') {
      state = 'info';
    }
    return target;
  }

  function dismiss() {
    state = 'walking';
    target = null;
  }

  function getProximityPhotos(camera: THREE.PerspectiveCamera, radius: number): Set<number> {
    const near = new Set<number>();
    const camPos = camera.position;
    for (let i = 0; i < photoSlots.length; i++) {
      const dist = camPos.distanceTo(photoSlots[i].position);
      if (dist <= radius) {
        near.add(i);
      }
    }
    return near;
  }

  function projectToScreen(
    mesh: THREE.Mesh,
    camera: THREE.PerspectiveCamera,
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number; scaleX: number; scaleY: number } | null {
    // Get mesh world position
    const pos = new THREE.Vector3();
    mesh.getWorldPosition(pos);

    // Project to NDC
    const ndc = pos.clone().project(camera);
    if (ndc.z < 0 || ndc.z > 1) return null; // behind camera or too far

    // NDC to screen
    const x = (ndc.x * 0.5 + 0.5) * canvasWidth;
    const y = (-ndc.y * 0.5 + 0.5) * canvasHeight;

    // Approximate scale from mesh size and camera distance
    const dist = camera.position.distanceTo(pos);
    if (dist < 0.1) return null;

    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const meshW = box.max.x - box.min.x;
    const meshH = box.max.y - box.min.y;

    // Pixels per meter at this distance (approximate)
    const vFov = camera.fov * (Math.PI / 180);
    const pixelsPerMeter = canvasHeight / (2 * dist * Math.tan(vFov / 2));

    const screenW = meshW * pixelsPerMeter;
    const screenH = meshH * pixelsPerMeter;

    return {
      x: x - screenW / 2,
      y: y - screenH / 2,
      scaleX: screenW / canvasWidth,
      scaleY: screenH / canvasHeight,
    };
  }

  function dispose() {
    // No persistent resources to clean
  }

  return {
    get state() { return state; },
    set state(s) { state = s; },
    get target() { return target; },
    update,
    interact,
    dismiss,
    getProximityPhotos,
    projectToScreen,
    dispose,
  };
}
