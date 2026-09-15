import { times, weathers, skinTones } from '../world/Environment.js';
export const PREFERENCE_KEY='abyss-player-preferences';
export const defaultPreferences=()=>({cameraMode:'fps',character:'male',skin:skinTones[2],muted:false,radioEnabled:true,weather:'clear',period:'day',hour:12.5,cycleSpeed:0,guidance:false,flashlight:false,photoAspect:'original',photoGrid:true,photoFov:68});
export function normalizePreferences(value){
  const result=defaultPreferences();if(!value||typeof value!=='object')return result;
  const choices={cameraMode:['fps','tps'],character:['male','female'],skin:skinTones,weather:['auto',...Object.keys(weathers)],period:['custom',...Object.keys(times)],photoAspect:['original','wide','square']};
  for(const [key,allowed] of Object.entries(choices))if(allowed.includes(value[key]))result[key]=value[key];
  for(const key of ['muted','radioEnabled','guidance','flashlight','photoGrid'])if(typeof value[key]==='boolean')result[key]=value[key];
  for(const [key,min,max] of [['hour',0,23.95],['cycleSpeed',0,60],['photoFov',25,100]])if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.max(min,Math.min(max,value[key]));
  if(result.period!=='custom')result.hour=times[result.period][1];
  return result;
}
export function loadPreferences(storage){try{return {settings:normalizePreferences(JSON.parse(storage.getItem(PREFERENCE_KEY))),saved:true};}catch{return {settings:defaultPreferences(),saved:false};}}
export function savePreferences(storage,value){try{storage.setItem(PREFERENCE_KEY,JSON.stringify(normalizePreferences(value)));return true;}catch{return false;}}
export function restorePreferences(game,value){
  const p=normalizePreferences(value);game.setCameraMode(p.cameraMode);game.setAppearance(p.character,p.skin);
  game.setMuted(p.muted);game.setDialogueEnabled(p.radioEnabled);game.setWeather(p.weather);
  if(p.period==='custom')game.setHour(p.hour);else game.setTime(p.period);
  game.setCycleSpeed(p.cycleSpeed);game.setGuidance(p.guidance);game.setFlashlight(p.flashlight);
}
export function loadGraphics(storage,defaults,presets){
  try{
    const value=JSON.parse(storage.getItem('abyss-graphics'));const settings={...defaults};
    const ranges={renderScale:[.5,2],bloomStrength:[0,.8],distortion:[0,1],sharpness:[0,1],vignette:[0,1.5],aberration:[0,1],weatherDensity:[.2,1],fov:[60,95],starSize:[.6,1.8]};
    const enums={waterDetail:['low','medium','high'],particleDensity:['low','medium','high'],viewDistance:['low','medium','high','ultra'],antialiasing:['off','fxaa','smaa','msaa2','msaa4','msaa8']};
    for(const key of Object.keys(defaults)){const v=value?.settings?.[key];if(ranges[key]&&typeof v==='number'&&Number.isFinite(v))settings[key]=Math.max(ranges[key][0],Math.min(ranges[key][1],v));else if(enums[key]?.includes(v))settings[key]=v;else if(typeof defaults[key]==='boolean'&&typeof v==='boolean')settings[key]=v;}
    const preset=Object.keys(presets).find(name=>Object.keys(settings).every(key=>presets[name][key]===settings[key]))||'custom';
    return {settings,preset,saved:true};
  }catch{return {settings:{...defaults},preset:'high',saved:false};}
}
