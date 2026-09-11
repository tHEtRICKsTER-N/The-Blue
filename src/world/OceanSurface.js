import * as T from 'three';
import { time, waterHeight, waveStrength, seededRandom } from './materials.js';

const waves=`float wave(vec2 p){return uWaves*(sin(p.x*.075+uTime*.65)*.28+sin(p.y*.11+uTime*.85)*.16+sin((p.x+p.y)*.04-uTime*.4)*.18);}`;
// Shared value noise. Direction-space only — the old equirect atan() mapping is what seamed the sky.
const noiseLib=`
float hashSky(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseSky(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashSky(i),hashSky(i+vec2(1,0)),f.x),mix(hashSky(i+vec2(0,1)),hashSky(i+vec2(1)),f.x),f.y);}`;
// One cloud field, evaluated identically by the sky and by the stars so the two never disagree.
const cloudLib=`
vec2 cloudPlane(vec3 d,float t){return d.xz/max(.10,d.y)*1.35+vec2(t*.0042,t*.0017);}
float cloudCover(vec3 d,float t,float cutoff){
  vec2 uv=cloudPlane(d,t);
  float lod=clamp(1.-length(fwidth(uv))*1.5,0.,1.);
  float f=noiseSky(uv)*.58+noiseSky(uv*2.07+3.1)*.26*lod+noiseSky(uv*4.33-5.2)*.16*lod*lod;
  float w=fwidth(f)+.014;
  return clamp(smoothstep(cutoff-w,cutoff+.21+w,f),0.,1.)*smoothstep(.012,.135,d.y);
}`;

export class OceanSurface {
  constructor(scene){
    this.uniforms={
      uNight:{value:0},uUnderColor:{value:new T.Color('#238d99')},uSun:{value:new T.Vector3(.38,.58,-.52).normalize()},
      uMoon:{value:new T.Vector3(-.38,-.58,.52).normalize()},uHorizon:{value:new T.Color('#b8d4d6')},uZenith:{value:new T.Color('#296bad')},
      uLight:{value:1},uCloud:{value:.52},uHaze:{value:0},uFlash:{value:0},uRain:{value:0},
    };

    const waterGeometry=new T.PlaneGeometry(2,2,160,160);waterGeometry.rotateX(-Math.PI/2);
    const pos=waterGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setXYZ(i,Math.sign(x)*Math.pow(Math.abs(x),2.7)*3600,0,Math.sign(z)*Math.pow(Math.abs(z),2.7)*3600);}
    this.water=new T.Mesh(waterGeometry,new T.ShaderMaterial({side:T.DoubleSide,uniforms:{uTime:time,uWaves:waveStrength,...this.uniforms},vertexShader:`uniform float uTime;uniform float uWaves;varying vec3 vWorld;${waves}void main(){vec4 p=modelMatrix*vec4(position,1.);p.y=27.+wave(p.xz);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`uniform float uTime;uniform float uWaves;uniform vec3 uSun;uniform vec3 uMoon;uniform vec3 uUnderColor;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;uniform float uHaze;uniform float uFlash;uniform float uRain;varying vec3 vWorld;${waves}${noiseLib}
      float ripples(vec2 p){mat2 r=mat2(.8,-.6,.6,.8);return noiseSky(p)*.55+noiseSky(r*p*2.13+7.3)*.3+noiseSky(r*p*4.27-4.8)*.15;}
      void main(){vec2 p=vWorld.xz;
      // Every normal comes from one continuous world-space height field. No repeating line mask.
      float epsilon=.16;float dx=(wave(p+vec2(epsilon,0))-wave(p-vec2(epsilon,0)))/(2.*epsilon);
      float dz=(wave(p+vec2(0,epsilon))-wave(p-vec2(0,epsilon)))/(2.*epsilon);
      float viewDistance=length(vWorld-cameraPosition);
      vec2 q=p*.75+vec2(uTime*.13,-uTime*.09);float detail=1.-smoothstep(25.,180.,viewDistance);
      dx+=(ripples(q+vec2(.12,0))-ripples(q-vec2(.12,0)))*.25*detail;
      dz+=(ripples(q+vec2(0,.12))-ripples(q-vec2(0,.12)))*.25*detail;
      // Rain stipples the surface with fast, short-lived chop.
      if(uRain>.004){vec2 r=p*2.4+vec2(0.,uTime*.6);float amount=uRain*detail*.7;
        dx+=(ripples(r+vec2(.09,0))-ripples(r-vec2(.09,0)))*amount;
        dz+=(ripples(r+vec2(0,.09))-ripples(r-vec2(0,.09)))*amount;}
      vec3 n=normalize(vec3(-dx,1.,-dz)),view=normalize(cameraPosition-vWorld),sun=normalize(uSun),moon=normalize(uMoon);
      float fresnel=.02+.98*pow(1.-clamp(dot(n,view),0.,1.),5.);
      vec3 reflected=reflect(-view,n);vec3 sky=mix(uHorizon,uZenith,pow(max(reflected.y,0.),.45));
      sky=mix(sky,uHorizon,uHaze*.6);
      float sunUp=smoothstep(-.06,.09,sun.y),moonUp=smoothstep(-.04,.10,moon.y);
      float spec=pow(max(dot(reflect(-sun,n),view),0.),220.)*sunUp;
      float moonSpec=pow(max(dot(reflect(-moon,n),view),0.),260.)*moonUp;
      vec3 color=mix(vec3(.012,.16,.19)*(.2+uLight*.8),sky,fresnel)
        +vec3(1.,.88,.67)*spec*uLight*1.5
        +vec3(.62,.76,1.)*moonSpec*uNight*.85;
      if(!gl_FrontFacing){
        float window=1.-smoothstep(.68,.78,abs(dot(n,view)));float grain=.94+.06*ripples(q*.4);
        color=mix(uHorizon*(.38+uLight*.5),vec3(.018,.14,.17)*(.25+uLight*.75),window)*grain;
        color+=vec3(.65,.84,.8)*pow(max(dot(normalize(vWorld-cameraPosition),sun),0.),110.)*uLight*.35*sunUp;
      }
      float glow=pow(smoothstep(.55,.85,ripples(q*1.8)),5.)*detail*uNight;
      color+=vec3(.015,.3,.42)*glow*(.65+.35*sin(uTime*.8+p.x*.3));
      color+=vec3(.70,.78,1.)*uFlash*(.10+.35*fresnel);
      float haze=1.-exp(-length(vWorld.xz-cameraPosition.xz)*(.00045+uHaze*.0011));color=mix(color,gl_FrontFacing?uHorizon:uUnderColor,haze);
      color+=(hashSky(gl_FragCoord.xy*1.37)-.5)*.0035;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));this.water.frustumCulled=false;scene.add(this.water);

    this.sky=new T.Mesh(new T.SphereGeometry(4200,48,28),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:time,uWaves:waveStrength,...this.uniforms},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;uniform vec3 uSun;uniform vec3 uMoon;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;uniform float uHaze;uniform float uFlash;varying vec3 vDirection;${noiseLib}${cloudLib}
      void main(){vec3 d=normalize(vDirection);float up=max(d.y,0.);
      vec3 sun=normalize(uSun),moon=normalize(uMoon);
      float sunUp=smoothstep(-.10,.07,sun.y),moonUp=smoothstep(-.05,.10,moon.y);
      vec3 color=mix(uHorizon,uZenith,pow(up,.45));
      // Sun disc and halo, sized in radians so the edge antialiases against the pixel footprint.
      float sunAngle=acos(clamp(dot(d,sun),-1.,1.));float sunAA=fwidth(sunAngle)+.0006;
      float sunDisc=1.-smoothstep(.0082-sunAA,.0082+sunAA,sunAngle);
      color+=vec3(1.,.88,.66)*(sunDisc*2.6+exp(-sunAngle*7.)*.32+exp(-sunAngle*1.6)*.07)*uLight*sunUp;
      // Warm band hugging the horizon while the sun sits low.
      color+=vec3(1.,.48,.24)*exp(-sunAngle*2.2)*exp(-up*5.5)*.45*uLight*smoothstep(.34,.02,abs(sun.y));
      // Moon disc with surface detail in moon-local coordinates, plus a soft corona.
      float moonAngle=acos(clamp(dot(d,moon),-1.,1.));float moonAA=fwidth(moonAngle)+.0005;
      float moonDisc=1.-smoothstep(.0125-moonAA,.0125+moonAA,moonAngle);
      vec3 tangent=normalize(cross(moon,vec3(0.,1.,.0001))),bitangent=cross(moon,tangent);
      vec2 local=vec2(dot(d,tangent),dot(d,bitangent))/.0125;
      float maria=.74+.26*noiseSky(local*2.6+11.3)*noiseSky(local*5.1-3.7);
      color+=vec3(.72,.80,1.)*(moonDisc*maria*2.4+exp(-moonAngle*16.)*.20+exp(-moonAngle*3.)*.04)*uNight*moonUp;
      // Milky band, sampled straight from the direction vector so there is no wrap seam.
      float bandLod=clamp(1.-length(fwidth(d.xz*46.))*.6,0.,1.);
      float band=exp(-pow(dot(d,normalize(vec3(.45,.8,.36)))*7.,2.));
      float dust=noiseSky(d.xz*46.+d.y*21.)*.62+noiseSky(d.xz*104.+d.y*44.)*.38*bandLod;
      color+=vec3(.08,.09,.19)*band*dust*uNight*smoothstep(0.,.26,d.y);
      float cover=cloudCover(d,uTime,uCloud);
      vec3 cloudLit=mix(vec3(.97,.96,.89)*max(.06,uLight),vec3(.030,.044,.072),uNight);
      cloudLit+=vec3(1.,.62,.38)*exp(-sunAngle*2.6)*uLight*.45*smoothstep(.30,.02,abs(sun.y));
      color=mix(color,cloudLit,cover*.94);
      color+=vec3(.74,.82,1.)*uFlash*(.18+.62*cover);
      float haze=uHaze*exp(-up*3.1);color=mix(color,uHorizon*(.58+.42*uLight),haze*.8);
      color+=(hashSky(gl_FragCoord.xy*1.37+fract(uTime))-.5)*.004;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);

    const random=seededRandom(90210),starCount=2200;
    const starPositions=new Float32Array(starCount*3),starSizes=new Float32Array(starCount),starBrightness=new Float32Array(starCount),starPhase=new Float32Array(starCount),starHue=new Float32Array(starCount);
    for(let i=0;i<starCount;i++){
      const y=.02+random()*.98,a=random()*Math.PI*2,r=Math.sqrt(1-y*y)*3900;
      starPositions.set([Math.cos(a)*r,y*3900,Math.sin(a)*r],i*3);
      // Magnitude distribution: a few bright anchors, many faint ones.
      const magnitude=Math.pow(random(),2.6);
      starSizes[i]=1.05+magnitude*2.6;starBrightness[i]=.20+magnitude*.95;starPhase[i]=random();starHue[i]=random();
    }
    const starGeometry=new T.BufferGeometry();
    starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3));
    starGeometry.setAttribute('aSize',new T.BufferAttribute(starSizes,1));
    starGeometry.setAttribute('aBrightness',new T.BufferAttribute(starBrightness,1));
    starGeometry.setAttribute('aPhase',new T.BufferAttribute(starPhase,1));
    starGeometry.setAttribute('aHue',new T.BufferAttribute(starHue,1));
    // Soft radial falloff instead of a hard disc: sub-pixel points were the source of the shimmer.
    this.stars=new T.Points(starGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{uNight:this.uniforms.uNight,uCloud:this.uniforms.uCloud,uHaze:this.uniforms.uHaze,uTime:time,uPixelRatio:{value:1},uStarSize:{value:1}},
      vertexShader:`uniform float uPixelRatio;uniform float uStarSize;attribute float aSize;attribute float aBrightness;attribute float aPhase;attribute float aHue;
varying float vBrightness;varying vec3 vDirection;varying float vPhase;varying float vHue;
void main(){vDirection=normalize(position);vBrightness=aBrightness;vPhase=aPhase;vHue=aHue;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
gl_PointSize=max(2.4,aSize*uStarSize)*uPixelRatio;}`,
      fragmentShader:`uniform float uNight;uniform float uCloud;uniform float uHaze;uniform float uTime;
varying float vBrightness;varying vec3 vDirection;varying float vPhase;varying float vHue;${noiseLib}${cloudLib}
void main(){
  vec2 q=gl_PointCoord-.5;float d2=dot(q,q);
  if(d2>.25)discard;
  float shape=exp(-d2*30.)+exp(-d2*8.)*.22;
  float twinkle=.80+.20*sin(uTime*(.9+vPhase*2.1)+vPhase*37.);
  float cover=cloudCover(vDirection,uTime,uCloud);
  float visibility=uNight*(1.-cover)*(1.-uHaze*.75)*smoothstep(.012,.125,vDirection.y);
  float alpha=shape*visibility*vBrightness*twinkle;
  if(alpha<.0025)discard;
  vec3 tint=mix(vec3(.60,.74,1.),vec3(1.,.86,.68),vHue);
  gl_FragColor=vec4(tint,alpha);
}`}));
    this.stars.frustumCulled=false;this.stars.renderOrder=-9;scene.add(this.stars);
  }
  update(camera,underwater){this.water.position.set(camera.position.x,27,camera.position.z);this.sky.position.copy(camera.position);this.stars.position.copy(camera.position);this.sky.visible=underwater<.98;this.stars.visible=underwater<.98&&this.uniforms.uNight.value>.01;}
  height(x,z,t){return waterHeight(x,z,t);}
}
