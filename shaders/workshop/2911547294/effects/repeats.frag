

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}

varying vec2 v_TexCoord;

uniform float repeats; // {"material":"Repeats","int":true,"default":3,"range":[2,100]}
uniform float alpha; // {"default":"1.0","material":"Alpha","range":[0,1]}

// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Value Range Setting","combo":"RANGE","type":"options","default":0,"options":{"Default Greyscale (256 Values)":0,"Red & Green Channel (65536 Values)":1}}
// [COMBO] {"material":"Ping-Pong Mode","combo":"PINGPONG","type":"options","default":0}

#include "common.h"
#include "common_blending.h"

#define RANGE_BW 0
#define RANGE_RG 1

float decode_rg_range(vec2 rg) {
	return min(rg.r + rg.g / pow(2.,8.), 1.);
}
vec2 encode_rg_range(float v) {
	float g = frac(v * pow(2., 8.));
	return vec2(v - g * pow(2., -8.) , g);
}

void main() {
	vec3 background = texSample2D(g_Texture0, v_TexCoord).rgb;
	#if(RANGE == RANGE_RG)
		background = CAST3(decode_rg_range(background.rg));
	#endif

	#if(PINGPONG == 0)
		vec3 v = ApplyBlending(BLENDMODE, background, CAST3(frac(background.r * repeats)), alpha);
	#endif
	#if(PINGPONG == 1)
		vec3 v = ApplyBlending(BLENDMODE, background, CAST3(abs(frac(background.r * (repeats-1.))-0.5)*2.), alpha);
	#endif

	#if(RANGE == RANGE_RG)
		v = vec3(encode_rg_range(v.r), 0.);
	#endif

	gl_FragColor = vec4(v, 1.);
}
