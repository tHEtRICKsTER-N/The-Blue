import { floorHeight } from '../world/materials.js';
export const cathedralCenter={x:140,z:-240};
// A continuous circuit through the open arch, wholly inside the outer pillars.
export function cathedralRayPose(t){
  const angle=t*.085,x=140+Math.sin(angle)*3,z=-245+Math.cos(angle)*8;
  const y=Math.max(floorHeight(140,-240)+7,floorHeight(x,z)+3);
  return {x,y,z,yaw:Math.atan2(Math.cos(angle)*3,-Math.sin(angle)*8)};
}
export function observeCathedralRay(state,dt,distance,speed){
  state.watched=distance<18&&speed<1.2?(state.watched||0)+dt:0;
  if(state.watched<3||state.observed)return false;
  state.observed=true;return true;
}
