export const PHOTO_LIMIT = 24;
export const PHOTO_BYTES = 48 * 1024 * 1024;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export function photoCrop(width, height, aspect = 'original') {
  if (!(width > 0 && height > 0)) throw new Error('The camera is not ready.');
  const ratio = aspect === 'square' ? 1 : aspect === 'wide' ? 16 / 9 : width / height;
  const cropWidth = Math.min(width, height * ratio), cropHeight = Math.min(height, width / ratio);
  const scale = Math.min(1, 1920 / Math.max(cropWidth, cropHeight));
  return {x:(width-cropWidth)/2,y:(height-cropHeight)/2,width:cropWidth,height:cropHeight,
    outputWidth:Math.max(1,Math.round(cropWidth*scale)),outputHeight:Math.max(1,Math.round(cropHeight*scale))};
}

export function photoCapacity(photos, incoming) {
  if (!(incoming instanceof Blob) || incoming.type !== 'image/jpeg' || incoming.size === 0)
    return 'This photograph could not be saved. Please take another shot.';
  if (incoming.size > PHOTO_MAX_BYTES) return 'This photograph is too large. Download it or try a smaller frame.';
  if (photos.length >= PHOTO_LIMIT) return 'Your album holds 24 photos. Delete one to make room, or download this shot.';
  if (photos.reduce((sum,photo)=>sum+(Number.isFinite(photo?.blob?.size)?photo.blob.size:0),0)+incoming.size > PHOTO_BYTES)
    return 'Your album has reached 48 MB. Delete a photo to make room, or download this shot.';
  return null;
}

// Copy the WebGL canvas immediately after rendering; no preserveDrawingBuffer cost.
export function captureFrame(renderer, render, aspect) {
  if (renderer.getContext().isContextLost()) return Promise.reject(new Error('The ocean renderer is unavailable. Try again after reloading.'));
  render();
  const source = renderer.domElement;
  const crop = photoCrop(source.width,source.height,aspect);
  const canvas = document.createElement('canvas');
  canvas.width=crop.outputWidth;canvas.height=crop.outputHeight;
  const context=canvas.getContext('2d');
  if(!context)return Promise.reject(new Error('This browser could not prepare the photograph.'));
  context.drawImage(source,crop.x,crop.y,crop.width,crop.height,0,0,canvas.width,canvas.height);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve({blob,width:canvas.width,height:canvas.height}):reject(new Error('The photograph could not be captured.')), 'image/jpeg', .9));
}

export function photoFilename(photo) {
  const location=(photo.location||'ocean').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'ocean';
  return `abyss-${location}-${photo.takenAt.replace(/[:.]/g,'-')}.jpg`;
}

export function downloadPhoto(photo) {
  const url=URL.createObjectURL(photo.blob),link=document.createElement('a');
  link.href=url;link.download=photoFilename(photo);document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
