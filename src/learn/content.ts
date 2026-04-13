import type { ModeName } from '../types';

interface LearnContent {
  title: string;
  description: string;
  howItWorks: string;
  whyHiC: string;
  keyCode: string;
}

export const LEARN_CONTENT: Record<ModeName, LearnContent> = {
  slideshow: {
    title: 'Cinematic Slideshow',
    description: 'Full-screen photos with cinematic GLSL transitions — film burns, rack focus pulls, and luminance dissolves between slides.',
    howItWorks: 'Both the outgoing and incoming slides (each containing a photo and its caption as one HTML element) are captured as separate WebGL textures via the PaintTracker. A randomly-selected transition shader reads both textures simultaneously, blending them per-pixel. Film burn uses luminance + edge distance to determine burn order. Rack focus applies variable disc blur to both textures. Luminance dissolve transitions bright pixels first.',
    whyHiC: 'The View Transitions API can cross-fade or slide between DOM snapshots, but it offers no per-pixel control. A film burn that eats through bright areas first, a rack focus with directional blur, or a luminance-keyed dissolve all require sampling both textures in a custom fragment shader. Because HiC captures photo and caption as one texture, the caption participates in the dissolve effect — it burns, blurs, and dissolves alongside the photo rather than transitioning separately.',
    keyCode: `// Fragment shader blends two HTML textures\nvec3 from = srgbToLinear(texture(u_from, v_uv).rgb);\nvec3 to = srgbToLinear(texture(u_to, v_uv).rgb);\nfloat luma = dot(from, vec3(0.2126, 0.7152, 0.0722));\nfloat t = smoothstep(threshold - 0.15, threshold + 0.15, luma);\nfrag_color = vec4(linearToSrgb(mix(from, to, t)), 1.0);`,
  },
  'print-table': {
    title: 'Print Table',
    description: 'Photos laid out on a dark surface with a cursor-following spotlight that reveals content with distance-based blur.',
    howItWorks: 'The entire HTML grid (photos, captions, EXIF data) is captured as one composite texture. The spotlight fragment shader combines three effects in a single pass: radial brightness falloff from the cursor position, distance-based disc blur (sharp near the cursor, progressively blurred further away), and a vignette darkening at screen edges.',
    whyHiC: 'CSS can dim individual elements with <code>filter: brightness()</code> and blur them with <code>filter: blur()</code>, but both are uniform per-element. The spotlight effect varies <em>within</em> a single photo — one edge is sharp and bright while the opposite edge is blurred and dark. The blur also crosses element boundaries: it flows from a photo through the gap into the adjacent caption. Per-pixel variable-radius blur on a composite HTML rendering is only possible via a fragment shader on the HTML texture.',
    keyCode: `// Spotlight: distance drives both brightness and blur\nfloat dist = distance(v_uv, u_mousePos);\nfloat brightness = smoothstep(0.55, 0.0, dist) * 0.85 + 0.15;\nfloat blurRadius = smoothstep(0.0, 0.4, dist) * 16.0;\nvec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);`,
  },
  'film-strip': {
    title: 'Film Strip',
    description: 'A horizontal filmstrip with sprocket holes and frame counters that curves like real film on a light table.',
    howItWorks: 'The HTML strip (photos, sprocket holes, frame numbers) is captured as one composite texture. The curvature shader displaces UV coordinates quadratically based on horizontal distance from center, simulating film curving away from the viewer. Edge darkening simulates light falloff on the curved surface, and a center glow mimics the "sweet spot" where film sits flat.',
    whyHiC: 'CSS 3D transforms can angle individual elements with <code>perspective</code> and <code>rotateY</code>, but the gap between frames, the sprocket holes, and the frame counters all need to curve together as one continuous surface. Applying <code>transform: rotateY()</code> to each photo individually leaves flat gaps between them. Only a shader on the composite texture can curve everything — photos, borders, holes, text — as one cohesive strip.',
    keyCode: `// UV-space curvature: quadratic displacement from center\nvec2 center = v_uv - 0.5;\nfloat xDist = center.x * 2.0;\nfloat curve = xDist * xDist * u_curvature;\nvec2 curved_uv = vec2(\n  0.5 + center.x * (1.0 - abs(xDist) * 0.03),\n  v_uv.y + curve\n);`,
  },
  'wall-exhibition': {
    title: 'Wall Exhibition',
    description: 'Photos hung on a gallery wall with overhead directional spotlights and procedural wall texture.',
    howItWorks: 'The HTML composition (photos with plaque-style labels) is captured as a texture. The shader first composites it onto a procedural wall surface (two layers of noise at different scales). Then evenly-spaced overhead lights are simulated with inverse-square falloff, horizontal centering bias, and a warm color tint. An ambient light level prevents pure-black shadows.',
    whyHiC: 'Three things CSS cannot do: (1) compositing live HTML onto a background texture with per-pixel blending in a shader, (2) per-pixel lighting that varies brightness <em>within</em> a single element — CSS <code>brightness()</code> is uniform across the entire element, and (3) light spill that crosses element boundaries, where overhead light illuminating a photo also brightens the wall texture below it. All three require shader access to the composite HTML pixels.',
    keyCode: `// Gallery lighting with procedural wall texture\nvec3 wallColor = vec3(0.045, 0.043, 0.05) + noise;\nvec3 composited = mix(wallColor, htmlColor, isContent);\nfloat lighting = hCenter * (1.0 / (1.0 + lightDist * lightDist * 40.0));\ncomposited *= ambient + lighting * 0.85;`,
  },
  'gallery-walk': {
    title: '3D Gallery Walk',
    description: 'A first-person museum walk through a figure-8 floor plan. Photos hang on classical walls with ornate frames and warm spotlighting. Explore freely with WASD + mouse look.',
    howItWorks: 'Three.js renders a 3D museum scene using the shell\'s canvas. Each photo, plaque, kiosk, and info panel is a live DOM element inside the canvas subtree, captured as a WebGL texture via texElementImage2D in the paint handler. These textures are injected into Three.js materials using the __webglTexture property bridge. The camera is a PerspectiveCamera at eye height (1.6m) driven by pointer lock mouse input and WASD keys, with AABB collision detection against axis-aligned walls.',
    whyHiC: 'This mode requires all four HiC pillars simultaneously: (1) full CSS text and layout fidelity for museum plaques with serif fonts and EXIF data, (2) 3D rendering via Three.js materials receiving live HTML textures, (3) preserved interactivity — buttons on the detail panel, scrolling on the info panel, and clickable elements on the kiosk map all work through screen-projection passthrough that translates 3D raycaster hits back to DOM coordinates, and (4) real browser affordances including keyboard focus, text selection, and accessibility tree integration via the inert attribute on off-screen photos.',
    keyCode: `// Inject HiC texture into Three.js material\nconst texture = new THREE.Texture();\ntexture.isRenderTargetTexture = true;\ntexture.colorSpace = THREE.SRGBColorSpace;\ntexture.flipY = false;\nrenderer.properties.get(texture).__webglTexture = glTex;\n// Upload in paint handler, reset Three.js state\ngl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, el);\nrenderer.state.reset();`,
  },
};
