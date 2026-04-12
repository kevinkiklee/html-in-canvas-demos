// Tilt-shift fragment shader — creates a miniature/diorama effect.
// Applies a horizontal band of sharpness (centered at u_focusY) with
// progressive disc blur above and below, simulating a tilt-shift lens.
// The key HiC insight: a photo straddling the focus boundary is sharp in
// its center and blurred at its edges — within the same DOM element. CSS
// blur is uniform per-element and cannot vary spatially within one element.
// Also adds subtle brightness boost in the focus band and a vignette.
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;          // composite collage HTML texture
uniform vec2 u_resolution;
uniform float u_focusY;           // vertical center of the sharp band (0..1)
uniform float u_blurStrength;     // maximum blur radius at screen edges

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
  float dist = abs(v_uv.y - u_focusY);
  float blurRadius = smoothstep(0.0, 0.3, dist) * u_blurStrength;
  vec4 color = discBlur(u_tex, v_uv, blurRadius, texelSize);
  vec3 linear = srgbToLinear(color.rgb);
  float focusBright = 1.0 + (1.0 - smoothstep(0.0, 0.15, dist)) * 0.08;
  linear *= focusBright;
  float vig = 1.0 - smoothstep(0.35, 0.9, length(v_uv - 0.5));
  linear *= vig;
  frag_color = vec4(linearToSrgb(linear), 1.0);
}
