// [COMBO] {"material":"Use Modified Cursor Positions","combo":"MODIFIED_CURSOR_POS","type":"options","default":0}

varying vec2 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

#define OFFSET_ONE_DIR 0
#define OFFSET_BOTH_DIR 1
#define OFFSET_MIRROR 2

#define INFLUENCE_STAMP 0
#define INFLUENCE_SPRAY 1
#define INFLUENCE_CLINES 2
#define INFLUENCE_SPACED_DOTS 3
#define INFLUENCE_LINE 4

uniform sampler2D g_Texture0; // {"hidden":true}
// storage texture
uniform sampler2D g_Texture5; // {"hidden":true}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Frametime;

uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"drawHardness","label":"Draw Hardness","default":1,"range":[0,1]}
uniform float u_drawAlpha; // {"material":"drawAlpha","label":"Draw Alpha","default":1,"range":[0,1]}

uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform vec4 u_mousePos; // {"material":"mousePos","label":"Mouse Pos (XY = Current, ZW = Last Frame)","linked":false,"default":"0 0 0 0","range":[0,1]}
uniform float u_frameTimeAndBTexUse;  // {"material":"brush0Texture","label":"Use Brush Texture & Custom Frame Time","int":true,"default":1,"range":[-10,10]}
uniform float u_strokeType; // {"material":"influenceMode","label":"Stroke Type (Stamp, Air Brush, Connected Line, Evenly Spaced, Straight Line)","int":true,"default":0,"range":[0,1]}

uniform vec2 u_brushOffset; // {"material":"brushPositionOffset","label":"Brush Constant Offset","default":"0 0","range":[-1,1]}
uniform vec2 u_brushMirrorOffset; // {"material":"brushOffsetMirror","label":"Brush Mirror Offset","default":"0 0","range":[0,1]}
uniform vec2 u_velBounds; // {"material":"brushVelocityBounds","label":"Brush Velocity Bounds","default":"0 5","range":[0,10]}

uniform vec2 u_brushSizeJitter; // {"material":"brushSizeJitter","label":"Brush Size Jitter","default":"0.125 0","range":[0,1]}
uniform vec2 u_brushAlphaJitter; // {"material":"brushAlphaJitter","label":"Brush Alpha Jitter","default":"0 0","range":[0,1]}
uniform vec2 u_brushOffsetJitter; // {"material":"brushPositionJitter","label":"Brush Position Jitter","default":"0 0","range":[0,1]}

uniform vec2 u_brushVelSizeMod; // {"material":"brushSizeVelMod","label":"Brush Size Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelAlphaMod; // {"material":"brushAlphaVelMod","label":"Brush Alpha Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelOffsetMod; // {"material":"brushOffsetVelMod","label":"Brush Offset Velocity Modifier","default":"0 0","range":[-1,1]}

#define STORAGE_FRAMEINFO 0.		// X: brush spacing offset, Y: prev frametime, ZW: pprev cursor pos
#define STORAGE_MOUSE_EVENT_POS 1.	// XY: pos of last cursor down, ZW: unused
#define STORAGE_COLOR 2.			// RGBA: stored color from color picker tool TODO

#define STORAGE_SIZE 3.

/** \brief Calculates the sample position required to fetch the given storage id from the storage buffer.
 * Needs to be kept in sync with other shaders
 */
vec2 sampleSpot(float storageId) {
	return vec2((storageId + 0.5) / STORAGE_SIZE, 0.5);
}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

bool isMode(float a, float b) {
	return modeMatch(a,b) > 0.5;
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

float calcSegmentInfluence(vec2 uv, float penRadius, vec4 pos, vec4 vel, vec2 frametime, float incompleteSegment) {

	vec4 rnd = hash44(vec4(pos.xy, frametime.x, vel.x));
	vec4 pRnd = hash44(vec4(pos.zw, frametime.y, vel.z));
	float t = clamp(getT(pos.zw, pos.xy, uv), EPSILON, IPSILON);

	// interpolate velocities from current & previous frame so we have smooth transitions
	vec2 velBounds = vec2(u_velBounds.x, max(u_velBounds.y, u_velBounds.x + EPSILON));
	float velRange = dot(velBounds,vec2(-1., 1.));
	float velRat = min(1., max(length(vel.xy) - u_velBounds.x, 0.) / velRange);
	float pVelRat = min(1., max(length(vel.zw) - u_velBounds.x, 0.) / velRange);
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
	if(length(vel.xy) > 0.) {
		pOffset = calcOffset(vel.zw, pRnd.zw, pVelRat, penRadius * sizeMod0, uv, pos.zw);
		offset = calcOffset(vel.xy, rnd.zw, velRat, penRadius * sizeMod1, uv, pos.xy);
	}

	penRadius *= sizeModifier;
	float penSmoothRadius = penRadius * min(u_drawHardness, IPSILON);
	return alpha * (
		       incompleteSegment  * smoothstep(penRadius, penSmoothRadius, length(uv - (pos.xy + offset)))
		 + NOT(incompleteSegment) * smoothstep(penRadius, penSmoothRadius, sdSegment(uv, pos.xy + offset, pos.zw + pOffset))
	);
}

float calcLineInfluence(vec2 uv, float penRadius, vec2 start, vec2 end) {
	float penSmoothRadius = penRadius * min(u_drawHardness, IPSILON);
	return u_drawAlpha * smoothstep(penRadius, penSmoothRadius, sdSegment(uv, start, end));
}

void main() {

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);

	vec2 uv = v_TexCoord.xy * ratCorr;
#if MODIFIED_CURSOR_POS == 0
	vec2 cursor = g_PointerPosition * ratCorr;
	vec2 pCursor = g_PointerPositionLast * ratCorr;
	float frametime = g_Frametime;
#endif
#if MODIFIED_CURSOR_POS == 1
	vec2 cursor = u_mousePos.xy * ratCorr;
	vec2 pCursor = u_mousePos.zw * ratCorr;
	float frametime = abs(u_frameTimeAndBTexUse);
#endif
	vec2 velocity = (cursor - pCursor) / frametime;
	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);
	
	float influence = 0.;
	if(isMode(u_strokeType, INFLUENCE_CLINES)) {
		vec4 lastFrameInfo = texSample2D(g_Texture5, sampleSpot(STORAGE_FRAMEINFO));
		float pFrametime = lastFrameInfo.y;
		vec2 ppCursor = lastFrameInfo.zw * ratCorr;
		vec2 pVelocity = (pCursor - ppCursor) / pFrametime;

		float previousInfluence = texSample2D(g_Texture0, v_TexCoord.xy).r;
		
		// only add to last influence if last frame the mouse was down
		influence = mix(previousInfluence, 0., NOT(u_mouseDown.y));

		influence = max(
			influence,
			calcSegmentInfluence(
				uv, penRadius,
				vec4(cursor, pCursor),
				vec4(velocity, pVelocity),
				vec2(frametime, pFrametime),
				NOT(u_mouseDown.y)
			) * u_mouseDown.x
		);
	}

	if(isMode(u_strokeType, INFLUENCE_LINE)) {
		vec2 lineStart = texSample2D(g_Texture5, sampleSpot(STORAGE_MOUSE_EVENT_POS)).xy * ratCorr;
		lineStart = mix(cursor, lineStart, u_mouseDown.y);

		influence = min(dot(u_mouseDown, CAST2(1.)), 1.) * calcLineInfluence(uv, penRadius, lineStart, cursor);
	}

	
	gl_FragColor = CAST4(influence);
}
