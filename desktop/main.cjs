'use strict';
const {app,BrowserWindow,session,Menu,Tray,nativeImage,clipboard,ClipboardItem,dialog,shell,Notification,ipcMain}=require('electron');
const path=require('node:path');
const {createServer}=require('../server.cjs');
const {RoleManager}=require('../auth/roles.cjs');
const {isVerificationUrl}=require('./external-links.cjs');
const PORT=5174;
let win,server,tray,storageLocation,officialClient,browserLogin,quitting=false;
const smoke=process.argv.includes('--smoke-test');
if(process.env.CBG_DESKTOP_TEST_DATA)app.setPath('userData',path.resolve(process.env.CBG_DESKTOP_TEST_DATA));
app.setName('藏宝阁搜索');
app.setAppUserModelId('com.kenya.cbgfinder');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>showWindow());
 app.on('activate',()=>showWindow());
 app.on('window-all-closed',()=>{});
 app.on('before-quit',()=>{quitting=true;server?.close();browserLogin?.dispose();officialClient?.dispose();});
 try{storageLocation=require('./storage-location.cjs').createLocation(app.getPath('userData'));app.setPath('userData',storageLocation.path);app.setPath('sessionData',storageLocation.path);}catch(error){app.whenReady().then(()=>{dialog.showErrorBox('数据目录无法打开',error.message);app.exit(1);});}
 if(storageLocation)app.whenReady().then(start).catch(error=>{if(smoke){console.error(error);app.exit(1);}else{dialog.showErrorBox('启动失败',error.code==='EADDRINUSE'?'桌面应用端口 5174 已被占用，请关闭占用程序后重试。':error.message);app.quit();}});
}
function showWindow(){if(!win||win.isDestroyed())return;if(win.isMinimized())win.restore();win.show();win.focus();}
async function start(){
 browserLogin=require('./browser-login.cjs').createBrowserLogin({BrowserWindow,session});
 const roleManager=new RoleManager({auth:browserLogin,directory:path.join(app.getPath('userData'),'roles')});
 officialClient=require('./official-client.cjs').createOfficialClient({BrowserWindow,session,roles:roleManager});
 server=createServer({roleManager,officialFetch:officialClient.fetch});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(smoke?0:PORT,'127.0.0.1',resolve);});
 win=new BrowserWindow({title:'藏宝阁搜索',width:1280,height:900,minWidth:900,minHeight:650,show:false,backgroundColor:'#f5f7fa',icon:path.join(__dirname,'icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 const origin=`http://127.0.0.1:${server.address().port}`;
 require('./storage-location.cjs').install({ipcMain,dialog,shell,win,origin,location:storageLocation,restart:()=>{quitting=true;app.relaunch();app.quit();}});
 require('./clipboard.cjs').install({ipcMain,clipboard,ClipboardItem,nativeImage,win,origin});
 require('./notifications.cjs').install({ipcMain,Notification,win,origin,showWindow});
 require('./verification-session.cjs').install({ipcMain,BrowserWindow,session,win,origin,roles:roleManager,server,officialClient});
 win.webContents.setWindowOpenHandler(({url})=>{if(url==='about:blank#cbg-human-verification'||server.isVerificationWindowUrl(url))return {action:'allow',overrideBrowserWindowOptions:{width:440,height:560,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}};if(isVerificationUrl(url))void shell.openExternal(url).catch(()=>dialog.showErrorBox('无法打开浏览器','请手动打开藏宝阁官网完成验证。'));return {action:'deny'};});
 win.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
 win.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 win.on('close',event=>{if(!quitting){event.preventDefault();win.hide();}});
 win.once('ready-to-show',()=>{if(!smoke)showWindow();});
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  {label:'藏宝阁搜索',submenu:[{label:'显示主窗口',click:showWindow},{type:'separator'},{label:'退出',accelerator:process.platform==='darwin'?'Cmd+Q':'Alt+F4',click:()=>app.quit()}]},
  {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'窗口',submenu:[{role:'minimize'},{label:'显示主窗口',click:showWindow}]}
 ]));
 tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:20,height:20}));
 tray.setToolTip('藏宝阁搜索 · 关闭窗口后继续运行');
 tray.setContextMenu(Menu.buildFromTemplate([{label:'显示主窗口',click:showWindow},{label:'最小化',click:()=>win.minimize()},{type:'separator'},{label:'退出应用',click:()=>app.quit()}]));
 tray.on('click',showWindow);tray.on('double-click',showWindow);
 await win.loadURL(origin);
 if(smoke){
  const encryption=require('../urs-crypto.cjs');if(encryption.encryptParams({})!=='8d7db43f9974d58fa5dc2fb18b0a8421')throw Error('Desktop SM4 compatibility failed');encryption.encryptPassword('Only-Test-123!');
  // Read only rendered application DOM. The smoke run has a separate temporary profile.
  const check=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{let tries=0;const timer=setInterval(()=>{if(document.querySelector('#nav button[data-page="roles"]')){clearInterval(timer);document.querySelector('#nav button[data-page="roles"]').click();setTimeout(()=>resolve({heading:document.querySelector('h1')?.textContent,body:document.querySelector('main')?.textContent}),400);}else if(++tries>50){clearInterval(timer);reject(Error('UI did not load'));}},100);})`);
  if(check.heading!=='角色管理'||!check.body.includes('还没有添加角色'))throw Error('Desktop UI smoke failed');
  const storageCheck=await win.webContents.executeJavaScript(`(()=>{const guide=!!document.querySelector('[data-action="storage-guide-skip"]');document.querySelector('#nav button[data-page="settings"]').click();return {guide,settings:document.querySelector('main')?.textContent};})()`);
  if(!storageCheck.settings.includes('数据存储路径')||!storageCheck.settings.includes('更改路径'))throw Error('Desktop storage settings smoke failed');
  if(process.env.CBG_SMOKE_EXPECT_GUIDE&&storageCheck.guide!==(process.env.CBG_SMOKE_EXPECT_GUIDE==='true'))throw Error('First-start storage guide mismatch');
  console.log('STORAGE_SMOKE_OK: settings and first-start guide '+storageCheck.guide);
  win.minimize();await new Promise(resolve=>setTimeout(resolve,100));win.restore();win.close();
  if(win.isDestroyed())throw Error('Closing window destroyed background scheduler');
  console.log('DESKTOP_SMOKE_OK: real UI, role API, minimize/restore, tray close');app.quit();
 }
}
