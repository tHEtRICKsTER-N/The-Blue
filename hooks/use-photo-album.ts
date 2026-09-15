'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadPhotos, savePhoto, deletePhoto, attachPhoto } from '@/src/core/PhotoAlbum.js';

export type Photo = {id:string;blob:Blob;width:number;height:number;takenAt:string;location:string;depth:number;noteName:string};

export function usePhotoAlbum() {
  const [photos,setPhotos]=useState<Photo[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const mounted=useRef(false),requestId=useRef(0);
  const refresh=useCallback(async()=>{
    const id=++requestId.current;
    try{const rows=await loadPhotos() as Photo[];if(mounted.current&&id===requestId.current){setPhotos(rows);setError('');}}
    catch(reason){if(mounted.current&&id===requestId.current)setError(reason instanceof Error?reason.message:'The photo album could not open.');}
    finally{if(mounted.current&&id===requestId.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;void Promise.resolve().then(refresh);window.addEventListener('focus',refresh);return()=>{mounted.current=false;window.removeEventListener('focus',refresh);};},[refresh]);
  const save=useCallback(async(photo:Photo)=>{await savePhoto(photo);await refresh();},[refresh]);
  const remove=useCallback(async(id:string)=>{await deletePhoto(id);await refresh();},[refresh]);
  const attach=useCallback(async(id:string,name:string)=>{await attachPhoto(id,name);await refresh();},[refresh]);
  return {photos,error,loading,refresh,save,remove,attach};
}

export type PhotoAlbum = ReturnType<typeof usePhotoAlbum>;
