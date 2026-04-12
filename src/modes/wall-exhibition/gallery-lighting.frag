#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform float u_scrollY;

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
  vec3 htmlColor = srgbToLinear(texture(u_tex, v_uv).rgb);
  float wallNoise1 = hash21(v_uv * u_resolution * 0.3) * 0.02;
  float wallNoise2 = hash21(v_uv * u_resolution * 0.05 + 100.0) * 0.03;
  vec3 wallColor = vec3(0.045, 0.043, 0.05) + wallNoise1 + wallNoise2;
  float htmlLuma = dot(htmlColor, vec3(0.2126, 0.7152, 0.0722));
  float isContent = smoothstep(0.02, 0.06, htmlLuma);
  vec3 composited = mix(wallColor, htmlColor, isContent);
  float lightSpacing = 0.25;
  float nearestLight = round(v_uv.y / lightSpacing) * lightSpacing;
  float lightDist = abs(v_uv.y - nearestLight);
  float hCenter = 1.0 - abs(v_uv.x - 0.5) * 0.6;
  float lighting = hCenter * (1.0 / (1.0 + lightDist * lightDist * 40.0));
  float ambient = 0.25;
  float totalLight = ambient + lighting * 0.85;
  composited *= totalLight;
  composited *= vec3(1.0, 0.98, 0.96);
  frag_color = vec4(linearToSrgb(composited), 1.0);
}
