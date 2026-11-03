(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TaskNotifications=api;})(globalThis,function(){
 function create(send){const seen=new Set();return {reset(){seen.clear();},sync(tasks,needsVerification){const blocked=new Map();for(const task of tasks)if(task.roleId&&needsVerification(task)&&!blocked.has(task.roleId))blocked.set(task.roleId,task);for(const role of seen)if(!blocked.has(role))seen.delete(role);for(const [role,task] of blocked)if(!seen.has(role)){seen.add(role);send({taskId:task.id,title:'搜索任务需要安全验证',body:`「${task.name}」已暂停，请完成验证后继续搜索。`});}}};}
 function preferences(storage,key='cbg:change-notifications:v1',fallback=false){let enabled=fallback;try{const saved=storage.getItem(key);if(saved!==null)enabled=saved==='true';}catch{}return {get enabled(){return enabled;},set(value){storage.setItem(key,String(Boolean(value)));enabled=Boolean(value);}};}
 return {create,preferences};
});
