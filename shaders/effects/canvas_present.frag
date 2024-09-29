
varying vec2 v_TexCoord;

// canvas texture
uniform sampler2D g_Texture0; // {"hidden":true}

// pen influence texture
uniform sampler2D g_Texture1; // {"hidden":true}

uniform vec3 u_drawColor; // {"material":"Draw Color","type":"color","default":"1 1 1"}

void main() {
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord);
	float penInfluence = texSample2D(g_Texture1, v_TexCoord).r;

	gl_FragColor = albedo + vec4(penInfluence, 0., 0., 0.);
}
