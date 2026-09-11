import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('response',r=>{if(r.status()>=400)console.log('HTTP '+r.status()+' '+r.url());});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+' '+JSON.stringify(m.location()));});
try {
  await page.goto(process.env.GAME_URL||'http://localhost:3000/',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.__abyssDebug?.renderer.info.render.calls>0,{timeout:60000});
  await page.getByRole('button',{name:'Enter the ocean'}).click();
  await page.waitForTimeout(1200);
  const initial=await page.evaluate(()=>{const g=window.__abyssDebug;return {position:g.camera.position.toArray(),active:g.diver.active,calls:g.renderer.info.render.calls,geometries:g.renderer.info.memory.geometries,fish:g.marine.schools.reduce((n,s)=>n+s.count,0)};});
  assert.equal(initial.active,true);assert.ok(initial.fish>=300);
  await page.keyboard.down('KeyW');await page.waitForTimeout(1600);await page.keyboard.up('KeyW');
  const moved=await page.evaluate(()=>window.__abyssDebug.camera.position.toArray());assert.ok(moved[2]<initial.position[2]-1,'W swims forward');
  await page.keyboard.press('KeyF');assert.equal(await page.evaluate(()=>window.__abyssDebug.effects.flashlight.intensity>0),true);
  const before=await page.evaluate(()=>window.__abyssDebug.camera.position.y);await page.keyboard.down('Space');await page.waitForTimeout(1000);await page.keyboard.up('Space');assert.ok(await page.evaluate(()=>window.__abyssDebug.camera.position.y)>before+.3,'Space swims up');
  await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__abyssDebug.diver.active),false);
  await page.getByRole('button',{name:'Field notes',exact:true}).last().click();await page.getByRole('heading',{name:'Field notes'}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
  // Frame profile under a real browser renderer; results are host-specific.
  const profile=await page.evaluate(async()=>{const g=window.__abyssDebug;g.diver.active=true;let last=performance.now();const samples=[];await new Promise(resolve=>{function tick(now){samples.push(now-last);last=now;if(samples.length<120)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});samples.sort((a,b)=>a-b);const gl=g.renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return {medianFrameMs:samples[60],p95FrameMs:samples[114],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),quality:g.quality,programs:g.renderer.info.programs.map(p=>({name:p.name,valid:p.diagnostics?.runnable!==false})),discoveries:[...g.discovered]};});
  if(errors.length)console.log(JSON.stringify(errors,null,2)); console.log(JSON.stringify(profile,null,2)); assert.ok(profile.programs.every(p=>p.valid),'All WebGL programs compile');
  // Visit landmarks for lighting, collision geometry, and discovery checks.
  for(const p of [[38,-13,-77],[-42,-22,-110],[8,-33,-148]]){await page.evaluate(p=>{const g=window.__abyssDebug;g.diver.position.set(...p);g.diver.velocity.set(0,0,0);},p);await page.waitForTimeout(700);}
  const finite=await page.evaluate(()=>{const g=window.__abyssDebug;return g.marine.schools.every(s=>s.positions.every(p=>p.toArray().every(Number.isFinite)));});assert.ok(finite,'Flocking stays finite');
  await page.setViewportSize({width:1024,height:768});await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>window.__abyssDebug.camera.aspect),1024/768);
  assert.deepEqual(errors,[],'No browser or shader errors');
  console.log(JSON.stringify({initial,profile,checks:['swimming','vertical movement','flashlight','pause','field notes','landmark rendering','finite flock simulation','resize','no WebGL errors']},null,2));
} finally {await browser.close();}




