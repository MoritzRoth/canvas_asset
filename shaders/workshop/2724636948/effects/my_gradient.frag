
#include "common.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform vec4 g_Texture0Resolution;
uniform float u_ypos; // {"material":"Gradient Position","default":0.0,"range":[-1,1]}
uniform float u_grot; // {"material":"Gradient Rotation","default":0.0,"range":[-1,1]}
uniform float u_opacity; // {"material":"Opacity","default":1.0,"range":[0,1]}
uniform vec3 u_col1; // {"default":"1 0 0","material":"Gradient 1","type":"color"}
uniform vec3 u_col2; // {"default":"0 0 0","material":"Gradient 2","type":"color"}

varying vec4 v_TexCoord;

void main() {
	vec2 uv = ((v_TexCoord.xy-0.5)*g_Texture0Resolution.xy)/g_Texture0Resolution.y;
	vec2 cuv = rotateVec2(uv,M_PI*u_grot);
	vec3 col = mix(u_col1,u_col2,cuv.y+u_ypos+0.5);
	gl_FragColor = vec4(col,u_opacity);
}
