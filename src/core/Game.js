import { recordEncounter } from './FieldNotes.js';
import { renderSpecimenPortrait } from '../creatures/SpecimenPortrait.js';
import { DiscoveryGuide } from './DiscoveryGuide.js';
import { Dialogue } from './Dialogue.js';
import * as T from 'three';
import { destinations } from '../world/ExplorationSites.js';
import { floorHeight } from '../world/materials.js';
import { Environment, times, weathers, skinTones } from '../world/Environment.js';
import { OceanWorld } from '../world/OceanWorld.js';
import { MarineLife } from '../creatures/MarineLife.js';
import { DiverController } from '../player/DiverController.js';
import { Atmosphere } from '../effects/Atmosphere.js';
import { time, depthLight, waterHeight } from '../world/materials.js';
import { AudioManager } from '../audio/AudioManager.js';
import { registerExpeditionTools } from './webmcp.js';

export class Game {
  constructor(mount,callbacks){
    this.mount=mount;this.callbacks=callbacks;this.disposed=false;this.elapsed=0;this.last=performance.now();this.readingTimer=0;this.notes=callbacks.initialNotes||[];this.encountered=new Set();this.diveId=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);this.portraits=new Map();this.discovered=new Set(this.notes.map(note=>note.name));this.guide=new DiscoveryGuide();this.discoveryQueue=[];this.discoveryDelay=0;this.quality='high';this.particleDensity='high';this.autoAdjust=false;this.fps=60;this.frames=0;this.performanceTime=0;this.dynamicScale=1;this.pixelRatio=0;
    this.graphics={renderScale:1,waterDetail:'high',particleDensity:'high',viewDistance:'high',antialiasing:'msaa4',bloom:true,bloomStrength:.30,lightShafts:true,distortion:.3,sharpness:.35,vignette:1,aberration:0,filmGrain:false,weatherDensity:1,fov:68,starSize:1,autoAdjust:false};
    this.scene=new T.Scene();this.scene.background=new T.Color('#167681');this.scene.fog=new T.FogExp2('#167681',.016);
    this.camera=new T.PerspectiveCamera(68,mount.clientWidth/mount.clientHeight,.06,5000);this.scene.add(this.camera);
    this.renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(mount.clientWidth,mount.clientHeight);this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;this.renderer.outputColorSpace=T.SRGBColorSpace;mount.appendChild(this.renderer.domElement);
    this.hemi=new T.HemisphereLight('#b3f0df','#334a4c',2.6);this.scene.add(this.hemi);
    this.sun=new T.DirectionalLight('#fff0d4',3.2);this.sun.position.set(38,58,-52);this.scene.add(this.sun);
    this.fill=new T.DirectionalLight('#6bb5d7',.65);this.fill.position.set(-20,12,25);this.scene.add(this.fill);
    this.world=new OceanWorld(this.scene);this.world.addLandmarks();this.marine=new MarineLife(this.scene,this.world.obstacles);this.effects=new Atmosphere(this.renderer,this.scene,this.camera);this.audio=new AudioManager();
    this.diver=new DiverController(this.camera,this.renderer.domElement,this.world,value=>{callbacks.onPause(value);if(value)this.audio.pause();},()=>this.toggleFlashlight(),()=>this.report());
    this.dialogue=new Dialogue(callbacks.onDialogue);this.environment=new Environment(this.scene);this.character='male';this.skin=skinTones[2];
    this.effects.setDiverAnchor(this.diver.viewAnchor);
    this.resize=()=>{const w=mount.clientWidth,h=mount.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.effects.resize(w,h);};window.addEventListener('resize',this.resize);this.setGraphicsSettings(this.graphics);
    this.contextLost=e=>{e.preventDefault();this.pause();};this.contextRestored=()=>location.reload();this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestored);
    if(import.meta.env.DEV)window.__abyssDebug=this;this.unregisterTools=registerExpeditionTools(this);this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
    requestAnimationFrame(()=>{if(!this.disposed)callbacks.onReady();});
  }
  start(){this.dialogue.trigger('welcome');this.diver.start();this.audio.start();this.audio.setMuted(!!this.muted);this.callbacks.onPause(false);}
  pause(){this.diver.pause();this.audio.pause();this.callbacks.onPause(true);}
  returnToReef(){this.diver.reset();}
  setCameraMode(mode){this.diver.setCameraMode(mode);}
  toggleCamera(){this.diver.toggleCamera();}
  toggleFlashlight(){this.effects.toggleFlashlight();this.report();}
  visitSite(name){const site=destinations.find(s=>s.name===name);if(!site)return;this.discoveryQueue=[];this.discoveryDelay=0;const d=this.diver;d.position.set(site.x,site.name==='Palm Cay Anchorage'?waterHeight(site.x,site.z+18,this.elapsed)+.35:Math.min(25,floorHeight(site.x,site.z+18)+9),site.z+18);d.velocity.set(0,0,0);d.yaw=d.targetYaw=site.name==='Palm Cay Anchorage'?Math.PI/2:0;d.pitch=d.targetPitch=-.1;d.rig.distance=0;this.camera.position.copy(d.position);this.report();}
  setDialogueEnabled(value){this.dialogue.setEnabled(value);}
  // 'auto' hands the weather to the scheduler; anything else pins it and takes the scheduler off.
  setWeather(value){
    if(value==='auto'){this.environment.auto=true;this.environment.autoTimer=0;this.report();return;}
    if(!weathers[value])return;
    this.environment.auto=false;this.environment.setWeather(value);this.report();
  }
  setTime(value){if(times[value])this.environment.period=value;}
  setHour(value){if(Number.isFinite(value))this.environment.setHour(value);}
  setCycleSpeed(value){this.environment.cycleSpeed=Math.max(0,Number(value)||0);}
  setAppearance(character,skin){if(!['male','female'].includes(character)||!skinTones.includes(skin))return;this.character=character;this.skin=skin;this.diver.avatar.setAppearance(character,skin);}
  setMuted(value){this.muted=value;this.audio?.setMuted(value);}
  setQuality(q){if(!['low','medium','high'].includes(q))return;this.setGraphicsSettings({...this.graphics,waterDetail:q,particleDensity:q,renderScale:q==='low'?.7:q==='medium'?.85:1});}
  setGraphicsSettings(settings){
    this.graphics={...this.graphics,...settings};const g=this.graphics;
    this.quality=g.waterDetail;this.particleDensity=g.particleDensity;this.autoAdjust=!!g.autoAdjust;
    this.world.stream.quality=g.waterDetail;this.world.stream.viewDistance=g.viewDistance;
    if(!g.autoAdjust)this.dynamicScale=1;
    this.applyPixelRatio();
    this.camera.fov=T.MathUtils.clamp(Number(g.fov)||68,55,100);this.camera.updateProjectionMatrix();
    this.effects.configure(g);this.effects.plankton.geometry.setDrawRange(0,g.particleDensity==='low'?900:g.particleDensity==='medium'?1700:2800);
    this.world.grass.count=g.particleDensity==='low'?450:g.particleDensity==='medium'?750:1100;this.environment.weatherDensity=g.weatherDensity;
    const stars=this.world.surfaceWorld.stars.material.uniforms;stars.uPixelRatio.value=this.pixelRatio;stars.uStarSize.value=Math.max(.5,Number(g.starSize)||1);
    this.resize();this.report();
  }
  // Render scale is a multiplier on the display's own pixel ratio, so 100% is always native.
  // Adaptive quality rides on top of it as a second multiplier rather than rewriting the settings.
  applyPixelRatio(){
    const scale=Math.max(.5,Math.min(2,Number(this.graphics.renderScale)||1))*this.dynamicScale;
    const ratio=Math.max(.4,Math.min(scale>1?3:2,devicePixelRatio*scale));
    if(ratio===this.pixelRatio)return false;
    this.pixelRatio=ratio;this.renderer.setPixelRatio(ratio);this.effects.composer.setPixelRatio(ratio);
    this.world.surfaceWorld.stars.material.uniforms.uPixelRatio.value=ratio;
    return true;
  }
  // One measured second per step, small moves, and a dead band wide enough that the scale settles
  // instead of oscillating around the target. It never climbs past the resolution the player chose.
  adapt(){
    const target=60,floor=.6;
    let next=this.dynamicScale;
    if(this.fps<target*.80)next-=.10;
    else if(this.fps<target*.93)next-=.05;
    else if(this.fps>target*1.12&&next<1)next+=.04;
    next=Math.max(floor,Math.min(1,Math.round(next*100)/100));
    if(next===this.dynamicScale)return;
    this.dynamicScale=next;if(this.applyPixelRatio())this.resize();
  }
  speciesPortrait(name){
    if(this.disposed)return null;
    if(!this.portraits.has(name))this.portraits.set(name,renderSpecimenPortrait(this.renderer,this.marine,name));
    return this.portraits.get(name);
  }
  setGuidance(active){this.guide.active=!!active;this.report();}
  discover(name,kind){
    if(this.encountered.has(name))return;
    this.encountered.add(name);
    const isNew=!this.discovered.has(name);this.discovered.add(name);
    const p=this.diver.position;
    const note={name,kind,location:this.location||this.world.stream.biomeAt(p.x,p.z),depth:Math.max(0,waterHeight(p.x,p.z,this.elapsed)-p.y),firstSeen:new Date().toISOString()};
    this.notes=recordEncounter(this.notes,note,this.diveId);this.callbacks.onNotes?.(this.notes);
    if(isNew){this.dialogue.discover(name,kind);this.discoveryQueue.push(note);}
  }
  report(){const p=this.diver.position;let closest=this.world.stream.biomeAt(p.x,p.z),distance=Infinity;for(const l of this.world.landmarks){const d=l.p.distanceTo(p);if(d<l.radius&&d<distance){closest=l.name;distance=d;}}if(p.y<-37&&distance===Infinity)closest='Twilight Depths';const surface=p.y>waterHeight(p.x,p.z,this.elapsed)-.15;if(surface&&distance===Infinity)closest='Open Ocean · Surface';this.location=closest;const buffer=this.renderer.domElement;this.callbacks.onGuide?.(this.guide.reading(p,this.world.landmarks.find(l=>l.name==='Crystal Grotto'),this.discovered.has('Crystal Grotto')));this.callbacks.onReading({depth:Math.max(0,waterHeight(p.x,p.z,this.elapsed)-p.y),heading:((T.MathUtils.radToDeg(-this.diver.yaw)%360)+360)%360,location:closest,fps:this.fps,frameTime:this.frameTime||0,resolution:`${buffer.width}×${buffer.height}`,renderScale:this.graphics.renderScale*this.dynamicScale,autoWeather:this.environment.auto,weather:this.environment.weather,wind:this.environment.windSpeed,hour:this.environment.hour,flashlight:this.effects.flashlight.intensity>0,cameraMode:this.diver.rig.mode,quality:this.quality,surface,distance:Math.hypot(p.x,p.z-26)});}
  loop(now){
    if(this.disposed)return;const realDt=(now-this.last)/1000,dt=Math.min(.05,realDt);this.last=now;const running=!this.diver.started||this.diver.active;if(running)this.elapsed+=dt;time.value=this.elapsed;
    this.world.stream.update(this.diver.position);this.diver.update(dt,this.elapsed);const p=this.diver.position;const depth=T.MathUtils.smoothstep(27-this.camera.position.y,24,105);
    const cave=Math.abs(p.x+42)<7&&p.z<-104&&p.z>-131&&p.y<-13?1:0;this.caveLight=T.MathUtils.lerp(this.caveLight||0,cave,1-Math.exp(-dt*2));const dark=Math.max(depth,this.caveLight*.9);
    const cp=this.camera.position,waterline=waterHeight(cp.x,cp.z,this.elapsed);this.underwater=1-T.MathUtils.smoothstep(cp.y-waterline,-.15,.12);
    const u=this.underwater;this.renderer.toneMappingExposure=T.MathUtils.lerp(.92,1.12,u);
    this.world.surfaceWorld.update(this.camera,u);this.world.exploration.update(this.elapsed,p,this.quality);this.world.stream.far.visible=u<.95;
    if(running){this.marine.update(dt,this.elapsed,p,this.diver.active?this.diver.velocity.length():0);this.effects.update(dt,this.elapsed,dark,this.diver.active,u);this.audio?.update(dt,dark,p.y>waterHeight(p.x,p.z,this.elapsed)-.12);}
    this.environment.update(this,dt,dark,u);depthLight.value=(1-dark)*this.environment.light;
    if(this.diver.active){if(this.guide.update(dt,p,this.world.landmarks.find(l=>l.name==='Crystal Grotto'),this.discovered.has('Crystal Grotto')))this.dialogue.trigger('grotto-clue');if(this.environment.period==='night')this.dialogue.trigger('night');if(this.underwater<.1)this.dialogue.trigger('surface');if(Math.hypot(p.x,p.z)>1000)this.dialogue.trigger('far');}this.dialogue.update(dt,this.diver.active);
    this.readingTimer+=dt;if(this.readingTimer>.35){this.readingTimer=0;this.report();if(this.diver.active){for(const l of this.world.landmarks)if(l.p.distanceTo(p)<l.radius)this.discover(l.name,'Location');if(Math.hypot(p.x,p.z)>180)this.discover(this.world.stream.biomeAt(p.x,p.z),'Habitat');if(p.y>waterHeight(p.x,p.z,this.elapsed))this.discover('Above the Blue','Location');this.marine.nearby(p).forEach(name=>this.discover(name,'Species'));}}
    this.discoveryDelay-=dt;if(this.diver.active&&this.discoveryDelay<=0&&this.discoveryQueue.length){this.callbacks.onDiscover(this.discoveryQueue.shift());this.discoveryDelay=6;}
    this.effects.render();this.frames++;this.performanceTime+=realDt;
    if(this.performanceTime>1){this.fps=Math.round(this.frames/this.performanceTime);this.frameTime=this.performanceTime*1000/this.frames;this.frames=0;this.performanceTime=0;
      if(this.autoAdjust)this.adapt();}
    this.frame=requestAnimationFrame(this.loop);
  }
  dispose(){this.disposed=true;this.unregisterTools?.();if(window.__abyssDebug===this)delete window.__abyssDebug;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);this.diver.dispose();this.audio?.dispose();this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);this.renderer.domElement.removeEventListener('webglcontextrestored',this.contextRestored);this.effects.dispose();this.world.stream.dispose();const geometries=new Set(),materials=new Set();this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m));});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.renderer.dispose();this.renderer.domElement.remove();}
}




