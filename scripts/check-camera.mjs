import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Enter the ocean'}).click();await page.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>window.__abyssDebug.diver.avatar.root.visible),true);
  assert.equal(await page.evaluate(()=>window.__abyssDebug.diver.avatar.head.visible),false);
  await page.keyboard.press('KeyV');await page.waitForTimeout(800);
  const third=await page.evaluate(()=>{const g=window.__abyssDebug,d=g.diver;return {mode:d.rig.mode,boom:g.camera.position.distanceTo(d.position),head:d.avatar.head.visible,anchor:d.position.toArray(),lightAttached:g.effects.flashlight.parent===d.viewAnchor};});
  assert.equal(third.mode,'tps');assert.ok(third.boom>4);assert.equal(third.head,true);assert.equal(third.lightAttached,true);
  const z=third.anchor[2];await page.keyboard.down('KeyW');await page.waitForTimeout(1300);await page.keyboard.up('KeyW');
  assert.ok(await page.evaluate(()=>window.__abyssDebug.diver.position.z)<z-1,'TPS movement follows player gaze');
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  // Menu and keyboard share the same camera mode, and changing it preserves physics.
  const before=await page.evaluate(()=>{const d=window.__abyssDebug.diver;return {p:d.position.toArray(),v:d.velocity.toArray()};});
  await page.getByRole('combobox',{name:'Camera view'}).click();await page.getByRole('option',{name:'First person · full body'}).click();await page.waitForTimeout(400);
  const first=await page.evaluate(()=>{const g=window.__abyssDebug,d=g.diver;return {p:d.position.toArray(),v:d.velocity.toArray(),mode:d.rig.mode,head:d.avatar.head.visible,body:d.avatar.root.visible,distance:g.camera.position.distanceTo(d.position)};});
  assert.deepEqual(first.p,before.p);assert.deepEqual(first.v,before.v);assert.equal(first.mode,'fps');assert.equal(first.head,false);assert.equal(first.body,true);assert.ok(first.distance<.001);
  // Project the real body through the first-person camera, looking down.
  const body=await page.evaluate(async()=>{const g=window.__abyssDebug,d=g.diver;const T=await import('/node_modules/three/build/three.module.js');d.velocity.set(0,0,0);d.avatar.bodyPitch=0;d.pitch=d.targetPitch=-1.25;d.update(.1,g.elapsed);g.camera.updateMatrixWorld(true);const visible=[];d.avatar.torso.traverse(o=>{if(o.isMesh){const p=o.getWorldPosition(new T.Vector3()).project(g.camera);if(Math.abs(p.x)<1&&Math.abs(p.y)<1&&p.z>-1&&p.z<1)visible.push(o.material.color.getHexString());}});return visible;});
  assert.ok(body.length>=10,'Torso, arms, legs and equipment are in the first-person view');
  const collision=await page.evaluate(async()=>{const g=window.__abyssDebug,d=g.diver;const T=await import('/node_modules/three/build/three.module.js');const p=new T.Vector3(0,10,50),offset=new T.Vector3(0,0,4.6);const obstacle={p:new T.Vector3(0,10,52.6),r:1};g.world.obstacles.push(obstacle);const blocked=d.rig.safeDistance(p,offset);g.world.obstacles.pop();return {blocked,clear:d.rig.safeDistance(p,offset)};});
  assert.ok(collision.blocked<1.5);assert.ok(collision.clear>4,'Third-person boom retracts in front of solid rocks');
  await page.getByRole('button',{name:'Return to reef',exact:true}).click();await page.waitForTimeout(200);
  assert.ok(await page.evaluate(()=>window.__abyssDebug.diver.position.distanceTo(window.__abyssDebug.camera.position))<.01);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({checks:['V toggle','visible TPS character','hidden FPS head only','full-body FPS projection','TPS swimming','pause-menu selector','camera switching preserves position and momentum','camera obstacle avoidance','player-attached flashlight','return to reef','no runtime errors'],third,visibleBodyParts:body.length,collision},null,2));
}finally{await browser.close();}
