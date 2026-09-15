// Frame intervals include GPU/vsync waits. Probe gently at the refresh cap;
// a capped 60 Hz display cannot demonstrate headroom by exceeding 60 fps.
export class FramePacing {
  constructor(){this.reset();}
  reset(){this.intervals=[];this.elapsed=0;}
  record(seconds,active=true){
    if(!active||!Number.isFinite(seconds)||seconds<=0||seconds>.25){this.reset();return null;}
    this.intervals.push(seconds*1000);this.elapsed+=seconds;
    if(this.elapsed<1)return null;
    const sorted=[...this.intervals].sort((a,b)=>a-b),count=sorted.length;
    const sample={fps:count/this.elapsed,mean:this.elapsed*1000/count,p95:sorted[Math.ceil(count*.95)-1],slowRatio:sorted.filter(ms=>ms>25).length/count};
    this.reset();return sample;
  }
}
export function adaptiveScale(state,scale,sample){
  if(!sample||!Number.isFinite(sample.fps)||!Number.isFinite(sample.p95)||!Number.isFinite(sample.slowRatio))return scale;
  state.cooldown=Math.max(0,(state.cooldown||0)-1);
  let next=scale;
  if(sample.fps<48){next-=.10;state.healthy=0;state.cooldown=8;}
  else if(sample.fps<55.8){next-=.05;state.healthy=0;state.cooldown=8;}
  else if(sample.fps>=58&&sample.p95<=22&&sample.slowRatio<=.1){
    state.healthy=(state.healthy||0)+1;
    if(state.healthy>=3&&state.cooldown===0){next+=.04;state.healthy=0;}
  }else state.healthy=0;
  return Math.max(.6,Math.min(1,Math.round(next*100)/100));
}
