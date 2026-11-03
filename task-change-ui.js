const taskChangeStore=TaskChanges.create(TaskChanges.browserStorage());
const taskChangeViews=new Map(),taskChangeModes=new Map(),taskChangeEpochs=new Map(),taskStatusJobs=new Map();
let taskChangeStorageError='';
function changeRows(id){const rows=new Map((taskChangeViews.get(id)||[]).map(row=>[TaskChanges.key(row.item),row]));for(const row of taskChangeStore.peek(id).changes)rows.set(TaskChanges.key(row.item),row);return [...rows.values()];}
function taskChangeBadge(id){const rows=taskChangeStore.peek(id).changes;return rows.length?`<span class="task-change-badge">${rows.length} 项商品变化</span>`:'';}
async function restoreTaskChanges(id){
 const epoch=taskChangeEpochs.get(id)||0;let record=await taskChangeStore.load(id);const task=state.tasks.find(task=>task.id===id);
 if(!task||epoch!==(taskChangeEpochs.get(id)||0))return record;
 if((record.taskRevision||'')!==(task.resultRevision||'')){await taskChangeStore.reset(id,task.resultRevision);record=await taskChangeStore.load(id);}
 if(epoch!==(taskChangeEpochs.get(id)||0))return record;
 if(record.lastViewedAt)task.lastViewedAt=record.lastViewedAt;
 if(record.initialized&&!state.taskRuns[id])state.taskRuns[id]={taskId:id,taskName:task.name,category:task.category,restored:true,running:false,records:[],serverStates:{},items:record.latest,total:0};
 return record;
}
async function loadTaskChanges(){await Promise.all(state.tasks.map(async task=>{try{await restoreTaskChanges(task.id);}catch(error){taskChangeStorageError='商品变化记录无法读取：'+error.message;}}));render();}
async function openTaskResults(id){
 if(!state.tasks.some(task=>task.id===id))return;selectedTaskId=id;page='task-detail';render();
 try{const epoch=taskChangeEpochs.get(id)||0,now=Date.now(),visibleRun=state.taskRuns[id],visibleItems=visibleRun?JSON.parse(JSON.stringify(visibleRun.items||[])):undefined,record=await restoreTaskChanges(id);if(epoch!==(taskChangeEpochs.get(id)||0))return;const result=await taskChangeStore.open(id,now,record.changes.length?undefined:visibleItems),task=state.tasks.find(task=>task.id===id);if(!task||epoch!==(taskChangeEpochs.get(id)||0))return;task.lastViewedAt=result.record.lastViewedAt;taskChangeViews.set(id,result.changes);taskChangeModes.set(id,result.changes.length?'changes':'all');persist();void resolveMissingProducts(task,result.changes.filter(row=>row.kind==='gone'),taskChangeEpochs.get(id)||0).catch(error=>toast('商品状态查询未完成：'+error.message));if(page==='task-detail'&&selectedTaskId===id)render();}
 catch(error){taskChangeStorageError='查看时间或变化记录未能保存：'+error.message;toast(taskChangeStorageError);}
}
function resetTaskChanges(id){taskChangeEpochs.set(id,(taskChangeEpochs.get(id)||0)+1);taskChangeViews.delete(id);taskChangeModes.delete(id);const task=state.tasks.find(task=>task.id===id);if(task)task.lastViewedAt=null;void taskChangeStore.reset(id,task?.resultRevision).catch(error=>toast('旧变化记录清除失败：'+error.message));}
function changeSignature(rows){return JSON.stringify(rows.map(row=>[row.kind,TaskChanges.key(row.item),row.kind==='price'?row.currentPrice:null]).sort((a,b)=>String(a).localeCompare(String(b))));}
async function recordTaskChanges(task,run){
 if(!state.tasks.some(current=>current.id===task.id&&current.roleId===task.roleId))return;
 const epoch=taskChangeEpochs.get(task.id)||0;
 try{
  const previous=await taskChangeStore.load(task.id);if(run.retired||epoch!==(taskChangeEpochs.get(task.id)||0)||!state.tasks.some(current=>current.id===task.id))return;
  const before=changeSignature(previous.changes),completed=Object.entries(run.serverStates||{}).filter(([,server])=>server.status==='completed').map(([scope])=>scope);
  if(!completed.length)return;
  let record=await taskChangeStore.commit(task.id,run.items,completed,Date.now());if(run.retired||epoch!==(taskChangeEpochs.get(task.id)||0)||!state.tasks.some(current=>current.id===task.id))return;
  taskChangeStorageError='';
  await resolveMissingProducts(task,record.changes.filter(row=>row.kind==='gone'),epoch);
  if(run.retired||epoch!==(taskChangeEpochs.get(task.id)||0))return;record=taskChangeStore.peek(task.id);
  if(record.changes.length&&changeSignature(record.changes)!==before){const count=kind=>record.changes.filter(row=>row.kind===kind).length,body=`「${task.name}」上新 ${count('new')} 件、价格变化 ${count('price')} 件、消失 ${count('gone')} 件`;if(typeof areChangeNotificationsEnabled==='function'&&areChangeNotificationsEnabled(task.id))toast(body);if(typeof sendTaskNotice==='function')sendTaskNotice({kind:'changes',taskId:task.id,title:'搜索任务有商品变化',body});}
  render();
 }catch(error){taskChangeStorageError='商品变化记录保存失败：'+error.message;toast(taskChangeStorageError);render();}
}
async function resolveMissingProducts(task,changes,epoch,{force=false}={}){
 for(const row of changes){
  if(epoch!==(taskChangeEpochs.get(task.id)||0)||!state.tasks.some(t=>t.id===task.id))return;
  if(!force&&!['pending','unknown','listed'].includes(row.availability?.status||'pending'))continue;if(!row.item.detailEid){const status={status:'unknown',label:'官网未返回完整商品编号，无法查询状态'};await taskChangeStore.availability(task.id,row.item,status);for(const entry of taskChangeViews.get(task.id)||[])if(TaskChanges.key(entry.item)===TaskChanges.key(row.item))entry.availability=status;render();continue;}
  const key=JSON.stringify([task.id,TaskChanges.key(row.item)]);if(taskStatusJobs.has(key))continue;taskStatusJobs.set(key,true);
  try{
   const runBefore=state.taskRuns[task.id],runToken=runBefore?.runId;
   const status={...await roleApi('item-status',{roleId:task.roleId,serverId:row.item.serverId,eid:row.item.detailEid,task}),checkedAt:Date.now()};
   if(epoch!==(taskChangeEpochs.get(task.id)||0))return;
   if(state.taskRuns[task.id]?.runId!==runToken)continue;
   if(status.match==='yes'&&status.item){
    const item=SearchResults.normalize(status.item,{config:autoSearchConfig||{},taskId:task.id,taskName:task.name,serverName:row.item.server,serverId:row.item.serverId,category:task.category,transformGroups:transformSuitGroups});
    if(!item||TaskChanges.key(item)!==TaskChanges.key(row.item))throw Error('复核返回的商品编号不一致');
    item.searchScope=row.item.searchScope||row.item.serverId||'*';item.recovered=true;
    const recovered=await taskChangeStore.recover(task.id,item);
    if(epoch!==(taskChangeEpochs.get(task.id)||0))return;
    if(recovered.recovered){
     const run=state.taskRuns[task.id];
     if(run&&!run.items.some(value=>TaskChanges.key(value)===TaskChanges.key(item))){run.items.push(item);if(run.serverSnapshots){const scope=item.searchScope;run.serverSnapshots[scope]=[...(run.serverSnapshots[scope]||[]).filter(value=>TaskChanges.key(value)!==TaskChanges.key(item)),item];}if(typeof rawSearchRun!=='undefined'&&rawSearchRun===run)state.results=run.items;}
     const archived=(taskChangeViews.get(task.id)||[]).filter(entry=>TaskChanges.key(entry.item)!==TaskChanges.key(item));taskChangeViews.set(task.id,archived);
    }
    render();continue;
   }
   delete status.item;
   await taskChangeStore.availability(task.id,row.item,status);
   for(const entry of taskChangeViews.get(task.id)||[])if(entry.kind==='gone'&&TaskChanges.key(entry.item)===TaskChanges.key(row.item))entry.availability=status;
   render();
  }catch(error){
   if(epoch!==(taskChangeEpochs.get(task.id)||0))return;
   const status={status:'unknown',label:'状态待确认：'+error.message};await taskChangeStore.availability(task.id,row.item,status).catch(()=>{});
   for(const entry of taskChangeViews.get(task.id)||[])if(entry.kind==='gone'&&TaskChanges.key(entry.item)===TaskChanges.key(row.item))entry.availability=status;
   render();if(/验证码|过于频繁|已暂停|登录/.test(error.message)){void loadRoles();return;}
  }finally{taskStatusJobs.delete(key);render();}
 }
}
function taskChangeDisplayItem(row){
 if(row.kind!=='gone')return row.item;
 const status=row.availability?.status||'pending',labels={sold:'已售出',offsale:'已下架',reserved:'已被下单，未确认成交',listed:'仍在售（已核对）',unknown:'状态待确认',pending:'正在查询官网状态'};
 // Disappeared items are historical snapshots. Never keep their old selling
 // state or countdown beside the independently queried official status.
 return {...row.item,availabilityStatus:status,status:labels[status]||'状态待确认',remaining:'',fairShow:false,fairShowLeft:'',fairShowEnd:'',sellingAgo:'',expireTime:''};
}
function taskChangeStatusControls(task,row){
 const checked=row.availability?.checkedAt,key=TaskChanges.key(row.item),busy=taskStatusJobs.has(JSON.stringify([task.id,key]));
 return `${checked?`<span> · ${dateTime(checked)} 核对</span>`:''} <button type="button" class="text-button" data-task-status-recheck="${esc(task.id)}" data-product-status-key="${esc(key)}" ${busy?'disabled':''}>${busy?'核对中…':'重新核对状态'}</button>`;
}
function taskChangeResults(task,run){
 const rows=changeRows(task.id),mode=taskChangeModes.get(task.id)||'all',last=task.lastViewedAt;
 const controls=`<div class="task-change-toolbar"><div class="segmented"><button type="button" data-task-result-mode="changes" class="${mode==='changes'?'active':''}">商品变化（${rows.length}）</button><button type="button" data-task-result-mode="all" class="${mode==='all'?'active':''}">全部结果（${run?.items?.length||0}）</button></div><span>${last?'上次查看 '+dateTime(last):'尚未查看'}${run?.running?' · 搜索中':''}</span></div>`;
 if(mode==='all')return controls+(run?rawSearchView(run):`<section class="panel">${empty('暂无搜索结果','点击“搜索一次”开始搜索。')}</section>`);
 const price=value=>typeof value==='number'?'¥ '+value.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'未提供';
 const groups=[['new','上新商品'],['price','价格变化'],['review','仍在售待复核'],['gone','消失商品']];
 return controls+`<div class="task-change-groups">${groups.map(([kind,label])=>{const entries=rows.filter(row=>kind==='review'?row.kind==='gone'&&row.availability?.status==='listed':row.kind===kind&&(kind!=='gone'||row.availability?.status!=='listed'));return `<section class="panel task-change-group" id="task-changes-${kind}"><h2>${label}<span>${entries.length}</span></h2>${entries.length?entries.map(row=>`<article class="task-change-entry" data-change-key="${esc(kind+TaskChanges.key(row.item))}"><div class="task-change-description ${kind}">${kind==='price'?`${price(row.previousPrice)} → ${price(row.currentPrice)}`:['gone','review'].includes(kind)?esc(row.availability?.label||'正在查询官网状态'):'上次查看后新增'}${row.kind==='gone'?taskChangeStatusControls(task,row):''}</div>${SearchResults.renderItem(taskChangeDisplayItem(row))}</article>`).join(''):`<p class="task-change-empty">暂无${label}</p>`}</section>`;}).join('')}</div>`;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-task-result-mode]');if(!button||!selectedTaskId)return;taskChangeModes.set(selectedTaskId,button.dataset.taskResultMode);render();});

document.addEventListener('click',event=>{
 const button=event.target.closest('[data-task-status-recheck]');if(!button)return;
 const task=state.tasks.find(task=>task.id===button.dataset.taskStatusRecheck),row=task&&changeRows(task.id).find(row=>row.kind==='gone'&&TaskChanges.key(row.item)===button.dataset.productStatusKey);
 if(!task||!row)return;button.disabled=true;
 void resolveMissingProducts(task,[row],taskChangeEpochs.get(task.id)||0,{force:true}).catch(error=>toast('商品状态查询未完成：'+error.message));
});
