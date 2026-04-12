import type { ModeName } from '../types';

interface LearnContent {
  title: string;
  description: string;
  howItWorks: string;
  whyHiC: string;
  keyCode: string;
}

export const LEARN_CONTENT: Record<ModeName, LearnContent> = {
  album: {
    title: 'Album',
    description: 'A photo book you flip through — pages curl and bend like real paper.',
    howItWorks: 'Each page spread is live HTML (real text, real images) captured as a WebGL texture via <code>texElementImage2D</code>. The page-turn shader displaces vertices along a curl curve, mapping the texture onto the bending surface. A paper texture overlay and spine shadow are composited by the shader even on flat pages.',
    whyHiC: 'CSS 3D transforms can do rigid <code>rotateY</code> page flips. They cannot curl or bend content along a curve — that requires per-vertex displacement on page geometry with the HTML content mapped as a texture. Without HiC, you\'d need to pre-render all text as images, losing accessibility, text selection, and crisp scaling.',
    keyCode: `gl.texElementImage2D(\n  gl.TEXTURE_2D, 0,\n  gl.RGBA, gl.RGBA,\n  gl.UNSIGNED_BYTE, pageElement\n);`,
  },
  slideshow: {
    title: 'Cinematic Slideshow',
    description: 'Full-screen photos with cinematic GLSL transitions between slides.',
    howItWorks: 'Both outgoing and incoming slides (photo + caption) are captured as separate textures via the PaintTracker. A randomly-selected transition shader blends them at the pixel level — film burn, rack focus, or luminance dissolve.',
    whyHiC: 'The View Transitions API can fade or slide between DOM snapshots, but can\'t do per-pixel noise-pattern dissolves, directional motion blur, or luminance-keyed blending. Those require custom GLSL sampling of both textures simultaneously. The caption participates in the dissolve because photo and caption are one texture.',
    keyCode: `// Two textures blended in fragment shader\nvec4 from = texture(u_from, v_uv);\nvec4 to = texture(u_to, v_uv);\nfrag_color = mix(from, to, progress);`,
  },
  'print-table': {
    title: 'Print Table',
    description: 'Photos on a dark surface with a cursor-following spotlight.',
    howItWorks: 'The entire HTML grid is captured as one composite texture. The spotlight fragment shader applies radial brightness falloff and distance-based Gaussian blur in a single pass — the effect flows seamlessly across element boundaries.',
    whyHiC: 'CSS can dim individual elements with <code>filter: brightness()</code>, but the blur crosses element boundaries — it flows from one photo into the gap and into the next caption. Per-pixel variable-radius blur on a composite HTML rendering is only possible via a fragment shader on the HTML texture.',
    keyCode: `float dist = distance(v_uv, u_mousePos);\nfloat brightness = smoothstep(0.5, 0.0, dist);\nvec4 blurred = discBlur(u_tex, v_uv, dist * 20.0, texelSize);`,
  },
  'film-strip': {
    title: 'Film Strip',
    description: 'A horizontal filmstrip with sprocket holes that curves like real film.',
    howItWorks: 'The HTML strip (photos, sprocket holes, frame counters) is captured as one texture. A curvature shader bends the flat layout into a 3D surface. <code>getElementTransform</code> synchronizes hit testing so clicks land correctly on the curved content.',
    whyHiC: 'CSS 3D can angle individual elements, but the gap between frames, the sprocket holes, and the counters all need to curve together as one continuous surface. Only a shader on the composite texture achieves this. Hit testing via <code>getElementTransform</code> has no CSS equivalent.',
    keyCode: `// Curvature: y-displacement based on x-distance from center\nfloat curve = pow(abs(center.x), 2.0) * u_curvature;\nvec2 curved_uv = v_uv + vec2(0.0, curve);`,
  },
  'wall-exhibition': {
    title: 'Wall Exhibition',
    description: 'Photos hung on a gallery wall with overhead directional lighting.',
    howItWorks: 'The HTML composition is captured as a texture. The shader composites it onto a procedural wall texture and applies overhead gallery lighting — per-pixel brightness falloff, position-dependent shadows, and light spill that crosses element boundaries.',
    whyHiC: 'Three CSS impossibilities: compositing HTML onto a background texture in a shader, per-pixel lighting within a single element (CSS brightness is uniform per-element), and cast shadows whose direction varies by position relative to light sources.',
    keyCode: `// Gallery lighting: overhead spot, inverse-square falloff\nfloat lighting = 1.0 / (1.0 + dist_to_light * dist_to_light);\nvec3 wall = texture(u_wallTex, v_uv).rgb;\nvec3 html = texture(u_tex, v_uv).rgb;\nfrag_color = vec4(mix(wall, html, htmlAlpha) * lighting, 1.0);`,
  },
  'stacked-prints': {
    title: 'Stacked Prints',
    description: 'A pile of prints you toss aside — paper warps and flexes as you interact.',
    howItWorks: 'Each print is a separate canvas child with its own texture. The paper warp is vertex displacement responding to grab position and drag velocity. Front shows the photo, back shows EXIF — two HTML textures on one deforming mesh.',
    whyHiC: 'CSS transforms are affine — they rotate, scale, and skew, but cannot bend or curl within a single element. The paper warp is non-linear deformation of live HTML. The double-sided print needs two HTML textures on one mesh. No CSS achieves this.',
    keyCode: `// Paper warp: curl from grab point\nfloat d = distance(a_uv, u_grabPoint);\nfloat warp = sin(d * 3.14) * u_curlAmount;\nvec2 displaced = a_pos + vec2(0.0, warp);`,
  },
  collage: {
    title: 'Collage',
    description: 'An editorial collage rendered through a tilt-shift miniature effect.',
    howItWorks: 'The collage layout (overlapping, rotated photos) is captured as one composite texture. A tilt-shift shader applies a horizontal band of sharpness with progressive blur above and below — varying per-pixel, crossing element boundaries.',
    whyHiC: 'CSS <code>filter: blur()</code> applies uniformly per-element. A photo spanning the tilt-shift boundary is sharp in its center and blurred at its edges — within the same element. The blur crosses overlapping photos and caption text seamlessly. Only a fragment shader on the composite texture can do this.',
    keyCode: `// Tilt-shift: blur increases with distance from focus band\nfloat blurAmount = abs(v_uv.y - u_focusY) * u_blurStrength;\nvec4 color = discBlur(u_tex, v_uv, blurAmount, texelSize);`,
  },
};
