'use strict';
const crypto=require('node:crypto');
const {LoginService,validateServer}=require('../auth/login.cjs');
const {parseRoles,getLevel}=require('../auth/role-parser.cjs');
const {allowedUrl,seedCookie,savedCookies}=require('./verification-session.cjs');
const {officialUserAgent}=require('./official-client.cjs');
const ORIGIN='https://xyq.cbg.163.com';
// New-account login owns an isolated browser session until the user selects a role.
// Neither passwords nor verification input are injected into official page scripts.
function createBrowserLogin({BrowserWindow,session,primary=new LoginService()}){
 const flows=new Map();
 function find(context){const flow=flows.get(context?.browserLoginId);if(!flow||flow.window.isDestroyed())throw Error('官方登录窗口已关闭，请重新登录');return flow;}
 function cancel(context){const flow=flows.get(context?.browserLoginId);if(!flow)return;flows.delete(flow.id);if(!flow.window.isDestroyed())flow.window.destroy();void flow.session.clearStorageData().catch(()=>{});}
 async function login(account,password,inputServer,{interactive=true}={}){
  try{return await primary.login(account,password,inputServer);}catch(error){
   if(!interactive||error.code!=='LOGIN_VERIFICATION_REQUIRED')throw error;
   const server=validateServer(inputServer),browserSession=session.fromPartition('cbg-login-'+crypto.randomUUID());
   browserSession.setUserAgent(officialUserAgent(browserSession.getUserAgent()));
   browserSession.setPermissionRequestHandler((_w,_p,done)=>done(false));browserSession.on('will-download',event=>event.preventDefault());
   for(const row of error.loginSession?.cookies?.values()||[]){const cookie=seedCookie(row);if(cookie)await browserSession.cookies.set(cookie);}
   const id=crypto.randomUUID(),window=new BrowserWindow({title:'官方登录 · 请完成登录及安全验证',width:1000,height:800,minWidth:520,minHeight:600,show:false,webPreferences:{session:browserSession,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
   const context={browserLoginRequired:true,browserLoginId:id,server,account:account.trim().toLowerCase()},flow={id,window,session:browserSession,context};flows.set(id,flow);
   const guard=(event,url)=>{if(!allowedUrl(url))event.preventDefault();};window.webContents.on('will-navigate',guard);window.webContents.on('will-redirect',guard);
   window.webContents.setWindowOpenHandler(({url})=>{if(allowedUrl(url))void window.loadURL(url).catch(()=>{});return {action:'deny'};});
   window.on('closed',()=>{flows.delete(id);void browserSession.clearStorageData().catch(()=>{});});
   const url=ORIGIN+'/cgi-bin/show_login.py?'+new URLSearchParams({act:'show_login',area_id:server.regionId,area_name:server.region,server_id:String(server.id),server_name:server.name});
   try{await window.loadURL(url);window.show();window.focus();return context;}catch{cancel(context);throw Error('官方登录窗口加载失败，请检查网络后重新登录');}
  }
 }
 async function complete(context){
  const flow=find(context),url=new URL(flow.window.webContents.getURL());
  if(url.origin!==ORIGIN)throw Error('请先在官方窗口完成登录及安全验证，再点击继续');
  // Read the official page's role data, not arbitrary form fields or verification answers.
  let html=await flow.window.webContents.executeJavaScript('document.documentElement.outerHTML');
  if(!/\bvar\s+RoleList\s*=/.test(html)){const cookies=await flow.session.cookies.get({url:ORIGIN});if(cookies.some(c=>c.name==='is_user_login'&&c.value==='1')){await flow.window.loadURL(ORIGIN+'/cgi-bin/login.py?'+new URLSearchParams({act:'show_role_select_page',serverid:String(context.server.id)}));html=await flow.window.webContents.executeJavaScript('document.documentElement.outerHTML');}}
  let roles;try{roles=parseRoles(html);}catch{throw Error('尚未获取角色列表，请在官方窗口完成登录及验证；如有角色选择页，请停留在该页');}
  if(!roles.length)throw Error('该账号在所选服务器下没有可用角色');
  flow.window.hide();return {...context,browserLoginRequired:false,roles,choices:roles.map(r=>({id:r.roleid,name:r.nickname||r.roleid,level:getLevel(r),locked:!!r.is_locked}))};
 }
 async function select(context,gameRoleId){
  if(!context.browserLoginId)return primary.select(context,gameRoleId);
  const flow=find(context),role=context.roles?.find(r=>r.roleid===String(gameRoleId));if(!role||role.is_locked)throw Error('所选角色不可登录');
  await flow.window.loadURL(ORIGIN+'/cgi-bin/login.py?'+new URLSearchParams({act:'chose_role',roleid:String(role.roleid)}));
  const cookies=savedCookies(await flow.session.cookies.get({})),cookie=name=>cookies.find(c=>c.name===name)?.value;
  if(cookie('is_user_login')!=='1'||cookie('login_user_roleid')!==String(role.roleid)){flow.window.show();flow.window.focus();throw Error('角色登录尚未完成，请在官方窗口完成安全验证后再保存');}
  let user;try{user=decodeURIComponent(cookie('login_user_urs')||'').toLowerCase();}catch{throw Error('官方登录账号格式无效');}
  if(user!==context.account)throw Error('官方窗口登录的账号与添加角色时填写的账号不一致，请使用同一账号');
  // Cleanup happens after RoleManager has successfully persisted this pending login.
  flow.window.hide();return {gameRoleId:String(role.roleid),nickname:role.nickname||role.roleid,level:Number(cookie('login_user_level'))||getLevel(role),school:cookie('login_user_school')||'',cookies};
 }
 function focus(context){const f=find(context);f.window.show();f.window.focus();return {ok:true};}
 function dispose(){for(const f of [...flows.values()])cancel(f.context);}
 return {login,select,complete,focus,cancel,dispose};
}
module.exports={createBrowserLogin};
