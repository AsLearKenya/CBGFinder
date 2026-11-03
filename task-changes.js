(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TaskChanges=api;})(globalThis,function(){
 const key=item=>JSON.stringify([String(item.serverId||''),item.detailEid||item.id]);
 const scope=item=>String(item.searchScope||item.serverId||'*');
 const copy=value=>JSON.parse(JSON.stringify(value));
 function empty(taskId){return {taskId,initialized:false,lastViewedAt:null,baseline:[],latest:[],soldHistory:[],missingItems:{},availability:{},changes:[],updatedAt:0};}
 function diff(record,now){const baseline=new Map(record.baseline.map(i=>[key(i),i])),latest=new Map(record.latest.map(i=>[key(i),i])),changes=[];for(const [id,item] of latest){const old=baseline.get(id);if(!old)changes.push({kind:'new',item,at:now});else if(typeof old.price==='number'&&typeof item.price==='number'&&old.price!==item.price)changes.push({kind:'price',item,previousPrice:old.price,currentPrice:item.price,at:now});}for(const [id,item] of baseline)if(!latest.has(id))changes.push({kind:'gone',item:record.missingItems?.[id]||item,availability:record.availability[id]||{status:'pending',label:'正在查询官网状态'},at:now});return changes;}
 function commit(record,items,completedScopes,now=Date.now()){
  const next=copy(record),valid=items.filter(item=>item.hasStableId!==false&&(item.detailEid||item.id)),current=new Map(valid.map(item=>[key(item),item])),completed=new Set(completedScopes.map(String));
  for(const item of record.latest)if(!current.has(key(item))&&!completed.has('*')&&!completed.has(scope(item)))current.set(key(item),item);
  next.missingItems??={};for(const item of record.latest)if(!current.has(key(item))&&(completed.has('*')||completed.has(scope(item))))next.missingItems[key(item)]=copy(item);for(const id of current.keys())delete next.missingItems[id];next.soldHistory=(next.soldHistory||[]).filter(row=>!current.has(key(row.item)));
  next.latest=[...current.values()];next.updatedAt=now;
  // First complete search provides the baseline rather than a notification for every initial match.
  if(!next.initialized){if(!completed.size)return next;next.initialized=true;next.baseline=copy(next.latest);}
  next.changes=diff(next,now);return next;
 }
 function acknowledge(record,now=Date.now(),viewedItems){
  const next=copy(record);if(record.lastViewedAt>now)return next;
  next.lastViewedAt=now;next.baselineSavedAt=now;next.availability={};
  if(Array.isArray(viewedItems)){
   next.baseline=copy([...new Map(viewedItems.filter(item=>item.hasStableId!==false&&(item.detailEid||item.id)).map(item=>[key(item),item])).values()]);next.initialized=true;
   // Keep a newer search that completed while this view was being saved.
   if(record.updatedAt<=now){next.latest=copy(next.baseline);next.updatedAt=now;}
   next.changes=diff(next,next.updatedAt);
  }else{next.baseline=copy(next.latest);next.changes=[];}
  return next;
 }
 function memoryStorage(){const rows=new Map();return {async get(id){return rows.has(id)?copy(rows.get(id)):null;},async put(record){rows.set(record.taskId,copy(record));},async remove(id){rows.delete(id);}};}
 function browserStorage(){let opening;function db(){if(!opening)opening=new Promise((resolve,reject)=>{const request=indexedDB.open('cbg-task-changes',1);request.onupgradeneeded=()=>request.result.createObjectStore('tasks',{keyPath:'taskId'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return opening;}async function operation(mode,run){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('tasks',mode),request=run(tx.objectStore('tasks'));tx.oncomplete=()=>resolve(request?.result??null);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('变化记录保存失败'));});}return {get:id=>operation('readonly',store=>store.get(id)),put:record=>operation('readwrite',store=>store.put(record)),remove:id=>operation('readwrite',store=>store.delete(id))};}
 function cacheSold(record,item,status){if(status?.status!=='sold'||!item||!Number.isFinite(item.price)||item.price<=0)return;const history=new Map((record.soldHistory||[]).map(row=>[key(row.item),row]));history.set(key(item),{item:copy(item),status:'sold',confirmedAt:status.checkedAt||Date.now(),priceCents:Math.round(item.price*100)});record.soldHistory=[...history.values()];}
 function create(storage){const cache=new Map(),queues=new Map();function enqueue(id,work){const next=(queues.get(id)||Promise.resolve()).catch(()=>{}).then(work);queues.set(id,next);return next;}async function get(id){if(!cache.has(id)){const record=await storage.get(id)||empty(id);record.soldHistory??=[];for(const row of record.changes||[])if(row.kind==='gone'&&!record.soldHistory.some(saved=>key(saved.item)===key(row.item)))cacheSold(record,row.item,row.availability);cache.set(id,record);}return cache.get(id);}return {
  flush:()=>Promise.all([...queues.values()]),
  peek:id=>cache.get(id)||empty(id),load:id=>enqueue(id,()=>get(id)),
  commit:(id,items,scopes,now)=>enqueue(id,async()=>{const record=commit(await get(id),items,scopes,now);await storage.put(record);cache.set(id,record);return copy(record);}),
  open:(id,now,viewedItems)=>{const snapshot=Array.isArray(viewedItems)?copy(viewedItems):undefined;return enqueue(id,async()=>{const record=await get(id),changes=copy(record.changes),next=acknowledge(record,now,snapshot);await storage.put(next);cache.set(id,next);return {changes,record:copy(next)};});},
  recover:(id,item)=>enqueue(id,async()=>{const record=copy(await get(id)),idKey=key(item);if(record.latest.some(row=>key(row)===idKey))return {recovered:false,record};record.latest.push(copy(item));if(!record.baseline.some(row=>key(row)===idKey))record.baseline.push(copy(item));delete record.availability[idKey];delete record.missingItems?.[idKey];record.soldHistory=(record.soldHistory||[]).filter(row=>key(row.item)!==idKey);record.changes=diff(record,Date.now());await storage.put(record);cache.set(id,record);return {recovered:true,record:copy(record)};}),
  availability:(id,item,status)=>enqueue(id,async()=>{const record=copy(await get(id)),idKey=key(item);if(record.latest.some(row=>key(row)===idKey))return record;record.availability[idKey]=status;if(status.status==='sold')cacheSold(record,record.missingItems?.[idKey]||item,status);else if(['listed','offsale','reserved'].includes(status.status))record.soldHistory=(record.soldHistory||[]).filter(row=>key(row.item)!==idKey);record.changes=diff(record,record.updatedAt);await storage.put(record);cache.set(id,record);return record;}),
  reset:(id,revision)=>enqueue(id,async()=>{if(revision){const record={...empty(id),taskRevision:revision};await storage.put(record);cache.set(id,record);}else{await storage.remove(id);cache.delete(id);}})
 };}
 return {key,empty,diff,commit,acknowledge,create,memoryStorage,browserStorage};
});
