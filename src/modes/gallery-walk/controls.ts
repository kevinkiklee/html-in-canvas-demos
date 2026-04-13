import * as THREE from 'three';

const MOVE_SPEED = 3.0;
const SPRINT_SPEED = 5.0;
const PLAYER_RADIUS = 0.3;
const MOUSE_SENSITIVITY = 0.002;
const PITCH_LIMIT = (80 * Math.PI) / 180; // ±80 degrees

interface Collider {
  min: { x: number; z: number };
  max: { x: number; z: number };
}

export interface Controls {
  update(dt: number): void;
  lockPointer(): void;
  unlockPointer(): void;
  isLocked(): boolean;
  onKeydown(e: KeyboardEvent): void;
  onKeyup(e: KeyboardEvent): void;
  onMouseMove(e: MouseEvent): void;
  dispose(): void;
}

export function createControls(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  colliders: Collider[],
): Controls {
  const keys = new Set<string>();
  let yaw = 0;    // horizontal rotation (radians)
  let pitch = 0;  // vertical rotation (radians)
  let locked = false;

  const onLockChange = () => {
    locked = document.pointerLockElement === canvas;
  };
  document.addEventListener('pointerlockchange', onLockChange);

  function lockPointer() {
    canvas.requestPointerLock();
  }

  function unlockPointer() {
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function isLocked() {
    return locked;
  }

  function onKeydown(e: KeyboardEvent) {
    keys.add(e.code);
  }

  function onKeyup(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  function onMouseMove(e: MouseEvent) {
    if (!locked) return;
    yaw -= e.movementX * MOUSE_SENSITIVITY;
    pitch -= e.movementY * MOUSE_SENSITIVITY;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
  }

  function checkCollision(x: number, z: number): boolean {
    for (const c of colliders) {
      // Expand AABB by player radius
      if (
        x + PLAYER_RADIUS > c.min.x &&
        x - PLAYER_RADIUS < c.max.x &&
        z + PLAYER_RADIUS > c.min.z &&
        z - PLAYER_RADIUS < c.max.z
      ) {
        return true;
      }
    }
    return false;
  }

  function update(dt: number) {
    if (!locked) return;

    // Apply rotation
    camera.rotation.set(pitch, yaw, 0, 'YXZ');

    // Movement direction in XZ plane
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : MOVE_SPEED;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    );
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
    );

    let dx = 0;
    let dz = 0;
    if (keys.has('KeyW')) { dx += forward.x; dz += forward.z; }
    if (keys.has('KeyS')) { dx -= forward.x; dz -= forward.z; }
    if (keys.has('KeyD')) { dx += right.x; dz += right.z; }
    if (keys.has('KeyA')) { dx -= right.x; dz -= right.z; }

    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      const newX = camera.position.x + dx;
      const newZ = camera.position.z + dz;

      // Try full movement, then slide along axes
      if (!checkCollision(newX, newZ)) {
        camera.position.x = newX;
        camera.position.z = newZ;
      } else if (!checkCollision(newX, camera.position.z)) {
        camera.position.x = newX;
      } else if (!checkCollision(camera.position.x, newZ)) {
        camera.position.z = newZ;
      }
      // else: stuck in corner, don't move
    }
  }

  function dispose() {
    document.removeEventListener('pointerlockchange', onLockChange);
    keys.clear();
  }

  return { update, lockPointer, unlockPointer, isLocked, onKeydown, onKeyup, onMouseMove, dispose };
}
