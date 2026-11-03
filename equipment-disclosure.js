(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentDisclosure=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const expanded=new Set();
 function createCache(load){const values=new Map();return {get(key,input){if(!values.has(key)){const promise=Promise.resolve().then(()=>load(input));values.set(key,promise);promise.catch(()=>{if(values.get(key)===promise)values.delete(key);});}return values.get(key);}};}
 function extraLines(detail){
  const lines=detail.sections.flatMap(s=>s.lines||[]),result=[];let melt=false;
  for(let line of lines){line=line.trim();if(!line)continue;
   if(line.startsWith('熔炼效果'))break;
   if(!melt){
    if(/^等级\s/.test(line)){const five=line.match(/五行\s*\S+/);if(five)result.push(five[0]);continue;}
    if(/^(?:伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防)\s*[+-]?\d/.test(line)||/^(?:耐久|锻炼等级|开运孔数|特技[：:]|特效[：:]|套装效果[：:]|修理失败)/.test(line))continue;
    if(/^(?:体质|力量|魔力|敏捷|耐力)\s*[+-]?\d/.test(line))continue;
   }
   result.push(line);
  }
  return result;
 }
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function descriptionMarkup(source,initial='yellow'){
  const colors={Y:'yellow',W:'white',G:'green',R:'red',B:'blue',K:'white',n:'yellow'};
  let color=initial,lines=[],parts=[],meltLine=false;
  const flush=()=>{if(parts.length){lines.push(`<p${meltLine?' class="eq-game-melt"':''}>${parts.join('')}</p>`);parts=[];meltLine=false;}};
  for(const token of String(source||'').split(/(#c[0-9a-f]{6}|#[rRGBYKWnbu]|\n)/gi)){
   if(!token)continue;
   if(token==='#r'||token==='\n'){flush();continue;}
   if(/^#c[0-9a-f]{6}$/i.test(token)){
    const rgb=[1,3,5].map(i=>parseInt(token.slice(i+1,i+3),16));
    const palette={purple:[238,130,238],blue:[77,186,244],green:[0,255,0],yellow:[255,255,0],white:[255,255,255],red:[255,70,70]};
    color=Object.entries(palette).sort((a,b)=>a[1].reduce((s,n,i)=>s+(n-rgb[i])**2,0)-b[1].reduce((s,n,i)=>s+(n-rgb[i])**2,0))[0][0];continue;
   }
   if(token.length===2&&token[0]==='#'&&Object.hasOwn(colors,token[1])){color=colors[token[1]];continue;}
   if(token==='#b'||token==='#u')continue;
   if(token.includes('熔炼效果'))meltLine=true;
   parts.push(`<span class="eq-game-${color}">${escape(token)}</span>`);
  }
  flush();return lines.join('');
 }
 function renderDetail(detail){
  if(detail.category==='角色'&&typeof RoleDetails==='object')return RoleDetails.render(detail);
  if(detail.category==='召唤兽装备'&&typeof PetEquipment==='object')return PetEquipment.renderCard(detail);
  if(detail.category==='召唤兽'&&typeof PetDetails==='object')return PetDetails.render(detail,{...(typeof autoSearchConfig==='object'&&autoSearchConfig?autoSearchConfig:{}),...(detail.petSkillConfig?{pet_skill_desc:detail.petSkillConfig}:{})});
  const description=detail.styledDescription||detail.sections.flatMap(s=>s.lines||[]).join('\n');
  return `<div class="eq-game-card"><h4>${escape(detail.name)}</h4>${detail.lore?`<div class="eq-game-lore">${descriptionMarkup(detail.lore,'white')}</div>`:''}<div class="eq-game-attributes">${descriptionMarkup(description)}</div></div>`;
 }
 const api={clearTask:id=>{for(const key of expanded){try{if(JSON.parse(key)[0]===id)expanded.delete(key);}catch{}}},isOpen:key=>expanded.has(key),createCache,extraLines,renderDetail,descriptionMarkup};
 if(typeof document==='undefined')return api;
 const cache=createCache(input=>roleApi('item-detail',input)),rendered=new WeakMap();
 api.loadDetail=input=>cache.get(JSON.stringify(input),input);
 async function hydrate(row){
  if(!row.open)return;
  const node=row.querySelector('.equipment-full-detail');if(!node||rendered.has(node))return;rendered.set(node,true);
  const task=state.tasks.find(t=>t.id===row.dataset.detailTask);
  if(!task?.roleId){node.innerHTML='<p role="alert">任务绑定的角色不存在，无法加载详情。</p>';return;}
  if(!row.dataset.detailEid){node.innerHTML='<p role="alert">官网未返回商品详情编号。</p>';return;}
  const input={roleId:task.roleId,serverId:row.dataset.detailServer,eid:row.dataset.detailEid},key=JSON.stringify(input);
  const promise=cache.get(key,input);
  node.innerHTML='<p role="status">正在加载商品详情…</p>';
  try{let detail=await promise;if(!node.isConnected)return;if(detail.category==='召唤兽'){let dreams=[];try{dreams=JSON.parse(row.dataset.detailMengying||'[]');}catch{}if(Array.isArray(dreams)&&dreams.length&&!detail.petInfo?.mengying)detail={...detail,petInfo:{...detail.petInfo,mengying:dreams}};}node.innerHTML=renderDetail(detail);if(detail.category==='角色'&&typeof RoleDetails==='object')RoleDetails.mount(node,detail);if(detail.category==='角色'&&typeof recordRoleValuationDetail==='function')recordRoleValuationDetail(task.id,input.eid,input.serverId,detail,task);if(typeof clearVerificationAfterDetail==='function')clearVerificationAfterDetail(input.roleId);}
  catch(error){if(node.isConnected)node.innerHTML=`<p role="alert">${SearchResults.escape(error.message)}，收起后重新展开可重试。</p>`;}
 }
 document.addEventListener('click',event=>{
  if(event.target.closest('[data-product-action],[data-valuation-evidence],[data-valuation-refresh],[data-role-valuation-item],[data-role-carried-view],[data-role-carried-task],[data-role-carried-cancel]'))return;
  const summary=event.target.closest('.equipment-listing > summary');if(!summary)return;
  const row=summary.parentElement,key=row.dataset.equipmentKey;
  if(row.open)expanded.delete(key);else expanded.add(key);
 },true);
 document.addEventListener('toggle',event=>{
  const row=event.target;if(!row.matches?.('.equipment-listing'))return;
  if(row.open){expanded.add(row.dataset.equipmentKey);void hydrate(row);}else {expanded.delete(row.dataset.equipmentKey);const node=row.querySelector('.equipment-full-detail');if(node)rendered.delete(node);}
 },true);
 // Search progress and sorting replace result rows; restore open panels from cached data.
 const main=document.querySelector('#main');
 const watchedRoles=new Set(),roleDwell=new Map(),ROLE_DWELL_MS=600;
 const visible=node=>{if(!node.isConnected||document.visibilityState==='hidden')return false;const r=node.getBoundingClientRect(),height=window.innerHeight,width=window.innerWidth;return r.height>0&&r.right>0&&r.left<width&&Math.min(r.bottom,height)-Math.max(r.top,0)>=Math.min(r.height,height)*.25;};
 const clearDwell=node=>{const state=roleDwell.get(node);if(state)clearTimeout(state.timer);roleDwell.delete(node);};
 const roleViewport=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{
  for(const entry of entries){const node=entry.target;
   if(!entry.isIntersecting||entry.intersectionRatio<.25){clearDwell(node);continue;}
   if(roleDwell.has(node))continue;
   const state={ready:false,timer:null};roleDwell.set(node,state);
   state.timer=setTimeout(()=>{if(roleDwell.get(node)!==state||!visible(node)){clearDwell(node);return;}state.ready=true;const row=node.closest('.role-listing');
    if(row&&typeof requestVisibleRoleValuation==='function')requestVisibleRoleValuation(row.dataset.detailTask,row.dataset.detailEid,row.dataset.detailServer,{canLoad:()=>roleDwell.get(node)===state&&state.ready&&visible(node)});
   },ROLE_DWELL_MS);
  }
 },{rootMargin:'0px',threshold:[0,.25]}):null;
 function scanDetails(){
  for(const row of main.querySelectorAll('.equipment-listing[open]'))void hydrate(row);
  for(const node of watchedRoles)if(!node.isConnected){clearDwell(node);roleViewport?.unobserve(node);watchedRoles.delete(node);}
  if(roleViewport)for(const row of main.querySelectorAll('.role-listing')){const node=row.querySelector('summary')||row;if(!watchedRoles.has(node)){watchedRoles.add(node);roleViewport.observe(node);}}
 }
 api.refreshRoleViewport=()=>{for(const node of watchedRoles){clearDwell(node);roleViewport?.unobserve(node);roleViewport?.observe(node);}};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')for(const node of roleDwell.keys())clearDwell(node);else api.refreshRoleViewport();});
 if(main){new MutationObserver(scanDetails).observe(main,{childList:true,subtree:true});scanDetails();}
 return api;
});
