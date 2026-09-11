import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { time, seededRandom } from '../world/materials.js';

export class Atmosphere {
  constructor(renderer,scene,camera){
    this.scene=scene;this.camera=camera;this.renderer=renderer;this.rayMeshes=[];this.random=seededRandom(413);this.bubbles=[];this.bubbleTimer=0;this.bubbleIndex=0;
    this.composer=new EffectComposer(renderer);this.composer.addPass(new RenderPass(scene,camera));
    this.bloom=new UnrealBloomPass(new T.Vector2(800,600),.30,.65,.85);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},uTime:time,uDepth:{value:0},uUnderwater:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime;uniform float uDepth;uniform float uUnderwater;varying vec2 vUv;
      void main(){vec2 uv=vUv;uv.x+=sin(uv.y*16.+uTime*.35)*.00038*uUnderwater;vec3 col=texture2D(tDiffuse,uv).rgb;
      float vignette=1.-smoothstep(.23,.80,distance(vUv,vec2(.5)))*.22*uUnderwater;
      col*=vignette;col=mix(col,col*vec3(.60,.84,1.06),uDepth*.32);
      gl_FragColor=vec4(col,1.);}`});this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());this.fxaa=new ShaderPass(FXAAShader);this.composer.addPass(this.fxaa);
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
    this.plankton=new T.Points(g,new T.ShaderMaterial({uniforms:{uNight:{value:0},uTime:time,uCamera:{value:this.camera.position},uFlash:{value:0}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`uniform float uNight;uniform float uTime;uniform vec3 uCamera;uniform float uFlash;attribute float aSize;varying float vAlpha;varying float vY;void main(){vec3 p=position;p.x+=sin(uTime*.1+position.z*.12)*2.;p.y+=uTime*.035;p=mod(p-uCamera+vec3(85.,37.5,85.),vec3(170.,75.,170.))-vec3(85.,37.5,85.)+uCamera;vY=p.y;vec4 mv=modelViewMatrix*vec4(p,1.);float d=length(mv.xyz);vAlpha=(.13+uNight*(.25+.2*sin(uTime+position.x*3.))+uFlash*.25*(1.-smoothstep(0.,8.,length(mv.xy))))*(1.-smoothstep(35.,80.,d));gl_PointSize=clamp(aSize*70./max(d,1.),1.,4.);gl_Position=projectionMatrix*mv;}`,fragmentShader:`varying float vAlpha;varying float vY;void main(){if(vY>26.8)discard;float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.22,.78,.95,vAlpha*pow(1.-d*2.,2.));}`}));this.plankton.frustumCulled=false;this.scene.add(this.plankton);
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
    this.bubblePoints=new T.Points(g,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{},vertexShader:`varying float vDepth;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vDepth=-p.z;gl_PointSize=clamp(50./max(1.,-p.z),2.,18.);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying float vDepth;void main(){float d=length(gl_PointCoord-.5);if(d>.48||d<.30)discard;float a=(1.-smoothstep(.3,.48,d))*.26;gl_FragColor=vec4(.60,.89,.91,a);}`}));this.bubblePoints.frustumCulled=false;this.scene.add(this.bubblePoints);
    for(let i=0;i<100;i++)this.bubbles.push({life:0,x:0,y:0,z:0});
  }
  update(dt,t,depth,active,underwater=1){
    this.grade.uniforms.uDepth.value=depth;this.grade.uniforms.uUnderwater.value=underwater;this.rayMaterial.uniforms.uOpacity.value=(1-depth*.96)*underwater;this.plankton.visible=underwater>.01;this.sunSprite.visible=underwater>.05;for(const ray of this.rayMeshes){ray.position.x=this.camera.position.x+ray.userData.offset.x;ray.position.z=this.camera.position.z+ray.userData.offset.z;}
    if(active&&(this.diverAnchor?.position.y??0)<26.7){this.bubbleTimer+=dt;if(this.bubbleTimer>4.8){this.bubbleTimer=0;const forward=new T.Vector3();const source=this.diverAnchor||this.camera;source.getWorldDirection(forward);if(this.diverAnchor)forward.negate();for(let i=0;i<15;i++){const b=this.bubbles[this.bubbleIndex++%100];b.life=5+this.random()*2;b.x=source.position.x+forward.x*.28+(this.random()-.5)*.3;b.y=source.position.y-.14+forward.y*.28-this.random()*.08;b.z=source.position.z+forward.z*.28+(this.random()-.5)*.3;}}}
    for(let i=0;i<100;i++){const b=this.bubbles[i];b.life-=dt;if(b.y>27)b.life=0;if(b.life>0){b.x+=Math.sin(t+i)*dt*.13;b.y+=dt*(.7+i%4*.13);this.bubbleData.set([b.x,b.y,b.z],i*3);}else this.bubbleData[i*3+1]=-999;}this.bubblePoints.geometry.attributes.position.needsUpdate=true;
  }
  toggleFlashlight(){const on=this.flashlight.intensity===0;this.flashlight.intensity=on?170:0;this.beam.visible=on;this.plankton.material.uniforms.uFlash.value=on?1:0;return on;}
  resize(w,h){this.composer.setSize(w,h);const ratio=this.renderer.getPixelRatio();this.fxaa.uniforms.resolution.value.set(1/(w*ratio),1/(h*ratio));}
  dispose(){this.composer.passes.forEach(p=>p.dispose?.());this.composer.dispose();this.sunTexture.dispose();}
}



