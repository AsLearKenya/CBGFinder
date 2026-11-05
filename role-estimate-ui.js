/* Fetch each discovered role detail through the shared cache, then evaluate locally. */
let roleValuationSettings=RoleValuation.defaults(),roleValuationSettingsError='',valuationCategory='equipment';
try{roleValuationSettings=RoleValuation.load(localStorage);}catch(error){roleValuationSettingsError='角色估价设置读取失败：'+error.message;}
const roleEstimateRecords=new Map(),roleDetailQueues=new WeakMap();
function roleEstimateSignature(task){return JSON.stringify([RoleValuation.VERSION,task.resultRevision||'',task.roleId,task.roleFilters,task.valuationEnabled===true,roleValuationSettings]);}
function roleValuationTabs(){return `<div class="valuation-category-tabs" role="tablist" aria-label="估价品类"><button type="button" role="tab" data-valuation-category="equipment" aria-selected="${valuationCategory==='equipment'}">装备</button><button type="button" role="tab" data-valuation-category="lingshi" aria-selected="${valuationCategory==='lingshi'}">灵饰</button><button type="button" role="tab" data-valuation-category="yupo" aria-selected="${valuationCategory==='yupo'}">上古玉魄</button><button type="button" role="tab" data-valuation-category="petEquipment" aria-selected="${valuationCategory==='petEquipment'}">召唤兽装备</button><button type="button" role="tab" data-valuation-category="role" aria-selected="${valuationCategory==='role'}">角色</button></div>`;}
function roleValuationSettingsView(){return heading('估价设置','')+roleValuationTabs()+`<h2 class="valuation-category-title">角色估价设置</h2>${roleValuationSettingsError?`<p class="error">${esc(roleValuationSettingsError)}</p>`:''}`+roleCosmeticSettingsView();}
async function loadRoleEstimates(){for(const task of state.tasks.filter(t=>t.category==='角色'&&t.valuationEnabled)){try{const r=await equipmentEstimateStorage.get('role:'+task.id);if(r?.signature===roleEstimateSignature(task)&&!roleEstimateRecords.has(task.id))roleEstimateRecords.set(task.id,{...r,running:false,restored:true,error:r.running?'上次估价中断，可对现有结果重新估价':r.error});}catch(error){toast('角色估价记录读取失败：'+error.message);}}}
function clearRoleEstimate(id){if(typeof cancelRoleCarriedValuations==='function')cancelRoleCarriedValuations(id);const run=state.taskRuns?.[id];if(run)roleDetailQueues.delete(run);roleEstimateRecords.delete(id);void equipmentEstimateStorage.remove('role:'+id).catch(error=>toast('角色估价记录清除失败：'+error.message));}
function roleEstimateOptions(task){return `<div class="equipment-estimate-options"><label class="task-start-option"><span><strong>角色估价</strong><small>角色在视窗内停留片刻后读取详情并估价；快速滚过不请求，已加载详情直接复用。</small></span><input type="checkbox" role="switch" aria-label="角色估价" data-valuation-task="${esc(task.id)}" data-valuation-field="valuationEnabled" ${task.valuationEnabled?'checked':''} ${busy.has(task.id)?'disabled':''}></label></div>`;}
function roleEstimateView(task){return `<section class="panel equipment-valuation-panel"><div class="valuation-panel-heading"><h2>角色估价${task.valuationEnabled?'':'未开启'}</h2><button type="button" class="text-button" data-role-valuation-settings>估价设置</button></div><p>角色在视窗内连续停留0.6秒后加载详情并估价；快速滚过不请求，完成一件即展示一件。</p>${roleEstimateRecords.get(task.id)?.error?`<p class="error">${esc(roleEstimateRecords.get(task.id).error)}</p>`:''}${task.valuationEnabled?`<button type="button" class="button secondary" data-role-revalue="${esc(task.id)}">估价现有结果</button>`:''}</section>`;}
function roleValuationItems(taskId,run=state.taskRuns?.[taskId]){const changes=typeof changeRows==='function'?changeRows(taskId).map(row=>row.item):[];return [...new Set([...(run?.items||[]),...changes])].filter(item=>item?.kind==='role');}
function roleValuationRow(taskId,id){const task=valuationTaskById(taskId),r=roleEstimateRecords.get(taskId),row=task?.category==='角色'&&task.valuationEnabled&&r?.signature===roleEstimateSignature(task)?r.items?.find(row=>row.targetId===id):null;if(row&&typeof applyRoleCarriedValue==='function')applyRoleCarriedValue(row);return row;}
function roleInlineValuation(item){const task=valuationTaskById(item.taskId);if(!task?.valuationEnabled||task.category!=='角色')return '';const row=roleValuationRow(item.taskId,item.id),r=roleEstimateRecords.get(item.taskId);return `<div class="listing-estimate role-listing-estimate" data-change-key="role-estimate:${esc(item.id)}"><strong class="${row?.result?.estimateCents==null?'is-unestimated':row.result.rough?'is-rough':''}">${row?.loading?'正在读取详情…':!item.roleValuationDetailLoaded&&!row?.detailLoaded?'待加载详情':row?.result?.estimateCents!=null?(row.result.rough?'粗略估价 ':'角色估价 ')+valuationAmount(row.result.estimateCents):row?.error?'暂缺估价':row?'基础资料不足':'待估价'}</strong>${row&&typeof roleCarriedNotice==='function'?roleCarriedNotice(item,row):''}${row?`<button type="button" data-role-valuation-task="${esc(item.taskId)}" data-role-valuation-item="${esc(item.id)}">估价明细</button>`:''}</div>`;}
function roleValuationDetailHtml(row){const r=row.result;if(!r)return `<p class="error">${esc(row.error||'详情读取失败')}</p>`;const cash=v=>valuationAmount(v);return `<div class="valuation-evidence-total"><div><span>${r.rough?'粗略估价':'角色估价'}</span><strong class="${r.estimateCents==null?'is-unestimated':r.rough?'is-rough':''}">${r.estimateCents==null?'基础资料不足':cash(r.estimateCents)}</strong></div></div><p class="setting-help">角色底子、外观与携带物分别计价；携带物需手动估价，单件估价低于50元不计入。召唤兽和其他道具不计价。</p><div class="role-valuation-split"><span>角色底子 <b>${r.roleBaseCents==null?'未确定':cash(r.roleBaseCents)}</b></span><span>锦衣祥瑞及外观 <b>${cash(r.cosmeticsCents||0)}</b></span></div>${typeof roleCarriedBreakdownHtml==='function'?roleCarriedBreakdownHtml(row):''}<h3>角色底子明细</h3><div class="role-valuation-totals"><span>扣款前合计 <b>${cash(r.subtotalCents)}</b></span><span class="is-deduction">理论扣款 <b>${cash(r.theoreticalDeductionCents)}</b></span><span>保护免扣 <b>${cash(r.protectedCents)}</b></span><span class="is-deduction">实际扣款 <b>${cash(r.actualDeductionCents)}</b></span></div><div class="role-valuation-table-wrap"><table class="role-valuation-table"><thead><tr><th>项目</th><th>实际数据</th><th>计价规则</th><th>金额</th></tr></thead><tbody>${r.rows.map(x=>`<tr class="${x.amountCents<0?'is-deduction':x.status==='unpriced'||x.amountCents===0?'is-unpriced':''}"><th scope="row">${esc(x.label)}</th><td>${esc(x.value)}</td><td>${esc(x.rule)}</td><td>${x.status==='unpriced'?'未计入':x.amountCents<0?`<span>理论 −${cash(-x.amountCents)}</span><small>实际 −${cash(x.actualDeductionCents||0)}</small>`:(x.amountCents>0?'+':'')+cash(x.amountCents)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="3">底子估价＝扣款前合计−实际扣款</th><td>${r.roleBaseCents==null?'未确定':cash(r.roleBaseCents)}</td></tr></tfoot></table></div>${roleCosmeticBreakdownHtml(r.cosmeticsBreakdown)}${r.warnings.length?`<div class="role-valuation-warnings"><strong>本次估价未覆盖／推算项</strong><ul>${r.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<p class="setting-help">扣款按清单顺序抵扣，合计不超过“扣款前总值−1000元”；原值不足1000元时不扣，不会将原值抬高。</p>`;}
function openRoleValuation(taskId,id,{carried=false,index}={}){const row=roleValuationRow(taskId,id);if(!row){toast('请先对当前结果估价');return;}const item=roleValuationItems(taskId,valuationRunById(taskId)).find(i=>i.id===id);openModal(`<div class="modal-head"><h2 id="dialog-title">${esc(row.name)} · 角色估价明细</h2><div class="role-valuation-actions">${item?ProductActions.render({...item,taskId}):''}<button type="button" class="button secondary" data-role-image-task="${esc(taskId)}" data-role-image-item="${esc(id)}">生成图片</button><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div></div>${roleValuationDetailHtml(row)}`,'valuation-evidence-modal role-valuation-modal');if(carried){const modal=document.querySelector('.role-valuation-modal'),selector=/^\d+$/.test(String(index))?'[data-role-carried-row="'+Number(index)+'"]':'[data-role-carried-section]',target=modal?.querySelector?.(selector);target?.scrollIntoView?.({block:'start',behavior:'auto'});target?.focus?.({preventScroll:true});}}
function updateRoleValuation(task,run,items=roleValuationItems(task.id,run)){
 if(task.category!=='角色'||!task.valuationEnabled||run.retired||!state.tasks.some(t=>t.id===task.id&&roleEstimateSignature(t)===roleEstimateSignature(task)))return;
 const signature=roleEstimateSignature(task);let record=roleEstimateRecords.get(task.id);
 const reusable=record&&(run.restored||record.runId===run.runId)?new Map(record.items.map(r=>[r.targetId,r])):new Map();
 if(!record||record.signature!==signature||record.runId!==run.runId)record={taskId:'role:'+task.id,signature,runId:run.runId,items:[],at:Date.now(),running:false,error:''};
 const rows=new Map(record.items.map(r=>[r.targetId,r]));
 for(const item of items.filter(i=>i.kind==='role')){
  const saved=reusable.get(item.id);
  if(!item.roleValuationDetailLoaded&&saved?.detailLoaded&&saved.detailVersion===RoleValuation.VERSION){item.roleValuationData=saved.data;item.roleValuationDetailLoaded=true;item.roleValuationDetailVersion=saved.detailVersion;}
  const data=item.roleValuationData||{};rows.set(item.id,{targetId:item.id,name:item.name,serverId:item.serverId,detailLoaded:item.roleValuationDetailLoaded===true,detailVersion:item.roleValuationDetailVersion,reportDetails:item.roleReportDetails||saved?.reportDetails,carried:saved?.carried,data,result:RoleValuation.evaluate(data,{serverId:item.serverId},roleValuationSettings)});
 }
 record.items=[...rows.values()];record.done=record.total=record.items.length;roleEstimateRecords.set(task.id,record);
 void equipmentEstimateStorage.put(record).catch(error=>{record.error='估价记录保存失败：'+error.message;});return record;
}
function recordRoleValuationDetail(taskId,eid,serverId,detail,expectedTask){
 const task=state.tasks.find(t=>t.id===taskId),run=state.taskRuns?.[taskId],data=detail.roleInfo?.valuationData;
 if(!task||!run||run.retired||!data||expectedTask&&roleEstimateSignature(task)!==roleEstimateSignature(expectedTask))return;
 const matches=roleValuationItems(taskId,run).filter(i=>String(i.detailEid)===String(eid)&&String(i.serverId)===String(serverId));
 let changed=false;for(const item of matches){const before=JSON.stringify(item.roleValuationData),beforeReport=JSON.stringify(item.roleReportDetails);const merged={...item.roleValuationData};for(const [key,value] of Object.entries(data))if(value!=null)merged[key]=value;item.roleValuationData=merged;item.roleValuationDetailLoaded=true;item.roleValuationDetailVersion=RoleValuation.VERSION;if(typeof RoleValuationImage==='object')item.roleReportDetails=RoleValuationImage.snapshot(detail,item);if(before!==JSON.stringify(merged)||beforeReport!==JSON.stringify(item.roleReportDetails)||!roleValuationRow(taskId,item.id)?.detailLoaded)changed=true;}
 if(changed){updateRoleValuation(task,run,matches);render();}
}
function queueRoleValuationDetails(task,run,items=run.items||[],signal=searchControllers.get(task.id)?.signal,{canLoad=()=>true}={}){
 if(task.category!=='角色'||!task.valuationEnabled||run.retired||signal?.aborted)return Promise.resolve();
 updateRoleValuation(task,run,items);
 let queue=roleDetailQueues.get(run);if(!queue){queue={tail:Promise.resolve(),seen:new Set(),blocked:false};roleDetailQueues.set(run,queue);}
 const signature=roleEstimateSignature(task),active=()=>!run.retired&&!signal?.aborted&&state.taskRuns?.[task.id]===run&&state.tasks.some(t=>t.id===task.id&&roleEstimateSignature(t)===signature);
 for(const item of items.filter(i=>i.kind==='role')){
  if(item.roleValuationDetailLoaded&&item.roleValuationDetailVersion===RoleValuation.VERSION||queue.seen.has(item.id)||queue.blocked)continue;
  queue.seen.add(item.id);
  const row=roleValuationRow(task.id,item.id);if(row)row.loading=true;
  queue.tail=queue.tail.then(async()=>{
   if(!active()||queue.blocked||!canLoad()){queue.seen.delete(item.id);const pending=roleValuationRow(task.id,item.id);if(pending)pending.loading=false;return;}
   try{
    if(!item.detailEid||!item.serverId)throw Error('官网未提供角色详情编号');
    const detail=await EquipmentDisclosure.loadDetail({roleId:task.roleId,serverId:String(item.serverId),eid:item.detailEid});
    if(!active())return;
    if(!detail.roleInfo?.valuationData)throw Error('角色详情未提供估价数据');
    recordRoleValuationDetail(task.id,item.detailEid,item.serverId,detail,task);
    updateRoleValuation(task,run,[item]);
   }catch(error){
    if(!active())return;
    queue.seen.delete(item.id);
    const record=roleEstimateRecords.get(task.id),row=roleValuationRow(task.id,item.id);
    if(row){row.loading=false;row.error=error.message;}
    if(record){record.error=error.message;void equipmentEstimateStorage.put(record).catch(()=>{});}
    if(/验证码|验证|AUTH|登录|系统繁忙|请求过于频繁/.test(error.message)){
     queue.blocked=true;
     for(const peer of state.tasks.filter(t=>t.roleId===task.roleId)){peer.lastError=error.message;peer.nextRunAt=null;}
    }
   }finally{const row=roleValuationRow(task.id,item.id);if(row)row.loading=false;if(active())render();}
  });
 }
 return queue.tail;
}
function requestVisibleRoleValuation(taskId,eid,serverId,{canLoad=()=>true}={}){
 const task=state.tasks.find(t=>t.id===taskId),run=state.taskRuns?.[taskId];
 if(!task?.valuationEnabled||task.category!=='角色'||!run||run.retired)return;
 const items=roleValuationItems(taskId,run).filter(i=>String(i.detailEid)===String(eid)&&String(i.serverId)===String(serverId));
 void queueRoleValuationDetails(task,run,items,undefined,{canLoad});
}
async function runRoleValuation(task,run,signal){if(signal?.aborted||run.retired)return;updateRoleValuation(task,run);render();}
async function revalueRoleResults(id){
 const task=state.tasks.find(t=>t.id===id),run=state.taskRuns?.[id];if(!task?.valuationEnabled||!run){toast('请先开启角色估价并搜索');return;}
 roleDetailQueues.delete(run);updateRoleValuation(task,run);render();
}
document.addEventListener('click',event=>{const el=event.target.closest('button');if(!el)return;if(el.dataset.roleValuationTask){event.preventDefault();event.stopPropagation();openRoleValuation(el.dataset.roleValuationTask,el.dataset.roleValuationItem);}else if(el.hasAttribute('data-role-revalue'))void revalueRoleResults(el.dataset.roleRevalue);else if(el.hasAttribute('data-role-valuation-settings')){valuationCategory='role';page='valuation-settings';render();}else if(['equipment','lingshi','yupo','role','petEquipment'].includes(el.dataset.valuationCategory)){valuationCategory=el.dataset.valuationCategory;render();}});

