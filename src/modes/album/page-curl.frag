#version 300 es
precision highp float;
// Page curl fragment shader — adds paper texture, spine shadow, and warm tint
// to the HTML page texture. The curl deformation itself is vertex displacement
// (handled by the tessellated mesh + vertex shader); this shader handles the
// surface appearance: paper noise grain, a darkened spine edge, a shadow that
// deepens as the page curls, and a warm color tint simulating aged paper.

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;
uniform float u_curlProgress;  // 0 = flat, 1 = fully turned
uniform float u_isBack;        // 1.0 when rendering the page back (mirrors UV)
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
  vec2 uv = v_uv;
  if (u_isBack > 0.5) {
    uv.x = 1.0 - uv.x;
  }
  vec3 color = srgbToLinear(texture(u_tex, uv).rgb);
  float paperNoise = hash21(v_uv * u_resolution * 0.5) * 0.03;
  color += paperNoise;
  float spineShadow = smoothstep(0.0, 0.12, uv.x);
  color *= mix(0.7, 1.0, spineShadow);
  float curlShadow = 1.0 - u_curlProgress * 0.2 * (1.0 - uv.x);
  color *= curlShadow;
  color *= vec3(1.0, 0.995, 0.985);
  frag_color = vec4(linearToSrgb(color), 1.0);
}
