/* Link estimates live outside saved tasks and their search/change history. */
const linkValuationState={url:'',roleId:'',running:false,error:'',stage:'',task:null,run:null,detail:null,controller:null};
function valuationTaskById(id){return state.tasks.find(t=>t.id===id)||(typeof roleCarriedTasks!=='undefined'?roleCarriedTasks.get(id):null)||(linkValuationState.task?.id===id?linkValuationState.task:null);}
function valuationRunById(id){return state.taskRuns?.[id]||(linkValuationState.task?.id===id?linkValuationState.run:null);}
function valuationSettingsPage(){return `<div class="valuation-subnav"><button type="button" class="text-button" data-page="valuation">${icon('arrow')} 返回估价</button></div>`+valuationSettingsView();}
function linkValuationView(){
 const s=linkValuationState,roles=(availableRoles||[]).filter(role=>!role.collectionOnly),task=s.task,item=s.run?.items?.[0];
 const card=item?`<section class="panel link-valuation-result"><div class="link-valuation-result-head"><div><h2>${esc(item.name)} <small>${task.category==='上古玉魄'?'':esc(item.level)+'级 · '}${esc(task.category)}</small></h2><p>${esc([item.area,item.server].filter(Boolean).join(' · '))} <strong>挂牌 ${valuationAmount(Math.round(item.price*100))}</strong></p></div>${ProductActions.render(item)}</div>${task.category==='角色'?roleInlineValuation(item):equipmentInlineValuation(item)}<details class="link-valuation-detail"><summary>商品详情</summary><div data-link-item-detail="${esc(item.id)}">${EquipmentDisclosure.renderDetail(s.detail)}</div></details></section>`:'';
 return heading('估价','',`<button type="button" class="button secondary" data-page="valuation-settings">估价设置</button>`)+`<section class="panel link-valuation-panel"><form id="link-valuation-form"><label class="link-valuation-url"><span>藏宝阁商品详情链接</span><input type="url" name="url" value="${esc(s.url)}" required placeholder="粘贴装备、灵饰、上古玉魄、召唤兽装备或角色的藏宝阁详情链接" ${s.running?'disabled':''}></label><div class="link-valuation-controls"><button type="submit" class="button primary" ${s.running||!roles.length?'disabled':''}>${s.running?'估价中…':'开始估价'}</button>${s.running?'<button type="button" class="button secondary" data-link-valuation-cancel>停止</button>':''}</div><p class="setting-help">支持装备、灵饰、上古玉魄、召唤兽装备和角色。角色读取详情后直接估价；装备、灵饰和上古玉魄沿用全服样本及折价规则，自动使用可用的已登录角色；优先使用商品同服角色。法系武器对比初伤，物理武器对比初总伤。</p>${!roles.length?'<button type="button" class="text-button" data-page="roles">登录角色</button>':''}${s.stage?`<p class="setting-help" role="status">${esc(s.stage)}</p>`:''}${s.error?`<p class="error" role="alert">${esc(s.error)}</p>${/验证|MIBAO_AUTH|OTP_AUTH|登录|会话/.test(s.error)?'<button type="button" class="text-button" data-page="roles">前往角色管理处理验证</button>':''}`:''}</form></section>${card}`;
}
async function estimateListingLink(fields,{refreshToken}={}){
 const s=linkValuationState;if(s.running)return;
 s.url=String(fields.url||'').trim();s.error='';
 let identity;try{identity=LinkValuation.parseLink(s.url);const usable=availableRoles.filter(r=>!r.collectionOnly&&(!r.status||r.status==='ready')&&!r.requestQueue?.blocked);const role=usable.find(r=>refreshToken&&r.id===s.task?.roleId)||usable.find(r=>String(r.server?.id)===identity.serverId)||usable[0];if(!role&&availableRoles.length&&!availableRoles.some(r=>!r.collectionOnly))throw Error('仅收藏角色不能用于估价，请添加搜索角色');if(!role)throw Error(availableRoles.length?'没有可用角色会话，请前往角色管理完成登录或验证':'请先登录角色');s.roleId=role.id;}catch(error){s.error=error.message;render();return;}
 const old=s.task;if(old){equipmentEstimateRecords.delete(old.id);roleEstimateRecords.delete(old.id);}
 const controller=new AbortController();s.controller=controller;s.running=true;s.stage='正在读取商品详情…';s.task=null;s.run=null;s.detail=null;render();
 try{
  const detail=await EquipmentDisclosure.loadDetail({roleId:s.roleId,...identity});controller.signal.throwIfAborted();
  if(!['装备','角色','灵饰','上古玉魄','召唤兽装备'].includes(detail.category))throw Error('目前支持装备、灵饰、上古玉魄、召唤兽装备和角色估价');
  const task={id:'link-estimate:'+crypto.randomUUID(),name:'链接估价',category:detail.category,roleId:s.roleId,valuationEnabled:true,servers:[],equipmentFilters:{},roleFilters:{},lingshiFilters:{},yupoFilters:{},petEquipmentFilters:{}};
  const item=LinkValuation.item(detail,identity,{taskId:task.id,config:autoSearchConfig||{},serverName:valuationServerName(identity.serverId)});
  task.equipmentFilters=detail.category==='装备'?LinkValuation.filters(item):{};s.task=task;s.run={items:[item]};s.detail=detail;
  if(detail.category==='角色'){
   if(!detail.roleInfo?.valuationData)throw Error('角色详情未提供估价数据');
   const data=detail.roleInfo.valuationData,row={targetId:item.id,name:item.name,serverId:item.serverId,serverName:item.server,detailLoaded:true,data,reportDetails:RoleValuationImage.snapshot(detail,item),result:RoleValuation.evaluate(data,{},roleValuationSettings)};
   roleEstimateRecords.set(task.id,{signature:roleEstimateSignature(task),items:[row]});s.stage='角色估价完成';
  }else{
   if(equipmentValuationSkipReason(task,item)){equipmentEstimateRecords.set(task.id,{signature:equipmentEstimateSignature(task),results:[{group:{kindId:item.equipmentKindId,level:Number(item.level)},items:[{target:item,count:0,skipped:true,estimateCents:null,error:equipmentValuationSkipReason(task,item)}]}]});s.stage=equipmentValuationSkipReason(task,item);return;}
   if(valuationSettingsError)throw Error(valuationSettingsError);
   s.stage='正在等待本服材料报价…';render();await loadMaterialPrices();controller.signal.throwIfAborted();
   const group=equipmentValuationRules(task).groups(task,[item])[0];if(!group)throw Error('当前装备类型或等级不支持估价');
   s.stage='正在全服查找相近样本… · 宝石按'+(availableRoles.find(r=>r.id===task.roleId)?.server?.name||'绑定角色所在服')+'材料价格计价';const record={signature:equipmentEstimateSignature(task),results:[],running:true};equipmentEstimateRecords.set(task.id,record);render();
   const response=await fetch(equipmentValuationEndpoint(task),{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/x-ndjson'},body:JSON.stringify({task,group,seedRows:[item],settings:valuationSettings,...(refreshToken?{refreshToken}:{})}),signal:controller.signal});
   const result=await readEquipmentValuationResponse(response,partial=>{record.results=[partial];render();},controller.signal);controller.signal.throwIfAborted();
   if(!response.ok)throw Error(result.message||task.category+'估价失败');record.results=[result];record.running=false;
   s.stage=result.items?.[0]?.estimateCents!=null?task.category+'估价完成':'估价结束，暂无可用参考价';
   if(result.items?.[0]?.error)s.error=result.items[0].error;else if(result.warnings?.length)s.error=result.warnings.join('；');
  }
 }catch(error){s.error=controller.signal.aborted?'估价已停止':error.message;s.stage='';}
 finally{s.running=false;s.controller=null;if(s.task){const record=equipmentEstimateRecords.get(s.task.id);if(record)record.running=false;}render();}
}
document.addEventListener('submit',event=>{if(event.target.id!=='link-valuation-form')return;event.preventDefault();void estimateListingLink(Object.fromEntries(new FormData(event.target)));});
document.addEventListener('input',event=>{if(event.target.closest?.('#link-valuation-form')&&event.target.name==='url')linkValuationState.url=event.target.value;});

document.addEventListener('click',event=>{if(event.target.closest('[data-link-valuation-cancel]'))linkValuationState.controller?.abort();});
