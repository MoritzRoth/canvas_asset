
#include "common.h"
#include "common_blending.h"

// [COMBO] {"material":"Grid Type", "combo":"GRID_TYPE", "type":"options", "default": 1, "options":{"Squares":1, "Hexagons":2}}
// [COMBO] {"material":"Color Options", "combo":"COLORS", "type":"options", "default": 2, "options":{"Back & White":1, "CMYK":2, "RGB":3, "Custom Color": 4}}
// [COMBO] {"material":"Sample Mode", "combo":"SAMPLE", "type":"options", "default":1, "options":{"Below, relative to Screen":0, "Below, relative to Layer Transform":1, "From Texture": 2}}
// [COMBO] {"material":"Draw Style","combo":"DRAW_STYLE","type":"options","default":2,"options":{"Disconnected Dots":0, "Overlapping Dots": 1, "Joined Dots":2}}
// [COMBO] {"material":"Check if using Post-Processing Layer","combo":"IS_POST_PROCESSING_LAYER","type":"options","default":0}
// [COMBO] {"material":"Blend with background","combo":"BG_BLEND","type":"options","default":0}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0, "require":{"BG_BLEND":1}}
// [COMBO] {"material":"Edit grid transforms","combo":"EDIT_GRID_TRANSFORM","type":"options","default":0}

#define SAMPLE_BELOW_SCREEN 0
#define SAMPLE_BELOW_OBJECT 1
#define SAMPLE_FROM_TEXTURE 2

uniform float u_blendAlpha; // {"default":"1","material":"Blend Alpha","range":[0,1]}
uniform float u_dotSize; // {"material":"Dot Size","default":0.1,"range":[0,1]}
uniform float u_dotSharpness; // {"material":"Dot Sharpness","default":0.95,"range":[0,1]}
uniform float u_dotMerging; // {"material":"Dot Merge Strength","default":1,"range":[0,1]}
uniform float u_dotThreshMod; // {"default":"0","material":"Dot Threshold Adjustment","range":[-1,1]}

#if EDIT_GRID_TRANSFORM == 1
#if SAMPLE == SAMPLE_BELOW_SCREEN
uniform vec2 u_uvOrigin1; // {"default":"0.4476 0.45774","linked":false,"material":"Rotation 1 Center","range":[0,1]}
uniform vec2 u_uvOrigin2; // {"default":"0.53211 0.57613","linked":false,"material":"Rotation 2 Center","range":[0,1]}
uniform vec2 u_uvOrigin3; // {"default":"0.38768 0.61634","linked":false,"material":"Rotation 3 Center","range":[0,1]}
uniform vec2 u_uvOrigin4; // {"default":"0.5257 0.32994","linked":false,"material":"Rotation 4 Center","range":[0,1]}
#endif
#if SAMPLE == SAMPLE_BELOW_OBJECT || SAMPLE == SAMPLE_FROM_TEXTURE
uniform vec2 u_uvOrigin1; // {"default":"0.4476 0.45774","material":"Rotation 1 Center","position":true}
uniform vec2 u_uvOrigin2; // {"default":"0.53211 0.57613","material":"Rotation 2 Center","position":true}
uniform vec2 u_uvOrigin3; // {"default":"0.38768 0.61634","material":"Rotation 3 Center","position":true}
uniform vec2 u_uvOrigin4; // {"default":"0.5257 0.32994","material":"Rotation 4 Center","position":true}
#endif
uniform float u_gridRotation1; // {"material":"Rotation 1","default":15,"range":[0,360]}
uniform float u_gridRotation2; // {"material":"Rotation 2","default":105,"range":[0,360]}
uniform float u_gridRotation3; // {"material":"Rotation 3","default":75,"range":[0,360]}
uniform float u_gridRotation4; // {"material":"Rotation 4","default":90,"range":[0,360]}
#else
#define u_uvOrigin1 vec2(0.4476, 0.45774)
#define u_uvOrigin2 vec2(0.53211, 0.57613)
#define u_uvOrigin3 vec2(0.38768, 0.61634)
#define u_uvOrigin4 vec2(0.5257, 0.32994)
#define u_gridRotation1 15.0
#define u_gridRotation2 105.0
#define u_gridRotation3 75.0
#define u_gridRotation4 90.0
#endif

uniform vec3 u_mask; // {"default":"0 1 1","material":"Color Key","type":"color"}
uniform float u_thresh; // {"default":"1","material":"Color Key Threshold","range":[0,1]}
uniform vec3 u_color; // {"default":"0 1 1","material":"Dot Color","type":"color"}
uniform vec3 u_bg; // {"default":"1 1 1","material":"Background Color","type":"color"}

#define GRID_TYPE_SQ 1
#define GRID_TYPE_HEX 2

#define COLORS_BW 1
#define COLORS_CMYK 2
#define COLORS_RGB 3
#define COLORS_1 4

#define DRAW_STYLE_DISCONNECTED 0
#define DRAW_STYLE_OVERLAP 1
#define DRAW_STYLE_JOINED 2

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"default":"util/clouds_256","label":"Sample Texture","material":"smapleTex"}
uniform vec4 g_Texture0Resolution;
uniform vec4 g_Texture1Resolution;
uniform mat4 g_EffectModelViewProjectionMatrixInverse;
uniform mat4 g_EffectModelViewProjectionMatrix;
uniform mat4 g_ModelViewProjectionMatrixInverse;
uniform mat4 g_EffectTextureProjectionMatrix;
uniform mat4 g_EffectTextureProjectionMatrixInverse;
uniform vec2 g_TexelSize;

varying vec4 v_TexCoord;
varying vec2 sspos;


// utils
// stolen from https://gist.github.com/mattdesl/e40d3189717333293813626cbdb2c1d1
vec3 CMYKtoRGB (vec4 cmyk) {
    float c = cmyk.x;
    float m = cmyk.y;
    float y = cmyk.z;
    float k = cmyk.w;

    float invK = 1.0 - k;
    float r = 1.0 - min(1.0, c * invK + k);
    float g = 1.0 - min(1.0, m * invK + k);
    float b = 1.0 - min(1.0, y * invK + k);
    return clamp(vec3(r, g, b), 0.0, 1.0);
}

// stolen from https://gist.github.com/mattdesl/e40d3189717333293813626cbdb2c1d1
vec4 RGBtoCMYK (vec3 rgb) {
    float r = rgb.r;
    float g = rgb.g;
    float b = rgb.b;
    float k = min(1.0 - r, min(1.0 - g, 1.0 - b));
    vec3 cmy = CAST3(0.);
    float invK = 1.0 - k;
    if (invK != 0.0) {
        cmy.x = (1.0 - r - k) / invK;
        cmy.y = (1.0 - g - k) / invK;
        cmy.z = (1.0 - b - k) / invK;
    }
    return clamp(vec4(cmy, k), 0.0, 1.0);
}

float mod(float x, float y) {
	return x - y * floor(x / y);
}
vec2 modV2(vec2 x, vec2 y) {
	return vec2(mod(x.x, y.x), mod(x.y, y.y));
}

mat2 rMat(float angle) {
	float s = sin(angle * M_PI * 2.);
	float c = cos(angle * M_PI * 2.);
	return mat2(c, -s, s, c);
}

// Hash without Sine
// MIT License...
/* Copyright (c)2014 David Hoskins.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.*/

//----------------------------------------------------------------------------------------
//  1 out, 2 in...
float hash12(vec2 p)
{
	vec3 p3 = frac(p.xyx * .1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return frac((p3.x + p3.y) * p3.z);
}





// tiling

const float sr3 = sqrt(3.);
const float hr3 = sqrt(3.) / 2.;
const float sr2 = sqrt(2.);


struct Grid {
	vec2 cuv;		// cartesian uvs
	vec2 puv;		// polar uvs
	vec2 id;		// these are NOT integers, each grid cell has the same value, values increase along x/y-axes
	float rand;		// random value for each grid cell in interval [0,1]
	float type;		// if grids consist of multiple shapes or mirrored versions of the same shape each shape has it's own index
};

float selectMin(float v1, float v2) {
	return (sign(v1 - v2) + 1.) / 2.;
}

float hexDist(vec2 uv) {
	float dist = abs(uv.x) * 2.;
	dist = max(dist, dot(abs(uv), vec2(1., sr3)));

	return dist;
}

Grid hexGrid(vec2 uv) {
	Grid hg;

	vec2 hexR = vec2(1., sr3);	//hexagon Ratio
	vec2 hhexR = hexR * .5;		//half hexagon Ratio

	vec2 r1UV = modV2(uv, hexR);
	vec2 r2UV = modV2(uv - hhexR, hexR);

	float r1 = hexDist(r1UV - hhexR);
	float r2 = hexDist(r2UV - hhexR);


	hg.cuv = mix(r1UV - hhexR, r2UV - hhexR, selectMin(r1, r2));

	float dist = min(r1, r2);
	float angle = atan2(hg.cuv.x, hg.cuv.y) / (M_PI * 2.) + .5;
	hg.puv = vec2(dist, angle);

	hg.id = uv - hg.cuv + 0.0001;
	//hg.id /= vec2(1., hr3);
	hg.rand = hash12(hg.id + 0.01);
	hg.type = 1.;

	return hg;
}

Grid squareGrid(vec2 uv) {
	Grid sg;

	sg.cuv = modV2(uv + 0.5, CAST2(1)) - 0.5;
	float dist = max(abs(sg.cuv.x), abs(sg.cuv.y)) * 2.;
	float angle = atan2(sg.cuv.x, sg.cuv.y) / (M_PI * 2) + .5;
	sg.puv = vec2(dist, angle);
	sg.id = uv - sg.cuv + 0.0001;
	sg.rand = hash12(sg.id + 0.01);
	sg.type = 1.;

	return sg;
}

// converts screen space position to uv coordinate
vec2 SStoUV(vec2 ss_pos) {
	#if IS_POST_PROCESSING_LAYER == 0
		// convert ss_pos back to ndc pos (see vertex shader)
		vec2 ndc = vec2(ss_pos.x, 1. - ss_pos.y) * 2. - 1.;
		// apply EffectTextureProjectionMatrixInverse
		vec2 tex = mul(vec4(ndc ,0.,1.), g_EffectTextureProjectionMatrixInverse).xy;
		// adjust to fit vertex coordinates
		return vec2(1. + tex.x, 1. - tex.y) / 2.;
	#endif
	#if IS_POST_PROCESSING_LAYER == 1
		return mul(vec4(ss_pos, 0., 1.), g_ModelViewProjectionMatrixInverse).xy;
	#endif
}

// exponential smooth min
float opSmoothUnion( float a, float b, float k )
{
	k = (1. - sqrt(k) * 0.9) * 64.;
    float res = exp2( -k*a ) + exp2( -k*b );
    return -log2( res )/k;
}


vec2 fixSUV(vec2 suv, vec2 ratCorr) {
	#if SAMPLE == SAMPLE_BELOW_SCREEN
		// bring suv back into sspos format (undo modifications at start of main)
		return SStoUV(suv / ratCorr + 0.5);
	#endif
	#if SAMPLE == SAMPLE_BELOW_OBJECT || SAMPLE == SAMPLE_FROM_TEXTURE
		return (suv / ratCorr) + 0.5;
	#endif
}

float getDotRadius(vec2 samplePoint, vec2 ratCorr, vec4 mask) {
	#if SAMPLE == SAMPLE_FROM_TEXTURE
		vec3 rgb = texSample2D(g_Texture1, fixSUV(samplePoint, ratCorr)).rgb;
	#else
		vec3 rgb = texSample2D(g_Texture0, fixSUV(samplePoint, ratCorr)).rgb;
	#endif

	#if COLORS == COLORS_CMYK
		vec4 cmyk = RGBtoCMYK(rgb) * mask;
		float dotArea = (cmyk.x + cmyk.y + cmyk.z + cmyk.w) / (mask.x + mask.y + mask.z + mask.w);
	#endif
	#if COLORS == COLORS_RGB
		vec3 masked = rgb * mask.rgb;
		float dotArea = masked.r + masked.g + masked.b;
	#endif
	#if COLORS == COLORS_1 || COLORS == COLORS_BW
		float t = max(u_thresh, 0.000001);
		float dotArea = max(0., (sr3 * t) - length(rgb - mask.rgb)) / (sr3 * t);
	#endif

	return sqrt(dotArea);
}

float visitNeighbors(vec2 samplePoint, vec2 pos, float val, float influence, float neighborCount, vec2 neighborOffset, vec2 neighborSampleOffset, vec2 ratCorr, float dSharp, vec4 mask) {
	mat2 rot = rMat(1. / neighborCount);
	for(float dir = 0.; dir < neighborCount; dir++) {
		float dotRadius = getDotRadius(samplePoint + neighborSampleOffset, ratCorr, mask);

		#if DRAW_STYLE == DRAW_STYLE_OVERLAP
			val = max(val, 1. - smoothstep(dotRadius - dSharp / 2., dotRadius + dSharp / 2., length(pos - neighborOffset)));
		#endif
		#if DRAW_STYLE == DRAW_STYLE_JOINED
			val = opSmoothUnion(val, length(pos - neighborOffset) - dotRadius, u_dotMerging);
		#endif

		neighborOffset = mul(neighborOffset, rot);
		neighborSampleOffset = mul(neighborSampleOffset, rot);
	}
	return val;
}

float getColorContrib(vec2 uv, vec2 ratCorr, float rot, vec2 offset, vec4 mask) {
	Grid gr;
	float deco = 0.;
	vec2 suv = uv;  // sample uv

	float dSize = max(u_dotSize * u_dotSize, max(g_TexelSize.x, g_TexelSize.y));
	float dSharp = 1. - u_dotSharpness;

	vec2 duv = (uv.xy - offset) /  dSize;

	mat2 r = rMat(rot);
	mat2 rInv = rMat(-rot);

	#if(GRID_TYPE == GRID_TYPE_SQ)
		duv = mul(duv, r);
		gr = squareGrid(duv);
		#if (DRAW_STYLE == DRAW_STYLE_JOINED || DRAW_STYLE == DRAW_STYLE_OVERLAP)
			gr.cuv *= sr2;	// scale cuv so that verts have dist 1
			vec2 edgeNeighborOffset = vec2(2. / sr2, 0.0);
			vec2 edgeNeighborSampleOffset = mul(vec2(dSize, 0.0), rInv);
			const float edgeNeighbors = 4.;
			vec2 vertNeighborOffset = CAST2(2./ sr2);
			vec2 vertNeighborSampleOffset = mul(CAST2(dSize), rInv);
			const float vertNeighbors = 4.;
		#endif
		#if (DRAW_STYLE == DRAW_STYLE_DISCONNECTED)
			gr.cuv *= 2.;	// scale cuv so that edges have dist 1
		#endif
		suv = (mul(gr.id, rInv) * dSize + offset);
	#endif
	#if(GRID_TYPE == GRID_TYPE_HEX)
		duv = mul(duv / hr3, rMat(rot));
		gr = hexGrid(duv);
		#if (DRAW_STYLE == DRAW_STYLE_JOINED || DRAW_STYLE == DRAW_STYLE_OVERLAP)
			gr.cuv *= 2. * hr3;	// scale cuv so that verts have dist 1
			vec2 edgeNeighborOffset = vec2(sr3, 0.0);
			vec2 edgeNeighborSampleOffset = mul(vec2(dSize * hr3, 0.0), rInv);
			const float edgeNeighbors = 6.;
			vec2 vertNeighborOffset = CAST2(0.);
			vec2 vertNeighborSampleOffset = CAST2(0.);
			const float vertNeighbors = 0.;
		#endif
		#if (DRAW_STYLE == DRAW_STYLE_DISCONNECTED)
			gr.cuv *= 2.;	// scale cuv so that edges have dist 1
		#endif
		suv = (mul(gr.id, rInv) * dSize * hr3 + offset);
	#endif

	float dotRadius = getDotRadius(suv, ratCorr, mask);
	#if DRAW_STYLE == DRAW_STYLE_DISCONNECTED
		return 1. - smoothstep(dotRadius - dSharp / 2. + u_dotThreshMod, dotRadius + dSharp / 2. + u_dotThreshMod, length(gr.cuv));
	#endif
	#if DRAW_STYLE == DRAW_STYLE_OVERLAP
		float influence = length(edgeNeighborOffset);
		float insideDot = 1. - smoothstep(dotRadius - dSharp / 2. +u_dotThreshMod, dotRadius + dSharp / 2. + u_dotThreshMod, length(gr.cuv));


		insideDot = visitNeighbors(suv, gr.cuv, insideDot, influence, edgeNeighbors, edgeNeighborOffset, edgeNeighborSampleOffset, ratCorr, dSharp, mask);
		insideDot = visitNeighbors(suv, gr.cuv, insideDot, influence, vertNeighbors, vertNeighborOffset, vertNeighborSampleOffset, ratCorr, dSharp, mask);
		
		return insideDot;
	#endif
	#if DRAW_STYLE == DRAW_STYLE_JOINED
		float influence = length(edgeNeighborOffset);
		float dotSd = length(gr.cuv) - dotRadius;


		dotSd = visitNeighbors(suv, gr.cuv, dotSd, influence, edgeNeighbors, edgeNeighborOffset, edgeNeighborSampleOffset, ratCorr, dSharp, mask);
		dotSd = visitNeighbors(suv, gr.cuv, dotSd, influence, vertNeighbors, vertNeighborOffset, vertNeighborSampleOffset, ratCorr, dSharp, mask);

		return 1. - smoothstep(-dSharp / 2. + u_dotThreshMod, dSharp / 2. + u_dotThreshMod, dotSd);
	#endif
	
}

void main() {
    #if SAMPLE == SAMPLE_BELOW_OBJECT || SAMPLE == SAMPLE_FROM_TEXTURE
		vec2 ratCorr = g_Texture0Resolution.xy / g_Texture0Resolution.y;
		vec2 uv = (v_TexCoord.xy - 0.5) * ratCorr;
	#endif
    #if SAMPLE == SAMPLE_BELOW_SCREEN
		vec2 ratCorr = g_TexelSize.yx/g_TexelSize.x;
		vec2 uv = (sspos - 0.5) * ratCorr;
    #endif
    


	#if COLORS == COLORS_BW
		vec4 blackMask = CAST4(0.);
		float val = getColorContrib(uv, ratCorr, u_gridRotation1 /360., (u_uvOrigin1 - 0.5) * ratCorr, CAST4(0.));

		vec3 albedo = CAST3(1.-val);
	#endif
	#if COLORS == COLORS_1
		float val = getColorContrib(uv, ratCorr, u_gridRotation1 /360., (u_uvOrigin1 - 0.5) * ratCorr, vec4(u_mask, 0.));

		vec3 albedo = mix(u_bg, u_color, val);
	#endif
	#if COLORS == COLORS_CMYK
		const vec4 m1 = vec4(0.,0.,0.,1.);
		const vec4 m2 = vec4(1.,0.,0.,0.);
		const vec4 m3 = vec4(0.,1.,0.,0.);
		const vec4 m4 = vec4(0.,0.,1.,0.);

		vec4 col = vec4(getColorContrib(uv, ratCorr, u_gridRotation1 /360., (u_uvOrigin1 - 0.5) * ratCorr, m1),
						getColorContrib(uv, ratCorr, u_gridRotation2 /360., (u_uvOrigin2 - 0.5) * ratCorr, m2),
						getColorContrib(uv, ratCorr, u_gridRotation3 /360., (u_uvOrigin3 - 0.5) * ratCorr, m3),
						getColorContrib(uv, ratCorr, u_gridRotation4 /360., (u_uvOrigin4 - 0.5) * ratCorr, m4));
		
		vec4 colMix = col.x * m1 + col.y * m2 + col.z * m3 + col.w * m4;
		vec3 albedo = CMYKtoRGB(colMix);
	#endif
	#if COLORS == COLORS_RGB
		const vec4 m1 = vec4(1.,0.,0.,0.);
		const vec4 m2 = vec4(0.,1.,0.,0.);
		const vec4 m3 = vec4(0.,0.,1.,0.);

		vec3 col = vec3(getColorContrib(uv, ratCorr, u_gridRotation1 /360., (u_uvOrigin1 - 0.5) * ratCorr, m1),
						getColorContrib(uv, ratCorr, u_gridRotation2 /360., (u_uvOrigin2 - 0.5) * ratCorr, m2),
						getColorContrib(uv, ratCorr, u_gridRotation3 /360., (u_uvOrigin3 - 0.5) * ratCorr, m3));
		
		vec3 albedo = col;
	#endif

	vec4 background = texSample2D(g_Texture0, v_TexCoord.xy);
	#if BG_BLEND == 1
		gl_FragColor = vec4(ApplyBlending(BLENDMODE, background.rgb, albedo, u_blendAlpha), background.a);
	#endif
	#if BG_BLEND == 0
		gl_FragColor = vec4(albedo, background.a);
	#endif
}
