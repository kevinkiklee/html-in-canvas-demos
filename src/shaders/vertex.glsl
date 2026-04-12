#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;

out vec2 v_uv;

uniform vec4 u_dst; // (x, y, w, h) in clip space

void main() {
  vec2 clip = u_dst.xy + (a_pos * 0.5 + 0.5) * u_dst.zw;
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = a_uv;
}
