(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RoleDetails=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const image=value=>/^https:\/\/cbg-xyq\.res\.netease\.com\/images\/[\w/.-]+$/.test(value||'')?value:'';
 const empty='<p class="role-detail-empty">未提供或未携带</p>';
 const fields=rows=>rows?.length?`<dl class="role-detail-fields">${rows.map(row=>`<div><dt>${escape(row.label)}</dt><dd>${escape(row.value)}</dd></div>`).join('')}</dl>`:empty;
 const panel=(title,body)=>`<section class="role-detail-section"><h4>${escape(title)}</h4>${body}</section>`;
 const list=rows=>rows?.length?`<ul class="role-detail-names">${rows.map(row=>`<li><span>${escape(row.name)}</span><b>${escape(row.value??row.level??'')}</b>${row.description?`<p>${escape(row.description)}</p>`:''}</li>`).join('')}</ul>`:empty;
 const tabs=[['overview','人物/修炼'],['skills','技能'],['inventory','道具/法宝'],['pets','召唤兽/孩子'],['mounts','坐骑'],['looks','锦衣/外观'],['home','玩家之家']];
 function render(detail){
  const info=detail.roleInfo||{},groups=info.groups||{};
  const gallery=name=>info.saleMode==='split'&&name.startsWith('拆卖')?'':panel(name+(groups[name]?.length?' · '+groups[name].length:''),groups[name]?.length?`<div class="role-detail-gallery">${groups[name].map(item=>`<button type="button" data-role-child="${item.index}" aria-label="查看${escape(item.name)}详情">${image(item.icon)?`<img src="${escape(item.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span>${escape(item.name)}</span>${item.level!==undefined?`<small>等级 ${escape(item.level)}</small>`:''}<small>查看详情</small></button>`).join('')}</div>`:empty);
  const skillGrid=items=>items?.length?`<div class="role-skill-grid">${items.map(item=>`<div title="${escape(item.description||'')}">${image(item.icon)?`<img src="${escape(item.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<strong>${escape(item.level)}</strong><span>${escape(item.name)}</span></div>`).join('')}</div>`:empty;
  const market=detail.market||{},bodies={
   overview:`<div class="role-overview-columns"><div>${panel('人物状态',fields(info.basic))}${panel('输出/抗性',fields(info.combat))}</div><div>${panel('角色修炼及宠修',fields([...(info.cultivation||[]),...(info.petTraining||[])]))}${panel('积分与其他',fields(info.points))}${gallery('穿戴装备')}${gallery('命魂之玉')}</div></div>`,
   skills:`<div class="role-skill-columns">${panel('师门技能',skillGrid(info.skills?.school))}<div>${panel('生活技能',skillGrid(info.skills?.life))}${panel('剧情技能',skillGrid(info.skills?.plot))}${panel('熟练度',fields(info.skills?.proficiency))}</div></div>`,
   inventory:`<div class="role-detail-columns"><div>${panel('资金与行囊',fields(info.cash))}${gallery('穿戴装备')}${gallery('道具')}${gallery('拆卖道具')}${gallery('命魂之玉')}</div><div>${gallery('神器')}${gallery('已装备法宝')}${gallery('未装备法宝')}${gallery('已装备灵宝')}${gallery('未装备灵宝')}</div></div>`,
   pets:`<div>${gallery('召唤兽')}${gallery('拆卖召唤兽')}${gallery('孩子')}${panel('特殊宠物',list(info.specialPets))}</div>`,
   mounts:`<div class="role-detail-columns"><div>${(info.riders||[]).map(rider=>panel(rider.name,`${image(rider.icon)?`<img class="role-rider-icon" src="${escape(rider.icon)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}${fields(rider.fields)}${list(rider.skills)}`)).join('')||panel('坐骑',empty)}</div>${panel('祥瑞',list(info.horses))}</div>`,
   looks:`<div class="role-detail-columns"><div>${panel('彩果染色与积分',fields(info.appearance))}${(info.looks||[]).map(group=>panel(group.title,list(group.items))).join('')}</div>${panel('锦衣与挂件',list(info.clothes))}</div>`,
   home:`<div class="role-detail-columns">${panel('房屋信息',fields(info.house))}${(info.home||[]).map(group=>panel(group.title,list(group.items))).join('')}</div>`
  };
  return `<article class="role-detail-card"><header class="role-detail-heading">${image(info.icon)?`<img src="${escape(info.icon)}" alt="" referrerpolicy="no-referrer">`:''}<div><h3>${escape(info.name||detail.name)} <span>${escape(info.level??detail.level)}级 · ${escape(info.stage)}</span></h3>${fields([{label:'价格',value:detail.price?'¥ '+detail.price:'未提供'},{label:'商品编号',value:market.id||'未提供'},{label:'状态',value:market.status||'未提供'},{label:'剩余',value:market.remaining||'未提供'}])}</div></header><div class="role-detail-tabs" role="tablist" aria-label="角色详情分类">${tabs.map(([id,label],i)=>`<button type="button" role="tab" data-role-tab="${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}">${label}</button>`).join('')}</div>${tabs.map(([id,label],i)=>`<section role="tabpanel" aria-label="${label}" data-role-panel="${id}" ${i?'hidden':''}>${bodies[id]}</section>`).join('')}</article>`;
 }
 const mounted=new WeakMap();
 function mount(node,detail){const root=node.querySelector('.role-detail-card');if(root)mounted.set(root,detail);}
 if(typeof document!=='undefined'){
  const activate=(root,id)=>{root.querySelectorAll('[data-role-tab]').forEach(button=>{const active=button.dataset.roleTab===id;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});root.querySelectorAll('[data-role-panel]').forEach(panel=>panel.hidden=panel.dataset.rolePanel!==id);};
  document.addEventListener('keydown',event=>{const button=event.target.closest('[data-role-tab]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...button.closest('.role-detail-tabs').querySelectorAll('button')],i=buttons.indexOf(button),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length;activate(button.closest('.role-detail-card'),buttons[next].dataset.roleTab);buttons[next].focus();});
  document.addEventListener('click',event=>{
   const tab=event.target.closest('[data-role-tab]');if(tab){activate(tab.closest('.role-detail-card'),tab.dataset.roleTab);return;}
   const button=event.target.closest('[data-role-child]');if(!button)return;
   const root=button.closest('.role-detail-card'),detail=mounted.get(root),child=detail?.roleInfo?.children?.[Number(button.dataset.roleChild)];if(!child)return;
   const dialog=document.createElement('dialog');dialog.className='role-item-dialog'+(child.category==='召唤兽'?' role-pet-dialog':'');dialog.setAttribute('aria-label',child.name+'详情');dialog.innerHTML=`<div class="role-item-dialog-head"><strong>${escape(child.name)}</strong><button type="button" aria-label="关闭物品详情">关闭</button></div><div class="role-item-dialog-body">${EquipmentDisclosure.renderDetail(child)}</div>`;document.body.appendChild(dialog);
   const close=()=>dialog.close();dialog.querySelector('button').addEventListener('click',close);dialog.addEventListener('click',event=>{if(event.target===dialog)close();});const position=()=>{const anchor=button.getBoundingClientRect(),bounds=dialog.getBoundingClientRect(),gap=10,pad=12;let left=anchor.right+gap;if(left+bounds.width>window.innerWidth-pad)left=anchor.left-bounds.width-gap;if(left<pad)left=Math.max(pad,Math.min(anchor.left,window.innerWidth-bounds.width-pad));const top=Math.max(pad,Math.min(anchor.top,window.innerHeight-bounds.height-pad));dialog.style.left=left+'px';dialog.style.top=top+'px';};
   dialog.addEventListener('close',()=>{window.removeEventListener('resize',position);document.removeEventListener('scroll',position,true);dialog.remove();if(button.isConnected)button.focus({preventScroll:true});},{once:true});dialog.showModal();position();window.addEventListener('resize',position);document.addEventListener('scroll',position,true);
  });
 }
 return {render,mount};
});
