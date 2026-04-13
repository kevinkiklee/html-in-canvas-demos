#version 300 es
precision highp float;
// Shared vertex shader for all post-processing and mode shaders.
// Maps quad vertices from [-1,1] to a destination rectangle in clip space
// via u_dst, and passes UV coordinates to the fragment shader.
// Used with both the simple fullscreen quad and tessellated quads (page curl,
// paper warp) — the tessellated version has more vertices but same attributes.

layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;

out vec2 v_uv;

uniform vec4 u_dst; // (x, y, w, h) in clip space

void main() {
  // Remap from [-1,1] to [0,1], then scale/translate by u_dst
  vec2 clip = u_dst.xy + (a_pos * 0.5 + 0.5) * u_dst.zw;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
}
