function renderBackground(){if(typeof scheduleRender==='function')scheduleRender();else render();}
let rawSearchRun={running:false,taskName:'',records:[],total:0,cancelled:false};
const searchControllers=new Map();
function cancelTaskSearch(id){searchControllers.get(id)?.abort();}
function clearTaskResults(id){
 if(typeof resetTaskChanges==='function')resetTaskChanges(id);if(typeof clearEquipmentEstimate==='function')clearEquipmentEstimate(id);
 const run=state.taskRuns?.[id];if(run)run.retired=true;
 cancelTaskSearch(id);if(state.taskRuns)delete state.taskRuns[id];
 state.results=state.results.filter(item=>item.taskId!==id);
 resultServerFilters.delete(id);
 if(rawSearchRun.taskId===id)rawSearchRun={running:false,taskName:'',records:[],total:0,cancelled:false};
 if(typeof EquipmentDisclosure==='object')EquipmentDisclosure.clearTask?.(id);
}
const resultSorts=new Map(),RESULT_SORT_STORAGE='cbg:result-sort-by-category:v1';
function resultCategory(run={}){return state.tasks.find(task=>task.id===run.taskId)?.category||run.category||({'pet':'召唤兽','role':'角色','sword':'装备','lingshi':'灵饰','yupo':'上古玉魄','pet-equipment':'召唤兽装备'})[run.items?.[0]?.kind]||'装备';}
function normalizeResultSort(category,sort){const allowed=['price','totalPrice',...(['装备','灵饰','上古玉魄','召唤兽装备'].includes(category)?['premium']:[]),...(category==='召唤兽'?['shape','growth']:[])];const by=allowed.includes(sort?.by)?sort.by:'price';return {by,direction:by==='price'&&sort?.direction==='desc'?'desc':by==='shape'||by==='growth'?'desc':'asc'};}
try{const saved=JSON.parse(localStorage.getItem(RESULT_SORT_STORAGE)||'null');if(saved?.version===1)for(const category of ['装备','灵饰','上古玉魄','角色','召唤兽','召唤兽装备'])if(saved.categories?.[category])resultSorts.set(category,normalizeResultSort(category,saved.categories[category]));}catch{}
function resultSortFor(run={}){const category=resultCategory(run);return resultSorts.get(category)||{by:'price',direction:'asc'};}
function setResultSort(run,sort){const category=resultCategory(run);resultSorts.set(category,normalizeResultSort(category,sort));try{localStorage.setItem(RESULT_SORT_STORAGE,JSON.stringify({version:1,categories:Object.fromEntries(resultSorts)}));}catch{if(typeof toast==='function')toast('排序已切换，偏好暂未能保存');}}

const resultServerFilters=new Map();
function resultServerKey(item){return item.serverId?'id:'+item.serverId:item.server?'name:'+JSON.stringify([item.area||'',item.server]):'unknown';}
function resultServers(items){const servers=new Map();for(const item of items){const key=resultServerKey(item);if(!servers.has(key))servers.set(key,{key,label:[item.area,item.server].filter(Boolean).join(' · ')||'服务器未提供',count:0});servers.get(key).count++;}return [...servers.values()].sort((a,b)=>a.label.localeCompare(b.label,'zh-CN'));}
function resultServerSelection(run){const key=resultServerFilters.get(run.taskId)||'';return resultServers(run.items||[]).some(server=>server.key===key)?key:'';}
function isPetResultRun(run){return state.tasks.some(task=>task.id===run.taskId&&task.category==='召唤兽')||(run.items||[]).some(item=>item.kind==='pet');}
function isEquipmentValuationRun(run){const category=state.tasks.find(task=>task.id===run.taskId)?.category||run.category;return category?['装备','灵饰','上古玉魄','召唤兽装备'].includes(category):(run.items||[]).some(item=>['sword','lingshi','yupo','pet-equipment'].includes(item.kind));}
function sortedSearchResults(items=state.results,run=rawSearchRun){const sort=resultSortFor(run),server=resultServerSelection(run),by=sort.by==='premium'&&isEquipmentValuationRun(run)?sort.by:['shape','growth','totalPrice'].includes(sort.by)?sort.by:'price';return SearchResults.sortItems(server?items.filter(item=>resultServerKey(item)===server):items,{by,direction:by==='price'?sort.direction:'desc',valuation:item=>typeof equipmentPremiumQuote==='function'?equipmentPremiumQuote(equipmentValuationRow(run.taskId,item.id,item)?.row):null});}

function resultSortControls(run=rawSearchRun){const selected=resultServerSelection(run),pet=isPetResultRun(run),equipment=isEquipmentValuationRun(run),sort=resultSortFor(run),mode=sort.by==='totalPrice'?'totalPrice-asc':['shape','growth'].includes(sort.by)?sort.by+'-desc':'price-'+sort.direction;return `<div class="result-sort-controls">${pet?`<label>排序 <select data-result-task="${esc(run.taskId||'')}" data-result-category="${esc(resultCategory(run))}" data-result-sort="mode" aria-label="召唤兽结果排序">${[['price-asc','价格从低到高'],['totalPrice-asc','价格从低到高（含跨服费）'],['price-desc','价格从高到低'],['shape-desc','造型（携带等级从高到低）'],['growth-desc','成长从高到低']].map(([value,label])=>`<option value="${value}" ${mode===value?'selected':''}>${label}</option>`).join('')}</select></label>`:`<label>${equipment?'排序':'价格排序'} <select data-result-task="${esc(run.taskId||'')}" data-result-category="${esc(resultCategory(run))}" data-result-sort="direction" aria-label="${equipment?'装备、灵饰与玉魄结果排序':'结果价格排序'}"><option value="asc" ${sort.by==='price'&&sort.direction==='asc'?'selected':''}>价格从低到高</option><option value="totalPrice" ${sort.by==='totalPrice'?'selected':''}>价格从低到高（含跨服费）</option><option value="desc" ${sort.by==='price'&&sort.direction==='desc'?'selected':''}>价格从高到低</option>${equipment?`<option value="premium" ${sort.by==='premium'?'selected':''}>溢价率从低到高</option>`:''}</select></label>`}<label>服务器 <select data-result-server="${esc(run.taskId||'')}" aria-label="筛选结果服务器"><option value="">全部服务器</option>${resultServers(run.items||[]).map(server=>`<option value="${esc(server.key)}" ${selected===server.key?'selected':''}>${esc(server.label)}（${server.count}）</option>`).join('')}</select></label>${equipment&&sort.by==='premium'?'<span class="result-premium-help">（标价 − 最终估价）÷ 最终估价；参考与粗略估价共同排序，暂无估价置后。粗略估价可能偏高或偏低，导致便宜／偏贵的误判，请核对样本。</span>':''}${selected?`<span class="result-filter-count">显示 ${sortedSearchResults(run.items||[],run).length} / ${(run.items||[]).length} 件</span>`:''}</div>`;}
function rawSearchView(run=rawSearchRun){
 if(!run.taskName)return '';
 const failures=run.records.filter(record=>record.error).length;
 const serverStates=Object.values(run.serverStates||{});
 const slow=run.running&&Date.now()-run.startedAt>=RunLogs.SLOW_MS||run.slowWarned;
 const status=run.restored?'本机保存的上次结果':run.running?'正在逐页搜索':run.cancelled?'已停止，未搜完整':failures?'部分请求失败，未搜完整':'已完成所有分页';
 return `<section class="search-results-panel panel" id="raw-search"><div class="search-results-heading"><h2>本次搜索结果</h2><span>${(run.items||[]).length} 件商品${run.restored?' · 本机已保存':` · 已完成 ${run.records.filter(record=>record.finished).length} 页请求`}</span></div><p class="search-results-description">${esc(run.taskName)} · ${status}${run.restored?'':' · 每页 15 条，按搜索范围取完所有页'}</p>${serverStates.length?`<div class="search-server-progress">${serverStates.map(server=>`<div><b>${esc(server.name)}</b><span>${({queued:'排队中',running:'搜索中',completed:'已完成',failed:'未搜完整',stopped:'已停止'})[server.status]||server.status}</span><span>${server.pages||0} 页 · ${server.count||0} 件</span>${server.error?`<span class="error">${esc(server.error)}</span>`:''}</div>`).join('')}</div>`:''}${!run.running&&serverStates.some(server=>server.status==='failed')?`<button type="button" class="button secondary retry-failed-servers" data-retry-task="${esc(run.taskId)}">补搜失败服务器</button>`:''}${slow?'<p class="slow-search-note">本次搜索耗时较长，建议细化筛选条件或拆分服务器范围。搜索会继续完成全部分页。</p>':''}${resultSortControls(run)}${SearchResults.renderList(sortedSearchResults(run.items||[],run))}</section>`;
}
function ingestSearchRecord(record,task,response,run=rawSearchRun){
 if(run.retired)return;
 record.pager=response.pager||null;record.upstreamCount=response.equip_list.length;
 record.items=response.equip_list.map((item,index)=>{
  const normalized=SearchResults.normalize(item,{config:autoSearchConfig||{},taskId:task.id,taskName:task.name,serverName:record.serverName,serverId:record.serverId,category:task.category,transformGroups:transformSuitGroups});
  if(normalized)normalized.searchScope=record.serverId||'*';
  if(normalized&&!normalized.hasStableId)normalized.id=`${record.serverId}:${record.sequence??run.records.indexOf(record)}:${index}`;
  return normalized;
 }).filter(Boolean);
 const existing=new Map((run.currentItems||[]).map(item=>[item.id,item]));
 for(const item of record.items)existing.set(item.id,item);
 run.currentItems=[...existing.values()];refreshRunItems(run);
 if(task.category==='角色'&&typeof updateRoleValuation==='function')updateRoleValuation(task,run,record.items);
}
function refreshRunItems(run){if(run.retired)return;const rows=new Map(Object.values(run.serverSnapshots||{}).flat().map(item=>[item.id,item]));for(const item of run.currentItems||[])rows.set(item.id,item);run.items=[...rows.values()];if(rawSearchRun===run)state.results=run.items;}
function abortableDelay(ms,signal){return new Promise((resolve,reject)=>{if(signal.aborted){reject(new DOMException('已取消','AbortError'));return;}const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);function abort(){clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('已取消','AbortError'));}signal.addEventListener('abort',abort,{once:true});});}
async function runEquipmentOnce(id,source='manual',{retryFailed=false}={}){
 if(searchControllers.has(id)||state.taskRuns?.[id]?.running){if(source==='manual')toast('上一次搜索尚未完成，已跳过本次搜索');return false;}
 if(typeof restoreTaskChanges==='function'){
  try{await restoreTaskChanges(id);}catch(error){toast('本地搜索结果读取失败：'+error.message);return false;}
  if(searchControllers.has(id)||state.taskRuns?.[id]?.running)return false;
 }
 if(location.protocol==='file:'){toast('请先运行 npm start，再从 http://127.0.0.1:5173 打开页面搜索');return;}
 const original=state.tasks.find(task=>task.id===id);if(!original)return;
 if(!original.roleId){original.enabled=false;original.nextRunAt=null;toast('请先为任务绑定角色');renderBackground();return;}
 const allocationError=SearchParams.roleTaskError(state.tasks,original);if(allocationError){original.enabled=false;original.nextRunAt=null;toast(allocationError);renderBackground();return false;}
 const task=JSON.parse(JSON.stringify(original));let plans;
 try{plans=SearchParams.buildPlans(task);}catch(error){state.logs.unshift({id:uid(),taskId:id,roleId:task.roleId,name:task.name,source,at:Date.now(),count:0,status:'failed',message:error.message});original.lastError=error.message;toast(error.message);renderBackground();return false;}
 const previous=state.taskRuns?.[id];
 const run={runId:uid(),startedAt:Date.now(),running:true,category:task.category,taskId:id,taskName:task.name,records:[],items:[],currentItems:[],serverSnapshots:{},serverStates:{},total:plans.length,cancelled:false};
 state.taskRuns=state.taskRuns||{};state.taskRuns[id]=run;rawSearchRun=run;
 state.results=run.items;
 const controller=new AbortController();searchControllers.set(id,controller);
 busy.add(id);renderBackground();
 let fatalFailure=false,fatalFailureReason='';
 const serverGroups=new Map();plans.forEach((plan,index)=>{const key=plan.server.id||'*';if(!serverGroups.has(key))serverGroups.set(key,[]);serverGroups.get(key).push({plan,index});});
 for(const [key,group] of serverGroups){run.serverSnapshots[key]=(previous?.items||[]).filter(item=>(item.searchScope||item.serverId||'*')===key||key==='*');run.serverStates[key]={key,name:group[0].plan.server.names.join(' / '),status:'queued',pages:0,count:0,error:''};}
 if(retryFailed){for(const [key] of serverGroups)if(previous?.serverStates?.[key]?.status!=='failed'){serverGroups.delete(key);run.serverStates[key]={...previous?.serverStates?.[key],key,status:'completed'};}}
 refreshRunItems(run);renderBackground();
 async function searchServer(group){
  const scope=group[0].plan.server.id||'*',serverState=run.serverStates[scope];serverState.status='running';renderBackground();let requestCount=0;
  for(const {plan,index:planIndex} of group){
   const seenPages=new Set();let page=1;
   while(page!==null&&!controller.signal.aborted){
    if(requestCount++)await abortableDelay(1100,controller.signal);
    if(controller.signal.aborted)return;
    const record={serverName:plan.server.names.join(' / '),serverId:plan.server.id,page,sequence:run.records.length,items:[],pager:null,levelRange:plan.levelRange,url:SearchParams.requestUrl(SearchParams.pagePlan(plan,page)),httpStatus:null,raw:null,error:'',finished:false};
    run.records.push(record);renderBackground();let followingPage=null;
    try{
     const response=await fetch('/api/search-once',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task,planIndex,page}),signal:controller.signal});
     const text=await response.text();controller.signal.throwIfAborted();
     if(!response.ok){try{record.error=JSON.parse(text).message||text;}catch{record.error=text||`本地服务 HTTP ${response.status}`;}record.fatal=response.headers.get('X-Cbg-Fatal')==='1';}
     record.refreshed=response.headers.get('X-Session-Refreshed')==='1';
     if(response.ok){
      record.raw=text;record.httpStatus=Number(response.headers.get('X-Upstream-Status'));record.url=response.headers.get('X-Cbg-Request-Url')||record.url;
      if(record.httpStatus>=400)throw new Error(`官网 HTTP ${record.httpStatus}，未搜完整`);
      const data=SearchResults.parseResponse(text);record.pager=data.pager||null;
      const signature=JSON.stringify(data.equip_list);
      if(data.equip_list.length&&seenPages.has(signature))throw new Error('官网重复返回相同页数据，已停止此分组分页，未搜完整');
      if(data.equip_list.length)seenPages.add(signature);
      ingestSearchRecord(record,task,data,run);
      followingPage=SearchParams.nextPage(data,page);
     }
    }catch(error){record.error=error.name==='AbortError'?(fatalFailure?'已停止本轮搜索：'+fatalFailureReason:'已停止本次搜索'):record.raw?error.message:`连接失败：${error.message}`;}
    finally{record.finished=true;record.raw=null;serverState.pages+=record.error?0:1;serverState.count=run.currentItems.filter(item=>item.searchScope===scope).length;if(record.error){serverState.status=controller.signal.aborted&&!fatalFailure?'stopped':'failed';serverState.error=record.error;}state.requestLogs=state.requestLogs||[];state.requestLogs.unshift({type:'request',runId:run.runId,url:record.url,taskId:id,roleId:task.roleId,name:task.name,at:Date.now(),message:`${record.serverName} · 第 ${record.page} 页 · ${record.error||'官网返回 '+record.upstreamCount+' 件 · '+(record.items.length!==record.upstreamCount?'筛选后匹配 '+record.items.length+' 件':'匹配 '+record.items.length+' 件')}${record.refreshed?' · Cookie已刷新':''}`});state.requestLogs=state.requestLogs.slice(0,500);renderBackground();}
    if(record.fatal){fatalFailure=true;fatalFailureReason=record.error;controller.abort();return;}
    if(record.error)return;
    page=followingPage;
   }
   if(controller.signal.aborted){serverState.status=fatalFailure?'failed':'stopped';return;}
  }
  serverState.status='completed';run.serverSnapshots[scope]=run.currentItems.filter(item=>item.searchScope===scope);refreshRunItems(run);renderBackground();
 }
 try{
  const groups=[...serverGroups.values()];let cursor=0;
  const outcomes=await Promise.allSettled(Array.from({length:Math.min(SearchParams.policy.serverConcurrency,groups.length)},async()=>{while(cursor<groups.length&&!controller.signal.aborted)await searchServer(groups[cursor++]);}));
  for(const outcome of outcomes)if(outcome.status==='rejected'&&outcome.reason?.name!=='AbortError'){const message=outcome.reason?.message||'搜索执行异常';run.records.push({finished:true,error:message,items:[]});toast(message);}
 }
 finally{
  for(const server of Object.values(run.serverStates))if(['queued','running'].includes(server.status)){server.status=fatalFailure?'failed':'stopped';if(fatalFailure)server.error='已停止本轮搜索：'+fatalFailureReason;}
  run.searchFinishedAt=Date.now();run.durationMs=run.searchFinishedAt-run.startedAt;
  run.running=false;run.cancelled=controller.signal.aborted&&!fatalFailure;
  if(run.retired){searchControllers.delete(id);busy.delete(id);renderBackground();return;}
  const current=state.tasks.find(item=>item.id===id);if(current){current.lastRunAt=Date.now();current.lastError=run.records.find(record=>record.error)?.error||'';}
  const verificationError=run.records.find(record=>/CAPTCHA_AUTH|验证码/.test(record.error||''))?.error;
  if(verificationError)for(const peer of state.tasks.filter(peer=>peer.roleId===task.roleId)){peer.lastError=verificationError;peer.nextRunAt=null;}
  if(typeof recordTaskChanges==='function')await recordTaskChanges(task,run);
  if(!run.retired&&!run.cancelled&&!run.records.some(record=>record.error)&&typeof runEquipmentValuation==='function')await runEquipmentValuation(task,run,controller.signal);
  searchControllers.delete(id);busy.delete(id);
  if(run.retired){renderBackground();return;}
  const finishedAt=run.searchFinishedAt,durationMs=run.durationMs;run.completedAt=Date.now();if(current)current.lastCompletedAt=run.completedAt;run.finishedAt=finishedAt;run.durationMs=durationMs;if(current)current.lastSlowRun=durationMs>=RunLogs.SLOW_MS;
  const failures=run.records.filter(record=>record.error).length;
  state.logs.unshift({id:run.runId,startedAt:run.startedAt,finishedAt,durationMs,completedAt:run.completedAt,valuationDurationMs:run.valuationDurationMs||0,taskId:id,roleId:task.roleId,name:task.name,source,at:Date.now(),count:run.items.length,status:run.cancelled?'cancelled':failures?(failures===run.records.length?'failed':'partial'):'success'});state.logs=state.logs.slice(0,200);renderBackground();if(typeof loadRoleEvents==='function')void loadRoleEvents();if(typeof loadRoles==='function')void loadRoles();
 }
}
document.addEventListener('click',event=>{const retry=event.target.closest('button')?.dataset.retryTask;if(retry){void taskScheduler.run(retry,'manual',{retryFailed:true});return;}if(event.target.closest('button')?.dataset.action==='cancel-search')cancelTaskSearch(event.target.closest('button').dataset.taskId);});

document.addEventListener('error',event=>{if(event.target.matches?.('.listing-icon img,.mini-result-static img,.pet-detail-card img,.role-detail-card img'))event.target.hidden=true;},true);

document.addEventListener('change',event=>{
 const kind=event.target.dataset.resultSort;
 if(kind){const id=event.target.dataset.resultTask||'',run=state.taskRuns?.[id]||{taskId:id,category:event.target.dataset.resultCategory};const value=event.target.value;
  if(kind==='direction'&&['asc','desc','premium','totalPrice'].includes(value)){setResultSort(run,{by:['premium','totalPrice'].includes(value)?value:'price',direction:value==='desc'?'desc':'asc'});render({preserveResultAnchor:false});}
  if(kind==='mode'&&['price-asc','totalPrice-asc','price-desc','shape-desc','growth-desc'].includes(value)){const [by,direction]=value.split('-');setResultSort(run,{by,direction});render({preserveResultAnchor:false});}
 }
 if(event.target.dataset.resultServer!==undefined){const id=event.target.dataset.resultServer,run=state.taskRuns?.[id]||rawSearchRun;if(!event.target.value||resultServers(run.items||[]).some(server=>server.key===event.target.value)){resultServerFilters.set(id,event.target.value);render();}}
});
