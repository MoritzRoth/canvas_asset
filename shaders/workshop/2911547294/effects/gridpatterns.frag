
#include "common.h"
#include "common_blending.h"

#define SHAPE_HEX 1.0
#define SHAPE_SQ 2.0
#define SHAPE_TRI 3.0

#define RANGE_BW 0
#define RANGE_RG 1

// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Value Range Setting","combo":"RANGE","type":"options","default":0,"options":{"Default Greyscale (256 Values)":0,"Red & Green Channel (65536 Values)":1}}

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}

uniform vec2 g_TexelSize;
uniform vec2 g_Texture0Translation;

uniform vec4 g_Texture0Resolution;
varying vec2 v_TexCoord;

uniform float cellRows;		// {"material":"Row Count","default":20,"range":[1,100]}
uniform float cellAngle;	// {"material":"Rotation", "default":0, "range":[0,1]}
uniform float randomize;	// {"material":"Randomization", "default":0, "range":[0,1]}
uniform float rigidCells;	// {"material":"Cell Uniformity","default":1,"range":[0,1]}

uniform float radPow; // {"material":"Influence Falloff","default":1,"range":[0,5]}
uniform float threshPow;  // {"material":"Threshold Falloff","default":1,"range":[0,5]}
uniform float threshOff;  // {"material":"Threshold Offset","default":0,"range":[0,1]}

uniform float alpha; // {"default":"1.0","material":"Alpha","range":[0,1]}


uniform float shape; // {"material":"Cell Shape","int":true,"default":1,"range":[1,3]}
uniform float color_option; // {"material":"Color Option","int":true,"default":0,"range":[0,2]}
uniform float invert_pattern; // {"material":"Invert Pattern","int":true,"default":0,"range":[0,1]}







// utils
float mod(float x, float y) {
	return x - y * floor(x / y);
}
vec2 modV2(vec2 x, vec2 y) {
	return vec2(mod(x.x, y.x), mod(x.y, y.y));
}

mat2 rMat(float angle) {
	float s = sin(angle * M_PI * 2.);
	float c = cos(angle * M_PI * 2.);
	return mat2(c, -s, s, c);;
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

float trDist(vec2 uv) {
    float dist = 0;
    
    dist = max(dist, dot(vec2(abs(uv.x), uv.y), vec2(0.288675134594813, 1./6.)));
    dist = max(dist, dot(uv, vec2(0., -1./3.)));
    
    return dist;
}

Grid triangleGrid(vec2 uv, float scale, float rot) {
    Grid tg;
    
    float a = sqrt(4./3.) / hr3;    //dont know why /hr3... but it works
    
	vec2 offset = vec2(0,0./6.);
    uv+= offset;
    uv = mul(uv, rMat(rot));
    uv *= 9. * scale;	// unsure why it scales correctly when I multiply by 9, but it does
    
    vec2 guv = uv;
    
    float w = 3.89;		// dont know why, just guessed that value and it worked
    vec2 uv2 = vec2(uv.x + a * w, -uv.y + 3.);
    
    float stripe = mod(floor(uv.y / 9. - 0.5 - 1./6.), 2.);
    
    //bottom row
    uv = vec2(mod((uv.x + stripe * a * w), 2. * a * w)- a * w , uv.y);    //horizontal tiling
    uv = vec2(uv.x, mod((uv.y + 3.), 9.)-3.);    //vertical tiling
    //top row
    uv2 = vec2(mod(uv2.x + stripe * a * w, 2. * a * w) - a * w, uv2.y);    //horizontal tiling
    uv2 = vec2(uv2.x, mod((uv2.y + 3.), 9.) - 3.);    //vertical tiling
    
    
    float bot = trDist(uv);
    float top = trDist(uv2);
    
    tg.puv.x = min(bot, top);
    tg.cuv = mix(uv, vec2(uv2.x, -uv2.y), selectMin(bot,top));
    tg.puv.y = atan2(tg.cuv.x, tg.cuv.y) / (M_PI * 2.) + .5;
	tg.type = mix(0.,1., selectMin(bot, top));
    
    tg.id = ((guv - tg.cuv) - offset * scale * 9.) / 9. + 0.0001;
    tg.rand = hash12(tg.id + 0.01);
    
    return tg;
}















struct ThreshInfo {
	float threshold;
	vec2 samplePos;
	vec2 centerPos;
};

ThreshInfo get_thresh(vec2 uv, float scale) {

	vec2 paddRatio1 = CAST2(1.);
	//vec2 ratCorr1 = vec2(1, xyRatio1);

	Grid gr;
	float deco = 0.;
	vec2 suv = uv.xy / paddRatio1;	//sample uv
	vec2 rigid_suv = suv;

	vec2 duv = (uv.xy - 0.5) *  scale;

	if(shape == SHAPE_HEX) {
		duv = mul(duv / hr3, rMat(cellAngle));
		gr = hexGrid(duv);
		rigid_suv = (mul(gr.id, rMat(-cellAngle)) / scale * hr3 + 0.5) / paddRatio1;
	}
	if(shape == SHAPE_SQ) {
		duv = mul(duv, rMat(cellAngle));
		gr = squareGrid(duv);
		rigid_suv = (mul(gr.id, rMat(-cellAngle)) / scale + 0.5) / paddRatio1;
	}
	if(shape == SHAPE_TRI) {
		duv = mul(duv / hr3, rMat(cellAngle));
		gr = triangleGrid((uv.xy - 0.5) , scale, cellAngle);
		rigid_suv = (mul(gr.id, rMat(-cellAngle)) / scale + 0.5) / paddRatio1;
		
	}

	deco = mix(gr.puv.x, gr.rand, randomize);
	suv = mix(suv, rigid_suv, rigidCells);

	ThreshInfo t;
	t.threshold = deco;
	t.samplePos = suv;
	t.centerPos = rigid_suv;

    return t;
}














float flip(float x) {
	return 1. - x;
}

float decode_rg_range(vec2 rg) {
	return min(rg.r + rg.g / pow(2.,8.), 1.);
}
vec2 encode_rg_range(float v) {
	float g = frac(v * pow(2., 8.));
	return vec2(v - g * pow(2., -8.) , g);
}

void main() {
	vec2 ratCorr = g_Texture0Resolution.xy / g_Texture0Resolution.y;
	vec2 uv = v_TexCoord * ratCorr;



	ThreshInfo threshInfo = get_thresh(uv, cellRows / 2.);
	float val = threshInfo.threshold;
	vec2 suv = threshInfo.samplePos;

	val = mix(val , flip(val), invert_pattern);

	vec3 background = texSample2D(g_Texture0, suv / ratCorr).rgb;
	
	#if(RANGE == RANGE_RG)
		background = CAST3(decode_rg_range(background.rg));
	#endif
	vec3 v = ApplyBlending(BLENDMODE, CAST3(background.r), CAST3(val), alpha);
	#if(RANGE == RANGE_RG)
		v = vec3(encode_rg_range(v.r), 0.);
	#endif

	gl_FragColor = vec4(v,1.);
}
