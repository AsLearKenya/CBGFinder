(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProductActions=api;})(globalThis,function(){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validServer=value=>/^[1-9]\d{0,5}$/.test(String(value));
 function shareUrl(item){return validServer(item.serverId)&&/^\d{15}-\d+-[A-Za-z0-9]{1,40}$/.test(String(item.detailEid||''))?'https://xyq-m.cbg.163.com/cgi/mweb/equip/'+item.serverId+'/'+item.detailEid:'';}
 function order(item){return /^\d{1,10}_\d{1,16}_\d{1,20}$/.test(String(item.orderSn||''))?item.orderSn:'';}
 function createStore(){const states=new Map();const key=(roleId,item)=>JSON.stringify([roleId,String(item.serverId),order(item)]);return {get(roleId,item){return states.get(key(roleId,item))||{collected:!!item.collected,busy:false};},async change(roleId,item,send){const id=key(roleId,item),before=this.get(roleId,item);if(before.busy)return null;states.set(id,{...before,busy:true});try{const response=await send({roleId,serverId:item.serverId,orderSn:order(item),collected:!before.collected});if(response?.ok!==true||response.collected!==!before.collected)throw Error('官网未确认收藏状态');states.set(id,{collected:response.collected,busy:false});return response;}catch(error){states.set(id,{...before,busy:false});throw error;}}};}
 const store=createStore();
 const roleFor=item=>typeof state==='object'?(typeof valuationTaskById==='function'?valuationTaskById(item.taskId):state.tasks.find(t=>t.id===item.taskId))?.roleId||'':'';
 function render(item){const roleId=roleFor(item),current=store.get(roleId,item),link=shareUrl(item),sn=order(item);return `<div class="product-actions" data-product-task="${escape(item.taskId)}" data-product-server="${escape(item.serverId)}" data-product-eid="${escape(item.detailEid||'')}" data-product-order="${escape(sn)}" data-product-collected="${item.collected?'1':'0'}"><button type="button" data-product-action="copy" ${link?'':'disabled'} title="${link?'复制藏宝阁商品链接':'官网未返回完整商品编号'}">复制链接</button><button type="button" data-product-action="collect" aria-pressed="${current.collected}" class="${current.collected?'collected':''}" ${!sn||!validServer(item.serverId)||current.busy?'disabled':''} title="${sn?(current.collected?'点击取消藏宝阁收藏':'收藏到任务绑定角色的藏宝阁'):'官网未返回收藏所需的订单编号'}">${current.busy?'处理中…':current.collected?'已收藏':'收藏'}</button></div>`;}
 function itemFrom(node){return {taskId:node.dataset.productTask,serverId:node.dataset.productServer,detailEid:node.dataset.productEid,orderSn:node.dataset.productOrder,collected:node.dataset.productCollected==='1'};}
 function sync(){if(typeof document==='undefined')return;for(const node of document.querySelectorAll('.product-actions')){const item=itemFrom(node),current=store.get(roleFor(item),item),button=node.querySelector('[data-product-action="collect"]');button.textContent=current.busy?'处理中…':current.collected?'已收藏':'收藏';button.disabled=!order(item)||!validServer(item.serverId)||current.busy;button.setAttribute('aria-pressed',String(current.collected));button.classList.toggle('collected',current.collected);button.title=order(item)?(current.collected?'点击取消藏宝阁收藏':'收藏到任务绑定角色的藏宝阁'):'官网未返回收藏所需的订单编号';}}
 async function copy(text){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}const active=document.activeElement,input=document.createElement('textarea');input.value=text;input.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(input);input.select();try{if(!document.execCommand('copy'))throw Error('无法写入剪贴板，请检查权限');}finally{input.remove();active?.focus({preventScroll:true});}}
 if(typeof document!=='undefined')document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-product-action]');if(!button)return;event.preventDefault();event.stopPropagation();if(button.disabled)return;
  const item=itemFrom(button.closest('.product-actions'));
  try{
   if(button.dataset.productAction==='copy'){const url=shareUrl(item);if(!url)throw Error('商品链接信息不完整');await copy(url);toast('商品链接已复制');return;}
   const roleId=roleFor(item);if(!roleId)throw Error('任务绑定的角色不存在，请先绑定角色');
   const pending=store.change(roleId,item,input=>roleApi('item-collect',input));sync();
   try{const result=await pending;if(result){sync();toast(result.collected?'已同步到藏宝阁收藏':'已取消藏宝阁收藏');}}
   finally{sync();}
  }catch(error){toast(error.message);if(button.dataset.productAction==='collect'&&typeof loadRoles==='function')void loadRoles();}
 },true);
 return {render,shareUrl,order,createStore,sync};
});
