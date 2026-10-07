import { clampTilt, smoothTilt, tiltForces, stepSlosh, stepStirring, type Slosh, type Tilt } from './tilt';
import { MIXING_SENSITIVITY, normalizeMixingSensitivity } from './mixing-sensitivity';
import { FrameLoop } from './frame-loop';
import { DEFAULT_FRAME_RATE, slowFrameRate, validFrameRate, type FrameRate } from './frame-rate';
import { reductionSizes } from './material-grid';
import type { TrayTelemetry } from './native-host';
import { circleBoundary, circleMergeGroups } from './circle-boundary';
import { EMULSION_SOURCES, separationReadiness } from './emulsion';
import { AMBIENT_FLOW } from './ambient-flow';
import { QR_SOURCES } from './qr-reveal';
import { portraitPattern } from './portrait-material';
import { QR_SIZE, QR_EXTENT, QR_REVEAL_SECONDS, qrTextureData } from './qr-pattern';
import { BOB_SIZE, BOB_EXTENT, bobTextureData } from './bob-pattern';
import { BobGesture, BOB_SECONDS, BOB_TIMING } from './bob-easter-egg';
import { DEFAULT_QR_ANIMATION, normalizeQrAnimation, type QrAnimationSettings } from './qr-animation-settings';
import { TELEMETRY_SOURCES, decodeTelemetry, type FluidTelemetry, type TelemetryContext } from './fluid-telemetry';

// Damped depth-averaged flow with a moving free surface in a circular bowl.
const SIM_SIZE = 192;
const DYE_SIZE = 512;
export type MaterialResolution = 384 | 512;
const PARTICLE_SIZE = 32;
const OUTER_RADIUS = 0.495;
// Must match the 110% canvas in .fluid-window. The physical wall is at its crop.
const VISIBLE_RADIUS = 0.5 / 1.1;
const MAX_STEP = 1 / 240; // Resolves gravity waves at the 192-cell grid spacing.
const BASE_VISCOSITY = 0.0005;
const VERTEX = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  uv=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;
const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 fragColor;
uniform vec2 texel;
uniform float boundaryRadius;
uniform bool hybridBoundary;
uniform bool curvedBoundary;
uniform bool mergedBoundary;
uniform sampler2D mergeGeometry;
uniform sampler2D boundaryGeometry;
uniform vec2 push;
uniform vec2 touchPoint;
uniform float touchStrength;
// Smooth potential well: bounded force, zero at the finger, no point sink.
vec2 gravityAt(vec2 p){
 if(touchStrength<0.0001)return push;
 vec2 d=touchPoint-p;
 return push+touchStrength*1.8*d*exp(-dot(d,d)/0.12);
}
const float R=0.495;
bool inside(vec2 p){return length(p-0.5)<boundaryRadius;}
bool wet(vec2 p){return curvedBoundary?texture(boundaryGeometry,p).z>0.00001:inside(p);}
vec2 wall(vec2 p){vec2 d=p-0.5;return 0.5+d*min(1.0,(boundaryRadius-texel.x)/max(length(d),0.00001));}
vec4 sampleLinear(sampler2D source, vec2 p){
#ifdef DISPLAY_LINEAR
  return texture(source,p);
#else
  vec2 size=vec2(textureSize(source,0));
  vec2 q=p*size-0.5;vec2 i=floor(q);vec2 f=fract(q);
  vec2 a=(i+0.5)/size;vec2 h=1.0/size;
  return mix(mix(texture(source,a),texture(source,a+vec2(h.x,0)),f.x),mix(texture(source,a+vec2(0,h.y)),texture(source,a+h),f.x),f.y);
#endif
}
// Consistent one-sided pressure gradient at a closed wall. A tilted plane
// keeps the same slope there instead of acquiring a half-strength derivative.
float boundaryHeight(sampler2D source,vec2 p){
 if(wet(p))return texture(source,p).x;
 vec2 d=p-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float imageRadius=min(2.0*boundaryRadius-r,boundaryRadius-1.5*texel.x);
 // Normal pressure balances tray acceleration at the actual circular wall.
 return sampleLinear(source,0.5+n*imageRadius).x+(r-imageRadius)*dot(gravityAt(0.5+n*boundaryRadius),n)/1.2;
}
vec2 boundaryVelocity(sampler2D source,vec2 p){
 if(wet(p))return texture(source,p).xy;
 vec2 d=p-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float imageRadius=min(2.0*boundaryRadius-r,boundaryRadius-1.5*texel.x);
 vec2 v=sampleLinear(source,0.5+n*imageRadius).xy;
 // Linear reflection through the true wall: zero normal velocity there,
 // continuous tangential velocity, even when the wall cuts a grid cell.
 return v-n*dot(v,n)*(1.0+(r-boundaryRadius)/(boundaryRadius-imageRadius));
}
float scalarSlope(sampler2D source,vec2 p,vec2 direction){
 vec2 a=p-direction*texel.x,b=p+direction*texel.x;
 if(curvedBoundary)return (boundaryHeight(source,b)-boundaryHeight(source,a))/(2.0*texel.x);
 bool left=inside(a),right=inside(b);
 if(left&&right)return (texture(source,b).x-texture(source,a).x)/(2.0*texel.x);
 if(right)return (texture(source,b).x-texture(source,p).x)/texel.x;
 if(left)return (texture(source,p).x-texture(source,a).x)/texel.x;
 return 0.0;
}
// Rendering only: keep all four interpolation taps inside the circular domain.
// Solver textures outside the bowl are zero and must not create a jagged rim.
vec4 sampleBowl(sampler2D source, vec2 p){
  vec2 size=vec2(textureSize(source,0));
  float inset=1.5/min(size.x,size.y);
  vec2 d=p-0.5;
  return sampleLinear(source,0.5+d*min(1.0,(R-inset)/max(length(d),0.00001)));
}
`;
const PARTICLE_VERTEX = `#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D particleState;
uniform float viewportSize;
out vec2 uv;
out float grainSeed;
out vec2 grainVelocity;
void main(){
  ivec2 cell=ivec2(gl_VertexID%32,gl_VertexID/32);
  vec4 state=texelFetch(particleState,cell,0);vec2 p=state.xy;
  grainVelocity=state.zw;
  grainSeed=fract(sin(float(gl_VertexID)*127.1+31.7)*43758.5453);
  uv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);
  gl_PointSize=max(3.0,viewportSize*0.026);
}`;
const SOURCES = {
  ...EMULSION_SOURCES,
  ...QR_SOURCES,
  ...TELEMETRY_SOURCES,
  ambientFlow: AMBIENT_FLOW,

  crestResponse: `uniform sampler2D previous;uniform sampler2D totals;uniform float stirring;uniform float dt;
void main(){
 vec4 sum=texelFetch(totals,ivec2(0),0);float area=max(sum.b,0.00001);
 float mean=sum.r/area;
 float variance=max(0.0,sum.a/area-mean*mean);
 // Normalize by the variance of fully separated phases at this same ratio.
 // Thus the actual gray mixture, rather than a timer, receives full light.
 float contrast=clamp(variance/max(mean*(1.0-mean),0.00001),0.0,1.0);
 float mixed=1.0-smoothstep(0.02,0.90,contrast);
 float motion=0.30*smoothstep(0.35,1.70,abs(stirring));
 float target=max(mixed,motion),current=texelFetch(previous,ivec2(0),0).r;
 float strength=mix(target,current,exp(-max(dt,0.0)/(target>current?1.1:2.8)));
 fragColor=vec4(strength,target,mixed,1);
}`,
  particleInit: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
void main(){
 vec2 cell=floor(uv*32.0);float a=hash(cell)*6.2831853;float r=sqrt(hash(cell+17.3))*min(0.465,boundaryRadius-texel.x*2.0);
 fragColor=vec4(vec2(cos(a),sin(a))*r+0.5,0,0);
}`,
  particleStep: `uniform sampler2D particleState;uniform sampler2D velocity;uniform float dt;
void main(){
 vec4 state=texture(particleState,uv);vec2 p=state.xy;
 // Midpoint flow sampling follows translation as well as curved trajectories.
 vec2 midpoint=wall(p+state.zw*dt*0.5);
 vec2 flow=sampleLinear(velocity,midpoint).xy;
 vec2 v=mix(state.zw,flow,1.0-exp(-dt*18.0));
 p+=(state.zw+v)*0.5*dt;
 vec2 d=p-0.5;float r=length(d);
 float contact=hybridBoundary?boundaryRadius-0.0015:0.475;
 if(r>contact){vec2 n=d/max(r,0.00001);p=0.5+n*contact;v-=1.15*n*max(dot(v,n),0.0);}
 fragColor=vec4(p,v);
}`,
  flowDisplay: `in float grainSeed;in vec2 grainVelocity;
void main(){
 float speed=length(grainVelocity);
 if(grainSeed>0.42||speed<0.001)discard;
 vec2 direction=vec2(grainVelocity.x,-grainVelocity.y)/speed;
 vec2 p=gl_PointCoord*2.0-1.0;
 vec2 q=vec2(dot(p,direction),dot(p,vec2(-direction.y,direction.x)));
 float extent=mix(0.18,0.78,smoothstep(0.0,0.045,speed));
 float distance=length(vec2(max(abs(q.x)-extent,0.0),q.y));
 float core=exp(-pow(distance/0.055,2.0));
 float halo=exp(-pow(distance/0.20,2.0));
 float fade=smoothstep(0.001,0.018,speed)*(1.0-smoothstep(0.46,0.48,length(uv-0.5)));
 fragColor=vec4(mix(vec3(0.42,0.78,0.90),vec3(0.91,0.98,1.0),core),fade*(core*0.85+halo*0.25));
}`,
  // Regularize only the height used for second derivatives. The dye and the
  // ordinary surface normals stay sharp; this is not a blur of the bowl image.
  crestHeight: `uniform sampler2D surface;
void main(){
 float height=0.0;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  float wx=x==0?6.0:(abs(x)==1?4.0:1.0);
  float wy=y==0?6.0:(abs(y)==1?4.0:1.0);
  height+=sampleLinear(surface,uv+vec2(float(x),float(y))/192.0).x*wx*wy;
 }
 fragColor=vec4(height/256.0,0,0,1);
}`,
  features: `uniform sampler2D surface;uniform sampler2D velocity;uniform bool flowMode;uniform bool crestMode;
float elevation(vec2 p){return sampleLinear(surface,p).x;}
void main(){
 // Extrapolated heights are useful for normals, but their second derivatives
 // are not real crests. Taper only this highlight where its stencil meets the
 // physical wall; pigment, surface lighting and particle motion stay intact.
 // Preserve the physical highlight width when the mobile grid is coarser.
 vec2 h=vec2(4.0/192.0,0);
 float radius=length(uv-0.5);
 fragColor=vec4(0);
 if(flowMode){
  vec2 dx=texture(velocity,uv+vec2(texel.x,0)).xy-texture(velocity,uv-vec2(texel.x,0)).xy;
  vec2 dy=texture(velocity,uv+vec2(0,texel.y)).xy-texture(velocity,uv-vec2(0,texel.y)).xy;
  float curl=(dx.y-dy.x)/(2.0*texel.x);
  float interior=1.0-smoothstep(R-6.0/192.0,R-4.0/192.0,radius);
  fragColor.ba=vec2(curl,length(texture(velocity,uv).xy))*interior;
 }
 if(!crestMode)return;
 float featureRadius=hybridBoundary&&!curvedBoundary?boundaryRadius:R;
 float interior=1.0-smoothstep(featureRadius-6.0/192.0,featureRadius-4.0/192.0,radius);
 if(interior<=0.0)return;
 float center=elevation(uv);
 // Principal curvatures reject a tilted plane and isolate convex wave ridges.
 float xx=2.0*center-elevation(uv+h)-elevation(uv-h);
 float yy=2.0*center-elevation(uv+h.yx)-elevation(uv-h.yx);
 float xy=(elevation(uv+h+h.yx)-elevation(uv+h-h.yx)-elevation(uv-h+h.yx)+elevation(uv-h-h.yx))*0.25;
 float mean=(xx+yy)*0.5;
 float spread=length(vec2((xx-yy)*0.5,xy));
 float ridge=max(0.0,mean+spread)*smoothstep(-0.00012,0.00002,mean-spread);
 float halo=smoothstep(0.000015,0.00038,ridge)*interior;
 float core=smoothstep(0.00016,0.00085,ridge)*interior;
 fragColor.rg=vec2(halo,core);
}`,
  advect: `uniform sampler2D velocity;
uniform sampler2D source;
uniform float dt;
uniform float decay;
uniform bool isVelocity;
void main(){
 if(!(isVelocity?wet(uv):inside(uv))){fragColor=vec4(0);return;}
 vec2 v=sampleLinear(velocity,uv).xy;
 vec2 midpoint=wall(uv-0.5*dt*v);
 vec2 back=wall(uv-dt*sampleLinear(velocity,midpoint).xy);
 vec4 value=sampleLinear(source,back)*decay;
 if(isVelocity){vec2 n=normalize(uv-0.5+vec2(0.000001));float edge=smoothstep(boundaryRadius-texel.x*(hybridBoundary?0.75:2.5),boundaryRadius,length(uv-0.5));value.xy-=n*dot(value.xy,n)*edge;}
 fragColor=value;
}`,
  momentum: `uniform sampler2D velocity;uniform sampler2D surface;uniform float dt;uniform float viscosity;
uniform float stirring;uniform vec2 stirCenter;uniform float maxSpeed;
vec2 stirringForce(vec2 p){
 vec2 d=p-0.5;float r2=dot(d,d),R2=boundaryRadius*boundaryRadius;
 // Differential rotation stretches interfaces instead of just rotating the
 // whole image. This distributed force is tangent to the circular wall.
 vec2 force=vec2(-d.y,d.x)*(0.65+1.8*exp(-r2/0.045));
 // An off-center recirculation follows the tray, breaking circular orbits.
 // Its streamfunction and gradient vanish at the wall (no outward forcing).
 float w=max(0.0,1.0-r2/R2);
 vec2 q=d-stirCenter;
 float spread=0.018;
 vec2 gradient=exp(-dot(q,q)/(2.0*spread))*(-4.0*w*d/R2-w*w*q/spread);
 force+=0.035*vec2(-gradient.y,gradient.x);
 // Stronger physical circulation; sensor activity and measured mixing stay independent.
 return force*stirring*1.25;
}
float height(vec2 p){return texture(surface,inside(p)?p:uv).x;}
vec2 vel(vec2 p){return curvedBoundary?boundaryVelocity(velocity,p):texture(velocity,inside(p)?p:uv).xy;}
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec2 h=vec2(texel.x,0),v=texture(velocity,uv).xy;
 vec2 slope=hybridBoundary
  ?vec2(scalarSlope(surface,uv,vec2(1,0)),scalarSlope(surface,uv,vec2(0,1)))
  :vec2(height(uv+h)-height(uv-h),height(uv+h.yx)-height(uv-h.yx))/(2.0*texel.x);
 vec2 laplacian=(vel(uv+h)+vel(uv-h)+vel(uv+h.yx)+vel(uv-h.yx)-4.0*v)/(texel.x*texel.x);
 // Both tray gravity and the touch well compete with hydrostatic pressure.
 v=(v+dt*(gravityAt(uv)+stirringForce(uv)-1.2*slope+viscosity*laplacian))*exp(-1.45*dt);
 v*=min(1.0,maxSpeed/max(length(v),0.00001));
 vec2 d=uv-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 if(!curvedBoundary)v-=n*dot(v,n)*smoothstep(boundaryRadius-texel.x*(hybridBoundary?0.75:1.5),boundaryRadius,r);
 fragColor=vec4(v,0,1);
}`,
  surface: `uniform sampler2D velocity;uniform sampler2D surface;uniform float dt;
float depth(vec2 p){
 float base=0.18-0.055*dot(p-0.5,p-0.5)/(boundaryRadius*boundaryRadius);
 return max(0.03,base+texture(surface,p).x);
}
float flux(vec2 neighbor,vec2 direction){
 if(!wet(neighbor))return 0.0;
 float speed=dot((texture(velocity,uv).xy+texture(velocity,neighbor).xy)*0.5,direction);
 if(hybridBoundary){
  // Couple pressure across each shared face: centered cell gradients alone
  // cannot see an alternating high/low (checkerboard) elevation field.
  float faceSlope=(texture(surface,neighbor).x-texture(surface,uv).x)/texel.x;
  float cellSlope=(scalarSlope(surface,uv,direction)+scalarSlope(surface,neighbor,direction))*0.5;
  speed-=dt*1.2*(faceSlope-cellSlope);
 }
 float aperture=1.0;
 if(curvedBoundary){
  vec2 face=uv+min(direction,vec2(0))*texel.x;
  vec4 geometry=texture(boundaryGeometry,face);
  aperture=abs(direction.x)>0.5?geometry.x:geometry.y;
  // Symmetric flux reduction prevents tiny cut cells imposing a tiny timestep.
  // Both sides use the same factor, preserving total depth exactly.
  if(!mergedBoundary)aperture*=min(1.0,2.0*min(texture(boundaryGeometry,uv).z,texture(boundaryGeometry,neighbor).z));
 }
 return aperture*speed*(speed>0.0?depth(uv):depth(neighbor));
}
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec2 h=vec2(texel.x,0);
 float outflow=flux(uv+h,vec2(1,0))+flux(uv-h,vec2(-1,0))+flux(uv+h.yx,vec2(0,1))+flux(uv-h.yx,vec2(0,-1));
 float volume=curvedBoundary?texture(boundaryGeometry,uv).z:1.0;
 if(!mergedBoundary){
  float elevation=texture(surface,uv).x-dt*outflow/(texel.x*volume);
  fragColor=vec4(clamp(elevation,-0.085,0.085),0,0,1);return;
 }
 float integral=texture(surface,uv).x*volume-dt*outflow/texel.x;
 // Keep integrated height until groups are combined, so tiny cells never
 // amplify or clip the update before their flux cancels with the neighbor.
 fragColor=vec4(integral,0,0,1);
}`,
  mergeSurface: `uniform sampler2D updates;uniform sampler2D surface;
void main(){
 if(!wet(uv)){fragColor=vec4(0);return;}
 vec4 group=texture(mergeGeometry,uv);
 if(group.y==texture(boundaryGeometry,uv).z){fragColor=vec4(texture(updates,uv).x/group.y,0,0,1);return;}
 float size=float(textureSize(mergeGeometry,0).x);
 vec2 parentCell=vec2(mod(group.x,size),floor(group.x/size));
 vec2 parent=(parentCell+0.5)*texel;
 float integral=texture(updates,parent).x;
 for(int k=0;k<4;k++){
  vec2 offset=k==0?vec2(1,0):k==1?vec2(-1,0):k==2?vec2(0,1):vec2(0,-1);
  vec2 p=parent+offset*texel;
  if(texture(mergeGeometry,p).x==group.x&&wet(p))integral+=texture(updates,p).x;
 }
 vec2 slope=vec2(scalarSlope(surface,parent,vec2(1,0)),scalarSlope(surface,parent,vec2(0,1)));
 float height=integral/group.y+dot(slope,(gl_FragCoord.xy-0.5-parentCell-group.zw)*texel);
 fragColor=vec4(height,0,0,1);
}`,
  // Display-only ghost values. Never used for mass flux or particle motion.
  padding: `uniform sampler2D source;uniform bool extrapolateHeight;uniform bool tangentVelocity;
void main(){
 vec2 d=uv-0.5;float r=length(d);vec2 n=d/max(r,0.00001);
 float cell=1.0/float(textureSize(source,0).x);
 // Keep the height extrapolation band at its reference physical width on
 // the coarse grid, with at least one cell to protect interpolation taps.
 float inset=extrapolateHeight?max(cell,1.5/192.0):1.5*cell;
 float safeRadius=boundaryRadius-inset;
 if(r<=safeRadius){fragColor=sampleLinear(source,uv);return;}
 vec2 a=0.5+n*safeRadius;
 vec4 value=sampleLinear(source,a);
 if(extrapolateHeight){
  float previous=sampleLinear(source,a-n*cell*2.0).x;
  float slope=clamp((value.x-previous)/(cell*2.0),-0.5,0.5);
  value.x+=slope*(r-safeRadius);
 }
 if(tangentVelocity){value.xy-=n*dot(value.xy,n)*smoothstep(safeRadius,boundaryRadius,r);}
 fragColor=value;
}`,
  reframe: `uniform sampler2D source;uniform float previousRadius;uniform bool isVelocity;uniform bool isDye;
void main(){
 if(!(isDye?inside(uv):wet(uv))){fragColor=vec4(0);return;}
 float inset=1.5/float(textureSize(source,0).x);
 vec2 d=(uv-0.5)*previousRadius/boundaryRadius;
 vec2 p=0.5+d*min(1.0,(previousRadius-inset)/max(length(d),0.00001));
 vec4 value=sampleLinear(source,p);
 if(isVelocity)value.xy*=boundaryRadius/previousRadius;
 fragColor=value;
}`,
  reframeParticles: `uniform sampler2D particleState;uniform float previousRadius;
void main(){
 vec4 state=texture(particleState,uv);
 float ratio=boundaryRadius/previousRadius;
 vec2 d=(state.xy-0.5)*ratio;float r=length(d);
 float contact=hybridBoundary?boundaryRadius-0.0015:0.475;
 fragColor=vec4(0.5+d*min(1.0,contact/max(r,0.00001)),state.zw*ratio);
}`,
  display: `uniform sampler2D dye;uniform sampler2D surface;uniform sampler2D features;uniform vec2 tilt;
uniform sampler2D crestState;uniform bool automaticCrests;
uniform bool crestsEnabled;uniform bool contoursEnabled;uniform bool heightEnabled;uniform bool gridEnabled;uniform bool dotsEnabled;uniform bool flowEnabled;
float phaseAt(vec2 p){return clamp(sampleBowl(dye,p).r,0.0,1.0);}
float isoline(float coordinate){
 float distance=abs(fract(coordinate-0.5)-0.5);
 float width=max(fwidth(coordinate),0.0001);
 return 1.0-smoothstep(width*0.35,width*1.25,distance);
}
void main(){
 vec2 d=uv-0.5;float r=length(d);
 float rimAA=fwidth(r);
 if(r>R+rimAA){fragColor=vec4(vec3(0.065),1);return;}
 float phase=phaseAt(uv);
 float dark=phase;
 vec2 h=vec2(1.0/float(textureSize(dye,0).x),0);
 vec2 gradient=vec2(phaseAt(uv+h)-phaseAt(uv-h),phaseAt(uv+h.yx)-phaseAt(uv-h.yx))/(2.0*h.x);
 vec2 sh=vec2(texel.x,0);
 vec2 slope=vec2(sampleBowl(surface,uv+sh).x-sampleBowl(surface,uv-sh).x,sampleBowl(surface,uv+sh.yx).x-sampleBowl(surface,uv-sh.yx).x)/(2.0*sh.x);
 float elevation=sampleBowl(surface,uv).x;
 // A small meniscus follows the evolving interface. Broad softbox highlights
 // make both phases wet, without floating sprites, static noise or film masks.
 vec3 normal=normalize(vec3(-slope*1.35-gradient*0.004-d*0.28+tilt*0.06,1.0));
 vec3 col=mix(vec3(0.90),vec3(0.045),dark);
 vec3 light=normalize(vec3(-0.5,0.65,1.1));
 col*=0.76+0.24*max(dot(normal,light),0.0);
 col*=1.0-elevation*0.6;
 vec3 reflection=reflect(vec3(0,0,-1),normal);
 float softbox=exp(-pow((reflection.x+0.21)/0.18,2.0)-pow((reflection.y-0.42)/0.65,6.0));
 float strip=exp(-pow((reflection.x-reflection.y*0.3-0.48)/0.075,2.0)-pow((reflection.y+0.15)/0.7,4.0));
 float spec=pow(max(dot(reflect(-light,normal),vec3(0,0,1)),0.0),44.0);
 col+=vec3(softbox*0.32+strip*0.18+spec*0.20)*mix(0.45,1.0,dark);
 float meniscus=4.0*phase*(1.0-phase);
 float edgeLight=max(dot(normalize(vec3(-gradient*0.004,1)),light),0.0);
 col+=vec3(meniscus*edgeLight*0.055);
 float edge=smoothstep(R-0.045,R,r);col*=1.0-0.30*edge;
 float interior=1.0-smoothstep(R-0.045,R,r);
 // Apply color layers before line work and crest light so every selected
 // effect remains visible, independent of the order of checkbox clicks.
 if(heightEnabled){
  float level=smoothstep(-0.045,0.045,elevation);
  vec3 low=mix(vec3(0.10,0.24,0.39),vec3(0.38,0.69,0.74),smoothstep(0.0,0.5,level));
  vec3 color=mix(low,vec3(1.0,0.84,0.57),smoothstep(0.5,1.0,level));
  float relief=smoothstep(0.001,0.018,abs(elevation));
  col=mix(col,color*(0.65+col*0.45),relief*interior*0.76);
 }
 if(flowEnabled){
  vec2 flow=sampleLinear(features,uv).ba;
  float swirl=smoothstep(0.05,0.9,abs(flow.x))*smoothstep(0.001,0.02,flow.y);
  vec3 color=mix(vec3(0.32,0.72,0.88),vec3(0.91,0.63,0.40),smoothstep(-0.3,0.3,flow.x));
  col=mix(col,color,swirl*0.38);
 }
 if(contoursEnabled){
  float lines=isoline(elevation*160.0);
  float relief=smoothstep(0.004,0.035,length(slope));
  col=mix(col*0.82,vec3(0.76,0.91,0.95),lines*relief*interior*0.78);
 }
 if(gridEnabled){
  vec2 grid=(uv+vec2(0.35,0.75)*elevation)*28.0;
  float lines=max(isoline(grid.x),isoline(grid.y));
  vec2 crest=sampleLinear(features,uv).rg;
  col=mix(col,vec3(0.63,0.81,0.85),lines*interior*(0.20+crest.x*0.55));
  col+=vec3(0.72,0.91,1.0)*lines*crest.y*0.40;
 }
 if(dotsEnabled){
  // A denser, surface-following lattice. Brightness follows the actual wave
  // height and curvature, so light travels with the crests without a timer.
  vec2 grid=(uv+vec2(0.35,0.75)*elevation)*72.0;
  float distance=length(fract(grid)-0.5);
  float aa=max(fwidth(distance),0.0001);
  float dotMask=1.0-smoothstep(0.12-aa*0.5,0.12+aa*0.5,distance);
  vec2 crest=sampleLinear(features,uv).rg;
  float intensity=clamp(0.16+0.48*smoothstep(-0.03,0.03,elevation)+crest.x*0.36+crest.y*0.22,0.0,1.0);
  vec3 dotColor=mix(vec3(0.13,0.19,0.23),vec3(0.91,0.97,1.0),intensity);
  col=mix(col,dotColor,dotMask*interior*0.90);
  float halo=1.0-smoothstep(0.12,0.34,distance);
  col+=vec3(0.60,0.83,1.0)*halo*crest.y*interior*0.12;
 }
 if(crestsEnabled){
  vec2 crest=sampleLinear(features,uv).rg;
  float amount=automaticCrests?texelFetch(crestState,ivec2(0),0).r:1.0;
  // A soft shoulder and a narrow luminous core preserve the ingredient texture.
  col=mix(col,vec3(0.94,0.97,1.0),crest.x*0.38*amount);
  col+=vec3(0.75,0.88,1.0)*crest.y*0.32*amount;
 }
 col=clamp(col,0.0,1.0);
 float coverage=1.0-smoothstep(R-rimAA,R+rimAA,r);
 fragColor=vec4(mix(vec3(0.065),col,coverage),1);
}`,
};

type Target = { texture: WebGLTexture; buffer: WebGLFramebuffer; size: number };
type Pair = { read: Target; write: Target };
type Program = { value: WebGLProgram; uniforms: Map<string, WebGLUniformLocation>; values: Map<string, number | boolean | number[]> };
type Uniform = number | boolean | number[] | Target;

export type SurfaceEffect = 'crests' | 'contours' | 'height' | 'grid' | 'dots' | 'flow';
export type RimMode = 'under' | 'edge' | 'hybrid' | 'curved';
export const WAVE_STRENGTH = { min: 1, max: 3, default: 1.25, step: 0.05 } as const;
export const WAVE_VISCOSITY = { min: 1, max: 4, default: 1, step: 0.1 } as const;
export type FluidQuality = 'detail' | 'performance';
export type FluidStats = { fps: number; quality: FluidQuality; pixels: number; resolution: number; materialResolution: number };
export type FluidOptions = { native?: boolean; materialResolution?: MaterialResolution; resolution?: 160 | 192 | 256 | 384; boundary?: 'previous' | 'merged'; stepScale?: 0.5 | 1; waves?: 'original' | 'higher'; quality?: FluidQuality; onStats?: (stats: FluidStats) => void; onTelemetry?: (telemetry: FluidTelemetry | null) => void; displayFiltering?: 'manual'; stirring?: boolean; dissolving?: boolean; automaticCrests?: boolean; organicSeparation?: boolean; ambientFlow?: boolean; easterEgg?: boolean };

export class FluidBowl {
  private gl: WebGL2RenderingContext;
  private programs = new Map<keyof typeof SOURCES, Program>();
  private targets: Target[] = [];
  private velocity: Pair;
  private dye: Pair;
  private portraitPattern: Target;
  private portraitOriginal: Target;
  private portraitElapsed = -1;
  private qrPattern: Target;
  private qrElapsed = -1;
  private qrReleasing = false;
  private qrAnimation = { ...DEFAULT_QR_ANIMATION };
  private qrResult: number | null = null;
  private bobGesture = new BobGesture();
  private bobPattern: Target | null = null;
  private bobOriginal: Target | null = null;
  private bobElapsed = -1;
  private phaseForward: Target;
  private phaseReverse: Target;
  private phaseChemical: Target;
  private phaseNoise: Target;
  private noiseSeed = NaN;
  private readonly dyeSize: MaterialResolution;
  private phaseNeighborhood: Pair;
  private phaseDomains: Pair;
  private phaseNearDomains: Target;
  private readonly organicSeparation: boolean;
  private phaseReductions: Target[] = [];
  private phaseAnchor: Target;
  private surface: Pair;
  private mixingVelocity: Pair;
  private ambientVelocity: Target;
  private ambientTime = 0;
  private readonly ambientFlowEnabled: boolean;
  private mixingSurface: Pair;
  private particles: Pair;
  private features: Target;
  private paddedSurface: Target;
  private paddedDye: Target;
  private paddedVelocity: Target;
  private crestSurface: Target;
  private crestState: Pair;
  private readonly automaticCrests: boolean;
  private boundaryGeometry: Target;
  private mergeGeometry: Target;
  private surfaceUpdate: Target;
  private readonly simSize: number;
  private readonly maxStep: number;
  private readonly mergeCells: boolean;
  private readonly quality: FluidQuality;
  private readonly onStats?: (stats: FluidStats) => void;
  private readonly onTelemetry?: (telemetry: FluidTelemetry | null) => void;
  private telemetryTargets: Target[] = [];
  private telemetryBuffer: WebGLBuffer | null = null;
  private telemetryFence: WebGLSync | null = null;
  private telemetryContext: TelemetryContext | null = null;
  private telemetryTime = -Infinity;
  private telemetryData = new Float32Array(16);
  private measuredMixing: { value: number; at: number } | null = null;
  private readonly linearSampler: WebGLSampler | null;
  private renderLimit: number;
  private statsStart = 0;
  private statsFrames = 0;
  private slowSamples = 0;
  private waveStrength: number;
  private waveViscosity: number = WAVE_VISCOSITY.default;
  private rimMode: RimMode = 'curved';
  private boundaryRadius = VISIBLE_RADIUS;
  private effects = new Set<SurfaceEffect>();
  private vao: WebGLVertexArrayObject;
  private tilt: Tilt = { x: 0, y: 0 };
  private targetTilt: Tilt = { x: 0, y: 0 };
  private stirring = 0;
  private activityTilt: Tilt = { x: 0, y: 0 };
  private activityDrive = 0;
  private finaleStirring = 0;
  private mixingSensitivity: number = MIXING_SENSITIVITY.default;
  private separationSeed = 0;
  private readonly dissolvingEnabled: boolean;
  private readonly stirringEnabled: boolean;
  private readonly loop: FrameLoop;
  private targetFrameRate: FrameRate = DEFAULT_FRAME_RATE;
  private readonly native: boolean;
  private paused = false;
  private physicsPaused = false;
  private resetPending = false;
  private elapsed = 0;
  private disposed = false;
  private touchTarget: Tilt | null = null;
  private touchPoint: Tilt = { x: .5, y: .5 };
  private touchStrength = 0;
  private resizeObserver: ResizeObserver;
  private visible = true;
  private intersectionObserver: IntersectionObserver;
  private slosh: Slosh = { offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } };

  constructor(private canvas: HTMLCanvasElement, options: FluidOptions = {}) {
    this.native = options.native === true;
    this.loop = new FrameLoop(this.tick);
    this.quality = options.quality ?? 'detail';
    this.automaticCrests = options.automaticCrests === true;
    this.organicSeparation = options.organicSeparation !== false;
    this.ambientFlowEnabled = options.ambientFlow === true;
    this.stirringEnabled = options.stirring !== false;
    this.dissolvingEnabled = options.dissolving !== false;
    this.onStats = options.onStats;
    this.onTelemetry = options.onTelemetry;
    this.renderLimit = this.quality === 'performance' ? 900 : 1300;
    if (this.native) this.renderLimit = Math.min(this.renderLimit, 1024);
    this.dyeSize = options.materialResolution ?? (this.quality === 'performance' ? 384 : DYE_SIZE);
    this.simSize = options.resolution ?? (this.quality === 'performance' ? 160 : SIM_SIZE);
    this.mergeCells = options.boundary !== 'previous';
    this.waveStrength = options.waves === 'original' ? WAVE_STRENGTH.min : WAVE_STRENGTH.default;
    // Diffusion scales with dx², gravity waves with dx. Respect both when
    // coarsening the mobile grid instead of simply taking much longer steps.
    const gridScale = SIM_SIZE / this.simSize;
    this.maxStep = MAX_STEP * Math.min(gridScale, gridScale ** 2) * (options.stepScale ?? 1);
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) throw new Error('Tento prohlížeč nepodporuje potřebnou grafiku.');
    this.gl = gl;
    // Only display passes use hardware filtering. The solver and circular
    // geometry keep their exact nearest/manual sampling and conservation.
    this.linearSampler = options.displayFiltering !== 'manual' && gl.getExtension('OES_texture_float_linear') ? gl.createSampler() : null;
    if (this.linearSampler) {
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.samplerParameteri(this.linearSampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Nepodařilo se připravit grafiku.');
    this.vao = vao;
    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    try {
      for (const [key, source] of Object.entries(SOURCES)) {
        const header = this.linearSampler && ['display', 'crestHeight', 'features'].includes(key)
          ? HEADER.replace('precision highp float;', 'precision highp float;\n#define DISPLAY_LINEAR') : HEADER;
        this.programs.set(key as keyof typeof SOURCES, this.program(header + source, key === 'flowDisplay' ? PARTICLE_VERTEX : VERTEX));
      }
      this.velocity = this.pair(this.simSize);
      this.dye = this.pair(this.dyeSize, true);
      this.portraitPattern = this.target(BOB_SIZE, true, 'r');
      this.portraitOriginal = this.target(this.dyeSize, true);
      this.qrPattern = this.target(QR_SIZE, true, 'r');
      if (options.easterEgg) {
        this.bobPattern = this.target(BOB_SIZE, true, 'r');
        this.bobOriginal = this.target(this.dyeSize, true);
      }
      this.phaseForward = this.target(this.dyeSize, true);
      this.phaseReverse = this.target(this.dyeSize, true);
      this.phaseChemical = this.target(this.dyeSize, true);
      this.phaseNeighborhood = this.pair(this.dyeSize / 4, true);
      this.phaseDomains = this.pair(this.dyeSize / 4, true);
      this.phaseNearDomains = this.target(this.dyeSize / 4, true);
      for (const size of reductionSizes(this.dyeSize)) this.phaseReductions.push(this.target(size, true));
      this.phaseNoise = this.target(this.dyeSize, true, 'r');
      this.phaseAnchor = this.target(1, true);
      this.surface = this.pair(this.simSize, true);
      this.mixingVelocity = this.stirringEnabled ? this.pair(this.simSize) : this.velocity;
      this.ambientVelocity = this.target(this.simSize, true);
      this.mixingSurface = this.stirringEnabled ? this.pair(this.simSize, true) : this.surface;
      this.particles = this.pair(PARTICLE_SIZE, true);
      this.features = this.target(this.simSize);
      this.paddedSurface = this.target(this.simSize, true);
      this.paddedDye = this.target(this.dyeSize);
      this.paddedVelocity = this.target(this.simSize);
      this.crestSurface = this.target(this.simSize, true);
      this.crestState = this.pair(1, true);
      this.boundaryGeometry = this.target(this.simSize, true);
      this.mergeGeometry = this.target(this.simSize, true);
      this.surfaceUpdate = this.target(this.simSize, true);
      if (this.onTelemetry) {
        for (const size of reductionSizes(Math.max(this.dyeSize, this.simSize))) this.telemetryTargets.push(this.target(size, true));
        this.telemetryBuffer = gl.createBuffer();
        if (!this.telemetryBuffer) throw new Error('Nepodařilo se připravit živý přehled.');
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.telemetryBuffer);
        gl.bufferData(gl.PIXEL_PACK_BUFFER, this.telemetryData.byteLength, gl.STREAM_READ);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      }
    } catch (error) {
      for (const program of this.programs.values()) gl.deleteProgram(program.value);
      for (const target of this.targets) { gl.deleteTexture(target.texture); gl.deleteFramebuffer(target.buffer); }
      gl.deleteSampler(this.linearSampler);
      gl.deleteBuffer(this.telemetryBuffer);
      gl.deleteVertexArray(vao);
      throw error;
    }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.intersectionObserver = new IntersectionObserver(([entry]) => { this.visible = entry.isIntersecting; this.updateLoop(); }, { rootMargin: '100px' });
    this.intersectionObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.updateLoop);
    this.resize(); this.reset();
    this.updateLoop();
  }

  get running() { return this.loop.running; }
  setFrameRate(fps: FrameRate) {
    if (!validFrameRate(fps) || this.targetFrameRate === fps) return;
    this.targetFrameRate = fps;
    this.loop.setFrameRate(fps);
    this.statsStart = 0; this.statsFrames = 0; this.slowSamples = 0;
  }
  get portraitActive() { return this.portraitElapsed >= 0; }
  get portraitPhase() {
    const t = this.portraitElapsed;
    return t < 0 ? 'idle' : t < BOB_TIMING.reveal ? 'revealing' : t < BOB_TIMING.reveal + BOB_TIMING.hold ? 'holding' : 'dissolving';
  }
  get easterEggActive() { return this.bobElapsed >= 0; }
  // GPU circulation uses upward Y; LED angles grow clockwise on screen.
  get finaleRotationDirection() { return this.finaleStirring > 0 ? -1 : 1; }
  setPaused(paused: boolean) { this.paused = paused; this.updateLoop(); }
  setPhysicsPaused(paused: boolean) {
    this.physicsPaused = paused;
    if (paused) this.stirring = 0;
  }
  setFinaleStirring(active: boolean) {
    if (active && this.finaleStirring === 0) {
      // Four times the maximum gesture drive; keep its last rotation direction.
      this.finaleStirring = (Math.sign(this.stirring) || 1) * 8;
    } else if (!active && this.finaleStirring !== 0) {
      this.finaleStirring = 0;
      this.stirring = 0;
    }
  }
  private updateLoop = () => {
    const enabled = !this.disposed && !this.paused && !document.hidden && this.visible;
    // WKWebView can suspend GPU work while hidden. Initialize the next portion
    // before resuming frames, rather than relying on writes made during sleep.
    if (enabled && this.resetPending) this.resetTextures(true);
    this.loop.setEnabled(enabled);
    if (!enabled) {
      this.touchTarget = null; this.touchStrength = 0;
      this.bobGesture.reset();
      this.stirring = 0; this.activityDrive = 0; this.activityTilt = { ...this.targetTilt }; this.statsStart = 0; this.statsFrames = 0; this.slowSamples = 0;
    }
  };

  getTrayState(): TrayTelemetry {
    const activity = Math.min(1, Math.abs(this.activityDrive));
    const settling = Math.hypot(this.slosh.velocity.x, this.slosh.velocity.y) > 0.001;
    return {
      phase: activity > 0.04 ? 'mixing' : settling ? 'settling' : 'ready',
      tiltX: this.tilt.x, tiltY: this.tilt.y, activity,
      // Retain the original wire field; this emulsion model has no oil layer.
      oil: 0, elapsed: this.elapsed,
      mixed: this.easterEggActive ? null : this.qrResult ?? (this.measuredMixing && performance.now() - this.measuredMixing.at < 1000 ? this.measuredMixing.value : null),
    };
  }

  private shader(type: number, source: string) {
    const gl = this.gl, shader = gl.createShader(type);
    if (!shader) throw new Error('Nepodařilo se vytvořit shader.');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const detail = gl.getShaderInfoLog(shader); gl.deleteShader(shader); console.error(detail);
      throw new Error('Grafický program se nepodařilo připravit.');
    }
    return shader;
  }
  private program(source: string, vertexSource: string): Program {
    const gl = this.gl, vertex = this.shader(gl.VERTEX_SHADER, vertexSource);
    let fragment: WebGLShader;
    try { fragment = this.shader(gl.FRAGMENT_SHADER, source); } catch (error) { gl.deleteShader(vertex); throw error; }
    const value = gl.createProgram();
    if (!value) { gl.deleteShader(vertex); gl.deleteShader(fragment); throw new Error('Nepodařilo se vytvořit grafický program.'); }
    gl.attachShader(value, vertex); gl.attachShader(value, fragment); gl.linkProgram(value);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) { const detail = gl.getProgramInfoLog(value); gl.deleteProgram(value); console.error(detail); throw new Error('Grafický program není kompatibilní s tímto zařízením.'); }
    const uniforms = new Map<string, WebGLUniformLocation>();
    const count = gl.getProgramParameter(value, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const name = gl.getActiveUniform(value, i)?.name;
      if (name) { const location = gl.getUniformLocation(value, name); if (location !== null) uniforms.set(name, location); }
    }
    return { value, uniforms, values: new Map() };
  }
  private target(size: number, fullPrecision = false, channels: 'rgba' | 'r' = 'rgba'): Target {
    const gl = this.gl, texture = gl.createTexture(), buffer = gl.createFramebuffer();
    if (!texture || !buffer) { if (texture) gl.deleteTexture(texture); if (buffer) gl.deleteFramebuffer(buffer); throw new Error('Nedostatek grafické paměti.'); }
    const target = { texture, buffer, size }; this.targets.push(target);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const format = channels === 'r' ? gl.RED : gl.RGBA;
    const storage = channels === 'r' ? (fullPrecision ? gl.R32F : gl.R16F) : (fullPrecision ? gl.RGBA32F : gl.RGBA16F);
    gl.texImage2D(gl.TEXTURE_2D, 0, storage, size, size, 0, format, fullPrecision ? gl.FLOAT : gl.HALF_FLOAT, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, buffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Zařízení nepodporuje výpočty proudění.');
    return target;
  }
  private pair(size: number, fullPrecision = false): Pair { return { read: this.target(size, fullPrecision), write: this.target(size, fullPrecision) }; }
  private swap(pair: Pair) { [pair.read, pair.write] = [pair.write, pair.read]; }
  private uniform(program: Program, name: string, value: number | boolean | number[], integer = false) {
    const location = program.uniforms.get(name);
    if (location === undefined) return;
    const previous = program.values.get(name), gl = this.gl;
    if (Array.isArray(value)) {
      if (Array.isArray(previous) && previous[0] === value[0] && previous[1] === value[1]) return;
      gl.uniform2f(location, value[0], value[1]); program.values.set(name, [value[0], value[1]]);
    } else {
      if (previous === value) return;
      if (typeof value === 'boolean' || integer) gl.uniform1i(location, Number(value));
      else gl.uniform1f(location, value);
      program.values.set(name, value);
    }
  }
  private draw(name: keyof typeof SOURCES, target: Target | null, uniforms: Record<string, Uniform>) {
    const gl = this.gl, program = this.programs.get(name)!;
    const filtered = this.linearSampler && (name === 'display' || name === 'crestHeight' || name === 'features');
    gl.useProgram(program.value); gl.bindVertexArray(this.vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.buffer ?? null);
    gl.viewport(0, 0, target?.size ?? this.canvas.width, target?.size ?? this.canvas.height);
    this.uniform(program, 'boundaryRadius', this.boundaryRadius);
    this.uniform(program, 'hybridBoundary', this.rimMode === 'hybrid' || this.rimMode === 'curved');
    this.uniform(program, 'curvedBoundary', this.rimMode === 'curved');
    this.uniform(program, 'mergedBoundary', this.rimMode === 'curved' && this.mergeCells);
    this.uniform(program, 'touchPoint', [this.touchPoint.x, this.touchPoint.y]);
    this.uniform(program, 'touchStrength', this.touchStrength);
    this.uniform(program, 'texel', [1 / this.simSize, 1 / this.simSize]);
    let unit = 0;
    for (const [key, value] of Object.entries({ boundaryGeometry: this.boundaryGeometry, mergeGeometry: this.mergeGeometry, ...uniforms })) {
      if (!program.uniforms.has(key)) continue;
      if (typeof value === 'number' || typeof value === 'boolean' || Array.isArray(value)) this.uniform(program, key, value);
      else {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value.texture);
        if (filtered) gl.bindSampler(unit, this.linearSampler);
        this.uniform(program, key, unit++, true);
      }
    }
    if (name === 'flowDisplay') {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_SIZE * PARTICLE_SIZE);
      gl.disable(gl.BLEND);
    } else gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (filtered) for (let i = 0; i < unit; i++) gl.bindSampler(i, null);
  }
  private resize() {
    const size = Math.max(1, Math.min(this.renderLimit, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, this.native ? 1 : 2))));
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
  }
  /** Normalized canvas coordinates, with upward GPU Y. Null releases the well. */
  setTouchAt(point: Tilt | null) {
    if (this.disposed) return;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) { this.touchTarget = null; return; }
    const x = point.x - .5, y = point.y - .5;
    const scale = Math.min(1, this.boundaryRadius * .95 / Math.max(Math.hypot(x, y), .00001));
    const next = { x: .5 + x * scale, y: .5 + y * scale };
    if (!this.touchTarget && this.touchStrength < .01) this.touchPoint = next;
    this.touchTarget = next;
  }
  setTilt(value: Tilt) { this.targetTilt = clampTilt(value); }
  setMixingSensitivity(value: number) {
    this.mixingSensitivity = normalizeMixingSensitivity(value);
  }
  setQrAnimation(value: QrAnimationSettings) {
    this.qrAnimation = normalizeQrAnimation(value);
  }
  setWaveStrength(value: number) {
    if (Number.isFinite(value)) this.waveStrength = Math.min(WAVE_STRENGTH.max, Math.max(WAVE_STRENGTH.min, value));
  }
  setWaveViscosity(value: number) {
    if (Number.isFinite(value)) this.waveViscosity = Math.min(WAVE_VISCOSITY.max, Math.max(WAVE_VISCOSITY.min, value));
  }
  setEffects(values: readonly SurfaceEffect[]) { this.effects = new Set(values); }
  setRimMode(value: RimMode) {
    if (this.disposed || value === this.rimMode) return;
    const previousRadius = this.boundaryRadius;
    const previousCurved = this.rimMode === 'curved';
    this.rimMode = value;
    this.boundaryRadius = value === 'hybrid' || value === 'curved' ? VISIBLE_RADIUS : OUTER_RADIUS;
    if (previousRadius === this.boundaryRadius && previousCurved === (value === 'curved')) return;
    // Carry the current portion into the new domain instead of reseeding it.
    for (const pair of new Set([this.velocity, this.surface, this.mixingVelocity, this.mixingSurface, this.dye])) {
      this.draw('reframe', pair.write, { source: pair.read, previousRadius, isVelocity: pair === this.velocity || pair === this.mixingVelocity, isDye: pair === this.dye });
      this.swap(pair);
    }
    this.draw('reframeParticles', this.particles.write, { particleState: this.particles.read, previousRadius });
    this.swap(this.particles);
    this.anchorMaterial();
    this.render();
  }
  getMotion() { return { offset: this.slosh.offset, oil: 0 }; }
  private materialTotals() {
    let source = this.dye.read;
    for (const target of this.phaseReductions) {
      this.draw('phaseReduce', target, { source, first: source === this.dye.read }); source = target;
    }
    return source;
  }
  private anchorMaterial() {
    this.draw('phaseAnchor', this.phaseAnchor, { totals: this.materialTotals() });
  }
  private materialVelocity() {
    return this.ambientFlowEnabled ? this.ambientVelocity : this.mixingVelocity.read;
  }
  private prepareMaterialNoise() {
    if (this.noiseSeed === this.separationSeed) return;
    this.draw('phaseNoise', this.phaseNoise, { separationSeed: this.separationSeed });
    this.noiseSeed = this.separationSeed;
  }
  private stepMaterial(dt: number) {
    const visitor = this.portraitActive;
    const pattern = visitor ? this.portraitPattern : this.bobPattern;
    const original = visitor ? this.portraitOriginal : this.bobOriginal;
    if ((visitor || this.easterEggActive) && pattern && original) {
      const previous = visitor ? this.portraitElapsed : this.bobElapsed;
      const elapsed = Math.min(BOB_SECONDS, previous + dt);
      if (visitor) this.portraitElapsed = elapsed; else this.bobElapsed = elapsed;
      const dissolveAt = BOB_TIMING.reveal + BOB_TIMING.hold;
      if (elapsed <= dissolveAt) {
        this.gatherPattern(dt, dt, pattern, Math.min(1, elapsed / BOB_TIMING.reveal), true);
      } else {
        // Return to the saved liquid field smoothly, conserving its phase ratio.
        const ease = (time: number) => { const t = Math.max(0, Math.min(1, (time - dissolveAt) / BOB_TIMING.dissolve)); return t * t * (3 - 2 * t); };
        const before = ease(previous), after = ease(elapsed);
        this.draw('patternRestore', this.dye.write, { source: this.dye.read, original, blend: (after - before) / Math.max(1e-9, 1 - before) });
        this.swap(this.dye);
        this.materialTotals(); this.stepCrests(dt);
      }
      if (elapsed >= BOB_SECONDS) {
        if (visitor) {
          this.portraitElapsed = -1;
          const gl = this.gl;
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.portraitPattern.buffer);
          gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        } else this.bobElapsed = -1;
        this.tilt = { ...this.targetTilt }; this.stirring = 0;
        this.clearTelemetry(); this.onTelemetry?.(null);
      }
      return;
    }
    if (this.qrElapsed >= 0) {
      const revealDt = dt * QR_REVEAL_SECONDS / this.qrAnimation.revealSeconds;
      this.qrElapsed = Math.min(QR_REVEAL_SECONDS, this.qrElapsed + revealDt);
      const progress = this.qrElapsed / QR_REVEAL_SECONDS;
      this.gatherPattern(dt, Math.min(dt, revealDt), this.qrPattern, progress);
      return;
    }
    if (Math.abs(this.stirring) > 0.02) this.qrReleasing = false;
    const disperseSpeed = this.qrReleasing ? this.qrAnimation.disperseSpeed : 1;
    // Faster breakup accelerates drift, not the stability-limited chemistry or
    // GPU substep count. A new stirring gesture restores normal material time.
    const chemistryDt = dt * Math.min(1, disperseSpeed);
    this.prepareMaterialNoise();
    if (this.ambientFlowEnabled) {
      this.ambientTime += dt * disperseSpeed;
      this.draw('ambientFlow', this.ambientVelocity, {
        velocity: this.mixingVelocity.read, time: this.ambientTime,
        seed: this.separationSeed, stirring: this.stirring,
      });
    }
    const velocity = this.materialVelocity();
    // Material and tracers follow the circulating flow; visible waves stay independent.
    const travel = dt * disperseSpeed;
    this.draw('phaseTransport', this.phaseForward, { phase: this.dye.read, velocity, dt: travel, correct: false });
    this.draw('phaseTransport', this.phaseReverse, { phase: this.phaseForward, velocity, dt: -travel, correct: false });
    this.draw('phaseTransport', this.dye.write, { phase: this.phaseForward, original: this.dye.read, reverse: this.phaseReverse, velocity, dt: travel, correct: true });
    this.swap(this.dye);
    if (this.dissolvingEnabled) {
      this.draw('phaseMixing', this.dye.write, { phase: this.dye.read, velocity, stirring: this.stirring, dt: chemistryDt });
      this.swap(this.dye);
    }
    const coalescence = separationReadiness(this.stirring);
    if (coalescence > 0) {
      this.draw('phaseNeighborhood', this.phaseNeighborhood.read, { phase: this.dye.read });
      this.draw('phaseNeighborhoodBlur', this.phaseNeighborhood.write, { source: this.phaseNeighborhood.read, direction: [this.dyeSize / DYE_SIZE, 0] });
      this.draw('phaseNeighborhoodBlur', this.phaseNeighborhood.read, { source: this.phaseNeighborhood.write, direction: [0, this.dyeSize / DYE_SIZE] });
      if (this.organicSeparation) {
        // Coverage travels through every convolution, keeping both broad
        // neighborhoods unbiased at the circular wall. No display blur.
        this.draw('phaseNeighborhoodBlur', this.phaseDomains.write, { source: this.phaseNeighborhood.read, direction: [3 * this.dyeSize / DYE_SIZE, 0] });
        this.draw('phaseNeighborhoodBlur', this.phaseNearDomains, { source: this.phaseDomains.write, direction: [0, 3 * this.dyeSize / DYE_SIZE] });
        this.draw('phaseNeighborhoodBlur', this.phaseDomains.write, { source: this.phaseNearDomains, direction: [5 * this.dyeSize / DYE_SIZE, 0] });
        this.draw('phaseNeighborhoodBlur', this.phaseDomains.read, { source: this.phaseDomains.write, direction: [0, 5 * this.dyeSize / DYE_SIZE] });
      }
      // The forward-advection scratch target is free until the next frame.
      this.draw('phaseAttraction', this.phaseForward, { neighborhood: this.phaseNeighborhood.read, nearDomains: this.phaseNearDomains, farDomains: this.phaseDomains.read, anchor: this.phaseAnchor, organicSeparation: this.organicSeparation, separationSeed: this.separationSeed });
    }
    // The local mobility is at most 36; the same bound protects every cell.
    const steps = Math.ceil(dt * 36 / 0.03);
    for (let i = 0; i < steps; i++) {
      this.draw('phaseChemical', this.phaseChemical, { phase: this.dye.read, noiseField: this.phaseNoise, coalescence, attraction: this.phaseForward });
      this.draw('phaseRelax', this.dye.write, { chemical: this.phaseChemical, phaseStep: chemistryDt / steps, coalescence });
      this.swap(this.dye);
    }
    // Transport on this compressible 2D surface can drift in area. Correct only
    // the interface toward the initial phase ratio; don't repaint the pattern.
    this.draw('phaseConserve', this.dye.write, { phase: this.dye.read, totals: this.materialTotals(), anchor: this.phaseAnchor });
    this.swap(this.dye);
    this.stepCrests(dt);
  }
  private gatherPattern(dt: number, chemistryDt: number, pattern: Target, progress: number, portrait = false) {
    this.prepareMaterialNoise();
    this.draw('qrGuide', this.phaseForward, { qr: pattern, noiseField: this.phaseNoise, progress, extent: portrait ? BOB_EXTENT : QR_EXTENT, portrait });
    const steps = Math.ceil(dt * 240);
    for (let i = 0; i < steps; i++) {
      this.draw('qrChemical', this.phaseChemical, { phase: this.dye.read, guide: this.phaseForward, progress });
      this.draw('qrGather', this.dye.write, { chemical: this.phaseChemical, dt: chemistryDt / steps });
      this.swap(this.dye);
    }
    this.materialTotals(); this.stepCrests(dt);
  }
  private stepCrests(dt: number) {
    if (!this.automaticCrests) return;
    // Reuse this frame's GPU reduction. No readback or changes to the physics.
    this.draw('crestResponse', this.crestState.write, { previous: this.crestState.read, totals: this.phaseReductions[this.phaseReductions.length - 1], stirring: this.stirring, dt });
    this.swap(this.crestState);
  }
  private clearTelemetry() {
    if (this.telemetryFence) this.gl.deleteSync(this.telemetryFence);
    this.telemetryFence = null; this.telemetryContext = null; this.telemetryTime = -Infinity;
    this.measuredMixing = null;
  }
  private reportTelemetry(time: number) {
    if (this.qrElapsed >= 0 || this.easterEggActive || this.portraitActive) return; // Choreography is not new mixing data.
    if (!this.onTelemetry || !this.telemetryBuffer) return;
    const gl = this.gl;
    if (this.telemetryFence) {
      const status = gl.clientWaitSync(this.telemetryFence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return;
      if (status === gl.WAIT_FAILED) { this.clearTelemetry(); this.onTelemetry(null); return; }
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.telemetryBuffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.telemetryData);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      if (this.telemetryContext) {
        const telemetry = decodeTelemetry(this.telemetryData, this.telemetryContext);
        this.measuredMixing = { value: telemetry.mixed, at: performance.now() };
        this.onTelemetry(telemetry);
      }
      gl.deleteSync(this.telemetryFence); this.telemetryFence = null;
    }
    if (time - this.telemetryTime < 200) return;
    this.telemetryTime = time;
    const coalescence = separationReadiness(this.stirring);
    const driftActivity = Math.max(0, Math.min(1, (Math.abs(this.stirring) - 0.15) / 0.85));
    this.telemetryContext = {
      stirring: this.stirring, recovery: this.dissolvingEnabled ? coalescence : 0,
      drift: this.ambientFlowEnabled ? 1 - driftActivity * driftActivity * (3 - 2 * driftActivity) : 0,
      driftEnabled: this.ambientFlowEnabled, organicEnabled: this.organicSeparation,
      dissolvingEnabled: this.dissolvingEnabled,
      crestsMode: this.effects.has('crests') ? 'on' : this.automaticCrests ? 'auto' : 'off',
      effects: [...this.effects].filter(effect => effect !== 'crests'),
    };
    // Queue only four RGBA pixels (64 bytes); collect after a fence signals on
    // a later frame. Neither reading every canvas pixel nor blocking the GPU.
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.telemetryBuffer);
    const queuePixel = (target: Target, offset: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, offset);
    };
    queuePixel(this.phaseReductions[this.phaseReductions.length - 1], 0);
    let source = this.telemetryTargets[0];
    this.draw('telemetryPhase', source, { phase: this.dye.read, coalescence });
    for (const target of this.telemetryTargets.slice(1)) {
      this.draw('telemetryReduce', target, { source, phaseMode: true }); source = target;
    }
    queuePixel(source, 16);
    // Reuse the smallest level covering the flow grid, including when the
    // material chain is non-power-of-two. The shader skips padded cells.
    const firstFlow = this.telemetryTargets.findIndex((target, index, targets) => target.size >= Math.ceil(this.simSize / 2) && (targets[index + 1]?.size ?? 0) < Math.ceil(this.simSize / 2));
    const flowTargets = this.telemetryTargets.slice(firstFlow);
    source = flowTargets[0];
    this.draw('telemetryFlow', source, { velocity: this.materialVelocity(), surface: this.surface.read });
    for (const target of flowTargets.slice(1)) {
      this.draw('telemetryReduce', target, { source, phaseMode: false }); source = target;
    }
    queuePixel(source, 32); queuePixel(this.crestState.read, 48);
    this.telemetryFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); gl.flush();
  }
  private reportFrame(time: number) {
    if (!this.statsStart) { this.statsStart = time; this.statsFrames = 0; return; }
    this.statsFrames++;
    const seconds = (time - this.statsStart) / 1000;
    if (seconds < 1) return;
    const fps = this.statsFrames / seconds;
    this.slowSamples = slowFrameRate(fps, this.targetFrameRate) ? this.slowSamples + 1 : 0;
    if (this.quality === 'performance' && this.slowSamples >= 3 && this.renderLimit > 600) {
      // Reduce shading pixels only. Never change grid/state mid-portion or
      // relax stable physics steps to catch up with a slow device.
      this.renderLimit = Math.max(600, Math.round(this.renderLimit * 0.85));
      this.resize(); this.slowSamples = 0;
    }
    this.onStats?.({ fps: Math.round(fps), quality: this.quality, pixels: this.canvas.width, resolution: this.simSize, materialResolution: this.dyeSize });
    this.statsStart = time; this.statsFrames = 0;
  }
  private render() {
    const automaticCrests = this.automaticCrests && !this.effects.has('crests');
    const crestsEnabled = automaticCrests || this.effects.has('crests'), gridEnabled = this.effects.has('grid'), dotsEnabled = this.effects.has('dots'), flowEnabled = this.effects.has('flow');
    const crestMode = crestsEnabled || gridEnabled || dotsEnabled;
    let surface = this.surface.read, dye = this.dye.read, velocity = this.materialVelocity();
    if (this.rimMode === 'hybrid' || this.rimMode === 'curved') {
      this.draw('padding', this.paddedSurface, { source: surface, extrapolateHeight: true, tangentVelocity: false });
      this.draw('padding', this.paddedDye, { source: dye, extrapolateHeight: false, tangentVelocity: false });
      surface = this.paddedSurface; dye = this.paddedDye;
      if (flowEnabled) {
        this.draw('padding', this.paddedVelocity, { source: velocity, extrapolateHeight: false, tangentVelocity: true });
        velocity = this.paddedVelocity;
      }
    }
    if (crestMode || flowEnabled) {
      let featureSurface = surface;
      if (this.rimMode === 'curved' && crestMode) {
        this.draw('crestHeight', this.crestSurface, { surface });
        featureSurface = this.crestSurface;
      }
      this.draw('features', this.features, { surface: featureSurface, velocity, flowMode: flowEnabled, crestMode });
    }
    this.draw('display', null, { dye, surface, features: this.features, crestState: this.crestState.read, automaticCrests, crestsEnabled, gridEnabled, dotsEnabled, flowEnabled, contoursEnabled: this.effects.has('contours'), heightEnabled: this.effects.has('height'), tilt: [this.tilt.x, -this.tilt.y] });
    if (flowEnabled) this.draw('flowDisplay', null, { particleState: this.particles.read, viewportSize: this.canvas.width });
  }
  setPortrait(image: ImageData) {
    if (this.disposed || this.paused || document.hidden) throw new Error('Kapalina není připravená na fotografii.');
    if (this.portraitActive) return;
    this.touchTarget = null;
    const values = portraitPattern(image);
    this.clearTelemetry(); this.onTelemetry?.(null);
    this.draw('patternRestore', this.portraitOriginal, { source: this.dye.read, original: this.dye.read, blend: 0 });
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.portraitPattern.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BOB_SIZE, BOB_SIZE, gl.RED, gl.FLOAT, values);
    this.portraitElapsed = 0;
  }

  revealQr() {
    if (this.disposed || this.qrElapsed >= 0 || this.easterEggActive || this.portraitActive) return;
    this.qrResult = this.measuredMixing?.value ?? null;
    this.clearTelemetry();
    this.qrElapsed = 0;
    this.qrReleasing = false;
    this.anchorMaterial();
  }
  releaseQr() {
    if (this.disposed || this.qrElapsed < 0 || this.easterEggActive) return;
    // Release only the guide. The existing liquid resumes its normal currents
    // and separation from precisely the same concentration field.
    this.qrElapsed = -1; this.qrResult = null;
    this.qrReleasing = true;
    // A held tray may be tilted. Releasing the neutral QR pose is not a gesture.
    this.tilt = { ...this.targetTilt }; this.stirring = 0;
    this.clearTelemetry(); this.onTelemetry?.(null);
  }
  reset({ render = true }: { render?: boolean } = {}) {
    if (this.disposed) return;
    this.elapsed = 0; this.portraitElapsed = -1;
    this.touchTarget = null; this.touchStrength = 0;
    this.bobElapsed = -1; this.bobGesture.reset();
    this.qrReleasing = false;
    this.qrElapsed = -1; this.qrResult = null;
    this.finaleStirring = 0;
    this.clearTelemetry(); this.onTelemetry?.(null);
    this.tilt = { ...this.targetTilt };
    this.activityTilt = { ...this.targetTilt }; this.activityDrive = 0;
    this.slosh = { offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 } }; this.stirring = 0; this.ambientTime = 0; this.separationSeed = Math.random() * 100;
    this.noiseSeed = NaN;
    this.resetPending = true;
    if (!document.hidden && (!this.paused || render)) this.resetTextures(render);
  }
  private resetTextures(render: boolean) {
    this.resetPending = false;
    const gl = this.gl;
    for (const target of this.targets) { gl.bindFramebuffer(gl.FRAMEBUFFER, target.buffer); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindTexture(gl.TEXTURE_2D, this.qrPattern.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, QR_SIZE, QR_SIZE, gl.RED, gl.FLOAT, qrTextureData());
    if (this.bobPattern) {
      gl.bindTexture(gl.TEXTURE_2D, this.bobPattern.texture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BOB_SIZE, BOB_SIZE, gl.RED, gl.FLOAT, bobTextureData());
    }
    gl.bindTexture(gl.TEXTURE_2D, this.boundaryGeometry.texture);
    const geometry = circleBoundary(this.simSize, VISIBLE_RADIUS);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simSize, this.simSize, gl.RGBA, gl.FLOAT, geometry);
    gl.bindTexture(gl.TEXTURE_2D, this.mergeGeometry.texture);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.simSize, this.simSize, gl.RGBA, gl.FLOAT, circleMergeGroups(this.simSize, geometry));
    this.draw('init', this.dye.read, { seed: Math.random() * 20 });
    this.anchorMaterial();
    this.draw('particleInit', this.particles.read, { seed: Math.random() * 20 });
    this.prepareMaterialNoise();
    if (render) this.render();
  }
  private advanceFlow(velocity: Pair, surface: Pair, force: Tilt, dt: number, circulating: boolean) {
    const viscosity = BASE_VISCOSITY * this.waveViscosity;
    const diffusionStep = 0.2 / (viscosity * this.simSize ** 2);
    // Preserve the original wave timestep. Only the stronger material current
    // needs the smaller step, including during its coast-down after release.
    const finaleSpeed = circulating && this.finaleStirring !== 0;
    const waveStep = this.maxStep / ((circulating ? 2 : 1) * (finaleSpeed ? 2 : 1) * Math.max(1, this.waveStrength - 1));
    const steps = Math.ceil(dt / Math.min(waveStep, diffusionStep)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      if (!circulating) this.slosh = stepSlosh(this.slosh, force, step);
      this.draw('advect', velocity.write, { velocity: velocity.read, source: velocity.read, dt: step, decay: 1, isVelocity: true }); this.swap(velocity);
      this.draw('momentum', velocity.write, { velocity: velocity.read, surface: surface.read, push: [force.x, force.y], stirring: circulating ? this.stirring : 0, stirCenter: [this.tilt.x * 0.22, -this.tilt.y * 0.22], maxSpeed: finaleSpeed ? 1.3 : .65, dt: step, viscosity }); this.swap(velocity);
      const merging = this.rimMode === 'curved' && this.mergeCells;
      this.draw('surface', merging ? this.surfaceUpdate : surface.write, { velocity: velocity.read, surface: surface.read, push: [force.x, force.y], dt: step });
      if (merging) this.draw('mergeSurface', surface.write, { updates: this.surfaceUpdate, surface: surface.read, push: [force.x, force.y] });
      this.swap(surface);
    }
  }
  private tick = (dt: number) => {
    if (this.disposed) return;
    const time = performance.now();
    const attraction = this.touchTarget && !this.portraitActive ? 1 : 0;
    this.touchStrength += (attraction - this.touchStrength) * (1 - Math.exp(-dt / (attraction ? .14 : .22)));
    if (this.touchStrength < .0001) this.touchStrength = 0;
    if (this.touchTarget) {
      const blend = 1 - Math.exp(-dt / .06);
      this.touchPoint = { x: this.touchPoint.x + (this.touchTarget.x - this.touchPoint.x) * blend, y: this.touchPoint.y + (this.touchTarget.y - this.touchPoint.y) * blend };
    }
    this.elapsed = Math.min(4_294_967, this.elapsed + dt);
    if (this.bobPattern && this.bobOriginal && !this.easterEggActive && this.finaleStirring === 0 && this.bobGesture.step(time / 1000, this.targetTilt)) {
      this.draw('patternRestore', this.bobOriginal, { source: this.dye.read, original: this.dye.read, blend: 0 });
      this.bobElapsed = 0;
      this.clearTelemetry(); this.onTelemetry?.(null);
    }
    // Continue sampling real gestures while the material is frozen or showing
    // its neutral QR pose. Standby needs this input to start the next portion.
    const previousActivityTilt = this.activityTilt;
    this.activityTilt = smoothTilt(previousActivityTilt, this.targetTilt, dt);
    this.activityDrive = stepStirring(this.activityDrive, previousActivityTilt, this.activityTilt, dt, this.mixingSensitivity);
    const previous = this.tilt;
    this.tilt = smoothTilt(previous, this.qrElapsed >= 0 || this.easterEggActive || this.portraitActive || this.finaleStirring !== 0 ? { x: 0, y: 0 } : this.targetTilt, dt);
    this.stirring = !this.physicsPaused && this.stirringEnabled && this.qrElapsed < 0 && !this.easterEggActive && !this.portraitActive
      ? this.finaleStirring || stepStirring(this.stirring, previous, this.tilt, dt, this.mixingSensitivity) : 0;
    if (!this.physicsPaused) {
      const trayForce = tiltForces(previous, this.tilt, dt);
      // Increase the physical surface response, including the matching wall
      // pressure condition. Sensor calibration, damping and rendering stay fixed.
      const force = { x: trayForce.x * this.waveStrength, y: trayForce.y * this.waveStrength };
      this.advanceFlow(this.velocity, this.surface, force, dt, false);
      if (this.stirringEnabled) this.advanceFlow(this.mixingVelocity, this.mixingSurface, force, dt, true);
      this.stepMaterial(dt);
      if (this.effects.has('flow')) {
        this.draw('particleStep', this.particles.write, { particleState: this.particles.read, velocity: this.materialVelocity(), dt }); this.swap(this.particles);
      }
    }
    else if (this.easterEggActive || this.portraitActive) this.stepMaterial(dt);
    this.reportFrame(time);
    this.reportTelemetry(time);
    this.render();
  };
  // Explicit diagnostic only: GPU readback deliberately blocks here. Normal
  // animation/telemetry never uses this timing path. Run on a separate bowl.
  async benchmark() {
    this.setPaused(true);
    const gl = this.gl, pixel = new Float32Array(4), dt = 1 / 30;
    const synchronize = () => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.dye.read.buffer);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, pixel);
    };
    const scenarios = [];
    for (const stirring of [0, 2]) {
      this.reset(); this.separationSeed = 17.3;
      this.draw('init', this.dye.read, { seed: 9.7 }); this.anchorMaterial();
      this.stirring = stirring;
      const force = { x: 0.128, y: -0.064 };
      const waves = () => this.advanceFlow(this.velocity, this.surface, force, dt, false);
      const current = () => this.advanceFlow(this.mixingVelocity, this.mixingSurface, force, dt, true);
      const material = () => this.stepMaterial(dt);
      const display = () => this.render();
      const frame = () => { waves(); current(); material(); display(); };
      for (let i = 0; i < 12; i++) frame();
      const timings: Record<string, number> = {};
      for (const [name, run] of Object.entries({ waves, current, material, display, frame })) {
        const samples = [];
        for (let batch = 0; batch < 6; batch++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          synchronize(); const start = performance.now();
          for (let i = 0; i < 4; i++) run();
          gl.finish(); synchronize();
          if (batch > 0) samples.push((performance.now() - start) / 4);
        }
        samples.sort((a, b) => a - b); timings[name] = samples[2];
      }
      scenarios.push({ stirring, milliseconds: timings, webglError: gl.getError() });
    }
    return { resolution: this.simSize, materialResolution: this.dye.read.size, pixels: this.canvas.width, scenarios };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true; this.loop.setEnabled(false);
    document.removeEventListener('visibilitychange', this.updateLoop);
    this.resizeObserver.disconnect(); this.intersectionObserver.disconnect();
    this.clearTelemetry(); this.gl.deleteBuffer(this.telemetryBuffer);
    for (const program of this.programs.values()) this.gl.deleteProgram(program.value);
    for (const target of this.targets) { this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.buffer); }
    this.gl.deleteSampler(this.linearSampler);
    this.gl.deleteVertexArray(this.vao);
  }
}
