// Authored encounter rhythms for ABYSS; all transitions use simulation time.
export function inFlashlightBeam(point,light){
  if(!light?.enabled)return false;
  const dx=point.x-light.position.x,dy=point.y-light.position.y,dz=point.z-light.position.z;
  const distance=Math.hypot(dx,dy,dz);
  return distance>0&&distance<18&&(dx*light.direction.x+dy*light.direction.y+dz*light.direction.z)/distance>.94;
}
export function turtleBehavior(state,dt,distance,speed,lit){
  state.exposure=lit?(state.exposure||0)+dt:Math.max(0,(state.exposure||0)-dt*2);
  state.cooldown=Math.max(0,(state.cooldown||0)-dt);
  if(distance<3||(distance<13&&speed>2.5)||state.exposure>.8){state.cooldown=8;state.calm=0;}
  if(state.cooldown>0){state.mode='retreat';return state.mode;}
  state.calm=distance>22||speed<1.2?(state.calm||0)+dt:0;
  state.cycle=(state.cycle||0)+dt;
  state.mode=state.calm>=3&&state.cycle%40<26?'feeding':'cruise';return state.mode;
}
export function nightActivity(hour){const h=((hour%24)+24)%24;return h<5||h>=21?1:h<7?(7-h)/2:h>=19?(h-19)/2:0;}
export function ventBehavior(state,dt,hour,lit){
  state.exposure=lit?(state.exposure||0)+dt:Math.max(0,(state.exposure||0)-dt*2);
  if(state.exposure>.6)state.cooldown=5;else state.cooldown=Math.max(0,(state.cooldown||0)-dt);
  const target=state.cooldown>0?.08:.3+nightActivity(hour)*.7;
  state.extension=(state.extension??.3)+(target-(state.extension??.3))*(1-Math.exp(-dt*(target<state.extension?5:.7)));
  return state.extension;
}
