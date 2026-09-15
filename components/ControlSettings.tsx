'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { actions, canonicalKey, defaultControls, keyLabel, rebindControl } from '@/src/core/Controls.js';

export type ControlPreferences={sensitivity:number;invertY:boolean;reducedMotion:boolean;bindings:Record<string,string[]>};
export function ControlSettings({value,onChange,saved}:{value:ControlPreferences;onChange:(next:ControlPreferences)=>void;saved:boolean}){
  const [listening,setListening]=useState<{id:string;slot:number}|null>(null),[message,setMessage]=useState('');
  useEffect(()=>{
    if(!listening)return;
    const cancel=()=>setListening(null);
    const key=(event:KeyboardEvent)=>{
      event.preventDefault();event.stopImmediatePropagation();
      if(event.code==='Escape'){cancel();setMessage('Binding change cancelled.');return;}
      if(event.repeat)return;
      const code=canonicalKey(event.code);
      if(event.metaKey||event.altKey||(event.ctrlKey&&code!=='ControlLeft')||(event.shiftKey&&code!=='ShiftLeft')){setMessage('Use a single key without a modifier combination.');return;}
      try{onChange(rebindControl(value,listening.id,listening.slot,code));cancel();setMessage('Binding updated.');}
      catch(error){setMessage(error instanceof Error?error.message:'Choose another key.');}
    };
    window.addEventListener('keydown',key,true);window.addEventListener('blur',cancel);
    return()=>{window.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);};
  },[listening,value,onChange]);
  return <div className="control-settings">
    <div className="pane-head"><h2>Controls</h2><p>Changes apply immediately and are saved on this device.</p></div>
    <div className="set-row"><div className="set-label"><span>Mouse sensitivity</span><small>Look speed while swimming</small></div><div className="set-control"><Slider className="set-slider" aria-label="Mouse sensitivity" min={.2} max={3} step={.1} value={[value.sensitivity]} onValueChange={v=>onChange({...value,sensitivity:Array.isArray(v)?v[0]:v})}/><em>{value.sensitivity.toFixed(1)}×</em></div></div>
    <div className="set-row"><div className="set-label"><span>Invert vertical look</span><small>Move the mouse up to look down</small></div><Switch aria-label="Invert vertical look" checked={value.invertY} onCheckedChange={invertY=>onChange({...value,invertY})}/></div>
    <div className="set-row"><div className="set-label"><span>Reduced camera motion</span><small>Remove idle camera sway and gentle swimming bob</small></div><Switch aria-label="Reduced camera motion" checked={value.reducedMotion} onCheckedChange={reducedMotion=>onChange({...value,reducedMotion})}/></div>
    <p className="binding-help">Select a key, then press its replacement. Esc cancels. Keys use physical keyboard positions; Ctrl and Shift work on either side. Esc always pauses or leaves photo mode.</p>
    <output className="binding-message" aria-live="polite">{!saved?'Preferences could not be saved. Your changes still apply for this visit. ':''}{message}</output>
    {listening&&<Button variant="outline" onClick={()=>{setListening(null);setMessage('Binding change cancelled.');}}>Cancel key assignment</Button>}
    {['dive','photo'].map(group=><section key={group} className="binding-group" aria-label={group==='dive'?'Dive keybindings':'Photo keybindings'}><h3>{group==='dive'?'Swimming & equipment':'Photo mode'}</h3><div className="binding-columns"><span>Action</span><span>Primary</span><span>Alternate</span></div>{actions.filter(a=>a[2]===group).map(([id,label])=><div className="binding-row" key={id as string}><span>{label as string}</span>{[0,1].map(slot=><div key={slot}><Button variant="outline" aria-label={`${label} ${slot===0?'primary':'alternate'} key`} aria-pressed={listening?.id===id&&listening.slot===slot} onClick={()=>{setListening({id:id as string,slot});setMessage('Press a replacement key, or Esc to cancel.');}}>{listening?.id===id&&listening.slot===slot?'Press a key…':keyLabel(value.bindings[id as string][slot])}</Button>{slot===1&&value.bindings[id as string][slot]&&<button className="binding-clear" aria-label={`Clear ${label} alternate key`} onClick={()=>{setListening(null);onChange(rebindControl(value,id,1,''));setMessage('Alternate binding cleared.');}}>Clear</button>}</div>)}</div>)}</section>)}
    <Button variant="outline" onClick={()=>{setListening(null);onChange(defaultControls());setMessage('Default controls restored.');}}>Restore control defaults</Button>
  </div>;
}
