import { photoCapacity } from './Photography.js';

const unavailable = () => new Error('Photo storage is unavailable. You can still take and download photographs.');

export function validPhoto(photo) {
  return !!photo && typeof photo.id==='string' && photo.id.length>0 &&
    photo.blob instanceof Blob && photo.blob.type==='image/jpeg' && photo.blob.size>0 &&
    typeof photo.takenAt==='string' && Number.isFinite(Date.parse(photo.takenAt)) &&
    typeof photo.location==='string' && typeof photo.noteName==='string' &&
    Number.isFinite(photo.depth) && Number.isFinite(photo.width) && photo.width>0 &&
    Number.isFinite(photo.height) && photo.height>0;
}

function openAlbum() {
  return new Promise((resolve,reject)=>{
    let request, blocked=false;
    try {request=indexedDB.open('abyss-photo-album',1);}catch{reject(unavailable());return;}
    request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});
    request.onerror=()=>reject(unavailable());
    request.onblocked=()=>{blocked=true;reject(new Error('Close other ABYSS tabs and reopen the album to enable photo storage.'));};
    request.onsuccess=()=>{const db=request.result;if(blocked){db.close();return;}db.onversionchange=()=>db.close();resolve(db);};
  });
}

// A read/write transaction serializes the capacity check and insert across tabs.
async function transact(mode, action) {
  const db=await openAlbum();
  return new Promise((resolve,reject)=>{
    let result, failure;
    let transaction,store;
    try{transaction=db.transaction('photos',mode);store=transaction.objectStore('photos');}
    catch{db.close();reject(unavailable());return;}
    transaction.oncomplete=()=>{db.close();resolve(result);};
    transaction.onabort=transaction.onerror=()=>{db.close();reject(failure||unavailable());};
    try {action(store,value=>{result=value;},error=>{failure=error;transaction.abort();});}
    catch(error){failure=error;transaction.abort();}
  });
}

export function loadPhotos() {
  return transact('readonly',(store,done)=>{
    const request=store.getAll();request.onsuccess=()=>done(request.result.filter(validPhoto).sort((a,b)=>b.takenAt.localeCompare(a.takenAt)));
  });
}

export function savePhoto(photo) {
  if(!validPhoto(photo))return Promise.reject(new Error('This photograph could not be saved. Please take another shot.'));
  return transact('readwrite',(store,done,fail)=>{
    const request=store.getAll();
    request.onsuccess=()=>{
      const error=photoCapacity(request.result,photo.blob);
      if(error){fail(new Error(error));return;}
      store.add(photo);done(photo);
    };
  });
}

export function deletePhoto(id) {
  return transact('readwrite',(store,done)=>{store.delete(id);done(id);});
}

export function attachPhoto(id,noteName) {
  return transact('readwrite',(store,done,fail)=>{
    const request=store.get(id);request.onsuccess=()=>{
      if(!request.result){fail(new Error('This photo is no longer in the album.'));return;}
      const photo={...request.result,noteName:typeof noteName==='string'?noteName.slice(0,100):''};
      store.put(photo);done(photo);
    };
  });
}
