'use strict';
const crypto=require('node:crypto');
const {inferredAccountSecurity}=require('../auth/account-security.cjs');
const {allowedUrl,seedCookie,savedCookies}=require('./verification-session.cjs');
const DEFAULT_PAGE='https://xyq.cbg.163.com/cgi-bin/equipquery.py?act=show_overall_search_equip';
// Electron includes the localized app name in HTTP User-Agent. Keep the native
// browser/version tokens but use an ASCII app product token accepted by HTTP servers.
function officialUserAgent(value){return String(value).replace(/[^\x20-\x7e]+/g,'CBG-Finder');}
function pageFor(url,referer){
 const target=new URL(url),type=target.searchParams.get('search_type');
 const pages={overall_search_pet:'https://xyq.cbg.163.com/cgi-bin/equipquery.py?act=show_overall_search_pet',overall_search_equip:DEFAULT_PAGE,overall_search_lingshi:'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_lingshi',yupo_search:'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_yupo',overall_search_pet_equip:'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_pet_equip_search_form',overall_search_role:'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_search_role_form'};
 if(pages[type])return pages[type];
 try{const candidate=new URL(referer);if(candidate.origin==='https://xyq.cbg.163.com'&&['/cgi-bin/equipquery.py','/cgi-bin/xyq_overall_search.py','/cgi-bin/query.py'].includes(candidate.pathname))return candidate.href;}catch{}
 return DEFAULT_PAGE;
}
function validateTarget(value,method){const u=new URL(value);if(u.origin!=='https://xyq.cbg.163.com'||u.username||u.password||!['/cgi-bin/recommend.py','/equip','/cgi-bin/userinfo.py','/cgi-bin/login.py'].includes(u.pathname)||!['GET','POST'].includes(method))throw Error('官方请求地址无效');return u;}
function responseKey(value){const u=new URL(value);u.searchParams.delete('callback');u.searchParams.delete('_');u.searchParams.sort();return u.href;}
function pageStateScript(){return `(()=>{
 const text=document.body?.innerText||'';
 return {ready:typeof Request!=='undefined'&&typeof Request.JSONP==='function',security:text.match(/MIBAO_AUTH|OTP_AUTH|CAPTCHA_AUTH/)?.[0]||'',login:/请先登录|登录状态已失效|登录已过期/.test(text),captcha:/请输入验证码|人机验证/.test(text),busy:/系统繁忙|系统忙|稍候再试/.test(text),errorCode:text.match(/\\be(?:b)?[-_][a-z0-9_-]*\\d+\\b/i)?.[0]||''};
})()`;}
function wait(ms,signal){return new Promise((resolve,reject)=>{signal?.throwIfAborted();let timer;const abort=()=>{clearTimeout(timer);reject(signal.reason||Error('请求已取消'));};timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);signal?.addEventListener('abort',abort,{once:true});});}
// Execute only a fixed transport adapter in a sandboxed official page. Credentials stay in Chromium.
function requestScript(url,options,id){
 const method=options.method||'GET',u=validateTarget(url,method),headers=Object.fromEntries(Object.entries(options.headers||{}).filter(([key])=>['accept','content-type','x-requested-with','x-request'].includes(key.toLowerCase())));
 const params=Object.fromEntries(u.searchParams);delete params.callback;delete params._;
 const input={url:u.href,base:u.origin+u.pathname,params,method,headers,body:options.body,id,jsonp:u.pathname==='/cgi-bin/recommend.py'&&method==='GET'};
 return `(async function(input){
  window.__cbgOfficialRequests=window.__cbgOfficialRequests||new Map();
  if(input.jsonp){
   if(typeof Request.JSONP!=='function')throw Error('官方搜索页面尚未就绪，请稍后重试');
   return await new Promise((resolve,reject)=>{
    let request,timer,done=false;const finish=(error,data)=>{if(done)return;done=true;clearTimeout(timer);window.__cbgOfficialRequests.delete(input.id);if(error){request?.cancel();reject(Error(error));}else resolve({status:200,headers:{'content-type':'application/json; charset=UTF-8'},body:JSON.stringify(data)});};
    request=new Request.JSONP({url:input.base,data:input.params,timeout:25000,onSuccess:data=>finish(null,data),onFailure:()=>finish('官方页面请求失败，请稍后重试'),onTimeout:()=>finish('官方页面请求超时')});
    window.__cbgOfficialRequests.set(input.id,()=>finish('请求已取消'));timer=setTimeout(()=>finish('官方页面请求超时'),26000);request.send();
   });
  }
  const controller=new AbortController();window.__cbgOfficialRequests.set(input.id,()=>controller.abort());
  try{const response=await fetch(input.url,{method:input.method,headers:input.headers,body:input.body,credentials:'include',redirect:'manual',signal:controller.signal});
   const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>3000000)throw Error('官网响应过大');
   return {status:response.status||302,headers:Object.fromEntries(response.headers),bytes:Array.from(bytes)};
  }finally{window.__cbgOfficialRequests.delete(input.id);}
 })(${JSON.stringify(input)})`;
}
function createOfficialClient({BrowserWindow,session,roles,delay=wait,now=Date.now}){
 const workers=new Map();let disposed=false;
 function workerFor(roleId){
  if(disposed)throw Error('官方请求通道已关闭');
  let worker=workers.get(roleId);
  if(!worker||worker.window.isDestroyed()){
   const browserSession=session.fromPartition('cbg-official-'+crypto.randomUUID());
   browserSession.setUserAgent(officialUserAgent(browserSession.getUserAgent()));
   browserSession.setPermissionRequestHandler((_w,_p,done)=>done(false));browserSession.on('will-download',event=>event.preventDefault());
   const window=new BrowserWindow({title:'官方安全验证 · 当前角色会话',width:1000,height:800,minWidth:520,minHeight:600,show:false,webPreferences:{session:browserSession,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,backgroundThrottling:false}});
   const guard=(event,url)=>{if(!allowedUrl(url))event.preventDefault();};window.webContents.on('will-navigate',guard);window.webContents.on('will-redirect',guard);
   window.webContents.setWindowOpenHandler(({url})=>{if(allowedUrl(url))void window.loadURL(url).catch(()=>{});return {action:'deny'};});
   window.on('close',event=>{if(!disposed){event.preventDefault();window.hide();}});
   const httpStatuses=new Map();browserSession.webRequest?.onResponseStarted({urls:['https://xyq.cbg.163.com/cgi-bin/recommend.py*']},details=>{if(httpStatuses.size>=100)httpStatuses.delete(httpStatuses.keys().next().value);httpStatuses.set(responseKey(details.url),{at:Date.now(),status:details.statusCode});});
   worker={roleId,session:browserSession,window,version:null,queue:Promise.resolve(),page:null,httpStatuses};workers.set(roleId,worker);
  }
  return worker;
 }
 async function acquire(roleId){
  const role=await roles.get(roleId),worker=workerFor(roleId),version=role.cookieVersion||0;
  if(worker.version!==version){
   await worker.session.clearStorageData();
   for(const row of role.cookies){const cookie=seedCookie(row);if(cookie)await worker.session.cookies.set(cookie);}
   worker.version=version;worker.page=null;worker.cooldown=null;
  }
  return worker;
 }
 async function prepare(worker,page,signal,{jsonp=false}={}){
  signal?.throwIfAborted();
  if(worker.page===page&&worker.window.webContents.getURL()===page){if(!jsonp||(await worker.window.webContents.executeJavaScript(pageStateScript())).ready)return;worker.page=null;}
  let state;
  for(let attempt=0;attempt<2;attempt++){
   signal?.throwIfAborted();worker.page=null;
   let timer,abort;const loading=worker.window.loadURL(page);
   try{await Promise.race([loading,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('官方页面加载超时')),30000);if(signal){abort=()=>reject(signal.reason||Error('请求已取消'));signal.addEventListener('abort',abort,{once:true});}})]);}catch(error){worker.window.webContents.stop();throw error;}finally{clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
   const actual=worker.window.webContents.getURL();if(new URL(actual).origin!=='https://xyq.cbg.163.com')throw Error('官方页面已跳转，请在当前会话中处理登录状态');
   if(!jsonp){worker.page=actual===page?page:null;return;}
   for(let poll=0;poll<9;poll++){
    signal?.throwIfAborted();state=await worker.window.webContents.executeJavaScript(pageStateScript());
    if(state.ready||state.security||state.login||state.captcha||state.busy||state.errorCode||poll===8)break;
    await delay(250,signal);
   }
   if(state.ready){worker.page=actual===page?page:null;return;}
   const location=new URL(actual),account=location.pathname==='/cgi-bin/login.py'&&location.searchParams.get('act')==='show_mbauth';
   const code=state.security||(account?'MIBAO_AUTH':state.login?'LOGIN_TIMEOUT':state.captcha?'CAPTCHA_AUTH':'');
   if(code)throw Object.assign(Error('官方页面需要处理登录或安全验证'),{officialResponse:{status:0,status_code:code,msg:code==='LOGIN_TIMEOUT'?'登录状态已失效':code==='CAPTCHA_AUTH'?'官网需要验证码':'官网需要账号安全验证'}});
   if(attempt===0)await delay(1000,signal);
  }

  const inferred=inferredAccountSecurity(state.errorCode);if(inferred)throw Object.assign(Error(inferred.msg),{officialResponse:inferred});
  throw Object.assign(Error(state.busy||state.errorCode?'官网搜索页面暂时繁忙'+(state.errorCode?'（'+state.errorCode+'）':'')+'，已重新加载一次；稍后可重试':'官方搜索页面的请求组件加载失败，已重新加载一次；请检查网络后重试'),{code:'OFFICIAL_PAGE_UNAVAILABLE'});
 }
 async function perform(roleId,url,options={}){
  validateTarget(url,options.method||'GET');const {signal}=options;signal?.throwIfAborted();await roles.get(roleId);const worker=workerFor(roleId);
  const operation=async()=>{
   signal?.throwIfAborted();const current=await acquire(roleId),search=new URL(url).pathname==='/cgi-bin/recommend.py';
   if(search&&current.cooldown?.until>now())throw Object.assign(Error(current.cooldown.message+'；已暂停该角色搜索，请 '+Math.ceil((current.cooldown.until-now())/1000)+' 秒后重试'),{code:'OFFICIAL_TEMPORARILY_UNAVAILABLE',retryAfterSeconds:Math.ceil((current.cooldown.until-now())/1000)});
   try{await prepare(current,pageFor(url,options.headers?.Referer),signal,{jsonp:new URL(url).pathname==='/cgi-bin/recommend.py'&&(options.method||'GET')==='GET'});}catch(error){current.page=null;if(error.code==='OFFICIAL_PAGE_UNAVAILABLE'){current.cooldown={until:now()+30000,message:error.message};error.retryAfterSeconds=30;}if(error.officialResponse&&!signal?.aborted)return new Response(JSON.stringify(error.officialResponse),{status:200,headers:{'content-type':'application/json; charset=UTF-8'}});throw error;}
   signal?.throwIfAborted();
   const id=crypto.randomUUID(),startedAt=Date.now();current.httpStatuses.delete(responseKey(url));let abort;
   try{
    const pending=current.window.webContents.executeJavaScript(requestScript(url,options,id));
    const result=await Promise.race([pending,new Promise((_,reject)=>{if(signal){abort=()=>{void current.window.webContents.executeJavaScript(`window.__cbgOfficialRequests?.get(${JSON.stringify(id)})?.()`).catch(()=>{});reject(signal.reason||Error('请求已取消'));};signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();}})]);
    signal?.throwIfAborted();
    if((result.bytes?.length||result.body?.length||0)>3000000)throw Error('官网响应过大');
    if(search&&result.body){let data;try{data=JSON.parse(result.body);}catch{}const inferred=data&&String(data.status_code||data.code||'')==='ERR'&&inferredAccountSecurity(data.msg||data.message);if(inferred)return new Response(JSON.stringify(inferred),{status:200,headers:{'content-type':'application/json; charset=UTF-8'}});if(data&&String(data.status_code||data.code||'')==='ERR'&&/系统繁忙|系统忙/.test(String(data.msg||data.message||''))){current.cooldown={until:now()+30000,message:String(data.msg||data.message)};throw Object.assign(Error(current.cooldown.message+'；已暂停该角色搜索，请 30 秒后重试'),{code:'OFFICIAL_TEMPORARILY_UNAVAILABLE',retryAfterSeconds:30});}}
    return new Response(result.bytes?new Uint8Array(result.bytes):result.body,{status:result.status,headers:result.headers});
   }catch(error){
    current.page=null;
    const http=current.httpStatuses.get(responseKey(url));if(!signal?.aborted&&http?.at>=startedAt&&http.status>=400)return new Response('',{status:http.status});throw error;
   }finally{if(abort)signal.removeEventListener('abort',abort);if(roles.syncBrowserCookies&&!roles.verifying?.has(roleId))await roles.syncBrowserCookies(roleId,{version:current.version,cookies:savedCookies(await current.session.cookies.get({}))});}
  };
  const result=worker.queue.then(operation,operation);worker.queue=result.catch(()=>{});return result;
 }
 return {acquire,fetch:perform,adoptVersion(roleId,version){const worker=workers.get(roleId);if(worker){worker.version=version;worker.cooldown=null;worker.page=worker.window.webContents.getURL();}},invalidate(roleId){const worker=workers.get(roleId);if(worker){worker.version=null;worker.page=null;}},dispose(){disposed=true;for(const worker of workers.values()){worker.window.destroy();void worker.session.clearStorageData().catch(()=>{});}workers.clear();}};
}
module.exports={createOfficialClient,pageFor,requestScript,validateTarget,pageStateScript,officialUserAgent};
