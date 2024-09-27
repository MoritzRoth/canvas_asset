
// [COMBO] {"material":"Enable blending with extra texture","combo":"ENABLE_BLEND","type":"options","default":0}
// [COMBO] {"material":"Enable Smearing","combo":"ENABLE_SMEAR","type":"options","default":0}
// [COMBO] {"material":"Enable Color Copy Brush","combo":"ENABLE_CPY_BRUSH","type":"options","default":0}
// [COMBO] {"material":"Enable Undo","combo":"ENABLE_UNDO","type":"options","default":0}

varying vec4 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

#define RESET_NO 0
#define RESET_DEFAULT 1
#define RESET_BLEND 2
#define RESET_UNDO 3

#define DRAW_MODE_ERASE 0
#define DRAW_MODE_PEN 1
#define DRAW_MODE_SMEAR 2
#define DRAW_MODE_COLOR_CPY 3
#define DRAW_MODE_BLEND 4

uniform sampler2D g_Texture0; // {"hidden":true}
uniform sampler2D g_Texture1; // {"hidden":true}

uniform sampler2D g_Texture3; // {"material":"blendTex","label":"Blend Texture", "default":"util/black"}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;

uniform float u_cpyBelow; // {"material":"Reset Texture (None, Default, Undo, Blend)","int":true,"default":0,"range":[0,1]}
uniform float u_mouseDown; // {"material":"Mouse Down","int":true,"default":0,"range":[0,1]}

uniform float u_drawMode; // {"material":"Draw Mode (Erase, Pen, Noise)","int":true,"default":0,"range":[0,3]}
uniform float u_drawRadius; // {"material":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"Draw Hardness","default":1,"range":[0,1]}
uniform vec3 u_drawColor; // {"material":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material":"Draw Alpha","default":1,"range":[0,1]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

void main() {
	vec4 currentAlbedo = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 pastAlbedo = texSample2D(g_Texture1, v_TexCoord.xy);
	vec4 noiseAlbedo = texSample2D(g_Texture3, v_TexCoord.xy);
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

	pastAlbedo = mix(pastAlbedo, currentAlbedo, penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_ERASE));
	pastAlbedo = mix(pastAlbedo, vec4(u_drawColor, 1.), penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_PEN));
	pastAlbedo = mix(pastAlbedo, noiseAlbedo, penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_BLEND));
	pastAlbedo = mix(pastAlbedo, cursorAlbedo, penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_COLOR_CPY));

	vec4 nextAlbedo = mix(pastAlbedo, currentAlbedo, modeMatch(u_cpyBelow, RESET_DEFAULT));
	nextAlbedo = mix(nextAlbedo, noiseAlbedo, modeMatch(u_cpyBelow, RESET_BLEND));

	gl_FragColor = nextAlbedo;
}
