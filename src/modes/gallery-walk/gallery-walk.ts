import * as THREE from 'three';
import type { ModeImpl, ModeContext } from '../../types';
import { createGalleryScene } from './scene';
import { createControls } from './controls';
import { createHiCBridge } from './hic-bridge';
import { createInteractionSystem } from './interaction';
import { createKioskDom } from './kiosk';
import { createTickerDom } from './ticker';
import './gallery-walk.css';

const PLAQUE_RADIUS = 3;
const LOD_RADIUS = 15;
const PROXIMITY_INTERVAL = 200;
const RAYCASTER_INTERVAL = 100;
const KIOSK_UPDATE_INTERVAL = 500;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function createGalleryWalk(ctx: ModeContext): ModeImpl {
  const { gl, canvas, photos: allPhotos, size, dpr, requestDraw, setAnimating } = ctx;

  // Randomize and select 18 photos (re-shuffle on each mode entry)
  const photos = shuffle(allPhotos).slice(0, 18);

  // --- Three.js setup ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.autoClear = true;
  renderer.setPixelRatio(dpr);
  renderer.setSize(size.w, size.h, false);

  const gallery = createGalleryScene(size.w / size.h);

  // --- Controls ---
  const controls = createControls(gallery.camera, canvas, gallery.wallColliders);

  // --- HiC Bridge ---
  const hic = createHiCBridge(gl, renderer, canvas, photos, requestDraw);

  // Bind photo textures to scene materials
  for (let i = 0; i < photos.length && i < gallery.photoSlots.length; i++) {
    const slot = gallery.photoSlots[i];
    hic.bindToMaterial(`photo-${i}`, slot.mesh.material as THREE.MeshStandardMaterial);
  }

  // --- Kiosk ---
  const kiosk = createKioskDom(canvas);
  // Register kiosk DOM with HiC bridge
  {
    const gltex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, gltex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
    const threeTex = new THREE.Texture();
    threeTex.isRenderTargetTexture = true;
    threeTex.colorSpace = THREE.SRGBColorSpace;
    threeTex.flipY = false;
    (renderer.properties.get(threeTex) as any).__webglTexture = gltex;
    hic.entries.set('kiosk', {
      id: 'kiosk', dom: kiosk.dom, glTexture: gltex,
      threeTexture: threeTex, lastUploadTime: 0, uploadThrottleMs: 0,
    });
    (gallery.kioskTopMesh.material as THREE.MeshStandardMaterial).map = threeTex;
    (gallery.kioskTopMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
  }

  // --- Ticker ---
  const ticker = createTickerDom(canvas, photos);
  function registerTickerEntry(id: string, dom: HTMLElement, mesh: THREE.Mesh) {
    const gltex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, gltex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]));
    const threeTex = new THREE.Texture();
    threeTex.isRenderTargetTexture = true;
    threeTex.colorSpace = THREE.SRGBColorSpace;
    threeTex.flipY = false;
    (renderer.properties.get(threeTex) as any).__webglTexture = gltex;
    hic.entries.set(id, {
      id, dom, glTexture: gltex, threeTexture: threeTex,
      lastUploadTime: 0, uploadThrottleMs: 100,
    });
    (mesh.material as THREE.MeshBasicMaterial).map = threeTex;
    (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }
  registerTickerEntry('ticker-west', ticker.westDom, gallery.tickerMeshes[0]);
  registerTickerEntry('ticker-east', ticker.eastDom, gallery.tickerMeshes[1]);

  // Bind info panel texture
  hic.bindToMaterial('info-panel', gallery.infoPanelMesh.material as THREE.MeshStandardMaterial);

  // Bind detail panel texture
  hic.bindToMaterial('detail', gallery.detailPanelMesh.material as THREE.MeshBasicMaterial);

  // --- Interaction system ---
  const interaction = createInteractionSystem(
    gallery.photoSlots,
    gallery.kioskTopMesh,
    gallery.kioskTopCenter,
    gallery.infoPanelMesh,
    gallery.infoPanelCenter,
  );

  // --- UI overlays (outside layoutsubtree) ---
  const crosshair = document.createElement('div');
  crosshair.className = 'gallery-crosshair';
  document.body.appendChild(crosshair);

  const prompt = document.createElement('div');
  prompt.className = 'gallery-prompt';
  prompt.style.display = 'none';
  document.body.appendChild(prompt);

  const enterOverlay = document.createElement('div');
  enterOverlay.className = 'gallery-enter-overlay';
  enterOverlay.innerHTML = '<h2>Gallery Walk</h2><p>Click to explore \u00B7 WASD to move \u00B7 Mouse to look</p><p style="margin-top:0.5rem;font-size:0.75rem;color:#5a5650;">Requires keyboard and mouse</p>';
  document.body.appendChild(enterOverlay);

  let started = false;
  enterOverlay.addEventListener('click', () => {
    if (started) return;
    started = true;
    enterOverlay.remove();
    controls.lockPointer();
    setAnimating(true);
  });

  // --- Register paint callback ---
  ctx.setModePaint(hic.paintCallback);
  canvas.requestPaint?.();

  // --- Throttle timers ---
  let lastProximityCheck = 0;
  let lastRaycastCheck = 0;
  let lastKioskUpdate = 0;
  const visiblePlaques = new Set<number>();

  // --- Staggered load tracking ---
  let loadRadius = 5; // Start uploading photos within 5m
  const maxLoadRadius = LOD_RADIUS;

  // --- Track mode active state for event guard ---
  let destroyed = false;

  // --- Interaction helpers ---
  function enterInteraction(type: 'photo' | 'kiosk' | 'info', photoIndex?: number) {
    controls.unlockPointer();
    crosshair.style.display = 'none';
    prompt.style.display = 'none';

    if (type === 'photo' && photoIndex != null) {
      hic.setDetailPhoto(photos[photoIndex]);
      const detailDom = hic.getDetailDom();
      detailDom.style.display = 'block';
      detailDom.style.pointerEvents = 'auto';
      gallery.detailPanelMesh.visible = true;
      (gallery.detailPanelMesh.material as THREE.MeshBasicMaterial).visible = true;
      requestAnimationFrame(() => canvas.requestPaint?.());
    } else if (type === 'kiosk') {
      const kioskEntry = hic.entries.get('kiosk');
      if (kioskEntry) kioskEntry.dom.style.pointerEvents = 'auto';
    } else if (type === 'info') {
      const infoEntry = hic.entries.get('info-panel');
      if (infoEntry) infoEntry.dom.style.pointerEvents = 'auto';
    }
  }

  function dismissInteraction() {
    interaction.dismiss();
    controls.lockPointer();
    crosshair.style.display = '';
    // Hide detail panel
    const detailDom = hic.getDetailDom();
    detailDom.style.display = 'none';
    gallery.detailPanelMesh.visible = false;
    (gallery.detailPanelMesh.material as THREE.MeshBasicMaterial).visible = false;
    // Reset pointer events on all HiC elements
    for (const [_id, entry] of hic.entries) {
      entry.dom.style.pointerEvents = 'none';
    }
  }

  // --- Event handlers (registered on document, guarded by destroyed flag) ---
  function onKeydown(e: KeyboardEvent) {
    if (destroyed) return;
    controls.onKeydown(e);

    if (e.code === 'KeyE') {
      if (interaction.state === 'walking') {
        const result = interaction.interact();
        if (result) {
          enterInteraction(result.type, result.index);
        }
      } else {
        dismissInteraction();
      }
    }

    if (e.code === 'Escape' && interaction.state !== 'walking') {
      dismissInteraction();
    }
  }

  function onKeyup(e: KeyboardEvent) {
    if (destroyed) return;
    controls.onKeyup(e);
  }

  function onMouseMove(e: MouseEvent) {
    if (destroyed) return;
    controls.onMouseMove(e);
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('keyup', onKeyup);
  document.addEventListener('mousemove', onMouseMove);

  // --- Main paint loop ---
  const mode: ModeImpl = {
    paint(dt: number) {
      const now = performance.now();

      // Update controls
      controls.update(dt);

      // Expand staggered load radius
      if (loadRadius < maxLoadRadius) {
        loadRadius = Math.min(loadRadius + 3, maxLoadRadius);
      }

      // Throttled proximity checks
      if (now - lastProximityCheck > PROXIMITY_INTERVAL) {
        lastProximityCheck = now;
        const nearby = interaction.getProximityPhotos(gallery.camera, PLAQUE_RADIUS);

        // Show/hide plaques
        for (let i = 0; i < photos.length; i++) {
          if (nearby.has(i) && !visiblePlaques.has(i)) {
            hic.showPlaque(i, true);
            visiblePlaques.add(i);
          } else if (!nearby.has(i) && visiblePlaques.has(i)) {
            hic.showPlaque(i, false);
            visiblePlaques.delete(i);
          }
        }

        // Set inert on photos outside the current load radius (staggered on startup)
        const inLOD = interaction.getProximityPhotos(gallery.camera, loadRadius);
        for (let i = 0; i < photos.length; i++) {
          hic.setInert(i, !inLOD.has(i));
        }
      }

      // Throttled raycaster
      if (now - lastRaycastCheck > RAYCASTER_INTERVAL) {
        lastRaycastCheck = now;
        interaction.update(gallery.camera);

        // Update crosshair
        if (interaction.state === 'walking') {
          if (interaction.target) {
            crosshair.classList.add('interactive');
            prompt.style.display = '';
            prompt.textContent = interaction.target.type === 'photo'
              ? 'Press E to view'
              : interaction.target.type === 'kiosk'
                ? 'Press E for gallery map'
                : 'Press E to read';
          } else {
            crosshair.classList.remove('interactive');
            prompt.style.display = 'none';
          }
        }
      }

      // Throttled kiosk update
      if (now - lastKioskUpdate > KIOSK_UPDATE_INTERVAL) {
        lastKioskUpdate = now;
        kiosk.updatePosition(gallery.camera.position.x, gallery.camera.position.z);
        canvas.requestPaint?.();
      }

      // Render
      renderer.render(gallery.scene, gallery.camera);
    },

    isAnimating() { return true; },

    onResize(newSize: { w: number; h: number }) {
      renderer.setSize(newSize.w, newSize.h, false);
      gallery.camera.aspect = newSize.w / newSize.h;
      gallery.camera.updateProjectionMatrix();
      requestDraw();
    },

    destroy() {
      destroyed = true;

      // 1. Pointer events
      for (const [_id, entry] of hic.entries) {
        entry.dom.style.pointerEvents = 'none';
        entry.dom.removeAttribute('inert');
      }

      // 2. Clear paint callback
      ctx.setModePaint(null);

      // 3. Release pointer lock
      controls.unlockPointer();

      // 4. Remove event listeners
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('keyup', onKeyup);
      document.removeEventListener('mousemove', onMouseMove);

      // 5. Dispose Three.js objects (geometries, materials, textures)
      for (const d of gallery.disposables) {
        d.dispose();
      }

      // 6. Dispose HiC bridge
      hic.dispose();

      // 7. Dispose subsystems
      controls.dispose();
      interaction.dispose();

      // 8. Remove UI overlays
      crosshair.remove();
      prompt.remove();
      if (enterOverlay.parentNode) enterOverlay.remove();

      // 9. Skip renderer.dispose() — it calls loseContext() which invalidates
      // the shared GL context. Three.js objects are already disposed above.

      // 10. Stop animation
      setAnimating(false);
    },
  };

  return mode;
}
