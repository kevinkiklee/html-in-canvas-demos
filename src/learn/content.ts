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
    description: 'A photo book you flip through — pages curl and bend like real paper, with live text and images deforming along the surface.',
    howItWorks: 'Each page spread is live HTML (real text, real images, EXIF metadata) captured as a WebGL texture via <code>texElementImage2D</code> inside the <code>paint</code> event handler. The page is rendered onto a 40x30 tessellated quad, and the page-curl shader displaces vertices along a cubic-eased curl curve. Even flat pages get a paper texture overlay (procedural noise) and a spine shadow darkening the left edge.',
    whyHiC: 'CSS 3D transforms only do rigid transforms like <code>rotateY</code> — the entire element rotates as a flat plane. Curling or bending content along an arbitrary curve requires per-vertex displacement of a tessellated mesh with the live HTML mapped as a texture. Without HiC, you\'d need to pre-render all text and images as static bitmaps, losing accessibility (screen readers can\'t read image text), text selection, and resolution-independent scaling on retina displays.',
    keyCode: `// Inside paint event handler (ONLY safe place)\ngl.texElementImage2D(\n  gl.TEXTURE_2D, 0,\n  gl.RGBA, gl.RGBA,\n  gl.UNSIGNED_BYTE, pageElement\n);`,
  },
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
  'stacked-prints': {
    title: 'Stacked Prints',
    description: 'A pile of prints you toss aside — paper warps and flexes from the grab point as you interact.',
    howItWorks: 'Each print\'s HTML (photo, caption, EXIF) is captured as a texture and mapped onto a 30x25 tessellated quad. When tossed, the paper-warp shader displaces UV coordinates radially from the grab point using a sine wave, creating a natural paper-curl effect. The lift amount follows a sine arc (rises then falls) during the toss animation. Paper texture noise, depth-based shadow, and warm color tint complete the physical appearance.',
    whyHiC: 'CSS transforms are affine — <code>rotate</code>, <code>scale</code>, <code>skew</code> all transform the element as a rigid plane. They cannot bend or curl <em>within</em> a single element. The paper warp is non-linear deformation: one corner lifts while the center stays flat, and the deformation follows a sine curve from the grab point. Achieving this on live HTML content (not a pre-rendered image) requires capturing the DOM as a texture and warping it on a tessellated mesh.',
    keyCode: `// Paper warp: sine-wave UV displacement from grab point\nfloat dist = distance(uv, u_grabPoint);\nfloat warp = sin(dist * 3.14159) * u_liftAmount * 0.08;\nvec2 dir = normalize(uv - u_grabPoint + 0.001);\nuv += dir * warp;`,
  },
  collage: {
    title: 'Collage',
    description: 'An editorial collage of overlapping, rotated photos rendered through a tilt-shift miniature effect.',
    howItWorks: 'The collage layout (overlapping, randomly rotated photos with captions) is captured as one composite texture. The tilt-shift shader applies a horizontal band of sharpness centered at <code>u_focusY</code> with progressive 13-tap Poisson disc blur above and below. The blur radius increases with distance from the focus band via smoothstep. A subtle brightness boost in the focus band and a vignette complete the miniature-photography look.',
    whyHiC: 'CSS <code>filter: blur()</code> applies uniformly to an entire element. A photo that spans the tilt-shift focus boundary must be sharp in its center and blurred at its edges — <em>within the same element</em>. Additionally, the blur crosses overlapping photos and their caption text seamlessly, because the shader operates on one composite texture containing all the overlapping elements. No combination of CSS filters can achieve spatially-varying blur within a single element.',
    keyCode: `// Tilt-shift: blur radius varies with distance from focus band\nfloat dist = abs(v_uv.y - u_focusY);\nfloat blurRadius = smoothstep(0.0, 0.3, dist) * u_blurStrength;\nvec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);\nfloat focusBright = 1.0 + (1.0 - smoothstep(0.0, 0.15, dist)) * 0.08;`,
  },
};
