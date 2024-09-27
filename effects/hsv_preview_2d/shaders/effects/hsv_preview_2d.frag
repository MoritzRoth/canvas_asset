
#include "common.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform vec4 g_Texture0Resolution;

uniform float u_value; // {"material":"Value","default":1,"range":[0,1]}
uniform vec2 u_hueSat; // {"material":"Hue / Saturation","linked":false,"default":"0.5 0.5","range":[0,1]}

uniform float u_selSize; // {"material":"Selection Size","default":0.05,"range":[0,0.1]}
uniform float u_selRim; // {"material":"Selection Rim","default":0.1,"range":[0,0.5]}
varying vec2 v_TexCoord;

void main() {
	vec3 bg = hsv2rgb(vec3(v_TexCoord.x, 1. - v_TexCoord.y, u_value));
	vec3 selected = hsv2rgb(vec3(u_hueSat.x, u_hueSat.y, u_value));
	
	vec2 ratCorr = vec2(1., g_Texture0Resolution.y / g_Texture0Resolution.x);
	vec2 pt = vec2(u_hueSat.x, 1. - u_hueSat.y) * ratCorr;
	vec2 uv = v_TexCoord * ratCorr;
	float d = distance(pt, uv);

	float ta = u_selSize;
	float tb = u_selSize - (u_selSize * u_selRim);
	vec3 rimColor = CAST3(step(u_value, 0.5));

	vec3 col = mix(bg, mix(selected, rimColor, step(tb, d)), step(d, ta));

	gl_FragColor = vec4(col, 1.);
}
