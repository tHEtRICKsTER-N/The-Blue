import * as T from 'three';
import { time, waveStrength, seededRandom } from './materials.js';

export const times = {
  dawn: ['Dawn', '#e5ac9e', '#526eac', .40, .08],
  morning: ['Morning', '#c3dfdf', '#609bd0', .85, .35],
  day: ['Day', '#b8d4d6', '#296bad', 1, .75],
  afternoon: ['Afternoon', '#dfd8b4', '#4d89b4', .90, .48],
  evening: ['Evening', '#f4a46d', '#776a9c', .55, .13],
  dusk: ['Dusk', '#997b9d', '#293656', .20, .02],
  night: ['Night', '#16294a', '#03091e', .055, .42],
};
export const weathers = {
  clear: ['Clear', 1, .52, .0012, 1, 0],
  cloudy: ['Overcast', .60, .22, .002, 1.35, 0],
  mist: ['Sea mist', .70, .39, .013, .65, 0],
  rain: ['Rain', .43, .18, .004, 1.8, 1],
  storm: ['Storm', .24, .12, .007, 2.5, 1],
};
export const skinTones = ['#f2d3b1','#d7a477','#b77c55','#925b3e','#683e2d','#40271f'];

// One fixed GPU rain pool follows the camera; changing presets allocates no geometry.
export class Environment {
  constructor(scene){
    this.weather='clear';this.period='day';this.light=1;
    const random=seededRandom(712),positions=new Float32Array(1800*6);
    for(let i=0;i<1800;i++){const x=(random()-.5)*65,y=random()*40,z=(random()-.5)*65;positions.set([x,y,z,x+.14,y-.85,z],i*6);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));
    this.rain=new T.LineSegments(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:time,uOpacity:{value:.25}},vertexShader:`uniform float uTime;void main(){vec3 p=position;p.y=mod(p.y-uTime*19.,40.)-10.;p.x+=sin(uTime*.4)*2.;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uOpacity;void main(){gl_FragColor=vec4(.65,.8,.9,uOpacity);}`}));
    this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    this.horizon=new T.Color();this.zenith=new T.Color();this.water=new T.Color();this.tint=new T.Color();
  }
  update(game,dt,dark,u){
    const period=times[this.period],weather=weathers[this.weather],blend=1-Math.exp(-dt*3);
    this.light=T.MathUtils.lerp(this.light,period[3]*weather[1],blend);
    waveStrength.value=T.MathUtils.lerp(waveStrength.value,weather[4],blend);
    const uniforms=game.world.surfaceWorld.uniforms;
    this.horizon.set(period[1]);this.zenith.set(period[2]);this.tint.set('#627582');if(this.period==='night')this.tint.multiplyScalar(.12);
    this.horizon.lerp(this.tint,(1-weather[1])*.5);this.zenith.lerp(this.tint,(1-weather[1])*.6);
    uniforms.uHorizon.value.lerp(this.horizon,blend);uniforms.uZenith.value.lerp(this.zenith,blend);
    this.direction ||= new T.Vector3();
    this.direction.set(this.period==='evening'||this.period==='dusk'?-.6:.38,period[4],-.52).normalize();uniforms.uSun.value.lerp(this.direction,blend).normalize();
    uniforms.uNight.value=T.MathUtils.lerp(uniforms.uNight.value,this.period==='night'?1:this.period==='dusk'?.25:0,blend);
    const night=uniforms.uNight.value;game.effects.plankton.material.uniforms.uNight.value=night;
    uniforms.uLight.value=this.light;uniforms.uCloud.value=T.MathUtils.lerp(uniforms.uCloud.value,weather[2],blend);
    game.sun.position.copy(uniforms.uSun.value).multiplyScalar(100);game.sun.color.set(this.period==='night'?'#8daaff':period[1]);
    this.water.set('#238d99').multiplyScalar(.15+this.light*.85).lerp(this.tint.set('#020d25'),dark).lerp(uniforms.uHorizon.value,1-u);
    uniforms.uUnderColor.value.copy(this.water);game.scene.background.copy(this.water);game.scene.fog.color.copy(this.water);
    game.scene.fog.density=T.MathUtils.lerp(weather[3],.011+dark*.026,u);
    game.hemi.intensity=(.16+2.44*this.light+night*.20)*(1-dark*.93);game.sun.intensity=3.6*this.light*(1-dark*.98);game.fill.color.set(night>.5?'#3d90bd':'#6bb5d7');game.fill.intensity=(.08+.57*this.light+night*.12)*(1-dark*.96);
    game.effects.rayMaterial.uniforms.uOpacity.value=(1-dark*.96)*u*this.light;
    game.effects.sunSprite.material.opacity=this.light;game.effects.sunSprite.material.color.copy(game.sun.color);
    this.rain.position.copy(game.camera.position);this.rain.visible=!!weather[5]&&u<.05;
    this.rain.geometry.setDrawRange(0,game.quality==='low'?1200:3600);this.rain.material.uniforms.uOpacity.value=.15+.25*this.light;
  }
}
