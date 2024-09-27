varying vec4 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

#define RESET_NO 0
#define RESET_YES 1
#define RESET_WITH_NOISE 2

#define DRAW_MODE_ERASE 0
#define DRAW_MODE_PEN 1
#define DRAW_MODE_NOISE 2
#define DRAW_MODE_LEVEL 3

uniform sampler2D g_Texture0; // {"hidden":true}
uniform sampler2D g_Texture1; // {"hidden":true}
uniform sampler2D g_Texture2; // {"material":"noisePattern","label":"Noise Pattern", "default":"util/black"}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_TexelSize;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;

uniform float u_cpyBelow; // {"material":"Copy Below (Dont, Reset, Noise)","int":true,"default":0,"range":[0,1]}
uniform float u_mouseDown; // {"material":"Mouse Down","int":true,"default":0,"range":[0,1]}

uniform float u_drawMode; // {"material":"Draw Mode (Erase, Pen, Noise)","int":true,"default":0,"range":[0,3]}
uniform float u_drawRadius; // {"material":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"Draw Hardness","default":1,"range":[0,1]}
uniform vec3 u_drawColor; // {"material":"Draw Color","type":"color","default":"1 1 1"}
uniform float u_drawAlpha; // {"material":"Draw Alpha","default":1,"range":[0,1]}

vec2 encode_rg_range(float v) {
    // Scale v to [0, 65535] range (16-bit).
    float scaled = v * 65535.0;

    // Extract high and low bits.
    float r = floor(scaled / 256.0); // Red holds the high 8 bits.
    float g = mod(scaled, 256.0);    // Green holds the low 8 bits.

    // Normalize to [0.0, 1.0].
    return vec2(r, g) / 255.0;
}

float decode_rg_range(vec2 rg) {
    // Denormalize red and green channels from [0.0, 1.0] back to [0, 255].
    float r = rg.x * 255.0;
    float g = rg.y * 255.0;

    // Combine high and low bits to reconstruct the original value.
    float combined = r * 256.0 + g;

    // Normalize back to [0.0, 1.0].
    return combined / 65535.0;
}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

void main() {
	vec4 currentAlbedo = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 pastAlbedo = texSample2D(g_Texture1, v_TexCoord.xy);
	vec4 noiseAlbedo = texSample2D(g_Texture2, v_TexCoord.xy);
	vec4 cursorAlbedo = texSample2D(g_Texture1, g_PointerPosition);

	// decode rg range into more precise r value ... remove if later used for color imgs
	currentAlbedo.rg = vec2(decode_rg_range(currentAlbedo.rg),1.);
	pastAlbedo.rg = vec2(decode_rg_range(pastAlbedo.rg),1.);
	// end decode

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
	pastAlbedo = mix(pastAlbedo, noiseAlbedo, penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_NOISE));
	pastAlbedo = mix(pastAlbedo, cursorAlbedo, penInfluence * u_mouseDown * modeMatch(u_drawMode, DRAW_MODE_LEVEL));

	vec4 nextAlbedo = mix(pastAlbedo, currentAlbedo, modeMatch(u_cpyBelow, RESET_YES));
	nextAlbedo = mix(nextAlbedo, noiseAlbedo, modeMatch(u_cpyBelow, RESET_WITH_NOISE));

	// encode precise r value to rg range ... remove if later used for color imgs
	nextAlbedo.rg = encode_rg_range(nextAlbedo.r);
	// encode end

	gl_FragColor = nextAlbedo;
	//gl_FragColor = vec4(CAST3(penInfluence), 1.);
}
