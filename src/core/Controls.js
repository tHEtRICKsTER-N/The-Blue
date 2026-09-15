export const CONTROL_STORAGE_KEY='abyss-controls';
/** @type {Array<[string,string,string,string[]]>} */
export const actions=[
  ['forward','Swim forward','dive',['KeyW','']],['backward','Swim backward','dive',['KeyS','']],
  ['left','Swim left','dive',['KeyA','']],['right','Swim right','dive',['KeyD','']],
  ['ascend','Swim up','dive',['Space','']],['descend','Dive down','dive',['KeyC','ControlLeft']],
  ['boost','Glide faster (hold)','dive',['ShiftLeft','']],['flashlight','Toggle flashlight','dive',['KeyF','']],
  ['camera','Switch camera','dive',['KeyV','']],
  ['photoLeft','Aim left','photo',['ArrowLeft','']],['photoRight','Aim right','photo',['ArrowRight','']],
  ['photoUp','Aim up','photo',['ArrowUp','']],['photoDown','Aim down','photo',['ArrowDown','']],
  ['capture','Take photo','photo',['KeyK','']],
  ['lookLeft','Look left','dive',['ArrowLeft','']],['lookRight','Look right','dive',['ArrowRight','']],
  ['lookUp','Look up','dive',['ArrowUp','']],['lookDown','Look down','dive',['ArrowDown','']],
];
export const canonicalKey=code=>code==='ShiftRight'?'ShiftLeft':code==='ControlRight'?'ControlLeft':code;
export const validKey=code=>typeof code==='string'&&/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|ShiftLeft|ControlLeft|Arrow(Up|Down|Left|Right)|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(code);
export function keyLabel(code){return ({Space:'Space',ShiftLeft:'Shift',ControlLeft:'Ctrl',ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→',Comma:',',Period:'.',Slash:'/',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'\\',Minus:'−',Equal:'='})[code]||code?.replace(/^Key|^Digit/,'').replace(/^Numpad/,'Num ')||'Unassigned';}
export function defaultControls(){return {sensitivity:1,invertY:false,reducedMotion:false,bindings:Object.fromEntries(actions.map(([id,,,keys])=>[id,[...keys]]))};}
export function normalizeControls(value,preferReducedMotion=false){
  const result=defaultControls();result.reducedMotion=!!preferReducedMotion;
  if(!value||typeof value!=='object')return result;
  if(typeof value.sensitivity==='number'&&Number.isFinite(value.sensitivity))result.sensitivity=Math.max(.2,Math.min(3,value.sensitivity));
  for(const key of ['invertY','reducedMotion'])if(typeof value[key]==='boolean')result[key]=value[key];
  // Old saved maps predate keyboard look. Preserve every old binding, then choose
  // unused keys for the newly introduced actions. Partial/damaged maps still fail closed.
  const legacyLook=actions.filter(([id])=>id.startsWith('look')).every(([id])=>value.bindings?.[id]===undefined);
  const seen={dive:new Set(),photo:new Set()},candidate={};
  for(const [id,,group] of actions){
    let keys=value.bindings?.[id];
    if(legacyLook&&id.startsWith('look')){
      const preferred=result.bindings[id][0];
      const available=[preferred,...'IJKLUOPBNMABCDEFGHQRSTVWXYZ0123456789'.split('').map(c=>/\d/.test(c)?'Digit'+c:'Key'+c)];
      keys=[available.find(code=>!seen.dive.has(code)), ''];
    }
    if(!Array.isArray(keys)||keys.length!==2||!keys[0])return result;
    candidate[id]=keys.map(canonicalKey);
    for(const code of candidate[id]){if(code==='')continue;if(!validKey(code)||seen[group].has(code))return result;seen[group].add(code);}
  }
  result.bindings=candidate;return result;
}
export function rebindControl(settings,id,slot,code){
  const action=actions.find(a=>a[0]===id);code=canonicalKey(code);
  if(!action||![0,1].includes(slot)||(!code&&slot===0)||(code&&!validKey(code)))throw new Error('Choose a letter, number, arrow, Space, Shift, Ctrl or punctuation key.');
  for(const [other,label,group] of actions)if(group===action[2]&&code&&settings.bindings[other].some((key,index)=>key===code&&(other!==id||index!==slot)))throw new Error(`${keyLabel(code)} is already assigned to ${label.toLowerCase()}. Change that binding first.`);
  const next={...settings,bindings:{...settings.bindings,[id]:[...settings.bindings[id]]}};next.bindings[id][slot]=code;return next;
}
export const matchesControl=(settings,id,code)=>settings.bindings[id]?.includes(canonicalKey(code))??false;
export const heldControl=(settings,id,keys)=>settings.bindings[id]?.some(code=>code&&keys.has(code))??false;
export const bindingLabel=(settings,id)=>settings.bindings[id].filter(Boolean).map(keyLabel).join(' / ');
export function loadControls(storage,preferReducedMotion=false){try{return {settings:normalizeControls(JSON.parse(storage.getItem(CONTROL_STORAGE_KEY)),preferReducedMotion),saved:true};}catch{return {settings:normalizeControls(null,preferReducedMotion),saved:false};}}
export function saveControls(storage,settings){try{storage.setItem(CONTROL_STORAGE_KEY,JSON.stringify(settings));return true;}catch{return false;}}
