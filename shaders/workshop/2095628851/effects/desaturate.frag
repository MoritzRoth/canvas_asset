//#include "common.h"
//#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform float u_DesaturationAmount; // {"material":"Amount","default":1,"range":[0,1]}

varying vec4 v_TexCoord;

uniform sampler2D g_Texture1; // {"combo":"MASK","default":"util/white","label":"ui_editor_properties_opacity_mask","material":"mask","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}

void main() {
	vec4 albedo = texSample2D(g_Texture0, v_TexCoord.xy);
	
	float blend = u_DesaturationAmount;
#if MASK == 1
	blend *= texSample2D(g_Texture1, v_TexCoord.zw).r;
#endif
	
	albedo.rgb = mix (albedo.rgb,
	CAST3(dot(vec3(0.11, 0.59, 0.3), albedo.rgb)),
	blend);
	gl_FragColor = albedo;
}
