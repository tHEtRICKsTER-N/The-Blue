import * as T from 'three';

// A shared articulated body for both camera modes, measured from the eyes.
export class DiverAvatar {
  constructor(scene) {
    this.root = new T.Group();
    this.root.name = 'Scuba diver';
    this.root.visible = false;
    scene.add(this.root);
    const material = (color, extra = {}) => new T.MeshStandardMaterial({ color, roughness: .58, ...extra });
    this.skin = material('#b77c55');
    this.suit = material('#173c46');
    this.panel = material('#28717b');
    this.trim = material('#ecad55');
    this.rubber = material('#11272d');
    this.metal = material('#a1bec1', { metalness: .55, roughness: .32 });
    const lens = material('#4ba9b7', { metalness: .35, roughness: .12 });
    this.sphere = new T.SphereGeometry(1,16,12);
    this.capsule = new T.CapsuleGeometry(.10,.38,4,10);
    this.box = new T.BoxGeometry(1,1,1);
    this.head = new T.Group();this.root.add(this.head);
    this.part(this.head,this.sphere,this.rubber,[0,-.02,.03],[.22,.27,.23]);
    this.part(this.head,this.sphere,this.skin,[0,-.065,-.15],[.18,.20,.09]);
    this.part(this.head,this.sphere,this.trim,[0,-.02,-.17],[.23,.14,.07]);
    for(const side of [-1,1])this.part(this.head,this.sphere,lens,[side*.10,-.015,-.218],[.086,.083,.035]);
    this.part(this.head,this.sphere,this.rubber,[0,-.16,-.21],[.09,.07,.08]);
    this.mouth = new T.Object3D();this.mouth.position.set(0,-.14,-.29);this.root.add(this.mouth);
    this.torso = new T.Group();this.torso.position.y=-.27;this.root.add(this.torso);
    this.chest=this.part(this.torso,this.sphere,this.suit,[0,-.48,.035],[.33,.53,.20]);
    this.part(this.torso,this.sphere,this.panel,[0,-.43,-.12],[.26,.36,.12]);
    this.hips=this.part(this.torso,this.sphere,this.rubber,[0,-.91,.03],[.29,.22,.19]);
    // Buoyancy vest, harness, tank, valve, and pressure hose.
    for(const side of [-1,1]){
      this.part(this.torso,this.box,this.rubber,[side*.23,-.4,-.19],[.085,.65,.055]);
      this.part(this.torso,this.box,this.trim,[side*.23,-.62,-.225],[.11,.08,.03]);
      this.part(this.torso,this.sphere,this.rubber,[side*.3,-.42,.04],[.12,.36,.22]);
    }
    this.part(this.torso,this.box,this.rubber,[0,-.78,-.14],[.59,.09,.13]);
    this.part(this.torso,this.box,this.metal,[0,-.78,-.22],[.12,.08,.035]);
    this.part(this.torso,this.capsule,this.metal,[0,-.44,.35],[1.6,1.6,1.6]);
    for(const y of [-.21,-.66])this.part(this.torso,this.box,this.rubber,[0,y,.36],[.33,.08,.31]);
    this.part(this.torso,this.box,this.trim,[0,.05,.35],[.10,.13,.12]);
    const hose = new T.CatmullRomCurve3([new T.Vector3(0,.03,.34),new T.Vector3(.4,-.01,.27),new T.Vector3(.41,-.03,-.2),new T.Vector3(.07,.09,-.2)]);
    this.part(this.torso,new T.TubeGeometry(hose,20,.027,6,false),this.rubber,[0,0,0],[1,1,1]);
    this.arms=[];this.legs=[];
    for(const side of [-1,1]){
      const arm=new T.Group();arm.position.set(side*.35,-.18,0);this.torso.add(arm);
      this.part(arm,this.capsule,this.suit,[0,-.23,0],[1.1,.88,1.1]);
      this.part(arm,this.sphere,this.trim,[0,-.11,0],[.116,.065,.115]);
      const elbow=new T.Group();elbow.position.y=-.48;arm.add(elbow);
      this.part(elbow,this.capsule,this.panel,[0,-.20,0],[.88,.72,.88]);
      const hand=this.part(elbow,this.sphere,this.skin,[0,-.45,0],[.095,.15,.075]);hand.name=side<0?'Left hand':'Right hand';
      this.part(elbow,this.sphere,this.skin,[side*.09,-.41,-.015],[.045,.085,.045]);
      if(side===-1){this.part(elbow,this.box,this.rubber,[0,-.28,-.08],[.15,.13,.06]);this.part(elbow,this.box,lens,[0,-.28,-.118],[.10,.08,.015]);}
      this.arms.push({arm,elbow,side,hand});
      const leg=new T.Group();leg.position.set(side*.16,-1.0,.025);this.torso.add(leg);
      this.part(leg,this.capsule,this.suit,[0,-.29,0],[1.35,1.08,1.35]);
      const knee=new T.Group();knee.position.y=-.58;leg.add(knee);
      this.part(knee,this.capsule,this.panel,[0,-.26,0],[1,1,1]);
      this.part(knee,this.sphere,this.rubber,[0,-.52,-.025],[.13,.17,.2]);
      const fin=this.part(knee,this.box,this.trim,[0,-.64,-.31],[.27,.06,.70]);fin.rotation.x=-.20;
      for(const x of [-.09,.09])this.part(knee,this.box,this.rubber,[x,-.603,-.37],[.025,.023,.55]);
      this.legs.push({leg,knee,side});
    }
    this.bodyPitch=0;this.kickPhase=0;
  }
  setAppearance(character,skin){
    this.character=character;this.skin.color.set(skin);
    const female=character==='female';this.chest.scale.x=female?.30:.33;this.hips.scale.x=female?.32:.29;
    this.head.scale.setScalar(female?.95:1);
    for(const {arm,side} of this.arms)arm.position.x=side*(female?.32:.35);
  }
  part(parent,geometry,material,position,scale){const mesh=new T.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);parent.add(mesh);return mesh;}
  update(dt,t,position,yaw,pitch,speed,active,firstPerson){
    this.root.visible=active;this.root.position.copy(position);this.root.rotation.y=yaw;
    const effort=T.MathUtils.clamp(speed/5,0,1);
    this.bodyPitch=T.MathUtils.lerp(this.bodyPitch,-effort*(firstPerson?.32:.95),1-Math.exp(-dt*3));
    this.torso.rotation.x=this.bodyPitch;
    this.head.rotation.x=pitch;this.head.visible=!firstPerson;
    this.kickPhase+=dt*(1.7+effort*3.8);
    for(const {arm,elbow,side} of this.arms){const stroke=Math.sin(this.kickPhase*.65+(side<0?Math.PI:0));arm.rotation.z=side*(.12+effort*.09+stroke*.035);arm.rotation.x=firstPerson?1.60-this.bodyPitch+stroke*(.06+effort*.08):.5+effort*.95+stroke*.22;elbow.rotation.x=firstPerson?.24+stroke*.13:.25+effort*.3;}
    for(const {leg,knee,side} of this.legs){const kick=Math.sin(this.kickPhase+(side===1?Math.PI:0));leg.rotation.x=kick*(.05+effort*.25);knee.rotation.x=-.12-Math.max(0,kick)*effort*.35;}
    this.root.updateMatrixWorld(true);
  }
}

