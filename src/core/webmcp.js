export function registerExpeditionTools(game) {
  const context=document.modelContext,lifecycle=new AbortController();
  if(!context?.registerTool)return ()=>{};
  const tools=[{
    name:'read_expedition',description:'Read the diver’s depth, current location, and discovered species and locations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},
    execute(input){if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Expected an empty object.');return {depth:Math.max(0,27-game.diver.position.y),location:game.location,discoveries:[...game.discovered]};}
  },{
    name:'set_expedition_flashlight',description:'Turn the diver’s flashlight on or off in the current expedition.',inputSchema:{type:'object',properties:{enabled:{type:'boolean'}},required:['enabled'],additionalProperties:false},annotations:{readOnlyHint:false},
    execute(input){if(!input||typeof input.enabled!=='boolean'||Object.keys(input).some(k=>k!=='enabled'))throw new Error('Expected an enabled boolean.');if(!game.diver.started)throw new Error('Enter the ocean before using the flashlight.');const on=game.effects.flashlight.intensity>0;if(on!==input.enabled)game.toggleFlashlight();return {flashlight:input.enabled};}
  }];
  for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser integration. */}}
  return ()=>lifecycle.abort();
}


