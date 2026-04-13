#version 300 es
precision highp float;
// Gallery lighting fragment shader — simulates overhead spotlights in a museum.
// Composites the HTML layout onto a procedural wall texture (subtle noise),
// then applies per-pixel lighting: evenly-spaced overhead spots with
// inverse-square falloff, horizontal centering bias, and a warm color tint.
// CSS cannot do per-pixel lighting within a single element, and the light
// spill crosses element boundaries (a photo's light bleeds onto the wall
// behind and below it). Ambient light provides a base so shadows aren't pure black.

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;      // composite HTML texture (photos + plaques)
uniform vec2 u_resolution;

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

void main() {
  // DEBUG: raw texture output — no sRGB, no lighting, no compositing
  frag_color = texture(u_tex, v_uv);
}
