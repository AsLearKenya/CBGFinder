'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {buildPlans,pagePlan,requestUrl}=require('./search-params.js');
const {RoleRequestGate}=require('./role-request-gate.cjs');
const SearchPolicy=require('./search-policy.js');
const {inferredAccountSecurity}=require('./auth/account-security.cjs');
const {VerificationService}=require('./auth/verification.cjs');
const {RoleManager}=require('./auth/roles.cjs');
const {parseDetail}=require('./item-detail.js');
const {createCollectionHandler}=require('./item-collection.cjs');
const {createStatusHandler}=require('./item-status.cjs');
const {createEstimator}=require('./equipment-estimator.cjs');
const REFERER='https://xyq.cbg.163.com/cgi-bin/equipquery.py?act=show_overall_search_equip';
const files=new Map(['task-transfer.js','task-transfer-ui.js','pet-equipment-valuation.js','sold-valuation.js','sold-valuation-ui.js','role-carried-valuation.js','role-carried-ui.js','yupo-valuation.js','lingshi-valuation.js','link-valuation.js','link-valuation-ui.js','role-valuation-image.js','role-cosmetics-catalog.js','role-cosmetics.js','role-cosmetics-ui.js','role-valuation-costs.js','role-valuation.js','role-estimate-ui.js','weapon-forging-ranges.js','equipment-attribute-focus.js','equipment-estimate-ui.js','equipment-valuation.js','valuation-settings-ui.js','equipment-openings.js','pet-carry-levels.js','storage-ui.js','run-logs.js','task-changes.js','task-change-ui.js','product-actions.js','role-portrait.js','result-updates.js','task-notifications.js','role-details.js','role-details.css','verification.html','verification-widget.js','yupo.js','yupo-options.js','lingshi.js','pet-equipment-options.js','pet-equipment.js','filter-indicators.js','search-policy.js','server-catalog.js','role-options.js','role-search.js','index.html','launch.js','task-storage.js','scheduler.js','app.js','server-picker.js','roles-ui.js','equipment.js','pets.js','pets.css','search-params.js','search-client.js','search-results.js','styles.css','equipment.css','search.css','results.css','roles.css','details-hover.js','details-hover.css','equipment-disclosure.js','equipment-list.css','pet-details.js','pet-details.css'].map(file=>['/'+file,file]));
const contentTypes={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
function send(res,status,text,extra={}){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(text);}
function json(res,status,data,extra={}){send(res,status,JSON.stringify(data),{'Content-Type':'application/json; charset=utf-8',...extra});}
async function readJson(req,limit=262144){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>limit)throw Error('请求内容过大');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Error('请求 JSON 格式无效');}}
function isSessionTimeout(text,status){
 if(status===401)return true;
 try{const data=JSON.parse(text.trim().replace(/^[\w.$]+\s*\(/,'').replace(/\)\s*;?\s*$/,''));const code=String(data.status_code||data.code||'');return /timeout/i.test(code)||/登录[已]?过期|登陆[已]?过期|登录超时|session.*expired/i.test(String(data.msg||data.message||''));}catch{return /^(?:SESSION_TIMEOUT|LOGIN_TIMEOUT)$/i.test(text.trim());}
}
function isCaptchaResponse(text){
 const source=String(text||'').trim();
 try{
  const data=JSON.parse(source.replace(/^[\w.$]+\s*\(/,'').replace(/\)\s*;?\s*$/,''));
  if(!data||typeof data!=='object'||Array.isArray(data))return false;
  const code=String(data.status_code||data.code||'');
  if(/^CAPTCHA_AUTH$/i.test(code))return true;
  if(/^(MIBAO_AUTH|OTP_AUTH)$/i.test(code))return false;
  return ['0','false','-1'].includes(String(data.status))&&/请输入验证码|需要.{0,8}验证|验证码校验/.test(String(data.msg||data.message||''));
 }catch{
  // Shared scripts, comments and form placeholders are not verification responses.
  const visible=source.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  if(/^CAPTCHA_AUTH$/i.test(visible))return true;
  const title=source.match(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)\s*>/i)?.[1]?.replace(/<[^>]*>/g,'')||'';
  return /安全验证|人机验证|访问验证|请输入验证码/.test(title)&&/验证码|CAPTCHA_AUTH/.test(visible);
 }
}
function createServer({upstreamFetch=globalThis.fetch,officialFetch=(roleId,url,options)=>upstreamFetch(url,options),roleManager=new RoleManager({directory:process.env.CBG_DATA_DIR||path.join(__dirname,'.data')}),requestGate=new RoleRequestGate(),verificationOrigin=null,browserVerification=null}={}){
 const verification=new VerificationService({roles:roleManager,fetch:upstreamFetch,officialFetch});
 const collectItem=createCollectionHandler({roles:roleManager,gate:requestGate,fetch:upstreamFetch,officialFetch,isCaptcha:isCaptchaResponse,isExpired:isSessionTimeout});
 const getItemStatus=createStatusHandler({roles:roleManager,gate:requestGate,fetch:upstreamFetch,officialFetch,isCaptcha:isCaptchaResponse,isExpired:isSessionTimeout});
 const estimator=createEstimator({roles:roleManager,gate:requestGate,officialFetch,isCaptcha:isCaptchaResponse,isExpired:isSessionTimeout,cacheDirectory:roleManager.vault?.directory||null});
 const yupoEstimator=require('./lingshi-estimator.cjs').createLingshiEstimator({roles:roleManager,equipment:estimator,cacheDirectory:roleManager.vault?.directory||null,category:'上古玉魄',rules:require('./yupo-valuation.js')});
 const petEquipmentEstimator=require('./lingshi-estimator.cjs').createLingshiEstimator({roles:roleManager,equipment:estimator,cacheDirectory:roleManager.vault?.directory||null,category:'召唤兽装备',rules:require('./pet-equipment-valuation.js')});
 const lingshiEstimator=require('./lingshi-estimator.cjs').createLingshiEstimator({roles:roleManager,equipment:estimator,cacheDirectory:roleManager.vault?.directory||null});
 const activeRequests=new Set(),verificationCheckTimes=new Map();
 const detailCache=new Map();
 let widgetServer=null,widgetReady=null;
 function widgetOrigin(){
  if(verificationOrigin)return Promise.resolve(verificationOrigin);
  if(widgetReady)return widgetReady;
  widgetReady=new Promise((resolve,reject)=>{
   widgetServer=http.createServer(async(req,res)=>{
    const expected=`127.0.0.1:${req.socket.localPort}`,file=({'/verification.html':'verification.html','/verification-widget.js':'verification-widget.js'})[new URL(req.url,'http://'+expected).pathname];
    if(req.headers.host!==expected||req.method!=='GET'||!file){send(res,403,'仅提供官方验证组件页面');return;}
    try{send(res,200,await fs.readFile(path.join(__dirname,file)),{'Content-Type':contentTypes[path.extname(file)],'Referrer-Policy':'no-referrer'});}catch{send(res,500,'验证页面暂不可用');}
   });
   widgetServer.once('error',error=>{widgetReady=null;reject(error);});
   widgetServer.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${widgetServer.address().port}`));
  });return widgetReady;
 }

 const server=http.createServer(async(req,res)=>{
  const expectedHost=`127.0.0.1:${req.socket.localPort}`;
  if(req.headers.host!==expectedHost){send(res,403,'请使用 127.0.0.1 地址打开本地服务');return;}
  const pathname=new URL(req.url,'http://'+expectedHost).pathname;
  if(req.method==='GET'&&/^\/api\/role-portrait\/\d{1,6}$/.test(pathname)){
   try{const id=pathname.split('/').pop(),response=await upstreamFetch('https://cbg-xyq.res.netease.com/images/bigface/'+id+'.gif',{signal:AbortSignal.timeout(12000)});if(!response.ok||!/^image\//i.test(response.headers.get('content-type')||''))throw Error('头像不可用');const body=Buffer.from(await response.arrayBuffer());if(body.length>2*1024*1024)throw Error('头像过大');res.writeHead(200,{'Content-Type':response.headers.get('content-type'),'Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'});res.end(body);}catch{send(res,502,'角色头像加载失败');}return;
  }
  if(req.method==='GET'&&(pathname==='/'||files.has(pathname))){try{const file=pathname==='/'?'index.html':files.get(pathname);const body=await fs.readFile(path.join(__dirname,file));res.writeHead(200,{'Content-Type':contentTypes[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(body);}catch{send(res,500,'无法读取页面文件');}return;}
  if(req.method==='GET'&&['/api/roles','/api/activity'].includes(pathname)){try{json(res,200,pathname==='/api/roles'?{roles:(await roleManager.list()).map(role=>({...role,requestPolicy:SearchPolicy,requestQueue:requestGate.snapshot(role.id)})),officialVerificationWindow:!!browserVerification}:{events:await roleManager.events()});}catch(error){json(res,500,{message:error.message});}return;}
  if(req.method!=='POST'||!pathname.startsWith('/api/')){send(res,404,'Not found');return;}
  if(req.headers.origin!==`http://${expectedHost}`||!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')){send(res,403,'只接受当前本地页面的请求');return;}
  if(pathname==='/api/material-prices/custom'){
   try{json(res,200,await estimator.setCustomPrice(await readJson(req)));}catch(error){json(res,400,{message:error.message});}return;
  }
  if(pathname==='/api/material-prices'){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000);res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   try{await readJson(req);const result=await estimator.preloadMaterials({signal:controller.signal});if(!res.destroyed)json(res,200,result);}catch(error){if(!res.destroyed)json(res,400,{message:controller.signal.aborted?'材料报价加载已取消或超时':error.message});}finally{clearTimeout(timer);}return;
  }
  if(['/api/equipment-valuation','/api/lingshi-valuation','/api/yupo-valuation','/api/pet-equipment-valuation'].includes(pathname)){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),600000),logs=[];res.on('close',()=>{if(!res.writableEnded)controller.abort();});
   const streaming=/application\/x-ndjson/i.test(req.headers.accept||'');
   const write=value=>{if(!res.destroyed)res.write(JSON.stringify(value)+'\n');};
   try{const input=await readJson(req,8*1024*1024);if(streaming){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.flushHeaders?.();}const result=await (pathname==='/api/pet-equipment-valuation'?petEquipmentEstimator:pathname==='/api/yupo-valuation'?yupoEstimator:pathname==='/api/lingshi-valuation'?lingshiEstimator:estimator).estimate(input,{signal:controller.signal,onRequest:row=>{logs.push(row);if(streaming&&input.task?.requestPriority==='interactive')write({type:'progress',result:{version:require('./equipment-valuation.js').COMPARISON_VERSION,group:input.group,items:[],stage:row.message,partial:true,complete:false}});},...(streaming?{onProgress:result=>write({type:'progress',result})}:{})});if(streaming){write({type:'result',result});res.end();}else json(res,200,result);}catch(error){if(!res.destroyed){const result={message:controller.signal.aborted?'估价已取消或超时':error.message,logs};if(streaming&&res.headersSent){write({type:'error',...result});res.end();}else json(res,400,result);}}finally{clearTimeout(timer);}return;
  }
  if(['/api/verification/window/open','/api/verification/window/finish'].includes(pathname)){
   try{if(!browserVerification)throw Error('当前服务未启用官方验证窗口，请使用 npm start 启动');const input=await readJson(req);if(typeof input?.roleId!=='string'||!input.roleId||input.roleId.length>100)throw Error('请选择角色');json(res,200,await browserVerification[pathname.endsWith('/open')?'open':'finish'](input));}catch(error){json(res,400,{message:error.message});}return;
  }
  if(pathname==='/api/item-status'){try{json(res,200,await getItemStatus(await readJson(req),{userAgent:req.headers['user-agent']||'Mozilla/5.0'}));}catch(error){json(res,400,{message:error.message});}return;}
  if(pathname==='/api/item-collect'){
   try{json(res,200,await collectItem(await readJson(req),{userAgent:req.headers['user-agent']||'Mozilla/5.0'}));}
   catch(error){json(res,400,{message:error.name==='TimeoutError'?'收藏操作超时，请稍后确认官网收藏状态':error.message});}
   return;
  }
  if(pathname==='/api/item-detail'){
   try{
    const input=await readJson(req);
    if(typeof input.roleId!=='string'||!input.roleId||!/^\d{1,6}$/.test(String(input.serverId))||!/^\d{15}-\d+-[A-Za-z0-9]{1,40}$/.test(String(input.eid)))throw Error('商品详情参数无效');
    // Official EIDs may retain the original server after a move/merge; use the listing server.
    await roleManager.get(input.roleId);
    const key=JSON.stringify([input.roleId,String(input.serverId),input.eid]);
    if(input.priority==='interactive')requestGate.promote?.(input.roleId,'detail:'+key,10);
    const cached=detailCache.get(key);if(cached&&cached.until>Date.now()){json(res,200,await cached.promise);return;}
    const promise=(async()=>{
     const url='https://xyq.cbg.163.com/equip?s='+input.serverId+'&eid='+input.eid;
     const load=async(session)=>requestGate.run(input.roleId,async()=>{
      if(session&&roleManager.cookieSnapshot)Object.assign(session,await roleManager.cookieSnapshot(input.roleId,url));
      const response=await officialFetch(input.roleId,url,{headers:{Cookie:session?.cookie||await roleManager.cookie(input.roleId,url),'User-Agent':'Mozilla/5.0',Accept:'text/html',Referer:REFERER},redirect:'manual',signal:AbortSignal.timeout(25000)});
      if(response.status===301||response.status===302||response.status===401)return null;
      if(response.status===429){const message='官网返回请求过于频繁，已暂停该角色的请求，请稍后刷新Cookie再试';requestGate.block(input.roleId,message);throw Error(message);}
      if(!response.ok)throw Error('官网详情请求失败：HTTP '+response.status);
      const body=await response.arrayBuffer();if(body.byteLength>3000000)throw Error('商品详情过大');
      const html=new TextDecoder(/charset=utf-?8/i.test(response.headers.get('content-type')||'')?'utf-8':'gb18030').decode(body);
      // A complete product payload wins over common login/CAPTCHA widgets in the page shell.
      let detail,parseError;try{detail=parseDetail(html);}catch(error){parseError=error;}
      if(detail)return detail;
      if(isCaptchaResponse(html)){const message='官网要求验证码，已暂停该角色的请求，请在本地完成官方安全验证后重试';requestGate.block(input.roleId,message);throw Error(message);}
      if(!/<textarea\b[^>]*\bid=["'](?:pet_desc|equip_desc_value)["']/i.test(html)&&/do_anon_auth|show_login|登录状态/.test(html))return null;
      throw parseError;
     },{priority:input.priority==='interactive'?10:0,priorityKey:'detail:'+key});
     let detail;if(roleManager.request)detail=(await roleManager.request(input.roleId,url,load,{isExpired:value=>value===null})).response;
     else {detail=await load();if(!detail){await roleManager.refresh(input.roleId);detail=await load();if(!detail)throw Error('刷新cookie后仍无法读取商品详情');}}
     return detail;
    })();
    if(detailCache.size>=100)detailCache.delete(detailCache.keys().next().value);
    detailCache.set(key,{promise,until:Date.now()+120000});
    try{json(res,200,await promise);}catch(error){detailCache.delete(key);throw error;}
   }catch(error){json(res,400,{message:error.name==='TimeoutError'?'商品详情请求超时':error.message});}
   return;
  }
  const checkingVerification=pathname==='/api/verification/check';
  if(pathname!=='/api/search-once'&&!checkingVerification){
   try{
    const input=await readJson(req);
    if(pathname==='/api/verification/start'){if(requestGate.snapshot(input.roleId).active)throw Error('请等待该角色当前请求结束后再验证');const origin=await widgetOrigin(),flow=await verification.begin(input.roleId,{userAgent:req.headers['user-agent']||'Mozilla/5.0'});verification.flows.get(flow.id).previousBlock=requestGate.snapshot(input.roleId).blocked;requestGate.block(input.roleId,'官网要求验证码，等待用户手动验证');json(res,200,{...flow,widgetUrl:`${origin}/verification.html#${flow.id}`});}
    else if(pathname==='/api/verification/cancel'){const flow=verification.flows.get(input.id);verification.cancel(input.id);if(flow){if(flow.previousBlock)requestGate.block(flow.roleId,flow.previousBlock);else requestGate.resume(flow.roleId);}json(res,200,{ok:true});}
    else if(pathname==='/api/verification/submit'){const verified=await verification.submit(input);requestGate.resume(verified.roleId);json(res,200,{ok:true,role:{...roleManager.public(await roleManager.get(verified.roleId)),requestQueue:requestGate.snapshot(verified.roleId)}});}
    else if(pathname==='/api/roles/login')json(res,200,await roleManager.begin(input));
    else if(pathname==='/api/roles/login-complete')json(res,200,await roleManager.completeLogin(input));
    else if(pathname==='/api/roles/login-focus')json(res,200,await roleManager.focusLogin(input));
    else if(pathname==='/api/roles/save')json(res,200,{role:await roleManager.save(input)});
    else if(pathname==='/api/roles/cancel'){roleManager.cancel(input.pendingId);json(res,200,{ok:true});}
    else if(pathname==='/api/roles/settings')json(res,200,{role:await roleManager.settings(input.id,input)});
    else if(pathname==='/api/roles/refresh'){const role=await roleManager.refresh(input.id);requestGate.resume(input.id);json(res,200,{role});}
    else if(pathname==='/api/roles/delete'){await roleManager.remove(input.id);json(res,200,{ok:true});}
    else json(res,404,{message:'接口不存在'});
   }catch(error){json(res,400,{message:error.message});}
   return;
  }
  let activeTaskId=null,checkingRoleId=null;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),checkingVerification?30000:180000);
  res.on('close',()=>{if(!res.writableEnded)controller.abort();});
  try{
   const input=await readJson(req),task=input.task,plans=buildPlans(task);
   if(checkingVerification){checkingRoleId=task.roleId;input.planIndex=0;input.page=1;if(roleManager.verifying?.has(task.roleId))throw Error('请先关闭正在进行的验证窗口');const previous=verificationCheckTimes.get(task.roleId);if(previous!==undefined&&Date.now()-previous<30000)throw Error('已检查过该角色，请30秒后再试');verificationCheckTimes.set(task.roleId,Date.now());}
   if(typeof task.roleId!=='string'||!task.roleId)throw Error('请先为任务绑定角色');
   if(typeof task.id!=='string'||!task.id)throw Error('任务编号无效');
   const requestKey=JSON.stringify([task.id,input.planIndex]);
   if(activeRequests.has(requestKey)){send(res,409,'该任务已有搜索请求正在执行');return;}
   activeTaskId=requestKey;activeRequests.add(activeTaskId);
   if(!Number.isInteger(input.planIndex)||input.planIndex<0||input.planIndex>=plans.length)throw Error('搜索分组无效');
   const url=requestUrl(pagePlan(plans[input.planIndex],input.page===undefined?1:input.page));
   const fetchPage=async(session)=>requestGate[checkingVerification?'probe':'run'](task.roleId,async()=>{
    controller.signal.throwIfAborted();
    if(session&&roleManager.cookieSnapshot)Object.assign(session,await roleManager.cookieSnapshot(task.roleId,url,{signal:controller.signal}));
    const cookie=session?.cookie||await roleManager.cookie(task.roleId,url);
    const headers={Accept:'*/*','Accept-Language':'zh-CN,zh;q=0.9',Referer:task.category==='上古玉魄'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_yupo':task.category==='灵饰'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_lingshi':task.category==='召唤兽装备'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_pet_equip_search_form':task.category==='角色'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py':task.category==='召唤兽'?REFERER.replace('search_equip','search_pet'):REFERER,'User-Agent':req.headers['user-agent']||'Mozilla/5.0',Cookie:cookie};
    const upstream=await officialFetch(task.roleId,url,{method:'GET',headers,redirect:'error',signal:controller.signal});
    let body=Buffer.from(await upstream.arrayBuffer());
    const inferred=inferredAccountSecurity(body.toString('utf8'));if(inferred)body=Buffer.from(JSON.stringify(inferred));
    if(/MIBAO_AUTH|OTP_AUTH/.test(body.toString('utf8'))){let message;try{require('./search-results.js').parseResponse(body.toString('utf8'));}catch(error){message=error.message;}requestGate.block(task.roleId,message||'可能需要将军令验证 · MIBAO_AUTH');}
    if(isCaptchaResponse(body.toString('utf8'))){const message='官网要求验证码，已暂停该角色的请求，请在本地完成官方安全验证后重试';requestGate.block(task.roleId,message);throw Error(message);}
    if(upstream.status===429){const message='官网返回请求过于频繁，已暂停该角色的请求，请稍后刷新Cookie再试';requestGate.block(task.roleId,message);throw Error(message);}
    return {status:upstream.status,body};
   },{signal:controller.signal,taskId:task.id});
   let response,refreshed=false;
   if(roleManager.request){const result=await roleManager.request(task.roleId,url,fetchPage,{taskId:task.id,signal:controller.signal,isExpired:value=>isSessionTimeout(value.body.toString('utf8'),value.status)});response=result.response;refreshed=result.refreshed;}
   else response=await fetchPage();
   if(!roleManager.request&&isSessionTimeout(response.body.toString('utf8'),response.status)){
    try{await roleManager.refresh(task.roleId,task.id);}catch(error){if(!res.destroyed)json(res,502,{code:'COOKIE_REFRESH_FAILED',message:'角色会话刷新失败：'+error.message},{'X-Cbg-Fatal':'1'});return;}
    controller.signal.throwIfAborted();refreshed=true;response=await fetchPage();
    if(!roleManager.request&&isSessionTimeout(response.body.toString('utf8'),response.status)){
     await roleManager.event('cookie_retry_failed',task.roleId,task.id,'刷新后重试仍返回登录超时，本轮任务失败');
     json(res,502,{code:'SESSION_TIMEOUT_AFTER_REFRESH',message:'刷新角色会话后仍然登录超时，本轮任务失败'},{'X-Cbg-Fatal':'1'});return;
    }
    await roleManager.event('cookie_retry_success',task.roleId,task.id,'会话刷新后已重试当前页');
   }
   if(res.destroyed)return;
   if(checkingVerification){if(response.status!==200)throw Error('官网请求失败：HTTP '+response.status);const parsed=require('./search-results.js').parseResponse(response.body.toString('utf8'));requestGate.resume(task.roleId);if(roleManager.event)await roleManager.event('verification_check_success',task.roleId,task.id,'实际请求已恢复，不再需要验证');const role=roleManager.public&&roleManager.get?roleManager.public(await roleManager.get(task.roleId)):null;json(res,200,{available:true,requiresVerification:false,role:role?{...role,requestQueue:requestGate.snapshot(task.roleId)}:null});return;}
   send(res,200,response.body,{'X-Upstream-Status':String(response.status),'X-Cbg-Request-Url':url,'X-Session-Refreshed':refreshed?'1':'0'});
  }catch(error){if(!res.destroyed&&checkingVerification){const inferred=inferredAccountSecurity(error.message);if(inferred)error.message=inferred.msg+' · MIBAO_AUTH';const code=error.message.match(/MIBAO_AUTH|OTP_AUTH/)?.[0]||'';if(code)requestGate.block(checkingRoleId,error.message);json(res,200,{available:false,requiresVerification:/官网要求验证码/.test(error.message),requiresAccountSecurity:Boolean(code),code,message:error.message});return;}if(!res.destroyed){const unavailable=['OFFICIAL_PAGE_UNAVAILABLE','OFFICIAL_TEMPORARILY_UNAVAILABLE'].includes(error.code);json(res,error.name==='AbortError'?504:unavailable?503:400,{...(unavailable?{code:error.code,retryAfterSeconds:error.retryAfterSeconds||30}:{}),message:error.name==='AbortError'?'搜索请求超时或已取消':error.message},{'X-Cbg-Fatal':'1',...(unavailable?{'Retry-After':String(error.retryAfterSeconds||30)}:{})});}}
  finally{clearTimeout(timeout);if(activeTaskId!==null)activeRequests.delete(activeTaskId);}
 });
 let refreshTimer=null;
 server.on('listening',()=>{if(roleManager.tick){refreshTimer=setInterval(()=>{void roleManager.tick().catch(()=>{});},1000);refreshTimer.unref();void roleManager.tick().catch(()=>{});}});
 server.on('close',()=>{widgetServer?.close();for(const id of verification.flows.keys())verification.clear(id);if(refreshTimer)clearInterval(refreshTimer);});
 const browserVerifications=new Map();
 server.beginBrowserVerification=async roleId=>{
  if(roleManager.verifying?.has(roleId)||roleManager.refreshing?.has(roleId)||requestGate.snapshot(roleId).active)throw Error('请等待该角色当前操作结束');
  roleManager.verifying?.add(roleId);const previous=requestGate.snapshot(roleId).blocked;requestGate.block(roleId,'官方验证窗口已打开，请在窗口中完成验证');
  try{const role=await roleManager.get(roleId);if(browserVerifications.has(roleId))throw Error('该角色已有验证窗口');browserVerifications.set(roleId,previous);return {version:role.cookieVersion||0,cookies:role.cookies.map(c=>({...c}))};}catch(error){roleManager.verifying?.delete(roleId);if(previous)requestGate.block(roleId,previous);else requestGate.resume(roleId);throw error;}
 };
 server.endBrowserVerification=roleId=>{
  if(!browserVerifications.has(roleId))return;const previous=browserVerifications.get(roleId);browserVerifications.delete(roleId);roleManager.verifying?.delete(roleId);verificationCheckTimes.delete(roleId);
  requestGate.block(roleId,previous||'官方验证窗口已关闭，请尝试请求确认验证状态');
 };
 server.isVerificationWindowUrl=value=>{try{const url=new URL(value),address=widgetServer?.address();return !!address&&url.origin===`http://127.0.0.1:${address.port}`&&url.pathname==='/verification.html'&&!url.search&&[...verification.flows.keys()].some(id=>url.hash==='#'+id);}catch{return false;}};
 return server;
}
if(require.main===module)require('./web-runtime.cjs').launchRuntime();
module.exports={createServer,isSessionTimeout,isCaptchaResponse};
