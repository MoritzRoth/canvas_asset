
// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}
// [COMBO] {"material":"Enable Undo Command","combo":"ENABLE_UNDO_CMD","type":"options","default":0}
// [COMBO] {"material":"Enable blending with extra texture","combo":"ENABLE_BLEND","type":"options","default":0}
// [COMBO] {"material":"Enable Smearing","combo":"ENABLE_SMEAR","type":"options","default":0}
// [COMBO] {"material":"Enable Color Copy Brush","combo":"ENABLE_CPY_BRUSH","type":"options","default":0}

varying vec2 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

#define CMD_NONE 0
#define CMD_RESET 1
#define CMD_UNDO 2
#define CMD_BLEND 3

#define DRAW_MODE_ERASE 0
#define DRAW_MODE_BRUSH 1
#define DRAW_MODE_SMEAR 2
#define DRAW_MODE_COLOR_CPY 3
#define DRAW_MODE_BLEND 4

// below texture
uniform sampler2D g_Texture0; // {"hidden":true}
// last frame canvas
uniform sampler2D g_Texture1; // {"hidden":true}
// undo canvas
uniform sampler2D g_Texture2; // {"hidden":true}
// line influence texture
uniform sampler2D g_Texture3; // {"hidden":true}
uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Blend Texture", "default":"util/black"}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;

uniform float u_command; // {"material":"Command (None, Reset, Undo, Blend)","int":true,"default":0,"range":[0,3]}
uniform vec2 u_mouseDown; // {"material":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_drawMode; // {"material":"Draw Mode (Erase, Brush, Smear, Color Copy, Blend)","int":true,"default":0,"range":[0,4]}
uniform float u_preferredInfluence; // {"material":"Air Brush - Connected Lines","int":true,"default":0,"range":[0,1]}

uniform vec3 u_drawColor; // {"material":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material":"Draw Alpha","default":1,"range":[0,1]}
uniform float u_drawRadius; // {"material":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"Draw Hardness","default":1,"range":[0,1]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

float NOT(float v) {
	return 1.-v;
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

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	vec2 uv = v_TexCoord.xy * ratCorr;
	vec2 cursor = g_PointerPosition * ratCorr;

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);
	float penInfluence = u_drawAlpha * smoothstep(penRadius, penRadius * min(u_drawHardness, IPSILON), length(uv - cursor));

	// line influence is only added to the canvas when the mouse is released, until then the present shader will show a preview of how the line looks
	// this way we avoid stacking brush influence when drawing line segments 
	lineInfluence *= u_mouseDown.y * NOT(u_mouseDown.x);	// draws entire stroke (connected lines) on mouse release, relies on "present" shader to show a preview in the meantime
	float sprayInfluence = penInfluence * u_mouseDown.x;	// draws while mouse down in an area around the cursor
	float stampInfluence = penInfluence * u_mouseDown.x * NOT(u_mouseDown.y);	// draws in an area around the cursor on mouse press
#if ENABLE_LINE_INFLUENCE
	float generalInfluence = mix(sprayInfluence, lineInfluence, u_preferredInfluence);
#endif
#if !ENABLE_LINE_INFLUENCE
	float generalInfluence = sprayInfluence;
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
