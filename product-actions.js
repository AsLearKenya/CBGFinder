(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProductActions=api;})(globalThis,function(){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validServer=value=>/^[1-9]\d{0,5}$/.test(String(value));
 function shareUrl(item){return validServer(item.serverId)&&/^\d{15}-\d+-[A-Za-z0-9]{1,40}$/.test(String(item.detailEid||''))?'https://xyq-m.cbg.163.com/cgi/mweb/equip/'+item.serverId+'/'+item.detailEid:'';}
 function order(item){return /^\d{1,10}_\d{1,16}_\d{1,20}$/.test(String(item.orderSn||''))?item.orderSn:'';}
 function createStore(){const states=new Map();const key=(roleId,item)=>JSON.stringify([roleId,String(item.serverId),order(item)]);return {get(roleId,item){return states.get(key(roleId,item))||{collected:!!item.collected&&(!item.collectedRoleId||item.collectedRoleId===roleId),busy:false};},async change(roleId,item,send){const id=key(roleId,item),before=this.get(roleId,item);if(before.busy)return null;states.set(id,{...before,busy:true});try{const response=await send({roleId,serverId:item.serverId,orderSn:order(item),collected:!before.collected});if(response?.ok!==true||response.collected!==!before.collected)throw Error('官网未确认收藏状态');states.set(id,{collected:response.collected,busy:false});return response;}catch(error){states.set(id,{...before,busy:false});throw error;}}};}
 const store=createStore();
 const lastRoles=new Map();let choosing=false;
 const taskFor=item=>{if(typeof state!=='object')return null;const current=typeof valuationTaskById==='function'?valuationTaskById(item.taskId):state.tasks.find(t=>t.id===item.taskId);return state.tasks.find(t=>t.id===(current?.parentTaskId||current?.id||item.taskId))||current;};
 const roles=()=>typeof availableRoles==='undefined'?[]:[...availableRoles].sort((a,b)=>Number(b.collectionOnly===true)-Number(a.collectionOnly===true));
 const available=id=>roles().some(role=>role.id===id);
 const itemKey=item=>JSON.stringify([item.taskId,String(item.serverId),order(item)]);
 const sourceItem=item=>{const task=taskFor(item),run=typeof valuationRunById==='function'?valuationRunById(item.taskId):typeof state==='object'?state.taskRuns?.[item.taskId]:null;return {...item,collectedRoleId:item.collectedRoleId||run?.sourceRoleId||task?.resultRoleId||task?.roleId||''};};
 const roleFor=item=>{const configured=taskFor(item)?.collectionRoleId;if(available(configured))return configured;const last=lastRoles.get(itemKey(item))||'';return available(last)?last:'';};
 const roleName=id=>typeof roleLabel==='function'?roleLabel(id):roles().find(role=>role.id===id)?.nickname||id;
 function title(item,current){if(!order(item))return '官网未返回收藏所需的订单编号';const configured=taskFor(item)?.collectionRoleId;
  return configured&&available(configured)?(current.collected?'取消':'')+'收藏到 '+roleName(configured):'点击选择收藏角色';
 }
 function render(item){item=sourceItem(item);const roleId=roleFor(item),current=store.get(roleId,item),link=shareUrl(item),sn=order(item);return `<div class="product-actions" data-product-task="${escape(item.taskId)}" data-product-server="${escape(item.serverId)}" data-product-eid="${escape(item.detailEid||'')}" data-product-order="${escape(sn)}" data-product-collected="${item.collected?'1':'0'}" data-product-source-role="${escape(item.collectedRoleId)}"><button type="button" data-product-action="copy" ${link?'':'disabled'} title="${link?'复制藏宝阁商品链接':'官网未返回完整商品编号'}">复制链接</button><button type="button" data-product-action="collect" aria-pressed="${current.collected}" class="${current.collected?'collected':''}" ${!sn||!validServer(item.serverId)||current.busy?'disabled':''} title="${escape(title(item,current))}">${current.busy?'处理中…':current.collected?'已收藏':'收藏'}</button></div>`;}
 function itemFrom(node){return {taskId:node.dataset.productTask,serverId:node.dataset.productServer,detailEid:node.dataset.productEid,orderSn:node.dataset.productOrder,collected:node.dataset.productCollected==='1',collectedRoleId:node.dataset.productSourceRole||''};}
 function sync(){if(typeof document==='undefined')return;for(const node of document.querySelectorAll('.product-actions')){const item=sourceItem(itemFrom(node)),current=store.get(roleFor(item),item),button=node.querySelector('[data-product-action="collect"]');button.textContent=current.busy?'处理中…':current.collected?'已收藏':'收藏';button.disabled=!order(item)||!validServer(item.serverId)||current.busy;button.setAttribute('aria-pressed',String(current.collected));button.classList.toggle('collected',current.collected);button.title=title(item,current);}}
 function chooseRole(item,choices,stale){
  if(choosing)throw Error('请先完成当前的收藏角色选择');choosing=true;
  return new Promise(resolve=>{
   const previous=document.activeElement,dialog=document.createElement('dialog'),canRemember=typeof state==='object'&&state.tasks.some(t=>t.id===taskFor(item)?.id);dialog.className='modal collection-role-dialog';dialog.setAttribute('aria-labelledby','collection-role-title');
   dialog.innerHTML=`<div class="modal-head"><h2 id="collection-role-title">选择收藏角色</h2><button type="button" class="icon-button" data-collection-cancel aria-label="取消">×</button></div><p>${stale?'原收藏角色已失效，请选择本次使用的角色。':'选择本次操作使用的角色，可在任务设置中指定默认收藏角色。'}</p><div class="collection-role-options">${choices.map(role=>{const current=store.get(role.id,sourceItem(item));return `<button type="button" data-collection-role="${escape(role.id)}"><span>${escape(roleName(role.id))}</span><small>${current.collected?'已收藏 · 点击取消':'点击收藏'}</small></button>`;}).join('')}</div>${canRemember?'<label class="collection-role-default"><input type="checkbox" data-collection-default>设为任务默认收藏角色</label>':''}<div class="modal-actions"><button type="button" class="button secondary" data-collection-cancel>取消</button></div>`;
   const finish=id=>{choosing=false;dialog.close();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});resolve(id);};
   dialog.addEventListener('click',event=>{event.stopPropagation();const button=event.target.closest('button');if(!button)return;if(button.hasAttribute('data-collection-cancel'))finish('');else if(button.dataset.collectionRole)finish({roleId:button.dataset.collectionRole,makeDefault:dialog.querySelector?.('[data-collection-default]')?.checked===true});});
   dialog.addEventListener('cancel',event=>{event.preventDefault();finish('');});
   dialog.addEventListener('keydown',event=>{if(event.key==='Tab')event.stopPropagation();if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish('');}});
   document.body.appendChild(dialog);dialog.showModal();
  });
 }
 async function collect(item,{selectRole=chooseRole,send=input=>roleApi('item-collect',input)}={}){
  item=sourceItem(item);const configured=taskFor(item)?.collectionRoleId||'';
  let roleId=available(configured)?configured:'';
  if(!roleId){const choices=roles();if(!choices.length)throw Error('请先在角色管理中添加角色');const selection=await selectRole(item,choices,!!configured);roleId=typeof selection==='string'?selection:selection?.roleId;if(!roleId)return null;if(!available(roleId))throw Error('所选收藏角色已失效，请重新选择');if(selection?.makeDefault){if(typeof setTaskCollectionRole!=='function')throw Error('无法设置任务默认收藏角色');setTaskCollectionRole(taskFor(item)?.id,roleId);}}
  if(!available(roleId))throw Error('所选收藏角色已失效，请重新选择');
  lastRoles.set(itemKey(item),roleId);const pending=store.change(roleId,item,send);sync();try{return await pending;}finally{sync();}
 }
 async function copy(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}const active=document.activeElement,input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(input);input.select();try{if(!document.execCommand('copy'))throw Error('无法写入剪贴板，请检查权限');}finally{input.remove();active?.focus({preventScroll:true});}}
 if(typeof document!=='undefined')document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-product-action]');if(!button)return;event.preventDefault();event.stopPropagation();if(button.disabled)return;
  const item=itemFrom(button.closest('.product-actions'));
  try{
   if(button.dataset.productAction==='copy'){const url=shareUrl(item);if(!url)throw Error('商品链接信息不完整');await copy(url);toast('商品链接已复制');return;}
   const result=await collect(item);if(result)toast(result.collected?'已同步到藏宝阁收藏':'已取消藏宝阁收藏');
  }catch(error){toast(error.message);if(button.dataset.productAction==='collect'&&typeof loadRoles==='function')void loadRoles();}
 },true);
 return {render,shareUrl,order,createStore,sync,collect};
});
