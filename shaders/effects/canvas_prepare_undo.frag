
varying vec2 v_TexCoord;

// last frame canvas
uniform sampler2D g_Texture0; // {"hidden":true}

// undo canvas
uniform sampler2D g_Texture1; // {"hidden":true}

uniform vec2 u_mouseDown; // {"material":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}

void main() {
	vec4 lastFrame = texSample2D(g_Texture0, v_TexCoord);
	vec4 undoFrame = texSample2D(g_Texture1, v_TexCoord);

	// update undo frame only if we start a new pen stroke this frame
	gl_FragColor = mix(undoFrame, lastFrame, step(0.5, u_mouseDown.x) * step(u_mouseDown.y, 0.5));
}
