
varying vec2 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

#define OFFSET_ONE_DIR 0
#define OFFSET_BOTH_DIR 1
#define OFFSET_MIRROR 2

uniform sampler2D g_Texture0; // {"hidden":true}
// storage texture
uniform sampler2D g_Texture5; // {"hidden":true}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Time;
uniform float g_Frametime;

uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"drawHardness","label":"Draw Hardness","default":1,"range":[0,1]}
uniform float u_drawAlpha; // {"material":"drawAlpha","label":"Draw Alpha","default":1,"range":[0,1]}

uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}

uniform vec2 u_brushOffset; // {"material":"brushPositionOffset","label":"Brush Constant Offset","default":"0 0","range":[-1,1]}
uniform vec2 u_brushMirrorOffset; // {"material":"brushOffsetMirror","label":"Brush Mirror Offset","default":"0 0","range":[0,1]}
uniform vec2 u_velBounds; // {"material":"brushVelocityBounds","label":"Brush Velocity Bounds","default":"0 5","range":[0,10]}

uniform vec2 u_brushSizeJitter; // {"material":"brushSizeJitter","label":"Brush Size Jitter","default":"0.125 0","range":[0,1]}
uniform vec2 u_brushAlphaJitter; // {"material":"brushAlphaJitter","label":"Brush Alpha Jitter","default":"0 0","range":[0,1]}
uniform vec2 u_brushOffsetJitter; // {"material":"brushPositionJitter","label":"Brush Position Jitter","default":"0 0","range":[0,1]}

uniform vec2 u_brushVelSizeMod; // {"material":"brushSizeVelMod","label":"Brush Size Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelAlphaMod; // {"material":"brushAlphaVelMod","label":"Brush Alpha Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelOffsetMod; // {"material":"brushOffsetVelMod","label":"Brush Offset Velocity Modifier","default":"0 0","range":[-1,1]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

float NOT(float v) {
	return 1.-v;
}

// https://iquilezles.org/articles/distfunctions2d/
float sdSegment(vec2 p, vec2 a, vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

// 4 out, 4 in...
vec4 hash44(vec4 p4)
{
	p4 = frac(p4  * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+33.33);
    return frac((p4.xxyz+p4.yzzw)*p4.zywx);
}

float getT(vec2 lineStart, vec2 lineEnd, vec2 projPt) {
	vec2 dir = lineEnd - lineStart;
	if(length(dir) == 0.) {
		return 1.;
	}
	return dot(dir, projPt - lineStart) / dot(dir, dir);
}

/** \brief Calculates a velocity modification factor in range [1 - abs(modifier),1]
 *
 * \param modifier [-1,1] if 0 velocity makes no difference; if positive the factor rises with increasing velocity; vice versa if negative
 * \param velocity the current velocity
 */
float velMod(float modifier, float velocity) {
	return mix(1. - max(0., modifier), 1. + min(0., modifier), velocity);
}

float jitter(float jitterVal, float rnd) {
	return mix(1. - jitterVal, 1., rnd);
}

float smoothJitter(float jitterVal, vec2 rnd, float t) {
	return mix(jitter(jitterVal, rnd.x), jitter(jitterVal, rnd.y), t);
}

vec2 calcOffset(vec2 dir, vec2 rnd, float vel, float penRadius, vec2 uv, vec2 pt) {
	vec2 offsetDir  = normalize(dir).yx * vec2(1.,-1.);
	float offsetDist = 2. * penRadius * u_brushOffset.x;

	vec2 offset = offsetDir * offsetDist * jitter(u_brushOffsetJitter.x, rnd.x) * velMod(u_brushVelOffsetMod.x, vel);

	float shouldMirror = step(0., dot(offsetDir, uv - pt));
	offset *= modeMatch(u_brushMirrorOffset.x, OFFSET_ONE_DIR)
			+ modeMatch(u_brushMirrorOffset.x, OFFSET_BOTH_DIR) * mix(-1., 1., step(0.5, rnd.y))
			+ modeMatch(u_brushMirrorOffset.x, OFFSET_MIRROR) * mix(-1., 1., shouldMirror);

	return offset;
}

void main() {
	float previousInfluence = texSample2D(g_Texture0, v_TexCoord.xy).r;
	vec4 lastFrameInfo = texSample2D(g_Texture5, vec2(0.5, 0.5));
	float pFrametime = lastFrameInfo.y;
	// only add to last influence if last frame the mouse was down
	float influence = mix(previousInfluence, 0., NOT(u_mouseDown.y));

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	vec2 uv = v_TexCoord.xy * ratCorr;
	vec2 cursor = g_PointerPosition * ratCorr;
	vec2 pCursor = g_PointerPositionLast * ratCorr;
	vec2 ppCursor = lastFrameInfo.zw * ratCorr;
	vec2 velocity = (cursor - pCursor) / g_Frametime;
	vec2 pVelocity = (pCursor - ppCursor) / pFrametime;

	vec4 rnd = hash44(vec4(cursor, g_Frametime, pCursor.x));
	vec4 pRnd = hash44(vec4(pCursor, pFrametime, ppCursor.x));
	float t = clamp(getT(pCursor, cursor, uv), EPSILON, IPSILON);

	// interpolate cursor velocities from current & previous frame so we have smooth transitions
	vec2 velBounds = vec2(u_velBounds.x, max(u_velBounds.y, u_velBounds.x + EPSILON));
	float velRange = dot(velBounds,vec2(-1., 1.));
	float velRat = min(1., max(length(velocity) - u_velBounds.x, 0.) / velRange);
	float pVelRat = min(1., max(length(pVelocity) - u_velBounds.x, 0.) / velRange);
	float velT = mix(pVelRat, velRat, t);

	// calc brush size jitter & velocity variation
	float velSizeMod = min(u_brushVelSizeMod.x, IPSILON);
	float sizeModifier = smoothJitter(u_brushSizeJitter.x, vec2(pRnd.x, rnd.x), t) * velMod(velSizeMod, velT);
	float sizeMod0 = jitter(u_brushSizeJitter.x, pRnd.x) * velMod(velSizeMod, pVelRat);
	float sizeMod1 = jitter(u_brushSizeJitter.x, rnd.x) * velMod(velSizeMod, velRat);

	// calc alpha jitter & velocity variation
	float alpha = u_drawAlpha * smoothJitter(u_brushAlphaJitter.x, vec2(pRnd.y, rnd.y), t);
	alpha *= velMod(u_brushVelAlphaMod.x, velT);

	// calc pos offset (only in perpendicular fashion to the brush stroke direction)
	vec2 pOffset = CAST2(0.);
	vec2 offset = CAST2(0.);
	float mirrorSample = 0.;
	if(length(velocity) > 0.) {
		pOffset = calcOffset(pVelocity, pRnd.zw, pVelRat, penRadius * sizeMod0, uv, pCursor);
		offset = calcOffset(velocity, rnd.zw, velRat, penRadius * sizeMod1, uv, cursor);
	}

	penRadius *= sizeModifier;
	float penSmoothRadius = penRadius * min(u_drawHardness, IPSILON);
	float currentInfluence = alpha * u_mouseDown.x * (
		   NOT(u_mouseDown.y) * smoothstep(penRadius, penSmoothRadius, length(uv - (cursor + offset)))
		 +     u_mouseDown.y  * smoothstep(penRadius, penSmoothRadius, sdSegment(uv, cursor + offset, pCursor + pOffset))
	);

	influence = max(influence, currentInfluence);
	gl_FragColor = CAST4(influence);
}
