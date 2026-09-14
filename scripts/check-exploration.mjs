import assert from 'node:assert/strict';
import { loadNotes, saveNotes, normalizeNotes, recordEncounter } from '../src/core/FieldNotes.js';
import { filterNotes, diveHistory, fieldGuideEntry } from '../src/core/FieldGuide.js';
import { specimenFor, renderSpecimenPortrait } from '../src/creatures/SpecimenPortrait.js';
import { DiscoveryGuide } from '../src/core/DiscoveryGuide.js';
import { updateDolphinEncounter } from '../src/creatures/DolphinEncounter.js';
import { Dialogue } from '../src/core/Dialogue.js';
import { MarineLife } from '../src/creatures/MarineLife.js';
import * as T from 'three';
import { Game } from '../src/core/Game.js';

let stored = null;
const storage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
const note = {name:'Crystal Grotto',kind:'Location',location:'Crystal Grotto',depth:49,firstSeen:'2026-09-14T12:00:00.000Z'};
assert.deepEqual(loadNotes(storage), []);
assert.equal(saveNotes(storage, [note, note]), true);
assert.deepEqual(loadNotes(storage), normalizeNotes([note]), 'Round trip retains first encounter without duplicates');
stored = JSON.stringify({version:1,notes:[note]});
assert.equal(loadNotes(storage)[0].encounters[0].diveId,'earlier','Old field notes migrate without invented dive IDs');
let historyNotes = recordEncounter(loadNotes(storage),{...note,depth:45,firstSeen:'2026-09-15T12:00:00Z'},'dive-2');
assert.equal(historyNotes[0].firstSeen,note.firstSeen,'Revisits preserve first sighting');
assert.equal(historyNotes[0].encounters.length,2);
historyNotes = recordEncounter(historyNotes,note,'dive-2');
assert.equal(historyNotes[0].encounters.length,2,'One encounter per discovery per dive');
assert.equal(saveNotes(storage,historyNotes),true);
assert.equal(loadNotes(storage)[0].encounters.length,2,'History survives reload');
assert.equal(diveHistory(historyNotes)[0].id,'dive-2');
assert.equal(filterNotes(historyNotes,'Species').length,0);
assert.equal(filterNotes(historyNotes,'Location','  gRoTtO ').length,1);
assert.equal(filterNotes(historyNotes,'All','missing').length,0);
for(let i=0;i<40;i++)historyNotes=recordEncounter(historyNotes,note,'extra-'+i);
assert.equal(historyNotes[0].encounters.length,30,'Bound stored history');
assert.equal(historyNotes[0].firstSeen,note.firstSeen);
stored = '{broken'; assert.deepEqual(loadNotes(storage), []);
stored = JSON.stringify({version: 9, notes:[note]}); assert.deepEqual(loadNotes(storage), []);
const blocked = {getItem(){throw Error('Blocked');},setItem(){throw Error('Quota');}};
assert.deepEqual(loadNotes(blocked), []); assert.equal(saveNotes(blocked, [note]), false);
assert.deepEqual(normalizeNotes([null, {}, {...note,kind:'Invalid'}]), []);
assert.equal(normalizeNotes([{...note,depth:NaN,firstSeen:'bad'}])[0].firstSeen, null);
const expedition = {
  discovered:new Set(), encountered:new Set(), diveId:'test-dive', notes:[], discoveryQueue:[], elapsed:0,
  diver:{position:new T.Vector3(0,9,26)}, location:'Coral Garden',
  dialogue:new Dialogue(), callbacks:{onNotes:notes=>saveNotes(storage,notes)},
};
Game.prototype.discover.call(expedition,'Coral Garden','Location');
assert.equal(loadNotes(storage).length,1,'Discovery is saved before notification delivery');
assert.equal(expedition.discoveryQueue.length,1);
Game.prototype.discover.call(expedition,'Coral Garden','Location');
assert.equal(expedition.notes.length,1,'Repeated discovery preserves original record');
expedition.encountered.clear();expedition.diveId='next-dive';
Game.prototype.discover.call(expedition,'Coral Garden','Location');
assert.equal(expedition.notes[0].encounters.length,2,'Returning dive records a revisit');
assert.equal(expedition.discoveryQueue.length,1,'Revisits do not repeat discovery toasts');

const guide = new DiscoveryGuide(), target = {p:{x:0,y:-10,z:-50},radius:17};
const position = {x:0,y:0,z:0};
assert.equal(guide.update(34, position, target, false), false);
assert.equal(guide.update(1, position, target, false), true);
assert.equal(guide.update(50, position, target, false), false, 'Clue offered once');
guide.active = true;
assert.equal(guide.reading(position,target,false).bearing, 0);
assert.equal(guide.reading(position,target,false).vertical, -10);
assert.equal(guide.reading({x:-50,y:0,z:-50},target,false).bearing, 90);
guide.update(1,position,target,true);
assert.equal(guide.reading(position,target,true).active, false);
const radio = new Dialogue(); radio.trigger('grotto-clue');radio.trigger('grotto-clue');
assert.equal(radio.queue.length, 1);
radio.setEnabled(false); radio.trigger('grotto-clue');assert.equal(radio.queue.length, 0);

const state = {};
for(let i=0;i<29;i++)updateDolphinEncounter(state,.1,20,0);
assert.equal(state.mode,'cruise');
updateDolphinEncounter(state,.2,20,0);assert.equal(state.mode,'curious');
updateDolphinEncounter(state,.1,12,3);assert.equal(state.mode,'retreat');
updateDolphinEncounter(state,5,22,0);assert.equal(state.mode,'retreat');
updateDolphinEncounter(state,6,50,0);assert.equal(state.mode,'cruise');
updateDolphinEncounter(state,.1,2,0);assert.equal(state.mode,'retreat','Keep a respectful distance even from a still diver');
// Exercise the actual integration, including terrain clearance and paused-time movement.
const marine = new MarineLife(new T.Scene(), []);
const player = new T.Vector3(55, 20, -80);
for(let i=0;i<240;i++)marine.update(1/60,i/60,player,0);
assert.ok(marine.animals.every(a=>a.root.position.toArray().every(Number.isFinite)));
assert.ok(marine.animals.some(a=>a.dolphin && a.encounter.mode==='curious'));
const dolphin = marine.animals.find(a=>a.dolphin);
const before = dolphin.root.position.clone();
marine.update(0,4,player,0);
assert.deepEqual(dolphin.root.position.toArray(),before.toArray());
player.copy(dolphin.root.position).add(new T.Vector3(5,0,0));
marine.update(1/60,4,player,4);
assert.equal(dolphin.encounter.mode,'retreat');
player.set(1000,15,-1000);marine.update(1/60,5,player,0);
assert.ok(dolphin.root.position.distanceTo(player)<200,'Dolphins relocate with streamed ocean after fast travel');
const speciesNames=new Set([...marine.animals,...marine.benthic.animals,...marine.schools].map(entry=>entry.name));
for(const name of speciesNames){
  const model=specimenFor(marine,name);
  assert.ok(model&&Number.isFinite(model.radius)&&model.radius>0,'Portrait model exists: '+name);
  assert.ok(fieldGuideEntry({name,kind:'Species',location:'Test'}).habitat!=='Test','Species guide exists: '+name);
}
assert.equal(specimenFor(marine,'Unknown animal'),null);
const livePosition=dolphin.root.position.clone();specimenFor(marine,dolphin.name);
assert.deepEqual(dolphin.root.position.toArray(),livePosition.toArray(),'Portrait framing does not move live animals');
// A failed portrait must still restore the game's render target and viewport.
let currentTarget='game-target',scissorTest=true;
const viewport=new T.Vector4(1,2,800,600),scissor=new T.Vector4(3,4,700,500);
const renderer={
  getRenderTarget:()=>currentTarget,setRenderTarget:value=>{currentTarget=value;},
  getViewport:out=>out.copy(viewport),setViewport:value=>viewport.copy(value),
  getScissor:out=>out.copy(scissor),setScissor:value=>scissor.copy(value),
  getScissorTest:()=>scissorTest,setScissorTest:value=>{scissorTest=value;},
  render(){throw Error('Simulated render failure');},
};
assert.throws(()=>renderSpecimenPortrait(renderer,marine,dolphin.name),/Simulated render failure/);
assert.equal(currentTarget,'game-target');assert.equal(scissorTest,true);
assert.deepEqual(viewport.toArray(),[1,2,800,600]);
console.log('PASS: saved notes and v1 migration, bounded dive history, filters, species guide and portrait models, renderer restoration, guidance, and dolphin simulation.');
