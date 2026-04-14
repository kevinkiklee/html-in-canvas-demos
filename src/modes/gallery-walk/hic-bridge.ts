import * as THREE from 'three';
import type { Photo } from '../../types';
import { formatExif } from '../../lib/photos';

export interface HiCEntry {
  id: string;
  dom: HTMLElement;
  /** Staging GL texture — written by texElementImage2D, never seen by Three.js */
  stagingTexture: WebGLTexture;
  /** Three.js DataTexture — fully managed by Three.js, updated from readPixels */
  dataTexture: THREE.DataTexture;
  width: number;
  height: number;
  pixelBuffer: Uint8Array;
  lastUploadTime: number;
  /** Minimum ms between uploads (0 = no throttle) */
  uploadThrottleMs: number;
}

export interface HiCBridge {
  entries: Map<string, HiCEntry>;
  paintCallback: (changedElements: readonly Element[]) => void;
  /** Register an external DOM element (e.g. kiosk, ticker) as an HiC entry */
  registerEntry(id: string, dom: HTMLElement, width: number, height: number, throttleMs?: number): HiCEntry;
  /** Set the material map for a registered entry */
  bindToMaterial(entryId: string, material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial): void;
  /** Toggle plaque visibility for a photo */
  showPlaque(index: number, visible: boolean): void;
  /** Set inert on a photo element */
  setInert(index: number, inert: boolean): void;
  /** Get the detail panel DOM element */
  getDetailDom(): HTMLElement;
  /** Update detail panel content for a specific photo */
  setDetailPhoto(photo: Photo): void;
  /** Current detail photo index (-1 if none) */
  detailIndex: number;
  dispose(): void;
}

export function createHiCBridge(
  gl: WebGL2RenderingContext,
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  photos: Photo[],
  requestDraw: () => void,
): HiCBridge {
  const entries = new Map<string, HiCEntry>();

  // Shared framebuffer for readPixels from staging textures
  const readFBO = gl.createFramebuffer()!;

  /** Create a staging GL texture at the specified dimensions */
  function createStagingTexture(w: number, h: number): WebGLTexture {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Pre-allocate at element dimensions so texElementImage2D has the right storage
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA,
      gl.UNSIGNED_BYTE, null);
    return tex;
  }

  /** Create a Three.js DataTexture (fully managed by Three.js — no __webglTexture injection) */
  function createDataTexture(w: number, h: number, pixelBuffer: Uint8Array): THREE.DataTexture {
    const texture = new THREE.DataTexture(pixelBuffer, w, h);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function registerEntry(id: string, dom: HTMLElement, width: number, height: number, throttleMs = 0): HiCEntry {
    const stagingTexture = createStagingTexture(width, height);
    const pixelBuffer = new Uint8Array(width * height * 4);
    const dataTexture = createDataTexture(width, height, pixelBuffer);

    // Force Three.js to fully initialize the texture now (creates GL texture via
    // texStorage2D, uploads initial data, sets texture parameters).
    renderer.initTexture(dataTexture);

    // Fix mip completeness: Three.js's getMipLevels() computes the full mipmap chain
    // (e.g. 10 levels for 512×384) and passes it to texStorage2D, but only uploads
    // level 0. With generateMipmaps=false this SHOULD be fine for LINEAR sampling,
    // but macOS ANGLE/Metal treats the unfilled levels as "texture incomplete" and
    // renders a checkerboard. Setting TEXTURE_MAX_LEVEL=0 tells the driver only
    // level 0 matters, making the texture complete.
    const glTex = (renderer.properties.get(dataTexture) as any).__webglTexture;
    if (glTex) {
      gl.bindTexture(gl.TEXTURE_2D, glTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);
    }

    const entry: HiCEntry = {
      id, dom, stagingTexture, dataTexture,
      width, height, pixelBuffer,
      lastUploadTime: 0,
      uploadThrottleMs: throttleMs,
    };
    entries.set(id, entry);
    return entry;
  }

  // --- Create photo DOM elements ---
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const div = document.createElement('div');
    div.id = `gallery-photo-${i}`;
    div.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:512px;height:384px;background:#0a0a0b;';

    const img = document.createElement('img');
    img.style.cssText = 'width:100%;height:auto;max-height:280px;object-fit:contain;display:block;margin:0 auto;';
    img.src = photo.medium || photo.thumb;
    img.onload = () => {
      canvas.requestPaint?.();
      requestDraw();
    };

    const plaque = document.createElement('div');
    plaque.className = 'gallery-plaque';
    plaque.style.cssText = 'display:none;padding:8px 12px;text-align:center;';

    const titleEl = document.createElement('div');
    titleEl.className = 'gallery-plaque-title';
    titleEl.textContent = photo.title || `Photograph ${i + 1}`;

    const exifEl = document.createElement('div');
    exifEl.className = 'gallery-plaque-exif';
    exifEl.textContent = formatExif(photo);

    plaque.append(titleEl, exifEl);
    div.append(img, plaque);
    canvas.appendChild(div);

    registerEntry(`photo-${i}`, div, 512, 384);
  }

  // --- Detail panel DOM ---
  const detailDom = document.createElement('div');
  detailDom.id = 'gallery-detail';
  detailDom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:800px;height:600px;background:#0a0a0b;display:none;';

  const detailImg = document.createElement('img');
  detailImg.style.cssText = 'width:100%;max-height:400px;object-fit:contain;display:block;margin:0 auto;';
  const detailTitle = document.createElement('div');
  detailTitle.className = 'gallery-detail-title';
  const detailDesc = document.createElement('div');
  detailDesc.className = 'gallery-detail-desc';
  const detailExif = document.createElement('div');
  detailExif.className = 'gallery-detail-exif';

  const detailNav = document.createElement('div');
  detailNav.className = 'gallery-detail-nav';
  const prevBtn = document.createElement('button');
  prevBtn.className = 'gallery-detail-btn';
  prevBtn.textContent = '\u2190 Previous';
  const nextBtn = document.createElement('button');
  nextBtn.className = 'gallery-detail-btn';
  nextBtn.textContent = 'Next \u2192';
  detailNav.append(prevBtn, nextBtn);

  let detailIndex = -1;

  function updateDetailFromIndex() {
    if (detailIndex < 0 || detailIndex >= photos.length) return;
    const photo = photos[detailIndex];
    detailImg.src = photo.full || photo.medium;
    detailTitle.textContent = photo.title || `Photograph ${detailIndex + 1}`;
    detailDesc.textContent = photo.description || '';
    detailExif.textContent = formatExif(photo);
    detailImg.onload = () => {
      canvas.requestPaint?.();
      requestDraw();
    };
  }

  prevBtn.addEventListener('click', () => {
    if (detailIndex > 0) {
      detailIndex--;
      updateDetailFromIndex();
      requestAnimationFrame(() => canvas.requestPaint?.());
    }
  });

  nextBtn.addEventListener('click', () => {
    if (detailIndex < photos.length - 1) {
      detailIndex++;
      updateDetailFromIndex();
      requestAnimationFrame(() => canvas.requestPaint?.());
    }
  });

  detailDom.append(detailImg, detailTitle, detailDesc, detailExif, detailNav);
  canvas.appendChild(detailDom);
  registerEntry('detail', detailDom, 800, 600);

  // --- Info panel DOM ---
  const infoDom = document.createElement('div');
  infoDom.id = 'gallery-info';
  infoDom.style.cssText = 'position:absolute;left:-9999px;overflow:hidden;width:600px;height:480px;background:#0a0a0b;';

  const infoScroller = document.createElement('div');
  infoScroller.style.cssText = 'width:100%;height:100%;overflow-y:auto;padding:24px;';

  const infoTitle = document.createElement('h2');
  infoTitle.className = 'gallery-info-title';
  infoTitle.textContent = 'Photography Exhibition';

  const infoStatement = document.createElement('p');
  infoStatement.className = 'gallery-info-statement';
  infoStatement.textContent = 'A curated collection of photographs rendered through the experimental HTML-in-Canvas API. Each image is a live DOM element captured as a WebGL texture, hung on classical museum walls with Three.js lighting and materials.';

  infoScroller.append(infoTitle, infoStatement);

  // Add thumbnail list of works
  const worksList = document.createElement('div');
  worksList.className = 'gallery-info-works';
  for (let i = 0; i < photos.length; i++) {
    const item = document.createElement('div');
    item.className = 'gallery-info-work-item';
    const thumb = document.createElement('img');
    thumb.src = photos[i].thumb;
    thumb.style.cssText = 'width:60px;height:45px;object-fit:cover;';
    const label = document.createElement('span');
    label.textContent = photos[i].title || `Photograph ${i + 1}`;
    item.append(thumb, label);
    worksList.appendChild(item);
  }
  infoScroller.appendChild(worksList);
  infoDom.appendChild(infoScroller);
  canvas.appendChild(infoDom);
  registerEntry('info-panel', infoDom, 600, 480);

  // --- Paint callback ---
  const paintCallback = (changedElements: readonly Element[]) => {
    const now = performance.now();
    let anyUploaded = false;

    for (const [_id, entry] of entries) {
      const isChanged = changedElements.some(
        el => el === entry.dom || entry.dom.contains(el),
      );
      if (!isChanged) continue;

      // Throttle check
      if (entry.uploadThrottleMs > 0 && now - entry.lastUploadTime < entry.uploadThrottleMs) {
        continue;
      }

      // Guard: element must be connected and have size
      if (!entry.dom.isConnected || entry.dom.offsetWidth <= 0 || entry.dom.offsetHeight <= 0) {
        continue;
      }

      // 1. Upload DOM element to staging GL texture via texElementImage2D
      gl.bindTexture(gl.TEXTURE_2D, entry.stagingTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      (gl as any).texElementImage2D(
        gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, entry.dom,
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      // 2. Read pixels back from staging texture into CPU buffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, readFBO);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, entry.stagingTexture, 0);
      gl.readPixels(0, 0, entry.width, entry.height,
        gl.RGBA, gl.UNSIGNED_BYTE, entry.pixelBuffer);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // 3. Mark DataTexture for Three.js re-upload
      entry.dataTexture.needsUpdate = true;

      entry.lastUploadTime = now;
      anyUploaded = true;
    }

    if (anyUploaded) {
      renderer.state.reset();
    }
    requestDraw();
  };

  function bindToMaterial(entryId: string, material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial) {
    const entry = entries.get(entryId);
    if (entry) {
      material.map = entry.dataTexture;
      material.needsUpdate = true;
    }
  }

  function showPlaque(index: number, visible: boolean) {
    const entry = entries.get(`photo-${index}`);
    if (!entry) return;
    const plaque = entry.dom.querySelector('.gallery-plaque') as HTMLElement | null;
    if (!plaque) return;
    if (visible && plaque.style.display === 'none') {
      plaque.style.display = 'block';
      // Gotcha #14: DOM mutation is 1 frame late. Wait 1 RAF then requestPaint.
      requestAnimationFrame(() => {
        canvas.requestPaint?.();
      });
    } else if (!visible && plaque.style.display !== 'none') {
      plaque.style.display = 'none';
      requestAnimationFrame(() => {
        canvas.requestPaint?.();
      });
    }
  }

  function setInert(index: number, inert: boolean) {
    const entry = entries.get(`photo-${index}`);
    if (!entry) return;
    if (inert) {
      entry.dom.setAttribute('inert', '');
    } else {
      entry.dom.removeAttribute('inert');
    }
  }

  function getDetailDom() {
    return detailDom;
  }

  function setDetailPhoto(photo: Photo) {
    detailIndex = photos.indexOf(photo);
    detailImg.src = photo.full || photo.medium;
    detailTitle.textContent = photo.title || '';
    detailDesc.textContent = photo.description || '';
    detailExif.textContent = formatExif(photo);
    detailImg.onload = () => {
      canvas.requestPaint?.();
      requestDraw();
    };
  }

  function dispose() {
    for (const [_id, entry] of entries) {
      gl.deleteTexture(entry.stagingTexture);
      entry.dataTexture.dispose();
      entry.dom.remove();
    }
    entries.clear();
    gl.deleteFramebuffer(readFBO);
  }

  return {
    entries,
    paintCallback,
    registerEntry,
    bindToMaterial,
    showPlaque,
    setInert,
    getDetailDom,
    setDetailPhoto,
    get detailIndex() { return detailIndex; },
    set detailIndex(v: number) { detailIndex = v; },
    dispose,
  };
}
