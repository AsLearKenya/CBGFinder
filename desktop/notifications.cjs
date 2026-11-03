'use strict';
function install({ipcMain,Notification,win,origin,showWindow,timeoutMs=10000}){
 const live=new Set();let last={state:'unknown',message:'尚未测试系统通知；应用内开关不代表系统已授权。'};
 function trusted(event){try{return event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&new URL(event.senderFrame.url).origin===origin;}catch{return false;}}
 function status(value){last={...value,at:Date.now()};if(!win.isDestroyed?.())win.webContents.send?.('native-notification-status',last);return last;}
 function send(payload,{test=false}={}){
  if(!test)win.flashFrame(true);
  return new Promise(resolve=>{
   let done=false,timer;const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(status(value));};
   try{
    if(!Notification.isSupported()){finish({state:'unsupported',message:'当前系统不支持原生通知；任务提醒仍会在程序内显示。'});return;}
    const note=new Notification({title:test?'藏宝阁搜索 · 通知测试':payload.kind==='changes'?'搜索任务有商品变化':'搜索任务需要安全验证',body:payload.body});live.add(note);
    note.once('show',()=>finish({state:'shown',message:'系统已确认通知显示。若未看到横幅，请检查通知样式与专注模式。'}));
    note.once('failed',(_event,error)=>{live.delete(note);finish({state:'failed',message:'系统通知发送失败，请检查应用签名和系统通知权限。',detail:String(error||'系统未返回具体原因').slice(0,240)});});
    note.on('click',()=>{if(win.isDestroyed?.())return;showWindow();if(!test)win.webContents.send('open-verification-task',payload.taskId);});
    note.on('close',()=>live.delete(note));
    timer=setTimeout(()=>finish({state:'unconfirmed',message:'未收到系统显示确认，暂不能确认通知可用。请检查系统通知权限及专注模式。'}),timeoutMs);timer.unref?.();note.show();
   }catch(error){finish({state:'failed',message:'系统通知发送失败。',detail:String(error.message||error).slice(0,240)});}
  });
 }
 ipcMain.on('task-verification-notification',(event,payload)=>{
  if(!trusted(event)||!payload||typeof payload.taskId!=='string'||!payload.taskId||payload.taskId.length>100||typeof payload.body!=='string'||payload.body.length>300)return;
  void send(payload);
 });
 ipcMain.handle?.('native-notification-status',event=>{if(!trusted(event))throw Error('请求来源无效');return last;});
 let testPending=null;
 ipcMain.handle?.('native-notification-test',event=>{if(!trusted(event))throw Error('请求来源无效');if(testPending)return testPending;testPending=send({body:'这是一条系统通知测试，看到此通知说明显示通道可用。'},{test:true}).finally(()=>testPending=null);return testPending;});
 win.on('focus',()=>win.flashFrame(false));
 return {send,getStatus:()=>last};
}
module.exports={install};
