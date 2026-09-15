import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floorHeight, oceanMaterial, seededRandom, swayMaterial, time, waterHeight } from './materials.js';

export const destinations = [
  {name:'Basalt Cathedral',x:140,z:-240,description:'A reef manta ray circles through a broad arch among volcanic pillars.'},
  {name:'The Smoking Gardens',x:-150,z:-460,description:'Mineral chimneys, rising plumes and pale tube-worm colonies.'},
  {name:'Seagrass Nursery',x:150,z:90,description:'A quiet meadow sheltering cuttlefish, crabs and young reef fish.'},
  {name:'Palm Cay Anchorage',x:-150,z:-310,description:'A sheltered island coast, a moored sailboat and circling seabirds.'},
];

export class ExplorationSites {
  constructor(world){
    this.world=world;this.groups=[];this.birds=[];this.floaters=[];
    this.random=seededRandom(971);this.sphere=new T.SphereGeometry(1,12,8);this.box=new T.BoxGeometry(1,1,1);this.cylinder=new T.CylinderGeometry(1,1,1,8);
    this.stone=oceanMaterial('#464f4b');this.wood=oceanMaterial('#81705a');this.green=swayMaterial('#536d34',.03);this.ivory=oceanMaterial('#ddd7b6');
    for(const site of destinations){const group=new T.Group();group.position.set(site.x,floorHeight(site.x,site.z),site.z);world.scene.add(group);this.groups.push(group);world.landmarks.push({name:site.name,p:new T.Vector3(site.x,site.name==='Palm Cay Anchorage'?27:group.position.y+6,site.z),radius:42});}
    this.cathedral(this.groups[0]);this.vents(this.groups[1]);this.meadow(this.groups[2]);this.coast(this.groups[3]);this.batch(this.groups[0]);this.batch(this.groups[1]);
  }
  batch(root){
    root.updateMatrixWorld(true);const inverse=root.matrixWorld.clone().invert(),groups=new Map(),remove=[];
    root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;const geometry=o.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld));const g=geometry.index?geometry.toNonIndexed():geometry;if(g!==geometry)geometry.dispose();g.deleteAttribute('uv');const list=groups.get(o.material)||[];list.push(g);groups.set(o.material,list);remove.push(o);});
    for(const o of remove)o.removeFromParent();for(const [material,parts] of groups){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());root.add(new T.Mesh(g,material));}
  }
  mesh(parent,geometry,material,x,y,z,sx=1,sy=1,sz=1,solid=false){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);if(solid){parent.updateMatrixWorld(true);this.world.solids.push(new T.Box3().setFromObject(m));}return m;}
  cathedral(root){
    for(let i=0;i<30;i++){const a=i*2.399,r=15+this.random()*21,x=Math.cos(a)*r,z=Math.sin(a)*r,h=6+this.random()*15,y=floorHeight(root.position.x+x,root.position.z+z)-root.position.y;
      this.mesh(root,this.cylinder,this.stone,x,y+h*.5,z,1.3+this.random(),h,1.3+this.random(),true);
    }
    // Individual stone blocks leave a navigable opening instead of a solid bounding box.
    for(let i=0;i<13;i++){const angle=i/12*Math.PI;this.mesh(root,this.world.rockG,this.stone,Math.cos(angle)*11,2+Math.sin(angle)*13,-7,2.4,2.6,4,true);}
    const sponge=oceanMaterial('#b58857');for(let i=0;i<26;i++){const x=(this.random()-.5)*34,z=(this.random()-.5)*30,y=floorHeight(root.position.x+x,root.position.z+z)-root.position.y;this.mesh(root,new T.CylinderGeometry(.6,.9,1.4,10,1,true),sponge,x,y+.7,z);}
  }
  vents(root){
    const rim=oceanMaterial('#aaa789'),worm=oceanMaterial('#a94435');const plumePositions=[];
    for(let i=0;i<12;i++){const x=(this.random()-.5)*38,z=(this.random()-.5)*34,h=2+this.random()*7,y=floorHeight(root.position.x+x,root.position.z+z)-root.position.y;
      this.mesh(root,this.cylinder,this.stone,x,y+h*.5,z,.55,h,.65,true);this.mesh(root,new T.TorusGeometry(.48,.12,6,12),rim,x,y+h,z).rotation.x=Math.PI/2;
      for(let j=0;j<18;j++){const a=j*2.4,r=1+this.random()*2,tx=x+Math.cos(a)*r,tz=z+Math.sin(a)*r,ty=floorHeight(root.position.x+tx,root.position.z+tz)-root.position.y;this.mesh(root,this.cylinder,this.ivory,tx,ty+.4,tz,.055,.8,.055);this.mesh(root,this.sphere,worm,tx,ty+.85,tz,.15,.12,.15);}
      for(let j=0;j<45;j++)plumePositions.push(x+(this.random()-.5)*2,y+h+this.random()*13,z+(this.random()-.5)*2);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(plumePositions,3));
    const m=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:time},vertexShader:`uniform float uTime;varying float fade;void main(){vec3 p=position;float age=mod(uTime*.6+position.y,13.);p.y+=age;p.x+=sin(age*.5+position.z)*age*.15;fade=(1.-age/13.)*.12;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(35.,100./max(1.,-mv.z));}`,fragmentShader:`varying float fade;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(.12,.17,.18,fade*(1.-smoothstep(.1,.5,d)));}`});root.add(new T.Points(g,m));
  }
  meadow(root){
    const blade=new T.PlaneGeometry(.14,2.2,1,5);blade.translate(0,1.1,0);const grass=new T.InstancedMesh(blade,swayMaterial('#66845b',.13),650),d=new T.Object3D();
    for(let i=0;i<650;i++){const x=(this.random()-.5)*70,z=(this.random()-.5)*60;d.position.set(x,floorHeight(root.position.x+x,root.position.z+z)-root.position.y,z);d.rotation.y=this.random()*Math.PI;d.scale.setScalar(.4+this.random());d.updateMatrix();grass.setMatrixAt(i,d.matrix);}grass.computeBoundingSphere();root.add(grass);
  }
  coast(root){
    // Place palms only on exposed island terrain, including distant silhouettes.
    const grove=new T.Group();root.add(grove);
    for(let i=0;i<26;i++){const a=i*2.4,r=18+this.random()*48,x=-230+Math.cos(a)*r,z=-310+Math.sin(a)*r,y=floorHeight(x,z);if(y<29)continue;
      const palm=new T.Group();palm.position.set(x-root.position.x,y-root.position.y,z-root.position.z);grove.add(palm);const h=5+this.random()*5;this.mesh(palm,this.cylinder,this.wood,0,h*.5,0,.2,h,.2);
      for(let j=0;j<7;j++){const frond=new T.Shape();frond.moveTo(0,0);frond.quadraticCurveTo(1.4,1,4.6,0);frond.quadraticCurveTo(1.4,-.4,0,0);const leaf=this.mesh(palm,new T.ShapeGeometry(frond,8),this.green,0,h,0);leaf.rotation.set(-Math.PI/2,0,j*Math.PI*2/7);}
    }
    this.batch(grove);
    const boat=new T.Group();boat.position.set(-134-root.position.x,27-root.position.y,-305-root.position.z);root.add(boat);this.floaters.push({root:boat,base:boat.position.y,phase:0});
    const hull=this.mesh(boat,this.sphere,oceanMaterial('#e8e1cc'),0,.25,0,2.0,.85,5);this.mesh(boat,this.box,this.wood,0,.8,0,3.2,.2,7.3);this.mesh(boat,this.cylinder,this.wood,0,6,0,.1,11,.1);
    const sail=new T.Shape();sail.moveTo(0,0);sail.lineTo(0,9);sail.quadraticCurveTo(2.2,6,3.8,.2);sail.closePath();this.mesh(boat,new T.ShapeGeometry(sail),new T.MeshStandardMaterial({color:'#ece7d8',side:T.DoubleSide,roughness:.9}),.15,1.3,0);
    for(let i=0;i<3;i++){const buoy=new T.Group();buoy.position.set(25+i*9,27-root.position.y,i*12);root.add(buoy);this.mesh(buoy,this.sphere,oceanMaterial('#c57541'),0,0,0,.45,.6,.45);this.mesh(buoy,this.cylinder,this.wood,0,1,0,.05,1.5,.05);this.floaters.push({root:buoy,base:buoy.position.y,phase:i+1});}
    const white=new T.MeshStandardMaterial({color:'#e0dfd5',roughness:.9,side:T.DoubleSide});
    const wingShape=new T.Shape();wingShape.moveTo(0,0);wingShape.lineTo(1.6,-.3);wingShape.lineTo(.65,.16);wingShape.closePath();const wingG=new T.ShapeGeometry(wingShape);
    for(let i=0;i<16;i++){const bird=new T.Group();root.add(bird);this.mesh(bird,this.sphere,white,0,0,0,.14,.13,.4);const wings=[];for(const side of [-1,1]){const wing=this.mesh(bird,wingG,white,0,0,0,side,1,1);wing.rotation.x=Math.PI/2;wings.push(wing);}this.birds.push({root:bird,wings,phase:i*.8});}
  }
  update(t,player,quality){
    this.groups.forEach((g,i)=>{g.visible=Math.hypot(g.position.x-player.x,g.position.z-player.z)<(i===3?1500:350);});
    const coast=this.groups[3];for(const f of this.floaters){const p=f.root.position;const h=waterHeight(p.x+coast.position.x,p.z+coast.position.z,t);p.y=h-coast.position.y;f.root.rotation.z=Math.sin(t*.65+f.phase)*.035;f.root.rotation.x=Math.sin(t*.85+f.phase)*.025;}
    for(const [i,b] of this.birds.entries()){b.root.visible=quality!=='low'||i<8;const a=t*.065+b.phase;b.root.position.set(Math.cos(a)*(38+i*2),48-coast.position.y+Math.sin(a*2)*3,Math.sin(a)*(30+i));b.root.position.y=Math.max(b.root.position.y,floorHeight(b.root.position.x+coast.position.x,b.root.position.z+coast.position.z)+8-coast.position.y);b.root.rotation.y=-a;b.wings.forEach((w,j)=>w.rotation.y=Math.sin(t*2.8+b.phase)*(j?-.18:.18));}
  }
}
