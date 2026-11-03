/* Read-only hover details. Fetch only the current product and keep a short cache. */
(()=>{
 const cache=new Map();let target=null,panel=null,openTimer=0,closeTimer=0,version=0;
 const esc=SearchResults.escape;
 function position(){if(!target||!panel)return;const rect=target.getBoundingClientRect(),width=Math.min(520,innerWidth-24);panel.style.width=width+'px';const left=rect.right+12+width<=innerWidth?rect.right+12:Math.max(12,Math.min(rect.left-width-12,innerWidth-width-12));panel.style.left=left+'px';panel.style.top=Math.max(12,Math.min(rect.top,innerHeight-panel.offsetHeight-12))+'px';}
 function hide(){clearTimeout(openTimer);clearTimeout(closeTimer);version++;panel?.remove();panel=null;if(target)target.removeAttribute('aria-describedby');target=null;}
 function scheduleClose(){clearTimeout(closeTimer);closeTimer=setTimeout(hide,200);}
 function markup(detail){
  const config=typeof autoSearchConfig==='object'&&autoSearchConfig?autoSearchConfig:{};
  return `<header><strong>${esc(detail.name)}</strong><span>${esc(detail.category)}${detail.level?' · '+esc(detail.level)+'级':''}${detail.price?' · ¥'+esc(detail.price):''}</span></header>${detail.sections.map(s=>{
   const lines=[...(s.lines||[])];
   if(s.skillIds)lines.push(s.skillIds.map(id=>(s.title==='赐福技能'?config.pet_skill_high_to_other_level_mapping?.[id]?.name:null)||config.pet_skill_desc?.[id]?.name||'技能 #'+id).join('、'));
   if(s.neidan)lines.push(...s.neidan.map(n=>(config.neidan_desc?.[n.id]?.name||config.high_neidans?.[n.id]||config.low_neidans?.[n.id]||'内丹 #'+n.id)+' · '+n.level+'层'));
   return `<section class="${s.title==='召唤兽属性与资质'?'detail-attributes':''}"><h4>${s.icon?`<img src="${esc(SearchResults.safeIcon({icon:s.icon}))}" alt="" referrerpolicy="no-referrer">`:''}${esc(s.title)}</h4><div>${lines.map(l=>`<p>${esc(l)}</p>`).join('')}</div></section>`;
  }).join('')}`;
 }
 async function show(row){
  hide();target=row;const current=++version;
  panel=document.createElement('aside');panel.id='item-hover-detail';panel.className='item-hover-detail';panel.tabIndex=0;panel.setAttribute('role','region');panel.setAttribute('aria-label','商品完整详情');row.setAttribute('aria-describedby',panel.id);
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));panel.addEventListener('pointerleave',scheduleClose);
  panel.innerHTML='<p class="detail-status" role="status">正在加载商品详情…</p>';document.body.append(panel);position();
  try{
   const task=state.tasks.find(t=>t.id===row.dataset.detailTask);if(!task?.roleId)throw Error('任务绑定的角色不存在，无法加载详情');
   const input={roleId:task.roleId,serverId:row.dataset.detailServer,eid:row.dataset.detailEid},key=JSON.stringify(input);
   let entry=cache.get(key);if(!entry||entry.until<=Date.now()){
    const promise=roleApi('item-detail',input);entry={promise,until:Date.now()+120000};if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,entry);promise.catch(()=>{if(cache.get(key)===entry)cache.delete(key);});
   }
   const detail=await entry.promise;if(current!==version||!target?.isConnected)return;
   panel.innerHTML=markup(detail);position();
  }catch(error){if(current!==version)return;panel.innerHTML=`<p class="detail-status" role="alert">${esc(error.message)}</p>`;position();}
 }
 function enter(row){if(row?.classList.contains('equipment-listing')||!row?.dataset.detailEid)return;if(row===target){clearTimeout(closeTimer);return;}clearTimeout(openTimer);openTimer=setTimeout(()=>show(row),300);}
 document.addEventListener('pointerover',e=>{const row=e.target.closest('.listing-row');if(row&&!row.contains(e.relatedTarget))enter(row);});
 document.addEventListener('pointerout',e=>{const row=e.target.closest('.listing-row');if(row&&!row.contains(e.relatedTarget)){clearTimeout(openTimer);if(!panel?.contains(e.relatedTarget))scheduleClose();}});
 document.addEventListener('focusin',e=>{const row=e.target.closest('.listing-row');if(row)enter(row);else if(!panel?.contains(e.target))hide();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 window.addEventListener('scroll',()=>{if(target&&!target.isConnected)hide();else position();},true);
 window.addEventListener('resize',position);
 new MutationObserver(()=>{if(target&&!target.isConnected)hide();}).observe(document.querySelector('#main'),{childList:true,subtree:true});
})();
