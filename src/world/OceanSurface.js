import * as T from 'three';
import { time, waterHeight, waveStrength, seededRandom } from './materials.js';
import { SkyModel, skyGLSL, skyUniformsGLSL } from './SkyModel.js';

const waves=`float wave(vec2 p){return uWaves*(sin(p.x*.075+uTime*.65)*.28+sin(p.y*.11+uTime*.85)*.16+sin((p.x+p.y)*.04-uTime*.4)*.18);}`;
// Cheap hashed noise for the sea's small-scale detail, which never needs to match the sky.
const hashLib=`
float hashSky(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noiseSky(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hashSky(i),hashSky(i+vec2(1,0)),f.x),mix(hashSky(i+vec2(0,1)),hashSky(i+vec2(1)),f.x),f.y);}`;
const skyUniforms=skyUniformsGLSL;

export class OceanSurface {
  constructor(scene){
    this.model=new SkyModel();
    this.uniforms={
      uNight:{value:0},uUnderColor:{value:new T.Color('#238d99')},uSun:{value:new T.Vector3(.38,.58,-.52).normalize()},
      uMoon:{value:new T.Vector3(-.38,-.58,.52).normalize()},uHorizon:{value:new T.Color('#b8d4d6')},uZenith:{value:new T.Color('#296bad')},
      uLight:{value:1},uCloud:{value:.52},uHaze:{value:0},uFlash:{value:0},uRain:{value:0},
      // Wind is shared by everything it should touch: cloud speed, surface chop and whitecaps.
      uWind:{value:.14},uWindDir:{value:new T.Vector2(.927,.375)},uCloudDrift:{value:0},
      // The atmosphere. Everything here is written by Environment from the same SkyModel the dome uses.
      uNoise:{value:this.model.noise},uSunLUT:{value:this.model.sunTable.texture},uMoonLUT:{value:this.model.moonTable.texture},
      uSunColor:{value:new T.Color(1,1,1)},uSunVisible:{value:1},uCloudSun:{value:new T.Color(1,1,1)},uCloudMoon:{value:new T.Color(0,0,0)},
      uAmbient:{value:new T.Color(.4,.5,.6)},uCloudTint:{value:new T.Color(.8,.8,.8)},uCloudCover:{value:0},uCloudThickness:{value:1},
      uSunPower:{value:20},uMoonPower:{value:0},uMoonGlow:{value:0},uVeil:{value:0},uVeilColor:{value:new T.Color(.5,.55,.6)},
      uNightHorizon:{value:new T.Color(0,0,0)},uNightZenith:{value:new T.Color(0,0,0)},uStarVisibility:{value:0},uStarRotation:{value:new T.Matrix3()},
      uCirrus:{value:.6},uRainbow:{value:0},uStrikeDir:{value:new T.Vector3(1,0,0)},uStrikeElevation:{value:.08},uStrikeSeed:{value:0},uBolt:{value:0},
    };

    const waterGeometry=new T.PlaneGeometry(2,2,160,160);waterGeometry.rotateX(-Math.PI/2);
    const pos=waterGeometry.attributes.position;
    for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setXYZ(i,Math.sign(x)*Math.pow(Math.abs(x),2.7)*3600,0,Math.sign(z)*Math.pow(Math.abs(z),2.7)*3600);}
    this.water=new T.Mesh(waterGeometry,new T.ShaderMaterial({side:T.DoubleSide,uniforms:{uTime:time,uWaves:waveStrength,...this.uniforms},vertexShader:`uniform float uTime;uniform float uWaves;varying vec3 vWorld;${waves}void main(){vec4 p=modelMatrix*vec4(position,1.);p.y=27.+wave(p.xz);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,fragmentShader:`uniform float uTime;uniform float uWaves;uniform vec3 uUnderColor;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uLight;uniform float uCloud;uniform float uHaze;uniform float uFlash;uniform float uRain;uniform float uWind;
      uniform vec3 uSunColor;uniform float uSunVisible;uniform vec3 uCloudTint;uniform float uCloudCover;varying vec3 vWorld;${skyUniforms}${waves}${hashLib}${skyGLSL}
      float ripples(vec2 p){mat2 r=mat2(.8,-.6,.6,.8);return noiseSky(p)*.55+noiseSky(r*p*2.13+7.3)*.3+noiseSky(r*p*4.27-4.8)*.15;}
      void main(){vec2 p=vWorld.xz;
      // Every normal comes from one continuous world-space height field. No repeating line mask.
      float epsilon=.16;float dx=(wave(p+vec2(epsilon,0))-wave(p-vec2(epsilon,0)))/(2.*epsilon);
      float dz=(wave(p+vec2(0,epsilon))-wave(p-vec2(0,epsilon)))/(2.*epsilon);
      float viewDistance=length(vWorld-cameraPosition);
      float detail=1.-smoothstep(25.,180.,viewDistance);
      vec2 q=p*.75+vec2(uTime*.13,-uTime*.09);
      // Everything below is small-scale and invisible past the detail fade, so skipping it there
      // takes roughly fifty sine evaluations off every distant water pixel — most of the screen.
      if(detail>.003){
        float chop=.25*detail*(1.+uWind*.9);
        dx+=(ripples(q+vec2(.12,0))-ripples(q-vec2(.12,0)))*chop;
        dz+=(ripples(q+vec2(0,.12))-ripples(q-vec2(0,.12)))*chop;
        // Rain stipples the surface with fast, short-lived chop.
        if(uRain>.004){vec2 r=p*2.4+uWindDir.yx*uTime*.6;float amount=uRain*detail*.7;
          dx+=(ripples(r+vec2(.09,0))-ripples(r-vec2(.09,0)))*amount;
          dz+=(ripples(r+vec2(0,.09))-ripples(r-vec2(0,.09)))*amount;
          // Individual impact rings: one hashed cell per drop, each expanding and fading on its own
          // clock. Real splash rings are only legible for the first few metres, so they fade out
          // well before the general chop does rather than tiling off towards the horizon.
          float splash=uRain*(1.-smoothstep(9.,44.,viewDistance));
          if(splash>.01){
            vec2 grid=p*2.3,cell=floor(grid),local=fract(grid)-.5;
            float seed=hashSky(cell);
            // Jitter the drop inside its cell and give it its own rate, or the impacts read as a
            // lattice of dots all pulsing on one clock.
            local-=(vec2(hashSky(cell+11.7),hashSky(cell-4.3))-.5)*.55;
            float phase=fract(uTime*(.75+seed*1.15)+seed*13.1);
            float radius=phase*.38,distance=length(local),fade=(1.-phase)*(1.-phase);
            float ring=exp(-pow((distance-radius)*16.,2.))*fade*splash*1.7;
            dx+=local.x/max(distance,1e-3)*ring;dz+=local.y/max(distance,1e-3)*ring;}}
      }
      vec3 n=normalize(vec3(-dx,1.,-dz)),view=normalize(cameraPosition-vWorld),sun=normalize(uSun),moon=normalize(uMoon);
      float fresnel=.02+.98*pow(1.-clamp(dot(n,view),0.,1.),5.);
      vec3 reflected=reflect(-view,n);
      // The reflection is the same sky the dome draws: the horizon ring at the bottom, the zenith at
      // the top, and the cloud deck's own colour laid over it in proportion to how overcast it is.
      // Over open water the reflected ray and the view ray share a bearing, so one lookup serves both
      // the reflection and the haze.
      float flatDistance=length(vWorld.xz-cameraPosition.xz);
      vec3 ring=horizonRing(-view);
      vec3 sky=mix(ring,uZenith,pow(max(reflected.y,0.),.45));
      // A wind-roughened sea reflects a spread of the sky above the horizon, so under a deck it picks
      // up the cloud's darker colour even at grazing angles rather than mirroring the bright horizon.
      sky=mix(sky,uCloudTint,uCloudCover*(.3+.45*smoothstep(-.02,.3,reflected.y)+.2*uWind));
      // Cloud shadows. The water point is projected up the sun's direction to the cloud shell and
      // tested against the same field the sky draws, so the dark patches sailing across the sea are
      // the shadows of the clouds you can actually see overhead.
      float shadow=0.;
      // Only the broad shape of the field matters for a soft shadow, and past a few kilometres the
      // haze has swallowed the sea anyway.
      if(gl_FrontFacing&&uSunVisible>.02&&uCloudCover>.01&&sun.y>.04&&flatDistance<2800.){
        vec2 lifted=vWorld.xz+sun.xz/sun.y*(CLOUD_HEIGHT-27.);
        shadow=cloudAlpha(cloudFieldBroad(cloudUV(lifted)),uCloud)*.92*(1.-smoothstep(1800.,2800.,flatDistance));
      }
      float sunUp=smoothstep(-.06,.09,sun.y),moonUp=smoothstep(-.04,.10,moon.y);
      float spec=pow(max(dot(reflect(-sun,n),view),0.),220.)*sunUp;
      float moonSpec=pow(max(dot(reflect(-moon,n),view),0.),260.)*moonUp;
      // A low sun lays a broad glitter path across the water towards the viewer.
      float path=pow(max(dot(reflected,sun),0.),42.)*(1.-smoothstep(.04,.3,sun.y))*sunUp;
      vec3 sunlight=uSunColor*uSunVisible*(1.-shadow);
      vec3 color=mix(vec3(.012,.16,.19)*(.2+uLight*.8)*(1.-shadow*.45*uSunVisible),sky,fresnel)
        +sunlight*(spec*2.4+path*(.25+fresnel)*1.6)
        +vec3(.62,.76,1.)*moonSpec*uNight*.85;
      if(gl_FrontFacing){
        // Whitecaps ride the crests of the swell — the vertex stage already displaced them, so the
        // crest height is free here — and only break once the wind is up. Calm water never foams.
        float crest=(vWorld.y-27.)/max(uWaves,.001);
        float near=1.-smoothstep(110.,360.,viewDistance);
        float speckle=detail>.003?(.35+.65*smoothstep(.40,.70,ripples(q*1.15))):.55;
        float foam=clamp(smoothstep(.13,.40,crest)*smoothstep(.24,.80,uWind)*speckle*near*.75+uRain*uWind*detail*.08,0.,.5);
        // Foam scatters the whole sky, so it takes its brightness from the horizon rather than from
        // the direct light the storm has already crushed — otherwise whitecaps come out grey.
        color=mix(color,mix(uHorizon,vec3(1.),.4)*(.38+.62*uLight),foam);
      } else {
        float window=1.-smoothstep(.68,.78,abs(dot(n,view)));float grain=detail>.003?.94+.06*ripples(q*.4):1.;
        // Snell's window looks up at the sky overhead as much as at the horizon, and it is seen through
        // water, which takes the red out first. Without both, the saturated horizon of a sunset turned
        // the whole window into a red disc.
        vec3 through=mix(uHorizon,uZenith,.55);
        through=mix(vec3(dot(through,vec3(.3,.59,.11))),through,.45)*vec3(.6,.92,1.06);
        color=mix(through*(.38+uLight*.5),vec3(.018,.14,.17)*(.25+uLight*.75),window)*grain;
        color+=vec3(.65,.84,.8)*pow(max(dot(normalize(vWorld-cameraPosition),sun),0.),110.)*uLight*.35*sunUp;
      }
      if(detail*uNight>.004){
        float glow=pow(smoothstep(.55,.85,ripples(q*1.8)),5.)*detail*uNight;
        color+=vec3(.015,.3,.42)*glow*(.65+.35*sin(uTime*.8+p.x*.3))*.55;
      }
      color+=vec3(.70,.78,1.)*uFlash*(.10+.35*fresnel);
      // Aerial perspective. The sea fades into the horizon ring for its own bearing and reaches it
      // completely before the surface mesh ends, so the edge of the world is never visible — the
      // water simply becomes the sky at the horizon, as it does at sea.
      float haze=max(1.-exp(-pow(flatDistance*(1.+uHaze*1.2)/2200.,1.5)),smoothstep(2300.,3400.,flatDistance));
      color=mix(color,gl_FrontFacing?ring:uUnderColor,haze);
      color+=(hashSky(gl_FragCoord.xy*1.37)-.5)*.0035;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`}));this.water.frustumCulled=false;scene.add(this.water);

    this.sky=new T.Mesh(new T.SphereGeometry(4200,64,32),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{uTime:time,...this.uniforms},
      vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform float uTime;uniform vec3 uHorizon;uniform vec3 uZenith;uniform float uNight;uniform float uCloud;uniform float uHaze;uniform float uFlash;uniform float uRain;
      uniform vec3 uSunColor;uniform float uSunVisible;uniform vec3 uCloudSun;uniform vec3 uCloudMoon;uniform vec3 uAmbient;uniform float uCloudThickness;
      uniform float uMoonGlow;uniform float uStarVisibility;uniform mat3 uStarRotation;
      uniform float uCirrus;uniform float uRainbow;uniform vec3 uStrikeDir;uniform float uStrikeElevation;uniform float uStrikeSeed;uniform float uBolt;
      varying vec3 vDirection;${skyUniforms}${skyGLSL}
      float bump(float x,float c,float w){float k=(x-c)/w;return max(0.,1.-k*k);}
      // Noise on the sphere without a projection axis: three planar lookups weighted by the normal.
      // Sampling one plane smeared the Milky Way into streaks wherever it crossed that plane edge-on.
      float triplanar(vec3 p,float k){vec3 w=p*p;w/=w.x+w.y+w.z;return vnoise(p.yz*k)*w.x+vnoise(p.zx*k+3.7)*w.y+vnoise(p.xy*k-1.9)*w.z;}
      void main(){vec3 d=normalize(vDirection);float up=max(d.y,0.);
      vec3 sun=normalize(uSun),moon=normalize(uMoon);
      vec3 horizon=horizonRing(d);

      // Clear sky from the scattering table: sun and moon over a faint night floor, under whatever
      // veil of haze the weather has drawn across it.
      vec3 color=clearSky(d);

      // Milky Way and its dust lanes, turning with the star field.
      if(uStarVisibility>.01){
        vec3 sd=transpose(uStarRotation)*d;
        float band=exp(-pow(dot(sd,normalize(vec3(.45,.8,.36)))*6.,2.));
        float dust=triplanar(sd,38.)*.6+triplanar(sd,91.)*.4;
        float lanes=smoothstep(.35,.7,triplanar(sd,14.));
        color+=vec3(.05,.058,.11)*band*(dust*.8+.2)*(1.-lanes*.55)*uStarVisibility*smoothstep(0.,.25,d.y);
      }

      // Sun disc with limb darkening, coloured by the air it shines through, so it reddens on its own.
      float sunAngle=acos(clamp(dot(d,sun),-1.,1.));float sunAA=fwidth(sunAngle)+.0005;
      float sunDisc=1.-smoothstep(.0088-sunAA,.0088+sunAA,sunAngle);
      float limb=sqrt(max(0.,1.-pow(sunAngle/.0088,2.)));
      color+=uSunColor*sunDisc*(.5+.5*limb)*46.*uSunVisible*smoothstep(-.004,.004,d.y);

      // The moon is a lit sphere: its phase is the real angle between it and the sun. It is drawn at
      // about three times its true size, which is what the eye reports anyway and what lets the
      // phase read at game resolution.
      float moonAngle=acos(clamp(dot(d,moon),-1.,1.));float moonAA=fwidth(moonAngle)+.0004;
      float moonDisc=1.-smoothstep(.018-moonAA,.018+moonAA,moonAngle);
      if(moonDisc>0.){
        vec3 tangent=normalize(cross(moon,vec3(0.,1.,.0001))),bitangent=cross(tangent,moon);
        vec2 local=vec2(dot(d,tangent),dot(d,bitangent))/.018;
        vec3 normal=normalize(tangent*local.x+bitangent*local.y-moon*sqrt(max(0.,1.-dot(local,local))));
        float lit=smoothstep(-.04,.10,dot(normal,sun));
        float maria=.70+.30*vnoise(local*2.4+11.3)*vnoise(local*5.2-3.7);
        vec3 face=vec3(.96,.94,.9)*(lit*maria*2.2+.018);
        color=mix(color,face,moonDisc*smoothstep(-.02,.06,moon.y)*(1.-uVeil*.8));
      }
      color+=vec3(.55,.63,.82)*(exp(-moonAngle*20.)*.08+exp(-moonAngle*3.5)*.012)*uMoonGlow;

      // Lightning lights the cloud around its bearing, not the whole dome at once.
      vec2 flatD=normalize(d.xz+vec2(1e-5,0.)),strikeFlat=normalize(uStrikeDir.xz+vec2(1e-5,0.));
      float strikeAround=pow(max(dot(flatD,strikeFlat),0.),10.);
      float strikeSide=dot(d.xz,vec2(-strikeFlat.y,strikeFlat.x)),strikePixel=fwidth(strikeSide)+1e-5;

      // High cirrus, stretched along the wind and caught by the low sun first and last.
      float cloudCoverHere=0.;
      if(uCirrus>.01&&d.y>0.){
        float tc=shell(d,CIRRUS_HEIGHT);vec2 cw=d.xz*tc+cameraPosition.xz;
        vec2 cq=vec2(dot(cw,uWindDir)*.55,dot(cw,vec2(-uWindDir.y,uWindDir.x)))/CIRRUS_SCALE+uWindDir*uCloudDrift*.6;
        float wisps=fbmBroad(cq*vec2(1.,2.)+vnoise(cq*1.3)*.9);
        float ca=smoothstep(.6,.86,wisps)*uCirrus*smoothstep(0.,.08,d.y);
        vec3 cc=uCloudSun*(.55+henyeyGreenstein(dot(d,sun),.6)*.9)+uAmbient*.9;
        cc=mix(cc,horizon,1.-exp(-tc/220000.));
        color=mix(color,cc,ca*.3);
      }

      // Cumulus on the curved 1.8 km shell.
      float tCloud=shell(d,CLOUD_HEIGHT);
      vec2 uv=cloudUV(d.xz*tCloud+cameraPosition.xz);
      float detail=1.-smoothstep(9000.,70000.,tCloud);
      float field=cloudField(uv,detail);
      float alpha=cloudAlpha(field,uCloud)*smoothstep(-.002,.04,d.y);
      if(alpha>.002){
        vec2 toSun=normalize(sun.xz+vec2(1e-5,0.));
        // One probe a step towards the sun gives the deck self-shadowing: sunlit tops, dark bellies.
        float probe=cloudFieldBroad(uv+toSun*.07);
        float excess=max(field-uCloud,0.),toward=max(probe-uCloud,0.);
        float shade=exp(-toward*uCloudThickness*6.);
        float core=exp(-excess*uCloudThickness*3.);
        float mu=dot(d,sun);
        // Forward scattering is the silver lining, and it lives in the thin edges: the dense heart
        // of a cloud in front of the sun is dark, only its fringe blazes. Weighting the forward lobe
        // by thinness keeps a low sun from turning the whole deck around it white.
        float thin=exp(-excess*9.);
        float phase=henyeyGreenstein(mu,.6)*(.35+2.1*thin)+henyeyGreenstein(mu,-.25)*.8+.3;
        float powder=1.-exp(-excess*16.);
        vec3 cloud=uCloudSun*shade*phase*mix(1.,powder,.45)*(.42+.58*core)
          +uAmbient*(.5+.5*core)*max(.25,1.-.35*excess*uCloudThickness)
          +uCloudMoon*shade*(henyeyGreenstein(dot(d,moon),.55)*2.+.4);
        cloud+=vec3(.74,.82,1.)*uFlash*(.25+strikeAround*2.6)*(.35+.65*core);
        // Aerial perspective: distant cloud dissolves into the horizon it sits over. It has to reach
        // the horizon colour completely — any residue of a dark cloud belly 150 km out draws a black
        // line along a bright sunset horizon, which is the edge of the world all over again.
        cloud=mix(cloud,horizon,1.-exp(-tCloud/34000.));
        color=mix(color,cloud,alpha);cloudCoverHere=alpha;
      }
      color+=vec3(.74,.82,1.)*uFlash*(.03+.22*strikeAround)*(1.-alpha);

      // Distant rain hanging under the deck as soft grey curtains.
      if(uRain>.02){
        float band=smoothstep(0.,.012,d.y)*(1.-smoothstep(.025,.10,d.y));
        vec2 around=flatD*16.+uWindDir*uCloudDrift*30.;
        float curtain=smoothstep(.35,.7,vnoise(around))*smoothstep(.2,.6,vnoise(around*2.7+vec2(0.,d.y*4.)));
        color=mix(color,horizon*.7,curtain*band*uRain*.5);
      }

      // Rainbow: 40.6°–42.4° from the antisolar point, violet inside, with a fainter reversed
      // secondary bow outside it and the characteristically brighter sky within the primary.
      if(uRainbow>.002){
        float a=acos(clamp(dot(d,-sun),-1.,1.));
        float r=(a-.7086)/.0314,r2=(a-.8938)/.05;
        vec3 bow=vec3(bump(r,.82,.3),bump(r,.5,.28),bump(r,.18,.28))+vec3(bump(r2,.18,.3),bump(r2,.5,.28),bump(r2,.82,.3))*.2;
        // The rain curtain that makes the bow hangs in front of the cloud, so the deck behind it does
        // not hide it — a bow is at its most vivid against dark cloud.
        float mask=uRainbow*smoothstep(0.,.03,d.y)*(1.-cloudCoverHere*.15);
        color+=bow*mask*(dot(uCloudSun,vec3(.3,.59,.11))*.26+.025)+horizon*(1.-smoothstep(.62,.705,a))*mask*.06;
      }

      // Lightning bolt: a jagged channel from the cloud base to the sea on the strike's bearing.
      if(uBolt>.01&&dot(flatD,strikeFlat)>.95&&d.y<uStrikeElevation&&d.y>-.002){
        float e=clamp(d.y/uStrikeElevation,0.,1.);
        float channel=(vnoise(vec2(e*6.,uStrikeSeed))-.5)*.034+(vnoise(vec2(e*29.,uStrikeSeed*1.7))-.5)*.010+(vnoise(vec2(e*95.,uStrikeSeed*2.3))-.5)*.003;
        float fork=channel+(e-.72)*.05+(vnoise(vec2(e*40.,uStrikeSeed*3.1))-.5)*.006;
        float trunk=abs(strikeSide-channel),branch=abs(strikeSide-fork);
        float core=1.-smoothstep(strikePixel*.5,strikePixel*1.6,trunk);
        float twig=(1.-smoothstep(strikePixel*.4,strikePixel*1.2,branch))*step(.38,e)*step(e,.72)*.6;
        float glow=exp(-trunk/(strikePixel*7.));
        color+=vec3(.86,.9,1.)*(core*9.+twig*5.+glow*.9)*uBolt;
      }

      // Sea mist gathers along the horizon and swallows the lower sky.
      color=mix(color,horizon,uHaze*exp(-up*7.)*.85);
      color+=(fract(sin(dot(gl_FragCoord.xy*1.37+fract(uTime),vec2(127.1,311.7)))*43758.5453)-.5)*.004;
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    // Drawn last among the opaque queue rather than first. The sky shader is the most expensive one
    // in the scene, and it writes no depth, so ordering it behind everything else lets early-Z reject
    // every pixel the terrain and water already cover before it shades them.
    }`}));this.sky.frustumCulled=false;this.sky.renderOrder=1000;scene.add(this.sky);

    const random=seededRandom(90210),starCount=2600;
    const starPositions=new Float32Array(starCount*3),starSizes=new Float32Array(starCount),starBrightness=new Float32Array(starCount),starPhase=new Float32Array(starCount),starHue=new Float32Array(starCount);
    for(let i=0;i<starCount;i++){
      // Uniform over the whole sphere: the field now turns with the clock, so stars rise and set.
      const y=random()*2-1,a=random()*Math.PI*2,r=Math.sqrt(1-y*y)*3900;
      starPositions.set([Math.cos(a)*r,y*3900,Math.sin(a)*r],i*3);
      // Magnitude distribution: a few bright anchors, many faint ones.
      const magnitude=Math.pow(random(),2.6);
      starSizes[i]=1.05+magnitude*2.6;starBrightness[i]=.20+magnitude*.95;starPhase[i]=random();starHue[i]=random();
    }
    const starGeometry=new T.BufferGeometry();
    starGeometry.setAttribute('position',new T.BufferAttribute(starPositions,3));
    starGeometry.setAttribute('aSize',new T.BufferAttribute(starSizes,1));
    starGeometry.setAttribute('aBrightness',new T.BufferAttribute(starBrightness,1));
    starGeometry.setAttribute('aPhase',new T.BufferAttribute(starPhase,1));
    starGeometry.setAttribute('aHue',new T.BufferAttribute(starHue,1));
    // Soft radial falloff instead of a hard disc: sub-pixel points were the source of the shimmer.
    this.stars=new T.Points(starGeometry,new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
      uniforms:{uTime:time,uPixelRatio:{value:1},uStarSize:{value:1},uStarVisibility:this.uniforms.uStarVisibility,uCloud:this.uniforms.uCloud,uHaze:this.uniforms.uHaze,
        ...Object.fromEntries(['uNoise','uSunLUT','uMoonLUT','uSun','uMoon','uSunPower','uMoonPower','uNightHorizon','uNightZenith','uVeil','uVeilColor','uCloudDrift','uWindDir'].map(k=>[k,this.uniforms[k]]))},
      vertexShader:`uniform float uPixelRatio;uniform float uStarSize;attribute float aSize;attribute float aBrightness;attribute float aPhase;attribute float aHue;
varying float vBrightness;varying vec3 vDirection;varying float vPhase;varying float vHue;
void main(){vDirection=normalize(mat3(modelMatrix)*position);vBrightness=aBrightness;vPhase=aPhase;vHue=aHue;
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
gl_PointSize=max(2.4,aSize*uStarSize)*uPixelRatio;}`,
      fragmentShader:`uniform float uTime;uniform float uStarVisibility;uniform float uCloud;uniform float uHaze;
varying float vBrightness;varying vec3 vDirection;varying float vPhase;varying float vHue;${skyUniforms}${skyGLSL}
void main(){
  vec2 q=gl_PointCoord-.5;float d2=dot(q,q);
  if(d2>.25||vDirection.y<.005)discard;
  float shape=exp(-d2*30.)+exp(-d2*8.)*.22;
  // Stars scintillate harder low down, through more air.
  float low=1.-smoothstep(.05,.5,vDirection.y);
  float twinkle=1.-(.18+.3*low)*(.5+.5*sin(uTime*(1.1+vPhase*2.6)+vPhase*37.));
  vec2 uv=cloudUV(vDirection.xz*shell(vDirection,CLOUD_HEIGHT)+cameraPosition.xz);
  float cover=cloudAlpha(cloudFieldBroad(uv),uCloud);
  float extinction=smoothstep(.005,.18,vDirection.y);
  float alpha=shape*uStarVisibility*(1.-cover)*(1.-uHaze*.8)*extinction*vBrightness*twinkle;
  if(alpha<.0025)discard;
  vec3 tint=mix(vec3(.60,.74,1.),vec3(1.,.86,.68),vHue);
  gl_FragColor=vec4(tint,alpha);
}`}));
    this.stars.frustumCulled=false;this.stars.renderOrder=-9;scene.add(this.stars);
  }
  update(camera,underwater){this.water.position.set(camera.position.x,27,camera.position.z);this.sky.position.copy(camera.position);this.stars.position.copy(camera.position);this.sky.visible=underwater<.98;this.stars.visible=underwater<.98&&this.uniforms.uStarVisibility.value>.01;}
  height(x,z,t){return waterHeight(x,z,t);}
}
