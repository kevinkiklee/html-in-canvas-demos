import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compileShader, createProgram, getCachedProgram } from '../gl';

// ---------------------------------------------------------------------------
// Minimal WebGL2 mock
// ---------------------------------------------------------------------------

type MockShader = { _type: 'shader'; id: number };
type MockProgram = { _type: 'program'; id: number };

let _shaderCounter = 0;
let _programCounter = 0;

function makeMockGL(overrides: Partial<ReturnType<typeof makeBaseGL>> = {}) {
  return { ...makeBaseGL(), ...overrides } as unknown as WebGL2RenderingContext;
}

function makeBaseGL() {
  const shaders = new Map<MockShader, { source: string; compileOk: boolean }>();
  const programs = new Map<MockProgram, { linked: boolean }>();

  const VERTEX_SHADER = 0x8b31;
  const FRAGMENT_SHADER = 0x8b30;
  const COMPILE_STATUS = 0x8b81;
  const LINK_STATUS = 0x8b82;

  const gl = {
    VERTEX_SHADER,
    FRAGMENT_SHADER,
    COMPILE_STATUS,
    LINK_STATUS,

    createShader: vi.fn((_type: number): MockShader => {
      const s: MockShader = { _type: 'shader', id: ++_shaderCounter };
      shaders.set(s, { source: '', compileOk: true });
      return s;
    }),
    shaderSource: vi.fn((shader: MockShader, src: string) => {
      const e = shaders.get(shader);
      if (e) e.source = src;
    }),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn((shader: MockShader, pname: number) => {
      if (pname === COMPILE_STATUS) return shaders.get(shader)?.compileOk ?? false;
      return null;
    }),
    getShaderInfoLog: vi.fn(() => 'mock shader error'),
    deleteShader: vi.fn((shader: MockShader) => shaders.delete(shader)),

    createProgram: vi.fn((): MockProgram => {
      const p: MockProgram = { _type: 'program', id: ++_programCounter };
      programs.set(p, { linked: true });
      return p;
    }),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn((prog: MockProgram, pname: number) => {
      if (pname === LINK_STATUS) return programs.get(prog)?.linked ?? false;
      return null;
    }),
    getProgramInfoLog: vi.fn(() => 'mock link error'),
    deleteProgram: vi.fn((prog: MockProgram) => programs.delete(prog)),
    detachShader: vi.fn(),

    // Helper for tests to force compile failure
    _setShaderCompileOk(shader: MockShader, ok: boolean) {
      const e = shaders.get(shader);
      if (e) e.compileOk = ok;
    },
    _setLinkOk(prog: MockProgram, ok: boolean) {
      const e = programs.get(prog);
      if (e) e.linked = ok;
    },
  };

  return gl;
}

// ---------------------------------------------------------------------------
// compileShader
// ---------------------------------------------------------------------------

describe('compileShader', () => {
  it('returns the shader object when compilation succeeds', () => {
    const gl = makeMockGL();
    const shader = compileShader(gl, gl.VERTEX_SHADER, 'void main(){}');
    expect(shader).toBeDefined();
    expect(gl.createShader).toHaveBeenCalledWith(gl.VERTEX_SHADER);
    expect(gl.shaderSource).toHaveBeenCalled();
    expect(gl.compileShader).toHaveBeenCalled();
  });

  it('throws when createShader returns null', () => {
    const gl = makeMockGL({
      createShader: vi.fn(() => null as unknown as MockShader),
    });
    expect(() => compileShader(gl, gl.VERTEX_SHADER, 'void main(){}')).toThrow(
      'Failed to create shader',
    );
  });

  it('throws and deletes shader when compilation fails', () => {
    const base = makeBaseGL();
    // Override getShaderParameter to always report failure
    const gl = {
      ...base,
      getShaderParameter: vi.fn(() => false),
    } as unknown as WebGL2RenderingContext;

    expect(() => compileShader(gl, (gl as any).VERTEX_SHADER, 'bad source')).toThrow(
      'Shader compile failed',
    );
    expect((gl as any).deleteShader).toHaveBeenCalled();
  });

  it('includes the info log in the thrown error message', () => {
    const base = makeBaseGL();
    const gl = {
      ...base,
      getShaderParameter: vi.fn(() => false),
      getShaderInfoLog: vi.fn(() => 'undefined variable foo'),
    } as unknown as WebGL2RenderingContext;

    expect(() => compileShader(gl, (gl as any).VERTEX_SHADER, 'bad')).toThrow(
      'undefined variable foo',
    );
  });
});

// ---------------------------------------------------------------------------
// createProgram
// ---------------------------------------------------------------------------

describe('createProgram', () => {
  it('returns a program when both shaders compile and link succeeds', () => {
    const gl = makeMockGL();
    const prog = createProgram(gl, 'void main(){}', 'void main(){}');
    expect(prog).toBeDefined();
    expect(gl.attachShader).toHaveBeenCalledTimes(2);
    expect(gl.linkProgram).toHaveBeenCalledTimes(1);
    expect(gl.detachShader).toHaveBeenCalledTimes(2);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
  });

  it('throws when link fails and deletes the program', () => {
    const base = makeBaseGL();
    let callCount = 0;
    const gl = {
      ...base,
      // First two calls (for shader COMPILE_STATUS) return true; third (LINK_STATUS) false
      getProgramParameter: vi.fn(() => false),
    } as unknown as WebGL2RenderingContext;

    expect(() => createProgram(gl, 'void main(){}', 'void main(){}')).toThrow(
      'Program link failed',
    );
    expect((gl as any).deleteProgram).toHaveBeenCalled();
  });

  it('propagates shader compile errors before attempting to link', () => {
    const base = makeBaseGL();
    const gl = {
      ...base,
      getShaderParameter: vi.fn(() => false),
    } as unknown as WebGL2RenderingContext;

    expect(() => createProgram(gl, 'bad vert', 'void main(){}')).toThrow(
      'Shader compile failed',
    );
    // linkProgram should never be reached
    expect((gl as any).linkProgram).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCachedProgram
// ---------------------------------------------------------------------------

describe('getCachedProgram', () => {
  // The cache is module-level — clear it between tests by using unique sources
  const unique = () => `void main(){ float x = ${Math.random()}; }`;

  it('returns the same program object for identical vert + frag sources', () => {
    const gl = makeMockGL();
    const vert = unique();
    const frag = unique();
    const first = getCachedProgram(gl, vert, frag);
    const second = getCachedProgram(gl, vert, frag);
    expect(first).toBe(second);
  });

  it('calls createProgram only once for repeated identical calls', () => {
    const gl = makeMockGL();
    const vert = unique();
    const frag = unique();
    getCachedProgram(gl, vert, frag);
    getCachedProgram(gl, vert, frag);
    getCachedProgram(gl, vert, frag);
    // createProgram underlying mock → linkProgram should have been called once
    expect(gl.linkProgram).toHaveBeenCalledTimes(1);
  });

  it('returns different programs for different shader source combinations', () => {
    const gl = makeMockGL();
    const v1 = unique();
    const v2 = unique();
    const frag = unique();
    const p1 = getCachedProgram(gl, v1, frag);
    const p2 = getCachedProgram(gl, v2, frag);
    expect(p1).not.toBe(p2);
  });

  it('treats vert+frag combination as distinct from frag+vert (key order matters)', () => {
    const gl = makeMockGL();
    const a = unique();
    const b = unique();
    const p1 = getCachedProgram(gl, a, b);
    const p2 = getCachedProgram(gl, b, a);
    expect(p1).not.toBe(p2);
  });
});
