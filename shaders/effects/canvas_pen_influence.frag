
varying vec2 v_TexCoord;

#define EPSILON 0.00001
#define IPSILON 1. - EPSILON

uniform sampler2D g_Texture0; // {"hidden":true}

uniform vec4 g_Texture0Resolution;
uniform vec2 g_PointerPosition;
uniform vec2 g_PointerPositionLast;

uniform float u_drawRadius; // {"material":"Draw Radius","default":1,"range":[0,1]}
uniform float u_drawHardness; // {"material":"Draw Hardness","default":1,"range":[0,1]}
uniform float u_drawAlpha; // {"material":"Draw Alpha","default":1,"range":[0,1]}

uniform vec2 u_mouseDown; // {"material":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}

float NOT(float v) {
	return 1.-v;
}

// https://iquilezles.org/articles/distfunctions2d/
float sdSegment(vec2 p, vec2 a, vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

void main() {
	float previousInfluence = texSample2D(g_Texture0, v_TexCoord.xy).r;
	// only add to last influence if last frame the mouse was down
	float influence = mix(previousInfluence, 0., NOT(u_mouseDown.y));

	vec2 ratCorr = mix(
		vec2(1., g_Texture0Resolution.y/g_Texture0Resolution.x),
		vec2(g_Texture0Resolution.x/g_Texture0Resolution.y, 1.),
		step(g_Texture0Resolution.x, g_Texture0Resolution.y)
	);
	vec2 uv = v_TexCoord.xy * ratCorr;
	vec2 cursor = g_PointerPosition * ratCorr;
	vec2 lastCursor = g_PointerPositionLast * ratCorr;

	float penRadius = max(pow(u_drawRadius, 2.), EPSILON);
	float penSmoothRadius = penRadius * min(u_drawHardness, IPSILON);
	float currentInfluence = u_drawAlpha * u_mouseDown.x * (
		   NOT(u_mouseDown.y) * smoothstep(penRadius, penSmoothRadius, length(uv - cursor))
		 +     u_mouseDown.y  * smoothstep(penRadius, penSmoothRadius, sdSegment(uv, cursor, lastCursor))
	);

	influence = max(influence, currentInfluence);
	gl_FragColor = CAST4(influence);
}
