// [COMBO] {"material":"Use Modified Cursor Positions","combo":"MODIFIED_CURSOR_POS","type":"options","default":0}
// [COMBO] {"material":"Max Brush Samples Per Px","combo":"MAX_BRUSH_SAMPLES_PER_PIXEL","type":"options","default":16,"options":{"4":4,"8":8,"16":16,"32":32,"64":64}}

varying vec2 v_TexCoord;

// painted canvas (just for tex resolution)
uniform sampler2D g_Texture0; // {"hidden":true}

uniform sampler2D g_Texture1; // {"hidden":true}
#define PREV_STORAGE_TEX g_Texture1

uniform vec4 g_Texture0Resolution;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Frametime;

uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform vec4 u_mousePos; // {"material":"mousePos","label":"Mouse Pos (XY = Current, ZW = Last Frame)","linked":false,"default":"0 0 0 0","range":[0,1]}
uniform float u_frameTimeAndBTexUse;  // {"material":"brush0Texture","label":"Use Brush Texture & Custom Frame Time","int":true,"default":1,"range":[-10,10]}
uniform float u_brushSpacing; // {"material":"brush0Spacing","label":"Brush Spacing","default":0.125,"range":[0,1]}
uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

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

/** \brief Calculates a mask for the given storage id. Ensures that no masks overlap.
 * Needs to be kept in sync with sampleSpot()
 */
float mask(vec2 uv, float storageId) {
	return step(storageId / STORAGE_SIZE, uv.x) * step(uv.x, (storageId+1.) / STORAGE_SIZE);
}

float NOT(float v) {
	return 1.-v;
}

float calcBrushSpacingOffset(float radius, float lastSpacingOffset, vec2 cursor, vec2 pCursor) {
	float brushSpacing = max(u_brushSpacing, 1./MAX_BRUSH_SAMPLES_PER_PIXEL);
	float ptDist = 2. * radius * brushSpacing;

	vec2 stroke = cursor - pCursor;
	vec2 dir = normalize(stroke);
	vec2 interval = dir * ptDist;

	// redefine stroke with new start & end (first and last pts we draw)
	float pts = floor(
		length(stroke) / ptDist
		+ lastSpacingOffset
	);
	if(pts <= 0) {
		return lastSpacingOffset + length(stroke) / ptDist;
	}
	vec2 start = pCursor + interval * (1. - lastSpacingOffset);
	float rpts = pts - 1.;	// no mathematical meaning; term just appeared a bunch in calcs below, so i just pulled it into its own var
	vec2 end = start + interval * rpts;
	return distance(end, cursor) / ptDist;

	//float nextSpacingOffset = (length(stroke) - pts * ptDist - lastSpacingOffset) / ptDist;	// prob incomplete
	//return nextSpacingOffset;
}

void main() {

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
#if MODIFIED_CURSOR_POS == 0
	vec2 cursor = g_PointerPosition;
	vec2 pCursor = g_PointerPositionLast;
	float frametime = g_Frametime;
#endif
#if MODIFIED_CURSOR_POS == 1
	vec2 cursor = u_mousePos.xy;
	vec2 pCursor = u_mousePos.zw;
	float frametime = abs(u_frameTimeAndBTexUse);
#endif

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);

	float previousOffset = texSample2D(PREV_STORAGE_TEX, sampleSpot(STORAGE_FRAMEINFO)).r;
	float nextOffset = calcBrushSpacingOffset(penRadius, previousOffset, cursor * ratCorr, pCursor * ratCorr);
	nextOffset = mix(1.,min(nextOffset, IPSILON), u_mouseDown.x);
	vec4 frameInfo = vec4(nextOffset, frametime, pCursor);

	vec2 pLastMouseDown = texSample2D(PREV_STORAGE_TEX, sampleSpot(STORAGE_MOUSE_EVENT_POS)).xy;
	vec2 lastMouseDown = mix(pLastMouseDown, cursor, u_mouseDown.x * NOT(u_mouseDown.y));
	vec4 mouseEventPos = vec4(lastMouseDown, CAST2(0.));
	
	gl_FragColor = 
		  frameInfo * mask(v_TexCoord.xy, STORAGE_FRAMEINFO)
		+ mouseEventPos * mask(v_TexCoord.xy, STORAGE_MOUSE_EVENT_POS);
}
