import assert from 'node:assert/strict';
import * as T from 'three';
import { cathedralRayPose, observeCathedralRay } from '../src/creatures/CathedralEncounter.js';
import { ExplorationSites } from '../src/world/ExplorationSites.js';
import { MarineLife } from '../src/creatures/MarineLife.js';
import { floorHeight } from '../src/world/materials.js';
const world={scene:new T.Scene(),solids:[],landmarks:[],rockG:new T.IcosahedronGeometry(1,1)};
new ExplorationSites(world);
const point=new T.Vector3();let before=false,after=false;
for(let t=0;t<74;t+=.1){const p=cathedralRayPose(t);point.set(p.x,p.y,p.z);assert.ok(p.y>=floorHeight(p.x,p.z)+2);assert.ok(p.y<25.5);assert.ok(world.solids.every(box=>!box.clone().expandByScalar(1.8).containsPoint(point)),`Ray clearance at ${t.toFixed(1)}`);if(p.z<-247)before=true;if(p.z>-247)after=true;}
assert.ok(before&&after,'Route passes both sides of arch');
const state={};assert.equal(observeCathedralRay(state,2,10,0),false);assert.equal(observeCathedralRay(state,2,10,3),false);assert.equal(observeCathedralRay(state,3,10,0),true);assert.equal(observeCathedralRay(state,3,10,0),false);
const marine=new MarineLife(new T.Scene(),[]);const origin=marine.cathedralRay.center.clone();marine.update(.016,10,new T.Vector3(2000,0,2000));assert.deepEqual(marine.cathedralRay.center,origin,'Signature visitor stays at its site');marine.update(.016,10,origin);assert.equal(marine.cathedralRay.root.visible,true);assert.ok(marine.nearby(marine.cathedralRay.root.position).includes('Reef manta ray'));
console.log('PASS: cathedral route clears terrain and stonework, crosses the arch, stays anchored at its site, supports species discovery and triggers calm observation once.');
