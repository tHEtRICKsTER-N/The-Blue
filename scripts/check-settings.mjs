import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Enter the ocean'}).click();await page.waitForTimeout(600);await page.evaluate(()=>window.__abyssDebug.pause());
async function select(label,value){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option',{name:value,exact:true}).click();}
await select('Weather','Storm');await select('Time of day','Night');await select('Character','Female');await page.getByRole('radio',{name:'Skin tone 6',exact:true}).check();await page.waitForTimeout(1300);
assert.deepEqual(await page.evaluate(()=>{const g=window.__abyssDebug;return [g.environment.weather,g.environment.period,g.character,g.skin,g.diver.avatar.skin.color.getHexString()];}),['storm','night','female','#40271f','40271f']);
assert.ok(await page.evaluate(()=>window.__abyssDebug.environment.light)<.08);
for(const [width,height] of [[1440,900],[1024,768],[800,600],[390,844],[740,390]]){
await page.setViewportSize({width,height});await page.waitForTimeout(200);
const layout=await page.evaluate(()=>{const panel=document.querySelector('.settings-panel'),items=[...document.querySelectorAll('.settings-section')].map(e=>e.getBoundingClientRect());return {overflow:panel.scrollWidth>panel.clientWidth+1,overlap:items.some((a,i)=>items.some((b,j)=>i!==j&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top))};});assert.equal(layout.overflow,false,`Panel overflow ${width}`);assert.equal(layout.overlap,false,`Sections overlap ${width}`);
await page.getByRole('combobox',{name:'Water detail',exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.getByRole('combobox',{name:'Water detail',exact:true}).isVisible());
}
await page.setViewportSize({width:1440,height:900});await page.locator('.pause-screen').evaluate(e=>e.scrollTop=0);await page.screenshot({path:'outputs/settings-desktop.png'});
await page.evaluate(()=>{const g=window.__abyssDebug;g.diver.position.y=31;g.setCameraMode('tps');});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>window.__abyssDebug.environment.rain.visible),true);
const memory=await page.evaluate(()=>window.__abyssDebug.renderer.info.memory.geometries);
for(const weather of ['clear','cloudy','mist','rain','storm'])for(const period of ['dawn','morning','day','afternoon','evening','dusk','night']){await page.evaluate(([w,p])=>{window.__abyssDebug.setWeather(w);window.__abyssDebug.setTime(p);},[weather,period]);await page.waitForTimeout(30);}
assert.equal(await page.evaluate(()=>window.__abyssDebug.renderer.info.memory.geometries),memory);
await page.evaluate(()=>{const g=window.__abyssDebug;g.diver.position.y=10;});await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>window.__abyssDebug.environment.rain.visible),false);
await page.evaluate(()=>{const g=window.__abyssDebug;g.setWeather('clear');g.setTime('day');});
await page.getByRole('button',{name:'Continue exploring'}).click();
for(const [width,height] of [[1440,900],[800,600],[390,844],[740,390]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const overlap=await page.evaluate(()=>{const boxes=['.topbar','.location-hud','.depth-rail','.hud-bottom','.bottombar'].map(s=>document.querySelector(s).getBoundingClientRect());return boxes.some((a,i)=>boxes.some((b,j)=>i!==j&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top));});assert.equal(overlap,false,`Gameplay HUD overlap ${width}x${height}`);
}
await page.screenshot({path:'outputs/hud-landscape.png'});
assert.deepEqual(errors,[]);console.log('PASS: settings controls, 35 environment combinations, fixed geometry memory, rain surface boundary, five responsive panel sizes.');
}finally{await browser.close();}
