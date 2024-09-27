
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
#define DRAW_MODE_PEN 1
#define DRAW_MODE_SMEAR 2
#define DRAW_MODE_COLOR_CPY 3
#define DRAW_MODE_BLEND 4

// below texture
uniform sampler2D g_Texture0; // {"hidden":true}
// last frame canvas
uniform sampler2D g_Texture1; // {"hidden":true}
// undo canvas
uniform sampler2D g_Texture2; // {"hidden":true}
uniform sampler2D g_Texture3; // {"material":"blendTex","label":"Blend Texture", "default":"util/black"}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;

uniform float u_command; // {"material":"Command (None, Reset, Undo, Blend)","int":true,"default":0,"range":[0,3]}
uniform vec2 u_mouseDown; // {"material":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}

uniform float u_drawMode; // {"material":"Draw Mode (Erase, Pen, Smear, Color Copy, Blend)","int":true,"default":0,"range":[0,4]}
uniform float u_drawRadius; // {"material":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"Draw Hardness","default":1,"range":[0,1]}
uniform vec3 u_drawColor; // {"material":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material":"Draw Alpha","default":1,"range":[0,1]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

void main() {
	vec4 defaultAlbedo = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 canvasAlbedo = texSample2D(g_Texture1, v_TexCoord.xy);
	vec4 undoAlbedo = texSample2D(g_Texture2, v_TexCoord.xy);
	vec4 blendAlbedo = texSample2D(g_Texture3, v_TexCoord.xy);
	vec4 cursorAlbedo = texSample2D(g_Texture1, g_PointerPosition);

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	vec2 uv = v_TexCoord.xy * ratCorr;
	vec2 cursor = g_PointerPosition * ratCorr;
	vec2 prevCursor = g_PointerPositionLast * ratCorr;
	vec2 cursorDelta = cursor - prevCursor;

	float maxPenRadius = max(g_Texture0Resolution.x, g_Texture0Resolution.y) / 2.;
	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);
	float penInfluence = u_drawAlpha * smoothstep(penRadius, penRadius * min(u_drawHardness, IPSILON), length(uv - cursor));

	// apply various pens
	canvasAlbedo = mix(canvasAlbedo, defaultAlbedo, penInfluence * u_mouseDown.x * modeMatch(u_drawMode, DRAW_MODE_ERASE));
	canvasAlbedo = mix(canvasAlbedo, vec4(u_drawColor, 1.), penInfluence * u_mouseDown.x * modeMatch(u_drawMode, DRAW_MODE_PEN));
	canvasAlbedo = mix(canvasAlbedo, blendAlbedo, penInfluence * u_mouseDown.x * modeMatch(u_drawMode, DRAW_MODE_BLEND));
	canvasAlbedo = mix(canvasAlbedo, cursorAlbedo, penInfluence * u_mouseDown.x * modeMatch(u_drawMode, DRAW_MODE_COLOR_CPY));

	// apply reset instructions
	vec4 nextAlbedo = mix(canvasAlbedo, defaultAlbedo, modeMatch(u_command, CMD_RESET));
	nextAlbedo = mix(nextAlbedo, undoAlbedo, modeMatch(u_command, CMD_UNDO));
	nextAlbedo = mix(nextAlbedo, blendAlbedo, modeMatch(u_command, CMD_BLEND));

	gl_FragColor = nextAlbedo;
}
