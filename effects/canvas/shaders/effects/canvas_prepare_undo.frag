
varying vec2 v_TexCoord;

#define CMD_NONE 0
#define CMD_UNDO 2

uniform sampler2D g_Texture0; // {"hidden":true}
#define PREV_CANVAS_TEX g_Texture0

uniform sampler2D g_Texture1; // {"hidden":true}
#define PREV_UNDO_TEX g_Texture1

uniform vec2 u_mouseDown; // {"material":"mouseDown","label":"Mouse Down (X = This Frame, Y = Last Frame)","linked":false,"default":"0 0","range":[0,1]}
uniform float u_command; // {"material":"cmd2","label":"Command Duplicate","int":true,"default":0,"range":[0,3]}

float modeMatch(float a, float b) {
	return step(abs(a-b), 0.1);
}

float NOT(float v) {
	return 1.-v;
}

void main() {

	// if this frame a new stroke is started, copy the last frame into the undo buffer
	float useLastAsNewUndoFrame = step(0.5, u_mouseDown.x) * step(u_mouseDown.y, 0.5);

	// if this frame a (non-undo) instruction is invoked, also remember the last frame so it can be rolled back to
	useLastAsNewUndoFrame += NOT(useLastAsNewUndoFrame) * NOT(modeMatch(CMD_NONE, u_command)) * NOT(modeMatch(CMD_UNDO, u_command));

	// update undo frame only if we start a new pen stroke this frame
	if(useLastAsNewUndoFrame) {
		gl_FragColor = texSample2D(PREV_CANVAS_TEX, v_TexCoord);
	}else {
		gl_FragColor = texSample2D(PREV_UNDO_TEX, v_TexCoord);
	}
}
