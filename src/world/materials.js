import * as T from 'three';
export const time = { value: 0 };
export const depthLight = { value: 1 };
export function oceanMaterial(color, options = {}) {
  const material = new T.MeshStandardMaterial({ color, roughness: .83, ...options });
  material.onBeforeCompile = shader => {
    shader.uniforms.oceanTime = time;
    shader.uniforms.depthLight = depthLight;
    shader.vertexShader = 'varying vec3 vOceanWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 oceanP = vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        oceanP = instanceMatrix * oceanP;
      #endif
      vOceanWorld = (modelMatrix * oceanP).xyz;`);
    shader.fragmentShader = 'uniform float oceanTime; uniform float depthLight; varying vec3 vOceanWorld;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      vec2 p = vOceanWorld.xz * .52 + vec2(oceanTime*.14, oceanTime*.08);
      p += .35 * sin(p.yx * 1.8 + oceanTime * .22);
      float a = sin(p.x*3.1+sin(p.y*2.7)) + sin(p.y*3.3+cos(p.x*2.5));
      float b = sin(p.x*2.2-p.y*1.7+oceanTime*.22) + cos(p.y*3.6+p.x);
      float c = pow(1.0-abs(sin(a+b)), 15.0);
      float sunlight = smoothstep(-70.0, 10.0, vOceanWorld.y) * depthLight * (1.-smoothstep(26.5,27.4,vOceanWorld.y));
      gl_FragColor.rgb += vec3(.065,.13,.10) * c * sunlight;

      #include <dithering_fragment>`);
  };
  return material;
}
export function swayMaterial(color, amplitude = .3, options = {}) {
  const m = oceanMaterial(color, { side: T.DoubleSide, ...options });
  const original = m.onBeforeCompile;
  m.onBeforeCompile = s => {
    original(s);
    s.vertexShader = 'uniform float oceanTime;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float phase = 0.0;
      #ifdef USE_INSTANCING
        phase = instanceMatrix[3].x*.4 + instanceMatrix[3].z*.3;
      #endif
      transformed.x += sin(oceanTime*.65 + position.y*.36 + phase) * pow(max(position.y,0.0),1.15) * ${amplitude.toFixed(3)};
      transformed.z += cos(oceanTime*.42 + phase + position.y*.3) * max(position.y,0.0) * ${(amplitude*.35).toFixed(3)};`);
  };
  m.customProgramCacheKey = () => `sway-${amplitude}`;
  return m;
}
export function seededRandom(seed = 812) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
export const SEA_LEVEL = 27;
export const waveStrength = { value: 1 };
export function waterHeight(x,z,t=0){return SEA_LEVEL+waveStrength.value*(Math.sin(x*.075+t*.65)*.28+Math.sin(z*.11+t*.85)*.16+Math.sin((x+z)*.04-t*.4)*.18);}
export function regionSeed(x,z){let n=Math.imul(x,374761393)^Math.imul(z,668265263)^8193;n=Math.imul(n^(n>>>13),1274126177);return (n^(n>>>16))>>>0;}
export function floorHeight(x,z) {
  const original=-4-Math.max(0,-z-20)*.24+Math.sin(x*.065)*1.2+Math.cos(z*.095)*.8+Math.sin(x*.21+z*.13)*.3;
  const distance=Math.hypot(x,z+40),blend=T.MathUtils.smoothstep(distance,150,290);
  const ridges=Math.sin(x*.013+Math.sin(z*.006)*2)*Math.cos(z*.009)*18;
  const deep=-38+ridges+Math.sin(x*.038+z*.028)*3+Math.cos(z*.08)*.8;
  let height=T.MathUtils.lerp(original,deep,blend);
  // Stable island chains, with a reachable first island northwest of the reef.
  const first=Math.exp(-((x+230)**2/8500+(z+310)**2/12500))*164-100;
  height=Math.max(height,first);
  const gx=Math.round(x/900),gz=Math.round(z/900);
  if(gx!==0||gz!==0){const seed=regionSeed(gx,gz);const ix=gx*900+((seed%180)-90),iz=gz*900+(((seed>>>8)%180)-90);const d=((x-ix)**2+(z-iz)**2);height=Math.max(height,-100+Math.exp(-d/(8000+seed%9000))*(144+seed%32));}
  return height;
}

