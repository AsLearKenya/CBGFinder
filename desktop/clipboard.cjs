'use strict';
function install({ipcMain,clipboard,ClipboardItem,nativeImage,win,origin}){
 ipcMain.handle('clipboard-write-image',async(event,bytes)=>{
  try{
   if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||new URL(event.senderFrame.url).origin!==origin)throw Error('不允许访问剪贴板');
   if(!(bytes instanceof ArrayBuffer)||bytes.byteLength<8||bytes.byteLength>48*1024*1024)throw Error('图片数据无效或过大');
   const buffer=Buffer.from(bytes);if(!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('只支持PNG图片');
   const image=nativeImage.createFromBuffer(buffer);if(image.isEmpty())throw Error('图片解析失败');
   await clipboard.write([new ClipboardItem({'image/png':new Blob([buffer],{type:'image/png'})})]);return {ok:true};
  }catch(error){return {ok:false,message:error.message};}
 });
}
module.exports={install};
