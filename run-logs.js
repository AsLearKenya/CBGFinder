(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RunLogs=api;})(globalThis,function(){
 const SLOW_MS=120000;
 function duration(ms){if(!Number.isFinite(ms)||ms<0)return '—';const seconds=Math.floor(ms/1000);return seconds<60?seconds+' 秒':Math.floor(seconds/60)+' 分 '+String(seconds%60).padStart(2,'0')+' 秒';}
 function status(value){return ({running:'搜索中',success:'成功',partial:'失败（部分结果）',failed:'失败',cancelled:'中断',skipped:'跳过'})[value]||'已结束';}
 function rows(logs,requests,events,tasks=[]){const role=id=>tasks.find(task=>task.id===id)?.roleId;return logs.filter(log=>log.status!=='skipped').map(log=>{
  const roleId=log.roleId||role(log.taskId),end=log.finishedAt??log.at,start=log.startedAt??Math.max(0,...logs.filter(old=>old.taskId===log.taskId&&old.at<log.at).map(old=>old.at+1));
  const details=[...requests.filter(event=>event.runId?event.runId===log.id:event.taskId===log.taskId&&event.at>=start&&event.at<=end),...events.filter(event=>event.at>=start&&event.at<=end&&(event.taskId?event.taskId===log.taskId:event.roleId&&event.roleId===roleId))].sort((a,b)=>a.at-b.at);
  return {...log,roleId,startedAt:start,finishedAt:end,durationMs:log.durationMs??(log.startedAt!==undefined?end-start:null),details};
 }).sort((a,b)=>b.at-a.at);}
 return {SLOW_MS,duration,status,rows};
});
