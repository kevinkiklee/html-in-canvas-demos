// Common GLSL utilities shared across all mode shaders.
//
// NOTE: This file is a REFERENCE — it is not automatically concatenated into
// mode shaders. Each .frag file inlines the functions it needs (srgbToLinear,
// linearToSrgb, hash21, discBlur) because Vite's `?raw` import returns plain
// strings with no #include mechanism. Keep this file as the canonical source
// of truth: when updating a function here, update all .frag copies too.
//
// sRGB linearization is critical for HTML-in-Canvas: textures captured from
// DOM elements are in sRGB gamma space. Doing math (blending, lighting, blur)
// directly on sRGB values produces incorrect results — washed highlights,
// crushed shadows, wrong color mixing. Always: srgbToLinear before math,
// linearToSrgb before output.

// sRGB linearization — MUST use for all shader math on HTML textures
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}

vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

// Pseudo-random hash
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

// Film grain
float grain(vec2 uv, vec2 resolution, float time, float strength) {
  float n = hash21(uv * resolution + time * 0.2) - 0.5;
  return n * strength;
}

// Vignette
float vignette(vec2 uv, float radius, float softness) {
  float d = length(uv - 0.5);
  return 1.0 - smoothstep(radius, radius + softness, d);
}

// Smooth disc blur (13-tap Poisson disc)
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
