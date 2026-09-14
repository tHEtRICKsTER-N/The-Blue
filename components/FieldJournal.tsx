'use client';
/* oxlint-disable next/no-img-element -- These are local canvas snapshots, not network images. */

import { useEffect, useState, type ReactNode } from 'react';
import { Fish, MapPin, Waves } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { fieldGuideEntry, filterNotes, diveHistory } from '@/src/core/FieldGuide.js';

export type Encounter = {at:string|null;location:string;depth:number;diveId:string};
export type FieldNote = {name:string;kind:string;location:string;depth:number;firstSeen:string|null;encounters?:Encounter[]};
const categories = [['All','All notes'],['Species','Species'],['Location','Locations'],['Habitat','Habitats'],['History','Dive history']];
const dateLabel = (value:string|null) => value ? new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : 'Date not recorded';

function Specimen({name,renderPortrait}:{name:string;renderPortrait:(name:string)=>string|null}) {
  const [portrait,setPortrait] = useState<{name:string;url:string|null}|null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if(cancelled)return;
      return renderPortrait(name);
    }).then(url => {if(!cancelled)setPortrait({name,url:url||null});})
      .catch(() => {if(!cancelled)setPortrait({name,url:null});});
    return () => {cancelled=true;};
  },[name,renderPortrait]);
  const current = portrait?.name === name ? portrait : null;
  return <figure className="field-specimen">
    {current?.url ? <img src={current.url} alt={`${name}, as seen in ABYSS`} width={480} height={300}/> :
      <div className="field-specimen-fallback"><Fish size={36} aria-hidden="true"/><span>{current?'Specimen view unavailable':'Preparing specimen view…'}</span></div>}
    <figcaption>From your ocean · {name}</figcaption>
  </figure>;
}

function Entry({note,renderPortrait}:{note:FieldNote;renderPortrait:(name:string)=>string|null}) {
  const entry = fieldGuideEntry(note);
  return <article className="field-detail" aria-label={`${note.name} field note`}>
    {note.kind==='Species' ? <Specimen name={note.name} renderPortrait={renderPortrait}/> :
      <div className="field-place-mark">{note.kind==='Habitat'?<Waves size={32} aria-hidden="true"/>:<MapPin size={32} aria-hidden="true"/>}<span>{note.kind}</span></div>}
    <div className="field-detail-copy">
      <p className="field-kind">{note.kind}</p><h3>{note.name}</h3>
      <p className="field-observation">{entry.observation}</p>
      <dl className="field-facts">
        <div><dt>Where to look</dt><dd>{entry.habitat}</dd></div>
        <div><dt>First encounter</dt><dd>{note.location} · {Math.round(note.depth)} m<br/>{dateLabel(note.firstSeen)}</dd></div>
      </dl>
      {!!note.encounters?.length&&<details className="field-encounters"><summary>Recorded encounters ({note.encounters.length})</summary><ol>
        {[...note.encounters].reverse().map(encounter=><li key={encounter.diveId}><time dateTime={encounter.at||undefined}>{dateLabel(encounter.at)}</time><span>{encounter.location} · {Math.round(encounter.depth)} m</span></li>)}
      </ol></details>}
    </div>
  </article>;
}

type Props = {
  open:boolean;onOpenChange:(value:boolean)=>void;notes:FieldNote[];saved:boolean;
  renderPortrait:(name:string)=>string|null;guide:ReactNode;radio:ReactNode;
};

export function FieldJournal({open,onOpenChange,notes,saved,renderPortrait,guide,radio}:Props) {
  const [category,setCategory] = useState('All');
  const [query,setQuery] = useState('');
  const [selectedName,setSelectedName] = useState('');
  const visible = filterNotes(notes,category,query) as FieldNote[];
  const selected = visible.find(note=>note.name===selectedName)||visible[0];
  const history = diveHistory(notes) as {id:string;at:string|null;entries:(Encounter & {name:string;kind:string})[]}[];
  const browse = !notes.length ? <div className="field-empty"><Waves size={32} aria-hidden="true"/><h3>Your first page is waiting</h3><p>Swim close to marine life or explore a new place. Your encounters will appear here.</p></div> :
    !visible.length ? <div className="field-empty"><h3>No matching field notes</h3><p>Try another name or place, or choose a different category.</p></div> :
    <div className="field-browser"><nav className="field-list" aria-label="Discovered field notes">{visible.map(note=><button key={note.name} type="button" aria-current={note===selected?'true':undefined} onClick={()=>setSelectedName(note.name)}><span>{note.kind}</span><strong>{note.name}</strong><small>{note.location}</small></button>)}</nav>{selected&&<Entry note={selected} renderPortrait={renderPortrait}/>}</div>;

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="journal-panel field-journal">
    <header className="field-heading"><div><DialogTitle className="journal-title">Field notes</DialogTitle><DialogDescription className="journal-description">Small encounters. A bigger world.</DialogDescription></div><span className="field-total">{notes.length} {notes.length===1?'discovery':'discoveries'}</span></header>
    <output className="journal-storage">{saved?'Your notes stay in this browser across dives.':'Saving is unavailable. New notes will last only for this visit.'}</output>
    <details className="field-guide-disclosure"><summary>Optional exploration · Crystal Grotto</summary>{guide}</details>
    <Tabs value={category} onValueChange={value=>{if(typeof value==='string')setCategory(value);}}>
      <TabsList className="field-tabs" variant="line" aria-label="Browse field notes">{categories.map(([value,label])=><TabsTrigger key={value} value={value}>{label}</TabsTrigger>)}</TabsList>
      {category!=='History'&&<div className="field-search"><label htmlFor="field-search">Find a discovery</label><Input id="field-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search names, places or habitats"/><output>{visible.length} {visible.length===1?'note':'notes'}</output></div>}
      {categories.filter(([value])=>value!=='History').map(([value])=><TabsContent key={value} value={value}>{browse}</TabsContent>)}
      <TabsContent value="History"><div className="field-history">
        <p className="field-history-help">One entry per discovery in each dive. Recent encounters are kept alongside your first sighting.</p>
        {history.length?history.map(dive=><section key={dive.id}><h3>{dive.id==='earlier'?'Earlier discoveries':dateLabel(dive.at)}{dive.id!=='earlier'&&dive.at&&<small>{new Date(dive.at).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</small>}</h3><ul>{dive.entries.map(entry=><li key={entry.name}><button type="button" onClick={()=>{setQuery('');setCategory('All');setSelectedName(entry.name);}}>{entry.name}</button><span>{entry.location} · {Math.round(entry.depth)} m</span></li>)}</ul></section>):<div className="field-empty"><h3>Your dives will leave a trail</h3><p>Discover a place or animal to begin recording your visits.</p></div>}
      </div></TabsContent>
    </Tabs>
    {radio&&<details className="field-radio"><summary>Conversations with Mira · this dive</summary>{radio}</details>}
  </DialogContent></Dialog>;
}
