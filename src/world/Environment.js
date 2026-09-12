import * as T from 'three';
import { time, waveStrength, seededRandom, SEA_LEVEL } from './materials.js';

// Presets are now anchors on a continuous 24 hour clock rather than fixed palettes.
export const times = {
  dawn: ['Dawn', 5.6],
  morning: ['Morning', 8.5],
  day: ['Day', 12.5],
  afternoon: ['Afternoon', 15.5],
  evening: ['Evening', 18.2],
  dusk: ['Dusk', 19.6],
  night: ['Night', 23.5],
};
// hour, horizon, zenith, light. Sampled and interpolated, so any hour in between is valid.
const palette = [
  [0, '#12203f', '#03071a', .045],
  [4.4, '#1b2c4b', '#060e26', .06],
  [5.6, '#e8b0a0', '#5470ae', .38],
  [7.2, '#dcccb8', '#5b88c6', .72],
  [8.5, '#c3dfdf', '#609bd0', .86],
  [12.5, '#b8d4d6', '#296bad', 1],
  [15.5, '#dfd8b4', '#4d89b4', .90],
  [18.2, '#f4a46d', '#776a9c', .55],
  [19.6, '#9a7d9e', '#2a3757', .18],
  [20.8, '#2e3757', '#0b1132', .07],
  [24, '#12203f', '#03071a', .045],
].map(([hour,horizon,zenith,light])=>({hour,horizon:new T.Color(horizon),zenith:new T.Color(zenith),light}));

// label, light, cloudCutoff (lower = more cover), fog, waves, rain, wind, haze
export const weathers = {
  clear: ['Clear', 1, .52, .0012, 1, 0, .14, 0],
  cloudy: ['Overcast', .60, .22, .0022, 1.35, 0, .30, .18],
  mist: ['Sea mist', .70, .40, .0110, .65, 0, .08, .85],
  rain: ['Rain', .43, .18, .0042, 1.8, 1, .45, .42],
  storm: ['Storm', .24, .12, .0075, 2.5, 1.5, .95, .60],
};
export const skinTones = ['#f2d3b1','#d7a477','#b77c55','#925b3e','#683e2d','#40271f'];

// Which weather can follow which, and how likely, while the automatic mode is running. Weather that
// arrives out of nowhere reads as a settings toggle, so nothing here jumps from clear to storm — it
// has to build through cloud and rain first, and it has to unwind the same way.
const weatherFlow = {
  clear: [['clear',.34],['cloudy',.46],['mist',.20]],
  cloudy: [['cloudy',.24],['clear',.26],['rain',.36],['mist',.14]],
  mist: [['mist',.24],['clear',.44],['cloudy',.32]],
  rain: [['rain',.24],['cloudy',.36],['storm',.28],['mist',.12]],
  storm: [['storm',.24],['rain',.58],['cloudy',.18]],
};
// A hand-picked preset should land while you are still looking at the menu; an automatic change has
// all the time in the world and settles over roughly half a minute.
const MANUAL_RATE=.85,AUTO_RATE=.085;

const RAIN_SEGMENTS=3000,RAIN_SPAN=78,RAIN_HEIGHT=52;
const lerp=T.MathUtils.lerp;

// One fixed GPU rain pool follows the camera; changing presets allocates no geometry.
export class Environment {
  constructor(scene){
    this.targetWeather='clear';this.hour=times.day[1];this.light=1;this.rainLevel=0;this.weatherDensity=1;
    this.cycleSpeed=0;this.flash=0;this.strikeTimer=6;this.strikeBurst=0;this.strikeDistance=1;this.thunderTimer=-1;
    this.auto=false;this.autoTimer=0;this.rate=MANUAL_RATE;this.audioTimer=0;
    // Wind is a bearing as well as a speed. It steers the cloud field, the rain, the chop and the
    // whitecaps together, and it swings slowly instead of holding one direction for the whole dive.
    this.windPhase=1.9;this.windDirection=new T.Vector2(.927,.375);this.cloudDrift=0;this.windSpeed=.14;
    this.chance=seededRandom(20260912);
    // Live weather state, crossfaded as a whole so fog, wind, waves and cover never step.
    this.state=weathers.clear.slice(1).map(Number);
    const random=seededRandom(712),positions=new Float32Array(RAIN_SEGMENTS*6),tips=new Float32Array(RAIN_SEGMENTS*2);
    for(let i=0;i<RAIN_SEGMENTS;i++){const x=(random()-.5)*RAIN_SPAN,y=random()*RAIN_HEIGHT,z=(random()-.5)*RAIN_SPAN;positions.set([x,y,z,x,y,z],i*6);tips[i*2+1]=1;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('aTip',new T.BufferAttribute(tips,1));
    this.rain=new T.LineSegments(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
      uTime:time,uOpacity:{value:0},uWind:{value:.14},uWindDir:{value:new T.Vector2(.927,.375)},uLength:{value:.85},uSpeed:{value:19},uBase:{value:0},uSea:{value:SEA_LEVEL},
    },vertexShader:`uniform float uTime;uniform float uWind;uniform vec2 uWindDir;uniform float uLength;uniform float uSpeed;uniform float uBase;uniform float uSea;
attribute float aTip;varying float vFade;
void main(){
  vec3 p=position;
  float head=mod(position.y-uTime*uSpeed,${RAIN_HEIGHT}.)-${(RAIN_HEIGHT*.28).toFixed(1)};
  p.y=head-aTip*uLength;
  // The wind carries the whole column along its bearing. Wrapping that drift the same way the fall
  // already wraps is what keeps the pool centred on the diver: an unwrapped drift walked every
  // streak clean out of the box after a minute or two of wind, and the rain simply stopped.
  vec2 drift=uWindDir*(uTime*uWind*2.6);
  p.x=mod(p.x+drift.x+sin(uTime*.4+position.z*.05)*1.6+${(RAIN_SPAN*.5).toFixed(1)},${RAIN_SPAN}.)-${(RAIN_SPAN*.5).toFixed(1)};
  p.z=mod(p.z+drift.y+cos(uTime*.33+position.x*.05)*1.1+${(RAIN_SPAN*.5).toFixed(1)},${RAIN_SPAN}.)-${(RAIN_SPAN*.5).toFixed(1)};
  // Applied after the wrap so the two ends of a streak can never land on opposite sides of it.
  p.x+=aTip*uWind*uWindDir.x*1.7;
  p.z+=aTip*uWind*uWindDir.y*1.7;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  // Cut the column at the water line and ease it in past the near plane so streaks never pop.
  vFade=smoothstep(-.3,2.4,uBase+p.y-uSea)*smoothstep(1.2,5.,-mv.z)*(1.-smoothstep(${(RAIN_SPAN*.42).toFixed(1)},${(RAIN_SPAN*.6).toFixed(1)},-mv.z));
  gl_Position=projectionMatrix*mv;
}`,fragmentShader:`uniform float uOpacity;varying float vFade;void main(){float a=uOpacity*vFade;if(a<=.002)discard;gl_FragColor=vec4(.66,.81,.91,a);}`}));
    this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    this.horizon=new T.Color();this.zenith=new T.Color();this.water=new T.Color();this.tint=new T.Color();
    this.direction=new T.Vector3();this.moonDirection=new T.Vector3();this.sunColor=new T.Color();this.sample={horizon:new T.Color(),zenith:new T.Color(),light:1};
  }
  get weather(){return this.targetWeather;}
  set weather(key){this.setWeather(key);}
  setWeather(key,rate=MANUAL_RATE){if(!weathers[key])return;this.targetWeather=key;this.rate=rate;}
  // Automatic weather walks the transition table on a slow clock. A state it re-picks simply gets a
  // longer run, which is what gives a settled afternoon of clear sky between the fronts.
  rollWeather(){
    const options=weatherFlow[this.targetWeather]||weatherFlow.clear;
    let roll=this.chance(),pick=options[options.length-1][0];
    for(const [key,weight] of options){if(roll<weight){pick=key;break;}roll-=weight;}
    const held=pick===this.targetWeather;
    this.setWeather(pick,AUTO_RATE);
    this.autoTimer=(held?120:80)+this.chance()*100;
  }
  // Nearest preset name, so callers that think in named periods still work.
  get period(){let best='day',distance=99;for(const [key,value] of Object.entries(times)){const d=Math.min(Math.abs(this.hour-value[1]),24-Math.abs(this.hour-value[1]));if(d<distance){distance=d;best=key;}}return best;}
  set period(key){if(times[key])this.hour=times[key][1];}
  setHour(hour){this.hour=((hour%24)+24)%24;}
  samplePalette(hour){
    let a=palette[0],b=palette[palette.length-1];
    for(let i=0;i<palette.length-1;i++)if(hour>=palette[i].hour&&hour<=palette[i+1].hour){a=palette[i];b=palette[i+1];break;}
    const span=Math.max(.0001,b.hour-a.hour),k=T.MathUtils.smoothstep((hour-a.hour)/span,0,1);
    this.sample.horizon.copy(a.horizon).lerp(b.horizon,k);this.sample.zenith.copy(a.zenith).lerp(b.zenith,k);this.sample.light=lerp(a.light,b.light,k);
    return this.sample;
  }
  update(game,dt,dark,u){
    if(this.cycleSpeed>0)this.hour=(this.hour+dt*this.cycleSpeed/60)%24;
    // A running clock drags the weather along with it, so a sped-up day does not sit under one sky.
    if(this.auto){this.autoTimer-=dt*(1+Math.min(6,this.cycleSpeed*.08));if(this.autoTimer<=0)this.rollWeather();}
    const target=weathers[this.targetWeather]||weathers.clear,blend=1-Math.exp(-dt*this.rate);
    for(let i=0;i<this.state.length;i++)this.state[i]=lerp(this.state[i],Number(target[i+1]),blend);
    const [wLight,wCloud,wFog,wWaves,wRain,wWind,wHaze]=this.state;
    const sky=this.samplePalette(this.hour),fast=1-Math.exp(-dt*3);

    // The bearing wanders on its own slow loop; the cloud field scrolls on an accumulated drift so
    // that changing wind changes cloud speed without the whole sky jumping to a new position.
    this.windPhase+=dt*.011;
    const bearing=this.windPhase+Math.sin(this.windPhase*2.3)*.85;
    this.windDirection.set(Math.cos(bearing),Math.sin(bearing));
    this.windSpeed=wWind;this.cloudDrift+=dt*(.0022+wWind*.0108);

    // Sun and moon ride a real arc, so low light and long shadows happen on their own.
    const angle=(this.hour-12)/12*Math.PI,moonAngle=angle+Math.PI+.35;
    this.direction.set(-Math.sin(angle)*.95,Math.cos(angle)*.92,-.42).normalize();
    this.moonDirection.set(-Math.sin(moonAngle)*.93,Math.cos(moonAngle)*.88,.36).normalize();
    const elevation=this.direction.y,night=1-T.MathUtils.smoothstep(elevation,-.13,.06);

    this.light=lerp(this.light,sky.light*wLight,fast);
    waveStrength.value=lerp(waveStrength.value,wWaves,fast);

    const uniforms=game.world.surfaceWorld.uniforms;
    this.horizon.copy(sky.horizon);this.zenith.copy(sky.zenith);this.tint.set('#627582').multiplyScalar(lerp(1,.14,night));
    this.horizon.lerp(this.tint,(1-wLight)*.5);this.zenith.lerp(this.tint,(1-wLight)*.6);
    uniforms.uHorizon.value.lerp(this.horizon,fast);uniforms.uZenith.value.lerp(this.zenith,fast);
    uniforms.uSun.value.lerp(this.direction,fast).normalize();uniforms.uMoon.value.lerp(this.moonDirection,fast).normalize();
    uniforms.uNight.value=lerp(uniforms.uNight.value,night,fast);
    uniforms.uLight.value=this.light;uniforms.uCloud.value=wCloud;uniforms.uHaze.value=wHaze;
    uniforms.uWind.value=lerp(uniforms.uWind.value,wWind,fast);
    uniforms.uWindDir.value.copy(this.windDirection);uniforms.uCloudDrift.value=this.cloudDrift;

    // Storms build a charge, then discharge as a short double flash. Keying off the blended rain
    // rather than the preset name means the lightning fades in with the front instead of switching
    // on the instant the menu changes. Each strike gets a distance, which sets how hard it flashes
    // and how long the thunder takes to arrive.
    this.strikeTimer-=dt;
    // Gated on the blended weather rather than on the visible rain pool, which the depth fade zeroes
    // out: the storm is still overhead when you are twenty metres down, and you should see it.
    if(wRain>1.15&&this.strikeTimer<=0){
      this.strikeTimer=2.4+this.chance()*7;this.strikeBurst=this.chance()<.55?2:1;
      this.strikeDistance=.3+this.chance()*this.chance()*3.6;this.thunderTimer=.2+this.strikeDistance*2.4;
    }
    if(this.thunderTimer>0){this.thunderTimer-=dt;if(this.thunderTimer<=0)game.audio?.thunder(this.strikeDistance);}
    const reach=1/(1+this.strikeDistance*.85);
    if(this.strikeBurst>0&&this.flash<.05){this.flash=(this.strikeBurst===2?1:.55)*reach;this.strikeBurst--;}
    this.flash=Math.max(0,this.flash-dt*(this.flash>.5?7:3.6));
    // Lightning still reads from below the surface, just muted by the water above it.
    const flash=this.flash*this.flash*(1-u*.58);
    uniforms.uFlash.value=flash;

    const lit=uniforms.uNight.value;game.effects.plankton.material.uniforms.uNight.value=lit;
    game.sun.position.copy(uniforms.uSun.value).multiplyScalar(100);
    this.sunColor.copy(sky.horizon).lerp(this.tint.set('#fff3da'),.4).lerp(this.tint.set('#8daaff'),lit);
    game.sun.color.copy(this.sunColor);

    this.water.set('#238d99').multiplyScalar(.15+this.light*.85).lerp(this.tint.set('#020d25'),dark).lerp(uniforms.uHorizon.value,1-u);
    uniforms.uUnderColor.value.copy(this.water);game.scene.background.copy(this.water);game.scene.fog.color.copy(this.water);
    // A rough surface stirs the shallows, so heavy weather costs you visibility underwater too.
    const turbidity=Math.max(0,wWaves-1)*.0018*(1-dark);
    game.scene.fog.density=lerp(wFog,.011+dark*.026+turbidity,u);

    const skyLight=(1-dark*.93);
    game.hemi.intensity=(.16+2.44*this.light+lit*.20)*skyLight+flash*1.6;
    game.sun.intensity=3.6*this.light*(1-dark*.98)+flash*2.4;
    game.fill.color.set(lit>.5?'#3d90bd':'#6bb5d7');game.fill.intensity=(.08+.57*this.light+lit*.12)*(1-dark*.96);
    game.effects.setRayOpacity((1-dark*.96)*u*this.light*Math.max(0,elevation+.1));
    game.effects.setFlash(flash);
    // The underwater sun disc tracks the real sun instead of sitting at a fixed point.
    const sprite=game.effects.sunSprite;
    sprite.position.copy(game.camera.position).addScaledVector(uniforms.uSun.value,110);sprite.position.y=Math.max(SEA_LEVEL+8,sprite.position.y);
    sprite.material.opacity=this.light*T.MathUtils.smoothstep(elevation,-.05,.15);sprite.material.color.copy(game.sun.color);

    const rainTarget=wRain*(1-u)*this.weatherDensity;this.rainLevel=lerp(this.rainLevel,rainTarget,1-Math.exp(-dt*1.8));
    uniforms.uRain.value=Math.min(1,this.rainLevel*.8);
    this.rain.position.copy(game.camera.position);this.rain.visible=this.rainLevel>.002;
    const material=this.rain.material.uniforms;
    material.uBase.value=this.rain.position.y;
    const density=game.particleDensity==='low'?.35:game.particleDensity==='medium'?.65:1;
    this.rain.geometry.setDrawRange(0,Math.floor(RAIN_SEGMENTS*density*Math.min(1,this.weatherDensity))*2);
    // Without the flash term a night storm's rain was almost invisible; now every strike lights it.
    material.uOpacity.value=Math.min(1,this.rainLevel)*(.14+.22*this.light+flash*.55);
    material.uWind.value=lerp(material.uWind.value,wWind,fast);
    material.uWindDir.value.copy(this.windDirection);
    material.uLength.value=lerp(material.uLength.value,.7+wWind*.9,fast);
    material.uSpeed.value=lerp(material.uSpeed.value,17+wWind*16,fast);

    // Rain and wind are loud at the surface and nearly gone a few metres down. Retargeting the web
    // audio ramps a handful of times a second is plenty — they smooth themselves out from there.
    this.audioTimer-=dt;
    if(this.audioTimer<=0){this.audioTimer=.25;game.audio?.setWeather(wRain,wWind,u<.4);}
  }
}
