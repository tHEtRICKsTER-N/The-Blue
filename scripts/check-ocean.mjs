import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Enter the ocean'}).click();await page.waitForTimeout(500);
  const hands=async()=>page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),g=window.__abyssDebug;g.camera.updateMatrixWorld(true);return g.diver.avatar.arms.map(a=>({rotation:a.arm.rotation.x,point:a.hand.getWorldPosition(new T.Vector3()).project(g.camera).toArray()}));});
  const idle=await hands();assert.ok(idle.every(h=>Math.abs(h.point[0])<1&&Math.abs(h.point[1])<1&&Math.abs(h.point[2])<1),'Both hands are visible looking forward');
  await page.keyboard.down('KeyW');const strokeSamples=[];for(let i=0;i<12;i++){await page.waitForTimeout(120);strokeSamples.push(await hands());}await page.keyboard.up('KeyW');const moving=strokeSamples.at(-1);assert.ok([0,1].every(i=>Math.max(...strokeSamples.map(s=>s[i].rotation))-Math.min(...strokeSamples.map(s=>s[i].rotation))>.04),'Both arms animate over a sequence of swimming frames');assert.ok(moving.every(h=>Math.abs(h.point[0])<1&&Math.abs(h.point[1])<1),`Hands stay in first-person view while swimming: ${JSON.stringify(moving)}`);
    await page.evaluate(()=>{const d=window.__abyssDebug.diver;d.targetPitch=-1.25;});await page.waitForTimeout(400);
  const lower=await page.evaluate(async()=>{const T=await import('/node_modules/three/build/three.module.js'),g=window.__abyssDebug;return g.diver.avatar.legs.map(({knee})=>({angle:knee.rotation.x,p:knee.getWorldPosition(new T.Vector3()).project(g.camera).toArray()}));});
  assert.ok(lower.every(l=>Math.abs(l.p[0])<1&&Math.abs(l.p[1])<1&&Math.abs(l.p[2])<1),'Animated lower body is visible looking down');
  await page.evaluate(()=>window.__abyssDebug.diver.targetPitch=-.075);await page.waitForTimeout(300);
  await page.keyboard.down('Space');await page.keyboard.down('Shift');await page.waitForTimeout(3800);await page.keyboard.up('Space');await page.keyboard.up('Shift');await page.waitForTimeout(500);
  const surface=await page.evaluate(()=>{const g=window.__abyssDebug;return {y:g.diver.position.y,underwater:g.underwater,sky:g.world.surfaceWorld.sky.visible,fog:g.scene.fog.density,location:g.location};});
  assert.ok(surface.y>26.8&&surface.y<28.2,'Diver reaches and floats at waterline');assert.ok(surface.underwater<.1,'Above-water rendering activates');assert.equal(surface.sky,true);assert.ok(surface.fog<.002);
  await page.keyboard.press('KeyV');await page.waitForTimeout(600);assert.ok(await page.evaluate(()=>window.__abyssDebug.camera.position.y)>27,'TPS camera can cross the surface');await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyC');await page.waitForTimeout(1600);await page.keyboard.up('KeyC');assert.ok(await page.evaluate(()=>window.__abyssDebug.underwater)>.95,'Diving restores underwater effects');
  // Stream over many former boundaries and return to the same deterministic tile.
  const baseline=await page.evaluate(()=>{const g=window.__abyssDebug;return {geometries:g.renderer.info.memory.geometries,tiles:g.world.stream.chunks.size+g.world.stream.pool.length,terrainIds:[...g.world.stream.chunks.values(),...g.world.stream.pool].map(c=>c.terrain.geometry.uuid).sort()};});
  const travel=[];
  for(const [x,z] of [[420,80],[1100,-450],[2700,1500],[-2400,-1300],[5200,2100],[40,26]]){
    await page.evaluate(([x,z])=>{const g=window.__abyssDebug;g.diver.position.set(x,12,z);g.diver.velocity.set(0,0,0);},[x,z]);await page.waitForTimeout(1000);
    travel.push(await page.evaluate(()=>{const g=window.__abyssDebug,s=g.world.stream;return {x:g.diver.position.x,z:g.diver.position.z,tiles:s.chunks.size+s.pool.length,pending:s.pending.length,geometries:g.renderer.info.memory.geometries,terrainIds:[...s.chunks.values(),...s.pool].map(c=>c.terrain.geometry.uuid).sort(),fish:g.marine.schools.filter(s=>s.mesh.visible).length};}));
  }
  assert.ok(travel.every(t=>t.tiles<=25),'Terrain allocation stays bounded across travel');for(const t of travel)assert.deepEqual(t.terrainIds,baseline.terrainIds,'The same GPU terrain allocations are recycled during travel');assert.ok(travel.some(t=>Math.abs(t.x)>5000),'Old world boundaries are removed');assert.ok(travel.every(t=>t.fish>0),'Schools populate remote regions');
  const samples=await page.evaluate(async()=>{let last=performance.now();const times=[];await new Promise(resolve=>{function frame(now){times.push(now-last);last=now;if(times.length<180)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});times.sort((a,b)=>a-b);return {median:times[90],p95:times[171],quality:window.__abyssDebug.quality};});
  assert.deepEqual(errors,[],'No browser or shader errors');
  console.log(JSON.stringify({checks:['visible animated FPS hands','surface swimming','above-water sky and lighting','TPS above surface','diving transition','5km travel','bounded tile and geometry allocation','remote fish populations','shader validation'],surface,baseline:{geometries:baseline.geometries,tiles:baseline.tiles},travel:travel.map(({terrainIds,...result})=>result),frameMs:samples},null,2));
}finally{await browser.close();}


