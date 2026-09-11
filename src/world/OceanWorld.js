import { ExplorationSites } from './ExplorationSites.js';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { oceanMaterial, swayMaterial, seededRandom, floorHeight, time } from './materials.js';

import { OceanSurface } from './OceanSurface.js';
import { StreamingOcean } from './StreamingOcean.js';
const V = (x=0,y=0,z=0) => new T.Vector3(x,y,z);
export class OceanWorld {
  constructor(scene) {
    this.scene=scene; this.random=seededRandom(); this.obstacles=[]; this.solids=[];
    this.landmarks=[{name:'Coral Garden',p:V(0,3,0),radius:30},{name:'Emerald Kelp Forest',p:V(-40,-3,-34),radius:23},{name:'Sunken Voyager',p:V(38,-13,-77),radius:22},{name:'Crystal Grotto',p:V(-42,-23,-109),radius:17},{name:'Jellyfish Garden',p:V(8,-33,-148),radius:23}];
    this.terrain(); this.reef(); this.kelp(); this.surface();
  }
  mesh(geo,mat,p,scale,parent=this.scene) { const m=new T.Mesh(geo,mat); if(p)m.position.copy(p); if(scale)m.scale.copy(scale); parent.add(m); return m; }
  terrain() {

    const rockG=new T.IcosahedronGeometry(1,2), p=rockG.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i), y=p.getY(i), z=p.getZ(i);const r=1+.12*Math.sin(x*7+y*4)*Math.cos(z*6);p.setXYZ(i,x*r,y*r,z*r);}rockG.computeVertexNormals();
    this.rockG=rockG;this.rockMat=oceanMaterial('#596f68');
    const rocks=new T.InstancedMesh(rockG,this.rockMat,170),d=new T.Object3D();
    for(let i=0;i<170;i++){
      let x=(this.random()-.5)*170,z=35-this.random()*240;
      if(i<45){x=(i%2?1:-1)*(10+this.random()*24);z=17-this.random()*72;}
      const s=1.6+this.random()*5.8;d.position.set(x,floorHeight(x,z)-.5,z);d.scale.set(s,s*(.4+this.random()*.6),s*(.8+this.random()*.6));d.rotation.set(this.random(),this.random()*6,this.random()*.25);d.updateMatrix();rocks.setMatrixAt(i,d.matrix);
      rocks.setColorAt(i,new T.Color().setHSL(.40+this.random()*.09,.13+this.random()*.18,.21+this.random()*.17));
      this.obstacles.push({p:d.position.clone(),r:s*.85});
    }rocks.computeBoundingSphere();this.scene.add(rocks);
    // Tall reef escarpments frame the sandy swimming channel.
    for(const [x,z,s] of [[-26,-28,12],[28,-39,13],[-48,-83,11],[57,-107,18],[-22,-181,17],[39,-196,22]]){
      const p=V(x,floorHeight(x,z)+s*.15,z);this.mesh(rockG,this.rockMat,p,V(s,s*.9,s*.7));this.obstacles.push({p,r:s*.82});
    }
  }
  branchGeometry() {
    const parts=[];
    const branch=(start,dir,length,radius,level)=>{
      const end=start.clone().addScaledVector(dir,length);
      const g=new T.CylinderGeometry(radius*.63,radius,length,6,1);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),dir));g.translate(...start.clone().add(end).multiplyScalar(.5).toArray());parts.push(g);
      if(level>0)for(let j=0;j<3;j++){
        const angle=j*Math.PI*2/3+this.random();const next=dir.clone().multiplyScalar(.5).add(V(Math.cos(angle)*.65,.5,Math.sin(angle)*.65)).normalize();branch(end,next,length*.69,radius*.68,level-1);
      }
    };
    branch(V(),V(0,1,0),1.1,.12,3);
    const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
  }
  reef() {
    const d=new T.Object3D(),colors=['#dc9473','#af729e','#8e78bc','#dfb261','#a5bec1','#4b9b90'];
    const branch=this.branchGeometry();
    const corals=new T.InstancedMesh(branch,swayMaterial('#ffffff',.008),240);
    for(let i=0;i<240;i++){
      let x=(i%2?1:-1)*(7+this.random()*34),z=28-this.random()*120;
      if(i<48){x=(i%2?1:-1)*(7+this.random()*12);z=23-this.random()*42;}
      const s=.45+this.random()*1.8;d.position.set(x,floorHeight(x,z),z);d.scale.set(s,s*(.8+this.random()*.5),s);d.rotation.set(0,this.random()*6,0);d.updateMatrix();corals.setMatrixAt(i,d.matrix);corals.setColorAt(i,new T.Color(colors[i%colors.length]));
    }corals.computeBoundingSphere();this.scene.add(corals);
    // Folded, scalloped table corals, each with a fluted silhouette.
    const plate=new T.SphereGeometry(1,28,12),p=plate.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x);const r=1+.10*Math.sin(a*9)+.05*Math.sin(a*17);p.setXYZ(i,x*r,y*.11+Math.sin(a*8)*.04,z*r);}plate.computeVertexNormals();
    const plates=new T.InstancedMesh(plate,oceanMaterial('#ffffff'),310);
    for(let i=0;i<310;i++){
      const x=(i%2?1:-1)*(9+this.random()*35),z=28-this.random()*125,s=.5+this.random()*2.2;
      d.position.set(x,floorHeight(x,z)+.2+this.random()*1.8,z);d.scale.set(s,s,s);d.rotation.set((this.random()-.5)*.3,this.random()*6,(this.random()-.5)*.25);d.updateMatrix();plates.setMatrixAt(i,d.matrix);plates.setColorAt(i,new T.Color(colors[(i+2)%colors.length]));
    }plates.computeBoundingSphere();this.scene.add(plates);
    const tube=new T.CylinderGeometry(.19,.3,1.6,10,3,true), tubes=new T.InstancedMesh(tube,oceanMaterial('#de9d58',{side:T.DoubleSide}),240);
    for(let i=0;i<240;i++){const x=(i%2?1:-1)*(9+this.random()*24),z=24-this.random()*76;d.position.set(x,floorHeight(x,z)+.65,z);d.scale.setScalar(.5+this.random());d.rotation.set(this.random()*.3,this.random()*6,this.random()*.3);d.updateMatrix();tubes.setMatrixAt(i,d.matrix);}tubes.computeBoundingSphere();this.scene.add(tubes);
    const grassParts=[];
    for(let j=0;j<7;j++){const g=new T.PlaneGeometry(.12,1+this.random(),1,5);g.translate(0,.7,0);g.rotateY(j*2.4);g.translate((this.random()-.5)*.7,0,(this.random()-.5)*.7);grassParts.push(g);}const grassG=mergeGeometries(grassParts);grassParts.forEach(g=>g.dispose());
    this.grass=new T.InstancedMesh(grassG,swayMaterial('#466b43',.2),1100);
    for(let i=0;i<1100;i++){const x=(this.random()-.5)*110,z=40-this.random()*190;d.position.set(x,floorHeight(x,z),z);d.scale.setScalar(.4+this.random()*.9);d.rotation.set(0,this.random()*6,0);d.updateMatrix();this.grass.setMatrixAt(i,d.matrix);}this.grass.computeBoundingSphere();this.scene.add(this.grass);
  }
  kelp() {
    const parts=[];
    const stem=new T.CylinderGeometry(.025,.065,13,5,18);stem.translate(0,6.5,0);parts.push(stem);
    for(let i=0;i<18;i++){
      const g=new T.PlaneGeometry(1.25,1.4,4,4),p=g.attributes.position;
      for(let j=0;j<p.count;j++){const y=p.getY(j);p.setX(j,p.getX(j)*Math.max(.12,Math.sin((y+.7)/1.4*Math.PI)));p.setZ(j,Math.sin((y+.7)*2)*.23);}
      g.rotateZ((i%2?1:-1)*.7);g.rotateY(i*2.4);g.translate(Math.sin(i*2.4)*.5,.7+i*.65,Math.cos(i*2.4)*.5);g.computeVertexNormals();parts.push(g);
    }
    const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());const kelp=new T.InstancedMesh(g,swayMaterial('#768448',.065),95),d=new T.Object3D();
    for(let i=0;i<95;i++){const x=-43+(this.random()-.5)*32,z=-36+(this.random()-.5)*37;d.position.set(x,floorHeight(x,z),z);d.rotation.set(0,this.random()*6,0);d.scale.setScalar(.65+this.random()*.8);d.updateMatrix();kelp.setMatrixAt(i,d.matrix);kelp.setColorAt(i,new T.Color().setHSL(.2+this.random()*.07,.35,.45+this.random()*.25));}kelp.computeBoundingSphere();this.scene.add(kelp);
  }
  surface() { this.surfaceWorld=new OceanSurface(this.scene); }
  addLandmarks() {
    this.shipwreck();this.cave();this.exploration=new ExplorationSites(this);this.baseObstacleCount=this.obstacles.length;this.stream=new StreamingOcean(this);
  }
  box(size,p,mat,parent=this.scene,solid=false){const m=this.mesh(new T.BoxGeometry(...size),mat,p,null,parent);if(solid)this.solids.push(new T.Box3().setFromObject(m));return m;}
  shipwreck() {
    const ship=new T.Group();ship.position.set(38,floorHeight(38,-77)+1,-77);ship.rotation.y=-.25;this.scene.add(ship);
    const wood=oceanMaterial('#534937'),rust=oceanMaterial('#675746'),edge=oceanMaterial('#94876b');
    // An open ribbed hull, missing deck boards, and a swim-through cabin.
    this.box([9,.35,29],V(0,0,0),wood,ship);
    for(let z=-14;z<=14;z+=2.1){
      for(const s of [-1,1]){const rib=this.box([.3,4.5,.3],V(s*4.1,1.9,z),edge,ship);rib.rotation.z=-s*.2;}
      if(z<-5 || z>5)this.box([8.5,.18,1.6],V(0,4.1,z),wood,ship);
      for(const s of [-1,1])for(let y=0;y<3;y++)if(!(z>0&&z<7&&s===-1))this.box([.16,.62,1.95],V(s*(4.1+y*.18),y+.6,z),wood,ship);
    }
    for(const s of [-1,1]){const bow=this.box([.25,3.8,7],V(s*2.5,1.6,-16),wood,ship);bow.rotation.y=-s*.62;}
    this.box([7,.22,6],V(0,7,-7),rust,ship);
    for(const x of [-3.2,3.2])for(const z of [-10,-4])this.box([.35,3,.35],V(x,5.6,z),edge,ship);
    this.box([6.8,1.2,.25],V(0,4.7,-10),rust,ship);
    const mast=this.mesh(new T.CylinderGeometry(.14,.28,18,9),wood,V(0,10,-1),null,ship);mast.rotation.z=.16;
    const cross=this.box([12,.18,.18],V(-1.6,15,-1),edge,ship);cross.rotation.z=.16;
    for(let i=0;i<8;i++){const plank=this.box([.7,.15,3+this.random()*3],V(-6+this.random()*12,.1,12+this.random()*7),wood,ship);plank.rotation.y=this.random()*6;}
    for(let i=0;i<5;i++){const barrel=this.mesh(new T.CylinderGeometry(.6,.6,1.1,12),rust,V(-2+i*.95,.75,-5),null,ship);barrel.rotation.z=.1;}
    ship.updateMatrixWorld(true);
    ship.traverse(o=>{if(o.isMesh)this.solids.push(new T.Box3().setFromObject(o));});
    const ropeMat=oceanMaterial('#667c61');
    const curve=new T.CatmullRomCurve3([V(-1.6,18,-1),V(1,11,5),V(3,4,12)]);this.mesh(new T.TubeGeometry(curve,20,.035,4,false),ropeMat,V(),null,ship);
  }
  cave() {
    const cx=-42,cz=-106,base=floorHeight(cx,cz);
    // Overlapping rock arches form a shaded tunnel with a wider back chamber.
    for(let j=0;j<5;j++)for(let i=0;i<9;i++){
      const a=i/8*Math.PI,x=cx+Math.cos(a)*7,y=base+Math.sin(a)*7,z=cz-j*5;
      const p=V(x,y,z),r=2.7;this.mesh(this.rockG,this.rockMat,p,V(2.8,2.8,3.7));this.obstacles.push({p,r});
    }
    const glow=new T.MeshStandardMaterial({color:'#64aeca',emissive:'#23c8de',emissiveIntensity:1.7,roughness:.4});
    for(let i=0;i<35;i++){const x=cx+(i%2?1:-1)*(4+this.random()),z=cz-this.random()*22;const g=new T.ConeGeometry(.22+this.random()*.3,1+this.random()*1.5,5);this.mesh(g,glow,V(x,floorHeight(x,z)+.5,z));}
    const light=new T.PointLight('#1cc7ed',18,18,2);light.position.set(cx,base+2,cz-15);this.scene.add(light);
  }
}

