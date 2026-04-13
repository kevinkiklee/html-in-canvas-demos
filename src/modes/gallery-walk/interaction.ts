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
  dispose(): void;
}

// Reusable Vector2 for raycaster (always screen center)
const _center = new THREE.Vector2(0, 0);

export function createInteractionSystem(
  photoSlots: PhotoSlot[],
  kioskMesh: THREE.Mesh,
  infoPanelMesh: THREE.Mesh,
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
    raycaster.setFromCamera(_center, camera);
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
    dispose,
  };
}
