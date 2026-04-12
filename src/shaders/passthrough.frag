// Passthrough fragment shader — draws an HTML texture with no effects.
// Used by the shell as the default renderer when no mode hook is set,
// and by modes (e.g., slideshow) for static display between transitions.
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 frag_color;
uniform sampler2D u_tex;

void main() {
  frag_color = texture(u_tex, v_uv);
}
