// [COMBO] {"material":"Noise category","combo":"AA_CATEGORY","type":"options","default":0,"options":{"Color":0,"UV":1}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPECOLOR","type":"options","default":0,"options":{"Value":0,"Perlin":1,"Simplex":2,"Worley":3,"Voronoi":4},"require":{"AA_CATEGORY":0}}
// [COMBO] {"material":"Noise type","combo":"AB_TYPEUV","type":"options","default":0,"options":{"Voronoi":0,"Curl":1,"Flow":2},"require":{"AA_CATEGORY":1}}
// [COMBO] {"material":"Perspective","combo":"PERSPSWITCH","type":"options","default":0}
// [COMBO] {"material":"Perspective","combo":"AD_PERSPECTIVE","type":"options","default":1,"options":{"Noise":1,"Noise + mirrored":2,"Noise + opacity mask":3,"Noise + mirrored + opacity mask":4,"Noise + opacity mask (repeat)":5,"Noise + mirrored + opacity mask (repeat)":6},"require":{"PERSPSWITCH":1}}
// [COMBO] {"material":"Tileable","combo":"TILE","type":"options","default":0}

#include "common.h"
#include "common_perspective.h"

uniform mat4 g_ModelViewProjectionMatrix;
uniform float g_Time;
uniform vec4 g_Texture0Resolution;

uniform vec2 u_offset; // {"default":"0.0 0.0","group":"Compute noise","linked":true,"material":"Offset","range":[-1,1]}
uniform vec2 u_scale; // {"default":"1.0 1.0","group":"Compute noise","linked":true,"material":"Scale","range":[0,3]}
uniform float u_speed; // {"material":"animationspeed","label":"ui_editor_properties_animation_speed","default":1,"range":[0,3],"group":"Animate"}
uniform float u_dir; // {"material":"scrollirection","label":"ui_editor_properties_scroll_direction","default":0,"direction":true,"conversion":"rad2deg","group":"Animate"}
uniform float u_dirSpeed; // {"default":"0","group":"Animate","label":"ui_editor_properties_scroll_speed","material":"scrollspeed","range":[0,2]}
uniform float u_magnitude; // {"material":"Magnitude","default":1,"range":[0,1],"group":"Compute noise"}
uniform float u_shiftAmount; // {"material":"Sample shift amount","default":1,"range":[0,1],"group":"Compute noise"}
uniform float u_seed; // {"default":"0","group":"Compute noise","material":"Seed","range":[-1,1]}
uniform vec2 g_Point0; // {"default":"0 0","group":"Perspective","label":"p0","material":"point0"}
uniform vec2 g_Point1; // {"default":"1 0","group":"Perspective","label":"p1","material":"point1"}
uniform vec2 g_Point2; // {"default":"1 1","group":"Perspective","label":"p2","material":"point2"}
uniform vec2 g_Point3; // {"default":"0 1","group":"Perspective","label":"p3","material":"point3"}

attribute vec3 a_Position;
attribute vec2 a_TexCoord;

varying vec2 v_TexCoord;
varying vec3 v_PerspCoord;
varying vec2 v_Offset;
varying vec2 v_Scale;
varying vec2 v_Ratio;
varying float v_Animate;
varying float v_Magnitude;
varying vec2 v_ShiftAmount;

void main() {
	v_Ratio = vec2(1.0, g_Texture0Resolution.y / g_Texture0Resolution.x); //Aspect ratio

#if AB_TYPECOLOR == 0 && AA_CATEGORY == 0 //Is Value noise
	v_Scale = u_scale * g_Texture0Resolution.xy / 3.0;
    v_Animate = g_Time * u_speed * 0.05;
#else
	v_Scale = u_scale * 10.0;
	#if TILE //Is tileable
		v_Ratio = CAST2(1.0);
		v_Scale = (v_Scale - mod(v_Scale, CAST2(2.0))); //Keep the scale at values where tileability is possible
	#else
		v_Scale *= v_Ratio;
	#endif

	v_Magnitude = 0.0;
	#if (AB_TYPECOLOR == 3 || AB_TYPECOLOR == 4) && AA_CATEGORY == 0 || (AB_TYPEUV == 0 && AA_CATEGORY == 1) //Is Worley or Voronoi
		v_Animate = g_Time * u_speed * 4.0;
		v_Magnitude = u_magnitude * 0.5;
	#else //Is Perlin, Simplex, Curl or FLow
		v_Animate = g_Time * u_speed;
		#if AA_CATEGORY == 1
			v_Magnitude = u_magnitude * 0.2;
		#endif
	#endif
#endif
	
	v_Animate += u_seed;
	v_Offset = (u_offset + vec2(sin(-u_dir), cos(u_dir)) * g_Time * u_dirSpeed * 10.0) * v_Ratio * v_Scale; //Calculate offset and scroll

	v_ShiftAmount = CAST2(0.0);
#if AB_TYPEUV == 0 && AA_CATEGORY == 1 //is Voronoi UV
	v_ShiftAmount = u_shiftAmount / v_Scale;
#endif

#if PERSPSWITCH //With perspective
	mat3 xform = inverse(squareToQuad(g_Point0, g_Point1, g_Point2, g_Point3)); //Compute perspective
	v_PerspCoord = mul(vec3(a_TexCoord, 1.0), xform) * vec3(v_Scale, 1.0);
#else
	v_PerspCoord = vec3(a_TexCoord * v_Scale, 1.0);
#endif

	gl_Position = mul(vec4(a_Position, 1.0), g_ModelViewProjectionMatrix);
	v_TexCoord = a_TexCoord;
}