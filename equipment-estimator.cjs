'use strict';
const crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const V=require('./equipment-valuation.js'),P=require('./search-params.js'),R=require('./search-results.js'),L=require('./lingshi.js'),Openings=require('./equipment-openings.js');
const PetValuation=require('./pet-equipment-valuation.js'),Sampling=require('./valuation-sampling.cjs');
const {inferredAccountSecurity}=require('./auth/account-security.cjs');
const THREE_HOURS=3*60*60*1000;
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));return value;}
function slim(item){if(item.valuationMeta)item={...item,valuationMeta:{...item.valuationMeta,roleExclusive:V.isRoleExclusive(item),holeSets:Openings.parse(item.valuationMeta,item.description||(item.traits||[]).join('\n'))}};return Object.fromEntries(['id','detailEid','orderSn','collected','serverId','server','area','name','type','kind','equipmentKindId','level','price','priceDisplay','icon','valuationMeta','attributes','added','specialSkills','specialEffects','suits','carriedTarget'].filter(k=>item[k]!==undefined).map(k=>[k,item[k]]));}
function createEstimator({roles,gate,officialFetch,isCaptcha,isExpired,cacheDirectory=null,now=Date.now}){
 const fullCache=new Map(),pending=new Map(),materialCache=new Map(),materialPending=new Map(),materialGradePending=new Map(),jingpoMarkets=new Map(),ageCache=new Map();let loading,saveQueue=Promise.resolve(),materialLoading,materialSaveQueue=Promise.resolve(),preloading=null;
 const file=cacheDirectory?path.join(cacheDirectory,'equipment-valuation-cache.json'):null;
 async function load(){if(!loading)loading=(async()=>{if(!file)return;let data;try{data=JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return;throw Error('全服估价缓存无法读取，请保留文件后检查，未重新发起全服采样');}if(data.version!==1||!Array.isArray(data.entries))throw Error('全服估价缓存版本无效');for(const [key,entry] of data.entries)if(entry&&Number.isFinite(entry.at)&&Array.isArray(entry.rows))fullCache.set(key,entry);})();return loading;}
 async function save(){if(!file)return;const value=JSON.stringify({version:1,entries:[...fullCache].filter(([,entry],index,entries)=>now()-entry.at<THREE_HOURS||index>=entries.length-50)});const work=async()=>{await fs.mkdir(cacheDirectory,{recursive:true});const temp=file+'.tmp-'+crypto.randomUUID();try{await fs.writeFile(temp,value,{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}};saveQueue=saveQueue.then(work,work);return saveQueue;}
 async function data(context,params){
  context.signal?.throwIfAborted();if(++context.requests>(context.materialPricing?800:180))throw Object.assign(Error('本组采样请求较多，已停止；请细化装备参数'),{valuationFatal:true});
  const url=P.requestUrl({params:{...params,order_by:'price ASC'}});context.logs.push({url,at:now(),message:context.stage});context.onRequest?.(context.logs.at(-1));
  const send=async session=>gate.run(context.task.roleId,async()=>{
   if(session&&roles.cookieSnapshot)Object.assign(session,await roles.cookieSnapshot(context.task.roleId,url,{signal:context.signal}));
   const response=await officialFetch(context.task.roleId,url,{method:'GET',headers:{Cookie:session?.cookie||await roles.cookie(context.task.roleId,url),Accept:'*/*',Referer:context.materialPricing?'https://xyq.cbg.163.com/cgi-bin/query.py?act='+params.search_type:context.task.category==='上古玉魄'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_yupo':context.task.category==='召唤兽装备'?'https://xyq.cbg.163.com/cgi-bin/equipquery.py?act=show_overall_search_pet_equip':context.task.category==='灵饰'?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_overall_search_lingshi':'https://xyq.cbg.163.com/cgi-bin/equipquery.py?act=show_overall_search_equip'},signal:context.signal});
   let body=await response.text();const inferred=inferredAccountSecurity(body);if(inferred)body=JSON.stringify(inferred);if(body.length>3000000)throw Error('估价响应过大');
   if(response.status===429){const message='官网返回请求过于频繁，已暂停该角色的请求';gate.block(context.task.roleId,message);throw Error(message);}
   if(isCaptcha(body)){const message='官网要求验证码，已暂停该角色的请求，请在当前会话中完成安全验证';gate.block(context.task.roleId,message);throw Error(message);}
   if(/MIBAO_AUTH|OTP_AUTH/.test(body)){let message;try{R.parseResponse(body);}catch(error){message=error.message;}gate.block(context.task.roleId,message||'官网需要账号安全验证 · MIBAO_AUTH');throw Error(message||'官网需要账号安全验证 · MIBAO_AUTH');}
   return {body,status:response.status};
  },{signal:context.signal,taskId:context.task.requestPriority==='interactive'?undefined:context.task.id,priority:context.priority|| (context.task.requestPriority==='interactive'?10:0),priorityKey:context.priorityKey});
  const result=roles.request?(await roles.request(context.task.roleId,url,send,{signal:context.signal,taskId:context.task.id,isExpired:r=>isExpired(r.body,r.status)})).response:await send();
  if(result.status!==200)throw Object.assign(Error('估价请求失败：HTTP '+result.status),{valuationFatal:true});try{return R.parseResponse(result.body);}catch(error){error.valuationFatal=true;throw error;}
 }
 const materialFile=cacheDirectory?path.join(cacheDirectory,'material-prices.json'):null,overrideFile=cacheDirectory?path.join(cacheDirectory,'material-price-overrides.json'):null;
 let customLoading,customPrices={version:1,revision:0,servers:{}},customQueue=Promise.resolve();
 const dayKey=()=>new Date(now()+8*3600000).toISOString().slice(0,10);
 async function atomicJson(file,value){if(!file)return;await fs.mkdir(cacheDirectory,{recursive:true});const temp=file+'.tmp-'+crypto.randomUUID();try{await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
 async function loadCustomPrices(){if(!customLoading)customLoading=(async()=>{if(!overrideFile)return;let saved;try{saved=JSON.parse(await fs.readFile(overrideFile,'utf8'));}catch(error){if(error.code==='ENOENT')return;throw Error('用户材料价格无法读取，请检查本地存储文件');}if(saved.version!==1||!Number.isSafeInteger(saved.revision)||!saved.servers||typeof saved.servers!=='object')throw Error('用户材料价格存档格式无效');customPrices=saved;})();return customLoading;}
 async function loadMaterials(){if(!materialLoading)materialLoading=(async()=>{await loadCustomPrices();if(!materialFile)return;let saved;try{saved=JSON.parse(await fs.readFile(materialFile,'utf8'));}catch(error){if(error.code==='ENOENT')return;throw Error('材料报价缓存无法读取，请检查本地存储文件');}if(![1,2].includes(saved.version)||!Array.isArray(saved.servers))throw Error('材料报价缓存版本无效');for(const old of saved.servers){if(!old||!/^\d+$/.test(String(old.serverId))||old.day!==dayKey()||!old.quotes||!old.missing)continue;const entry={...old,quotes:{...old.quotes},missing:{...old.missing}};if(saved.version===1){entry.quotes=Object.fromEntries(Object.entries(old.quotes).map(([id,q])=>[id,{[q.grade]:q}]));entry.missing=Object.fromEntries(Object.entries(old.missing).map(([id,message])=>[id,{6:message}]));entry.complete=false;}materialCache.set(String(entry.serverId),entry);}})();return materialLoading;}
 async function saveMaterials(){const payload={version:2,servers:[...materialCache.values()]};const serialized=JSON.stringify(payload),work=()=>atomicJson(materialFile,JSON.parse(serialized));materialSaveQueue=materialSaveQueue.then(work,work);return materialSaveQueue;}
 function customFor(serverId){return customPrices.servers[String(serverId)]||{};}
 function completed(entry){return V.MATERIALS.every(material=>V.marketGrades(material).every(grade=>entry.quotes[material.id]?.[grade]||entry.missing[material.id]?.[grade]||customFor(entry.serverId)[material.id]?.[grade]));}
 async function materialSnapshot(errors=[]){await loadMaterials();const bound=roles.list?await roles.list():[],ids=new Set(bound.map(role=>String(role.server?.id||'')));return {day:dayKey(),revision:customPrices.revision,materials:V.MATERIALS,errors,servers:[...ids].filter(id=>/^\d+$/.test(id)).map(id=>{const cached=materialCache.get(id),entry=cached?.day===dayKey()?cached:{serverId:id,server:bound.find(role=>String(role.server?.id)===id)?.server?.name||'',day:dayKey(),quotes:{},missing:{},complete:false};return {...entry,complete:entry.complete&&completed(entry),custom:customFor(id)};})};}
 async function ensureMaterials(context,serverId,materialId=null){
  await loadMaterials();context.signal?.throwIfAborted();const key=String(serverId),day=dayKey();
  if(materialCache.get(key)?.day===day&&materialCache.get(key).complete&&completed(materialCache.get(key)))return materialCache.get(key);
  const pendingKey=materialId?key+':'+materialId:key;
  if(materialPending.has(pendingKey)){await materialPending.get(pendingKey);context.signal?.throwIfAborted();return ensureMaterials(context,serverId,materialId);}
  const work=(async()=>{
   let entry=materialCache.get(key);if(entry?.day!==day){entry={serverId:key,server:key===context.buyerServer?context.serverName||'':'',day,at:now(),quotes:{},missing:{},complete:false};materialCache.set(key,entry);}
   // A material batch has its own bounded request budget and obeys the same role gate.
   const pricing={...context,requests:0,materialPricing:true};
   async function fetchGrade(material,grade){
    if(entry.quotes[material.id]?.[grade]||entry.missing[material.id]?.[grade]||customFor(key)[material.id]?.[grade])return;
    const gradeKey='material:'+key+':'+day+':'+material.id+':'+grade;
    if(materialGradePending.has(gradeKey)){if(context.priority||context.task.requestPriority==='interactive')gate.promote?.(context.task.roleId,gradeKey,10);await materialGradePending.get(gradeKey);return;}
    const work=(async()=>{pricing.priorityKey=gradeKey;pricing.stage='材料报价 · '+material.name+grade+'级';
    let rawRows;
    if(material.family==='jingpo'){
     const sharedKey=key+':'+day+':jingpo:'+grade;
     if(!jingpoMarkets.has(sharedKey))jingpoMarkets.set(sharedKey,(async()=>{const rows=[],seen=new Set(),attrs=new Set();for(let page=1;page<=12;page++){const response=await data(pricing,{act:'recommd_by_role',page:String(page),count:'15',search_type:'search_jl_stone',server_id:key,equip_level:String(grade),view_loc:'search_cond'});const signature=JSON.stringify(response.equip_list.map(r=>r.eid||r.equipid));if(response.equip_list.length&&seen.has(signature))throw Error('精魄灵石报价分页重复');seen.add(signature);rows.push(...response.equip_list);for(const row of response.equip_list){const attr=PetValuation.stoneAttribute(row);if(attr)attrs.add(attr);}if(attrs.size===PetValuation.SPIRIT_ATTRS.length||P.nextPage(response,page)===null)break;}return rows;})().catch(error=>{jingpoMarkets.delete(sharedKey);throw error;}));
     rawRows=await jingpoMarkets.get(sharedKey);
    }else{const response=await data(pricing,{act:'recommd_by_role',page:'1',count:'15',search_type:['clock','point'].includes(material.family)?'search_material':'search_stone',server_id:key,s_type:material.type,...(material.family!=='point'?{equip_level:String(grade)}:{}),...(['clock','point'].includes(material.family)?{skill_text:material.skill||material.name}:{}),...(material.family==='gem'?{hide_lingshi:'1'}:{}),view_loc:'search_cond'});rawRows=response.equip_list;}
    const candidates=rawRows.filter(row=>(material.family==='point'||Number(row.equip_level??row.level)===grade)&&(material.types||[material.type]).includes(String(row.equip_type))&&(material.family!=='clock'||L.clockStone({},row.large_equip_desc)?.name===material.name)&&(material.family!=='jingpo'||PetValuation.stoneAttribute(row)===material.attr)&&(material.family!=='point'||PetValuation.canonical(row.skill_text||row.addon_status||'')===material.skill||PetValuation.canonical(row.large_equip_desc||'').includes(material.skill))&&String(row.serverid??row.server_id??key)===key&&Number(row.price)>0&&Number(row.equip_count??1)>0).map(row=>({row,priceCents:Math.round(Number(row.price)/Number(row.equip_count??1))})).filter(row=>Number.isSafeInteger(row.priceCents)&&row.priceCents>0).sort((a,b)=>a.priceCents-b.priceCents);
    if(candidates.length){const first=candidates[0];entry.quotes[material.id]??={};entry.quotes[material.id][grade]={grade,priceCents:first.priceCents,floorLimited:Number(first.row.price)===1000&&Number(first.row.equip_count??1)===1,serverId:key,at:now(),source:slim(R.normalize(first.row,{category:'装备'}))};if(!entry.server)entry.server=first.row.server_name||'';}
    else{entry.missing[material.id]??={};entry.missing[material.id][grade]='未查到'+key+'服'+grade+'级'+material.name+'报价';}
    await saveMaterials();})();materialGradePending.set(gradeKey,work);try{await work;}finally{if(materialGradePending.get(gradeKey)===work)materialGradePending.delete(gradeKey);}
   }
   for(const material of V.MATERIALS.filter(m=>!materialId||m.id===materialId)){
    for(const grade of V.marketGrades(material))await fetchGrade(material,grade);
    if(material.family==='point')continue;
    if(material.family==='clock'){
     if(customFor(key)[material.id]?.[6])continue;
     for(const grade of [7,8,5,4]){if(Object.values(entry.quotes[material.id]||{}).some(q=>q.priceCents>1000))break;await fetchGrade(material,grade);}
     continue;
    }
    const prices=Object.values(entry.quotes[material.id]||{}),hasFloor=prices.some(q=>q.priceCents<=1000),hasReliable=prices.some(q=>q.priceCents>1000);
    if(hasFloor&&!hasReliable){for(let grade=11;grade<=V.materialMaxGrade(material);grade++){await fetchGrade(material,grade);if(entry.quotes[material.id]?.[grade]?.priceCents>1000)break;}}
   }
   entry.complete=!materialId||entry.complete&&completed(entry);entry.updatedAt=now();await saveMaterials();return entry;
  })();materialPending.set(pendingKey,work);try{return await work;}finally{if(materialPending.get(pendingKey)===work)materialPending.delete(pendingKey);}
 }
 async function preloadMaterials({signal,onRequest}={}){
  if(preloading){await preloading;signal?.throwIfAborted();return preloadMaterials({signal,onRequest});}
  const work=(async()=>{await loadMaterials();const list=roles.list?await roles.list():[],seen=new Set(),errors=[];
   for(const role of list){const serverId=String(role.server?.id||'');if(!/^\d+$/.test(serverId)||seen.has(serverId))continue;
    const context={task:{id:'material-prices:'+serverId,roleId:role.id},buyerServer:serverId,serverName:role.server?.name,signal,onRequest,requests:0,logs:[]};
    try{await ensureMaterials(context,serverId);seen.add(serverId);}catch(error){if(signal?.aborted)throw error;errors.push({serverId,message:error.message});}
   }
   return materialSnapshot(errors.filter(error=>!seen.has(error.serverId)));
  })();preloading=work;try{return await work;}finally{if(preloading===work)preloading=null;}
 }
 async function setCustomPrice(input){
  await loadMaterials();const serverId=String(input?.serverId||''),material=V.MATERIALS.find(m=>m.id===input?.materialId),grade=Number(input?.grade),list=roles.list?await roles.list():[];
  if(!/^\d+$/.test(serverId)||!list.some(role=>String(role.server?.id)===serverId))throw Error('只能设置已登录角色所在服务器的材料价格');
  if(!material||!Number.isInteger(grade)||grade<1||grade>V.materialMaxGrade(material))throw Error('材料或等级无效');
  let cents=null;if(input.reset!==true){const value=String(input.price??'');if(!/^\d+(?:\.\d{1,2})?$/.test(value)||Number(value)<=0||Number(value)>1e9)throw Error('价格必须大于零，最多两位小数');cents=Math.round(Number(value)*100);}
  const work=async()=>{const next=JSON.parse(JSON.stringify(customPrices));next.servers[serverId]??={};next.servers[serverId][material.id]??={};if(input.reset===true)delete next.servers[serverId][material.id][grade];else next.servers[serverId][material.id][grade]={grade,priceCents:cents,at:now()};next.revision++;await atomicJson(overrideFile,next);customPrices=next;return materialSnapshot();};
  const pending=customQueue.then(work,work);customQueue=pending.then(()=>{},()=>{});return pending;
 }
 async function quote(context,serverId,id,grade){
  const gem=V.GEM_TYPES[id];if(!gem)throw Error('未知宝石类型');if(!gem.type)return null;
  const entry=await ensureMaterials(context,serverId,context.task.requestPriority==='interactive'?id:null),material=V.MATERIALS.find(m=>m.id===id),quote=V.resolveMaterialPrice(material,grade,{...entry,custom:customFor(serverId)});if(!quote)throw Error(entry.missing[id]?.[grade]||'缺少'+gem.name+grade+'级可靠报价（最低上架价影响；请设置用户定价）');return quote;
 }
 async function gem(context,item){
  const m=item.valuationMeta;if(!m||!Number.isInteger(m.grade))throw Error('样本未提供宝石等级');
  const ids=m.gemIds||[];if(m.grade===0)return {valueCents:0,quotes:{}};
  if(ids.some(id=>V.GEM_TYPES[id]?.type===null))return {...V.gemValue({gemIds:ids,grade:m.grade},context.settings),quotes:{}};
  const quotes={};for(const id of ids)quotes[id]=await quote(context,context.buyerServer,id,m.grade);
  return {...V.gemValue({gemIds:ids,grade:m.grade,quotes},context.settings),quotes};
 }
 const security=error=>/验证码|MIBAO_AUTH|OTP_AUTH|请求过于频繁|角色Cookie|登录过期|登录超时/.test(error.message);
 async function prepare(context,item){
  if(!item?.valuationMeta||!item.detailEid||!item.serverId||!Number.isFinite(item.price)||item.price<=0)return null;
  const same=String(item.serverId)===context.buyerServer;
  if(!(item.valuationMeta.crossFeeCents>0||same&&context.buyerOld))return null;
  try{const priced=await gem(context,item);const sample=V.sampleBase(item,priced.valueCents,context.settings,now());return {...sample,gemQuotes:priced.quotes};}catch(error){if(error.valuationFatal||security(error)||context.signal?.aborted)throw error;context.excluded++;context.exclusionReasons.add(error.message);return null;}
 }
 const hitCount=(target,prepared,rules,context)=>[...prepared.values()].filter(row=>(!context?.sampleUsable||context.sampleUsable(target,row))&&(context?.matches?context.matches(target,row):V.similar(target,row,rules))).length;
 async function prepareRows(context,entry,prepared,attempted,targets,rules,counter){
  // Keep the unprocessed raw rows cached, but never query gem prices for rows
  // that can only serve targets whose five-sample quota is already full.
  const counts=new Map(targets.map(target=>[target,counter?counter(target):hitCount(target,prepared,rules,context)])),remaining=new Set(targets.filter(target=>counts.get(target)<5));
  for(const row of entry.rows){
   if(!remaining.size)break;if(attempted.has(row.id))continue;
   const matches=[...remaining].filter(target=>(!context.sampleUsable||context.sampleUsable(target,row))&&(context.matches?context.matches(target,row):V.similar(target,row,rules)));if(!matches.length)continue;
   attempted.add(row.id);const sample=await prepare(context,row);if(!sample)continue;
   prepared.set(row.id,{...sample,sampleSource:'全服共享样本'});
   if(counter){const ids=new Set(matches.map(target=>target.id));for(const target of remaining)if(ids.has(target.id)&&counter(target)>=5)remaining.delete(target);}
   else for(const target of matches){counts.set(target,counts.get(target)+1);if(counts.get(target)>=5)remaining.delete(target);}
   await context.publish?.(sample);
  }
 }
 function queryFor(task,filters,targets,rules){
  const next=V.comparisonFilters(filters,targets,rules),traits=V.importantTraits(targets[0]);
  next.specialSkills=traits.skills;next.specialEffects=traits.effects;next.suits=V.comparisonSuits(targets[0]);next.effectMode='all';if(traits.effects.includes('14'))next.repairFailures=0;else {const max=Math.max(...targets.map(target=>V.repairSampleMax(target)));if(max<3)next.repairFailures=max;}
  return {...task,servers:[],equipmentFilters:next};
 }
 async function collectScope(context,entry,prepared,attempted,targets,filters,rules,counter=null){
  const count=counter||((target)=>hitCount(target,prepared,rules,context)),unresolved=()=>targets.filter(target=>context.scopeEligible(target)&&count(target)<5),queue=V.planRanges(unresolved(),rules.filter(rule=>!rule.key.startsWith('addon:')));
  const cursors=new Map(),rawRows=new Map(entry.rows.map(row=>[row.id,row]));
  while(queue.length){
   const range=queue.shift();await prepareRows(context,entry,prepared,attempted,range.targets,rules,counter);const wanted=range.targets.filter(target=>context.scopeEligible(target)&&count(target)<5);if(!wanted.length)continue;
   const query={...(range.query||queryFor(context.task,filters,wanted,rules)),servers:context.scopeServer?[context.scopeServer]:[]},signature=JSON.stringify(stable(query.equipmentFilters));if(!cursors.has(signature))cursors.set(signature,{page:1,seen:new Set()});const cursor=cursors.get(signature);if(cursor.page===null)continue;
   context.stage=(context.scopeServer?context.scopeServer.name:'跨服')+'范围采样 · '+wanted.length+' 件待估商品';let narrowed=false;
   for(const plan of P.buildPlans(query)){let page=cursor.page;const seen=cursor.seen;while(page!==null){
    const params=P.pagePlan(plan,page).params,requestKey=JSON.stringify(stable(params));entry.pages??={};let pageRecord=entry.pages[requestKey];
    if(!pageRecord){const response=await data(context,params);const ids=[];for(const raw of response.equip_list){const item=R.normalize(raw,{taskId:context.task.id,category:'装备'});if(item?.id){ids.push(item.id);if(context.scopeServer)context.localIds.add(item.id);else context.fullIds.add(item.id);if(!rawRows.has(item.id))rawRows.set(item.id,slim(item));}}const fingerprint=JSON.stringify(ids);if(response.equip_list.length&&seen.has(fingerprint))throw Error('估价采样返回重复页，已停止');pageRecord={fingerprint,count:response.equip_list.length,nextPage:P.nextPage(response,page)};entry.pages[requestKey]=pageRecord;}
    if(pageRecord.count&&seen.has(pageRecord.fingerprint))throw Error('估价采样返回重复页，已停止');seen.add(pageRecord.fingerprint);cursor.page=pageRecord.nextPage;
    entry.rows=[...rawRows.values()];context.updateRoutes(entry.rows);await prepareRows(context,entry,prepared,attempted,targets,rules,counter);
    const remaining=wanted.filter(target=>context.scopeEligible(target)&&count(target)<5);if(!remaining.length){narrowed=true;break;}
    // Continue the price-ordered shared query after removing satisfied targets.
    // Restarting at page one for every new lower bound repeatedly scans cheap goods.
    if(cursor.page!==null){queue.push({targets:remaining,query});narrowed=true;break;}page=cursor.page;
   }if(narrowed)break;}
   for(const target of wanted)if(!context.scopeServer&&context.scopeEligible(target)&&cursor.page===null&&count(target)>0)context.settled?.add(target.id);await context.publish?.();
  }
 }
 async function collect(context,entry,prepared,attempted,targets,filters,rules,counter=null){
  const count=counter||((target)=>hitCount(target,prepared,rules,context));
  context.scopeServer=null;context.scopeEligible=t=>!context.localTargets.has(t.id);
  await collectScope(context,entry,prepared,attempted,targets,filters,rules,counter);
  for(const server of Sampling.SERVERS){
   if(!targets.some(t=>context.localTargets.has(t.id)&&count(t)<5))break;
   context.scopeServer=server;context.scopeEligible=t=>context.localTargets.has(t.id);
   await collectScope(context,entry,prepared,attempted,targets,filters,rules,counter);
  }
  entry.fullIds=[...context.fullIds];entry.localIds=[...context.localIds];context.scopeServer=null;
  for(const t of targets)if(count(t)>0)context.settled.add(t.id);await context.publish?.();
 }
 async function fallbackSamples(context,entry,prepared,attempted,targets,filters,rules,search=false){
  context.downgrading=true;
  for(const tier of [1,2,3]){
   const unresolved=targets.filter(target=>hitCount(target,prepared,rules,context)===0&&![...prepared.values()].some(sample=>{const ignored=V.downgradeTier(target,sample,rules);return ignored&&ignored.length<tier;}));
   const variants=unresolved.flatMap(target=>V.downgradeVariants(target).filter(variant=>variant.ignoredEffects.length===tier));
   if(!variants.length)continue;
   const byId=new Map();for(const variant of variants){if(!byId.has(variant.id))byId.set(variant.id,[]);byId.get(variant.id).push(variant);}
   const count=target=>[...prepared.values()].filter(sample=>context.sampleUsable(target,sample)&&byId.get(target.id).some(variant=>context.matches(variant,sample))).length;
   await prepareRows(context,entry,prepared,attempted,variants,rules,count);
   if(search)await collect(context,entry,prepared,attempted,variants,filters,rules,count);
  }
 }
 async function estimate(input,{signal,onRequest,onProgress}={}){
  const task=input?.task;if(!task||task.category!=='装备'||task.valuationEnabled!==true||typeof task.roleId!=='string'||!task.roleId||typeof task.id!=='string'||!task.id)throw Error('请为装备任务开启估价');
  P.buildPlans(task);const config=V.settings(input.settings),group=input.group;if(!group||!/^\d+$/.test(String(group.kindId))||!Number.isInteger(group.level)||group.level<60||group.level>160||group.level%10!==0)throw Error('估价装备分组无效');
  if(!Array.isArray(input.seedRows)||input.seedRows.length>10000)throw Error('估价初始样本格式无效');
  const role=await roles.get(task.roleId),context={task,signal,onRequest,settings:config,requests:0,logs:[],settled:new Set(),stage:'确认跨服状态',excluded:0,exclusionReasons:new Set(),buyerServer:String(role.server.id),serverName:role.server.name||'',buyerOld:false};
  const seeds=input.seedRows.filter(r=>String(r.equipmentKindId)===String(group.kindId)&&Number(r.level)===group.level).map(slim);
  const belowFloor=target=>!!V.skipReason(target),skipped=target=>({target,count:0,estimateCents:null,sampleEstimateCents:null,skipped:true,error:V.skipReason(target)});
  if(seeds.every(belowFloor))return {version:V.COMPARISON_VERSION,group,at:now(),scope:'full',complete:true,rules:[],items:seeds.map(skipped),warnings:[],logs:[]};
  if(task.requestPriority!=='interactive'){if(preloading)await preloading;await ensureMaterials(context,context.buyerServer);}context.stage='确认跨服状态';
  context.buyerOld=seeds.some(r=>String(r.serverId)!==context.buyerServer&&r.valuationMeta?.crossFeeCents>0);
  const ageKey=task.roleId+':'+(role.cookieVersion||0),age=ageCache.get(ageKey);if(!context.buyerOld&&age&&now()-age.at<30*60*1000)context.buyerOld=age.old;
  if(!context.buyerOld&&!(age&&now()-age.at<30*60*1000)){const anchor=context.buyerServer==='149'?'86':'149',probe=await data(context,{...P.baseParams({levels:[120]}),serverid:anchor,level_min:'120',level_max:'120'});context.buyerOld=probe.equip_list.some(r=>Math.max(Number(r.cross_server_poundage_discount)||0,Number(r.cross_server_poundage)||0)>0);ageCache.set(ageKey,{at:now(),old:context.buyerOld});}
  if(!context.buyerOld)return {version:V.COMPARISON_VERSION,group,at:now(),scope:'full',complete:false,ageMethod:'cross-fee',count:0,rules:[],items:seeds.map(target=>belowFloor(target)?skipped(target):({target,count:0,error:'无法确认区服符合全服估价条件'})),warnings:['异服商品未查到跨服费，按当前临时规则不计入估价；若角色在三年内，不支持全服估价'],logs:context.logs};
  const filters={...task.equipmentFilters,types:[String(group.kindId)],levels:[group.level]};delete filters.type;delete filters.levelMin;delete filters.levelMax;
  const rules=V.comparisonRules(filters,group,seeds.filter(target=>!belowFloor(target))),warnings=[],eligible=seeds.filter(target=>!belowFloor(target)&&(target.carriedTarget===true||String(target.serverId)===context.buyerServer||target.valuationMeta?.crossFeeCents>0)&&rules.every(rule=>Number.isFinite(V.ruleValue(target,rule))));
  if(!seeds.length)return {version:V.COMPARISON_VERSION,group,at:now(),scope:'full',items:[],warnings:['本组没有需要估价的商品'],logs:context.logs};
  const comparisons=new WeakMap();context.matches=(target,sample)=>{let matches=comparisons.get(target);if(!matches){matches=new WeakMap();comparisons.set(target,matches);}if(!matches.has(sample))matches.set(sample,V.similar(target,sample,rules));return matches.get(sample);};

  await load();const key=crypto.createHash('sha256').update(JSON.stringify(stable({role:task.roleId,server:context.buyerServer,filters,samplingModes:[...new Set(eligible.map(t=>Sampling.mode(t)))].sort(),samplingVersion:Sampling.VERSION,version:V.COMPARISON_VERSION}))).digest('hex');
  if(pending.has(key)){try{await pending.get(key);}catch(error){if(signal?.aborted||security(error))throw error;}}
  signal?.throwIfAborted();let entry=fullCache.get(key),cached=!!(entry&&now()-entry.at<THREE_HOURS),prepared=new Map(),attempted=new Set();
  context.fullIds=new Set(entry?.fullIds||[]);context.localIds=new Set(entry?.localIds||[]);context.localTargets=new Set(eligible.filter(t=>Sampling.mode(t)==='local').map(t=>t.id));
  context.sampleUsable=(target,sample)=>!context.localTargets.has(target.id)||context.localIds.has(sample.id);
  context.updateRoutes=rows=>{for(const t of eligible)if(!context.localTargets.has(t.id)&&Sampling.needsLocal(t,rows.filter(row=>context.fullIds.has(row.id)&&context.matches(t,row))))context.localTargets.add(t.id);};
  if(entry)context.updateRoutes(entry.rows);
  const refreshIds=new Set(),emitted=new Map(),normalCounts=new Map(),downgradable=new Set(eligible.filter(target=>V.downgradeVariants(target).length).map(target=>target.id));
  async function itemEstimate(target){
   signal?.throwIfAborted();if(belowFloor(target))return skipped(target);const missing=rules.filter(rule=>!Number.isFinite(V.ruleValue(target,rule)));
   if(missing.length){return {target,count:0,error:'缺少实际属性：'+missing.map(rule=>rule.label).join('、')};}
   if(!target.carriedTarget&&String(target.serverId)!==context.buyerServer&&!(target.valuationMeta?.crossFeeCents>0)){return {target,count:0,error:'异服商品未查到跨服费，按当前区服年限规则不估价'};}
   try{const priced=await gem(context,target),match=V.estimateComparables(target,[...prepared.values()].filter(sample=>context.sampleUsable(target,sample)),rules,priced.quotes,config,now());
    return {target,samplingMode:context.localTargets.has(target.id)?'ranked':'full',count:match.count,exactCount:match.exactCount,availableCount:match.availableCount,rough:match.rough,degraded:match.degraded,ignoredEffects:match.ignoredEffects,strategy:match.strategy,supportBasis:match.supportBasis,anchorListingDays:match.anchorListingDays,supportedPriceCents:match.supportedPriceCents,supportCount:match.supportCount,requiredSupportCount:match.requiredSupportCount,lowestPriceCents:match.lowestPriceCents,isolatedLowCents:match.isolatedLowCents,...V.suggestedPrice(target,match.estimateCents,now()),references:match.references.map(row=>({...row,sample:{...row.sample,taskId:task.id,referenceLabel:'估价依据'}})),targetQuotes:priced.quotes,traits:V.importantTraits(target),attributeFocus:V.attributeFocus(target),refreshEligible:refreshIds.has(target.id),error:match.count?match.error:entry&&!entry.complete?'全服采样尚未完成，当前未取得匹配样本：'+(entry.error||'采样中'):'没有找到属性相近且折算资料完整的商品'};
   }catch(error){if(error.valuationFatal||security(error)||signal?.aborted)throw error;return {target,count:0,error:error.message,refreshEligible:refreshIds.has(target.id)};}
  }
  context.publish=onProgress?async(sample)=>{
   for(const target of eligible){
    if(emitted.has(target.id))continue;if(sample&&context.sampleUsable(target,sample)&&context.matches(target,sample))normalCounts.set(target.id,(normalCounts.get(target.id)||0)+1);
    const normal=hitCount(target,prepared,rules,context);if(normal<5&&!context.settled.has(target.id)&&!(context.downgrading&&downgradable.has(target.id)))continue;
    const row=await itemEstimate(target);if(row.count<5&&!context.settled.has(target.id))continue;
    const signature=JSON.stringify([row.count,row.estimateCents,row.degraded]);if(emitted.get(target.id)===signature)continue;emitted.set(target.id,signature);
    await onProgress({version:V.COMPARISON_VERSION,group,at:now(),scope:'full',partial:true,complete:false,rules,items:[row],warnings:[]});
   }
  }:null;
  const uncovered=()=>eligible.filter(target=>!(entry.seenTargetIds||entry.targetIds).includes(target.id)&&hitCount(target,prepared,rules,context)<5&&!(entry.parameterKeys||[]).includes(V.parameterKey(target,rules))&&(!entry.coverage.some(range=>V.rangeCovers(range,target,rules))||hitCount(target,prepared,rules,context)===0));
  if(cached)await prepareRows(context,entry,prepared,attempted,eligible,rules);
  const refreshTargets=cached?uncovered():[];
  if(input.refreshToken!==undefined){
   if(!cached||typeof input.refreshToken!=='string'||input.refreshToken!==entry.refreshToken||!refreshTargets.length)throw Error('仅新商品的参数未被缓存覆盖或未命中，且样本不足 5 件时，才可更新全服样本');
  }
  if(!cached||entry.complete!==true&&!entry.budgetExhausted||entry.retryable===true||input.refreshToken!==undefined){
   const targets=cached&&input.refreshToken!==undefined?refreshTargets:eligible,work=(async()=>{
    const next=cached?{...entry,rows:[...entry.rows],coverage:[...entry.coverage],targetIds:[...entry.targetIds],parameterKeys:[...(entry.parameterKeys||[])],pages:{...(entry.pages||{})}}:{at:now(),rows:[],coverage:[],targetIds:[],parameterKeys:[],pages:{},error:'',complete:false};
    next.refreshToken=crypto.randomUUID();next.updatedAt=now();next.seenTargetIds=[...new Set([...(next.seenTargetIds||next.targetIds),...targets.map(target=>target.id)])];const commitCoverage=()=>{next.coverage.push(...V.planRanges(targets,rules).map(({traits,bounds,repairMax})=>({traits,bounds,repairMax})));next.targetIds=[...new Set([...next.targetIds,...targets.map(target=>target.id)])];next.parameterKeys=[...new Set([...next.parameterKeys,...targets.map(target=>V.parameterKey(target,rules))])];};next.complete=false;next.retryable=false;next.error='';fullCache.set(key,next);await save();
    try{await collect(context,next,prepared,attempted,targets,filters,rules);await fallbackSamples(context,next,prepared,attempted,targets,filters,rules,true);next.complete=true;commitCoverage();}catch(error){next.error=error.message;next.budgetExhausted=/本组采样请求较多/.test(error.message);next.retryable=!!(security(error)||error.valuationFatal&&!/本组采样请求较多/.test(error.message)||signal?.aborted);throw error;}finally{await save();}return next;
   })();pending.set(key,work);void work.finally(()=>pending.delete(key)).catch(()=>{});
   try{entry=await work;}catch(error){if(signal?.aborted||security(error)||error.valuationFatal&&!/本组采样请求较多/.test(error.message))throw error;entry=fullCache.get(key);}
  }
  if(!entry.complete)warnings.push('全服采样未完成，未满 5 件的商品仅给出粗略估算：'+(entry.error||'采样中断'));
  await prepareRows(context,entry,prepared,attempted,eligible,rules);
  await fallbackSamples(context,entry,prepared,attempted,eligible,filters,rules);
  for(const target of uncovered())refreshIds.add(target.id);const items=[];
  for(const target of seeds){const row=await itemEstimate(target);items.push(row);if(onProgress)await onProgress({version:V.COMPARISON_VERSION,group,at:now(),sampledAt:entry.at,scope:'full',partial:true,complete:false,rules,items:[row],warnings:[]});}
  if(context.excluded)warnings.push(context.excluded+' 个样本因折算资料不完整而排除：'+[...context.exclusionReasons].slice(0,3).join('；'));
  return {version:V.COMPARISON_VERSION,group,at:now(),sampledAt:entry.at,updatedAt:entry.updatedAt,nextFullAt:entry.at+THREE_HOURS,cached,scope:'full',expanded:true,complete:entry.complete===true,ageMethod:'cross-fee',count:prepared.size,rules,coverage:entry.coverage,refreshEligible:refreshIds.size>0,...(refreshIds.size?{refreshToken:entry.refreshToken}:{}),items,warnings,logs:context.logs};
 }
 async function marketPage(task,params,{signal,onRequest}={}){return data({task,signal,onRequest,requests:0,logs:[],stage:'灵饰全服采样'},params);}
 async function materialQuote(roleId,id,grade,{signal,onRequest,priority=0}={}){const role=await roles.get(roleId),serverId=String(role.server.id),material=V.MATERIALS.find(m=>m.id===id);if(!material)throw Error('材料类型无效');if(preloading&&!priority)await preloading;const context={priority,task:{id:'material-for-valuation',roleId,category:'灵饰',...(priority?{requestPriority:'interactive'}:{})},buyerServer:serverId,serverName:role.server.name,signal,onRequest,requests:0,logs:[],stage:'材料报价'};const entry=await ensureMaterials(context,serverId,priority?id:null);const q=V.resolveMaterialPrice(material,grade,{...entry,custom:customFor(serverId)});if(!q)throw Error('缺少'+grade+'级'+material.name+'报价');return q;}
 return {estimate,marketPage,materialQuote,preloadMaterials,setCustomPrice,materialSnapshot,flush:()=>Promise.all([saveQueue,materialSaveQueue,customQueue])};
}
module.exports={createEstimator,THREE_HOURS,slim};
