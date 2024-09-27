
uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}

varying vec2 v_TexCoord;

float decode_rg_range(vec2 rg) {
	return min(rg.r + rg.g / pow(2.,8.), 1.);
}

void main() {
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy);
	gl_FragColor = vec4(CAST3(decode_rg_range(albedo.rg)),1.);
}
