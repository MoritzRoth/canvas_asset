// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}
// [COMBO] {"material":"Enable blending with pattern texture","combo":"ENABLE_BLEND","type":"options","default":0}
// [COMBO] {"material":"Use Modified Cursor Positions","combo":"MODIFIED_CURSOR_POS","type":"options","default":0}

varying vec2 v_TexCoord;

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

// canvas texture
uniform sampler2D g_Texture0; // {"hidden":true}

// pen influence texture
uniform sampler2D g_Texture1; // {"hidden":true}

// below texture
uniform sampler2D g_Texture2; // {"hidden":true}

// blend texture
uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Pattern Texture", "default":"util/black"}

uniform vec2 g_PointerPosition;

uniform float u_drawMode; // {"material":"drawMode","label":"Draw Mode Duplicate","int":true,"default":0,"range":[0,4]}
uniform vec3 u_drawColor; // {"material":"drawCol","label":"Draw Color","type":"color","default":"1 1 1"}
uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform vec4 u_mousePos; // {"material":"mousePos","label":"Mouse Pos (XY = Current, ZW = Last Frame)","linked":false,"default":"0 0 0 0","range":[0,1]}
uniform float u_strokeType; // {"material":"influenceMode","label":"Stroke Type (Stamp, Air Brush, Connected Line, Evenly Spaced, Straight Line)","int":true,"default":0,"range":[0,1]}
uniform float u_brushPreview; // {"material":"brushPreview","label":"Preview (None, Outline, Full)","int":true,"default":0,"range":[0,2]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

bool isMode(float a, float b) {
	return modeMatch(a,b) > 0.5;
}

float NOT(float v) {
	return 1.-v;
}

// May overlay two different kinds of preview over the canvas:
//   1. Line Influence Preview
//        When drawing a continuous line we first accumulate one stroke over multiple frames
//        while the mouse is down, and only apply it once the mouse releases. During this time
//        we need to show what the stroke will look like once the mouse is released.
//   2. Brush Preview [TODO]
//        Previews the currently selected brush. Can be disabled entirely / reduced to just
//        an outline preview.

vec4 linePreview(vec4 canvas, vec2 uv) {
#if MODIFIED_CURSOR_POS == 0
	vec2 cursor = g_PointerPosition;
#endif
#if MODIFIED_CURSOR_POS == 1
	vec2 cursor = u_mousePos.xy;
#endif
	
	float lineInfluence = texSample2D(g_Texture1, uv).r;

	vec4 brushColor = canvas;
	if(isMode(u_drawMode, DRAW_MODE_ERASE)) {
		brushColor = texSample2D(g_Texture2, uv);
	}
	if(isMode(u_drawMode, DRAW_MODE_BRUSH)) {
		brushColor = vec4(u_drawColor, 1.);
	}
#if ENABLE_BLEND
	if(isMode(u_drawMode, DRAW_MODE_BLEND)) {
		brushColor = texSample2D(g_Texture4, uv);
	}
#endif
#if ENABLE_CPY_BRUSH
	if(isMode(u_drawMode, DRAW_MODE_COLOR_CPY)) {
		brushColor = texSample2D(g_Texture0, cursor);
	}
#endif

	float previewOn = (modeMatch(u_strokeType, INFLUENCE_CLINES) + modeMatch(u_strokeType, INFLUENCE_LINE)) * NOT(modeMatch(u_drawMode, DRAW_MODE_SMEAR));
	return mix(canvas, brushColor, lineInfluence * u_mouseDown.x * previewOn);
}

void main() {
	vec4 canvas = texSample2D(g_Texture0, v_TexCoord);

#if ENABLE_LINE_INFLUENCE == 1
	canvas = linePreview(canvas, v_TexCoord);
#endif

gl_FragColor = canvas;
}
