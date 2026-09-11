import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Dialogue} from '../src/core/Dialogue.js';
const lines=[],dialogue=new Dialogue(line=>lines.push(line));dialogue.trigger('welcome');dialogue.trigger('welcome');assert.equal(dialogue.queue.length,3);dialogue.update(.1,true);assert.equal(lines[0].speaker,'Mira');const remaining=dialogue.remaining;dialogue.update(20,false);assert.equal(dialogue.remaining,remaining);dialogue.setEnabled(false);assert.equal(dialogue.queue.length,0);assert.equal(lines.at(-1),null);dialogue.trigger('night');assert.equal(dialogue.queue.length,0);dialogue.setEnabled(true);dialogue.trigger('night');assert.equal(dialogue.queue.length,3);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE);
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Enter the ocean'}).click();await page.waitForTimeout(500);assert.ok(await page.locator('.radio-subtitle').isVisible());assert.match(await page.locator('.radio-speaker').innerText(),/MIRA/);
await page.evaluate(()=>{const g=window.__abyssDebug;g.setTime('night');g.setWeather('clear');g.diver.position.y=29;g.diver.targetYaw=-.63;g.diver.targetPitch=.43;g.pause();});await page.waitForTimeout(2300);
assert.ok(await page.evaluate(()=>window.__abyssDebug.world.surfaceWorld.uniforms.uNight.value)>.99);
await page.getByRole('button',{name:'Continue exploring'}).click();await page.waitForTimeout(350);await page.screenshot({path:'outputs/moonlit-ocean.png'});
for(const [width,height] of [[1440,900],[740,390],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const collision=await page.evaluate(()=>{const subtitle=document.querySelector('.radio-subtitle').getBoundingClientRect();return ['.topbar','.location-hud','.depth-rail','.play-tools','.bottombar'].some(s=>{const r=document.querySelector(s).getBoundingClientRect();return subtitle.left<r.right&&subtitle.right>r.left&&subtitle.top<r.bottom&&subtitle.bottom>r.top;});});assert.equal(collision,false,`Dialogue overlap ${width}x${height}`);}
await page.evaluate(()=>window.__abyssDebug.pause());await page.getByRole('combobox',{name:'Companion dialogue'}).click();await page.getByRole('option',{name:'Off · quiet exploration',exact:true}).click();assert.equal(await page.locator('.radio-subtitle').count(),0);
await page.getByRole('button',{name:'Field notes',exact:true}).last().click();await page.getByRole('region',{name:'Radio transcript'}).waitFor();assert.match(await page.locator('.radio-log').innerText(),/Radio check/);
assert.deepEqual(errors,[]);console.log('PASS: night rendering, dialogue trigger/deduplication, pause timing, quiet mode, transcript, responsive subtitles.');
}finally{await browser.close();}
