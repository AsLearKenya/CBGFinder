'use strict';
const crypto=require('node:crypto');
const {Session}=require('./session-http.cjs');
const {LoginService}=require('./login.cjs');
const {Vault}=require('./vault.cjs');
const {selectRole}=require('./role-parser.cjs');
class RoleManager{
 constructor({directory,auth=new LoginService(),vault=new Vault(directory),now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){this.now=now;this.delay=delay;this.auth=auth;this.vault=vault;this.pending=new Map();this.verifying=new Set();this.refreshing=new Map();this.initializing=null;this.data=null;}
 async ready(){if(!this.initializing)this.initializing=this.vault.load().then(data=>this.data=data);await this.initializing;}
 public(role){return {id:role.id,account:role.account,server:role.server,gameRoleId:role.gameRoleId,nickname:role.nickname,level:role.level,school:role.school,createdAt:role.createdAt,lastRefreshedAt:role.lastRefreshedAt,status:role.status,lastVerifiedAt:role.lastVerifiedAt||null,lastError:role.lastError||'',refreshIntervalMinutes:role.refreshIntervalMinutes||0,refreshRetryLimit:role.refreshRetryLimit??2,refreshAttempts:role.refreshAttempts||0,refreshing:this.refreshing.has(role.id),nextRefreshAt:this.nextRefreshAt(role)};}
 async list(){await this.ready();return this.data.roles.map(role=>this.public(role));}
 pendingLogin(id,pending){const context=pending.context;return {pendingId:id,server:context.server,...(context.browserLoginRequired?{requiresVerification:true}:{roles:context.choices,defaultRoleId:selectRole(context.roles).role.roleid})};}
 async begin({account,password,server}){await this.ready();for(const [key,value] of this.pending)if(value.expires<Date.now())this.cancel(key);if(this.pending.size>=10)throw Error('待选择的登录过多，请稍后再试');const context=await this.auth.login(account,password,server);const id=crypto.randomUUID(),pending={context,password,expires:Date.now()+600000};this.pending.set(id,pending);setTimeout(()=>this.cancel(id),600000).unref();return this.pendingLogin(id,pending);}
 async completeLogin({pendingId}){const pending=this.pending.get(pendingId);if(!pending||pending.expires<Date.now()){this.cancel(pendingId);throw Error('本次登录已过期，请重新登录');}if(pending.saving)throw Error('正在保存角色');if(pending.context.browserLoginRequired){if(!this.auth.complete)throw Error('当前环境不支持官方窗口登录');pending.context=await this.auth.complete(pending.context);}return this.pendingLogin(pendingId,pending);}
 focusLogin({pendingId}){const pending=this.pending.get(pendingId);if(!pending||pending.expires<Date.now())throw Error('本次登录已过期，请重新登录');if(!this.auth.focus)throw Error('当前环境不支持官方窗口登录');return this.auth.focus(pending.context);}

 async save({pendingId,gameRoleId}){await this.ready();const pending=this.pending.get(pendingId);if(!pending||pending.expires<Date.now()){this.pending.delete(pendingId);throw Error('本次登录已过期，请重新登录');}if(pending.saving)throw Error('正在保存角色，请勿重复提交');pending.saving=true;try{const selected=await this.auth.select(pending.context,gameRoleId);const existing=this.data.roles.find(role=>role.account===pending.context.account&&role.server.id===pending.context.server.id&&role.gameRoleId===selected.gameRoleId);const role={...selected,id:existing?.id||crypto.randomUUID(),account:pending.context.account,password:pending.password,server:pending.context.server,createdAt:existing?.createdAt||Date.now(),lastRefreshedAt:Date.now(),status:'ready',lastError:'',refreshIntervalMinutes:existing?.refreshIntervalMinutes||0,refreshRetryLimit:existing?.refreshRetryLimit??2,cookieVersion:(existing?.cookieVersion||0)+1};const previous=this.data.roles;this.data.roles=existing?previous.map(item=>item.id===role.id?role:item):[role,...previous];try{await this.vault.save(this.data);}catch(error){this.data.roles=previous;throw error;}this.pending.delete(pendingId);this.auth.cancel?.(pending.context);return this.public(role);}finally{pending.saving=false;}}
 async get(id){await this.ready();const role=this.data.roles.find(role=>role.id===id);if(!role)throw Error('绑定角色不存在，请先添加角色并重新绑定任务');return role;}
 nextRefreshAt(role){return role.refreshIntervalMinutes>0?(role.lastRefreshAttemptAt||role.lastRefreshedAt||this.now())+role.refreshIntervalMinutes*60000:null;}
 async settings(id,{refreshIntervalMinutes,refreshRetryLimit}){
  if(!Number.isInteger(refreshIntervalMinutes)||refreshIntervalMinutes<0||refreshIntervalMinutes>10080||!Number.isInteger(refreshRetryLimit)||refreshRetryLimit<0||refreshRetryLimit>5)throw Error('刷新间隔需为 0–10080 分钟，失败重试次数需为 0–5 次');
  const role=await this.get(id),previous={refreshIntervalMinutes:role.refreshIntervalMinutes,refreshRetryLimit:role.refreshRetryLimit};Object.assign(role,{refreshIntervalMinutes,refreshRetryLimit});
  try{await this.vault.save(this.data);}catch(error){Object.assign(role,previous);throw error;}return this.public(role);
 }
 async cookieSnapshot(id,url,{signal}={}){
  for(;;){
   signal?.throwIfAborted();const pending=this.refreshing.get(id);if(pending){await this.wait(pending,signal);continue;}
   const role=await this.get(id);if(this.refreshing.has(id))continue;
   if(role.status==='failed')throw Error('角色Cookie刷新失败：'+(role.lastError||'请在角色管理中刷新Cookie'));
   const session=new Session();session.cookies=new Map(role.cookies.map(cookie=>[[cookie.domain,cookie.path,cookie.name].join('|'),{...cookie,expires:cookie.expires===null?Infinity:cookie.expires}]));
   return {cookie:session.header(url),version:role.cookieVersion||0};
  }
 }
 async wait(promise,signal){
  if(!signal)return promise;signal.throwIfAborted();let abort;
  try{return await Promise.race([promise,new Promise((_,reject)=>{abort=()=>reject(signal.reason||Error('已取消'));signal.addEventListener('abort',abort,{once:true});})]);}finally{signal.removeEventListener('abort',abort);}
 }
 async cookie(id,url){return (await this.cookieSnapshot(id,url)).cookie;}
 async request(id,url,send,{taskId,signal,isExpired}={}){
  let session=await this.cookieSnapshot(id,url,{signal}),response=await send(session);
  if(!isExpired(response))return {response,refreshed:false};
  await this.wait(this.refresh(id,taskId,{source:'task',expectedVersion:session.version}),signal);
  session=await this.cookieSnapshot(id,url,{signal});response=await send(session);
  if(isExpired(response)){
   const role=await this.get(id);
   // A newer shared refresh supersedes a late response from an old Cookie.
   if(this.refreshing.has(id)||session.version!==(role.cookieVersion||0)){
    session=await this.cookieSnapshot(id,url,{signal});response=await send(session);if(!isExpired(response))return {response,refreshed:true};
   }
   if(session.version===(role.cookieVersion||0)){
    role.status='failed';role.lastError='刷新后的Cookie仍被官网判定为过期，请在角色管理中处理';await this.event('cookie_retry_failed',id,taskId,role.lastError);
   }
   throw Error(role.lastError||'角色Cookie无法使用');
  }
  await this.event('cookie_retry_success',id,taskId,'共享Cookie刷新完成，已重试当前请求');return {response,refreshed:true};
 }
 async acceptVerification(id,{version,cookieHeaders}){
  const role=await this.get(id);if(this.refreshing.has(id)||version!==(role.cookieVersion||0))throw Error('角色会话已变化，请重新验证');
  const previous={cookies:role.cookies,cookieVersion:role.cookieVersion,status:role.status,lastError:role.lastError,lastVerifiedAt:role.lastVerifiedAt};
  const session=new Session();session.cookies=new Map(role.cookies.map(cookie=>[[cookie.domain,cookie.path,cookie.name].join('|'),{...cookie,expires:cookie.expires===null?Infinity:cookie.expires}]));
  session.setCookies('https://xyq.cbg.163.com/cgi-bin/login.py',cookieHeaders||[]);
  Object.assign(role,{cookies:[...session.cookies.values()],cookieVersion:(role.cookieVersion||0)+1,status:'ready',lastError:'',lastVerifiedAt:this.now()});
  try{await this.event('verification_success',id,null,'用户手动完成官方安全验证，继续使用当前会话');}catch(error){Object.assign(role,previous);throw error;}
  return this.public(role);
 }
 async importBrowserSession(id,{version,cookies}){
  const role=await this.get(id);if(this.refreshing.has(id)||version!==(role.cookieVersion||0))throw Error('角色会话已变化，请重新打开验证窗口');
  const domains=new Set(['163.com','cbg.163.com','xyq.cbg.163.com','reg.163.com','dl.reg.163.com']);
  if(!Array.isArray(cookies)||cookies.some(c=>!domains.has(c.domain)||typeof c.name!=='string'||typeof c.value!=='string'||typeof c.path!=='string'||!c.path.startsWith('/')))throw Error('验证会话格式无效');
  const user=cookies.find(c=>c.name==='login_user_urs'),identity=cookies.find(c=>c.name==='login_user_roleid');
  if(user&&decodeURIComponent(user.value).toLowerCase()!==role.account.toLowerCase()||identity&&String(identity.value)!==String(role.gameRoleId))throw Error('验证窗口中的账号或角色已切换，请使用任务绑定的角色');
  const previous={cookies:role.cookies,cookieVersion:role.cookieVersion,status:role.status,lastError:role.lastError};
  Object.assign(role,{cookies:[...role.cookies.filter(c=>!domains.has(c.domain)),...cookies],cookieVersion:(role.cookieVersion||0)+1,status:'ready',lastError:''});
  try{await this.event('verification_session_updated',id,null,'官方窗口会话已同步，等待实际搜索确认验证状态');}catch(error){Object.assign(role,previous);throw error;}
 }
 async syncBrowserCookies(id,{version,cookies}){
  const role=await this.get(id);if(this.refreshing.has(id)||this.verifying.has(id)||version!==(role.cookieVersion||0))return;
  const domains=new Set(['163.com','cbg.163.com','xyq.cbg.163.com','reg.163.com','dl.reg.163.com']);
  if(!Array.isArray(cookies)||cookies.some(c=>!domains.has(c.domain)||typeof c.name!=='string'||typeof c.value!=='string'||typeof c.path!=='string'||!c.path.startsWith('/')))throw Error('官方浏览器会话格式无效');
  const user=cookies.find(c=>c.name==='login_user_urs'),identity=cookies.find(c=>c.name==='login_user_roleid');
  if(user&&decodeURIComponent(user.value).toLowerCase()!==role.account.toLowerCase()||identity&&String(identity.value)!==String(role.gameRoleId))throw Error('官方页面中的角色与任务不一致');
  const previous=role.cookies,next=[...previous.filter(c=>!domains.has(c.domain)),...cookies];
  if(JSON.stringify(next)===JSON.stringify(previous))return;
  role.cookies=next;try{await this.vault.save(this.data);}catch(error){if(role.cookies===next&&version===(role.cookieVersion||0))role.cookies=previous;throw error;}
 }
 async tick(){
  await this.ready();const due=this.data.roles.filter(role=>!this.verifying.has(role.id)&&!this.refreshing.has(role.id)&&this.nextRefreshAt(role)!==null&&this.nextRefreshAt(role)<=this.now());
  await Promise.allSettled(due.map(role=>this.refresh(role.id,undefined,{source:'timer'})));
 }
 async event(type,roleId,taskId,message){await this.ready();this.data.events.unshift({id:crypto.randomUUID(),type,roleId,taskId:taskId||null,message,at:Date.now()});this.data.events=this.data.events.slice(0,500);await this.vault.save(this.data);}
 async refresh(id,taskId,{source=taskId?'task':'manual',expectedVersion}={}){
  if(this.verifying.has(id))throw Error('请先完成或关闭该角色的安全验证窗口');
  if(this.refreshing.has(id))return this.refreshing.get(id);
  const run=(async()=>{
   const role=await this.get(id);
   if(source==='task'&&role.status==='failed')throw Error(role.lastError||'角色Cookie刷新失败，请手动刷新');
   if(expectedVersion!==undefined&&expectedVersion!==(role.cookieVersion||0))return this.public(role);
   const retries=role.refreshRetryLimit??2;role.refreshAttempts=0;
   await this.event('cookie_refresh_start',id,taskId,`开始刷新Cookie（${source==='timer'?'定时':source==='manual'?'手动':'任务触发'}，最多重试 ${retries} 次）`);
   for(let attempt=0;attempt<=retries;attempt++){
    role.refreshAttempts=attempt+1;
    try{
     const context=await this.auth.login(role.account,role.password,role.server,{interactive:false}),selected=await this.auth.select(context,role.gameRoleId);
     Object.assign(role,selected,{status:'ready',lastVerifiedAt:null,lastRefreshedAt:this.now(),lastRefreshAttemptAt:this.now(),lastError:'',cookieVersion:(role.cookieVersion||0)+1});
     await this.event('cookie_refresh_success',id,taskId,`Cookie刷新成功，本轮共尝试 ${role.refreshAttempts} 次`);return this.public(role);
    }catch(error){
     role.lastError=error.message;
     if(attempt<retries&&!/验证码|captcha|滑块|安全验证/i.test(error.message)){await this.event('cookie_refresh_retry',id,taskId,`Cookie刷新失败，角色统一重试 ${attempt+1}/${retries}：${error.message}`);await this.delay(1000);continue;}
     role.status='failed';role.lastRefreshAttemptAt=this.now();await this.event('cookie_refresh_failed',id,taskId,`角色Cookie刷新失败，本轮共尝试 ${role.refreshAttempts} 次：${error.message}`);throw error;
    }
   }
  })();this.refreshing.set(id,run);try{return await run;}finally{this.refreshing.delete(id);}
 }
 async remove(id){if(this.verifying.has(id))throw Error('请先关闭该角色的验证窗口');if(this.refreshing.has(id))throw Error('角色正在刷新Cookie，请完成后再删除');await this.get(id);const old=this.data.roles;this.data.roles=old.filter(role=>role.id!==id);try{await this.vault.save(this.data);}catch(error){this.data.roles=old;throw error;}}
 async events(){await this.ready();return this.data.events;}
 cancel(pendingId){const pending=this.pending.get(pendingId);this.pending.delete(pendingId);if(pending)this.auth.cancel?.(pending.context);}
}
module.exports={RoleManager};
