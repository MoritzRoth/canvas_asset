
// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}
// [COMBO] {"material":"Enable Undo Command","combo":"ENABLE_UNDO_CMD","type":"options","default":0}
// [COMBO] {"material":"Use Modified Cursor Positions","combo":"MODIFIED_CURSOR_POS","type":"options","default":0}

varying vec2 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON
#define M_PI 3.1415926535897932384626433832795

#define CMD_NONE 0
#define CMD_RESET 1
#define CMD_UNDO 2
#define CMD_BLEND 3

#define DRAW_MODE_ERASE 0
#define DRAW_MODE_BRUSH 1
#define DRAW_MODE_SMEAR 2
#define DRAW_MODE_COLOR_CPY 3
#define DRAW_MODE_BLEND 4

#define INFLUENCE_STAMP 0
#define INFLUENCE_SPRAY 1
#define INFLUENCE_CLINES 2
#define INFLUENCE_SPACED_DOTS 3
#define INFLUENCE_LINE 4

#define OFFSET_ONE_DIR 0
#define OFFSET_BOTH_DIR 1
#define OFFSET_MIRROR 2

#define MAX_BRUSH_SAMPLES_PER_PIXEL 32.

uniform sampler2D g_Texture0; // {"hidden":true}
#define RESET_TEX g_Texture0

uniform sampler2D g_Texture1; // {"hidden":true}
#define PREV_CANVAS_TEX g_Texture1

uniform sampler2D g_Texture2; // {"hidden":true}
#define UNDO_TEX g_Texture2

uniform sampler2D g_Texture3; // {"hidden":true}
#define INFLUENCE_TEX g_Texture3

uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Pattern Texture", "default":"util/black"}
#define BLEND_TEX g_Texture4

uniform sampler2D g_Texture5; // {"hidden":true}
#define STORAGE_TEX g_Texture5

uniform sampler2D g_Texture6; // {"material":"brushTex","label":"Brush Texture", "default":"util/black"}
#define BRUSH_TEX g_Texture6

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Frametime;
uniform float g_Time;

// NOTE: If everything is enabled the entire unifrom budget (48 floats) is used.
// Adding more uniforms would mean that not every feature can be enabled at the same time.
// Below is a (currently incomplete table) listing all toggleable features and their raw uniform cost.
// Note that some uniforms might only be required if two features are enabled simultaneously, so this list might not provide the whole picture.

// +---------------------+--------------+------------+------------+----------------------------+----------------------------------------+
// | Feature             | Uniform Cost | Draw Calls | FBO Copies | Texture Samples while idle |   Extra Texture Samples while drawing  |
// +---------------------+--------------+------------+------------+----------------------------+----------------------------------------+
// | Baseline Canvas     |          ??? |          3 |          2 |                          4 |                              at most 1 |
// | Brush Texture       |         +??? |         +0 |         +0 |                         +0 | +up to MAX_BRUSH_SAMPLES_PER_PIXEL + 1 |
// | Connected Lines     |         +??? |         +1 |         +1 |                         +4 |                                     +1 |
// | Undo                |           +0 |         +1 |         +1 |                         +1 |                                     +1 |
// | Modified Cursor Pos |           +4 |         +0 |         +0 |                         +0 |                                     +0 |
// +---------------------+--------------+------------+------------+----------------------------+----------------------------------------+


// It might be possible to squish some extra information into existing params.
// Below is a list of params that already serve a double-purpose:

// u_useTexturesAndFrameTime param squishes two params into one:
// - Bool: Whether to use the procedural brush (negative sign) or sample a brush texture (positive sign)
// - Unsigned Float: An override for the current frame time in seconds (if MODIFIED_CURSOR_POS is enabled)

uniform float u_command; // {"material":"cmd","label":"Command (None, Reset, Undo, Blend)","int":true,"default":0,"range":[0,3]}
uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform vec4 u_mousePos; // {"material":"mousePos","label":"Mouse Pos (XY = Current, ZW = Last Frame)","linked":false,"default":"0 0 0 0","range":[0,1]}
uniform float u_drawMode; // {"material":"drawMode","label":"Draw Mode (Erase, Brush, Smear, Color Copy, Blend)","int":true,"default":0,"range":[0,4]}
uniform float u_strokeType; // {"material":"influenceMode","label":"Stroke Type (Stamp, Air Brush, Connected Line, Evenly Spaced, Straight Line)","int":true,"default":0,"range":[0,3]}

uniform vec3 u_drawColor; // {"material":"drawCol","label":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material": "drawAlpha","label":"Draw Alpha","default":1,"range":[0,1]}
uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"drawHardness","label":"Draw Hardness","default":1,"range":[0,1]}

uniform float u_useTexturesAndFrameTime;  // {"material":"brush0Texture","label":"Use Brush Texture & Custom Frame Time","int":false,"default":1,"range":[-10,10]}
uniform float u_brushSpacing; // {"material":"brush0Spacing","label":"Brush Spacing","default":0.125,"range":[0,1]}
uniform vec2 u_brushProb; // {"material":"brush1Prob","label":"Brush Channel Frequency RGBA","default":"1 0","range":[0,1]}
uniform vec2 u_brushInfluence; // {"material":"brush2Factor","label":"Brush Channel Influence","default":"1 1","range":[-2,2]}
uniform vec2 u_brushSizeFactor; // {"material":"brushSizeFactor","label":"Brush Size Modifier","default":"1 1","range":[0,1]}
uniform vec2 u_brushOffset; // {"material":"brushPositionOffset","label":"Brush Constant Offset","default":"0 0","range":[-1,1]}
uniform vec2 u_brushMirrorOffset; // {"material":"brushOffsetMirror","label":"Brush Mirror Offset","default":"0 0","range":[0,1]}
uniform vec2 u_brushRotOffset; // {"material":"brushRotOffset","label":"Brush Rotation Offset","default":"0 0","range":[-1,1]}
uniform vec2 u_brushRotLock; // {"material":"brushRotLock","label":"Brush Rotation Lock to Stroke Dir","default":"1 1","range":[0,1]}
uniform vec2 u_velBounds; // {"material":"brushVelocityBounds","label":"Brush Velocity Bounds","default":"0 5","range":[0,10]}

uniform vec2 u_brushRotJitter; // {"material":"brushRotJitter","label":"Brush Rotation Jitter","default":"0.125 0","range":[0,1]}
uniform vec2 u_brushSizeJitter; // {"material":"brushSizeJitter","label":"Brush Size Jitter","default":"0.125 0","range":[0,1]}
uniform vec2 u_brushAlphaJitter; // {"material":"brushAlphaJitter","label":"Brush Alpha Jitter","default":"0 0","range":[0,1]}
uniform vec2 u_brushOffsetJitter; // {"material":"brushPositionJitter","label":"Brush Position Jitter","default":"0 0","range":[0,1]}

uniform vec2 u_brushVelSizeMod; // {"material":"brushSizeVelMod","label":"Brush Size Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelAlphaMod; // {"material":"brushAlphaVelMod","label":"Brush Alpha Velocity Modifier","default":"0 0","range":[-1,1]}
uniform vec2 u_brushVelOffsetMod; // {"material":"brushOffsetVelMod","label":"Brush Offset Velocity Modifier","default":"0 0","range":[-1,1]}

#define STORAGE_FRAMEINFO 0.		// X: brush spacing offset, Y: prev frametime, ZW: pprev cursor pos
#define STORAGE_MOUSE_EVENT_POS 1	// XY: pos of last cursor down, ZW: unused
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

mat2 rMat(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

// 4 out, 4 in...
vec4 hash44(vec4 p4)
{
	p4 = frac(p4  * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+33.33);
    return frac((p4.xxyz+p4.yzzw)*p4.zywx);
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

float calcPointInfluence(float brushRadius, vec2 uv, vec2 center, vec2 velocity, vec2 pVelocity, float t) {
	// get random values to incorporate for jitter / brush texture selection
	vec4 rnd = hash44(vec4(center, t, g_Time));
	vec4 rnd2 = hash44(vec4(g_Time, t, center));
	// originally i wanted to seed rng2 with rng, but that introduced artifacts for some reason...
	// seems like the seed for rng is not 100% uniform for each call and hashing twice reeveals the error?

	// interpolate cursor velocities from current & previous frame so we have smooth transitions
	float velRange = dot(u_velBounds,vec2(-1., 1.));
	float velRat = min(1., max(length(velocity) - u_velBounds.x, 0.) / velRange);
	float pVelRat = min(1., max(length(pVelocity) - u_velBounds.x, 0.) / velRange);
	float velR = mix(pVelRat, velRat, t);

	// select brush texture, different textures may have different brush properties so we need to get this early on
	vec2 cThreshMin = vec2(0, u_brushProb.r);
	vec2 cThreshMax = vec2(cThreshMin.g, cThreshMin.g + u_brushProb.g);
	cThreshMin /= cThreshMax.g;
	cThreshMax /= cThreshMax.g;
	vec2 selectedChannel = step(cThreshMin, CAST2(rnd.x)) * step(CAST2(rnd.x), cThreshMax);

	// calc brush rotation
	float rot = dot(u_brushRotOffset, selectedChannel) * M_PI;	// baseline rotation
	rot += dot(u_brushRotLock, selectedChannel) * (atan2(velocity.x, velocity.y) - M_PI / 2.);	// rotation due to storke direction lock
	rot += (rnd.y * 2. - 1.) * dot(u_brushRotJitter, selectedChannel) * M_PI; // rotation jitter

	// calc brush size jitter & velocity variation
	float sizeModifier = dot(u_brushSizeFactor, selectedChannel) * jitter(dot(u_brushSizeJitter, selectedChannel), rnd.z);
	sizeModifier *= velMod(dot(u_brushVelSizeMod, selectedChannel), velR);

	// calc alpha jitter & velocity variation
	float alpha = u_drawAlpha * jitter(dot(u_brushAlphaJitter, selectedChannel), rnd.w);
	alpha *= velMod(dot(u_brushVelAlphaMod, selectedChannel), velR);

	// get influence factor
	float influence = dot(u_brushInfluence, selectedChannel);

	// calc pos offset (only in perpendicular fashion to the brush stroke direction)
	vec2 offset = CAST2(0.);
	float mirrorSample = 0.;
	if(length(velocity) > 0.) {
		vec2 offsetDir  = normalize(velocity).yx * vec2(1.,-1.);
		float offsetDist = 2. * brushRadius * sizeModifier * dot(u_brushOffset, selectedChannel);
		offset = offsetDir * offsetDist * jitter(dot(u_brushOffsetJitter, selectedChannel), rnd2.x) * velMod(dot(u_brushVelOffsetMod, selectedChannel), velR);

		float offsetMode = dot(u_brushMirrorOffset, selectedChannel);
		float shouldMirror = step(0., dot(offsetDir, uv - center));
		offset *= modeMatch(offsetMode, OFFSET_ONE_DIR)
				+ modeMatch(offsetMode, OFFSET_BOTH_DIR) * mix(-1., 1., step(0.5, rnd2.y))
				+ modeMatch(offsetMode, OFFSET_MIRROR) * mix(-1., 1., shouldMirror);
		mirrorSample = modeMatch(offsetMode, OFFSET_MIRROR) * shouldMirror;
	}


	vec2 sampleSpot = (uv - (center + offset)) / (brushRadius * 2.);
	vec2 sP = velocity * dot(sampleSpot, velocity) / dot(velocity,velocity);
	sampleSpot = mix(sampleSpot, sP + (sP - sampleSpot), mirrorSample); // mirror sample pos along velocity dir
	sampleSpot = mul(rMat(rot), sampleSpot) / sizeModifier; // apply rotation

	// sample brush texture & calc mask
	float sample;
	if(u_useTexturesAndFrameTime > 0) {
		 sample = 1. - dot(texSample2D(BRUSH_TEX, sampleSpot + CAST2(0.5)).rg, selectedChannel);
	}else {
		sample = smoothstep(1., min(u_drawHardness, IPSILON), length(sampleSpot) * 2.);
	}
	float sampleMask = step(length(sampleSpot) * 2., 1.);

	return alpha * influence * sample * sampleMask;
}

float calcPointInfluence(float brushRadius, vec2 uv, vec2 center, vec2 velocity) {
	return calcPointInfluence(brushRadius, uv, center, velocity, CAST2(0.), 1.);
}

float getT(vec2 lineStart, vec2 lineEnd, vec2 projPt) {
	vec2 dir = lineEnd - lineStart;
	if(length(dir) == 0.) {
		return 1.;
	}
	return dot(dir, projPt - lineStart) / dot(dir, dir);
}

/**
 * Tries to emulate a brush similar to how affinity photo 2 seems to do it
 * We have a brush texture which is pasted in fixed distance intervals along the
 * brush stroke, with random rotation/scale etc. Brush spacing controls this fixed
 * distance between the pasted brush textures. A brush spacing of 1 means the
 * textures are spaced as far apart as the diameter of the pen, so they won't
 * overlap at all. Spacing of 0.5 means half of that distance, so for every pixel
 * along the brush stroke two brush samples must be made. As the spacing goes
 * towards 0 the stroke looks more and more like that of a brush, but we must also
 * sample the brush texture more often. So to keep the shader performant I added a
 * lower limit to the brush spacing.
 * 
 * So how do we know where to sample the brush texture for each pixel? A naive
 * implementation would take the line between the last-, and the current
 * cursor position, and iterate over evenly spaced points along the line, pasting
 * the brush texture at every point. We run into issues with this approach if we
 * want to draw a long line with a small pen radius. This is because we get a lot
 * of points along this line, and every point means an extra brush texture sample
 * for ALL pixels in our canvas. Now we know that not every pixel is affected by
 * every point along the line. In fact, from above, we even know how many points
 * can (at max) affect a pixel, based on the brush spacing. So we could check for
 * each point if the current pixel is by it before sampling the brush texture.
 * This does reduce the brush samples per pixel to the minimum, but it also
 * introduces branching paths to our shader. And the last time I checked, GPUs
 * hated branching shader code with a passion.
 * 
 * To get around this issue we want to find the first of those evenly spaced
 * points (lets call it the sampleStartPt) along the line that can affect our
 * current pixel and iterate from this sampleStartPt on for as many points as can
 * at max affect our pixel. To do this we first project the current pixel onto the
 * line, and from this position move a length of pen radius towards the previous
 * cursor position. This point we just found is just at the fringe of impacting
 * the projected pixel position, any point further than that definitely can't
 * affect our pixel. We can now round the point we found up to closest of the
 * evenly spaced points to get our sampleStartPt.
 * 
 * Now we only have to deal with some minor inconveniences: The bursh texture
 * should be pasted with even spacing over multiple frames, so we need to track
 * the distance of the last of the evenly spaced points to our current cursor
 * position, so we can apply it as negative offset for all evenly spaced points in
 * the next frame. This is what the spacingOffset parameter is for.
 * 
 */
float calcStrokeInfluence(float radius, float spacingOffset, vec2 uv, vec2 cursor, vec2 pCursor, vec2 velocity, vec2 pVelocity) {
	float brushSpacing = max(u_brushSpacing, 1./MAX_BRUSH_SAMPLES_PER_PIXEL);
	float ptDist = 2. * radius * brushSpacing;

	vec2 stroke = cursor - pCursor;
	vec2 dir = length(stroke) > 0 ? normalize(stroke) : stroke;
	vec2 interval = dir * ptDist;

	// redefine stroke with new start & end (first and last pts we draw)
	float pts = floor(
		length(stroke) / ptDist
		+ spacingOffset
	);
	if(pts <= 0.) {
		return 0.;
	}
	vec2 start = pCursor + interval * (1. - spacingOffset);
	if(pts == 1.) {
		return clamp(calcPointInfluence(radius, uv, start, velocity, pVelocity, getT(pCursor, cursor, start)), 0., 1.);
	}
	float rpts = pts - 1.;	// no mathematical meaning; term just appeared a bunch in calcs below, so i just pulled it into its own var
	vec2 end = start + interval * rpts;
	stroke = end - start;

	float intervalT = 1./ rpts;
	float projPxT = getT(start, end, uv);
	float fringePtT = projPxT - radius / length(stroke);
	float sampleStartPtIdx = ceil(fringePtT * rpts);
	float sampleStartPtT = sampleStartPtIdx / rpts;
	float ptT = sampleStartPtT;

	float influence = 0.;
	float maxSamples = min(ceil(1./brushSpacing), MAX_BRUSH_SAMPLES_PER_PIXEL);
	for(float s = 0.; s < maxSamples; s+=1., ptT += intervalT) {
		vec2 pt = mix(start, end, ptT);
		influence += clamp(
					step(-EPSILON, ptT) * step(ptT, 1. + EPSILON) // no contrib if outside stroke range
					* calcPointInfluence(radius, uv, pt, velocity, pVelocity, getT(pCursor, cursor, pt))
				,-1.,1.);
	}

	return clamp(influence, 0., 1.);
}

/**
 * Calculates the corresponding brush influence for the selected stroke type
 * 
 * Params:
 * - fragment position
 * - cursor position (XY = current, ZW = last frame)
 * - ratio correction factor 
 * - frameTime in seconds
 *
 * Returns vec2:
 *   - X contains influence for current fragment.
 *   - Y is set to 0 if no fragment could have non-zero influence (i.e. draw calcs can be skipped). Otherwise Y is 1.
 */
vec2 calcInfluence(vec2 fragPos, vec4 cursor, vec2 ratCorr, float frameTime) {
	vec2 uv = fragPos * ratCorr;
	vec2 cCursor = cursor.xy * ratCorr;
	vec2 pCursor = cursor.zw * ratCorr;

	vec2 velocity = (cCursor - pCursor) / frameTime;

	float brushRadius = max(pow(u_drawRadius, 2.), EPSILON);

	if(isMode(u_strokeType, INFLUENCE_STAMP)) {
		if(u_mouseDown.x * NOT(u_mouseDown.y)) { // draws in an area around the cursor on mouse press
			return vec2(clamp(calcPointInfluence(brushRadius, uv, cCursor, velocity), 0., 1.), 1.);
		}
		return CAST2(0.);
	}

	if(isMode(u_strokeType, INFLUENCE_SPRAY)) {
		if(u_mouseDown.x) { // draws while mouse down in an area around the cursor
			return vec2(clamp(calcPointInfluence(brushRadius, uv, cCursor, velocity), 0., 1.), 1.);
		}
		return CAST2(0.);
	}

#if ENABLE_LINE_INFLUENCE
	// Line influence is only added to the canvas when the mouse is released, until then the present shader will show a preview of how the line looks.
	// This way we avoid stacking brush influence when drawing line segments.
	if(isMode(u_strokeType, INFLUENCE_CLINES) || isMode(u_strokeType, INFLUENCE_LINE)) {
		if(u_mouseDown.y * NOT(u_mouseDown.x)) { // draws entire stroke (connected lines) on mouse release
			return vec2(texSample2D(INFLUENCE_TEX, fragPos).g, 1.);
		}
		return CAST2(0.);
	}
#endif

	if(isMode(u_strokeType, INFLUENCE_SPACED_DOTS)) {
		if(u_mouseDown.x) { // draws evenly spaced dots while mouse down
			
			vec4 lastFrameInfo = texSample2D(STORAGE_TEX, sampleSpot(STORAGE_FRAMEINFO));
			float brushSpacingOffset = lastFrameInfo.x;
			float pFrametime = lastFrameInfo.y;
			
			vec2 ppCursor = lastFrameInfo.zw * ratCorr;
			vec2 pVelocity = (pCursor - ppCursor) / pFrametime;

			return vec2(calcStrokeInfluence(brushRadius, brushSpacingOffset, uv, cCursor, pCursor, velocity, pVelocity), 1.);
		}
		return CAST2(0.);
	}

	return CAST2(0.);
}

vec4 applyDrawMode(vec4 canvasAlbedo, float brushInfluence, vec2 fragPos, vec4 cursor) {
	vec4 brushColor = canvasAlbedo;

	if(isMode(u_drawMode, DRAW_MODE_ERASE)) {
		brushColor = texSample2D(RESET_TEX, fragPos);
	}

	if(isMode(u_drawMode, DRAW_MODE_BRUSH)) {
		brushColor = vec4(u_drawColor, 1.);
	}

	if(isMode(u_drawMode, DRAW_MODE_BLEND)) {
		brushColor =  texSample2D(BLEND_TEX, fragPos);
	}

	if(isMode(u_drawMode, DRAW_MODE_SMEAR)) {
		brushColor = texSample2D(PREV_CANVAS_TEX, cursor.zw + (fragPos - cursor.xy));
	}

	if(isMode(u_drawMode, DRAW_MODE_COLOR_CPY)) {
		brushColor = texSample2D(PREV_CANVAS_TEX, cursor.xy);
	}

	return mix(canvasAlbedo, brushColor, brushInfluence);
}

void main() {
	vec2 ratCorr = mix(
	vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
	vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
	step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	
#if MODIFIED_CURSOR_POS == 0
	vec4 cursor = vec4(g_PointerPosition, g_PointerPositionLast);
	float frameTime = g_Frametime;
#endif
#if MODIFIED_CURSOR_POS == 1
	vec4 cursor = u_mousePos;
	float frameTime = abs(u_useTexturesAndFrameTime);
#endif
	
	vec4 nextAlbedo = texSample2D(PREV_CANVAS_TEX, v_TexCoord.xy);	// sample from last frame
	vec2 brushInfluence = calcInfluence(v_TexCoord.xy, cursor, ratCorr, frameTime);
	if(brushInfluence.y) {
		nextAlbedo = applyDrawMode(nextAlbedo, brushInfluence.x, v_TexCoord.xy, cursor);
	}

	// apply commands
	if(isMode(u_command, CMD_RESET)) {
		nextAlbedo = texSample2D(RESET_TEX, v_TexCoord.xy);
	}
#if ENABLE_UNDO_CMD
	if(isMode(u_command, CMD_UNDO)) {
		nextAlbedo = texSample2D(UNDO_TEX, v_TexCoord.xy);
	}
#endif
	if(isMode(u_command, CMD_BLEND)) {
		nextAlbedo = texSample2D(BLEND_TEX, v_TexCoord.xy);
	}

	gl_FragColor = nextAlbedo;
}
