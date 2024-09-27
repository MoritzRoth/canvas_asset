
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Sweep Mode","combo":"MODE","type":"options","default":0,"options":{"Directional":0,"Circle":1,"Clock":2}}
// [COMBO] {"material":"Value Range Setting","combo":"RANGE","type":"options","default":0,"options":{"Default Greyscale (256 Values)":0,"Red & Green Channel (65536 Values)":1}}

#include "common.h"
#include "common_blending.h"


#define MODE_DIR 0
#define MODE_CIR 1
#define MODE_CLOCK 2

#define RANGE_BW 0
#define RANGE_RG 1

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform vec2 g_TexelSize;
uniform vec4 g_Texture0Resolution;

uniform vec2 circleCenter; // {"material":"Center","position":true,"default":"0.5 0.5"}
uniform float rotation; // {"material":"Rotation","default":0,"range":[0,1]}
uniform float alpha; // {"material":"Alpha","default":"1.0","range":[0,1]}
uniform float invert; // {"material":"Invert","int":true,"default":0,"range":[0,1]}

varying vec2 v_TexCoord;

float decode_rg_range(vec2 rg) {
	return min(rg.r + rg.g / pow(2.,8.), 1.);
}
vec2 encode_rg_range(float v) {
	float g = frac(v * pow(2., 8.));
	return vec2(v - g * pow(2., -8.) , g);
}

// maps the given value val from range1 to range2 (x = lower bound, y = upper bound)
float map_range(vec2 range1, vec2 range2, float val) {
	return ((val - range1.x) / (range1.y - range1.x)) * (range2.y - range2.x) + range2.x;
}

void main() {
	vec2 texSize = g_Texture0Resolution.zw;
	vec2 pxCoord = v_TexCoord * texSize;

	vec2 corner[4];
	corner[0] = vec2(0.,0.);
	corner[1] = vec2(0.,1.) * texSize;
	corner[2] = vec2(1.,0.) * texSize;
	corner[3] = vec2(1.,1.) * texSize;

	float minV = 0.;
	float maxV = 0.;
	float val = 0.;

	#if(MODE == MODE_CIR || MODE == MODE_DIR)
		#if(MODE == MODE_DIR)
			vec2 centerPx = texSize * 0.5 + vec2(sin(rotation * M_PI_2), cos(rotation * M_PI_2)) * length(texSize) * 1000.;
		#endif
		#if(MODE == MODE_CIR)
			vec2 centerPx = circleCenter * texSize;
		#endif
		
		val = distance(pxCoord, centerPx);
		minV = distance(clamp(centerPx, corner[0], texSize), centerPx);
		maxV = distance(corner[0], centerPx);
		for(int i = 1; i < 4; i++) {
			float d = distance(corner[i], centerPx);
			maxV = mix(maxV, d, maxV < d);
		}
	#endif
	#if(MODE == MODE_CLOCK)
		vec2 centerPx = circleCenter * texSize;

		float inside = clamp(centerPx, corner[0], texSize) == centerPx;
		float edge = inside * (float(min(centerPx.x, centerPx.y) == 0) + float(centerPx.x == texSize.x) + float(centerPx.y == texSize.y));

		/*if(inside) {
			vec2 cutCheckPt = centerPx + vec2(sin(rotation * M_PI_2), cos(rotation * M_PI_2));
			float cut_inside = float(clamp(cutCheckPt, corner[0], texSize) == cutCheckPt);
		}else {

			minV = mix(minV, 0., cut_inside);
			maxV = mix(maxV, 1., cut_inside);
		}*/

		vec2 offset = centerPx - pxCoord;
		val = frac((atan2(offset.x, offset.y) / M_PI_2 + 0.5) + rotation);
		maxV = 1.;
	#endif

	val = map_range(vec2(minV, maxV), vec2(0.,1.), val);
	val = mix(val, 1. - val, invert);


	vec3 background = texSample2D(g_Texture0, v_TexCoord).rgb;
	#if(RANGE == RANGE_RG)
		background = CAST3(decode_rg_range(background.rg));
	#endif
	vec3 v = ApplyBlending(BLENDMODE, background, CAST3(val), alpha);
	#if(RANGE == RANGE_RG)
		v = vec3(encode_rg_range(v.r), 0.);
	#endif

	gl_FragColor = vec4(v, 1.);
}
