// Spotlight fragment shader — cursor-following light on a dark table.
// Combines three effects that are impossible with CSS on individual elements:
//   1. Radial brightness falloff from the cursor (smoothstep, not per-element)
//   2. Distance-based Gaussian blur (sharp near cursor, soft far away)
//   3. Vignette darkening at screen edges
// All three operate on the composite HTML texture, so blur and light spill
// cross element boundaries seamlessly — a photo's blur bleeds into its caption.
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;      // composite HTML texture (entire photo grid)
uniform vec2 u_mousePos;      // normalized cursor position in UV space
uniform vec2 u_resolution;    // pixel dimensions for texel size calculation

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

vec4 discBlur(sampler2D tex, vec2 uv, float radius, vec2 texelSize) {
  if (radius < 0.001) return texture(tex, uv);
  const vec2 offsets[13] = vec2[13](
    vec2(0.0, 0.0),
    vec2(0.0, 1.0), vec2(0.0, -1.0), vec2(1.0, 0.0), vec2(-1.0, 0.0),
    vec2(0.707, 0.707), vec2(-0.707, 0.707), vec2(0.707, -0.707), vec2(-0.707, -0.707),
    vec2(0.0, 2.0), vec2(0.0, -2.0), vec2(2.0, 0.0), vec2(-2.0, 0.0)
  );
  vec4 sum = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < 13; i++) {
    vec2 offset = offsets[i] * radius * texelSize;
    float w = 1.0 - length(offsets[i]) / 2.83;
    sum += texture(tex, uv + offset) * w;
    total += w;
  }
  return sum / total;
}

void main() {
  vec2 texelSize = 1.0 / u_resolution;
  float dist = distance(v_uv, u_mousePos);
  float brightness = smoothstep(0.55, 0.0, dist) * 0.85 + 0.15;
  float blurRadius = smoothstep(0.0, 0.4, dist) * 16.0;
  vec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);
  vec3 linear = srgbToLinear(color.rgb);
  linear *= brightness;
  float vig = 1.0 - smoothstep(0.4, 0.85, length(v_uv - 0.5));
  linear *= vig;
  frag_color = vec4(linearToSrgb(linear), 1.0);
}
