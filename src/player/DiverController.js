import * as T from 'three';
import { floorHeight, waterHeight } from '../world/materials.js';
import { DiverAvatar } from './DiverAvatar.js';
import { CameraRig } from './CameraRig.js';
export class DiverController {
  constructor(camera,canvas,world,onPause,onFlashlight,onCameraChange=()=>{}){
    this.camera=camera;this.canvas=canvas;this.world=world;this.active=false;this.started=false;this.drag=false;this.keys=new Set();this.velocity=new T.Vector3();this.yaw=0;this.pitch=-.07;this.targetYaw=0;this.targetPitch=-.07;this.forward=new T.Vector3();this.right=new T.Vector3();this.acceleration=new T.Vector3();this.next=new T.Vector3();this.delta=new T.Vector3();this.listeners=[];
    this.position=new T.Vector3();this.viewAnchor=new T.Object3D();world.scene.add(this.viewAnchor);this.avatar=new DiverAvatar(world.scene);this.rig=new CameraRig(camera,world);this.onCameraChange=onCameraChange;this.orientation=new T.Quaternion();this.bodyRotation=new T.Quaternion();this.bodyPoint=new T.Vector3();this.bodyOffset=new T.Vector3();this.collisionBox=new T.Box3();
    const listen=(target,type,fn)=>{target.addEventListener(type,fn);this.listeners.push(()=>target.removeEventListener(type,fn));};
    listen(window,'keydown',e=>{if(!this.active)return;if(['Space','ControlLeft','ControlRight','KeyW','KeyA','KeyS','KeyD','KeyC','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();this.keys.add(e.code);}if(e.code==='KeyF'&&!e.repeat)onFlashlight();if(e.code==='KeyV'&&!e.repeat){e.preventDefault();this.toggleCamera();}if(e.code==='Escape'){this.pause();onPause(true);}});
    listen(window,'keyup',e=>this.keys.delete(e.code));
    listen(document,'pointerlockchange',()=>{if(!document.pointerLockElement&&this.active&&this.hadLock){this.pause();onPause(true);}if(document.pointerLockElement===canvas)this.hadLock=true;});
    listen(document,'mousemove',e=>{if(!this.active||(!document.pointerLockElement&&!this.drag))return;this.targetYaw-=e.movementX*.0018;this.targetPitch=T.MathUtils.clamp(this.targetPitch-e.movementY*.0016,-1.38,1.38);});
    listen(canvas,'mousedown',()=>{if(this.active){this.drag=true;if(!document.pointerLockElement)this.lock();}});listen(window,'mouseup',()=>this.drag=false);
    listen(window,'blur',()=>{this.keys.clear();if(this.active){this.pause();onPause(true);}});
    this.reset();
  }
  lock(){try{const p=this.canvas.requestPointerLock();if(p?.catch)p.catch(()=>{});}catch{/* Drag-look remains available. */}}
  start(){this.active=true;this.started=true;this.keys.clear();this.lock();}
  pause(){this.active=false;this.keys.clear();this.drag=false;if(document.pointerLockElement===this.canvas)document.exitPointerLock();}
  reset(){this.position.set(0,9,26);this.camera.position.copy(this.position);this.velocity.set(0,0,0);this.yaw=this.targetYaw=0;this.pitch=this.targetPitch=-.075;this.rig.distance=0;}
  setCameraMode(mode){this.rig.setMode(mode);this.onCameraChange(mode);}
  toggleCamera(){this.setCameraMode(this.rig.mode==='fps'?'tps':'fps');}
  update(dt,t){
    if(!this.started){this.camera.position.set(Math.sin(t*.035)*.9,9+Math.sin(t*.17)*.12,26);this.camera.rotation.set(-.075+Math.sin(t*.08)*.008,Math.sin(t*.06)*.018,0,'YXZ');return;}
    if(this.active){
    this.yaw=T.MathUtils.lerp(this.yaw,this.targetYaw,1-Math.exp(-dt*15));this.pitch=T.MathUtils.lerp(this.pitch,this.targetPitch,1-Math.exp(-dt*15));
    this.orientation.setFromEuler(new T.Euler(this.pitch,this.yaw,0,'YXZ'));this.forward.set(0,0,-1).applyQuaternion(this.orientation);this.right.crossVectors(this.forward,this.camera.up).normalize();this.acceleration.set(0,0,0);
    if(this.keys.has('KeyW'))this.acceleration.add(this.forward);if(this.keys.has('KeyS'))this.acceleration.sub(this.forward);if(this.keys.has('KeyD'))this.acceleration.add(this.right);if(this.keys.has('KeyA'))this.acceleration.sub(this.right);if(this.keys.has('Space'))this.acceleration.y+=1;if(this.keys.has('KeyC')||this.keys.has('ControlLeft')||this.keys.has('ControlRight'))this.acceleration.y-=1;
    const boost=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight');if(this.acceleration.lengthSq()>0)this.acceleration.normalize().multiplyScalar(boost?15:7.5);
    this.velocity.addScaledVector(this.acceleration,dt);this.velocity.multiplyScalar(Math.exp(-dt*1.6));this.next.copy(this.position).addScaledVector(this.velocity,dt);this.next.y+=Math.sin(t*.7)*dt*.025;
        const surface=waterHeight(this.next.x,this.next.z,t);
    const diving=this.keys.has('KeyC')||this.keys.has('ControlLeft')||this.keys.has('ControlRight')||(this.keys.has('KeyW')&&this.forward.y<-.25);
    if(this.position.y>surface-.35&&!diving){this.next.y+=(surface+.35-this.next.y)*(1-Math.exp(-dt*5));this.velocity.y*=Math.exp(-dt*5);}
    if(this.next.y>surface+.55){this.next.y=surface+.55;this.velocity.y=Math.min(0,this.velocity.y);}
    if(floorHeight(this.next.x,this.next.z)>surface-1.3){this.next.x=this.position.x;this.next.z=this.position.z;this.velocity.x*=.2;this.velocity.z*=.2;}
    this.next.y=Math.max(this.next.y,floorHeight(this.next.x,this.next.z)+.7);
    this.bodyRotation.setFromEuler(new T.Euler(this.avatar.bodyPitch,this.yaw,0,'YXZ'));
    // Sample a capsule along the visible body, including the fins.
    for(const height of [0,.75,1.5,2.25]){
      this.bodyOffset.set(0,-height,0).applyQuaternion(this.bodyRotation);this.bodyPoint.copy(this.next).add(this.bodyOffset);
      const floor=floorHeight(this.bodyPoint.x,this.bodyPoint.z)+.30;if(this.bodyPoint.y<floor)this.next.y+=floor-this.bodyPoint.y;
      this.bodyPoint.copy(this.next).add(this.bodyOffset);
      for(const o of this.world.obstacles){this.delta.copy(this.bodyPoint).sub(o.p);const d=this.delta.length();if(d<o.r+.32){if(d<.0001)this.delta.set(0,1,0);else this.delta.multiplyScalar(1/d);this.next.addScaledVector(this.delta,o.r+.33-d);this.bodyPoint.copy(this.next).add(this.bodyOffset);this.velocity.multiplyScalar(.7);}}
      for(const box of this.world.solids){if(this.collisionBox.copy(box).expandByScalar(.3).containsPoint(this.bodyPoint)){this.next.copy(this.position);this.velocity.multiplyScalar(.1);break;}}
    }
    this.position.copy(this.next);
    }
    const hideHead=this.rig.update(dt,this.position,this.yaw,this.pitch,t);
    this.avatar.update(this.active?dt:0,t,this.position,this.yaw,this.pitch,this.velocity.length(),this.started,hideHead);
    this.viewAnchor.position.copy(this.position);this.viewAnchor.rotation.set(this.pitch,this.yaw,0,'YXZ');this.viewAnchor.updateMatrixWorld(true);
  }
  dispose(){this.pause();this.listeners.forEach(fn=>fn());}
}

