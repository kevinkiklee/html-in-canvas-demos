#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
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
  vec3 fromColor = srgbToLinear(texture(u_from, v_uv).rgb);
  vec3 toColor = srgbToLinear(texture(u_to, v_uv).rgb);
  float luma = dot(fromColor, vec3(0.2126, 0.7152, 0.0722));
  float edgeDist = min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y));
  float noise = hash21(v_uv * u_resolution * 0.1) * 0.15;
  float burnThreshold = u_progress * 1.8 - 0.4;
  float burn = smoothstep(burnThreshold - 0.15, burnThreshold + 0.05,
                          luma * 0.5 + (1.0 - edgeDist) * 0.5 + noise);
  float burnEdge = smoothstep(burnThreshold - 0.02, burnThreshold, luma * 0.5 + (1.0 - edgeDist) * 0.5 + noise)
                 - burn;
  vec3 hot = vec3(1.0, 0.95, 0.8) * burnEdge * 2.0;
  vec3 result = mix(fromColor + hot, toColor, burn);
  frag_color = vec4(linearToSrgb(result), 1.0);
}
