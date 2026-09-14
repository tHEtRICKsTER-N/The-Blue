import { updateDolphinEncounter } from './DolphinEncounter.js';
import { BenthicLife } from './BenthicLife.js';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { time, seededRandom, floorHeight } from '../world/materials.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const rand=seededRandom(9073);
function triangle(points){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();return g;}
function fishGeometry(shape=0){
  const body=new T.SphereGeometry(1,12,8);body.scale(shape===2?.11:.18,shape===1?.43:.27,.64);
  const tail=triangle([[0,0,-.50],[0,.37,-.99],[0,-.37,-.99]]);
  const dorsal=triangle([[0,.18,.30],[0,.49,-.32],[0,.19,-.4]]);
  const fin=triangle([[0,0,.12],[.4,-.13,-.26],[0,-.1,-.24],[0,0,.12],[0,-.1,-.24],[-.4,-.13,-.26]]);
  const parts=[body,tail,dorsal,fin].map(g=>g.index?g.toNonIndexed():g);
  const g=mergeGeometries(parts.map(p=>{p.deleteAttribute('uv');return p;}));parts.forEach(p=>p.dispose());return g;
}
function fishMaterial(color,pattern=0){
  const mat=new T.MeshStandardMaterial({color,roughness:.43,metalness:.15,side:T.DoubleSide});
  mat.onBeforeCompile=s=>{
    s.uniforms.oceanTime=time;
    s.vertexShader='uniform float oceanTime; varying vec3 fishLocal;\n'+s.vertexShader;
    s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      fishLocal=position;
      float phase=0.;
      #ifdef USE_INSTANCING
      phase=instanceMatrix[3].x*.9;
      #endif
      transformed.x+=sin(oceanTime*7.+position.z*6.+phase)*.14*(1.-smoothstep(-.9,.25,position.z));`);
    s.fragmentShader='varying vec3 fishLocal;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float stripe = step(.68, sin(fishLocal.z*${pattern===1?'26.0':'15.0'}));
      diffuseColor.rgb *= mix(.42,1.,1.-stripe*${pattern===2?'.85':'.35'});
      if(fishLocal.z < -.64) diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.95,.71,.18),.8);
      float eye=length((fishLocal.yz-vec2(.075,.46))*vec2(1.,1.));
      if(eye<.05)diffuseColor.rgb=vec3(.008,.018,.02);
      diffuseColor.rgb *= mix(.68,1.12,smoothstep(-.2,.2,fishLocal.y));`);
  };mat.customProgramCacheKey=()=>`fish-${pattern}`;return mat;
}

export class FishSchool {
  constructor(scene,{center,count,color,shape,speed,name},obstacles){
    this.center=V(...center);this.count=count;this.speed=speed;this.name=name;this.obstacles=obstacles;this.clock=0;this.step=0;
    this.mesh=new T.InstancedMesh(fishGeometry(shape),fishMaterial(color,shape),count);this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);
    this.positions=[];this.velocities=[];this.scales=[];this.dummy=new T.Object3D();this.delta=V();this.force=V();this.target=V();this.sep=V();this.avg=V();
    for(let i=0;i<count;i++){this.positions.push(this.center.clone().add(V((rand()-.5)*18,(rand()-.5)*5,(rand()-.5)*12)));this.velocities.push(V(1,0,0).multiplyScalar(speed));this.scales.push(.35+rand()*.42);}
  }
  update(dt,t,player){
    this.clock+=dt;this.step+=dt;
    const center=this.target.copy(this.center).add(V(Math.sin(t*.10)*9,Math.sin(t*.16)*1.5,Math.cos(t*.10)*7));
    if(this.step>1/12){const step=Math.min(.16,this.step);this.step=0;const localObstacles=this.obstacles.filter(o=>o.p.distanceToSquared(this.center)<(40+o.r)**2);
      for(let i=0;i<this.count;i++){
        const p=this.positions[i],v=this.velocities[i];this.force.copy(center).sub(p).multiplyScalar(.13);this.sep.set(0,0,0);this.avg.set(0,0,0);let neighbors=0;
        for(let j=0;j<this.count;j++){if(i===j)continue;this.delta.copy(p).sub(this.positions[j]);const dist=this.delta.lengthSq();if(dist<18){this.avg.add(this.velocities[j]);neighbors++;if(dist<1.8)this.sep.addScaledVector(this.delta,1/Math.max(.05,dist));}}
        if(neighbors)this.force.add(this.avg.multiplyScalar(1/neighbors).sub(v).multiplyScalar(.5));this.force.addScaledVector(this.sep,1.6);
        this.delta.copy(p).sub(player);let dist=this.delta.length();if(dist<6)this.force.addScaledVector(this.delta,(6-dist)*.5/Math.max(.1,dist));
        for(const o of localObstacles){this.delta.copy(p).sub(o.p);dist=this.delta.length();if(dist<o.r+2)this.force.addScaledVector(this.delta,(o.r+2-dist)*1.8/Math.max(.1,dist));}
        const floor=floorHeight(p.x,p.z)+1.5;if(p.y<floor+2)this.force.y+=(floor+2-p.y)*2;
        if(p.y>23)this.force.y-=(p.y-23)*3;
        v.addScaledVector(this.force,step).clampLength(this.speed*.5,this.speed*1.35);
      }
    }
    for(let i=0;i<this.count;i++){
      const p=this.positions[i],v=this.velocities[i];p.addScaledVector(v,dt);this.dummy.position.copy(p);this.delta.copy(p).add(v);this.dummy.lookAt(this.delta);p.y=Math.min(24,p.y);this.dummy.position.y=p.y;this.dummy.scale.setScalar(floorHeight(p.x,p.z)>23?0:this.scales[i]);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    }this.mesh.instanceMatrix.needsUpdate=true;
  }
  relocate(center){const delta=center.clone().sub(this.center);this.center.copy(center);this.positions.forEach(p=>p.add(delta));}
}

function ellipsoid(parent,mat,p,scale){const m=new T.Mesh(new T.SphereGeometry(1,20,14),mat);m.position.set(...p);m.scale.set(...scale);parent.add(m);return m;}
function fin(parent,mat,points){const m=new T.Mesh(triangle(points),mat);parent.add(m);return m;}
function makeTurtle(){
  const root=new T.Group(),shell=new T.MeshStandardMaterial({color:'#63704b',roughness:.65}),skin=new T.MeshStandardMaterial({color:'#9ba67a',roughness:.8,side:T.DoubleSide});
  const carapace=ellipsoid(root,shell,[0,0,0],[1,.42,1.3]);
  const wire=new T.LineSegments(new T.WireframeGeometry(new T.IcosahedronGeometry(1,1)),new T.LineBasicMaterial({color:'#b0af76',transparent:true,opacity:.35}));wire.scale.set(1.015,.425,1.315);root.add(wire);
  ellipsoid(root,skin,[0,-.15,0],[.91,.16,1.18]);ellipsoid(root,skin,[0,.02,1.4],[.30,.28,.50]);
  const black=new T.MeshStandardMaterial({color:'#071c20'});for(const s of [-1,1])ellipsoid(root,black,[s*.255,.12,1.61],[.055,.055,.055]);
  const flippers=[];for(const s of [-1,1]){const front=fin(root,skin,[[s*.7,0,.8],[s*2.1,-.15,-.45],[s*.8,-.1,-.2]]);flippers.push(front);fin(root,skin,[[s*.6,-.1,-.7],[s*1.05,-.1,-1.6],[s*.3,-.1,-1.2]]);}return {root,flippers,carapace};
}
function makeRay(){
  const root=new T.Group(),g=new T.PlaneGeometry(7,3.7,36,20);g.rotateX(-Math.PI/2);const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),u=Math.abs(x)/3.5;p.setZ(i,z*(1-u*.8)-u*.7);p.setY(i,.19*(1-u)-Math.abs(z)*.06);}g.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({color:'#25474d',roughness:.55,side:T.DoubleSide});mat.onBeforeCompile=s=>{s.uniforms.oceanTime=time;s.vertexShader='uniform float oceanTime;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 transformed.y+=sin(oceanTime*1.65-abs(position.x)*.65)*pow(abs(position.x)/3.5,1.4)*1.1;`);};
  root.add(new T.Mesh(g,mat));ellipsoid(root,mat,[0,.04,.2],[.65,.25,1.35]);
  const tail=new T.Mesh(new T.ConeGeometry(.085,3.2,7),mat);tail.rotation.x=-Math.PI/2;tail.position.set(0,-.05,-2.8);root.add(tail);
  for(const s of [-1,1]){const horn=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V(s*.4,0,1.1),V(s*.62,0,1.9),V(s*.45,.05,2.1)]),8,.09,5,false),mat);root.add(horn);}return {root};
}
function makeShark(){
  const root=new T.Group(),mat=new T.MeshStandardMaterial({color:'#5f7b7d',roughness:.55,side:T.DoubleSide}),belly=new T.MeshStandardMaterial({color:'#a6b8ad',roughness:.75});
  ellipsoid(root,mat,[0,0,0],[.65,.62,2.5]);ellipsoid(root,belly,[0,-.26,.15],[.56,.32,2.1]);ellipsoid(root,mat,[0,-.05,2.05],[.48,.36,.75]);
  fin(root,mat,[[0,.4,.45],[0,1.7,-.6],[0,.4,-1.1]]);
  for(const s of [-1,1]){fin(root,mat,[[s*.4,-.15,1.0],[s*2.2,-.5,-1.1],[s*.45,-.25,-.75]]);ellipsoid(root,new T.MeshStandardMaterial({color:'#061b22'}),[s*.38,.1,2.38],[.075,.075,.075]);}
  const tail=fin(root,mat,[[0,0,-2],[0,1.6,-3.7],[0,.1,-3.15],[0,0,-2],[0,.1,-3.15],[0,-.85,-3.45]]);return {root,tail};
}
function makeJelly(){
  const root=new T.Group(),mat=new T.MeshStandardMaterial({color:'#99d8dd',emissive:'#429bbb',emissiveIntensity:1.1,transparent:true,opacity:.52,side:T.DoubleSide,roughness:.25,depthWrite:false});
  const bell=new T.Mesh(new T.SphereGeometry(.65,24,14,0,Math.PI*2,0,Math.PI*.58),mat);bell.scale.y=.72;root.add(bell);
  const thread=new T.MeshBasicMaterial({color:'#98dce5',transparent:true,opacity:.5});
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2,r=.37;const pts=[];for(let j=0;j<9;j++)pts.push(V(Math.cos(a)*r+Math.sin(j*.8+i)*.10,-.1-j*.24,Math.sin(a)*r+Math.cos(j*.9+i)*.09));const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.012,4,false),thread);root.add(m);}return {root,bell};
}
function makeDolphin(whale=false){
  const root=new T.Group(),skin=new T.MeshStandardMaterial({color:whale?'#3c697b':'#7fabb3',roughness:.43,side:T.DoubleSide}),belly=new T.MeshStandardMaterial({color:'#bfd2cc',roughness:.6});
  ellipsoid(root,skin,[0,0,0],[.51,.47,1.85]);ellipsoid(root,belly,[0,-.19,.2],[.44,.25,1.55]);ellipsoid(root,skin,[0,.02,1.44],[.37,.35,.67]);ellipsoid(root,skin,[0,-.10,2.0],[whale?.34:.14,.13,.48]);
  fin(root,skin,[[0,.3,.2],[0,1.12,-.5],[0,.3,-.8]]);
  for(const side of [-1,1]){fin(root,skin,[[side*.36,-.15,.7],[side*1.2,-.45,-.5],[side*.35,-.2,-.3]]);ellipsoid(root,new T.MeshStandardMaterial({color:'#0b2028'}),[side*.31,.05,1.76],[.045,.05,.05]);}
  const tail=fin(root,skin,[[0,0,-1.6],[1.0,.05,-2.55],[0,-.04,-2.25],[0,0,-1.6],[0,-.04,-2.25],[-1.0,.05,-2.55]]);return {root,tail};
}
export class MarineLife {
  constructor(scene,obstacles){
    this.benthic=new BenthicLife(scene);
    const configs=[{center:[7,5,-8],count:72,color:'#d5be49',shape:1,speed:1.4,name:'Golden butterflyfish'},{center:[-3,9,-27],count:85,color:'#70b9cf',shape:0,speed:2.1,name:'Blue chromis'},{center:[16,1,7],count:46,color:'#d6864c',shape:2,speed:1.2,name:'Reef anthias'},{center:[-36,2,-40],count:60,color:'#b8c8c1',shape:0,speed:2.0,name:'Silver sardines'},{center:[36,-7,-68],count:44,color:'#ddd8a6',shape:2,speed:1.4,name:'Moorish idols'},{center:[5,-23,-133],count:48,color:'#5ca9ba',shape:0,speed:1.3,name:'Lanternfish'}];
    this.schools=configs.map(c=>new FishSchool(scene,c,obstacles));this.animals=[];
    for(let i=0;i<3;i++)this.add(scene,makeTurtle(),{name:'Green sea turtle',center:V(i===0?7:-20+i*19,5+i*2,-12-i*24),radius:10,speed:.06,phase:i*2,scale:1.0});
    this.add(scene,makeRay(),{name:'Giant manta ray',center:V(13,14,-26),radius:17,speed:.047,phase:.5,scale:1.15});
    this.add(scene,makeShark(),{name:'Blacktip reef shark',center:V(38,1,-57),radius:28,speed:.043,phase:2.1,scale:.9});
    for(let i=0;i<22;i++){const deep=i>5;this.add(scene,makeJelly(),{name:'Moon jellyfish',center:V((rand()-.5)*24+(deep?8:-25),deep?-27-rand()*10:6+rand()*8,deep?-148+(rand()-.5)*30:-62+(rand()-.5)*20),radius:1.4,speed:.06,phase:i,scale:.5+rand()*.9,jelly:true});}
    this.roamingSchools=[];
    for(let i=0;i<4;i++){const s=new FishSchool(scene,{center:[Math.cos(i*1.57)*90,6,Math.sin(i*1.57)*90],count:48,color:['#66becb','#e1c668','#ca779d','#7bc7a3'][i],shape:i%3,speed:1.4+i*.2,name:['Pearly fusiliers','Banded wrasse','Purple anthias','Lagoon damselfish'][i]},obstacles);this.roamingSchools.push(s);this.schools.push(s);}
    for(let i=0;i<3;i++)this.add(scene,makeDolphin(),{name:'Bottlenose dolphin',center:V(55+i*5,22,-95+i*4),radius:24,speed:.12,phase:i*.3,scale:.9,roaming:true,dolphin:true});
    this.add(scene,makeDolphin(true),{name:'Blue whale',center:V(-65,-2,-155),radius:50,speed:.016,phase:0,scale:4.8,roaming:true,whale:true});
    for(let i=0;i<5;i++)this.add(scene,i%2?makeRay():makeTurtle(),{name:i%2?'Reef manta ray':'Hawksbill sea turtle',center:V(Math.cos(i*1.25)*115,-5,Math.sin(i*1.25)*115),radius:12,speed:.045,phase:i,scale:1,roaming:true});
  }
  add(scene,model,config){Object.assign(model,config);model.root.scale.setScalar(config.scale);model.root.position.copy(config.center);scene.add(model.root);if(model.dolphin){model.encounter={mode:'cruise',calm:0,cooldown:0};model.target=V();model.direction=V();}this.animals.push(model);}
  update(dt,t,player,diverSpeed=0){
    this.benthic.update(dt,t,player);
    this.roamingSchools.forEach((s,i)=>{if(s.center.distanceTo(player)>190){const a=i*Math.PI*.5,x=Math.floor(player.x/128)*128+Math.cos(a)*85,z=Math.floor(player.z/128)*128+Math.sin(a)*85,y=Math.max(floorHeight(x,z)+7,Math.min(19,player.y-3));if(y<24)s.relocate(V(x,y,z));}});
    this.schools.forEach(s=>{s.mesh.visible=s.center.distanceToSquared(player)<230*230;if(s.mesh.visible)s.update(dt,t,player);});
    for(const a of this.animals){if(a.roaming&&a.center.distanceTo(player)>235){const x=player.x+Math.cos(a.phase+1)*120,z=player.z+Math.sin(a.phase+1)*120;a.center.set(x,a.dolphin?22:Math.min(12,Math.max(floorHeight(x,z)+12,player.y-4)),z);if(a.dolphin&&a.root.position.distanceTo(player)>235){a.root.position.copy(a.center);a.encounter={mode:'cruise',calm:0,cooldown:0};}}
      a.root.visible=a.center.distanceToSquared(player)<270*270&&(!a.whale||(t%160>35&&t%160<95));if(!a.root.visible)continue;
      const v=t*a.speed+a.phase;if(a.jelly){a.root.position.set(a.center.x+Math.sin(v)*1.5,a.center.y+Math.sin(t*.35+a.phase)*.9,a.center.z+Math.cos(v));a.bell.scale.set(1+Math.sin(t*2+a.phase)*.08,.72-Math.sin(t*2+a.phase)*.1,1+Math.sin(t*2+a.phase)*.08);a.root.rotation.z=Math.sin(t*.5+a.phase)*.06;}
      else{if(a.dolphin){
        const distance=a.root.position.distanceTo(player);
        const mode=updateDolphinEncounter(a.encounter,dt,distance,diverSpeed);
        a.target.set(a.center.x+Math.cos(v)*a.radius,a.center.y+Math.sin(v*2)*1.1,a.center.z+Math.sin(v)*a.radius*.65);
        if(mode==='curious'){
          const angle=t*.18+a.phase;
          a.target.set(player.x+Math.cos(angle)*9,Math.min(23,player.y+2),player.z+Math.sin(angle)*9);
        }else if(mode==='retreat'){
          a.direction.copy(a.root.position).sub(player);
          if(a.direction.lengthSq()<.001)a.direction.set(1,0,0);
          a.target.copy(a.root.position).addScaledVector(a.direction.normalize(),14);
        }
        a.target.y=Math.min(24,Math.max(a.target.y,floorHeight(a.target.x,a.target.z)+2));
        a.direction.copy(a.target).sub(a.root.position);
        const step=Math.min(a.direction.length(),dt*(mode==='retreat'?4:mode==='curious'?2:3));
        if(step>0){
          a.direction.normalize();a.root.position.addScaledVector(a.direction,step);
          const yaw=Math.atan2(a.direction.x,a.direction.z);
          a.root.rotation.y+=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y))*(1-Math.exp(-dt*3));
        }
      }else{a.root.position.set(a.center.x+Math.cos(v)*a.radius,a.center.y+Math.sin(v*2)*1.1,a.center.z+Math.sin(v)*a.radius*.65);a.root.rotation.y=Math.atan2(-Math.sin(v),Math.cos(v)*.65);}if(a.flippers)a.flippers.forEach((f,i)=>f.rotation.z=Math.sin(t*1.5+a.phase)*(i?-.22:.22));if(a.tail){if(a.dolphin||a.whale)a.tail.rotation.x=Math.sin(t*(a.whale?.7:2.8))*.19;else a.tail.rotation.y=Math.sin(t*2.8)*.18;}const bottom=floorHeight(a.root.position.x,a.root.position.z);a.root.position.y=Math.max(a.root.position.y,bottom+2);if(a.root.position.y>25.5)a.root.visible=false;}}
  }
  nearby(player){const list=this.benthic.nearby(player);for(const a of this.animals)if(a.root.visible&&a.root.position.distanceTo(player)<(a.whale?45:12))list.push(a.name);for(const s of this.schools)if(s.mesh.visible&&s.positions.some(p=>p.distanceToSquared(player)<49))list.push(s.name);return list;}
}

