'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopNotifications',{
 send:payload=>ipcRenderer.send('task-verification-notification',payload),
 status:()=>ipcRenderer.invoke('native-notification-status'),
 test:()=>ipcRenderer.invoke('native-notification-test'),
 onStatus:callback=>ipcRenderer.on('native-notification-status',(_event,value)=>callback(value)),
 onOpenTask:callback=>ipcRenderer.on('open-verification-task',(_event,id)=>callback(id))
});

contextBridge.exposeInMainWorld('desktopStorage',{info:()=>ipcRenderer.invoke('storage-location-info'),choose:()=>ipcRenderer.invoke('storage-location-choose'),cancel:()=>ipcRenderer.invoke('storage-location-cancel'),open:()=>ipcRenderer.invoke('storage-location-open'),restart:()=>ipcRenderer.invoke('storage-location-restart')});

contextBridge.exposeInMainWorld('desktopVerification',{open:input=>ipcRenderer.invoke('official-verification-open',input),finish:input=>ipcRenderer.invoke('official-verification-finish',input),onClosed:callback=>ipcRenderer.on('official-verification-closed',(_event,value)=>callback(value))});

contextBridge.exposeInMainWorld('desktopClipboard',{writeImage:bytes=>ipcRenderer.invoke('clipboard-write-image',bytes)});
