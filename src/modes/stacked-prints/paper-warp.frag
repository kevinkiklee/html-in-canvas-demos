#version 300 es
precision highp float;
// Paper warp fragment shader — simulates flexible paper being lifted and tossed.
// Displaces UV coordinates radially from the grab point using a sine wave,
// creating a natural paper-curl effect. Also adds paper texture noise, a
// depth-based shadow (darker when lifted higher), and a warm tint.
// The UV displacement works on the composite HTML texture, so the photo,
// caption, and EXIF data all warp together as one continuous surface.

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;          // print face HTML texture (photo + caption)
uniform vec2 u_resolution;
uniform vec2 u_grabPoint;         // normalized position where user grabbed the print
uniform float u_liftAmount;       // how far the paper is lifted (drives warp intensity)
uniform float u_isBack;           // 1.0 when rendering print back (mirrors UV horizontally)

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
  float dist = distance(uv, u_grabPoint);
  float warp = sin(dist * 3.14159) * u_liftAmount * 0.08;
  vec2 dir = normalize(uv - u_grabPoint + 0.001);
  uv += dir * warp;
  if (u_isBack > 0.5) {
    uv.x = 1.0 - uv.x;
  }
  uv = clamp(uv, 0.0, 1.0);
  vec3 color = srgbToLinear(texture(u_tex, uv).rgb);
  float paper = hash21(v_uv * u_resolution * 0.4) * 0.025;
  color += paper;
  float shadow = 1.0 - u_liftAmount * 0.15 * (1.0 - dist);
  color *= shadow;
  color *= vec3(1.0, 0.995, 0.985);
  frag_color = vec4(linearToSrgb(color), 1.0);
}
