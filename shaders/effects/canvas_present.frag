// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}
// [COMBO] {"material":"Enable blending with pattern texture","combo":"ENABLE_BLEND","type":"options","default":0}

varying vec2 v_TexCoord;

#define DRAW_MODE_ERASE 0
#define DRAW_MODE_BRUSH 1
#define DRAW_MODE_SMEAR 2		// preview doesn't make sense
#define DRAW_MODE_COLOR_CPY 3	// preview doesn't make sense
#define DRAW_MODE_BLEND 4

// canvas texture
uniform sampler2D g_Texture0; // {"hidden":true}

// pen influence texture
uniform sampler2D g_Texture1; // {"hidden":true}

// below texture
uniform sampler2D g_Texture2; // {"hidden":true}

// blend texture
uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Pattern Texture", "default":"util/black"}

uniform float u_drawMode; // {"material":"drawMode","label":"Draw Mode Duplicate","int":true,"default":0,"range":[0,4]}
uniform vec3 u_drawColor; // {"material":"drawCol","label":"Draw Color","type":"color","default":"1 1 1"}
uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_preferredInfluence; // {"material":"influenceMode","label":"Air Brush - Connected Lines","int":true,"default":0,"range":[0,1]}
uniform float u_brushPreview; // {"material":"brushPreview","label":"Preview (None, Outline, Full)","int":true,"default":0,"range":[0,2]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
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
	float lineInfluence = texSample2D(g_Texture1, uv).r;
	vec4 defaultAlbedo = texSample2D(g_Texture2, uv);

	vec3 previewColor = defaultAlbedo * modeMatch(u_drawMode, DRAW_MODE_ERASE)
						+ u_drawColor * modeMatch(u_drawMode, DRAW_MODE_BRUSH);
#if ENABLE_BLEND
	previewColor += texSample2D(g_Texture4, uv) * modeMatch(u_drawMode, DRAW_MODE_BLEND);
#endif

	float previewOn = u_preferredInfluence * NOT(modeMatch(u_drawMode, DRAW_MODE_SMEAR)) * NOT(modeMatch(u_drawMode, DRAW_MODE_COLOR_CPY));
	return mix(canvas, vec4(previewColor, 1.), lineInfluence * u_mouseDown.x * previewOn);
}

void main() {
	vec4 canvas = texSample2D(g_Texture0, v_TexCoord);

#if ENABLE_LINE_INFLUENCE == 1
	canvas = linePreview(canvas, v_TexCoord);
#endif

gl_FragColor = canvas;
}
