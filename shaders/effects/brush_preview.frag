
uniform sampler2D g_Texture1; // {"material":"framebuffer","label":"Brush Texture"}

varying vec2 v_TexCoord;
uniform vec4 u_channelSelection; // {"material":"channelSelection","label":"Show Channel","default":"1 0 0 0","range":[0,1]}

void main() {
	vec4 albedo = texSample2D(g_Texture1, v_TexCoord.xy);

	gl_FragColor = vec4(CAST3(dot(albedo, u_channelSelection)), 1.);
}
