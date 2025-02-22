
// [COMBO] {"material":"Check if using Post-Processing Layer","combo":"IS_POST_PROCESSING_LAYER","type":"options","default":0}

uniform mat4 g_ModelViewProjectionMatrix;
uniform mat4 g_EffectModelViewProjectionMatrix;

attribute vec3 a_Position;
attribute vec2 a_TexCoord;

varying vec4 v_TexCoord;
varying vec2 sspos;


void main() {
	// calculate vertex position
	gl_Position = mul(vec4(a_Position, 1.0), g_ModelViewProjectionMatrix);

	#if IS_POST_PROCESSING_LAYER == 0
		vec2 ndcSpace = mul(vec4(a_Position, 1.0), g_EffectModelViewProjectionMatrix).xy;
		sspos = (ndcSpace.xy + 1.0) * 0.5; // map from ndc space [-1,1] to screen space [0,1]
		sspos = vec2(sspos.x, 1.0 - sspos.y); // invert y-axis
	#endif
	#if IS_POST_PROCESSING_LAYER == 1
		sspos = mul(vec4(a_TexCoord, 0., 1.0), g_ModelViewProjectionMatrix).xy;
	#endif
	
	v_TexCoord.xy = a_TexCoord;
}
