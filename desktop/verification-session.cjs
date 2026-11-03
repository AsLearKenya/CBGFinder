'use strict';
const crypto=require('node:crypto');
const AUTH_URL='https://xyq.cbg.163.com/cgi-bin/login.py?act=show_mbauth';
const SEARCH_URL='https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_search_role_form';
const COOKIE_DOMAINS=new Set(['163.com','cbg.163.com','xyq.cbg.163.com','reg.163.com','dl.reg.163.com']);
function domain(value){return String(value||'').replace(/^\./,'').toLowerCase();}
function allowedUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&['xyq.cbg.163.com','xyq-m.cbg.163.com','cbg.163.com','reg.163.com','dl.reg.163.com','mkey.163.com','epay.163.com'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
function seedCookie(row,now=Date.now()){
 const host=domain(row.domain);if(!COOKIE_DOMAINS.has(host))return null;
 if(Number.isFinite(row.expires)&&row.expires<=now)return null;
 const cookie={url:'https://'+host+(row.path||'/'),name:row.name,value:row.value,path:row.path||'/',secure:!!row.secure,httpOnly:!!row.httpOnly};
 if(!row.hostOnly)cookie.domain='.'+host;
 if(Number.isFinite(row.expires))cookie.expirationDate=row.expires/1000;
 return cookie;
}
function savedCookies(rows){return rows.filter(c=>COOKIE_DOMAINS.has(domain(c.domain))).map(c=>({name:c.name,value:c.value,domain:domain(c.domain),path:c.path||'/',hostOnly:!!c.hostOnly,secure:!!c.secure,httpOnly:!!c.httpOnly,expires:c.session||!Number.isFinite(c.expirationDate)?null:c.expirationDate*1000}));}
// Return only page state, never input values, cookies or account information.
async function verificationPage(window){
 return window.webContents.executeJavaScript(`(()=>{const text=document.body?.innerText||'';const code=text.match(/\\be(?:b)?[-_][a-z0-9_-]*\\d+\\b/i)?.[0]||'';return {state:code||/系统繁忙|系统忙|稍候再试/.test(text)?'error':/登录超时|请先登录|登录状态已失效|登录已过期/.test(text)?'login':'open',code};})()`);
}
async function loadVerificationPage(flow,{entry='account'}={}){
 const target=entry==='login'?flow.loginUrl:entry==='search'?flow.returnUrl:AUTH_URL;
 // Match AjaxGuard.show_mibao: remove both path variants and URL-encode the
 // return cookie (MooTools Cookie.write encodes by default).
 for(const path of ['/','/cgi-bin'])await flow.session.cookies.set({url:AUTH_URL,name:'return_url',value:'',path,expirationDate:1});
 await flow.session.cookies.set({url:AUTH_URL,name:'return_url',value:encodeURIComponent(flow.returnUrl),path:'/cgi-bin',secure:true});
 let timer;try{await Promise.race([flow.window.loadURL(target,{httpReferrer:flow.returnUrl}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('官方页面加载超时')),30000);})]);}finally{clearTimeout(timer);}
 return verificationPage(flow.window);
}
function createVerificationWindows({BrowserWindow,session,roles,server,officialClient,userAgent='Mozilla/5.0',onClosed=()=>{}}){
 const flows=new Map();
 async function finish(flow){
  if(flow.finishing)return flow.finishing;
  flow.finishing=(async()=>{try{await roles.importBrowserSession(flow.roleId,{version:flow.version,cookies:savedCookies(await flow.session.cookies.get({}))});if(flow.shared)officialClient.adoptVersion(flow.roleId,(await roles.get(flow.roleId)).cookieVersion||0);return {ok:true};}catch(error){if(flow.shared)officialClient.invalidate(flow.roleId);throw error;}finally{flows.delete(flow.roleId);server.endBrowserVerification(flow.roleId);if(flow.shared){flow.window.removeListener('close',flow.onClose);if(!flow.window.isDestroyed())flow.window.hide();}else{if(!flow.window.isDestroyed())flow.window.destroy();await flow.session.clearStorageData().catch(()=>{});}}})();return flow.finishing;
 }
 async function open(input){
  const roleId=input?.roleId;if(typeof roleId!=='string'||!roleId)throw Error('请选择角色');
  const existing=flows.get(roleId);if(existing){existing.page=input.retry||['search','login'].includes(input.entry)?await loadVerificationPage(existing,{entry:['search','login'].includes(input.entry)?input.entry:existing.kind}):await verificationPage(existing.window);existing.window.show();existing.window.focus();return {opened:true,page:existing.page};}
  const snapshot=await server.beginBrowserVerification(roleId);
  let browserSession,child,flow;
  try{
   if(officialClient){const worker=await officialClient.acquire(roleId);browserSession=worker.session;child=worker.window;}
   else{
    browserSession=session.fromPartition('cbg-verification-'+crypto.randomUUID());
    browserSession.setUserAgent(userAgent);
    browserSession.setPermissionRequestHandler((_wc,_p,done)=>done(false));
    browserSession.on('will-download',(event)=>event.preventDefault());
    for(const row of snapshot.cookies){const cookie=seedCookie(row);if(cookie)await browserSession.cookies.set(cookie);}
   }
   const returnUrl=allowedUrl(input.url)&&new URL(input.url).hostname==='xyq.cbg.163.com'?input.url:SEARCH_URL;
   const role=await roles.get(roleId),boundServer=role.server||{};
   const loginUrl='https://xyq.cbg.163.com/cgi-bin/show_login.py?'+new URLSearchParams({act:'show_login',server_id:String(boundServer.id||''),server_name:boundServer.name||'',area_id:String(boundServer.regionId||''),area_name:boundServer.region||'',return_url:returnUrl});
   if(!child)child=new BrowserWindow({title:'官方安全验证 · 当前角色会话',width:1000,height:800,minWidth:520,minHeight:600,show:false,webPreferences:{session:browserSession,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
   flow={roleId,version:snapshot.version,session:browserSession,window:child,shared:!!officialClient,returnUrl,loginUrl,kind:input.kind==='account'?'account':'search'};flows.set(roleId,flow);
   if(!officialClient){const guard=(event,url)=>{if(!allowedUrl(url))event.preventDefault();};
    child.webContents.on('will-navigate',guard);child.webContents.on('will-redirect',guard);
    child.webContents.setWindowOpenHandler(({url})=>{if(allowedUrl(url))void child.loadURL(url).catch(()=>{});return {action:'deny'};});}
   flow.onClose=event=>{event.preventDefault();void finish(flow).then(()=>onClosed({roleId})).catch(()=>onClosed({roleId,error:'验证会话同步失败，请重新打开验证窗口'}));};child.on('close',flow.onClose);
   if(!officialClient)child.once('ready-to-show',()=>child.show());
   flow.page=await loadVerificationPage(flow,{entry:flow.kind});
   child.show();child.focus();return {opened:true,page:flow.page};
  }catch(error){if(flow){flows.delete(roleId);if(flow.shared){child.removeListener('close',flow.onClose);if(!child.isDestroyed())child.hide();}else if(!child.isDestroyed())child.destroy();}server.endBrowserVerification(roleId);if(!officialClient)await browserSession?.clearStorageData().catch(()=>{});throw Error('官方验证窗口无法加载，请检查网络后重试');}
 }
 async function finishRole({roleId}={}){const flow=flows.get(roleId);if(!flow)throw Error('验证窗口已关闭，请点击“尝试请求”确认状态');return finish(flow);}
 function dispose(){for(const flow of flows.values()){server.endBrowserVerification(flow.roleId);if(flow.shared){flow.window.removeListener('close',flow.onClose);if(!flow.window.isDestroyed())flow.window.hide();}else{flow.window.destroy();void flow.session.clearStorageData().catch(()=>{});}}flows.clear();}
 return {flows,open,finish:finishRole,dispose};
}
function install({ipcMain,win,origin,...options}){
 const windows=createVerificationWindows({...options,userAgent:win.webContents.getUserAgent(),onClosed:value=>{if(!win.isDestroyed())win.webContents.send('official-verification-closed',value);}});
 const trusted=event=>{try{return event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&new URL(event.senderFrame.url).origin===origin;}catch{return false;}};
 ipcMain.handle('official-verification-open',async(event,input)=>{if(!trusted(event))throw Error('请求来源无效');return windows.open(input);});
 ipcMain.handle('official-verification-finish',async(event,input)=>{if(!trusted(event))throw Error('请求来源无效');return windows.finish(input);});
 win.on('closed',windows.dispose);return windows;
}
module.exports={install,createVerificationWindows,allowedUrl,seedCookie,savedCookies,COOKIE_DOMAINS};
