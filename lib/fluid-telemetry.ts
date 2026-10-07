export type TelemetryContext = {
  stirring: number;
  recovery: number;
  drift: number;
  driftEnabled: boolean;
  organicEnabled: boolean;
  dissolvingEnabled: boolean;
  crestsMode: 'auto' | 'on' | 'off';
  effects: string[];
};

export type FluidTelemetry = TelemetryContext & {
  mixed: number;
  darkFraction: number;
  exposure: number;
  exposureMin: number;
  exposureMax: number;
  grouping: number;
  flowRms: number;
  flowMax: number;
  waveRms: number;
  crests: number;
};

// Read-only reductions. Unlike the solver's reductions, these also carry
// extrema. Values outside the circular domain never dilute the averages.
export const TELEMETRY_SOURCES = {
  telemetryPhase: `uniform sampler2D phase;uniform float coalescence;
void main(){
 ivec2 start=ivec2(gl_FragCoord.xy)*2;vec4 result=vec4(0,1,0,0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  ivec2 cell=start+ivec2(x,y);vec2 p=(vec2(cell)+0.5)/vec2(textureSize(phase,0));
  if(any(greaterThanEqual(cell,textureSize(phase,0)))||!inside(p))continue;
  float exposure=texelFetch(phase,cell,0).g;
  result.r+=exposure*0.25;result.g=min(result.g,exposure);result.b=max(result.b,exposure);
  result.a+=coalescence*(1.0-smoothstep(0.15,0.60,exposure))*0.25;
 }
 fragColor=result;
}`,
  telemetryFlow: `uniform sampler2D velocity;uniform sampler2D surface;
void main(){
 ivec2 start=ivec2(gl_FragCoord.xy)*2,size=textureSize(velocity,0);vec4 result=vec4(0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  ivec2 cell=start+ivec2(x,y);
  if(any(greaterThanEqual(cell,size))||!inside((vec2(cell)+0.5)/vec2(size)))continue;
  vec2 v=texelFetch(velocity,cell,0).xy;float speed=length(v),height=texelFetch(surface,cell,0).r;
  result+=vec4(speed*speed,0,height*height,1)*0.25;result.g=max(result.g,speed);
 }
 fragColor=result;
}`,
  telemetryReduce: `uniform sampler2D source;uniform bool phaseMode;
void main(){
 ivec2 start=ivec2(gl_FragCoord.xy)*2;vec4 result=vec4(0,phaseMode?1.0:0.0,0,0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  ivec2 cell=start+ivec2(x,y);
  if(any(greaterThanEqual(cell,textureSize(source,0))))continue;
  vec4 value=texelFetch(source,cell,0);
  result.ra+=value.ra*0.25;
  result.g=phaseMode?min(result.g,value.g):max(result.g,value.g);
  result.b=phaseMode?max(result.b,value.b):result.b+value.b*0.25;
 }
 fragColor=result;
}`,
};

export function decodeTelemetry(data: Float32Array, context: TelemetryContext): FluidTelemetry {
  const area = Math.max(data[2], 1e-8), flowArea = Math.max(data[11], 1e-8);
  const mean = data[0] / area;
  const variance = Math.max(0, data[3] / area - mean * mean);
  const unit = (value: number) => Math.max(0, Math.min(1, value));
  return {
    ...context,
    mixed: unit(1 - variance / Math.max(mean * (1 - mean), 1e-5)),
    darkFraction: unit(mean), exposure: unit(data[4] / area),
    exposureMin: unit(data[5]), exposureMax: unit(data[6]), grouping: unit(data[7] / area),
    flowRms: Math.sqrt(Math.max(0, data[8] / flowArea)), flowMax: data[9],
    waveRms: Math.sqrt(Math.max(0, data[10] / flowArea)),
    crests: context.crestsMode === 'on' ? 1 : context.crestsMode === 'auto' ? unit(data[12]) : 0,
  };
}
