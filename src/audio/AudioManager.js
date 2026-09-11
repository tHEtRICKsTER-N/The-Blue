// Synthesized soundscape with no external audio downloads.
export class AudioManager {
  constructor(){this.context=null;this.muted=false;this.active=true;this.breath=0;this.whale=35;}
  start(){
    if(!this.context){
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      this.context=new Audio();const c=this.context;
      this.master=c.createGain();this.master.gain.value=this.muted?0:.45;this.master.connect(c.destination);
      const length=c.sampleRate*6,buffer=c.createBuffer(1,length,c.sampleRate),data=buffer.getChannelData(0);let last=0;
      for(let i=0;i<length;i++){last=(last+(Math.random()*2-1)*.025)/1.025;data[i]=last*3;}
      this.noiseBuffer=buffer;const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
      this.filter=c.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=310;const volume=c.createGain();volume.gain.value=.33;noise.connect(this.filter);this.filter.connect(volume);volume.connect(this.master);noise.start();this.noise=noise;
      const drone=c.createOscillator();drone.type='sine';drone.frequency.value=48;const gain=c.createGain();gain.gain.value=.025;drone.connect(gain).connect(this.master);drone.start();this.drone=drone;
    }this.active=true;this.context?.resume().catch(()=>{});
  }
  setMuted(value){this.muted=value;if(this.context)this.master.gain.setTargetAtTime(value?0:.45,this.context.currentTime,.4);}
  pause(){this.active=false;this.context?.suspend().catch(()=>{});}
  breathe(){const c=this.context;if(!c)return;const now=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noiseBuffer;filter.type='bandpass';filter.frequency.value=620;filter.Q.value=.6;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.28,now+.7);gain.gain.exponentialRampToValueAtTime(.001,now+2);source.connect(filter).connect(gain).connect(this.master);source.start(now);source.stop(now+2.2);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
  whaleCall(){const c=this.context;if(!c)return;const now=c.currentTime,osc=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();osc.type='sine';osc.frequency.setValueAtTime(115,now);osc.frequency.exponentialRampToValueAtTime(62,now+3);osc.frequency.exponentialRampToValueAtTime(86,now+6);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.045,now+2);gain.gain.exponentialRampToValueAtTime(.001,now+7);pan.pan.value=-.65;osc.connect(gain).connect(pan).connect(this.master);osc.start();osc.stop(now+7.1);osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};}
  update(dt,depth,surface=false){if(!this.context||!this.active)return;this.breath+=dt;this.whale-=dt;this.filter.frequency.setTargetAtTime(surface?1700:310-depth*210,this.context.currentTime,.8);if(this.breath>4.8&&!surface){this.breath=0;this.breathe();}if(this.whale<0){this.whale=65+Math.random()*45;this.whaleCall();}}
  dispose(){this.context?.close().catch(()=>{});}
}

