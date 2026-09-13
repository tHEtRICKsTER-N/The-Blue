import * as T from 'three';
import { time, waveStrength, seededRandom, SEA_LEVEL } from './materials.js';
import { SUN_POWER, CLOUD_HEIGHT } from './SkyModel.js';

// Named anchors on a continuous 24 hour clock. The sky itself is no longer a palette: it comes out of
// the scattering model, so every hour in between — and every weather on top of it — is simply valid.
export const times = {
  dawn: ['Dawn', 5.6],
  morning: ['Morning', 8.5],
  day: ['Day', 12.5],
  afternoon: ['Afternoon', 15.5],
  evening: ['Evening', 18.2],
  dusk: ['Dusk', 19.6],
  night: ['Night', 23.5],
};

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
const LUNAR_MONTH=29.53;

const RAIN_SEGMENTS=3000,RAIN_SPAN=78,RAIN_HEIGHT=52;
const lerp=T.MathUtils.lerp,smoothstep=T.MathUtils.smoothstep,clamp=T.MathUtils.clamp;
const luma=c=>c.r*.2126+c.g*.7152+c.b*.0722;

// The sun's path for an hour. Kept as one function because the star field's rotation axis is derived
// from it: the stars wheel about the same pole the sun circles, so they rise and set with it.
function sunPath(hour,out){const a=(hour-12)/12*Math.PI;return out.set(-Math.sin(a)*.95,Math.cos(a)*.92,-.42).normalize();}

// One fixed GPU rain pool follows the camera; changing presets allocates no geometry.
export class Environment {
  constructor(scene){
    this.targetWeather='clear';this.hour=times.day[1];this.light=1;this.rainLevel=0;this.weatherDensity=1;
    this.cycleSpeed=0;this.flash=0;this.strikeTimer=6;this.strikeBurst=0;this.strikeDistance=1;this.thunderTimer=-1;
    this.auto=false;this.autoTimer=0;this.rate=MANUAL_RATE;this.audioTimer=0;this.day=0;
    // Wind is a bearing as well as a speed. It steers the cloud field, the rain, the chop and the
    // whitecaps together, and it swings slowly instead of holding one direction for the whole dive.
    this.windPhase=1.9;this.windDirection=new T.Vector2(.927,.375);this.cloudDrift=0;this.windSpeed=.14;
    this.chance=seededRandom(20260912);
    // Lightning: where the last strike landed, and the bolt's own short life.
    this.strikeBearing=new T.Vector3(1,0,0);this.strikeElevation=.08;this.strikeSeed=0;this.bolt=0;this.boltPending=false;
    // Live weather state, crossfaded as a whole so fog, wind, waves and cover never step.
    this.state=weathers.clear.slice(1).map(Number);
    const random=seededRandom(712),positions=new Float32Array(RAIN_SEGMENTS*6),tips=new Float32Array(RAIN_SEGMENTS*2);
    for(let i=0;i<RAIN_SEGMENTS;i++){const x=(random()-.5)*RAIN_SPAN,y=random()*RAIN_HEIGHT,z=(random()-.5)*RAIN_SPAN;positions.set([x,y,z,x,y,z],i*6);tips[i*2+1]=1;}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('aTip',new T.BufferAttribute(tips,1));
    this.rain=new T.LineSegments(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
      uTime:time,uOpacity:{value:0},uWind:{value:.14},uWindDir:{value:new T.Vector2(.927,.375)},uLength:{value:.85},uSpeed:{value:19},uBase:{value:0},uSea:{value:SEA_LEVEL},uTint:{value:new T.Color(.66,.81,.91)},
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
}`,fragmentShader:`uniform float uOpacity;uniform vec3 uTint;varying float vFade;void main(){float a=uOpacity*vFade;if(a<=.002)discard;gl_FragColor=vec4(uTint,a);}`}));
    this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    this.water=new T.Color();this.tint=new T.Color();
    this.direction=new T.Vector3();this.moonDirection=new T.Vector3();this.sunColor=new T.Color();this.up=new T.Vector3(0,1,0);
    // The atmosphere's working values, reused every frame.
    this.transmit=new T.Color();this.cloudTransmit=new T.Color();this.zenith=new T.Color();this.veilColor=new T.Color();this.probe=new T.Color();this.noonZenith=0;
    this.nightHorizon=new T.Color(.0026,.0040,.0078);this.nightZenith=new T.Color(.0008,.0015,.0040);
    this.skyState={sun:null,moon:null,sunPower:SUN_POWER,moonPower:0,haze:0,veil:0,veilColor:this.veilColor,nightHorizon:this.nightHorizon,nightZenith:this.nightZenith};
    // The celestial pole the sun circles, and the rotation that carries the stars around it.
    const noon=sunPath(12,new T.Vector3()),evening=sunPath(18,new T.Vector3());
    this.pole=new T.Vector3().crossVectors(noon,evening).normalize();
    this.starTurn=new T.Quaternion();this.starMatrix=new T.Matrix4();
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
  update(game,dt,dark,u){
    if(this.cycleSpeed>0){const before=this.hour;this.hour=(this.hour+dt*this.cycleSpeed/60)%24;if(this.hour<before)this.day++;}
    // A running clock drags the weather along with it, so a sped-up day does not sit under one sky.
    if(this.auto){this.autoTimer-=dt*(1+Math.min(6,this.cycleSpeed*.08));if(this.autoTimer<=0)this.rollWeather();}
    const target=weathers[this.targetWeather]||weathers.clear,blend=1-Math.exp(-dt*this.rate);
    for(let i=0;i<this.state.length;i++)this.state[i]=lerp(this.state[i],Number(target[i+1]),blend);
    const [wLight,wCloud,wFog,wWaves,wRain,wWind,wHaze]=this.state;
    const fast=1-Math.exp(-dt*3);

    // The bearing wanders on its own slow loop; the cloud field scrolls on an accumulated drift so
    // that changing wind changes cloud speed without the whole sky jumping to a new position.
    this.windPhase+=dt*.011;
    const bearing=this.windPhase+Math.sin(this.windPhase*2.3)*.85;
    this.windDirection.set(Math.cos(bearing),Math.sin(bearing));
    this.windSpeed=wWind;this.cloudDrift+=dt*(.0022+wWind*.0108);

    // Sun and moon ride a real arc. The moon slips about twelve degrees a day against the sun, so
    // with the clock running it waxes and wanes through a full month of phases.
    const angle=(this.hour-12)/12*Math.PI,moonAngle=angle+Math.PI+.35+this.day/LUNAR_MONTH*Math.PI*2;
    sunPath(this.hour,this.direction);
    this.moonDirection.set(-Math.sin(moonAngle)*.93,Math.cos(moonAngle)*.88,.36).normalize();

    const uniforms=game.world.surfaceWorld.uniforms,model=game.world.surfaceWorld.model;
    uniforms.uSun.value.lerp(this.direction,fast).normalize();uniforms.uMoon.value.lerp(this.moonDirection,fast).normalize();
    const sun=uniforms.uSun.value,moon=uniforms.uMoon.value,elevation=sun.y;
    // Night proper — stars, bioluminescence, moonlit colour — waits until the sun is well down, so
    // the afterglow of a sunset is not already dotted with glowing plankton.
    const night=1-smoothstep(elevation,-.2,-.02);
    uniforms.uNight.value=lerp(uniforms.uNight.value,night,fast);

    // Daylight is what actually survives the trip through the air, not a hand-drawn curve: the sun
    // yellows, then oranges, then dims as its path through the atmosphere lengthens.
    model.transmittance(sun,this.transmit);
    const daylight=smoothstep(elevation,-.1,.28)*clamp(luma(this.transmit)*1.15,0,1);
    const moonFull=(1-sun.dot(moon))*.5,moonUp=smoothstep(moon.y,-.04,.12),moonlight=moonFull*moonUp;
    this.light=lerp(this.light,Math.max(daylight,.045+moonlight*.035)*wLight,fast);
    waveStrength.value=lerp(waveStrength.value,wWaves,fast);

    // Weather lays a veil over the clear sky — a flat, luminous grey whose brightness follows the
    // light it is diffusing — and thickens the haze the scattering model sees.
    // Exposure. The physical sky at civil twilight is a sixth as bright as noon and drops towards
    // black within minutes; eyes and cameras adapt. Scaling the sky's power by how far the zenith has
    // fallen from noon — softened, and capped — keeps dusk dark but lifts it into a real blue hour.
    if(!this.noonZenith)this.noonZenith=luma(model.scatter(this.up,sunPath(12,new T.Vector3()),1,0,this.probe,8));
    const raw=luma(model.scatter(this.up,sun,1,0,this.probe,8));
    const exposure=clamp(Math.pow(this.noonZenith/Math.max(raw,1e-7),.62),1,9);
    const veil=clamp((1-wLight)*.62+wHaze*.22,0,.85);
    // Thick weather lets less light through the veil, not just flatter light: a storm sky is dark.
    const diffuse=daylight*(.18+1.07*wLight)+moonlight*.012+.0035;
    this.veilColor.setRGB(.54*diffuse,.59*diffuse,.64*diffuse);
    const state=this.skyState;
    // A light below the horizon contributes nothing, and must not: its table stops refreshing there,
    // and a stale sunset multiplied back in would glow all night.
    state.sun=sun;state.moon=moon;state.sunPower=sun.y>-.35?SUN_POWER*exposure:0;state.moonPower=moon.y>-.2?SUN_POWER*.012*moonFull:0;
    state.haze=wHaze*.6+(1-wLight)*.25;state.veil=veil;
    const horizon=model.update(state);
    model.sky(this.up,state,this.zenith);
    uniforms.uHorizon.value.copy(horizon);uniforms.uZenith.value.copy(this.zenith);
    uniforms.uSunPower.value=state.sunPower;uniforms.uMoonPower.value=state.moonPower;
    uniforms.uVeil.value=veil;uniforms.uVeilColor.value.copy(this.veilColor);
    uniforms.uNightHorizon.value.copy(this.nightHorizon);uniforms.uNightZenith.value.copy(this.nightZenith);

    // Cloud lighting. Sunlit tops take the transmitted sun; bellies take the sky; storms thicken the
    // deck so less of the sun gets through. The moon lights the clouds faintly on clear nights.
    const sunVisible=smoothstep(elevation,-.03,.03)*(1-veil*.9);
    uniforms.uSunColor.value.copy(this.transmit);uniforms.uSunVisible.value=sunVisible;
    // Clouds sit 1.8 km up, so they take the light that reaches that height and keep catching the
    // sun after it has set at sea level — the moment sunset clouds light up from underneath.
    model.transmittance(sun,this.cloudTransmit,CLOUD_HEIGHT);
    // How much direct sun reaches the tops of the deck falls away fast as the weather thickens: under
    // a storm the visible cloud is lit almost entirely by the grey light around it.
    uniforms.uCloudSun.value.copy(this.cloudTransmit).multiplyScalar(1.7*Math.min(exposure,5)*(wLight*wLight*.85+wLight*.15));
    uniforms.uAmbient.value.copy(this.zenith).multiplyScalar(1.1).add(this.tint.copy(horizon).multiplyScalar(.5)).multiplyScalar(.35+.65*wLight);
    uniforms.uCloudMoon.value.setRGB(.16,.19,.26).multiplyScalar(moonlight*.35*(1-veil*.7)*(1-daylight));
    uniforms.uCloudTint.value.copy(uniforms.uCloudSun.value).multiplyScalar(.55).add(this.tint.copy(uniforms.uAmbient.value).multiplyScalar(.9));
    uniforms.uCloudCover.value=clamp((.62-wCloud)/.5,0,1);
    uniforms.uCloudThickness.value=lerp(5.5,1,wLight);
    uniforms.uCirrus.value=smoothstep(wCloud,.3,.52)*.9;
    uniforms.uLight.value=this.light;uniforms.uCloud.value=wCloud;uniforms.uHaze.value=wHaze;
    uniforms.uWind.value=lerp(uniforms.uWind.value,wWind,fast);
    uniforms.uWindDir.value.copy(this.windDirection);uniforms.uCloudDrift.value=this.cloudDrift;

    // Night sky: the stars wheel about the pole with the clock, and fade under cloud and haze.
    const stars=game.world.surfaceWorld.stars;
    this.starTurn.setFromAxisAngle(this.pole,angle);stars.quaternion.copy(this.starTurn);
    uniforms.uStarRotation.value.setFromMatrix4(this.starMatrix.makeRotationFromQuaternion(this.starTurn));
    uniforms.uStarVisibility.value=night*(1-veil);
    uniforms.uMoonGlow.value=moonlight*(1-veil*.8)*(1-daylight);

    // A rainbow needs rain in the air and a low sun behind you: it shows while a shower is arriving
    // or clearing, never in the thick of it, and only when the sun is under about 40 degrees.
    const rainbow=smoothstep(wRain,.12,.45)*(1-smoothstep(wRain,.8,1.1))*smoothstep(elevation,.02,.1)*(1-smoothstep(elevation,.55,.7))*(1-u);
    uniforms.uRainbow.value=lerp(uniforms.uRainbow.value,rainbow*.9,fast);

    // Storms build a charge, then discharge as a short double flash. Gated on the blended weather
    // rather than on the visible rain pool, which the depth fade zeroes out: the storm is still
    // overhead when you are twenty metres down, and you should see it. Each strike gets a bearing and
    // a distance — the bearing places the glow in the cloud and the bolt on the horizon, the
    // distance sets how hard it flashes and how long the thunder takes to arrive.
    this.strikeTimer-=dt;
    if(wRain>1.15&&this.strikeTimer<=0){
      this.strikeTimer=2.4+this.chance()*7;this.strikeBurst=this.chance()<.55?2:1;
      this.strikeDistance=.3+this.chance()*this.chance()*3.6;this.thunderTimer=.2+this.strikeDistance*2.4;
      const heading=this.chance()*Math.PI*2;this.strikeBearing.set(Math.cos(heading),0,Math.sin(heading));
      this.strikeElevation=Math.atan(1.6/(1.5+this.strikeDistance*5));this.strikeSeed=this.chance()*97;
      this.boltPending=this.strikeDistance<2.6;
    }
    if(this.thunderTimer>0){this.thunderTimer-=dt;if(this.thunderTimer<=0)game.audio?.thunder(this.strikeDistance);}
    const reach=1/(1+this.strikeDistance*.85);
    if(this.strikeBurst>0&&this.flash<.05){
      this.flash=(this.strikeBurst===2?1:.55)*reach;this.strikeBurst--;
      if(this.boltPending){this.bolt=1;this.boltPending=false;}
    }
    this.flash=Math.max(0,this.flash-dt*(this.flash>.5?7:3.6));this.bolt=Math.max(0,this.bolt-dt*4.2);
    // Lightning still reads from below the surface, just muted by the water above it.
    const flash=this.flash*this.flash*(1-u*.58);
    uniforms.uFlash.value=flash;
    uniforms.uStrikeDir.value.copy(this.strikeBearing);uniforms.uStrikeElevation.value=this.strikeElevation;uniforms.uStrikeSeed.value=this.strikeSeed;
    // The channel flickers as it re-strikes down the same path.
    uniforms.uBolt.value=this.bolt*this.bolt*(1-u)*(.7+.3*Math.sin(time.value*90));

    const lit=uniforms.uNight.value;game.effects.plankton.material.uniforms.uNight.value=lit;
    game.sun.position.copy(sun).multiplyScalar(100);
    // Scene sunlight takes the transmitted colour, normalised, and turns moon-blue after dark.
    const peak=Math.max(this.transmit.r,this.transmit.g,this.transmit.b,1e-4);
    this.sunColor.copy(this.transmit).multiplyScalar(1/peak).lerp(this.tint.set('#8daaff'),lit);
    game.sun.color.copy(this.sunColor);

    this.water.set('#238d99').multiplyScalar(.15+this.light*.85).lerp(this.tint.set('#020d25'),dark).lerp(horizon,1-u);
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
    sprite.position.copy(game.camera.position).addScaledVector(sun,110);sprite.position.y=Math.max(SEA_LEVEL+8,sprite.position.y);
    sprite.material.opacity=this.light*smoothstep(elevation,-.05,.15);sprite.material.color.copy(game.sun.color);

    const rainTarget=wRain*(1-u)*this.weatherDensity;this.rainLevel=lerp(this.rainLevel,rainTarget,1-Math.exp(-dt*1.8));
    uniforms.uRain.value=Math.min(1,this.rainLevel*.8);
    this.rain.position.copy(game.camera.position);this.rain.visible=this.rainLevel>.002;
    const material=this.rain.material.uniforms;
    material.uBase.value=this.rain.position.y;
    const density=game.particleDensity==='low'?.35:game.particleDensity==='medium'?.65:1;
    this.rain.geometry.setDrawRange(0,Math.floor(RAIN_SEGMENTS*density*Math.min(1,this.weatherDensity))*2);
    // Rain takes the sky's colour, so it glows warm against a sunset and goes steel-blue in a storm.
    material.uTint.value.copy(horizon).multiplyScalar(1/Math.max(luma(horizon),.05)).lerp(this.tint.setRGB(.66,.81,.91),.55).multiplyScalar(clamp(luma(horizon)*1.3+.12,.12,1));
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
