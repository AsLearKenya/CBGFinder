(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./search-params.js'):root.SearchParams);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TaskStorage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SearchParams){
 'use strict';
 const KEY='cbg:tasks:v1';
 const filterFields=['levelMin','levelMax','levels','types','type','specialSkills','specialEffects','effectMode','gems','suits','sumAttributes','sumMinimum','minPrice','maxPrice','gemLevel','holeCount','repairFailures','excludeMixedGems','activatedStarPosition','extra160','origin',...Object.keys(SearchParams.attributeMap)];
 const serverFields=['key','id','name','region','regionId','pinyin','initials','regionPinyin'];
 function project(task){
  if(!task||typeof task!=='object'||typeof task.id!=='string'||!task.id||typeof task.name!=='string'||!task.name.trim()||!['装备','召唤兽','角色','召唤兽装备','灵饰','上古玉魄'].includes(task.category)||!Number.isInteger(task.interval)||task.interval<1||task.interval>1440||!Array.isArray(task.servers))throw new Error('任务数据格式无效，原存档未被修改');
  const servers=SearchParams.normalizeServers(task.servers,{allowExcess:true}).map(server=>{
   if(!server||!Number.isSafeInteger(Number(server.id))||Number(server.id)<1||typeof server.name!=='string'||!server.name||typeof server.key!=='string'||!server.key)throw new Error('任务服务器数据无效，原存档未被修改');
   return Object.fromEntries(serverFields.filter(key=>server[key]!==undefined).map(key=>[key,server[key]]));
  });
  const result={id:task.id,name:task.name,category:task.category,servers,interval:task.interval,enabled:task.enabled===true&&SearchParams.supportsCategory(task.category),lastRunAt:Number.isFinite(task.lastRunAt)&&task.lastRunAt>0?task.lastRunAt:null};
  if(Number.isFinite(task.lastViewedAt)&&task.lastViewedAt>0)result.lastViewedAt=task.lastViewedAt;
  if(typeof task.resultRevision==='string')result.resultRevision=task.resultRevision;
  if(typeof task.changeNotifications==='boolean')result.changeNotifications=task.changeNotifications;
  if(typeof task.roleId==='string')result.roleId=task.roleId;
  if(typeof task.lastError==='string')result.lastError=task.lastError;
  if(['角色','灵饰','上古玉魄'].includes(task.category))result.valuationEnabled=task.valuationEnabled===true;
  if(task.category==='装备'){
   result.valuationEnabled=task.valuationEnabled===true;
   const source=task.equipmentFilters||{};
   result.equipmentFilters=JSON.parse(JSON.stringify(Object.fromEntries(filterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));
   SearchParams.buildPlans(result,{allowExcessServers:true});
  }
  if(task.category==='召唤兽'){const source=task.petFilters||{};result.petFilters=JSON.parse(JSON.stringify(Object.fromEntries(SearchParams.petFilterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));SearchParams.buildPlans(result,{allowExcessServers:true});}
  if(task.category==='上古玉魄'){const source=task.yupoFilters||{};result.yupoFilters=JSON.parse(JSON.stringify(Object.fromEntries(SearchParams.yupoFilterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));SearchParams.buildPlans(result,{allowExcessServers:true});}
  if(task.category==='灵饰'){const source=task.lingshiFilters||{};result.lingshiFilters=JSON.parse(JSON.stringify(Object.fromEntries(SearchParams.lingshiFilterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));SearchParams.buildPlans(result,{allowExcessServers:true});}
  if(task.category==='召唤兽装备'){const source=task.petEquipmentFilters||{};result.petEquipmentFilters=JSON.parse(JSON.stringify(Object.fromEntries(SearchParams.petEquipFilterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));SearchParams.buildPlans(result,{allowExcessServers:true});}
  if(task.category==='角色'){const source=SearchParams.normalizeRoleFilters(task.roleFilters);result.roleFilters=JSON.parse(JSON.stringify(Object.fromEntries(SearchParams.roleFilterFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]))));SearchParams.buildPlans(result,{allowExcessServers:true});}
  if(new Set(servers.map(s=>String(s.id))).size>8){result.enabled=false;result.lastError='部分区服搜索最多选择8个服务器，请编辑任务缩小范围或改为全服';}
  return result;
 }
 function tasksCopy(tasks){
  if(!Array.isArray(tasks))throw new Error('任务存档格式无效，原存档未被修改');
  const result=tasks.map(project);
  if(new Set(result.map(task=>task.id)).size!==result.length)throw new Error('任务编号重复，原存档未被修改');
  const enabledCounts=new Map();for(const task of result){let error=SearchParams.roleTaskError(result,task);if(!error&&task.enabled&&task.roleId){const count=enabledCounts.get(task.roleId)||0;if(count>=SearchParams.policy.roleEnabledTaskLimit)error=`同一角色最多开启${SearchParams.policy.roleEnabledTaskLimit}个任务，已保留任务并暂停`;else enabledCounts.set(task.roleId,count+1);}if(error){task.enabled=false;task.lastError=error;}}
  return result;
 }
 function load(storage,now=Date.now()){
  const raw=storage.getItem(KEY);if(raw===null)return [];
  const data=JSON.parse(raw);
  if(!data||data.version!==1)throw new Error('任务存档版本无法识别，原存档未被修改');
  return tasksCopy(data.tasks).map(task=>({...task,nextRunAt:task.enabled?now+task.interval*60000:null}));
 }
 function save(storage,tasks){storage.setItem(KEY,JSON.stringify({version:1,savedAt:Date.now(),tasks:tasksCopy(tasks)}));}
 return {KEY,load,save};
});
