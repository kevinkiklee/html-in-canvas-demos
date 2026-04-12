// Rack focus transition — simulates a cinema lens pull: the outgoing slide
// blurs out of focus while the incoming slide racks into focus. Both slides
// use a 13-tap Poisson disc blur whose radius is driven by u_progress. The
// blend happens in the middle (0.3–0.7) when both are slightly soft, just
// like a real focus pull where neither subject is perfectly sharp mid-rack.
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;

uniform sampler2D u_from;     // outgoing slide
uniform sampler2D u_to;       // incoming slide
uniform float u_progress;     // 0..1 — controls blur radii and blend point
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
  float fromBlur = smoothstep(0.0, 0.6, u_progress) * 20.0;
  float toBlur = smoothstep(1.0, 0.4, u_progress) * 20.0;
  vec4 fromColor = discBlur(u_from, v_uv, fromBlur, texelSize);
  vec4 toColor = discBlur(u_to, v_uv, toBlur, texelSize);
  vec3 fromLinear = srgbToLinear(fromColor.rgb);
  vec3 toLinear = srgbToLinear(toColor.rgb);
  float t = smoothstep(0.3, 0.7, u_progress);
  vec3 result = mix(fromLinear, toLinear, t);
  frag_color = vec4(linearToSrgb(result), 1.0);
}
