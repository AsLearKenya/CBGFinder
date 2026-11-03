'use strict';
const path=require('node:path');
function readPort(value=process.env.PORT||5173){const port=Number(value);if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT 无效');return port;}
// The web UI stays in the user's browser; only official requests need the local browser runtime.
function launchRuntime({executable=require('electron'),spawn=require('node:child_process').spawn,hostProcess=process}={}){
 readPort(hostProcess.env.PORT||5173);
 const env={...hostProcess.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(executable,[path.join(__dirname,'web-runtime.cjs')],{cwd:__dirname,env,stdio:'inherit'});
 let exited=false;const stop=()=>{if(!exited)child.kill('SIGTERM');};
 hostProcess.on('SIGINT',stop);hostProcess.on('SIGTERM',stop);hostProcess.once('exit',stop);
 const cleanup=()=>{exited=true;hostProcess.removeListener('SIGINT',stop);hostProcess.removeListener('SIGTERM',stop);hostProcess.removeListener('exit',stop);};
 child.once('error',error=>{cleanup();console.error('官方浏览器请求通道无法启动：'+error.message);hostProcess.exitCode=1;});
 child.once('exit',(code,signal)=>{cleanup();hostProcess.exitCode=code??(signal?1:0);});return child;
}
async function startWebRuntime(){
 const {app,BrowserWindow,session,Menu}=require('electron'),fs=require('node:fs'),os=require('node:os');
 const port=readPort(),profile=fs.mkdtempSync(path.join(os.tmpdir(),'cbg-web-runtime-'));
 app.setName('藏宝阁搜索网页服务');app.setPath('userData',profile);app.setPath('sessionData',profile);app.commandLine.appendSwitch('disable-renderer-backgrounding');
 let server,client,windows,login,quitting=false;
 const shutdown=()=>{if(!quitting){quitting=true;app.quit();}};process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;windows?.dispose();login?.dispose();client?.dispose();server?.close();server?.closeAllConnections();});
 app.on('quit',()=>{try{fs.rmSync(profile,{recursive:true,force:true});}catch{}});
 try{
  await app.whenReady();app.dock?.hide();
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]}]));
  const {RoleManager}=require('./auth/roles.cjs'),{createServer}=require('./server.cjs');
  login=require('./desktop/browser-login.cjs').createBrowserLogin({BrowserWindow,session});
  const roles=new RoleManager({auth:login,directory:process.env.CBG_DATA_DIR||path.join(__dirname,'.data')}),closed=new Map();
  client=require('./desktop/official-client.cjs').createOfficialClient({BrowserWindow,session,roles});
  const browserVerification={
   async open(input){const result=await windows.open(input);closed.delete(input.roleId);return result;},
   async finish(input){if(windows.flows.has(input?.roleId))return windows.finish(input);const previous=closed.get(input?.roleId);if(previous&&Date.now()-previous.at<1800000){if(previous.error)throw Error(previous.error);return {ok:true};}throw Error('验证窗口已关闭，请点击“尝试请求”确认状态');}
  };
  server=createServer({roleManager:roles,officialFetch:client.fetch,browserVerification});
  windows=require('./desktop/verification-session.cjs').createVerificationWindows({BrowserWindow,session,roles,server,officialClient:client,onClosed:value=>{if(closed.size>=100)closed.delete(closed.keys().next().value);closed.set(value.roleId,{...value,at:Date.now()});}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  console.log(`打开 http://127.0.0.1:${port}，网页版已启用官方页面请求通道。按 Ctrl+C 停止。`);
 }catch(error){console.error(error.code==='EADDRINUSE'?`端口 ${port} 已被占用，请先停止旧的本地服务。`:error.message);app.exit(1);}
}
if(require.main===module||(process.versions.electron&&path.resolve(process.argv[1]||'')===__filename)){if(process.versions.electron)void startWebRuntime();else launchRuntime();}
module.exports={launchRuntime,startWebRuntime,readPort};
