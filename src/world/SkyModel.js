import * as T from 'three';
import { seededRandom } from './materials.js';

// One atmosphere, evaluated on the CPU and handed to the GPU as a small lookup table. With a single
// light the clear sky is symmetric about the light's bearing, so it depends on only two things: how
// far round from the light you are looking, and how high. A 48×24 table indexed by those two holds it
// exactly, and the sky dome, the sea's horizon haze and the reflection all read the same table —
// which is what makes them meet without a seam. Running the scattering integral per pixel instead
// cost several times the old frame on integrated graphics.
//
// Units are metres on an Earth-sized planet. The observer sits a couple of metres above the sea.
export const PLANET=6360e3,ATMOSPHERE=6420e3,RAYLEIGH_HEIGHT=8000,MIE_HEIGHT=1200,EYE_HEIGHT=2;
export const RAYLEIGH=[5.802e-6,13.558e-6,33.1e-6],MIE=9e-6,MIE_G=.8;
// The forward Mie halo is physically bright enough to swamp a low-sun frame; this keeps its shape
// and pulls its strength back to what reads as glare rather than as a blown-out screen.
export const MIE_SCALE=.38;
// White balance against the noon sun overhead, so midday light is white and the sky a deeper blue,
// while low sun still comes out gold and red relative to it.
const zenithDepth=i=>RAYLEIGH[i]*RAYLEIGH_HEIGHT+MIE*1.1*MIE_HEIGHT;
export const WHITE=[0,1,2].map(i=>Math.exp(zenithDepth(i))/Math.exp(zenithDepth(1)));
export const SUN_POWER=12;
// Cumulus sit on a shell 1.8 km up, cirrus on one at 8.5 km. Intersecting a curved shell rather than
// a flat plane is what lets the cloud layer run all the way down to a true horizon: a plane divides
// by the view elevation and has to be clamped near the horizon, which smears the clouds vertically
// into a painted wall around the viewer.
export const CLOUD_HEIGHT=1800,CLOUD_SCALE=1150,CIRRUS_HEIGHT=8500,CIRRUS_SCALE=7000;
// Columns are indexed by sin(angle/2) from the light and rows by sqrt(sin elevation), which spends
// the resolution where the sky changes fastest: around the light and along the horizon.
export const LUT_WIDTH=48,LUT_HEIGHT=24;
const ROWS_PER_FRAME=3;

const f=v=>Number(v).toExponential(6);
// Declarations every shader that includes the library needs, used or not.
export const skyUniformsGLSL=`uniform sampler2D uNoise;uniform sampler2D uSunLUT;uniform sampler2D uMoonLUT;uniform vec3 uSun;uniform vec3 uMoon;
uniform float uSunPower;uniform float uMoonPower;uniform vec3 uNightHorizon;uniform vec3 uNightZenith;uniform float uVeil;uniform vec3 uVeilColor;
uniform float uCloudDrift;uniform vec2 uWindDir;`;
export const skyGLSL=`
const float PLANET=${f(PLANET)};const float EYE_HEIGHT=${f(EYE_HEIGHT)};
const float CLOUD_HEIGHT=${f(CLOUD_HEIGHT)};const float CLOUD_SCALE=${f(CLOUD_SCALE)};
const float CIRRUS_HEIGHT=${f(CIRRUS_HEIGHT)};const float CIRRUS_SCALE=${f(CIRRUS_SCALE)};
const vec2 LUT_SIZE=vec2(${LUT_WIDTH}.,${LUT_HEIGHT}.);

float henyeyGreenstein(float mu,float g){float g2=g*g;return .0795775*(1.-g2)/pow(1.+g2-2.*g*mu,1.5);}
// Every lookup names its LOD explicitly. A derivative-based lookup inside a branch cannot be skipped
// by the Direct3D back end most Windows browsers use, so it gets evaluated for every pixel whether
// the branch is taken or not; with textureLod the branches really do skip their work.
vec3 lutSample(sampler2D lut,vec3 d,vec3 light){
  vec2 lightFlat=normalize(light.xz+vec2(1e-5,0.)),viewFlat=normalize(d.xz+vec2(1e-5,0.));
  float u=sqrt(clamp(.5-.5*dot(viewFlat,lightFlat),0.,1.)),v=sqrt(clamp(d.y,0.,1.));
  return textureLod(lut,(vec2(u,v)*(LUT_SIZE-1.)+.5)/LUT_SIZE,0.).rgb;
}
// The clear sky for a direction: the night floor, sun and moon scattering, under the weather's veil.
// SkyModel.sky() performs the same composition on the CPU.
vec3 clearSky(vec3 d){
  vec3 color=mix(uNightHorizon,uNightZenith,sqrt(max(d.y,0.)))+lutSample(uSunLUT,d,uSun)*uSunPower;
  if(uMoonPower>0.)color+=lutSample(uMoonLUT,d,uMoon)*uMoonPower;
  return mix(color,uVeilColor,uVeil);
}
// The sky exactly at the horizon on a bearing. The sea fades into this, and it is the same row of the
// same table the dome draws at elevation zero, so there is nothing to see where they meet.
vec3 horizonRing(vec3 d){return clearSky(vec3(d.x,0.,d.z));}

// Value noise from a tiling random texture: one bilinear fetch, with the smoothstep applied to the
// lookup coordinate so the interpolation is still C1.
float vnoise(vec2 p){vec2 i=floor(p),q=fract(p);q=q*q*(3.-2.*q);return textureLod(uNoise,(i+q+.5)/256.,0.).r;}
const mat2 OCTAVE=mat2(.8,.6,-.6,.8);
// Five octaves; the top two blend towards their mean as detail falls, so distant cloud does not alias.
float fbm(vec2 p,float detail){
  float s=vnoise(p)*.5;p=OCTAVE*p*2.02+17.1;
  s+=vnoise(p)*.25;p=OCTAVE*p*2.03-9.3;
  s+=vnoise(p)*.125;p=OCTAVE*p*2.01+4.7;
  s+=mix(.5,vnoise(p),detail)*.0625;p=OCTAVE*p*2.04-2.1;
  s+=mix(.5,vnoise(p),detail)*.03125;
  return s/.96875;
}
// The first three octaves of the same field, with the rest at their mean — for lookups that only
// need the broad shape: the self-shadow probe, cloud shadows on the sea, and the star occlusion.
float fbmBroad(vec2 p){
  float s=vnoise(p)*.5;p=OCTAVE*p*2.02+17.1;
  s+=vnoise(p)*.25;p=OCTAVE*p*2.03-9.3;
  s+=vnoise(p)*.125;
  return (s+.046875)/.96875;
}
// Distance along a view ray from the observer to a shell some height above the sea. Written as
// c/(b+sqrt(b*b+c)) because the textbook form cancels catastrophically in single precision.
float shell(vec3 d,float height){float origin=PLANET+EYE_HEIGHT,b=origin*d.y,c=(height-EYE_HEIGHT)*(2.*PLANET+height+EYE_HEIGHT);return c/(b+sqrt(b*b+c));}
// The cloud field is warped by a low-frequency copy of itself so edges billow instead of blobbing.
vec2 cloudWarp(vec2 uv){return (vec2(vnoise(uv*.45+uCloudDrift*.35),vnoise(uv*.45+vec2(5.2,1.3)-uCloudDrift*.25))-.5)*.85;}
float cloudField(vec2 uv,float detail){return fbm(uv+cloudWarp(uv),detail);}
float cloudFieldBroad(vec2 uv){return fbmBroad(uv+cloudWarp(uv));}
float cloudAlpha(float field,float cutoff){return smoothstep(cutoff,cutoff+.15,field);}
vec2 cloudUV(vec2 world){return world/CLOUD_SCALE+uWindDir*uCloudDrift;}`;

export function chapman(X,h,c){
  const s=Math.sqrt(X+h);
  if(c>=0)return s/(s*c+1)*Math.exp(-h);
  const x0=Math.sqrt(Math.max(0,1-c*c))*(X+h);
  return 2*Math.sqrt(x0)*Math.exp(Math.min(X-x0,40))-s/(1-s*c)*Math.exp(-h);
}

// A lookup table for one light, refreshed a few rows per frame while that light is moving.
class ScatterTable {
  constructor(){
    this.half=new Uint16Array(LUT_WIDTH*LUT_HEIGHT*4);this.values=new Float32Array(LUT_WIDTH*LUT_HEIGHT*3);
    for(let i=3;i<this.half.length;i+=4)this.half[i]=T.DataUtils.toHalfFloat(1);
    this.texture=new T.DataTexture(this.half,LUT_WIDTH,LUT_HEIGHT,T.RGBAFormat,T.HalfFloatType);
    this.texture.magFilter=this.texture.minFilter=T.LinearFilter;this.texture.wrapS=this.texture.wrapT=T.ClampToEdgeWrapping;
    this.texture.generateMipmaps=false;this.texture.needsUpdate=true;
    this.light=new T.Vector3(0,-2,0);this.haze=-1;this.cursor=0;this.stale=true;this.passClean=true;this.ready=false;
  }
}

export class SkyModel {
  constructor(){
    // Tiling random texture behind vnoise(). Linear filtering, no mipmaps: the shader smooths it.
    const random=seededRandom(51277),data=new Uint8Array(256*256*4);
    for(let i=0;i<data.length;i++)data[i]=Math.floor(random()*256);
    this.noise=new T.DataTexture(data,256,256,T.RGBAFormat);
    this.noise.wrapS=this.noise.wrapT=T.RepeatWrapping;this.noise.magFilter=this.noise.minFilter=T.LinearFilter;
    this.noise.generateMipmaps=false;this.noise.needsUpdate=true;
    this.sunTable=new ScatterTable();this.moonTable=new ScatterTable();
    this.average=new T.Color();
    this._sum=new T.Color();this._term=new T.Color();this._dir=new T.Vector3();
  }
  // Colour of sunlight after crossing the atmosphere down to a given height, white-balanced so the
  // noon sun overhead is 1. Clouds sample it at their own altitude, which is why they stay lit for a
  // few minutes after the sun has set at sea level.
  transmittance(light,out,height=EYE_HEIGHT){
    // Below the geometric horizon for this altitude the ray passes through the planet.
    if(light.y<-Math.sqrt(2*height/PLANET)-.004)return out.setRGB(0,0,0);
    const odR=RAYLEIGH_HEIGHT*chapman(PLANET/RAYLEIGH_HEIGHT,height/RAYLEIGH_HEIGHT,light.y);
    const odM=MIE_HEIGHT*chapman(PLANET/MIE_HEIGHT,height/MIE_HEIGHT,light.y);
    return out.setRGB(Math.min(1,Math.exp(-(RAYLEIGH[0]*odR+MIE*1.1*odM))*WHITE[0]),Math.min(1,Math.exp(-(RAYLEIGH[1]*odR+MIE*1.1*odM))*WHITE[1]),Math.min(1,Math.exp(-(RAYLEIGH[2]*odR+MIE*1.1*odM))*WHITE[2]));
  }
  // Single scattering along the view ray. The view path is marched; the light path uses Schüler's
  // closed-form Chapman approximation, so each sample costs a few exponentials, not a nested march.
  scatter(dir,light,power,haze,out,samples=12){
    let dx=dir.x,dy=Math.max(dir.y,0),dz=dir.z;const length=Math.hypot(dx,dy,dz)||1;dx/=length;dy/=length;dz/=length;
    const origin=PLANET+EYE_HEIGHT,b=origin*dy,c=(origin-ATMOSPHERE)*(origin+ATMOSPHERE),tMax=-b+Math.sqrt(b*b-c);
    const mu=dx*light.x+dy*light.y+dz*light.z,g2=MIE_G*MIE_G;
    const phaseR=.0596831*(1+mu*mu),phaseM=.1193662*(1-g2)*(1+mu*mu)/((2+g2)*Math.pow(1+g2-2*MIE_G*mu,1.5))*MIE_SCALE;
    const betaM=MIE*(1+haze*6);
    let depthR=0,depthM=0,previous=0,r0=0,r1=0,r2=0,m0=0,m1=0,m2=0;
    for(let i=0;i<samples;i++){
      // Quadratic spacing puts the samples where the air is dense, near the start of the ray.
      const k=(i+1)/samples,t=tMax*k*k,ds=t-previous,tm=previous+ds*.5;previous=t;
      const px=dx*tm,py=origin+dy*tm,pz=dz*tm,r=Math.hypot(px,py,pz),h=Math.max(r-PLANET,0);
      const dR=Math.exp(-h/RAYLEIGH_HEIGHT)*ds,dM=Math.exp(-h/MIE_HEIGHT)*ds;depthR+=dR;depthM+=dM;
      const cz=(px*light.x+py*light.y+pz*light.z)/r;
      const lightR=RAYLEIGH_HEIGHT*chapman(PLANET/RAYLEIGH_HEIGHT,h/RAYLEIGH_HEIGHT,cz);
      const lightM=MIE_HEIGHT*chapman(PLANET/MIE_HEIGHT,h/MIE_HEIGHT,cz);
      const mie=betaM*1.1*(depthM+lightM);
      const a0=Math.exp(-(RAYLEIGH[0]*(depthR+lightR)+mie)),a1=Math.exp(-(RAYLEIGH[1]*(depthR+lightR)+mie)),a2=Math.exp(-(RAYLEIGH[2]*(depthR+lightR)+mie));
      r0+=dR*a0;r1+=dR*a1;r2+=dR*a2;m0+=dM*a0;m1+=dM*a1;m2+=dM*a2;
    }
    return out.setRGB(power*(r0*RAYLEIGH[0]*phaseR+m0*betaM*phaseM)*WHITE[0],power*(r1*RAYLEIGH[1]*phaseR+m1*betaM*phaseM)*WHITE[1],power*(r2*RAYLEIGH[2]*phaseR+m2*betaM*phaseM)*WHITE[2]);
  }
  // Clear sky for a direction, lit by sun and moon, over the night floor, under the weather veil.
  // This is the composition clearSky() performs in the shader.
  sky(dir,state,out){
    const {sun,moon,sunPower,moonPower,haze,veil,veilColor,nightHorizon,nightZenith}=state;
    // Accumulate in a private scratch: callers pass their own scratch colours in as `out`, and
    // sharing one between the sun and moon terms let the moon overwrite the sun whenever it was up.
    const sum=this._sum.copy(nightHorizon).lerp(nightZenith,Math.pow(Math.max(dir.y,0),.5));
    if(sun.y>-.35)sum.add(this.scatter(dir,sun,sunPower,haze,this._term));
    if(moonPower>0&&moon.y>-.2)sum.add(this.scatter(dir,moon,moonPower,haze,this._term));
    return out.copy(sum).lerp(veilColor,veil);
  }
  refreshRow(table,light,haze,row){
    const flat=Math.hypot(light.x,light.z)>1e-5?Math.atan2(light.z,light.x):0,v=row/(LUT_HEIGHT-1),y=v*v,h=Math.sqrt(Math.max(0,1-y*y));
    for(let column=0;column<LUT_WIDTH;column++){
      const turn=2*Math.asin(column/(LUT_WIDTH-1)),azimuth=flat+turn;
      this.scatter(this._dir.set(Math.cos(azimuth)*h,y,Math.sin(azimuth)*h),light,1,haze,this._term,10);
      const i=row*LUT_WIDTH+column;
      table.values[i*3]=this._term.r;table.values[i*3+1]=this._term.g;table.values[i*3+2]=this._term.b;
      table.half[i*4]=T.DataUtils.toHalfFloat(Math.min(this._term.r,6e4));
      table.half[i*4+1]=T.DataUtils.toHalfFloat(Math.min(this._term.g,6e4));
      table.half[i*4+2]=T.DataUtils.toHalfFloat(Math.min(this._term.b,6e4));
    }
    table.texture.needsUpdate=true;
  }
  // While a light is moving the table is rebuilt a few rows per frame, so a slowly turning clock
  // costs a fraction of a millisecond and a still one costs nothing. A jump — the first frame, or the
  // clock dragged in the menu — rebuilds the whole table at once so there is never a half-updated sky.
  stepTable(table,light,haze){
    const jump=!table.ready||Math.abs(table.light.y-light.y)>.03||Math.abs(table.haze-haze)>.08;
    const moved=Math.abs(table.light.y-light.y)>.0012||Math.abs(table.haze-haze)>.003;
    if(moved){table.light.copy(light);table.haze=haze;table.stale=true;table.passClean=false;}
    if(jump){for(let row=0;row<LUT_HEIGHT;row++)this.refreshRow(table,light,haze,row);table.ready=true;table.stale=false;table.cursor=0;return;}
    if(!table.stale)return;
    for(let k=0;k<ROWS_PER_FRAME;k++){
      this.refreshRow(table,light,haze,table.cursor);
      table.cursor=(table.cursor+1)%LUT_HEIGHT;
      if(table.cursor===0){if(table.passClean)table.stale=false;table.passClean=true;}
    }
  }
  // Refresh both tables and return the average horizon colour for this frame's fog and lighting.
  update(state){
    const {sun,moon,sunPower,moonPower,haze,veil,veilColor,nightHorizon}=state;
    if(sun.y>-.4)this.stepTable(this.sunTable,sun,haze);
    const useMoon=moonPower>0&&moon.y>-.25;
    if(useMoon)this.stepTable(this.moonTable,moon,haze);
    const sunRow=this.sunTable.values,moonRow=this.moonTable.values;
    let r=0,g=0,b=0;
    // Row zero is the horizon. Columns are spaced by sin(angle/2), so weight each by the angle it spans.
    for(let column=0;column<LUT_WIDTH;column++){
      const a0=2*Math.asin(Math.max(0,column-.5)/(LUT_WIDTH-1)),a1=2*Math.asin(Math.min(LUT_WIDTH-1,column+.5)/(LUT_WIDTH-1)),w=(a1-a0)/Math.PI;
      r+=w*(sunRow[column*3]*sunPower+(useMoon?moonRow[column*3]*moonPower:0));
      g+=w*(sunRow[column*3+1]*sunPower+(useMoon?moonRow[column*3+1]*moonPower:0));
      b+=w*(sunRow[column*3+2]*sunPower+(useMoon?moonRow[column*3+2]*moonPower:0));
    }
    return this.average.setRGB(r,g,b).add(nightHorizon).lerp(veilColor,veil);
  }
  dispose(){this.noise.dispose();this.sunTable.texture.dispose();this.moonTable.texture.dispose();}
}
