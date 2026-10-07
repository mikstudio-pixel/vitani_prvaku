// A transported concentration field. The dedicated material-current solver
// supplies velocity. R stores concentration, G stores local mixing exposure.
// This material model does not feed capillary forces back
// into that solver. All mass reductions/corrections stay on the GPU.
export const SEPARATION = { quietDrive: 0.35, activeDrive: 1.2, seconds: 7 } as const;

// A small hand tremor should not continually postpone phase recovery. Match
// the smooth plateau used by local exposure decay in the GPU shader below.
export function separationReadiness(stirring: number): number {
  const t = Math.max(0, Math.min(1, (Math.abs(stirring) - SEPARATION.quietDrive) / (SEPARATION.activeDrive - SEPARATION.quietDrive)));
  return 1 - t * t * (3 - 2 * t);
}

const PHASE = `
uniform sampler2D phase;
float concentration(vec2 p){
 return texture(phase,inside(p)?p:uv).r;
}
`;

const PHASE_NOISE = `uniform float separationSeed;
float separationHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+separationSeed)*43758.5453);}
float separationNoise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(separationHash(i),separationHash(i+vec2(1,0)),f.x),mix(separationHash(i+vec2(0,1)),separationHash(i+1.0),f.x),f.y);
}
`;

// Broad exchanges are for regrouping already separating material. Applying
// them to still-miscible filaments amplifies diffusion as soon as stirring stops.
const COALESCENCE = `
float separatedMaterial(float exposure){return 1.0-smoothstep(0.15,0.60,exposure);}
`;

export const EMULSION_SOURCES = {
  // This field depends only on position and the portion's seed. Keep its
  // full precision, but evaluate the noise once rather than in every substep.
  phaseNoise: PHASE_NOISE + `
void main(){
 vec2 rotated=mat2(0.8,-0.6,0.6,0.8)*uv;
 float fluctuation=2.0*(0.7*separationNoise(rotated*6.0)+0.3*separationNoise(rotated*11.0+17.0)-0.5);
 fragColor=vec4(fluctuation,0,0,1);
}`,
  init: `uniform float seed;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 p=uv*11.0;
 p+=vec2(noise(p*0.72+7.0),noise(p*0.72+23.0))*1.6;
 float field=noise(p)*0.70+noise(p*2.1+11.0)*0.25+noise(p*4.3)*0.05;
 float c=smoothstep(0.465,0.505,field);
 fragColor=vec4(c,0,0,1);
}`,
  // Bounded MacCormack transport recovers fine filaments lost by a single
  // semi-Lagrangian lookup. The donor-cell limiter prevents ringing/overshoot.
  phaseTransport: `uniform sampler2D phase;uniform sampler2D velocity;uniform float dt;
uniform sampler2D original;uniform sampler2D reverse;uniform bool correct;
vec2 phaseWall(vec2 p){
 vec2 d=p-0.5;float inset=1.5/float(textureSize(phase,0).x);
 return 0.5+d*min(1.0,(boundaryRadius-inset)/max(length(d),0.00001));
}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 v=sampleLinear(velocity,uv).xy;
 vec2 mid=phaseWall(uv-dt*v*0.5);
 vec2 back=phaseWall(uv-dt*sampleLinear(velocity,mid).xy);
 vec2 value;
 if(correct){
  value=texture(phase,uv).rg+0.5*(texture(original,uv).rg-texture(reverse,uv).rg);
  vec2 size=vec2(textureSize(original,0));vec2 p=(floor(back*size-0.5)+0.5)/size;
  vec2 lo=vec2(1),hi=vec2(0);
  for(int y=0;y<2;y++)for(int x=0;x<2;x++){
   vec2 a=texture(original,phaseWall(p+vec2(float(x),float(y))/size)).rg;
   lo=min(lo,a);hi=max(hi,a);
  }
  value=clamp(value,lo,hi);
 }else value=sampleLinear(phase,back).rg;
 fragColor=vec4(clamp(value,0.0,1.0),0,1);
}`,
  // Exposure belongs to the moving material, not to one clock for the bowl.
  // Symmetric strain detects stretching/shearing, excluding rigid rotation.
  phaseMixing: PHASE + `uniform sampler2D velocity;uniform float stirring;uniform float dt;
vec2 flow(vec2 p){return sampleLinear(velocity,inside(p)?p:uv).xy;}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 state=texture(phase,uv).rg;
 float h=2.0/float(textureSize(velocity,0).x);
 vec2 dx=(flow(uv+vec2(h,0))-flow(uv-vec2(h,0)))/(2.0*h);
 vec2 dy=(flow(uv+vec2(0,h))-flow(uv-vec2(0,h)))/(2.0*h);
 float strain=length(vec2(dx.x-dy.y,dx.y+dy.x));
 float stretch=1.0-exp(-strain*2.5);
 vec2 reach=vec2(6.0/512.0,0);
 float contact=clamp(4.0*state.r*(1.0-state.r)+0.5*(
  abs(concentration(uv+reach)-state.r)+abs(concentration(uv-reach)-state.r)+
  abs(concentration(uv+reach.yx)-state.r)+abs(concentration(uv-reach.yx)-state.r)),0.0,1.0);
 float activity=clamp((abs(stirring)-${SEPARATION.quietDrive})/${2 - SEPARATION.quietDrive},0.0,1.0);
 float dissolve=activity*activity*stretch*(0.08+0.92*contact)/5.0;
 float quiet=1.0-smoothstep(${SEPARATION.quietDrive},${SEPARATION.activeDrive},abs(stirring));
 float separate=quiet/${SEPARATION.seconds.toFixed(1)};
 float rate=dissolve+separate;
 float target=dissolve/max(rate,0.000001);
 float exposure=mix(target,state.g,exp(-max(dt,0.0)*rate));
 fragColor=vec4(state.r,clamp(exposure,0.0,1.0),0,1);
}`,
  // Neighborhood averages guide attraction over a visible distance. They are
  // not rendered or copied into the concentration: only chemical potential
  // uses them. Weighted coverage prevents the circular rim from adding black.
  phaseNeighborhood: `uniform sampler2D phase;
void main(){
 ivec2 start=ivec2(gl_FragCoord.xy)*4;float sum=0.0,weight=0.0;
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){
  ivec2 cell=start+ivec2(x,y);vec2 p=(vec2(cell)+0.5)/vec2(textureSize(phase,0));
  if(inside(p)){sum+=texelFetch(phase,cell,0).r;weight+=1.0;}
 }
 fragColor=vec4(sum,weight,0,0)/16.0;
}`,
  phaseNeighborhoodBlur: `uniform sampler2D source;uniform vec2 direction;
void main(){
 vec2 sum=vec2(0);float weight=0.0;
 for(int i=-7;i<=7;i++){
  float w=exp(-float(i*i)/18.0);
  sum+=texture(source,uv+direction*float(i)/vec2(textureSize(source,0))).rg*w;weight+=w;
 }
 fragColor=vec4(sum/weight,0,0);
}`,
  phaseAttraction: PHASE_NOISE + `uniform sampler2D neighborhood;
uniform sampler2D nearDomains;uniform sampler2D farDomains;uniform sampler2D anchor;
uniform bool organicSeparation;
float average(vec2 p){vec2 v=sampleLinear(neighborhood,p).rg;return v.r/max(v.g,0.00001);}
void main(){
 vec2 h=vec2(1.0/float(textureSize(neighborhood,0).x),0);
 vec2 gradient=0.5*vec2(average(uv+h)-average(uv-h),average(uv+h.yx)-average(uv-h.yx));
 // Strong attraction removes small dispersed domains. Once a coherent large
 // boundary forms, let the local potential keep its liquid interface crisp.
 float dispersed=1.0-smoothstep(0.025,0.075,length(gradient));
 float repulsion=0.0;
 if(organicSeparation){
  vec2 nearValue=sampleLinear(nearDomains,uv).rg,farValue=sampleLinear(farDomains,uv).rg;
  float mean=texelFetch(anchor,ivec2(0),0).r;
  // Competing short attraction / broad inhibition, inspired by Ohta–Kawasaki.
  // Two finite-range kernels replace the exact inverse-Laplacian interaction.
  // Smooth, seeded spatial variation avoids one preferred cell size;
  // it changes the interaction, never paints a new concentration pattern.
  vec2 p=mat2(0.8,-0.6,0.6,0.8)*uv*3.2;
  p+=vec2(separationNoise(p+7.0),separationNoise(p+19.0))*1.4;
  float scale=separationNoise(p+31.0);
  float strength=mix(0.08,0.22,separationNoise(p*1.7+43.0));
  float surrounding=mix(nearValue.r/max(nearValue.g,0.00001),farValue.r/max(farValue.g,0.00001),scale);
  repulsion=strength*(surrounding-mean);
 }
 fragColor=vec4(average(uv),dispersed,repulsion,1);
}`,
  phaseChemical: PHASE + COALESCENCE + `
uniform sampler2D noiseField;
uniform float coalescence;
uniform sampler2D attraction;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 float h=1.0/float(textureSize(phase,0).x),c=concentration(uv),lap=0.0;
 float miscibility=texture(phase,uv).g;
 // Nine-point isotropic Laplacian reduces alignment with the texture grid.
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(x==0&&y==0)continue;
  float w=x==0||y==0?2.0/3.0:1.0/6.0;
  lap+=w*(concentration(uv+vec2(float(x),float(y))*h)-c);
 }
 // Keep separation and capillarity separate: each shared edge blends their
 // flux with diffusion using the mean exposure of its two material cells.
 float chemical=4.0*c*(c-0.5)*(c-1.0);
 // Suppress the tiny, fastest-growing domains and favor broad connected
 // regions at rest. The short-range interface and active stirring stay intact.
 vec3 average=texture(attraction,uv).rgb;
 chemical+=coalescence*separatedMaterial(miscibility)*(2.2*average.g*(c-average.r)+average.b);
 // A perfectly uniform concentration cannot spontaneously break symmetry.
 // Tiny smooth chemical-potential fluctuations nucleate new domains as the
 // mixture cools, without injecting concentration or restoring the seed image.
 // Fade them outside the transition and once a domain becomes distinct.
 float recovery=smoothstep(0.02,0.12,miscibility)*(1.0-smoothstep(0.20,0.40,miscibility));
 float mixed=exp(-pow((c-0.5)/0.16,2.0));
 float fluctuation=texture(noiseField,uv).r;
 chemical+=0.006*recovery*mixed*fluctuation;
 float gridScale=float(textureSize(phase,0).x)/512.0;
 fragColor=vec4(c,chemical,miscibility,-0.70*lap*gridScale*gridScale);
}`,
  // Cahn–Hilliard-style chemical-potential exchange. Each shared edge uses
  // equal/opposite transfers, limited by donor and receiver capacities. This
  // keeps both fractions bounded and conserves their sum without CPU readback.
  phaseRelax: COALESCENCE + `uniform sampler2D chemical;uniform float phaseStep;uniform float coalescence;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec4 state=texture(chemical,uv);float c=state.r;
 float h=1.0/float(textureSize(chemical,0).x),change=0.0;
 for(int shell=0;shell<2;shell++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(shell==1&&coalescence==0.0)continue;
  if(x==0&&y==0)continue;
  float gridScale=float(textureSize(chemical,0).x)/512.0;
  float reach=shell==0?1.0:8.0*gridScale;
  vec2 p=uv+vec2(float(x),float(y))*h*reach;
  if(!inside(p))continue;
  vec4 other=texture(chemical,p);
  float w=x==0||y==0?2.0/3.0:1.0/6.0;
  float exposure=0.5*(state.b+other.b);
  // Use the shared edge's exposure so transfers remain equal and opposite.
  // Keep the local mixing memory; delay only the broad coalescence stencil.
  float grouping=coalescence*separatedMaterial(exposure);
  float strength=shell==0?1.0-0.75*grouping:0.75*grouping;
  float mobility=12.0+24.0*exposure+12.0*grouping*(1.0-exposure);
  // The immediate stencil's physical spacing changes with resolution; the
  // broad shell keeps its physical reach. Preserve their diffusion rates.
  if(shell==0)mobility*=gridScale*gridScale;
  // Symmetric coefficients conserve concentration and avoid moving a pure
  // constant phase just because the local mixing exposure varies across it.
  float separating=(1.0-exposure)*(other.g-state.g)+other.a-state.a;
  // Dissolution always uses immediate neighbors. Enabling long-range grouping
  // must not turn the same mixing memory into an eight-texel diffusion brush.
  float diffusion=shell==0?1.5*exposure*(other.r-c):0.0;
  float transfer=phaseStep*mobility*w*(strength*separating+diffusion);
  float neighbors=coalescence>0.0?16.0:8.0;
  transfer=clamp(transfer,-min(c,1.0-other.r)/neighbors,min(other.r,1.0-c)/neighbors);
  change+=transfer;
 }
 fragColor=vec4(c+change,state.b,0,1);
}`,
  phaseReduce: `uniform sampler2D source;uniform bool first;
void main(){
 ivec2 cell=ivec2(gl_FragCoord.xy)*2;vec4 sum=vec4(0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  ivec2 p=cell+ivec2(x,y);
  if(any(greaterThanEqual(p,textureSize(source,0))))continue;
  vec4 value=texelFetch(source,p,0);
  if(first){
   vec2 point=(vec2(p)+0.5)/vec2(textureSize(source,0));
   float c=clamp(value.r,0.0,1.0);
   // The second moment also measures actual color uniformity for crest light.
   value=inside(point)?vec4(c,min(c,1.0-c),1,c*c):vec4(0);
  }
  sum+=value;
 }
 fragColor=sum*0.25;
}`,
  phaseAnchor: `uniform sampler2D totals;
void main(){vec4 s=texelFetch(totals,ivec2(0),0);fragColor=vec4(s.r/max(s.b,0.00001),0,0,1);}`,
  phaseConserve: `uniform sampler2D phase;uniform sampler2D totals;uniform sampler2D anchor;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec4 s=texelFetch(totals,ivec2(0),0);
 float target=texelFetch(anchor,ivec2(0),0).r;
 float correction=clamp((target*s.b-s.r)/max(s.g,0.0000001),-1.0,1.0);
 float c=clamp(texture(phase,uv).r,0.0,1.0);
 c+=min(c,1.0-c)*correction;
 fragColor=vec4(c,texture(phase,uv).g,0,1);
}`,
};
