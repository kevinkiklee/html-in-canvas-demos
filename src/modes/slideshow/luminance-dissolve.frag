#version 300 es
precision highp float;
// Luminance dissolve transition — pixels transition based on their brightness.
// Bright areas of the outgoing slide dissolve first, dark areas last. This
// creates an organic, non-uniform wipe that follows image content rather than
// a geometric pattern. A subtle glow at the dissolve boundary adds polish.
// The threshold sweeps from -0.2 to ~1.2 to ensure full coverage.

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;     // outgoing slide
uniform sampler2D u_to;       // incoming slide
uniform float u_progress;     // 0..1 — sweeps the luminance threshold

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 fromColor = srgbToLinear(texture(u_from, v_uv).rgb);
  vec3 toColor = srgbToLinear(texture(u_to, v_uv).rgb);
  float luma = dot(fromColor, vec3(0.2126, 0.7152, 0.0722));
  float threshold = u_progress * 1.4 - 0.2;
  float t = smoothstep(threshold - 0.15, threshold + 0.15, luma);
  float edge = smoothstep(threshold - 0.02, threshold, luma)
             - smoothstep(threshold, threshold + 0.02, luma);
  vec3 glow = vec3(1.0, 0.98, 0.95) * edge * 0.3;
  vec3 result = mix(fromColor + glow, toColor, t);
  frag_color = vec4(linearToSrgb(result), 1.0);
}
