
// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}
// [COMBO] {"material":"Enable Undo Command","combo":"ENABLE_UNDO_CMD","type":"options","default":0}
// [COMBO] {"material":"Enable blending with pattern texture","combo":"ENABLE_BLEND","type":"options","default":0}
// [COMBO] {"material":"Enable Smearing","combo":"ENABLE_SMEAR","type":"options","default":0}
// [COMBO] {"material":"Enable Color Copy Brush","combo":"ENABLE_CPY_BRUSH","type":"options","default":0}

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

#define MAX_BRUSH_SAMPLES_PER_PIXEL 32.

// below texture
uniform sampler2D g_Texture0; // {"hidden":true}
// last frame canvas
uniform sampler2D g_Texture1; // {"hidden":true}
// undo canvas
uniform sampler2D g_Texture2; // {"hidden":true}
// line influence texture
uniform sampler2D g_Texture3; // {"hidden":true}
uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Pattern Texture", "default":"util/black"}
// storage texture
uniform sampler2D g_Texture5; // {"hidden":true}
uniform sampler2D g_Texture6; // {"material":"brushTex","label":"Brush Texture", "default":"util/black"}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;
uniform float g_Frametime;
uniform float g_Time;

uniform float u_command; // {"material":"cmd","label":"Command (None, Reset, Undo, Blend)","int":true,"default":0,"range":[0,3]}
uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_drawMode; // {"material":"drawMode","label":"Draw Mode (Erase, Brush, Smear, Color Copy, Blend)","int":true,"default":0,"range":[0,4]}
uniform float u_preferredInfluence; // {"material":"influenceMode","label":"Air Brush - Connected Lines","int":true,"default":0,"range":[0,1]}

uniform vec3 u_drawColor; // {"material":"drawCol","label":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material": "drawAlpha","label":"Draw Alpha","default":1,"range":[0,1]}
uniform float u_drawRadius; // {"material":"drawRadius","label":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"drawHardness","label":"Draw Hardness","default":1,"range":[0,1]}

uniform float u_brushSpacing; // {"material":"brushSpacing","label":"Brush Spacing","default":0.125,"range":[0,1]}
uniform float u_brushRotJitter; // {"material":"brushRotJitter","label":"Brush Rotation Jitter","default":0.125,"range":[0,1]}
uniform float u_brushSizeJitter; // {"material":"brushSizeJitter","label":"Brush Size Jitter","default":0.125,"range":[0,1]}
uniform float u_brushAlphaJitter; // {"material":"brushAlphaJitter","label":"Brush Alpha Jitter","default":0,"range":[0,1]}

uniform float u_brushVelSizeMod; // {"material":"brushVelSizeMod","label":"Brush Velocity Size Modifier","default":0,"range":[-1,1]}
uniform float u_brushVelAlphaMod; // {"material":"brushVelAlphaMod","label":"Brush Velocity Alpha Modifier","default":0,"range":[-1,1]}
uniform float u_brushVelMax; // {"material":"brushVelMax","label":"Brush Velocity Cap","default":5,"range":[0,10]}

uniform float u_brushRProb; // {"material":"brush0RProb","label":"Brush Channel Frequency R","default":1,"range":[0,1]}
uniform float u_brushGProb; // {"material":"brush1GProb","label":"Brush Channel Frequency G","default":0,"range":[0,1]}
uniform float u_brushBProb; // {"material":"brush2BProb","label":"Brush Channel Frequency B","default":0,"range":[0,1]}
uniform float u_brushAProb; // {"material":"brush3AProb","label":"Brush Channel Frequency A","default":0,"range":[0,1]}


float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
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

float calcProcInfluence(float penRadius, vec2 uv, vec2 center, vec2 velocity, float t) {
	return u_drawAlpha * smoothstep(penRadius, penRadius * min(u_drawHardness, IPSILON), length(uv - center));
}

float calcInfluence(float penRadius, vec2 uv, vec2 center, vec2 velocity, vec2 pVelocity, float t) {
	
	vec4 rnd = hash44(vec4(center, t, g_Time));

	float velRat = min(1., length(velocity) / u_brushVelMax);
	float pVelRat = min(1., length(pVelocity) / u_brushVelMax);
	float velR = mix(pVelRat, velRat, t);

	vec4 cThreshMin = vec4(0, u_brushRProb, u_brushRProb + u_brushGProb, u_brushRProb + u_brushGProb + u_brushBProb);
	vec4 cThreshMax = vec4(cThreshMin.gba, cThreshMin.a + u_brushAProb);
	cThreshMin /= cThreshMax.a;
	cThreshMax /= cThreshMax.a;
	vec4 selectedChannel = step(cThreshMin, CAST4(rnd.x)) * step(CAST4(rnd.x), cThreshMax);

	float rot = atan2(velocity.x, velocity.y) - M_PI / 2.;
	rot += (rnd.y * 2. - 1.) * u_brushRotJitter * M_PI;

	vec2 sampleSpot = (uv - center) / (penRadius * 2);
	float sizeModifier = mix(1. - u_brushSizeJitter, 1., rnd.z);
	sizeModifier *= mix(1. - max(0., u_brushVelSizeMod), 1. + min(0., u_brushVelSizeMod), velR);
	sampleSpot = mul(rMat(rot), sampleSpot) / sizeModifier;

	float sample = 1. - dot(texSample2D(g_Texture6, sampleSpot + CAST2(0.5)), selectedChannel);
	float sampleMask = step(length(sampleSpot), 1.);
	float alpha = u_drawAlpha * mix(1. - u_brushAlphaJitter, 1., rnd.w);
	alpha *= mix(1. - max(0., u_brushVelAlphaMod), 1. + min(0., u_brushVelAlphaMod), velR);

	return alpha * sample * sampleMask;
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
float calcBrushInfluence(float radius, float spacingOffset, vec2 uv, vec2 cursor, vec2 pCursor, vec2 velocity, vec2 pVelocity) {
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
		return calcInfluence(radius, uv, start, velocity, pVelocity, getT(pCursor, cursor, start));
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
		influence += max(0.,
					step(length(uv - pt), radius)					// no contrib if out of pt radius
					* step(-EPSILON, ptT) * step(ptT, 1. + EPSILON) // no contrib if outside stroke range
					* calcInfluence(radius, uv, pt, velocity, pVelocity, getT(pCursor, cursor, pt))
				);
	}

	return min(influence, 1.);
}

void main() {
	vec4 defaultAlbedo = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 canvasAlbedo = texSample2D(g_Texture1, v_TexCoord.xy);
#if ENABLE_CPY_BRUSH
	vec4 cursorAlbedo = texSample2D(g_Texture1, g_PointerPosition);
#endif
#if ENABLE_SMEAR
	vec4 smearAlbedo = texSample2D(g_Texture1, g_PointerPositionLast + (v_TexCoord.xy - g_PointerPosition));
#endif
#if ENABLE_UNDO_CMD
	vec4 undoAlbedo = texSample2D(g_Texture2, v_TexCoord.xy);
#endif
#if ENABLE_BLEND
	vec4 blendAlbedo = texSample2D(g_Texture4, v_TexCoord.xy);
#endif
	float lineInfluence = texSample2D(g_Texture3, v_TexCoord.xy).g;
	vec4 lastFrameInfo = texSample2D(g_Texture5, vec2(0.5, 0.5));
	float brushSpacingOffset = lastFrameInfo.x;
	float p_Frametime = lastFrameInfo.y;

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
	vec2 pVelocity = (pCursor - ppCursor) / p_Frametime;

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);
	float penInfluence = calcProcInfluence(penRadius, uv, cursor, velocity, 1.);

	// Line influence is only added to the canvas when the mouse is released, until then the present shader will show a preview of how the line looks.
	// This way we avoid stacking brush influence when drawing line segments.
	lineInfluence *= u_mouseDown.y * NOT(u_mouseDown.x);	// draws entire stroke (connected lines) on mouse release
	float sprayInfluence = penInfluence * u_mouseDown.x;	// draws while mouse down in an area around the cursor
	float stampInfluence = penInfluence * u_mouseDown.x * NOT(u_mouseDown.y);	// draws in an area around the cursor on mouse press
	float brushInfluence = 0.;
	if(u_mouseDown.x) {	// since brush influence calc is VERY expensive we want to skip it if possible
		brushInfluence = calcBrushInfluence(penRadius, brushSpacingOffset, uv, cursor, pCursor, velocity, pVelocity);
	}
#if ENABLE_LINE_INFLUENCE
	// for draw modes that make sense with both spray and line influence use this and let the user decide which one to use
	float generalInfluence = mix(brushInfluence, lineInfluence, u_preferredInfluence);
#endif
#if !ENABLE_LINE_INFLUENCE
	float generalInfluence = brushInfluence;
#endif

	// apply strokes in various draw modes
	vec4 nextAlbedo = mix(canvasAlbedo, defaultAlbedo, generalInfluence * modeMatch(u_drawMode, DRAW_MODE_ERASE));
	nextAlbedo = mix(nextAlbedo, vec4(u_drawColor, 1.), generalInfluence * modeMatch(u_drawMode, DRAW_MODE_BRUSH));
#if ENABLE_BLEND
	nextAlbedo = mix(nextAlbedo, blendAlbedo, generalInfluence * modeMatch(u_drawMode, DRAW_MODE_BLEND));
#endif
#if ENABLE_SMEAR
	nextAlbedo = mix(nextAlbedo, smearAlbedo, sprayInfluence * modeMatch(u_drawMode, DRAW_MODE_SMEAR));
#endif
#if ENABLE_CPY_BRUSH
	nextAlbedo = mix(nextAlbedo, cursorAlbedo, sprayInfluence * modeMatch(u_drawMode, DRAW_MODE_COLOR_CPY));
#endif

	// apply commands
	nextAlbedo = mix(nextAlbedo, defaultAlbedo, modeMatch(u_command, CMD_RESET));
#if ENABLE_UNDO_CMD
	nextAlbedo = mix(nextAlbedo, undoAlbedo, modeMatch(u_command, CMD_UNDO));
#endif
#if ENABLE_BLEND
	nextAlbedo = mix(nextAlbedo, blendAlbedo, modeMatch(u_command, CMD_BLEND));
#endif

	gl_FragColor = nextAlbedo;
}
