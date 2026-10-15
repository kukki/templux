'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {createEditor,type EditorOptions,type Values} from '../../../../../shared/editor.mjs';
import {useEditNavigation} from './edit-navigation';
/** Initial options are fixed per mount. Load a new entity via a new key, or explicitly reset its baseline. */
export function useEditor<T extends Values>(options:EditorOptions<T>){
 const [editor]=useState(()=>createEditor(options));const {register}=useEditNavigation();
 const state=useSyncExternalStore(editor.subscribe,editor.getSnapshot,editor.getSnapshot);
 useEffect(()=>{const release=register(editor);return()=>{editor.cancel();release();};},[editor,register]);
 return {editor,state};
}
