import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { time, seededRandom } from '../world/materials.js';

export const antialiasingModes={off:0,fxaa:0,smaa:0,msaa2:2,msaa4:4,msaa8:8};

export class Atmosphere {
  constructor(renderer,scene,camera){
    this.scene=scene;this.camera=camera;this.renderer=renderer;this.rayMeshes=[];this.random=seededRandom(413);this.bubbles=[];this.bubbleTimer=0;this.bubbleIndex=0;this.samples=4;
    // An explicitly multisampled buffer. The default composer target has no MSAA at all, which is
    // what left every silhouette in the scene stair-stepped no matter how the image was scaled.
    const size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
    this.target=new T.WebGLRenderTarget(Math.max(1,Math.round(size.width*ratio)),Math.max(1,Math.round(size.height*ratio)),{type:T.HalfFloatType,samples:this.samples});
    this.target.texture.name='Atmosphere.rt';
    this.composer=new EffectComposer(renderer,this.target);this.composer.addPass(new RenderPass(scene,camera));
    this.bloom=new UnrealBloomPass(new T.Vector2(800,600),.30,.65,.85);this.composer.addPass(this.bloom);
    this.smaa=new SMAAPass();this.smaa.enabled=false;this.composer.addPass(this.smaa);
    this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:time,uDepth:{value:0},uUnderwater:{value:1},uTexel:{value:new T.Vector2(1/800,1/600)},uSharpness:{value:.35},uDistortion:{value:.3},uVignette:{value:1},uGrain:{value:0},uAberration:{value:0},uFlash:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uDepth;uniform float uUnderwater;uniform vec2 uTexel;uniform float uSharpness;uniform float uDistortion;uniform float uVignette;uniform float uGrain;uniform float uAberration;uniform float uFlash;varying vec2 vUv;
      void main(){
        // The sample point is vUv exactly unless refraction is switched on. Offsetting every frame
        // by a fraction of a texel used to resample — and soften — the whole image for free.
        vec2 suv=vUv;
        if(uDistortion>.001){
          suv.x+=sin(vUv.y*16.+uTime*.35)*.00042*uUnderwater*uDistortion;
          suv.y+=cos(vUv.x*13.-uTime*.29)*.00030*uUnderwater*uDistortion;
        }
        vec3 col;
        if(uAberration>.001){
          vec2 radial=vUv-.5;float amount=uAberration*.006*dot(radial,radial);
          col.r=texture2D(tDiffuse,suv+radial*amount).r;
          col.g=texture2D(tDiffuse,suv).g;
          col.b=texture2D(tDiffuse,suv-radial*amount).b;
        } else col=texture2D(tDiffuse,suv).rgb;
        if(uSharpness>.001){
          // Contrast-adaptive sharpening: full strength on edges, nothing on flat water.
          vec3 n=texture2D(tDiffuse,suv+vec2(0.,uTexel.y)).rgb;
          vec3 s=texture2D(tDiffuse,suv-vec2(0.,uTexel.y)).rgb;
          vec3 e=texture2D(tDiffuse,suv+vec2(uTexel.x,0.)).rgb;
          vec3 w=texture2D(tDiffuse,suv-vec2(uTexel.x,0.)).rgb;
          vec3 lo=min(min(min(n,s),min(e,w)),col),hi=max(max(max(n,s),max(e,w)),col);
          vec3 amp=sqrt(clamp(min(lo,1.-hi)/max(hi,vec3(1e-4)),0.,1.))*uSharpness;
          col=clamp(col*(1.+4.*amp)-(n+s+e+w)*amp,lo-.06,hi+.06);
        }
        col*=1.-smoothstep(.23,.80,distance(vUv,vec2(.5)))*.24*uVignette*(.3+.7*uUnderwater);
        col=mix(col,col*vec3(.60,.84,1.06),uDepth*.32);
        col+=vec3(.72,.80,1.)*uFlash*.10;
        if(uGrain>.001){float g=fract(sin(dot(gl_FragCoord.xy+fract(uTime)*311.,vec2(12.9898,78.233)))*43758.5453)-.5;col+=g*uGrain*.05;}
        gl_FragColor=vec4(col,1.);
      }`});
    this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());
    this.fxaa=new FXAAPass();this.fxaa.enabled=false;this.composer.addPass(this.fxaa);
    this.particles();this.rays();this.makeBubbles();
    this.flashlight=new T.SpotLight('#c8e4ce',0,46,.28,.76,1.4);this.flashlight.position.set(.22,-.2,-.3);this.flashlight.target.position.set(0,0,-20);camera.add(this.flashlight,this.flashlight.target);
    const cone=new T.ConeGeometry(5,28,24,1,true);cone.rotateX(Math.PI/2);cone.translate(0,0,-14);
    this.beam=new T.Mesh(cone,new T.MeshBasicMaterial({color:'#accdc5',transparent:true,opacity:.025,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));this.beam.visible=false;camera.add(this.beam);
  }
  setDiverAnchor(anchor){this.diverAnchor=anchor;anchor.add(this.flashlight,this.flashlight.target,this.beam);}
  particles(){
    const count=2800,positions=new Float32Array(count*3),sizes=new Float32Array(count);
    for(let i=0;i<count;i++){positions[i*3]=(this.random()-.5)*170;positions[i*3+1]=(this.random()-.5)*75;positions[i*3+2]=(this.random()-.5)*170;sizes[i]=.6+this.random()*1.7;}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setAttribute('aSize',new T.BufferAttribute(sizes,1));
    this.plankton=new T.Points(g,new T.ShaderMaterial({uniforms:{uNight:{value:0},uTime:time,uCamera:{value:this.camera.position},uFlash:{value:0},uPixelRatio:{value:this.renderer.getPixelRatio()}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`uniform float uNight;uniform float uTime;uniform vec3 uCamera;uniform float uFlash;uniform float uPixelRatio;attribute float aSize;varying float vAlpha;varying float vY;void main(){vec3 p=position;p.x+=sin(uTime*.1+position.z*.12)*2.;p.y+=uTime*.035;p=mod(p-uCamera+vec3(85.,37.5,85.),vec3(170.,75.,170.))-vec3(85.,37.5,85.)+uCamera;vY=p.y;vec4 mv=modelViewMatrix*vec4(p,1.);float d=length(mv.xyz);vAlpha=(.13+uNight*(.25+.2*sin(uTime+position.x*3.))+uFlash*.25*(1.-smoothstep(0.,8.,length(mv.xy))))*(1.-smoothstep(35.,80.,d));gl_PointSize=clamp(aSize*70./max(d,1.),1.6,5.)*uPixelRatio;gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float vAlpha;varying float vY;void main(){if(vY>26.8)discard;float d=dot(gl_PointCoord-.5,gl_PointCoord-.5);if(d>.25)discard;gl_FragColor=vec4(.22,.78,.95,vAlpha*exp(-d*14.));}`}));this.plankton.frustumCulled=false;this.scene.add(this.plankton);
  }
  rays(){
    const material=new T.ShaderMaterial({uniforms:{uTime:time,uOpacity:{value:1}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,vertexShader:`varying vec2 vUv;varying vec3 vPos;varying vec3 vNormal;void main(){vNormal=normalMatrix*normal;vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vPos=p.xyz;gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform float uTime;uniform float uOpacity;varying vec2 vUv;varying vec3 vPos;varying vec3 vNormal;void main(){float facing=pow(abs(dot(normalize(vNormal),normalize(-vPos))),3.);float edge=pow(sin(vUv.x*3.14159),2.);float fade=sin(vUv.y*3.14159);float dist=1.-smoothstep(40.,135.,length(vPos));gl_FragColor=vec4(.46,.81,.71,facing*edge*fade*fade*dist*.018*uOpacity*(.8+.2*sin(uTime*.3+vUv.y*4.)));}`});
    this.rayMaterial=material;
    for(let i=0;i<16;i++){const m=new T.Mesh(new T.CylinderGeometry(.35,3.5+this.random()*3,51,12,1,true),material);m.position.set(-45+i*7,4,-35+this.random()*80);m.rotation.z=-.30;m.rotation.x=.14;m.userData.offset=m.position.clone();this.rayMeshes.push(m);this.scene.add(m);}
    // Soft sun disc seen through the wave surface.
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(244,255,203,.9)');grad.addColorStop(.1,'rgba(223,255,211,.5)');grad.addColorStop(.5,'rgba(160,247,220,.08)');grad.addColorStop(1,'rgba(120,230,220,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);const tex=new T.CanvasTexture(canvas);this.sunTexture=tex;
    const sprite=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));sprite.position.set(30,26,-28);sprite.scale.set(60,60,1);this.sunSprite=sprite;this.scene.add(sprite);
  }
  makeBubbles(){
    const g=new T.BufferGeometry();const p=new Float32Array(100*3);p.fill(-999);g.setAttribute('position',new T.BufferAttribute(p,3));this.bubbleData=p;
    this.bubblePoints=new T.Points(g,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uPixelRatio:{value:this.renderer.getPixelRatio()}},vertexShader:`uniform float uPixelRatio;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(50./max(1.,-p.z),2.,18.)*uPixelRatio;gl_Position=projectionMatrix*p;}`,fragmentShader:`void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.29,.35,d)*(1.-smoothstep(.41,.48,d))*.30;if(a<=.004)discard;gl_FragColor=vec4(.60,.89,.91,a);}`}));this.bubblePoints.frustumCulled=false;this.scene.add(this.bubblePoints);
    for(let i=0;i<100;i++)this.bubbles.push({life:0,x:0,y:0,z:0});
  }
  setFlash(value){this.grade.uniforms.uFlash.value=value;}
  update(dt,t,depth,active,underwater=1){
    this.grade.uniforms.uDepth.value=depth;this.grade.uniforms.uUnderwater.value=underwater;this.rayMaterial.uniforms.uOpacity.value=(1-depth*.96)*underwater;this.plankton.visible=underwater>.01;this.sunSprite.visible=underwater>.05;for(const ray of this.rayMeshes){ray.position.x=this.camera.position.x+ray.userData.offset.x;ray.position.z=this.camera.position.z+ray.userData.offset.z;}
    if(active&&(this.diverAnchor?.position.y??0)<26.7){this.bubbleTimer+=dt;if(this.bubbleTimer>4.8){this.bubbleTimer=0;const forward=new T.Vector3();const source=this.diverAnchor||this.camera;source.getWorldDirection(forward);if(this.diverAnchor)forward.negate();for(let i=0;i<15;i++){const b=this.bubbles[this.bubbleIndex++%100];b.life=5+this.random()*2;b.x=source.position.x+forward.x*.28+(this.random()-.5)*.3;b.y=source.position.y-.14+forward.y*.28-this.random()*.08;b.z=source.position.z+forward.z*.28+(this.random()-.5)*.3;}}}
    for(let i=0;i<100;i++){const b=this.bubbles[i];b.life-=dt;if(b.y>27)b.life=0;if(b.life>0){b.x+=Math.sin(t+i)*dt*.13;b.y+=dt*(.7+i%4*.13);this.bubbleData.set([b.x,b.y,b.z],i*3);}else this.bubbleData[i*3+1]=-999;}this.bubblePoints.geometry.attributes.position.needsUpdate=true;
  }
  toggleFlashlight(){const on=this.flashlight.intensity===0;this.flashlight.intensity=on?170:0;this.beam.visible=on;this.plankton.material.uniforms.uFlash.value=on?1:0;return on;}
  // Multisampling has to be rebuilt on the GPU, so the targets are dropped and re-created lazily.
  setSamples(count){const next=Math.max(0,count|0);if(next===this.samples)return;this.samples=next;for(const target of [this.composer.renderTarget1,this.composer.renderTarget2]){target.dispose();target.samples=next;}}
  configure({bloom=true,bloomStrength=.30,antialiasing='off',sharpness=.35,distortion=.3,lightShafts=true,vignette=1,filmGrain=false,aberration=0}={}){
    this.bloom.enabled=bloom;this.bloom.strength=bloomStrength;
    this.fxaa.enabled=antialiasing==='fxaa';this.smaa.enabled=antialiasing==='smaa';
    this.setSamples(antialiasingModes[antialiasing]??0);
    const u=this.grade.uniforms;
    u.uSharpness.value=sharpness;u.uDistortion.value=distortion;u.uVignette.value=vignette;u.uGrain.value=filmGrain?1:0;u.uAberration.value=aberration;
    this.rayMeshes.forEach(ray=>ray.visible=lightShafts);this.lightShafts=lightShafts;
  }
  resize(w,h){
    this.composer.setSize(w,h);const ratio=this.renderer.getPixelRatio();
    this.grade.uniforms.uTexel.value.set(1/(w*ratio),1/(h*ratio));
    this.plankton.material.uniforms.uPixelRatio.value=ratio;this.bubblePoints.material.uniforms.uPixelRatio.value=ratio;
  }
  dispose(){this.composer.passes.forEach(p=>p.dispose?.());this.composer.dispose();this.sunTexture.dispose();}
}
