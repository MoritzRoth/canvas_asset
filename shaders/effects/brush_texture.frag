uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"material":"diffuse","label":"Diffuse","hidden":false, "default": "util/white"}

uniform vec3 u_channelMask; // {"material":"channelMask","label":"Channel Mask","linked":true,"default":"1 1 1","range":[0,1]}

varying vec2 v_TexCoord;

void main() {

	vec4 background = texSample2D(g_Texture0, v_TexCoord.xy);
	vec4 customTex = texSample2D(g_Texture1, v_TexCoord.xy);

	gl_FragColor = mix(background, min(customTex, background), vec4(u_channelMask, 0.));
}
