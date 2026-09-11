import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Enter the ocean'}).click();await page.waitForTimeout(800);
await page.evaluate(()=>{const g=window.__abyssDebug;g.diver.targetPitch=.45;});await page.waitForTimeout(500);await page.screenshot({path:'outputs/water-underwater-v5.png'});
const stats=[];
for(const name of ['Basalt Cathedral','The Smoking Gardens','Seagrass Nursery','Palm Cay Anchorage']){
await page.evaluate(()=>window.__abyssDebug.pause());await page.getByRole('button',{name:new RegExp(name)}).click();await page.waitForTimeout(1700);
const state=await page.evaluate(async()=>{const g=window.__abyssDebug,{floorHeight}=await import('/src/world/materials.js');return {location:g.location,y:g.diver.position.y,floor:floorHeight(g.diver.position.x,g.diver.position.z),geometries:g.renderer.info.memory.geometries,population:g.marine.benthic.animals.length,tiles:g.world.stream.chunks.size+g.world.stream.pool.length};});assert.ok(state.y>state.floor,'Spawn above terrain');assert.equal(state.tiles,25);assert.equal(state.population,25);stats.push({name,...state});
if(name==='Palm Cay Anchorage'){await page.keyboard.down('Space');await page.waitForTimeout(2800);await page.keyboard.up('Space');await page.evaluate(()=>{const d=window.__abyssDebug.diver;d.targetYaw=Math.PI/2;d.targetPitch=.05;});await page.waitForTimeout(600);}
if(name==='Palm Cay Anchorage')assert.ok(await page.evaluate(()=>window.__abyssDebug.underwater)<.1,'Island arrival stays at the water surface');
await page.screenshot({path:`outputs/site-${name.replaceAll(' ','-')}.png`});
}
await page.evaluate(()=>{const g=window.__abyssDebug;g.diver.position.set(5200,12,2100);});await page.waitForTimeout(1600);
assert.equal(await page.evaluate(()=>window.__abyssDebug.marine.benthic.animals.length),25);
assert.deepEqual(errors,[]);console.log(JSON.stringify({checks:'Four playable destinations, surface coast, bounded fauna and chunks, no browser/shader errors',stats},null,2));
}finally{await browser.close();}
