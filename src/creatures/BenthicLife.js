import * as T from 'three';
import { floorHeight, seededRandom } from '../world/materials.js';

// A bounded population of bottom-dwellers with shared meshes and slower, distinct motion.
export class BenthicLife {
  constructor(scene){
    this.animals=[];this.random=seededRandom(1941);this.sphere=new T.SphereGeometry(1,14,10);this.segment=new T.CylinderGeometry(1,1,1,7);this.skin=new T.MeshStandardMaterial({color:'#a27554',roughness:.78});this.pale=new T.MeshStandardMaterial({color:'#c7bf9b',roughness:.6});this.eye=new T.MeshStandardMaterial({color:'#0b1618',roughness:.25});
    const homes=[[150,90],[-150,-460],[140,-240],[32,-20],[-70,-70]];
    for(let i=0;i<25;i++){const type=i%4,root=new T.Group(),limbs=[],home=homes[i%homes.length],x=home[0]+(this.random()-.5)*35,z=home[1]+(this.random()-.5)*30;scene.add(root);
      const animal={root,limbs,type,x,z,phase:this.random()*6.28,name:['Common octopus','Reef cuttlefish','Swimming crab','Spotted moray eel'][type]};
      if(type===0){this.part(root,this.skin,0,.55,-.35,.44,.6,.53);this.part(root,this.skin,0,.23,.1,.45,.23,.4);for(let j=0;j<8;j++){const arm=new T.Group();arm.rotation.y=j*Math.PI/4;root.add(arm);const points=[];for(let k=0;k<6;k++)points.push(new T.Vector3(Math.sin(k*.9)*.13,.15-k*.02,.15+k*.28));const m=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),14,.085,6,false),this.skin);arm.add(m);limbs.push(arm);}}
      if(type===1){this.part(root,this.skin,0,.4,-.1,.43,.28,.9);this.part(root,this.pale,0,.32,-.1,.56,.10,.87);this.part(root,this.skin,0,.35,.8,.3,.22,.3);for(let j=0;j<8;j++){const arm=this.part(root,this.skin,(j-3.5)*.07,.27,1.1,.035,.04,.37);limbs.push(arm);}}
      if(type===2){this.part(root,this.skin,0,.23,0,.5,.2,.37);for(const side of [-1,1]){for(let j=0;j<4;j++){const leg=this.part(root,this.skin,side*.62,.16,(j-1.5)*.2,.38,.04,.055);leg.rotation.z=side*.22;limbs.push(leg);}const claw=this.part(root,this.skin,side*.58,.27,.54,.21,.12,.3);this.part(root,this.pale,side*.67,.28,.77,.06,.07,.18);limbs.push(claw);}}
      if(type===3){for(let j=0;j<14;j++){const part=this.part(root,j%3===0?this.pale:this.skin,0,.25,-j*.22,.17-j*.008,.2-j*.009,.24);limbs.push(part);}this.part(root,this.skin,0,.27,.25,.20,.22,.4);}
      for(const side of [-1,1])this.part(root,this.eye,side*(type===2?.25:.22),type===0?.48:.4,type===1?.91:type===3?.4:.33,.045,.05,.05);
      root.scale.setScalar(type===3?1.4:.8+this.random()*.4);root.position.set(x,floorHeight(x,z)+.08,z);this.animals.push(animal);
    }
  }
  part(root,material,x,y,z,sx,sy,sz){const m=new T.Mesh(this.sphere,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);root.add(m);return m;}
  update(dt,t,player){
    for(const a of this.animals){
      // Relocation happens beyond visibility, retaining a fixed population during long expeditions.
      if(Math.hypot(player.x-a.x,player.z-a.z)>320){const angle=a.phase;a.x=Math.floor(player.x/128)*128+Math.cos(angle)*95;a.z=Math.floor(player.z/128)*128+Math.sin(angle)*95;}
      const angle=t*(a.type===2?.045:.025)+a.phase,x=a.x+Math.cos(angle)*3,z=a.z+Math.sin(angle)*3,bottom=floorHeight(x,z);
      a.root.visible=bottom<22&&Math.hypot(x-player.x,z-player.z)<110;if(!a.root.visible)continue;
      a.root.position.set(x,bottom+(a.type===1?1.6+Math.sin(t*.8+a.phase)*.25:.12),z);a.root.rotation.y=-angle;
      a.limbs.forEach((limb,j)=>{if(a.type===3){limb.position.x=Math.sin(t*1.8-j*.35+a.phase)*j*.025;}else if(a.type===0){limb.rotation.x=Math.sin(t*.9+j*.6+a.phase)*.12;}else limb.rotation.y=Math.sin(t*(a.type===2?3:1.5)+j*.7+a.phase)*.14;});
    }
  }
  nearby(player){return this.animals.filter(a=>a.root.visible&&a.root.position.distanceToSquared(player)<64).map(a=>a.name);}
}
