import * as T from 'three';
import { time, waterHeight, waveStrength } from './materials.js';

const waves=`float wave(vec2 p){return uWaves*(sin(p.x*.075+uTime*.65)*.28+sin(p.y*.11+uTime*.85)*.16+sin((p.x+p.y)*.04-uTime*.4)*.18);}`;
export class OceanSurface {
  constructor(scene){
    this.uniforms={uNight:{value:0},uUnderColor:{value:new T.Color('#238d99')},uSun:{value:new T.Vector3(.38,.58,-.52).normalize()},uHorizon:{value:new T.Color('#b8d4d6')},uZenith:{value:new T.Color('#296bad')},uLight:{value:1},uCloud:{value:.52}};

    const waterGeometry=new T.PlaneGeometry(2,2,160,160);waterGeometry.rotateX(-Math.PI/2);
    const pos=waterGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setXYZ(i,Math.sign(x)*Math.pow(Math.abs(x),2.7)*3600,0,Math.sign(z)*Math.pow(Math.abs(z),2.7)*3600);}
    this.water=new T.Mesh(waterGeometry,new T.ShaderMaterial({side:T.DoubleSide,uniforms:{uTime:time,uWaves:waveStrength,...this.uniforms},vertexShader:`uniform float uTime;uniform float uWaves;uniform vec3 uSun;uniform vec3 uUnderColor;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;varying vec3 vWorld;${waves}void main(){vec4 p=modelMatrix*vec4(position,1.);p.y=27.+wave(p.xz);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`uniform float uTime;uniform float uWaves;uniform vec3 uSun;uniform vec3 uUnderColor;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;varying vec3 vWorld;${waves}
      float hashWater(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noiseWater(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashWater(i),hashWater(i+vec2(1,0)),f.x),mix(hashWater(i+vec2(0,1)),hashWater(i+vec2(1)),f.x),f.y);}
      float ripples(vec2 p){mat2 r=mat2(.8,-.6,.6,.8);return noiseWater(p)*.55+noiseWater(r*p*2.13+7.3)*.3+noiseWater(r*p*4.27-4.8)*.15;}
      void main(){vec2 p=vWorld.xz;
      // Derive all normals from a continuous, world-space height field. No repeating line mask.
      float epsilon=.16;float dx=(wave(p+vec2(epsilon,0))-wave(p-vec2(epsilon,0)))/(2.*epsilon);
      float dz=(wave(p+vec2(0,epsilon))-wave(p-vec2(0,epsilon)))/(2.*epsilon);
      vec2 q=p*.75+vec2(uTime*.13,-uTime*.09);float detail=1.-smoothstep(25.,180.,length(vWorld-cameraPosition));
      dx+=(ripples(q+vec2(.12,0))-ripples(q-vec2(.12,0)))*.25*detail;
      dz+=(ripples(q+vec2(0,.12))-ripples(q-vec2(0,.12)))*.25*detail;
      vec3 n=normalize(vec3(-dx,1.,-dz)),view=normalize(cameraPosition-vWorld),sun=normalize(uSun);
      float fresnel=.02+.98*pow(1.-clamp(dot(n,view),0.,1.),5.);
      vec3 reflected=reflect(-view,n);vec3 sky=mix(uHorizon,uZenith,pow(max(reflected.y,0.),.45));
      float spec=pow(max(dot(reflect(-sun,n),view),0.),220.);
      vec3 color=mix(vec3(.012,.16,.19)*(.2+uLight*.8),sky,fresnel)+mix(vec3(1.,.88,.67),vec3(.6,.77,1.),uNight)*spec*(uLight*1.5+uNight*.6);
      if(!gl_FrontFacing){
        float window=1.-smoothstep(.68,.78,abs(dot(n,view)));float texture= .94+.06*ripples(q*.4);
        color=mix(uHorizon*(.38+uLight*.5),vec3(.018,.14,.17)*(.25+uLight*.75),window)*texture;
        color+=vec3(.65,.84,.8)*pow(max(dot(normalize(vWorld-cameraPosition),sun),0.),110.)*uLight*.35;
      }
      float glow=pow(smoothstep(.55,.85,ripples(q*1.8)),5.)*detail*uNight;
      color+=vec3(.015,.3,.42)*glow*(.65+.35*sin(uTime*.8+p.x*.3));
      float haze=1.-exp(-length(vWorld.xz-cameraPosition.xz)*.00045);color=mix(color,gl_FrontFacing?uHorizon:uUnderColor,haze);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));this.water.frustumCulled=false;scene.add(this.water);
    this.sky=new T.Mesh(new T.SphereGeometry(4200,32,18),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:time,uWaves:waveStrength,...this.uniforms},vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float uTime;uniform float uWaves;uniform vec3 uSun;uniform vec3 uUnderColor;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;varying vec3 vDirection;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
      float starLayer(vec2 uv,float scale){vec2 p=uv*scale,id=floor(p),f=fract(p);float seed=hash(id);vec2 center=vec2(hash(id+3.7),hash(id+19.3))*.7+.15;float radius=.025+seed*.045;float aa=max(fwidth(p.x),fwidth(p.y));return (1.-smoothstep(radius,radius+aa,length(f-center)))*step(.978,seed)*(.65+.35*sin(uTime*(.4+seed)+seed*90.));}
      void main(){vec3 d=normalize(vDirection);vec3 color=mix(uHorizon,uZenith,pow(max(d.y,0.),.45));vec3 sun=normalize(uSun);float s=max(dot(d,sun),0.);
      color+=vec3(1.,.84,.57)*(pow(s,800.)*2.2+pow(s,12.)*.23)*uLight*(1.-uNight);
      vec2 celestial=vec2(atan(d.z,d.x)/6.283185+.5,asin(clamp(d.y,-1.,1.))/3.14159+.5);
      float band=exp(-pow(dot(d,normalize(vec3(.45,.8,.36)))*7.,2.));float dust=noise(celestial*vec2(180.,100.))*.6+noise(celestial*400.)*.4;
      color+=vec3(.07,.08,.17)*band*dust*uNight*smoothstep(0.,.25,d.y);
      float stars=starLayer(celestial,340.)+starLayer(celestial+vec2(.19,.36),570.)*.45;
      color+=mix(vec3(.58,.72,1.),vec3(1.,.88,.69),noise(celestial*90.))*stars*uNight*smoothstep(.02,.16,d.y)*2.;
      float moonAngle=acos(clamp(dot(d,sun),-1.,1.));float moon=1.-smoothstep(.020,.022,moonAngle);float craters=.76+.24*noise(d.xz*800.);
      color+=vec3(.65,.77,1.)*(moon*craters*2.2+exp(-moonAngle*24.)*.16)*uNight;
      vec2 uv=d.xz/max(.06,d.y)*1.6+vec2(uTime*.003,0);float clouds=noise(uv)*.6+noise(uv*2.1)*.25+noise(uv*4.3)*.15;
      float c=smoothstep(uCloud,uCloud+.21,clouds)*smoothstep(.04,.2,d.y);
      color=mix(color,mix(vec3(.97,.96,.89)*max(.06,uLight),vec3(.025,.039,.065),uNight),c*.94);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));this.sky.frustumCulled=false;this.sky.renderOrder=-10;scene.add(this.sky);
  }
  update(camera,underwater){this.water.position.set(camera.position.x,27,camera.position.z);this.sky.position.copy(camera.position);this.sky.visible=underwater<.98;}
  height(x,z,t){return waterHeight(x,z,t);}
}
