#version 300 es
precision highp float;
// Curvature fragment shader — bends the filmstrip into a 3D-looking surface.
// Displaces UV coordinates quadratically based on horizontal distance from
// center, simulating a film strip curving away from the viewer at the edges.
// Also applies edge darkening (simulating light falloff on a curved surface)
// and a subtle center glow (the "sweet spot" where film sits flat on a light
// table). This is a UV-space effect, not vertex displacement — simpler but
// effective for a single-axis curve.

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_tex;          // composite filmstrip HTML texture
uniform vec2 u_resolution;
uniform float u_curvature;        // bend amount (0 = flat, 0.12 = subtle curve)

vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 center = v_uv - 0.5;
  float xDist = center.x * 2.0;
  float curve = xDist * xDist * u_curvature;
  float xScale = 1.0 - abs(xDist) * 0.03;
  vec2 curved_uv = vec2(
    0.5 + center.x * xScale,
    v_uv.y + curve
  );
  if (curved_uv.x < 0.0 || curved_uv.x > 1.0 || curved_uv.y < 0.0 || curved_uv.y > 1.0) {
    frag_color = vec4(0.04, 0.04, 0.043, 1.0);
    return;
  }
  vec3 color = srgbToLinear(texture(u_tex, curved_uv).rgb);
  float edgeDark = 1.0 - abs(xDist) * 0.25;
  color *= edgeDark;
  float centerGlow = 1.0 + (1.0 - xDist * xDist) * 0.1;
  color *= centerGlow;
  frag_color = vec4(linearToSrgb(color), 1.0);
}
