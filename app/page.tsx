'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, BookOpen, Camera, Compass, Flashlight, Maximize, Pause, VolumeX, Waves } from 'lucide-react';
import { defaultPreferences, normalizePreferences, loadPreferences, savePreferences, restorePreferences, loadGraphics } from '@/src/core/PlayerPreferences.js';
import { defaultControls, loadControls, saveControls, bindingLabel } from '@/src/core/Controls.js';
import { ControlSettings, type ControlPreferences } from '@/components/ControlSettings';
import { loadNotes, saveNotes } from '@/src/core/FieldNotes.js';
import { destinations } from '@/src/world/ExplorationSites.js';
import { times, weathers, skinTones } from '@/src/world/Environment.js';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { PhotoStudio } from '@/components/PhotoStudio';
import { PhotoGallery } from '@/components/PhotoAlbum';
import { usePhotoAlbum, type Photo } from '@/hooks/use-photo-album';
import { FieldJournal, type FieldNote } from '@/components/FieldJournal';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useDeviceCompatibility } from '@/hooks/use-device-compatibility';
import { IncompatibleDeviceWarning } from '@/components/IncompatibleDeviceWarning';

type Reading = { depth: number; heading: number; location: string; fps: number; frameTime?: number; frameP95?:number; resolution?: string; renderScale?: number; hour?: number; gpu?: string; flashlight: boolean; cameraMode: 'fps' | 'tps'; surface?: boolean; quality?: string; distance?: number; autoWeather?: boolean; weather?: string; wind?: number };
type GraphicsSettings = {
  renderScale:number; waterDetail:string; particleDensity:string; viewDistance:string; antialiasing:string;
  bloom:boolean; bloomStrength:number; lightShafts:boolean; distortion:number; sharpness:number; vignette:number;
  aberration:number; filmGrain:boolean; weatherDensity:number; fov:number; starSize:number; autoAdjust:boolean;
};
const graphicsPresets:Record<string,GraphicsSettings> = {
  performance:{renderScale:.65,waterDetail:'low',particleDensity:'low',viewDistance:'low',antialiasing:'fxaa',bloom:false,bloomStrength:.2,lightShafts:false,distortion:0,sharpness:.25,vignette:.6,aberration:0,filmGrain:false,weatherDensity:.6,fov:68,starSize:1,autoAdjust:true},
  balanced:{renderScale:.85,waterDetail:'medium',particleDensity:'medium',viewDistance:'medium',antialiasing:'smaa',bloom:true,bloomStrength:.24,lightShafts:true,distortion:.2,sharpness:.32,vignette:.8,aberration:0,filmGrain:false,weatherDensity:.85,fov:68,starSize:1,autoAdjust:true},
  high:{renderScale:1,waterDetail:'high',particleDensity:'high',viewDistance:'high',antialiasing:'msaa4',bloom:true,bloomStrength:.3,lightShafts:true,distortion:.3,sharpness:.35,vignette:1,aberration:0,filmGrain:false,weatherDensity:1,fov:68,starSize:1,autoAdjust:false},
  ultra:{renderScale:1.25,waterDetail:'high',particleDensity:'high',viewDistance:'ultra',antialiasing:'msaa8',bloom:true,bloomStrength:.34,lightShafts:true,distortion:.28,sharpness:.4,vignette:1,aberration:.35,filmGrain:false,weatherDensity:1,fov:68,starSize:1.1,autoAdjust:false},
};
const presetOrder:[string,string][] = [['performance','Performance'],['balanced','Balanced'],['high','High'],['ultra','Ultra']];
const clock = (hour:number) => `${String(Math.floor(hour)%24).padStart(2,'0')}:${String(Math.floor((hour%1)*60)).padStart(2,'0')}`;

function Row({label,hint,readout,children}:{label:string;hint?:string;readout?:string;children:React.ReactNode}) {
  return <div className="set-row"><div className="set-label"><span>{label}</span>{hint?<small>{hint}</small>:null}</div><div className="set-control">{children}{readout?<em>{readout}</em>:null}</div></div>;
}
function SelectRow({label,hint,value,options,onChange}:{label:string;hint?:string;value:string;options:[string,string][];onChange:(value:string)=>void}) {
  return <Row label={label} hint={hint}><Select value={value} onValueChange={v=>{if(v)onChange(v);}}><SelectTrigger aria-label={label}><SelectValue>{options.find(option=>option[0]===value)?.[1]??value}</SelectValue></SelectTrigger><SelectContent>{options.map(([key,text])=><SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></Row>;
}
function SegmentRow({label,hint,value,options,onChange}:{label:string;hint?:string;value:string;options:[string,string][];onChange:(value:string)=>void}) {
  return <Row label={label} hint={hint}><fieldset className="segment"><legend className="sr-only">{label}</legend>{options.map(([key,text])=><button key={key} type="button" aria-pressed={key===value} className={key===value?'on':''} onClick={()=>onChange(key)}>{text}</button>)}</fieldset></Row>;
}
function SwitchRow({label,hint,checked,onChange}:{label:string;hint?:string;checked:boolean;onChange:(value:boolean)=>void}) {
  return <Row label={label} hint={hint}><Switch checked={checked} onCheckedChange={onChange} aria-label={label}/></Row>;
}
function SliderRow({label,hint,value,min,max,step,format,onChange}:{label:string;hint?:string;value:number;min:number;max:number;step:number;format:(value:number)=>string;onChange:(value:number)=>void}) {
  return <Row label={label} hint={hint} readout={format(value)}><Slider className="set-slider" aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={v=>onChange(Array.isArray(v)?v[0]:v)}/></Row>;
}

type RadioLine = {id:number;speaker:string;text:string;topic:string};
type Discovery = FieldNote;
type GuideReading = {active:boolean;discovered:boolean;distance:number;bearing:number;vertical:number};
type MenuTab = 'controls'|'graphics'|'effects'|'environment'|'diver'|'sites';
const menuTabs:[MenuTab,string,string][] = [['graphics','Graphics','01'],['effects','Post effects','02'],['environment','Environment','03'],['diver','Diver','04'],['sites','Dive sites','05'],['controls','Controls','06']];

export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<any>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false);
  const [photoMode,setPhotoMode]=useState(false);
  const album=usePhotoAlbum();
  const preferencesRef=useRef(defaultPreferences());
  const [preferences,setPreferences]=useState(defaultPreferences);
  const [preferencesSaved,setPreferencesSaved]=useState(true),[graphicsSaved,setGraphicsSaved]=useState(true);
  function updatePreferences(patch:Partial<ReturnType<typeof defaultPreferences>>){const next=normalizePreferences({...preferencesRef.current,...patch});preferencesRef.current=next;setPreferences(next);try{setPreferencesSaved(savePreferences(window.localStorage,next));}catch{setPreferencesSaved(false);}}

  const [controls,setControls]=useState<ControlPreferences>(defaultControls);
  const [controlsSaved,setControlsSaved]=useState(true);
  const [muted, setMuted] = useState(false), [journal, setJournal] = useState(false);
  const [weather,setWeather]=useState('clear'),[period,setPeriod]=useState('day'),[character,setCharacter]=useState('male'),[skin,setSkin]=useState('#b77c55');
  const [hour,setHour]=useState(times.day[1] as number),[cycleSpeed,setCycleSpeed]=useState(0);
  const [dialogue,setDialogue]=useState<RadioLine|null>(null),[radioEnabled,setRadioEnabled]=useState(true),[radioLog,setRadioLog]=useState<RadioLine[]>([]);
  const [graphics, setGraphics] = useState<GraphicsSettings>(graphicsPresets.high);
  const [graphicsPreset, setGraphicsPreset] = useState('high');
  const [menuTab, setMenuTab] = useState<MenuTab>('graphics');
  const [reading, setReading] = useState<Reading>({ depth: 18, heading: 0, location: 'Coral Garden', fps: 60, flashlight: false, cameraMode: 'fps' });
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [notesSaved,setNotesSaved] = useState(true);
  const [guide,setGuide] = useState<GuideReading>({active:false,discovered:false,distance:0,bearing:0,vertical:0});
  const [toast, setToast] = useState<Discovery | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compatibility = useDeviceCompatibility();

  useEffect(() => {
    if (compatibility.isIncompatible && started) {
      game.current?.pause();
      setPaused(true);
    }
  }, [compatibility.isIncompatible, started]);

  useEffect(() => {
    let disposed = false;
    let savedGraphics:GraphicsSettings=graphicsPresets.high,savedPreset='high';
    try {const loaded=loadGraphics(window.localStorage,graphicsPresets.high,graphicsPresets);savedGraphics=loaded.settings;savedPreset=loaded.preset;setGraphics(savedGraphics);setGraphicsPreset(savedPreset);setGraphicsSaved(loaded.saved);}catch{setGraphicsSaved(false);}
    let initialPreferences=defaultPreferences();
    try{const loaded=loadPreferences(window.localStorage);initialPreferences=loaded.settings;setPreferencesSaved(loaded.saved);}catch{setPreferencesSaved(false);}
    preferencesRef.current=initialPreferences;setPreferences(initialPreferences);
    setMuted(initialPreferences.muted);setRadioEnabled(initialPreferences.radioEnabled);setCharacter(initialPreferences.character);setSkin(initialPreferences.skin);setWeather(initialPreferences.weather);setPeriod(initialPreferences.period);setHour(initialPreferences.hour);setCycleSpeed(initialPreferences.cycleSpeed);
    let restoring=true;
    let preferReducedMotion=false;try{preferReducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{/* Keep the default if media queries are unavailable. */}
    let savedControls={...defaultControls(),reducedMotion:preferReducedMotion};
    try { const loaded=loadControls(window.localStorage,preferReducedMotion);savedControls=loaded.settings;setControls(savedControls);setControlsSaved(loaded.saved); } catch {setControls(savedControls);setControlsSaved(false);}
    let initialNotes:Discovery[]=[];
    try { initialNotes=loadNotes(window.localStorage); } catch { setNotesSaved(false); }
    setDiscoveries(initialNotes);
    import('@/src/core/Game.js').then(({ Game }) => {
      if (disposed || !mount.current) return;
      game.current = new Game(mount.current, {
        initialNotes,
        onPreferences:(patch:Partial<ReturnType<typeof defaultPreferences>>)=>{if(!restoring)updatePreferences(patch);},
        onNotes:(notes:Discovery[])=>{setDiscoveries(notes);try{setNotesSaved(saveNotes(window.localStorage,notes));}catch{setNotesSaved(false);}},
        onGuide:setGuide,
        onDialogue: (line:RadioLine|null)=>{setDialogue(line);if(line)setRadioLog(old=>[...old,line]);},
        onReady: () => setReady(true), onReading: (value: Reading) => setReading(value), onPause: setPaused,
        onDiscover: (item: Discovery) => {
          setToast(item);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setToast(null), 5000);
        },
      });
      game.current.setGraphicsSettings(savedGraphics);
      game.current.setControls(savedControls);
      restorePreferences(game.current,initialPreferences);restoring=false;
    }).catch(() => setError('The ocean could not load. Please reload with WebGL enabled in your browser.'));
    return () => { disposed = true; game.current?.dispose(); if (timer.current) clearTimeout(timer.current); };
  }, []);
  function enter() {
    if (compatibility.isIncompatible) return;
    setStarted(true);
    setPaused(false);
    game.current?.start();
  }
  const openPhoto = useCallback(()=>{if(game.current?.beginPhoto())setPhotoMode(true);},[]);
  const closePhoto = useCallback(()=>{game.current?.endPhoto();setPhotoMode(false);},[]);
  const aimPhoto = useCallback((x:number,y:number)=>game.current?.aimPhoto(x,y),[]);
  const zoomPhoto = useCallback((fov:number)=>game.current?.zoomPhoto(fov),[]);
  const capturePhoto = useCallback((aspect:string)=>game.current.takePhoto(aspect) as Promise<Photo>,[]);
  const renderPortrait = useCallback((name:string)=>game.current?.speciesPortrait(name)||null,[]);
  function openJournal() { game.current?.endPhoto();setPhotoMode(false);game.current?.pause(); setJournal(true); }
  function sound() {const next=!muted;setMuted(next);if(game.current)game.current.setMuted(next);else updatePreferences({muted:next});}
  function applyControls(next:ControlPreferences){setControls(next);game.current?.setControls(next);try{setControlsSaved(saveControls(window.localStorage,next));}catch{setControlsSaved(false);}}
  const keys=(id:string)=>bindingLabel(controls,id);
  function applyGraphics(next:GraphicsSettings,preset='custom'){setGraphics(next);setGraphicsPreset(preset);game.current?.setGraphicsSettings(next);try{localStorage.setItem('abyss-graphics',JSON.stringify({preset,settings:next}));setGraphicsSaved(true);}catch{setGraphicsSaved(false);}}
  function updateGraphics<K extends keyof GraphicsSettings>(key:K,value:GraphicsSettings[K]){applyGraphics({...graphics,[key]:value});}
  function choosePreset(preset:string){const next=graphicsPresets[preset];if(next)applyGraphics(next,preset);}
  function chooseHour(value:number){setHour(value);game.current?.setHour(value);setPeriod('custom');}
  function choosePeriod(value:string){const next=times[value as keyof typeof times];if(!next)return;setPeriod(value);setHour(next[1] as number);game.current?.setTime(value);}
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Embedded browser restriction. */ } }
  const scalePercent = Math.round((reading.renderScale ?? graphics.renderScale)*100);
  // In automatic mode the world owns the weather, so the row reads back what is actually overhead.
  const liveLabel = (weathers[(reading.weather ?? 'clear') as keyof typeof weathers] as unknown[] | undefined)?.[0];
  const liveWeather = typeof liveLabel === 'string' ? liveLabel : 'Clear';
  const windLabel = (reading.wind ?? 0) < .2 ? 'light' : (reading.wind ?? 0) < .45 ? 'moderate' : (reading.wind ?? 0) < .75 ? 'fresh' : 'gale';
  // While the clock is running the world owns the hour; the slider just reads it back.
  const shownHour = cycleSpeed > 0 && typeof reading.hour === 'number' ? reading.hour : hour;
  return <main className={`ocean-app ${controls.reducedMotion ? 'reduces-motion' : ''} ${started ? 'is-playing' : ''} ${paused ? 'is-paused' : ''} ${photoMode ? 'is-photographing' : ''} ${dialogue ? 'has-dialogue' : ''} ${compatibility.isIncompatible ? 'is-incompatible' : ''}`}>
    <IncompatibleDeviceWarning compatibility={compatibility} />
    <div ref={mount} className="ocean-canvas" aria-label="Interactive three-dimensional underwater world" />
    <div className="edge-shade" />
    <header className="topbar"><div className="wordmark"><Waves size={23} strokeWidth={1.3} /><span>ABYSS<sup>®</sup></span></div>
      {!started ? <div className="expedition-label"><span className="live-dot" /> A LIVING OCEAN <span className="divider" /> EXPEDITION 001</div> : <button className="quiet-button" onClick={() => game.current?.pause()} aria-label="Pause exploration"><Pause size={18} /> PAUSE <kbd>ESC</kbd></button>}
    </header>
    {!started && <section className="start-screen"><div className="eyebrow"><span /> BENEATH THE EVERYDAY</div><h1>ABYSS</h1><p className="intro">There’s a whole world<br />beneath the surface.</p><p className="intro-small">Follow the light. Find the unexpected.<br />Take nothing but a moment.</p><Button className="enter-button" disabled={!ready || !!error || compatibility.isIncompatible} onClick={enter}>{error ? 'Unable to descend' : compatibility.isIncompatible ? 'PC Required to Descend' : ready ? 'Enter the ocean' : 'Descending into the ocean…'}<ArrowUpRight size={20} /></Button>{error ? <p className="error-message" role="alert">{error}</p> : compatibility.isIncompatible ? <div className="start-note text-warn"><span className="tiny-dot dot-warn" /> {compatibility.title.toUpperCase()} · OPEN ON PC TO LAUNCH</div> : <div className="start-note">{ready ? <><span className="tiny-dot" /> NO OBJECTIVES. JUST WONDER.</> : <><span className="loading-line" /> Preparing your expedition</>}</div>}</section>}
    {!started && <div className="scene-caption"><span className="caption-line" /><span>01 / CORAL GARDEN<small>Somewhere worth getting lost.</small></span></div>}
    {started && !paused && guide.active && <div className="discovery-bearing">Crystal Grotto · {Math.round(guide.bearing)}° · {guide.distance} m<small>Optional route · manage in Field notes</small></div>}
    <aside className="depth-rail" aria-label="Current depth"><span className="rail-label">{reading.surface ? 'SURFACE' : 'DEPTH'}</span><span className="depth-number">{reading.depth.toFixed(1)}<small>m</small></span><div className="depth-ticks">{Array.from({length:17}, (_,i) => <i key={i} className={i%4===0?'major':''} />)}<b style={{top:`${Math.min(94,reading.depth/90*100)}%`}} /></div><span className="rail-end">{reading.surface ? <>ABOVE<br />THE BLUE</> : <>BELOW<br />THE SURFACE</>}</span></aside>
    {started && <><div className="compass-strip"><span>NW</span><i /><span>N</span><i /><b>{String(Math.round(reading.heading)).padStart(3,'0')}°</b><i /><span>NE</span><i /><span>E</span></div><div className="crosshair" /><div className="location-hud"><Compass size={17} strokeWidth={1.2} /><div><span>EXPLORING</span><strong>{reading.location}</strong></div></div><div className="hud-bottom">{dialogue && <div className="radio-subtitle" role="status" aria-live="polite" aria-atomic="true"><span className="radio-speaker"><AudioLines size={13}/>{dialogue.speaker === 'Mira'?'MIRA / SURFACE RADIO':'YOU / DIVER'}</span><p>{dialogue.text}</p></div>}<div className="play-tools"><button onClick={() => game.current?.toggleCamera()} aria-label="Switch camera view"><kbd>{keys('camera')}</kbd> {reading.cameraMode === 'fps' ? 'First person' : 'Third person'}</button><button onClick={openPhoto}><Camera size={18}/> Photo mode</button><button onClick={openJournal}><BookOpen size={18} /> Field notes <span>{discoveries.length}</span></button><button aria-label={reading.flashlight?'Turn flashlight off':'Turn flashlight on'} aria-pressed={reading.flashlight} className={reading.flashlight?'active':''} onClick={() => game.current?.toggleFlashlight()}><Flashlight size={18} /><kbd>{keys('flashlight')}</kbd></button></div><div className="controls-hint"><span><kbd>{['forward','left','backward','right'].map(keys).join(' · ')}</kbd> Swim</span><span><kbd>{keys('ascend')}</kbd> Surface</span><span><kbd>{keys('descend')}</kbd> Dive</span><span><kbd>{keys('boost')}</kbd> Glide faster</span><span><kbd>{keys('camera')}</kbd> Switch view</span><span>Mouse or <kbd>{['lookLeft','lookUp','lookDown','lookRight'].map(keys).join(' · ')}</kbd> to look</span><span><kbd>Tab</kbd> Menu</span></div></div>{toast && <div className="discovery-toast" role="status"><span className="discovery-symbol">✧</span><p>{toast.kind.toUpperCase()} DISCOVERED</p><h2>{toast.name}</h2><span>Added to your field notes</span></div>}</>}

    {started && paused && !journal && !photoMode && <section className="pause-screen" aria-label="Expedition settings"><div className="menu-shell">
      <header className="menu-head">
        <div className="menu-brand"><Waves size={18} strokeWidth={1.4}/><b>ABYSS</b><span>Expedition control</span></div>
        <div className="menu-telemetry" aria-label="Render telemetry">
          <span><i>FPS</i><b>{reading.fps}</b></span>
          <span><i>Frame</i><b>{(reading.frameTime??0).toFixed(1)}ms</b></span>
          <span title="95% of frames completed within this interval during the last measured second of active play"><i>95% frame</i><b>{reading.frameP95?reading.frameP95.toFixed(1)+'ms':'—'}</b></span>
          <span><i>Buffer</i><b>{reading.resolution??'—'}</b></span>
          <span><i>Scale</i><b>{scalePercent}%</b></span>
        </div>
      </header>
      <div className="menu-body">
        <nav className="menu-nav" aria-label="Settings sections">
          {menuTabs.map(([key,label,index])=><button key={key} type="button" aria-current={menuTab===key} className={menuTab===key?'on':''} onClick={()=>setMenuTab(key)}><i>{index}</i>{label}</button>)}
          <Button className="enter-button menu-resume" disabled={compatibility.isIncompatible} onClick={enter}>{compatibility.isIncompatible ? 'PC required' : 'Resume dive'} <ArrowUpRight size={18}/></Button>
        </nav>
        <div className="menu-pane">
          <p className="settings-persistence">{preferencesSaved&&graphicsSaved&&controlsSaved?'Settings save automatically in this browser. Field notes and saved photos stay here too.':'Some settings could not be saved. They apply for this visit; allow browser storage to keep them.'}</p>
          {menuTab==='controls'&&<ControlSettings value={controls} onChange={applyControls} saved={controlsSaved}/>}
          {menuTab==='graphics' && <><div className="pane-head"><h2>Graphics</h2><p>Overall quality first — every field below follows the preset until you change one.</p></div>
            <SegmentRow label="Quality preset" hint={graphicsPreset==='custom'?'Custom configuration':'Applies to every setting'} value={graphicsPreset} options={presetOrder} onChange={choosePreset}/>
            <SliderRow label="Render resolution" hint="Above 100% supersamples, then downscales — the sharpest option" value={graphics.renderScale} min={.5} max={2} step={.05} format={v=>`${Math.round(v*100)}%`} onChange={v=>updateGraphics('renderScale',v)}/>
            <SelectRow label="Anti-aliasing" hint="MSAA smooths geometry edges without softening the image" value={graphics.antialiasing} options={[['off','Off'],['fxaa','FXAA · fastest'],['smaa','SMAA · sharper'],['msaa2','MSAA 2×'],['msaa4','MSAA 4× · recommended'],['msaa8','MSAA 8×']]} onChange={v=>updateGraphics('antialiasing',v)}/>
            <SegmentRow label="World detail" hint="Terrain and water geometry density" value={graphics.waterDetail} options={[['low','Low'],['medium','Medium'],['high','High']]} onChange={v=>updateGraphics('waterDetail',v)}/>
            <SegmentRow label="View distance" value={graphics.viewDistance} options={[['low','Near'],['medium','Medium'],['high','Far'],['ultra','Ultra']]} onChange={v=>updateGraphics('viewDistance',v)}/>
            <SegmentRow label="Particle density" hint="Plankton, seagrass and rain" value={graphics.particleDensity} options={[['low','Low'],['medium','Medium'],['high','High']]} onChange={v=>updateGraphics('particleDensity',v)}/>
            <SliderRow label="Field of view" value={graphics.fov} min={60} max={95} step={1} format={v=>`${v}°`} onChange={v=>updateGraphics('fov',v)}/>
            <SwitchRow label="Adaptive quality" hint="Trims render resolution to hold 60 fps, and gives it back when the frame rate recovers" checked={graphics.autoAdjust} onChange={v=>updateGraphics('autoAdjust',v)}/>
          </>}
          {menuTab==='effects' && <><div className="pane-head"><h2>Post effects</h2><p>Image treatment applied after the scene is drawn.</p></div>
            <SwitchRow label="Bloom" hint="Soft glow on bright highlights" checked={graphics.bloom} onChange={v=>updateGraphics('bloom',v)}/>
            <SliderRow label="Bloom strength" value={graphics.bloomStrength} min={0} max={.8} step={.02} format={v=>v.toFixed(2)} onChange={v=>updateGraphics('bloomStrength',v)}/>
            <SliderRow label="Sharpening" hint="Contrast-adaptive — works on edges, leaves flat water alone" value={graphics.sharpness} min={0} max={1} step={.05} format={v=>v===0?'Off':`${Math.round(v*100)}%`} onChange={v=>updateGraphics('sharpness',v)}/>
            <SwitchRow label="Light shafts" hint="Volumetric sunbeams below the surface" checked={graphics.lightShafts} onChange={v=>updateGraphics('lightShafts',v)}/>
            <SliderRow label="Water refraction" hint="Underwater screen distortion" value={graphics.distortion} min={0} max={1} step={.05} format={v=>v===0?'Off':`${Math.round(v*100)}%`} onChange={v=>updateGraphics('distortion',v)}/>
            <SliderRow label="Vignette" value={graphics.vignette} min={0} max={1.5} step={.05} format={v=>v===0?'Off':`${Math.round(v*100)}%`} onChange={v=>updateGraphics('vignette',v)}/>
            <SliderRow label="Chromatic aberration" value={graphics.aberration} min={0} max={1} step={.05} format={v=>v===0?'Off':`${Math.round(v*100)}%`} onChange={v=>updateGraphics('aberration',v)}/>
            <SwitchRow label="Film grain" hint="Cinematic sensor texture" checked={graphics.filmGrain} onChange={v=>updateGraphics('filmGrain',v)}/>
            <SliderRow label="Star size" hint="Night sky point size" value={graphics.starSize} min={.6} max={1.8} step={.05} format={v=>`${v.toFixed(2)}×`} onChange={v=>updateGraphics('starSize',v)}/>
          </>}
          {menuTab==='environment' && <><div className="pane-head"><h2>Environment</h2><p>Weather and light crossfade continuously — nothing snaps between presets.</p></div>
            <SelectRow label="Weather" hint={weather==='auto'?`Fronts roll through on their own — currently ${liveWeather.toLowerCase()}, wind ${windLabel}`:'Cloud cover, fog, swell and rain all crossfade together'} value={weather} options={[['auto','Automatic'],...Object.entries(weathers).map(([key,v])=>[key,String((v as unknown[])[0])] as [string,string])]} onChange={v=>{setWeather(v);game.current?.setWeather(v);}}/>
            <SelectRow label="Time of day" hint="Jump to a named point on the clock" value={period} options={[...Object.entries(times).map(([key,v])=>[key,String((v as unknown[])[0])] as [string,string]),['custom','Custom']]} onChange={choosePeriod}/>
            <SliderRow label="Clock" hint="The sun and moon follow a real arc across the sky" value={shownHour} min={0} max={23.95} step={.05} format={clock} onChange={chooseHour}/>
            <SliderRow label="Day / night cycle" hint="In-game minutes per real second — zero holds the clock still" value={cycleSpeed} min={0} max={60} step={1} format={v=>v===0?'Paused':`${v}× min/s`} onChange={v=>{setCycleSpeed(v);game.current?.setCycleSpeed(v);}}/>
            <SliderRow label="Weather density" hint="Rain and spray volume" value={graphics.weatherDensity} min={.2} max={1} step={.05} format={v=>`${Math.round(v*100)}%`} onChange={v=>updateGraphics('weatherDensity',v)}/>
          </>}
          {menuTab==='diver' && <><div className="pane-head"><h2>Diver</h2><p>Camera, appearance and radio.</p></div>
            <SegmentRow label="Camera" value={reading.cameraMode} options={[['fps','First person'],['tps','Third person']]} onChange={v=>game.current?.setCameraMode(v)}/>
            <SegmentRow label="Character" value={character} options={[['male','Male'],['female','Female']]} onChange={v=>{setCharacter(v);game.current?.setAppearance(v,skin);}}/>
            <Row label="Skin tone"><fieldset className="skin-control"><legend className="sr-only">Skin tone</legend><div>{skinTones.map((tone:string,i:number)=><label key={tone} style={{backgroundColor:tone}}><input type="radio" name="skin-tone" aria-label={`Skin tone ${i+1}`} checked={skin===tone} onChange={()=>{setSkin(tone);game.current?.setAppearance(character,tone);}}/><span aria-hidden="true">{skin===tone?'✓':''}</span></label>)}</div></fieldset></Row>
            <SwitchRow label="Surface radio" hint="Dialogue and subtitles from Mira" checked={radioEnabled} onChange={v=>{setRadioEnabled(v);game.current?.setDialogueEnabled(v);}}/>
            <SwitchRow label="Ocean audio" hint="Hydrophone ambience and whale song" checked={!muted} onChange={()=>sound()}/>
          </>}
          {menuTab==='sites' && <><div className="pane-head"><h2>Dive sites</h2><p>Swim there freely, or start the dive at a known location.</p></div>
            <div className="site-cards">{destinations.map((site:{name:string;description:string})=><button key={site.name} type="button" disabled={compatibility.isIncompatible} onClick={()=>{if(compatibility.isIncompatible)return;setToast(null);game.current?.visitSite(site.name);enter();}}><strong>{site.name}</strong><span>{site.description}</span><small>Begin dive <ArrowUpRight size={14}/></small></button>)}</div>
          </>}
        </div>
      </div>
      <footer className="menu-foot">
        <p className="menu-keys"><span><kbd>{['forward','left','backward','right'].map(keys).join(' · ')}</kbd>Swim</span><span><kbd>{keys('ascend')}</kbd>Surface</span><span><kbd>{keys('descend')}</kbd>Dive</span><span><kbd>{keys('boost')}</kbd>Boost</span><span><kbd>{keys('flashlight')}</kbd>Light</span><span><kbd>{keys('camera')}</kbd>Camera</span></p>
        <div className="menu-foot-actions">
          <button type="button" onClick={()=>choosePreset('high')}>Restore graphics defaults</button>
          <button type="button" onClick={openPhoto}><Camera size={15}/> Photo mode</button><button type="button" onClick={openJournal}><BookOpen size={15}/> Field notes</button>
          <button type="button" disabled={compatibility.isIncompatible} onClick={()=>{if(compatibility.isIncompatible)return;game.current?.returnToReef();enter();}}>Return to reef</button>
        </div>
      </footer>
    </div></section>}

    <footer className="bottombar"><div className="coordinates"><span className="tiny-dot" /> {started?'EXPEDITION IN PROGRESS':'THE REEF IS CALLING'}<span className="coordinate-detail">{started ? `${((reading.distance || 0) / 1000).toFixed(2)} km from the reef` : '08° 24′ N · 73° 12′ E'}</span></div><div className="footer-tools"><button className="sound-toggle" onClick={sound} aria-label={muted?'Enable ocean audio':'Mute ocean audio'}>{muted?<VolumeX size={17}/>:<AudioLines size={17}/>}<span>SOUND {muted?'OFF':'ON'}</span></button><span className="divider" /><button onClick={fullscreen} aria-label="Toggle fullscreen"><Maximize size={17}/></button></div></footer>
    {photoMode&&<PhotoStudio preferences={preferences} onPreferences={updatePreferences} controls={controls} onClose={closePhoto} capture={capturePhoto} aim={aimPhoto} zoom={zoomPhoto} album={album} notes={discoveries}/>}
    <FieldJournal photos={<PhotoGallery album={album} notes={discoveries}/>} attachedPhotos={name=><PhotoGallery album={album} notes={discoveries} noteName={name}/>} open={journal} onOpenChange={setJournal} notes={discoveries} saved={notesSaved} renderPortrait={renderPortrait} guide={<section className="journal-guide" aria-label="Optional discovery"><h3>Follow the blue glow</h3><p>{guide.discovered?'You found Crystal Grotto. Look for its first encounter below.':'Beyond the kelp, a quiet chamber glows blue. Explore whenever you feel ready.'}</p>{!guide.discovered&&<><Button variant="outline" onClick={()=>game.current?.setGuidance(!guide.active)}>{guide.active?'Stop following':'Follow Crystal Grotto'}</Button>{guide.active&&<p>Bearing {Math.round(guide.bearing)}° · {guide.distance} m away · {Math.abs(guide.vertical)<3?'Near your depth':Math.round(Math.abs(guide.vertical))+' m '+(guide.vertical<0?'deeper':'shallower')}. Match your compass to the bearing; choose a clear route around the rocks.</p>}</>}</section>} radio={radioLog.length>0?<section className="radio-log" aria-label="Radio transcript"><h3>Conversations with Mira</h3>{radioLog.map(line=><p key={line.id}><strong>{line.speaker}</strong>{line.text}</p>)}</section>:null}/>
  </main>;
}
