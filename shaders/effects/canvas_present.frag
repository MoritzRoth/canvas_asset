// [COMBO] {"material":"Enable Connected Lines","combo":"ENABLE_LINE_INFLUENCE","type":"options","default":1}

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
uniform sampler2D g_Texture4; // {"material":"blendTex","label":"Blend Texture", "default":"util/black"}

uniform float u_drawMode; // {"material":"drawMode","label":"Draw Mode Duplicate","int":true,"default":0,"range":[0,4]}
uniform vec3 u_drawColor; // {"material":"drawCol","label":"Draw Color","type":"color","default":"1 1 1"}
uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_preferredInfluence; // {"material":"influenceMode","label":"Air Brush - Connected Lines","int":true,"default":0,"range":[0,1]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

void main() {
	vec4 canvas = texSample2D(g_Texture0, v_TexCoord);

#if ENABLE_LINE_INFLUENCE == 0
	gl_FragColor = canvas;
#endif

#if ENABLE_LINE_INFLUENCE == 1
	float lineInfluence = texSample2D(g_Texture1, v_TexCoord).r;
	vec4 defaultAlbedo = texSample2D(g_Texture0, v_TexCoord.xy);

	vec3 previewColor = defaultAlbedo * modeMatch(u_drawMode, DRAW_MODE_ERASE)
						+ u_drawColor * modeMatch(u_drawMode, DRAW_MODE_BRUSH);
#if ENABLE_BLEND
	previewColor += texSample2D(g_Texture4, v_TexCoord.xy) * modeMatch(u_drawMode, DRAW_MODE_BLEND);
#endif

	gl_FragColor = mix(canvas, vec4(previewColor, 1.), lineInfluence * u_mouseDown.x * u_preferredInfluence);
#endif
}
