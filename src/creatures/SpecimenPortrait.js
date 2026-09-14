import * as T from 'three';

// Reuse the actual meshes: field notes should depict the animal encountered in-game.
// Clones share geometry/materials; only the temporary render target is disposed here.
export function specimenFor(marine, name) {
  const animal = [...marine.animals, ...marine.benthic.animals].find(entry => entry.name === name);
  let specimen;
  if (animal) specimen = animal.root.clone(true);
  else {
    const school = marine.schools.find(entry => entry.name === name);
    if (!school) return null;
    specimen = new T.Mesh(school.mesh.geometry, school.mesh.material);
  }
  specimen.position.set(0,0,0); specimen.rotation.set(0,Math.PI * .3,0);
  specimen.visible = true;
  specimen.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(specimen);
  const center = bounds.getCenter(new T.Vector3());
  specimen.position.sub(center);
  return {specimen, radius:Math.max(.1, bounds.getSize(new T.Vector3()).length() / 2)};
}

export function renderSpecimenPortrait(renderer, marine, name) {
  const model = specimenFor(marine, name);
  if (!model) return null;
  const width = 480, height = 300;
  const scene = new T.Scene();scene.background = new T.Color('#102c34');
  scene.add(model.specimen, new T.HemisphereLight('#d5f4ec','#294457',3));
  const light = new T.DirectionalLight('#fff1d1',3);light.position.set(3,5,4);scene.add(light);
  const camera = new T.PerspectiveCamera(35,width/height,.01,model.radius*20);
  camera.position.set(0,model.radius*.45,model.radius*3.7);camera.lookAt(0,0,0);
  const target = new T.WebGLRenderTarget(width,height);
  target.texture.colorSpace = T.SRGBColorSpace;
  const previousTarget = renderer.getRenderTarget();
  const viewport = renderer.getViewport(new T.Vector4());
  const scissor = renderer.getScissor(new T.Vector4()), scissorTest = renderer.getScissorTest();
  try {
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.render(scene,camera);
    const pixels = new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
    const context = canvas.getContext('2d');if(!context)return null;
    const frame = context.createImageData(width,height), row=width*4;
    for(let y=0;y<height;y++)frame.data.set(pixels.subarray((height-1-y)*row,(height-y)*row),y*row);
    context.putImageData(frame,0,0);return canvas.toDataURL('image/png');
  } finally {
    renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);
    renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);target.dispose();
  }
}
