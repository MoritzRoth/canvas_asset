
varying vec2 v_TexCoord;

// painted canvas (just for tex resolution)
uniform sampler2D g_Texture0; // {"hidden":true}
// last frame storage
uniform sampler2D g_Texture1; // {"hidden":true}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Frametime;

uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_brushSpacing; // {"material":"brushSpacing","label":"Brush Spacing","default":0.125,"range":[0,1]}
uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON
#define MAX_BRUSH_SAMPLES_PER_PIXEL 32.

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
	vec2 lastFrameData = texSample2D(g_Texture1, vec2(0.5, 0.5)).rg;

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	vec2 cursor = g_PointerPosition * ratCorr;
	vec2 pCursor = g_PointerPositionLast * ratCorr;

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);

	float previousOffset = lastFrameData.x;
	float nextOffset = calcBrushSpacingOffset(penRadius, previousOffset, cursor, pCursor);
	nextOffset = mix(1.,min(nextOffset, IPSILON), u_mouseDown.x);

	// update undo frame only if we start a new pen stroke this frame
	gl_FragColor = vec4(nextOffset, g_Frametime, g_PointerPositionLast);
}
