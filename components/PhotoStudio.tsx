'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Download, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { matchesControl, bindingLabel } from '@/src/core/Controls.js';
import type { ControlPreferences } from './ControlSettings';
import { downloadPhoto } from '@/src/core/Photography.js';
import { PhotoAttachment, PhotoImage } from './PhotoAlbum';
import type { Photo, PhotoAlbum } from '@/hooks/use-photo-album';
import type { FieldNote } from './FieldJournal';

type PhotoPreferences={photoAspect:string;photoGrid:boolean;photoFov:number};
type Props={preferences:PhotoPreferences;onPreferences:(patch:Partial<PhotoPreferences>)=>void;controls:ControlPreferences;onClose:()=>void;capture:(aspect:string)=>Promise<Photo>;aim:(x:number,y:number)=>void;zoom:(fov:number)=>void;album:PhotoAlbum;notes:FieldNote[]};

export function PhotoStudio({preferences,onPreferences,controls,onClose,capture,aim,zoom,album,notes}:Props) {
  const [aspect,setAspect]=useState(preferences.photoAspect),[fov,setFov]=useState(preferences.photoFov),[grid,setGrid]=useState(preferences.photoGrid);
  const [shot,setShot]=useState<Photo|null>(null),[noteName,setNoteName]=useState(''),[saved,setSaved]=useState(false);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{zoom(preferences.photoFov);},[zoom,preferences.photoFov]);
  const working=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const take=useCallback(async()=>{
    if(working.current)return;working.current=true;setBusy(true);setMessage('');
    try{const next=await capture(aspect);if(mounted.current){setShot(next);setNoteName('');setSaved(false);}}
    catch(reason){if(mounted.current)setMessage(reason instanceof Error?reason.message:'The photograph could not be taken.');}
    finally{working.current=false;if(mounted.current)setBusy(false);}
  },[aspect,capture]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.metaKey||event.altKey)return;
      if(event.key==='Escape'&&document.querySelector('[role="listbox"]'))return;
      if(event.key==='Escape'){event.preventDefault();onClose();return;}
      if((event.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"],[role="option"],[role="combobox"],[role="slider"],[role="switch"],[role="listbox"]'))return;
      if(event.code==='Space'&&(event.target as HTMLElement).closest('button'))return;
      const directions:Record<string,[number,number]>={photoLeft:[-1,0],photoRight:[1,0],photoUp:[0,-1],photoDown:[0,1]};
      for(const [id,direction] of Object.entries(directions))if(matchesControl(controls,id,event.code)){event.preventDefault();aim(...direction);}
      if(matchesControl(controls,'capture',event.code)&&!event.repeat){event.preventDefault();void take();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[onClose,aim,take,controls]);
  async function save(){if(!shot||working.current)return;working.current=true;setBusy(true);setMessage('');try{await album.save({...shot,noteName});if(mounted.current){setSaved(true);setMessage('Saved to Field notes → Photos.');}}catch(reason){if(mounted.current)setMessage(reason instanceof Error?reason.message:'Saving failed. You can still download this photograph.');}finally{working.current=false;if(mounted.current)setBusy(false);}}
  return <section className="photo-studio" aria-label="Underwater photography">
    <div className="photo-title"><Camera size={20}/><h2>Photo mode</h2><span>Swimming paused</span><Button variant="outline" onClick={onClose}><X size={16}/>Back to dive menu</Button></div>
    <div className={'photo-frame photo-frame-'+aspect+(grid?' has-grid':'')} aria-hidden="true"><i/><i/><i/><i/></div>
    <div className="photo-console">
      <fieldset className="photo-frames"><legend>Frame</legend>{[['original','Original'],['wide','16:9'],['square','Square']].map(([value,label])=><Button key={value} variant="outline" aria-pressed={aspect===value} onClick={()=>{setAspect(value);onPreferences({photoAspect:value});}}>{label}</Button>)}</fieldset>
      <div className="photo-aim"><span>Aim</span><Button variant="outline" aria-label="Aim left" onClick={()=>aim(-1,0)}><ArrowLeft/></Button><Button variant="outline" aria-label="Aim up" onClick={()=>aim(0,-1)}><ArrowUp/></Button><Button variant="outline" aria-label="Aim down" onClick={()=>aim(0,1)}><ArrowDown/></Button><Button variant="outline" aria-label="Aim right" onClick={()=>aim(1,0)}><ArrowRight/></Button></div>
      <div className="photo-zoom"><span>Lens · {Math.round(fov)}°</span><Slider aria-label="Photo lens field of view" min={25} max={100} step={1} value={[fov]} onValueChange={value=>{const next=Array.isArray(value)?value[0]:value;setFov(next);zoom(next);onPreferences({photoFov:next});}}/></div>
      <label className="photo-grid-toggle" htmlFor="photo-grid">Framing grid<Switch id="photo-grid" checked={grid} onCheckedChange={value=>{setGrid(value);onPreferences({photoGrid:value});}} aria-label="Framing grid"/></label>
      <Button className="photo-shutter" disabled={busy} onClick={()=>void take()}><Camera size={18}/>{busy?'Working…':'Take photo'} <kbd>{bindingLabel(controls,'capture')}</kbd></Button>
      <p className="photo-help">{['photoLeft','photoUp','photoDown','photoRight'].map(id=>bindingLabel(controls,id)).join(' · ')} aim · {bindingLabel(controls,'capture')} captures · Esc returns. Frames and controls stay out of your photo.</p>
    </div>
    {shot&&<aside className="photo-review" aria-label="Captured photograph"><PhotoImage photo={shot}/><div><h3>{saved?'Saved photograph':'Your photograph'}</h3><p>{shot.location} · {shot.width} × {shot.height}</p><PhotoAttachment notes={notes} value={noteName} disabled={saved||busy} onChange={setNoteName}/><div className="photo-actions"><Button disabled={saved||busy} onClick={()=>void save()}>{saved?'Saved':'Save to album'}</Button><Button variant="outline" onClick={()=>downloadPhoto(shot)}><Download size={16}/>Download</Button><Button variant="ghost" disabled={busy} onClick={()=>setShot(null)}>Close preview</Button></div></div></aside>}
    {message&&<output className="photo-message">{message}</output>}
  </section>;
}
