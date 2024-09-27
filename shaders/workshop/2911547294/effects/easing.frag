#include "common.h"
#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}


uniform float power; // {"material":"Power","default":2,"range":[0.01,25]}
uniform float expPower; // {"material":"Exponent","default":15,"range":[0.6,25]}
uniform float mode; // {"material":"In - InOut - Out","default":1,"range":[0,2]}

varying vec2 v_TexCoord;

uniform float alpha; // {"default":"1.0","material":"Alpha","range":[0,1]}

// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Value Range Setting","combo":"RANGE","type":"options","default":0,"options":{"Default Greyscale (256 Values)":0,"Red & Green Channel (65536 Values)":1}}
// [COMBO] {"material":"Ease Type","combo":"TYPE","type":"options","default":0,"options":{"Sine":0,"Polynomial (Linear, Quadratic, Cubic, Quartic, etc.)":1, "Exponential":2, "Circular":3, "Bounce":4}}
// [COMBO] {"material":"Ease Mode","combo":"MODE","type":"options","default":1,"options":{"In":0,"In-Out":1,"Out":2, "Merge": 3}}

#define MODE_IN 0
#define MODE_INOUT 1
#define MODE_OUT 2
#define MODE_MERGE 3

#define TYPE_SINE 0
#define TYPE_POLY 1
#define TYPE_EXP 2
#define TYPE_CIRC 3
#define TYPE_BOUNCE 4

#define RANGE_BW 0
#define RANGE_RG 1

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

// SINE
float easeInSine(float t) {
	t = clamp(t, 0.0, 1.0);
	return -1.0 * cos(t * (M_PI / 2.0)) + 1.0;
}

float easeOutSine(float t) {
	t = clamp(t, 0.0, 1.0);
	return sin(t * (M_PI / 2.0));
}

float easeInOutSine(float t) {
	t = clamp(t, 0.0, 1.0);
	return -0.5 * (cos(M_PI * t) - 1.0);
}

// POLYNOMIAL
float easeInPolynomial(float t, float power) {
  t = clamp(t, 0.0, 1.0);
  return pow(t, power);
}

float easeOutPolynomial(float t, float power) {
  t = clamp(t, 0.0, 1.0);
  return 1.0 - pow(1.0 - t, power);
}

float easeInOutPolynomial(float t, float power) {
	t = clamp(t, 0.0, 1.0);
	return mix(pow(2.,power-1.)*pow(t, power),1. - pow(-2.*t+2., power)/2.,step(0.5,t));
}

// EXPONENTIAL
float easeInExp(float t, float exponent) {
    return map_range(vec2(pow(2.,-exponent),1.),vec2(0.,1.),pow(2.,(t-1.) * exponent));
}

float easeOutExp(float t, float exponent) {
    return map_range(vec2(0.,1. - pow(2.,-exponent)),vec2(0.,1.), 1.- pow(2.,t * -exponent));
}

float easeInOutExp(float t, float exponent) {
    float val = mix(pow(2., (2. * t - 1.) * exponent) / 2., (2.- pow(2., (-2. * t + 1.) * exponent)) / 2., step(0.5, t));
    return map_range(vec2(pow(2., -exponent), (2. -pow(2., -exponent)) / 2.), vec2(0.,1.), val);
}

// CIRCULAR
float easeInCirc(float t) {
  t = clamp(t, 0.0, 1.0);
  return -1.0 * (sqrt(1.0 - t * t) - 1.0);
}

float easeOutCirc(float t) {
  t = clamp(t, 0.0, 1.0);
  t = t - 1.0;
  return sqrt(1.0 - t * t);
}

float easeInOutCirc(float t) {
	t = clamp(t, 0.0, 1.0);
    float t1 = clamp(t,0.,0.5);
    float t2 = clamp(t,0.5,1.) - 1.;
    
    float f1 = -0.5 * (sqrt(1.0 - 4.0 * t1 * t1) - 1.0);
    float f2 = 0.5 * sqrt(1.0 - 4.0 * t2 * t2) + 0.5;
	return mix(f1,f2,step(0.5,t));
}


// BOUNCE
float easeOutBounce(float t) {
  t = clamp(t, 0.0, 1.0);
  float t2 = t * t;
  return mix(
      (121.0 * t2) / 16.0,
      mix((363.0 / 40.0 * t2) - (99.0 / 10.0 * t) + 17.0 / 5.0,
          mix((4356.0 / 361.0 * t2) - (35442.0 / 1805.0 * t) + 16061.0 / 1805.0,
              (54.0 / 5.0 * t2) - (513.0 / 25.0 * t) + 268.0 / 25.0,
              t > 0.9),
          t > 8.0 / 11.0),
      t > 4.0 / 11.0);
}


float easeInBounce(float t) {
  t = clamp(t, 0.0, 1.0);
  return 1.0 - easeOutBounce(1.0 - t);
}


float easeInOutBounce(float t) {
  t = clamp(t, 0.0, 1.0);
  if (t < 0.5) {
    return 0.5 * easeInBounce(t * 2.0);
  } else {
    return 0.5 * easeOutBounce(t * 2.0 - 1.0) + 0.5;
  }
}

float ease(float val) {
	#if(TYPE == TYPE_SINE)
		#if(MODE == MODE_IN)
			return easeInSine(val);
		#endif
		#if(MODE == MODE_INOUT)
			return easeInOutSine(val);
		#endif
		#if(MODE == MODE_OUT)
			return easeOutSine(val);
		#endif
		#if(MODE == MODE_MERGE)
			float inOut = easeInOutSine(val);
			return mix(
				mix(easeInSine(val), inOut, mode),
				mix(inOut, easeOutSine(val), mode - 1.),
				step(1.,mode)
			);
		#endif
	#endif

	#if(TYPE == TYPE_POLY)
		#if(MODE == MODE_IN)
			return easeInPolynomial(val, power);
		#endif
		#if(MODE == MODE_INOUT)
			return easeInOutPolynomial(val, power);
		#endif
		#if(MODE == MODE_OUT)
			return easeOutPolynomial(val, power);
		#endif
		#if(MODE == MODE_MERGE)
			float inOut = easeInOutPolynomial(val, power);
			return mix(
				mix(easeInPolynomial(val, power), inOut, mode),
				mix(inOut, easeOutPolynomial(val, power), mode - 1.),
				step(1.,mode)
			);
		#endif
	#endif

	#if(TYPE == TYPE_EXP)
		#if(MODE == MODE_IN)
			return easeInExp(val, expPower);
		#endif
		#if(MODE == MODE_INOUT)
			return easeInOutExp(val, expPower);
		#endif
		#if(MODE == MODE_OUT)
			return easeOutExp(val, expPower);
		#endif
		#if(MODE == MODE_MERGE)
			float inOut = easeInOutExp(val, expPower);
			return mix(
				mix(easeInExp(val, expPower), inOut, mode),
				mix(inOut, easeOutExp(val, expPower), mode - 1.),
				step(1.,mode)
			);
		#endif
	#endif

	#if(TYPE == TYPE_CIRC)
		#if(MODE == MODE_IN)
			return easeInCirc(val);
		#endif
		#if(MODE == MODE_INOUT)
			return easeInOutCirc(val);
		#endif
		#if(MODE == MODE_OUT)
			return easeOutCirc(val);
		#endif
		#if(MODE == MODE_MERGE)
			float inOut = easeInOutCirc(val);
			return mix(
				mix(easeInCirc(val), inOut, mode),
				mix(inOut, easeOutCirc(val), mode - 1.),
				step(1.,mode)
			);
		#endif
	#endif

	#if(TYPE == TYPE_BOUNCE)
		#if(MODE == MODE_IN)
			return easeInBounce(val);
		#endif
		#if(MODE == MODE_INOUT)
			return easeInOutBounce(val);
		#endif
		#if(MODE == MODE_OUT)
			return easeOutBounce(val);
		#endif
		#if(MODE == MODE_MERGE)
			float inOut = easeInOutBounce(val);
			return mix(
				mix(easeInBounce(val), inOut, mode),
				mix(inOut, easeOutBounce(val), mode - 1.),
				step(1.,mode)
			);
		#endif
	#endif

	return 0.;
}

void main() {
	vec3 background = texSample2D(g_Texture0, v_TexCoord).rgb;
	#if(RANGE == RANGE_RG)
		background = CAST3(decode_rg_range(background.rg));
	#endif

	vec3 v = ApplyBlending(BLENDMODE, background, CAST3(ease(background.r)), alpha);

	#if(RANGE == RANGE_RG)
		v = vec3(encode_rg_range(v.r), 0.);
	#endif

	gl_FragColor = vec4(v, 1.);
}
