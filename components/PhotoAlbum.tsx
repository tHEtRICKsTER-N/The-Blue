'use client';
/* oxlint-disable next/no-img-element -- Photos are local Blob URLs rather than network images. */
import { useEffect, useState } from 'react';
import { Camera, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadPhoto, PHOTO_LIMIT, PHOTO_BYTES } from '@/src/core/Photography.js';
import type { Photo, PhotoAlbum as Album } from '@/hooks/use-photo-album';
import type { FieldNote } from './FieldJournal';

export function PhotoImage({photo}:{photo:Photo}) {
  const [image,setImage]=useState<{blob:Blob;url:string}|null>(null);
  useEffect(()=>{
    let url='',cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){url=URL.createObjectURL(photo.blob);setImage({blob:photo.blob,url});}});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
  },[photo.blob]);
  return image?.blob===photo.blob?<img src={image.url} width={photo.width} height={photo.height} alt={`Photograph at ${photo.location}, ${Math.round(photo.depth)} metres deep`}/>:<div className="photo-loading">Preparing photograph…</div>;
}

export function PhotoAttachment({notes,value,onChange,disabled=false}:{notes:FieldNote[];value:string;onChange:(name:string)=>void;disabled?:boolean}) {
  return <Select value={value||'__none'} onValueChange={name=>{if(name)onChange(name==='__none'?'':name);}} disabled={disabled}>
    <SelectTrigger aria-label="Attach photo to field note"><SelectValue>{value||'No field note attached'}</SelectValue></SelectTrigger>
    <SelectContent><SelectItem value="__none">No field note attached</SelectItem>{notes.map(note=><SelectItem key={note.name} value={note.name}>{note.name}</SelectItem>)}</SelectContent>
  </Select>;
}

function PhotoCard({photo,album,notes}:{photo:Photo;album:Album;notes:FieldNote[]}) {
  const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function change(action:()=>Promise<void>){setBusy(true);setError('');try{await action();setConfirm(false);}catch(reason){setError(reason instanceof Error?reason.message:'The photo could not be updated.');}finally{setBusy(false);}}
  return <article className="photo-card"><PhotoImage photo={photo}/><div className="photo-card-copy">
    <h4>{photo.location}</h4><p>{Math.round(photo.depth)} m · {new Date(photo.takenAt).toLocaleString()} · {photo.width} × {photo.height}</p>
    <PhotoAttachment notes={notes} value={photo.noteName} disabled={busy} onChange={name=>void change(()=>album.attach(photo.id,name))}/>
    <div className="photo-actions"><Button variant="outline" onClick={()=>downloadPhoto(photo)}><Download size={16}/>Download</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirm(true)}><Trash2 size={16}/>Delete</Button></div>
    {confirm&&<div className="photo-delete"><p>Delete this photo from this browser? Download a copy first if you want to keep it.</p><Button variant="destructive" disabled={busy} onClick={()=>void change(()=>album.remove(photo.id))}>Delete photo</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirm(false)}>Cancel</Button></div>}
    {error&&<p role="alert">{error}</p>}
  </div></article>;
}

export function PhotoGallery({album,notes,noteName}:{album:Album;notes:FieldNote[];noteName?:string}) {
  const photos=noteName?album.photos.filter(photo=>photo.noteName===noteName):album.photos;
  const bytes=album.photos.reduce((sum,photo)=>sum+photo.blob.size,0);
  return <section className="photo-gallery" aria-label={noteName?'Attached photos':'Photo album'}>
    {noteName?<h4>Your photographs</h4>:<p className="photo-storage">{album.photos.length} / {PHOTO_LIMIT} photos · {(bytes/1024/1024).toFixed(1)} / {PHOTO_BYTES/1024/1024} MB. Stored in this browser only.</p>}
    {album.error&&<div className="photo-storage-error"><p role="alert">{album.error}</p><Button variant="outline" onClick={()=>void album.refresh()}>Retry album</Button></div>}
    {album.loading?<p>Opening your album…</p>:photos.length?<div className="photo-grid">{photos.map(photo=><PhotoCard key={photo.id} photo={photo} album={album} notes={notes}/>)}</div>:<div className="photo-empty"><Camera size={24} aria-hidden="true"/><p>{noteName?'Attach a photo from your album to keep it with this note.':'Open Photo mode from the dive controls to take your first photograph.'}</p></div>}
  </section>;
}
