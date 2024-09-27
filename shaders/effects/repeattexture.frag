#include "common.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"material":"diffuse","label":"Diffuse","hidden":false, "default": "util/white"}
uniform vec4 g_Texture1Resolution;
uniform vec4 g_Texture0Resolution;


uniform float scale; // {"material":"Scale","default":1,"range":[0,10]}
uniform float rotation; // {"material":"Rotation","default":0,"range":[0,1]}

varying vec2 v_TexCoord;

mat2 rMat(float angle) {
	float s = sin(angle * M_PI * 2.);
	float c = cos(angle * M_PI * 2.);
	return mat2(c, -s, s, c);;
}

void main() {
	vec2 ratCorr = vec2(g_Texture0Resolution.x / g_Texture0Resolution.y, 1.);

	vec2 uv = v_TexCoord.xy;
	vec2 wrappedUV = frac(frac(mul((uv - 0.5) * ratCorr * scale, rMat(rotation))) + 0.5);
	vec4 albedo = texSample2D(g_Texture1, wrappedUV);
	gl_FragColor = albedo;
}
