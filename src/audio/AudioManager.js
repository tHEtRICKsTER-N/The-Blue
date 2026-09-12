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
      // Weather rides on white noise rather than the brown ambience loop: rain needs the high end
      // that the integrated loop above has already thrown away. One source, two filtered taps —
      // hiss for the rain on the water, and a low moan for the wind.
      const white=c.createBuffer(1,length,c.sampleRate),whiteData=white.getChannelData(0);
      for(let i=0;i<length;i++)whiteData[i]=(Math.random()*2-1)*.5;
      const weather=c.createBufferSource();weather.buffer=white;weather.loop=true;this.weather=weather;
      this.rainFilter=c.createBiquadFilter();this.rainFilter.type='bandpass';this.rainFilter.frequency.value=1900;this.rainFilter.Q.value=.45;
      this.rainGain=c.createGain();this.rainGain.gain.value=0;
      weather.connect(this.rainFilter);this.rainFilter.connect(this.rainGain);this.rainGain.connect(this.master);
      this.windFilter=c.createBiquadFilter();this.windFilter.type='lowpass';this.windFilter.frequency.value=380;
      this.windGain=c.createGain();this.windGain.gain.value=0;
      weather.connect(this.windFilter);this.windFilter.connect(this.windGain);this.windGain.connect(this.master);
      weather.start();
    }this.active=true;this.context?.resume().catch(()=>{});
  }
  // Above the surface you hear the storm; below it you feel it. Both levels ramp rather than step.
  setWeather(rain=0,wind=0,surface=false){
    const c=this.context;if(!c||!this.rainGain)return;const now=c.currentTime,above=surface?1:.14;
    this.rainGain.gain.setTargetAtTime(Math.min(1,rain)*.26*above,now,.6);
    this.windGain.gain.setTargetAtTime(Math.min(1,wind)*.20*(surface?1:.3),now,.9);
    this.rainFilter.frequency.setTargetAtTime(surface?1900:620,now,1.2);
    this.windFilter.frequency.setTargetAtTime(260+Math.min(1,wind)*420,now,1.2);
  }
  // Distance is in arbitrary strike units: near strikes crack, far ones are a long dull rumble.
  thunder(distance=1){
    const c=this.context;if(!c)return;const now=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    source.buffer=this.noiseBuffer;source.playbackRate.value=.30+Math.random()*.3;
    filter.type='lowpass';filter.frequency.value=110+560/Math.max(.45,distance);filter.Q.value=.7;
    const level=Math.min(.55,.40/Math.max(.5,distance)),tail=2.1+distance*.9;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level,now+(distance<1?.05:.35));
    gain.gain.exponentialRampToValueAtTime(.0015,now+tail);
    source.connect(filter).connect(gain).connect(this.master);source.start(now);source.stop(now+tail+.3);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  setMuted(value){this.muted=value;if(this.context)this.master.gain.setTargetAtTime(value?0:.45,this.context.currentTime,.4);}
  pause(){this.active=false;this.context?.suspend().catch(()=>{});}
  breathe(){const c=this.context;if(!c)return;const now=c.currentTime,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=this.noiseBuffer;filter.type='bandpass';filter.frequency.value=620;filter.Q.value=.6;gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.28,now+.7);gain.gain.exponentialRampToValueAtTime(.001,now+2);source.connect(filter).connect(gain).connect(this.master);source.start(now);source.stop(now+2.2);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
  whaleCall(){const c=this.context;if(!c)return;const now=c.currentTime,osc=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner();osc.type='sine';osc.frequency.setValueAtTime(115,now);osc.frequency.exponentialRampToValueAtTime(62,now+3);osc.frequency.exponentialRampToValueAtTime(86,now+6);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.045,now+2);gain.gain.exponentialRampToValueAtTime(.001,now+7);pan.pan.value=-.65;osc.connect(gain).connect(pan).connect(this.master);osc.start();osc.stop(now+7.1);osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};}
  update(dt,depth,surface=false){if(!this.context||!this.active)return;this.breath+=dt;this.whale-=dt;this.filter.frequency.setTargetAtTime(surface?1700:310-depth*210,this.context.currentTime,.8);if(this.breath>4.8&&!surface){this.breath=0;this.breathe();}if(this.whale<0){this.whale=65+Math.random()*45;this.whaleCall();}}
  dispose(){this.context?.close().catch(()=>{});}
}

