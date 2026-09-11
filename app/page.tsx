'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, AudioLines, BookOpen, Compass, Flashlight, Maximize, Pause, VolumeX, Waves } from 'lucide-react';
import { destinations } from '@/src/world/ExplorationSites.js';
import { times, weathers, skinTones } from '@/src/world/Environment.js';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDeviceCompatibility } from '@/hooks/use-device-compatibility';
import { IncompatibleDeviceWarning } from '@/components/IncompatibleDeviceWarning';

type Reading = { depth: number; heading: number; location: string; fps: number; flashlight: boolean; cameraMode: 'fps' | 'tps'; surface?: boolean; quality?: string; distance?: number };
function Setting({label,value,options,onChange}:{label:string;value:string;options:[string,string][];onChange:(value:string)=>void}) {
  return <div className="setting"><span>{label}</span><Select value={value} onValueChange={v=>{if(v)onChange(v);}}><SelectTrigger aria-label={label}><SelectValue>{options.find(option=>option[0]===value)?.[1]}</SelectValue></SelectTrigger><SelectContent>{options.map(([value,label])=><SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>;
}
type RadioLine = {id:number;speaker:string;text:string;topic:string};
type Discovery = { name: string; kind: string };
export default function Home() {
  const mount = useRef<HTMLDivElement>(null);
  const game = useRef<any>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [started, setStarted] = useState(false), [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false), [journal, setJournal] = useState(false);
  const [weather,setWeather]=useState('clear'),[period,setPeriod]=useState('day'),[character,setCharacter]=useState('male'),[skin,setSkin]=useState('#b77c55');
  const [dialogue,setDialogue]=useState<RadioLine|null>(null),[radioEnabled,setRadioEnabled]=useState(true),[radioLog,setRadioLog]=useState<RadioLine[]>([]);
  const [quality, setQuality] = useState('high');
  const [reading, setReading] = useState<Reading>({ depth: 18, heading: 0, location: 'Coral Garden', fps: 60, flashlight: false, cameraMode: 'fps' });
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
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
    import('@/src/core/Game.js').then(({ Game }) => {
      if (disposed || !mount.current) return;
      game.current = new Game(mount.current, {
        onDialogue: (line:RadioLine|null)=>{setDialogue(line);if(line)setRadioLog(old=>[...old,line]);},
        onReady: () => setReady(true), onReading: (value: Reading) => { setReading(value); if (value.quality) setQuality(value.quality); }, onPause: setPaused,
        onDiscover: (item: Discovery) => {
          setDiscoveries(old => [...old, item]); setToast(item);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setToast(null), 5000);
        },
      });
    }).catch(() => setError('The ocean could not load. Please reload with WebGL enabled in your browser.'));
    return () => { disposed = true; game.current?.dispose(); if (timer.current) clearTimeout(timer.current); };
  }, []);
  function enter() {
    if (compatibility.isIncompatible) return;
    setStarted(true);
    setPaused(false);
    game.current?.start();
  }
  function openJournal() { game.current?.pause(); setJournal(true); }
  function sound() { setMuted(v => { game.current?.setMuted(!v); return !v; }); }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* Embedded browser restriction. */ } }
  return <main className={`ocean-app ${started ? 'is-playing' : ''} ${paused ? 'is-paused' : ''} ${dialogue ? 'has-dialogue' : ''} ${compatibility.isIncompatible ? 'is-incompatible' : ''}`}>
    <IncompatibleDeviceWarning compatibility={compatibility} />
    <div ref={mount} className="ocean-canvas" aria-label="Interactive three-dimensional underwater world" />
    <div className="film-grain" /><div className="edge-shade" />
    <header className="topbar"><div className="wordmark"><Waves size={23} strokeWidth={1.3} /><span>ABYSS<sup>®</sup></span></div>
      {!started ? <div className="expedition-label"><span className="live-dot" /> A LIVING OCEAN <span className="divider" /> EXPEDITION 001</div> : <button className="quiet-button" onClick={() => game.current?.pause()} aria-label="Pause exploration"><Pause size={18} /> PAUSE <kbd>ESC</kbd></button>}
    </header>
    {!started && <section className="start-screen"><div className="eyebrow"><span /> BENEATH THE EVERYDAY</div><h1>ABYSS</h1><p className="intro">There’s a whole world<br />beneath the surface.</p><p className="intro-small">Follow the light. Find the unexpected.<br />Take nothing but a moment.</p><Button className="enter-button" disabled={!ready || !!error || compatibility.isIncompatible} onClick={enter}>{error ? 'Unable to descend' : compatibility.isIncompatible ? 'PC Required to Descend' : ready ? 'Enter the ocean' : 'Descending into the ocean…'}<ArrowUpRight size={20} /></Button>{error ? <p className="error-message" role="alert">{error}</p> : compatibility.isIncompatible ? <div className="start-note text-warn"><span className="tiny-dot dot-warn" /> {compatibility.title.toUpperCase()} · OPEN ON PC TO LAUNCH</div> : <div className="start-note">{ready ? <><span className="tiny-dot" /> NO OBJECTIVES. JUST WONDER.</> : <><span className="loading-line" /> Preparing your expedition</>}</div>}</section>}
    {!started && <div className="scene-caption"><span className="caption-line" /><span>01 / CORAL GARDEN<small>Somewhere worth getting lost.</small></span></div>}
    <aside className="depth-rail" aria-label="Current depth"><span className="rail-label">{reading.surface ? 'SURFACE' : 'DEPTH'}</span><span className="depth-number">{reading.depth.toFixed(1)}<small>m</small></span><div className="depth-ticks">{Array.from({length:17}, (_,i) => <i key={i} className={i%4===0?'major':''} />)}<b style={{top:`${Math.min(94,reading.depth/90*100)}%`}} /></div><span className="rail-end">{reading.surface ? <>ABOVE<br />THE BLUE</> : <>BELOW<br />THE SURFACE</>}</span></aside>
    {started && <><div className="compass-strip"><span>NW</span><i /><span>N</span><i /><b>{String(Math.round(reading.heading)).padStart(3,'0')}°</b><i /><span>NE</span><i /><span>E</span></div><div className="crosshair" /><div className="location-hud"><Compass size={17} strokeWidth={1.2} /><div><span>EXPLORING</span><strong>{reading.location}</strong></div></div><div className="hud-bottom">{dialogue && <div className="radio-subtitle" role="status" aria-live="polite" aria-atomic="true"><span className="radio-speaker"><AudioLines size={13}/>{dialogue.speaker === 'Mira'?'MIRA / SURFACE RADIO':'YOU / DIVER'}</span><p>{dialogue.text}</p></div>}<div className="play-tools"><button onClick={() => game.current?.toggleCamera()} aria-label="Switch camera view"><kbd>V</kbd> {reading.cameraMode === 'fps' ? 'First person' : 'Third person'}</button><button onClick={openJournal}><BookOpen size={18} /> Field notes <span>{discoveries.length}</span></button><button className={reading.flashlight?'active':''} onClick={() => game.current?.toggleFlashlight()}><Flashlight size={18} /><kbd>F</kbd></button></div><div className="controls-hint"><span><kbd>W A S D</kbd> Swim</span><span><kbd>SPACE</kbd> Surface</span><span><kbd>C</kbd> Dive</span><span><kbd>SHIFT</kbd> Glide faster</span><span><kbd>V</kbd> Switch view</span><span>Mouse to look</span></div></div>{toast && <div className="discovery-toast" role="status"><span className="discovery-symbol">✧</span><p>{toast.kind.toUpperCase()} DISCOVERED</p><h2>{toast.name}</h2><span>Added to your field notes</span></div>}</>}
    {started && paused && !journal && <section className="pause-screen" aria-label="Expedition settings"><div className="settings-panel">
      <div className="settings-heading"><div><span className="eyebrow">MAKE THE OCEAN YOURS</span><h2>A moment of stillness.</h2><p>Set the scene for your next dive.</p></div><Button className="enter-button" disabled={compatibility.isIncompatible} onClick={enter}>{compatibility.isIncompatible ? 'PC Required' : 'Continue exploring'} <ArrowUpRight size={19}/></Button></div>
      <div className="settings-grid">
        <section className="settings-section"><span className="section-number">01 / THE WORLD</span><h3>Light & atmosphere</h3>
          <Setting label="Weather" value={weather} options={Object.entries(weathers).map(([key,v])=>[key,String(v[0])])} onChange={v=>{setWeather(v);game.current?.setWeather(v);}}/>
          <Setting label="Time of day" value={period} options={Object.entries(times).map(([key,v])=>[key,String(v[0])])} onChange={v=>{setPeriod(v);game.current?.setTime(v);}}/>
          <p className="setting-note">Surface to see the sky. Light and weather also reach the reef below.</p>
        </section>
        <section className="settings-section"><span className="section-number">02 / YOUR DIVER</span><h3>Meet the explorer</h3>
          <Setting label="Character" value={character} options={[["male","Male"],["female","Female"]]} onChange={v=>{setCharacter(v);game.current?.setAppearance(v,skin);}}/>
          <fieldset className="skin-control"><legend>Skin tone</legend><div>{skinTones.map((tone,i)=><label key={tone} style={{backgroundColor:tone}}><input type="radio" name="skin-tone" aria-label={`Skin tone ${i+1}`} checked={skin===tone} onChange={()=>{setSkin(tone);game.current?.setAppearance(character,tone);}}/><span aria-hidden="true">{skin===tone?'✓':''}</span></label>)}</div></fieldset>
          <p className="setting-note">Your diver stays the same in both views. Look down to see your body.</p>
        </section>
        <section className="settings-section"><span className="section-number">03 / YOUR VIEW</span><h3>Explore your way</h3>
          <Setting label="Camera view" value={reading.cameraMode} options={[["fps","First person · full body"],["tps","Third person · follow"]]} onChange={v=>game.current?.setCameraMode(v)}/>
          <Setting label="Water detail" value={quality} options={[["low","Low"],["medium","Medium"],["high","High"]]} onChange={v=>{setQuality(v);game.current?.setQuality(v);}}/>
          <Setting label="Companion dialogue" value={radioEnabled?'on':'off'} options={[["on","On · radio subtitles"],["off","Off · quiet exploration"]]} onChange={v=>{setRadioEnabled(v==='on');game.current?.setDialogueEnabled(v==='on');}}/>
          <p className="setting-note">Detail adapts when needed to keep your expedition smooth.</p>
        </section>
      </div>
      <section className="expedition-sites" aria-label="Explore new areas"><div className="sites-heading"><span className="section-number">04 / BEYOND THE REEF</span><h3>Choose your next discovery</h3><p>Swim there freely, or begin a dive at one of these sites.</p></div><div className="site-cards">{destinations.map(site=><button key={site.name} disabled={compatibility.isIncompatible} onClick={()=>{if(compatibility.isIncompatible)return;setToast(null);game.current?.visitSite(site.name);enter();}}><strong>{site.name}</strong><span>{site.description}</span><small>Begin dive <ArrowUpRight size={14}/></small></button>)}</div></section>
      <div className="settings-footer"><p className="pause-tip">WASD · Swim &nbsp; Space · Surface &nbsp; C · Dive<br/>Shift · Boost &nbsp; F · Flashlight &nbsp; V · Camera<br/>Mouse to look, or click and drag.</p><div className="pause-actions"><button onClick={openJournal}><BookOpen size={16}/> Field notes</button><button disabled={compatibility.isIncompatible} onClick={()=>{if(compatibility.isIncompatible)return;game.current?.returnToReef();enter();}}>Return to reef</button></div></div>
    </div></section>}
    <footer className="bottombar"><div className="coordinates"><span className="tiny-dot" /> {started?'EXPEDITION IN PROGRESS':'THE REEF IS CALLING'}<span className="coordinate-detail">{started ? `${((reading.distance || 0) / 1000).toFixed(2)} km from the reef` : '08° 24′ N · 73° 12′ E'}</span></div><div className="footer-tools"><button className="sound-toggle" onClick={sound} aria-label={muted?'Enable ocean audio':'Mute ocean audio'}>{muted?<VolumeX size={17}/>:<AudioLines size={17}/>}<span>SOUND {muted?'OFF':'ON'}</span></button><span className="divider" /><button onClick={fullscreen} aria-label="Toggle fullscreen"><Maximize size={17}/></button></div></footer>
    <Dialog open={journal} onOpenChange={setJournal}><DialogContent className="journal-panel"><DialogTitle className="journal-title">Field notes</DialogTitle><DialogDescription className="journal-description">Small encounters. A bigger world.</DialogDescription><div className="journal-count">{discoveries.length} discoveries this expedition</div><div className="journal-entries">{discoveries.length?discoveries.map((d,i)=><div key={d.name}><span>{String(i+1).padStart(2,'0')}</span><section><small>{d.kind}</small><h3>{d.name}</h3></section><Compass size={19}/></div>):<p>Swim close to marine life and explore the reef. Your discoveries will appear here.</p>}</div>{radioLog.length>0&&<section className="radio-log" aria-label="Radio transcript"><h3>Conversations with Mira</h3>{radioLog.map(line=><p key={line.id}><strong>{line.speaker}</strong>{line.text}</p>)}</section>}<p className="journal-footnote">Look down to watch your fins. Hold Space to surface.<br />Beyond the reef, follow the islands into open water.</p></DialogContent></Dialog>
  </main>;
}




