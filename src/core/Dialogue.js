// Authored, local radio exchanges: no network calls, speech service, or recurring API cost.
const exchanges = {
  welcome: [['Mira','Radio check. I have your signal. You can take your time down there.'],['You','Copy that. It feels quieter than I remembered.'],['Mira','Then let the ocean do most of the talking. I’m here when you need me.']],
  night: [['You','Mira… the water is full of little lights.'],['Mira','Bioluminescence. Something small, making itself visible in all that dark.'],['You','I think I needed to see that tonight.']],
  surface: [['Mira','There you are. Take a breath. Same sky, different world beneath it.'],['You','I’m not quite ready to come back yet.'],['Mira','You don’t have to.']],
  'Basalt Cathedral': [['You','These pillars look like they were built for someone.'],['Mira','No architect. Just old volcanic rock and a very patient ocean.'],['You','I’ll take the long way through.']],
  'The Smoking Gardens': [['You','There’s a whole garden growing around those vents.'],['Mira','I used to think the empty places were empty. Keep looking.']],
  'Seagrass Nursery': [['Mira','Slow down a little here. The small ones are easy to miss.'],['You','I see them. This place is someone’s whole world.']],
  'Palm Cay Anchorage': [['You','The boat is still there.'],['Mira','Of course it is. There’s a dry towel and a terrible cup of coffee waiting.'],['You','Best offer I’ve had all day.']],
  'Sunken Voyager': [['You','Someone stood on that deck once.'],['Mira','Now look at how much life has made a home of it.']],
  'Crystal Grotto': [['You','The light changes everything in here.'],['Mira','Keep your bearings. Beautiful places are still places you need to find your way out of.']],
  creature: [['You','Did you see that? It came right past me.'],['Mira','I did. Hold still a moment. Let it decide how close to come.']],
  far: [['Mira','You’ve come a long way from the reef. How are you doing?'],['You','Good. For once, I don’t need to be anywhere else.'],['Mira','Then we’ll call that a good expedition.']],
};

export class Dialogue {
  constructor(onLine=()=>{}){this.onLine=onLine;this.enabled=true;this.seen=new Set();this.queue=[];this.remaining=0;this.current=null;this.serial=0;}
  trigger(key){if(!this.enabled||this.seen.has(key)||!exchanges[key]||this.queue.length>12)return;this.seen.add(key);this.queue.push(...exchanges[key].map(([speaker,text])=>({speaker,text,topic:key})));}
  discover(name,kind){if(exchanges[name])this.trigger(name);else if(kind==='Species')this.trigger('creature');}
  setEnabled(value){this.enabled=!!value;if(!value){this.queue=[];this.current=null;this.remaining=0;this.onLine(null);}}
  update(dt,active){if(!active||!this.enabled)return;this.remaining-=dt;if(this.remaining>0)return;
    if(this.current){this.current=null;this.onLine(null);this.remaining=1.5;return;}
    if(this.queue.length){this.current={...this.queue.shift(),id:++this.serial};this.remaining=Math.max(6,this.current.text.length*.065);this.onLine(this.current);}
  }
}
