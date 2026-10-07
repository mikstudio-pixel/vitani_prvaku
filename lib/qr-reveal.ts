// The guide is a chemical potential, not a concentration image. Every update
// transfers existing dark material between cells, with equal/opposite fluxes.
export const QR_SOURCES = {
  qrGuide: `uniform sampler2D qr;uniform sampler2D noiseField;uniform float progress;uniform float extent;uniform bool portrait;uniform float backgroundExtent;
void main(){
 vec2 p=(uv-0.5)/extent+0.5;
 vec2 n=vec2(textureSize(qr,0)),cell=p*n;
 // Broad connected contours emerge first; there are no scattered bead targets.
 float sharpen=smoothstep(0.15,1.0,progress);
 vec2 drift=vec2(sin(p.y*9.0+progress),cos(p.x*8.0-progress));
 cell+=drift*0.6*(1.0-sharpen);
 float sigma=mix(1.5,0.32,sharpen),ink=0.0,total=0.0;
 for(int y=-3;y<=3;y++)for(int x=-3;x<=3;x++){
  vec2 at=floor(cell)+vec2(x,y),d=cell-at-0.5;
  float weight=exp(-dot(d,d)/(2.0*sigma*sigma));
  total+=weight;
  if(all(greaterThanEqual(at,vec2(0)))&&all(lessThan(at,n)))
   ink+=texelFetch(qr,ivec2(at),0).r*weight;
 }
 ink/=total;
 float exact=all(greaterThanEqual(cell,vec2(0)))&&all(lessThan(cell,n))?texelFetch(qr,ivec2(cell),0).r:0.0;
 ink=mix(ink,exact,smoothstep(0.80,1.0,progress));
 // The larger code emerges in an organic circular body, without a square frame.
 float noise=texture(noiseField,uv).r;
 float outside=portrait?smoothstep(0.47,0.50,length(uv-0.5)/backgroundExtent+noise*0.01):smoothstep(0.37,0.42,length(uv-0.5)+noise*0.018);
 float contrast=mix(1.0,1.8,smoothstep(0.25,0.95,progress));
 float goal=mix(0.5+(ink-0.5)*contrast,portrait?-0.4:1.4,outside);
 fragColor=vec4(goal,0,0,1);
}`,
  qrChemical: `uniform sampler2D phase;uniform sampler2D guide;uniform float progress;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 float c=texture(phase,uv).r;
 vec2 h=vec2(1.0/float(textureSize(phase,0).x),0);
 float lap=0.0;
 for(int axis=0;axis<4;axis++){
  vec2 d=axis==0?h:axis==1?-h:axis==2?h.yx:-h.yx;
  if(inside(uv+d))lap+=texture(phase,uv+d).r-c;
 }
 float attraction=mix(0.10,2.6,smoothstep(0.0,0.90,progress));
 float separation=2.2*smoothstep(0.25,0.95,progress);
 float chemical=separation*c*(1.0-c)*(1.0-2.0*c)-0.6*lap;
 chemical+=attraction*(c-texture(guide,uv).r);
 fragColor=vec4(c,chemical,0,1);
}`,
  qrGather: `uniform sampler2D chemical;uniform float dt;
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 ivec2 cell=ivec2(gl_FragCoord.xy),size=textureSize(chemical,0);
 vec4 state=texelFetch(chemical,cell,0);float change=0.0;
 for(int shell=0;shell<3;shell++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(x==0&&y==0)continue;
  int reach=shell==0?1:max(1,int(round((shell==1?4.0:12.0)*float(size.x)/512.0)));
  ivec2 at=cell+ivec2(x,y)*reach;
  if(!inside((vec2(at)+0.5)/vec2(size)))continue;
  vec4 other=texelFetch(chemical,at,0);
  float weight=(x==0||y==0?1.0:0.5)*(shell==0?1.0:0.65);
  float transfer=dt*2.0*weight*(other.g-state.g);
  transfer=clamp(transfer,-min(state.r,1.0-other.r)/24.0,min(other.r,1.0-state.r)/24.0);
  change+=transfer;
 }
 fragColor=vec4(state.r+change,0,0,1);
}`,
  patternRestore: `uniform sampler2D source;uniform sampler2D original;uniform float blend;
void main(){fragColor=mix(texture(source,uv),texture(original,uv),blend);}`,
};
