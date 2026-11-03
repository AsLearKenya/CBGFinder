(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./search-params.js'):root.SearchParams);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.TaskScheduler=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(SearchParams){
 'use strict';
 function create({getTasks,execute,now=()=>Date.now(),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),isBlocked=()=>false,onChange=()=>{},onError=()=>{},onSkip=()=>{}}){
  const activeIds=new Set();
  const supported=task=>SearchParams.supportsCategory(task.category);
  const duration=task=>Number(task.interval)*60000;
  function allocationError(task){return SearchParams.roleTaskError(getTasks(),task);}
  function reset(task){task.nextRunAt=task.enabled&&supported(task)&&!isBlocked(task)&&!allocationError(task)&&!activeIds.has(task.id)?now()+duration(task):null;}
  function setEnabled(task,enabled,{immediate=false}={}){
   const error=enabled&&allocationError(task);if(error){task.enabled=false;task.nextRunAt=null;onError(Error(error));onChange();return false;}
   task.enabled=Boolean(enabled&&supported(task));reset(task);if(task.enabled&&immediate&&!isBlocked(task)&&!activeIds.has(task.id))task.nextRunAt=now();onChange();
  }
  async function run(id,source='manual',options={}){
   if(activeIds.has(id)){onSkip(id,source);return false;}
   const task=getTasks().find(task=>task.id===id);
   if(!task||!supported(task))return false;
   if(isBlocked(task)){task.nextRunAt=null;if(source==='manual')onError(Error('该角色的请求已暂停，请在任务的安全提示中处理后点击“尝试请求”'));onChange();return false;}
   const error=allocationError(task);if(error){task.enabled=false;task.nextRunAt=null;onError(Error(error));onChange();return false;}
   activeIds.add(id);task.nextRunAt=null;onChange();
   try{
    if(!getTasks().some(item=>item.id===id)||(source==='automatic'&&!getTasks().find(item=>item.id===id)?.enabled))return false;
    await execute(id,source,options);
    return true;
   }catch(error){onError(error);return false;}
   finally{
    activeIds.delete(id);
    const current=getTasks().find(item=>item.id===id);
    if(current)reset(current);
    onChange();
   }
  }
  async function tick(){
   const due=getTasks().filter(task=>!activeIds.has(task.id)&&task.enabled&&supported(task)&&!isBlocked(task)&&Number.isFinite(task.nextRunAt)&&task.nextRunAt<=now()).sort((a,b)=>a.nextRunAt-b.nextRunAt);
   await Promise.all(due.map(task=>run(task.id,'automatic')));
  }
  return {run,tick,reset,setEnabled,isRunning:id=>activeIds.has(id),get activeId(){return activeIds.values().next().value??null;},get running(){return activeIds.size>0;}};
 }
 return {create};
});
