// [COMBO] {"material":"Noise type","combo":"TYPE","type":"options","default":0,"options":{"Value":0,"Value RGB":1,"Perlin":2,"Simplex":3,"Worley":4,"Voronoi":5}}
// [COMBO] {"material":"ui_editor_properties_blend_mode","combo":"BLENDMODE","type":"imageblending","default":0}
// [COMBO] {"material":"Blend transparency","combo":"TRANSPARENCY","type":"options","default":0,"options":{"Replace":0,"Keep original":1,"Overlay":2,"Average":3,"Negation":4}}
// [COMBO] {"material":"Animate","combo":"ANIMATE","type":"options","default":0}
// [COMBO] {"material":"Invert","combo":"INVERT","type":"options","default":0}

#include "common.h"
#include "common_blending.h"

uniform sampler2D g_Texture0; // {"material":"framebuffer","label":"ui_editor_properties_framebuffer","hidden":true}
uniform sampler2D g_Texture1; // {"default":"util/white","label":"ui_editor_properties_opacity_mask","material":"mask","mode":"opacitymask","paintdefaultcolor":"0 0 0 1"}
uniform float g_Time;
uniform vec4 g_Texture0Resolution;
uniform vec2 u_bounds; // {"default":"0.0 1.0","linked":true,"material":"Bounds","range":[0,1]}
uniform float u_alpha; // {"material":"Opacity","default":1,"range":[0,1]}
uniform float u_speed; // {"material":"Speed","default":1,"range":[0,2]}
uniform float u_magnitude; // {"material":"Movement magnitude","default":1,"range":[0,1]}
uniform float u_multiplier; // {"material":"Multiplier","default":1,"range":[0,3]}
uniform float u_scale; // {"default":"1.0","material":"Scale","range":[0,1]}
uniform vec2 u_offset; // {"default":"0.0 0.0","linked":true,"material":"Offset","range":[-1,1]}
uniform float u_octaves; // {"material":"Octaves","int":true,"default":1,"range":[1,10]}

varying vec2 v_TexCoord;

float BlendTransparency(float base, float blend, float opacity){
    float transparency = base; //normal transparency
#if TRANSPARENCY == 0
    transparency = blend; //replace transparency
#endif
#if TRANSPARENCY == 1
    transparency = min(base, blend); //Minimum transparency
#endif
#if TRANSPARENCY == 2
    transparency = base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend)); //Overlay transparency
#endif
#if TRANSPARENCY == 3
    transparency = (base + blend) / 2.0; //Average transparency
#endif
#if TRANSPARENCY == 4
    transparency = 1.0 - abs(1.0 - base - blend); //Negation transparency
#endif
    return mix(base, transparency, opacity);
}

float hash13(vec3 p3){
    p3 = frac(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return frac((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p){
    vec3 p3 = frac(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return frac((p3.xx + p3.yz) * p3.zy);
}

vec3 hash32(vec2 p){
    vec3 p3 = frac(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return frac((p3.xxy + p3.yzz) * p3.zyx);
}

vec3 hash33(vec3 p3){
    p3 = frac(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return frac((p3.xxy + p3.yxx) * p3.zyx);
}

vec3 mod289(vec3 x){
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x){
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x){
    return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r){
    return 1.79284291400159 - 0.85373472095314 * r;
}

vec3 fade(vec3 t) {
    return t*t*t*(t*(t*6.0-15.0)+10.0);
}

float perlin(vec3 P){
    vec3 Pi0 = floor(P); // Integer part for indexing
    vec3 Pi1 = Pi0 + 1.0; // Integer part + 1
    Pi0 = mod289(Pi0);
    Pi1 = mod289(Pi1);
    vec3 Pf0 = frac(P); // Fractional part for interpolation
    vec3 Pf1 = Pf0 - 1.0; // Fractional part - 1.0
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;

    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);

    vec4 gx0 = ixy0 * (1.0 / 7.0);
    vec4 gy0 = frac(floor(gx0) * (1.0 / 7.0)) - 0.5;
    gx0 = frac(gx0);
    vec4 gz0 = 0.5 - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, 0.0);
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);

    vec4 gx1 = ixy1 * (1.0 / 7.0);
    vec4 gy1 = frac(floor(gx1) * (1.0 / 7.0)) - 0.5;
    gx1 = frac(gx1);
    vec4 gz1 = 0.5 - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, 0.0);
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);

    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

    vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
    g000 *= norm0.x;
    g010 *= norm0.y;
    g100 *= norm0.z;
    g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
    g001 *= norm1.x;
    g011 *= norm1.y;
    g101 *= norm1.z;
    g111 *= norm1.w;

    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
    float n111 = dot(g111, Pf1);

    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
    vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
    float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
    return n_xyz;
}

float simplex(vec3 v){
    const vec2 C = vec2(0.166666666667, 0.333333333333);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    // Permutations
    i = mod289(i); 
    vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0)) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, 0.0);

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 105.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float worley(vec2 uv, float speed, float magnitude) {
	vec2 index_uv = floor(uv);
	vec2 fract_uv = frac(uv);
	
	float minimum_dist = 1.0, dist;
    vec2 neighbor, p, diff;
	
	for (int y = -1; y <= 1; y++) {
		for (int x = -1; x <= 1; x++) {
			neighbor = vec2(float(x), float(y));
			p = hash22(index_uv + neighbor);
			p = 0.5 + 0.5 * sin(g_Time * speed + 6.2831 * p) * magnitude;
			diff = neighbor + p - fract_uv;
			dist = length(diff);
			minimum_dist = min(minimum_dist, dist);
		}
	}
	return minimum_dist * u_multiplier * 2.0 - 1.0;
}

float voronoi(vec2 uv, float speed, float magnitude) {
	vec2 index_uv = floor(uv);
	vec2 fract_uv = frac(uv);
	
	float minimum_dist = 1.0, dist;
    vec2 neighbor, p, diff, m_point;
	
	for (int j=-1; j<=1; j++ ) {
        for (int i=-1; i<=1; i++ ) {
            vec2 neighbor = vec2(float(i),float(j));
            vec2 p = hash22(index_uv + neighbor);
            p = 0.5 + 0.5 * sin(g_Time * speed + 6.2831 * p) * magnitude;
            vec2 diff = neighbor + p - fract_uv;
            float dist = length(diff);

            if(dist < minimum_dist) {
                minimum_dist = dist;
                m_point = p;
            }
        }
    }
	return dot(m_point * u_multiplier, CAST2(0.5));
}

vec3 remap(float b1, float b2, vec3 v){
    return b1 + v * (b2 - b1);
}

const vec2 step = vec2(1.3, 1.7);
const float speed = u_speed * 0.01;
#if ANIMATE
    const float animate = g_Time * u_speed;
#else
    const float animate = 0.0;
#endif

void main() {
    const vec4 albedo = texSample2D(g_Texture0, v_TexCoord);
    const float mask = texSample2D(g_Texture1, v_TexCoord).r;
    const vec2 coord = (v_TexCoord * 2.0 - 1.0) * u_scale + u_offset;

    if (mask > 0.0 && u_alpha > 0.0){
#if TYPE == 0
	    vec3 col = CAST3(hash13(vec3(floor(coord * g_Texture0Resolution.xy), animate * 0.5)));
#endif
#if TYPE == 1
	    vec3 col = hash33(vec3(floor(coord * g_Texture0Resolution.xy), animate * 0.5));
#endif
#if TYPE == 2
        vec3 col = CAST3(0.0);
        for (int i = 1; i <= int(u_octaves); i++){
            col += (1.0 / (float(i) * 2.0)) * perlin(vec3((coord * 10.0 * float(i) * 2.0 - float(i) * float(i) * step), animate * 2.0));
        }
        col = col * 2.0 + 0.5;
#endif
#if TYPE == 3
        vec3 col = CAST3(0.0);
        for (int i = 1; i <= int(u_octaves); i++){
            col += (1.0 / (float(i) * 2.0)) * simplex(vec3((coord * 10.0 * float(i) * 2.0 - float(i) * float(i) * step), animate * 2.0));
        }
        col = col + 0.5;
#endif
#if TYPE == 4
        vec3 col = CAST3(0.0);
        for (int i = 1; i <= int(u_octaves); i++){
            col += (1.0 / (float(i) * 2.0)) * worley(coord * 10.0 * float(i) * 2.0 - float(i) * float(i) * step, animate * 0.0002, u_magnitude);
        }
        col = col + 0.5;
#endif
#if TYPE == 5
        vec3 col = CAST3(voronoi(coord * 10.0, animate * 0.0002, u_magnitude));
#endif

#if INVERT
        col = 1.0 - col;
#endif
        col = remap(u_bounds.x, u_bounds.y, col);
        col = ApplyBlending(BLENDMODE, albedo.rgb, col, u_alpha * mask);
        const float opacity = BlendTransparency(albedo.a, 1.0, u_alpha * mask);
        gl_FragColor = vec4(col, opacity);
    } else gl_FragColor = albedo;
}