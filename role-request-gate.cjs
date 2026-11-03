'use strict';
const policy=require('./search-policy');
class RoleRequestGate{
 constructor({limit=policy.roleConcurrency,taskLimit=policy.roleTaskLimit,minInterval=policy.minRequestGapMs,now=Date.now}={}){this.limit=limit;this.taskLimit=taskLimit;this.minInterval=minInterval;this.now=now;this.roles=new Map();}
 pool(id){if(!this.roles.has(id))this.roles.set(id,{active:0,pending:[],tasks:new Map(),nextStart:0,timer:null,blocked:''});return this.roles.get(id);}
 snapshot(id){const p=this.pool(id);return {active:p.active,queued:p.pending.length,blocked:p.blocked,concurrency:this.limit};}
 resume(id){this.pool(id).blocked='';this.pump(id);}
 block(id,message){const p=this.pool(id);p.blocked=message;if(p.timer){clearTimeout(p.timer);p.timer=null;}for(const item of p.pending.splice(0)){item.cleanup();this.releaseTask(p,item.taskId);item.reject(Error(message));}}
 async probe(id,operation,{signal}={}){
  const p=this.pool(id);if(p.active||p.pending.length||p.probing)throw Error('该角色正在请求，请稍候再检查');
  if(p.blocked&&!/CAPTCHA_AUTH|MIBAO_AUTH|OTP_AUTH|验证码|验证/.test(p.blocked))throw Error(p.blocked);
  p.probing=true;p.active++;
  try{const wait=Math.max(0,p.nextStart-this.now());if(wait)await new Promise((resolve,reject)=>{let timer;const abort=()=>{clearTimeout(timer);reject(signal.reason);};timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},wait);signal?.addEventListener('abort',abort,{once:true});});signal?.throwIfAborted();p.nextStart=this.now()+this.minInterval;return await operation();}
  finally{p.probing=false;p.active--;this.pump(id);}
 }
 releaseTask(pool,id){if(!id)return;const n=(pool.tasks.get(id)||1)-1;if(n)pool.tasks.set(id,n);else pool.tasks.delete(id);}
 promote(id,priorityKey,priority=10){const p=this.pool(id);for(const item of p.pending)if(item.priorityKey===priorityKey)item.priority=Math.max(item.priority,priority);p.pending.sort((a,b)=>b.priority-a.priority);if(p.timer){clearTimeout(p.timer);p.timer=null;}this.pump(id);}
 run(id,operation,{signal,taskId,priority=0,priorityKey}={}){
  const p=this.pool(id);if(signal?.aborted)return Promise.reject(signal.reason);if(p.blocked)return Promise.reject(Error(p.blocked));if(p.probing)return Promise.reject(Error('角色会话正在检查，请稍候'));if(taskId&&!p.tasks.has(taskId)&&p.tasks.size>=this.taskLimit)return Promise.reject(Error(`同一角色最多同时运行${this.taskLimit}个任务，请等待已有任务完成`));
  if(taskId)p.tasks.set(taskId,(p.tasks.get(taskId)||0)+1);
  return new Promise((resolve,reject)=>{const item={operation,resolve,reject,signal,taskId,priority:priority>0?10:0,priorityKey};const abort=()=>{const index=p.pending.indexOf(item);if(index<0)return;p.pending.splice(index,1);item.cleanup();this.releaseTask(p,taskId);reject(signal.reason);this.pump(id);};item.cleanup=()=>signal?.removeEventListener('abort',abort);signal?.addEventListener('abort',abort,{once:true});const index=p.pending.findIndex(other=>other.priority<item.priority);if(index<0)p.pending.push(item);else p.pending.splice(index,0,item);if(item.priority&&p.timer){clearTimeout(p.timer);p.timer=null;}this.pump(id);});
 }
 pump(id){const p=this.pool(id);if(p.blocked||p.probing||p.timer||p.active>=this.limit||!p.pending.length)return;const wait=p.nextStart-this.now();if(wait>0){p.timer=setTimeout(()=>{p.timer=null;this.pump(id);},wait);return;}
  const item=p.pending.shift();item.cleanup();if(item.signal?.aborted){this.releaseTask(p,item.taskId);item.reject(item.signal.reason);this.pump(id);return;}
  p.active++;p.nextStart=this.now()+this.minInterval;
  Promise.resolve().then(item.operation).then(item.resolve,item.reject).finally(()=>{p.active--;this.releaseTask(p,item.taskId);this.pump(id);});this.pump(id);
 }
}
module.exports={RoleRequestGate};
