// A slow, seeded stream function, differentiated analytically. Multiplying
// the potential (not velocity) by the wall envelope preserves curl structure.
// This art-directed current transports material; it does not drive wave height.
export const AMBIENT_FLOW = `uniform sampler2D velocity;
uniform float time;uniform float seed;uniform float stirring;
float random(float i){return fract(sin(i*127.1+seed*31.7)*43758.5453);}
void main(){
 if(!inside(uv)){fragColor=vec4(0);return;}
 vec2 d=uv-0.5,gradient=vec2(0);float potential=0.0;
 for(int i=0;i<9;i++){
  float id=float(i)*9.0;
  float angle=random(id+1.0)*6.2831853,radius=sqrt(random(id+2.0))*boundaryRadius*0.79;
  float phase=random(id+3.0)*6.2831853;
  vec2 center=radius*vec2(cos(angle),sin(angle));
  center+=0.045*vec2(sin(time*0.043+phase),cos(time*0.037+phase*1.7));
  float width=mix(0.045,0.19,pow(random(id+4.0),1.4));
  width*=1.0+0.16*sin(time*0.031+phase);
  float speed=mix(0.006,0.013,random(id+5.0));
  float amplitude=width*speed*(random(id+6.0)<0.5?-1.0:1.0);
  amplitude*=0.7+0.3*sin(time*0.057+phase*2.3);
  vec2 q=d-center;
  float psi=amplitude*exp(-dot(q,q)/(2.0*width*width));
  potential+=psi;gradient-=psi*q/(width*width);
 }
 float edge=max(0.0,1.0-dot(d,d)/(boundaryRadius*boundaryRadius));
 vec2 envelopeGradient=-4.0*edge*d/(boundaryRadius*boundaryRadius);
 gradient=gradient*edge*edge+potential*envelopeGradient;
 vec2 drift=vec2(gradient.y,-gradient.x);
 // Tray-driven circulation takes precedence. A quiet tray never activates
 // dissolution: its existing gesture gate remains zero, even with this drift.
 float quiet=1.0-smoothstep(0.15,1.0,abs(stirring));
 fragColor=vec4(texture(velocity,uv).xy+drift*quiet,0,1);
}`;
