/**
 * WebGL2 utilities for the HTML-in-Canvas portfolio.
 *
 * Key patterns:
 * - Fullscreen quad: a single triangle strip covering clip space [-1,1].
 *   Used for post-processing — the fragment shader runs once per pixel on
 *   the HTML texture. This is how modes apply spotlight, tilt-shift, etc.
 * - Tessellated quad: subdivided into segX*segY triangles so the vertex
 *   shader can displace individual vertices (page curl, paper warp).
 *   Without tessellation, vertex displacement only bends 4 corners.
 * - sRGB linearization: HTML textures are in sRGB gamma space. All shader
 *   math (blending, lighting, blur) must happen in linear space, then
 *   convert back to sRGB before output. Skipping this produces washed-out
 *   highlights and crushed shadows.
 */

export function initGL(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WebGL2 not supported');
  return gl;
}

export function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed:\n${log}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`Program link failed:\n${log}`);
  }
  gl.detachShader(program, vert);
  gl.detachShader(program, frag);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export interface QuadVAO {
  vao: WebGLVertexArrayObject;
  draw: () => void;
  dispose: () => void;
}

// Fullscreen quad: 4 vertices drawn as a triangle strip. The fragment shader
// runs for every pixel, sampling from the HTML texture. This is the workhorse
// for post-processing effects (spotlight, tilt-shift, gallery lighting, etc.).
export function createQuadVAO(gl: WebGL2RenderingContext): QuadVAO {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  // Each vertex: (clip x, clip y, tex u, tex v)
  const vertices = new Float32Array([
    -1, -1,    0, 0,
     1, -1,    1, 0,
    -1,  1,    0, 1,
     1,  1,    1, 1,
  ]);

  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return {
    vao,
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vbo);
    },
  };
}

// Tessellated quad: subdivided into segX*segY cells (each 2 triangles). The
// extra vertices let the vertex shader apply non-linear displacement — page
// curls, paper warps, film curvature. A simple 4-vertex quad can only do
// affine transforms; tessellation is required for bending live HTML content.
export function createTessellatedQuad(
  gl: WebGL2RenderingContext,
  segX: number,
  segY: number,
): QuadVAO {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const vertices: number[] = [];
  for (let y = 0; y < segY; y++) {
    for (let x = 0; x < segX; x++) {
      const x0 = x / segX;
      const x1 = (x + 1) / segX;
      const y0 = y / segY;
      const y1 = (y + 1) / segY;

      const cx0 = x0 * 2 - 1, cx1 = x1 * 2 - 1;
      const cy0 = y0 * 2 - 1, cy1 = y1 * 2 - 1;

      vertices.push(cx0, cy0, x0, y0);
      vertices.push(cx1, cy0, x1, y0);
      vertices.push(cx0, cy1, x0, y1);
      vertices.push(cx1, cy0, x1, y0);
      vertices.push(cx1, cy1, x1, y1);
      vertices.push(cx0, cy1, x0, y1);
    }
  }

  const vertCount = segX * segY * 6;
  const vbo = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  gl.bindVertexArray(null);

  return {
    vao,
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, vertCount);
      gl.bindVertexArray(null);
    },
    dispose() {
      gl.deleteVertexArray(vao);
      gl.deleteBuffer(vbo);
    },
  };
}

const programCache = new Map<string, WebGLProgram>();

export function getCachedProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram {
  const key = vertSrc + '\0' + fragSrc;
  let prog = programCache.get(key);
  if (!prog) {
    prog = createProgram(gl, vertSrc, fragSrc);
    programCache.set(key, prog);
  }
  return prog;
}

export function uniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  return gl.getUniformLocation(program, name);
}

// Creates a texture sized 1x1 with a near-black placeholder. The real pixels
// arrive later via texElementImage2D inside the paint handler. CLAMP_TO_EDGE
// is required because HTML textures are not power-of-two sized.
export function createElementTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA,
    gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 11, 255]),
  );
  return texture;
}

/**
 * Safe wrapper around texElementImage2D. Guards against disconnected or
 * zero-size elements that crash the GPU process, and catches any unexpected
 * errors from the experimental API. MUST only be called inside a paint handler.
 */
export function safeTexUpload(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  el: HTMLElement,
): boolean {
  if (!el.isConnected || el.offsetWidth <= 0 || el.offsetHeight <= 0) return false;
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    (gl as any).texElementImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el,
    );
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return true;
  } catch (e) {
    console.warn('[HiC] texElementImage2D failed:', e);
    return false;
  }
}

export function createImageTexture(
  gl: WebGL2RenderingContext,
  url: string,
  onLoad?: () => void,
): WebGLTexture {
  const texture = createElementTexture(gl);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    onLoad?.();
  };
  return texture;
}
