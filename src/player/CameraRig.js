import * as T from 'three';
import { floorHeight } from '../world/materials.js';

export class CameraRig {
  constructor(camera,world){this.camera=camera;this.world=world;this.mode='fps';this.distance=0;this.ray=new T.Ray();this.hit=new T.Vector3();this.direction=new T.Vector3();this.offset=new T.Vector3();this.target=new T.Vector3();this.eye=new T.Vector3();this.box=new T.Box3();this.sphere=new T.Sphere();this.rotation=new T.Quaternion();}
  setMode(mode){if(!['fps','tps'].includes(mode))throw new Error('Unknown camera mode');this.mode=mode;}
  safeDistance(eye,offset){
    const length=offset.length();this.direction.copy(offset).normalize();this.ray.set(eye,this.direction);let allowed=length;
    for(const obstacle of this.world.obstacles){this.sphere.set(obstacle.p,obstacle.r+.22);if(this.sphere.containsPoint(eye))continue;if(this.ray.intersectSphere(this.sphere,this.hit))allowed=Math.min(allowed,Math.max(0,eye.distanceTo(this.hit)-.12));}
    for(const solid of this.world.solids){this.box.copy(solid).expandByScalar(.22);if(this.box.containsPoint(eye))continue;if(this.ray.intersectBox(this.box,this.hit))allowed=Math.min(allowed,Math.max(0,eye.distanceTo(this.hit)-.12));}
    for(let i=1;i<=24;i++){const d=length*i/24;this.hit.copy(eye).addScaledVector(this.direction,d);if(this.hit.y<floorHeight(this.hit.x,this.hit.z)+.25){allowed=Math.min(allowed,Math.max(0,d-length/24));break;}}
    return allowed;
  }
  update(dt,position,yaw,pitch,t){
    this.eye.copy(position);this.rotation.setFromEuler(new T.Euler(pitch,yaw,0,'YXZ'));
    this.offset.set(.55,.85,4.6).applyQuaternion(this.rotation);
    const desired=this.mode==='tps'?this.safeDistance(this.eye,this.offset):0;
    // Retract immediately at obstructions; ease outward when the path clears.
    this.distance=desired<this.distance?desired:T.MathUtils.lerp(this.distance,desired,1-Math.exp(-dt*7));
    this.camera.position.copy(this.eye).addScaledVector(this.offset.normalize(),this.distance);
    if(this.mode==='fps'||this.distance<.05)this.camera.rotation.set(pitch+(this.reducedMotion?0:Math.sin(t*.65)*.0018),yaw,0,'YXZ');
    else{this.target.set(0,0,-2.2).applyQuaternion(this.rotation).add(this.eye);this.camera.lookAt(this.target);}
    return this.mode==='fps'||this.distance<.7;
  }
}

