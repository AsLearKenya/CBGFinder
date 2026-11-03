/* Desktop UI. Server choices are loaded from the official server list on every page load. */
const paths = {
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
 box:'<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5.5l9 5"/>',
 bell:'<path d="M5 16h14l-2-3V9a5 5 0 0 0-10 0v4zM10 20h4"/>',
 settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="m9 5 7 7-7 7"/>',
 play:'<path d="m8 5 11 7-11 7z"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 edit:'<path d="m14 5 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
 sword:'<path d="m18 2 4 0 0 4-12 12-4-4zM5 13l6 6M3 21l4-4M2 18l4 4M10 14 20 4"/>',
 armor:'<path d="m8 3-5 4 3 5 2-1v10h8V11l2 1 3-5-5-4c0 4-8 4-8 0zM9 12h6M9 16h6"/>',
 helmet:'<path d="M4 14V10a8 8 0 0 1 16 0v4M4 11l8 3 8-3v7l-5 3v-6h-6v6l-5-3zM12 3v7"/>',
 necklace:'<path d="M5 4c-1 8 1 12 7 14 6-2 8-6 7-14M12 14l4 4-4 4-4-4z"/>',
 belt:'<path d="M3 8h18v9H3zM9 6h6v13H9zM12 10v5M3 12h6m6 0h6"/>',
 boots:'<path d="M8 3h10v10l3 4v4H4a2 2 0 0 1-2-2v-3l6-3zM8 7h10M3 17h17"/>',
 ring:'<circle cx="12" cy="15" r="7"/><path d="m8 3 4-2 4 2-4 6zM8 3l4 6 4-6"/>',
 earring:'<path d="M14 5a3 3 0 0 0-6 0c0 3 6 4 6 7M14 11c-7-1-10 7-4 10s12-5 4-10z"/>',
 bracelet:'<ellipse cx="12" cy="13" rx="9" ry="8"/><ellipse cx="12" cy="13" rx="5" ry="4"/><path d="M9 5l1 4m5-4-1 4M3 12l4 1m10 0 4-1"/>',
 pendant:'<path d="M7 3h10l-2 5H9zM9 8l-4 7 7 7 7-7-4-7M12 11l3 4-3 4-3-4z"/>',
 jade:'<path d="M16 3c5 3 6 10 2 15s-11 4-14-1c4 1 8-1 9-5s0-7-3-9z"/><circle cx="16" cy="8" r="1.5"/>',
 equipment:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 pet:'<path d="m5 10-2-7 7 4M19 10l2-7-7 4M5 10c-3 5 0 11 7 11s10-6 7-11c-2-5-12-5-14 0zM8 13h1m6 0h1m-6 4 2 1 2-1"/>',
 role:'<path d="M7 8c0-7 10-7 10 0v3c0 7-10 7-10 0zM5 22c0-8 14-8 14 0M8 6l9 3M12 2l2-1"/>',
 shield:'<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 trend:'<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
 leaf:'<path d="M20 3C5 1 1 14 8 18c7 4 13-3 12-15zM4 22 16 9"/>',
 refresh:'<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.box}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => Number(value).toLocaleString('zh-CN');
const time = value => value ? new Date(value).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit',hour12:false}) : '尚未执行';
const dateTime = value => new Date(value).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function initialState(){return {tasks:[],results:[],taskRuns:{},logs:[],requestLogs:[],notifications:false};}
let editorServerKeys=new Set(),taskDraft=null,taskRoleReturn=null;
function captureTaskDraft(){
 const form=document.querySelector('#task-form');if(!form)return;
 const data=Object.fromEntries(new FormData(form));
 taskDraft={...taskDraft,name:data.name,interval:data.interval,category:data.category,roleId:data.roleId,startImmediately:data.startImmediately==='on'};
}
function openServerPage(){
 if(serverPageOpen&&serverPickerContext.presentation==='dropdown'){ServerPicker.close(false);return;}
 captureTaskDraft();ServerPicker.open({selected:editorServerKeys,multiple:true,presentation:'dropdown',returnLabel:'返回任务设置',onConfirm:keys=>{editorServerKeys=keys;renderTaskEditor();document.querySelector('#choose-servers')?.focus();}});
}
function serverNames(task){return (task.servers||[]).map(server=>server.name).join('、')||'全服';}
let selectedTaskId=null;
let state, page='home', taskFilter='all', taskRoleFilter='all', resultFilter='all', logTaskFilter='all', logRoleFilter='all', query='', busy=new Set(), toastTimer;
const navs=[['home','grid','首页'],['tasks','box','任务列表'],['roles','role','角色管理'],['logs','clock','运行记录'],['valuation','trend','估价'],['materials','box','材料价格'],['settings','settings','系统设置']];
let taskStorageError='',taskStorageBlocked=false,schedulerStartupReady=false;
const startupActivity={pending:new Set(),checking:false,error:''};
let backgroundRenderTimer=null;
function scheduleRender(){if(backgroundRenderTimer!==null)return;backgroundRenderTimer=setTimeout(()=>{backgroundRenderTimer=null;render();},120);}
function currentActivity(){
 const messages=[];if(startupActivity.pending.size)messages.push('正在恢复：'+[...startupActivity.pending].join('、'));
 if(startupActivity.checking)messages.push('正在检查上次的账号验证状态');
 if(startupActivity.error)messages.push(startupActivity.error);
 if(typeof materialPriceState!=='undefined'&&materialPriceState.loading)messages.push('正在加载材料报价，估价等待报价完成');
 const runs=Object.values(state?.taskRuns||{}),searching=runs.filter(r=>r.running),valuing=runs.filter(r=>r.valuationRunning);
 if(searching.length){const run=searching[0],request=[...(run.records||[])].reverse().find(r=>!r.finished);messages.push('正在搜索 '+searching.length+' 个任务'+(request?' · '+run.taskName+' · '+request.serverName+'第 '+request.page+' 页':''));}
 if(valuing.length)messages.push('正在估价 '+valuing.length+' 个任务');
 if(!messages.length&&schedulerStartupReady){const waiting=state.tasks.filter(t=>t.enabled&&(taskNeedsVerification(t)||taskNeedsAccountSecurity(t))).length;if(waiting)messages.push(waiting+' 个任务等待账号验证');}
 return messages.join('；');
}
function updateActivityStatus(){const node=document.querySelector('#activity-status'),text=document.querySelector('#activity-status-text');if(!node||!text)return;const message=currentActivity();node.hidden=!message;if(text.textContent!==message){text.textContent=message;text.setAttribute('title',message);}}

function persist(tasks=state.tasks){
 try{
  if(taskStorageBlocked)throw new Error('原任务存档无法读取，为避免覆盖已停止写入');
  TaskStorage.save(localStorage,tasks);taskStorageError='';
 }catch(error){taskStorageError=error.message;throw error;}
}
function schedulerChanged(){
 try{persist();}catch(error){toast(`任务未能保存：${error.message}`);}
 render();
}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200)}
const taskScheduler=TaskScheduler.create({getTasks:()=>state.tasks,execute:runEquipmentOnce,isBlocked:task=>taskNeedsVerification(task)||taskNeedsAccountSecurity(task),onChange:schedulerChanged,onError:error=>toast(error.message),onSkip:(id,source)=>{const task=state.tasks.find(t=>t.id===id);if(!task)return;state.logs.unshift({id:uid(),taskId:id,roleId:task.roleId,name:task.name,source,at:Date.now(),count:0,status:'skipped',message:'上一次搜索尚未完成，已跳过本次搜索'});render();}});
async function runTask(id){await taskScheduler.run(id)}
function taskCountdown(task){
 if(taskNeedsAccountSecurity(task))return '需处理账号安全状态';
 if(taskNeedsVerification(task))return '等待官网验证';
 if(state.taskRuns?.[task.id]?.valuationRunning)return '估价中…';
 if(taskScheduler.isRunning(task.id))return availableRoles.some(role=>role.id===task.roleId&&role.refreshing)?'等待Cookie刷新':'搜索中…';
 if(!task.enabled)return '未启动';
 if(!task.nextRunAt)return '等待安排';
 const seconds=Math.max(0,Math.ceil((task.nextRunAt-Date.now())/1000));
 return seconds?`下次搜索 ${Math.floor(seconds/60)} 分 ${String(seconds%60).padStart(2,'0')} 秒`:'等待执行';
}
function checkSlowSearches(now=Date.now()){
 for(const run of Object.values(state.taskRuns||{}))if(run.running&&Number.isFinite(run.startedAt)&&now-run.startedAt>=RunLogs.SLOW_MS&&!run.slowWarned){run.slowWarned=true;toast(`「${run.taskName}」已搜索超过 2 分钟，建议细化筛选条件或拆分服务器范围。`);}
 document.querySelectorAll('[data-valuation-duration]').forEach(node=>{const run=state.taskRuns?.[node.dataset.valuationDuration];if(run?.valuationRunning)node.textContent=RunLogs.duration(now-run.valuationStartedAt);});
 document.querySelectorAll('[data-run-duration]').forEach(node=>{const run=Object.values(state.taskRuns||{}).find(run=>run.runId===node.dataset.runDuration);if(run?.running)node.textContent=RunLogs.duration(now-run.startedAt);});
}
function updateTaskCountdowns(){
 updateActivityStatus();checkSlowSearches();
 document.querySelectorAll('[data-countdown-task]').forEach(node=>{
  const task=state.tasks.find(task=>task.id===node.dataset.countdownTask);
  if(task)node.textContent=taskCountdown(task);
 });
}
let renderedPageKey='',renderedNavHtml='';
const systemNotificationPreferences=TaskNotifications.preferences(localStorage,'cbg:system-notifications:v1',true);
let nativeNotificationStatus={state:'unknown',message:'尚未测试系统通知；应用内开关不代表系统已授权。'},nativeNotificationTesting=false;
function areChangeNotificationsEnabled(id){return state.tasks.find(task=>task.id===id)?.changeNotifications===true;}
function systemNotificationsEnabled(){return systemNotificationPreferences.enabled&&(Boolean(window.desktopNotifications)||(typeof Notification!=='undefined'&&Notification.permission==='granted'));}
function taskNotificationButton(task){const enabled=areChangeNotificationsEnabled(task.id);return `<button type="button" class="task-notification-button ${enabled?'enabled':''}" data-action="toggle-task-notifications" data-task-id="${esc(task.id)}" aria-pressed="${enabled}" title="设置此任务的商品变化通知">${icon('bell')}商品变化通知：${enabled?'开':'关'}</button>`;}
function toggleTaskNotifications(id){const task=state.tasks.find(task=>task.id===id);if(!task)return;const enabled=!areChangeNotificationsEnabled(id),tasks=state.tasks.map(item=>item.id===id?{...item,changeNotifications:enabled}:item);persist(tasks);state.tasks=tasks;render();toast(enabled?(systemNotificationsEnabled()?'此任务的商品变化通知已开启':'此任务的商品变化通知已开启，请在系统设置中开启系统通知'):'此任务的商品变化通知已关闭，未读徽标仍会显示');}
async function toggleSystemNotifications(){
 if(systemNotificationsEnabled()){systemNotificationPreferences.set(false);render();toast('系统通知已关闭');return;}
 if(!window.desktopNotifications){if(typeof Notification==='undefined'){toast('当前浏览器不支持系统通知，请使用桌面版');return;}if(await Notification.requestPermission()!=='granted'){toast('未获得通知权限，请在浏览器设置中允许通知');render();return;}}
 systemNotificationPreferences.set(true);verificationNotifications?.reset();render();toast(window.desktopNotifications?'应用内通知开关已开启，请发送测试通知确认系统状态':'系统通知已开启');
}
function settingsView(){const enabled=systemNotificationsEnabled();return heading('系统设置','')+(typeof storageSettingsView==='function'?storageSettingsView():'')+`<section class="panel"><div class="panel-header"><div class="panel-title">通知</div></div><div class="settings-body"><div class="setting-row"><div><strong>系统通知</strong><p>控制程序是否向系统发送提醒；显示权限由操作系统单独管理。</p></div><button class="button secondary" data-action="toggle-system-notifications" aria-pressed="${enabled}">${enabled?'关闭系统通知':'开启系统通知'}</button></div>${window.desktopNotifications?`<div class="setting-row"><div><strong>通知通道：${esc(({unknown:'未测试',shown:'系统已确认显示',failed:'发送失败',unsupported:'不支持',unconfirmed:'未确认'})[nativeNotificationStatus.state]||'未测试')}</strong><p role="status">${esc(nativeNotificationStatus.message)}${nativeNotificationStatus.detail?' '+esc(nativeNotificationStatus.detail):''}</p></div><button class="button secondary" data-action="test-system-notification" ${!enabled||nativeNotificationTesting?'disabled':''}>${nativeNotificationTesting?'测试中…':'发送测试通知'}</button></div>`:''}<div class="notification-description"><p>开启后会收到以下通知：</p><ul><li><strong>任务需要安全验证：</strong>搜索暂停并等待验证时提醒，点击通知可打开对应任务。</li><li><strong>商品变化：</strong>商品上新、价格变化或消失时提醒。请在每个任务中单独开启“商品变化通知”。消失商品会查询下架或售出状态，无法确认时保留待确认状态。</li></ul><p>关闭系统通知不影响搜索、程序内的未读徽标和商品变化列表。</p></div></div></section>`;}

function applyNativeNotificationStatus(value){if(!value||!['unknown','shown','failed','unsupported','unconfirmed'].includes(value.state))return;nativeNotificationStatus=value;if(page==='settings')render();}
async function testSystemNotification(){
 if(nativeNotificationTesting)return;if(!systemNotificationsEnabled()){toast('请先开启系统通知开关');return;}
 if(!window.desktopNotifications?.test){toast('当前版本不支持通知测试，请更新桌面程序');return;}
 nativeNotificationTesting=true;render();try{applyNativeNotificationStatus(await window.desktopNotifications.test());}catch(error){applyNativeNotificationStatus({state:'failed',message:error.message||'无法连接通知服务'});}finally{nativeNotificationTesting=false;render();}
}
window.desktopNotifications?.onStatus?.(applyNativeNotificationStatus);
if(window.desktopNotifications?.status)void window.desktopNotifications.status().then(applyNativeNotificationStatus).catch(()=>{});

function sendTaskNotice(payload){
 if(!systemNotificationsEnabled())return;
 if(payload.kind==='changes'&&!areChangeNotificationsEnabled(payload.taskId))return;
 try{
 if(window.desktopNotifications){window.desktopNotifications.send(payload);return;}
 if(typeof Notification!=='undefined'&&Notification.permission==='granted'){const note=new Notification(payload.title,{body:payload.body,tag:'cbg-'+(payload.kind||'verification')+'-'+payload.taskId});note.onclick=()=>{window.focus();openNotificationTask(payload.taskId);note.close();};}
 }catch(error){console.warn('系统通知发送失败：'+error.message);}
}
const verificationNotifications=typeof TaskNotifications==='object'?TaskNotifications.create(sendTaskNotice):null;
function openNotificationTask(id){if(typeof openTaskResults==='function'){void openTaskResults(id);return;}if(!state.tasks.some(task=>task.id===id))return;selectedTaskId=id;page='task-detail';render();}
window.desktopNotifications?.onOpenTask(openNotificationTask);
function render(options={}){
 const nav=document.querySelector('#nav'),navHtml=navs.map(([id,i,label])=>`<button class="nav-item ${page===id||page==='task-detail'&&id==='tasks'||page==='valuation-settings'&&id==='valuation'?'active':''}" data-page="${id}">${icon(i)}<span>${label}</span></button>`).join('');
 if(navHtml!==renderedNavHtml){if(renderedNavHtml&&typeof ResultUpdates==='object')ResultUpdates.update(nav,navHtml);else nav.innerHTML=navHtml;renderedNavHtml=navHtml;}
 document.querySelector('#breadcrumb').textContent=page==='task-detail'?'任务搜索结果':page==='valuation-settings'?'估价 / 估价设置':navs.find(n=>n[0]===page)?.[2]||'首页';
 const main=document.querySelector('#main'),pageKey=page+':'+(page==='task-detail'?selectedTaskId:page==='valuation-settings'?valuationCategory:''),html=page==='home'?homeView():page==='tasks'?tasksView():page==='roles'?rolesView():page==='settings'?settingsView():page==='valuation'?linkValuationView():page==='valuation-settings'?valuationSettingsPage():page==='materials'?materialsView():page==='task-detail'?taskDetailView():logsView();
 const notices=(typeof storageGuide==='function'?storageGuide():'')+(typeof taskChangeStorageError==='string'&&taskChangeStorageError?`<div id="task-change-storage-error" class="task-storage-error" role="alert">${esc(taskChangeStorageError)}</div>`:'')+(taskStorageError?`<div id="task-storage-error" class="task-storage-error" role="alert">任务本地存储异常：${esc(taskStorageError)}。当前修改尚未保存。</div>`:'');
 const content=notices+html;
 if(typeof ResultUpdates==='object'&&renderedPageKey===pageKey)ResultUpdates.update(main,content,{preserveAnchor:options.preserveResultAnchor!==false});else main.innerHTML=content;
 if(page==='valuation'&&linkValuationState.detail?.category==='角色'&&typeof RoleDetails==='object')RoleDetails.mount(main,linkValuationState.detail);
 renderedPageKey=pageKey;
 if(schedulerStartupReady)verificationNotifications?.sync(state.tasks,task=>(taskNeedsVerification(task)||taskNeedsAccountSecurity(task))&&!verificationChecks.has(task.roleId));
 updateTaskCountdowns();
}
function heading(title,sub,actions='',label=''){return `<div class="page-heading"><h1>${title}</h1><div class="heading-actions">${actions}</div></div>`}
function taskActions(){const enabled=state.tasks.some(task=>task.enabled);return `<button class="button secondary" data-action="toggle-all" ${state.tasks.length?'':'disabled'}>${icon(enabled?'pause':'play')}${enabled?'全部暂停':'全部启动'}</button><button class="button primary" data-action="create">${icon('plus')}新建搜索任务</button>`;}

function homeView(){
 const running=state.tasks.filter(task=>task.enabled||busy.has(task.id));
 const stats=[['全部任务',state.tasks.length,'grid'],['运行中的任务',running.length,'refresh'],['已保存角色',availableRoles.length,'role']];
 return heading('任务工作台','查看正在运行的搜索任务。',taskActions())+`<section class="stats">${stats.map(([label,value,i])=>`<div class="stat"><div class="stat-top">${label}<span class="stat-icon">${icon(i)}</span></div><div class="stat-value">${value}</div></div>`).join('')}</section><section class="panel home-task-list"><div class="panel-header"><div class="panel-title">运行中的任务 <span class="count">${running.length}</span></div><button class="text-button" data-page="tasks">查看全部任务 ${icon('arrow')}</button></div>${running.length?running.map(taskRow).join(''):empty('暂无运行中的任务','在任务列表中开启任务，或先添加角色并创建任务。')}</section>`;
}
function tasksView(){
 const tasks=state.tasks.filter(task=>(taskRoleFilter==='all'||task.roleId===taskRoleFilter)&&(taskFilter==='all'||(taskFilter==='active'?task.enabled:!task.enabled))&&`${task.name}${serverNames(task)}`.includes(query));
 return heading('任务列表','管理所有任务，点击任务卡片查看该任务的搜索结果。',taskActions())+`<section class="panel"><div class="panel-header"><div class="panel-title">全部搜索任务 <span class="count">${state.tasks.length}</span></div></div><div class="toolbar"><div class="segmented">${[['all','全部任务'],['active','运行中'],['paused','未启动']].map(([value,label])=>`<button class="${taskFilter===value?'active':''}" data-task-filter="${value}">${label}</button>`).join('')}</div><label class="task-role-filter">绑定角色<select data-task-role-filter aria-label="按角色筛选任务"><option value="all">全部角色</option>${availableRoles.map(role=>`<option value="${esc(role.id)}" ${taskRoleFilter===role.id?'selected':''}>${esc(roleLabel(role.id))}</option>`).join('')}</select></label><div class="search-field">${icon('search')}<input id="task-query" value="${esc(query)}" placeholder="搜索任务名称…" aria-label="搜索任务"></div></div><div id="task-list">${tasks.length?tasks.map(taskRow).join(''):state.tasks.length?empty('暂无匹配任务','请调整角色、运行状态或搜索条件。'):empty('暂无任务','先添加角色，再创建搜索任务。')}</div></section>`;
}
function taskIconKind(task){
 const list=value=>value==null?[]:(Array.isArray(value)?value:[value]).map(String),unify=icons=>icons.length&&icons.every(i=>i===icons[0])?icons[0]:'equipment';
 if(task.category==='上古玉魄')return 'jade';
 if(task.category==='灵饰'){const kinds=list(task.lingshiFilters?.kindid),icons={'61':'ring','62':'earring','63':'bracelet','64':'pendant'};return kinds.length?unify(kinds.map(k=>icons[k]||'equipment')):'ring';}
 if(task.category==='召唤兽装备'){const kinds=list(task.petEquipmentFilters?.equip_pos),icons={'1':'armor','2':'necklace','3':'bracelet'};return kinds.length?unify(kinds.map(k=>icons[k]||'equipment')):'shield';}
 if(task.category==='装备'){const kinds=list(task.equipmentFilters?.types??task.equipmentFilters?.type),icons={'17':'helmet','58':'helmet','18':'armor','59':'armor','19':'boots','20':'belt','21':'necklace'},weapons=new Set([...EquipmentValuation.WEAPON_GROUPS.flat(),'83']);return unify(kinds.map(k=>icons[k]||(weapons.has(k)?'sword':'equipment')));}
 return task.category==='召唤兽'?'pet':'role';
}
function taskRow(t){const kind=taskIconKind(t);return `<article class="task-row" data-task-card="${esc(t.id)}"><div class="task-top"><span class="task-art art-${kind}">${icon(kind)}</span><div><div class="task-title"><h3><button data-open-task="${esc(t.id)}">${esc(t.name)}</button></h3>${typeof taskChangeBadge==='function'?taskChangeBadge(t.id):''}<span class="status ${t.enabled?'':'paused'}"><i></i>${taskNeedsAccountSecurity(t)?'需处理':taskNeedsVerification(t)?'待验证':state.taskRuns?.[t.id]?.valuationRunning?'估价中':busy.has(t.id)?'搜索中':t.enabled?'运行中':'未启动'}</span></div><div class="task-meta">${esc(t.category)} <span>/</span> ${esc(roleLabel(t.roleId))}</div></div><button class="toggle ${t.enabled?'on':''}" ${SearchParams.supportsCategory(t.category)?'':'disabled title="该品类尚未接入搜索"'} role="switch" aria-checked="${t.enabled}" aria-label="切换${esc(t.name)}" data-toggle="${esc(t.id)}"></button></div><div class="task-tags"><span class="tag">${esc(serverNames(t))}</span></div>${typeof equipmentEstimateOptions==='function'?equipmentEstimateOptions(t):''}<div class="task-bottom"><span class="task-schedule">${icon('clock')} 每 ${t.interval} 分钟 <span>·</span> ${t.lastRunAt?'上次搜索 '+time(t.lastRunAt):'尚未搜索'}${t.lastViewedAt?` <span>·</span> 上次查看 ${dateTime(t.lastViewedAt)}`:''} <span>·</span> <span data-countdown-task="${esc(t.id)}">${taskCountdown(t)}</span></span><div class="task-buttons">${taskNotificationButton(t)}<button data-edit="${esc(t.id)}">${icon('edit')}编辑</button><button class="run" data-run="${esc(t.id)}" ${taskNeedsVerification(t)||taskNeedsAccountSecurity(t)||taskScheduler.isRunning(t.id)||!SearchParams.supportsCategory(t.category)?'disabled':''}>${icon('play')}${state.taskRuns?.[t.id]?.valuationRunning?'估价中…':busy.has(t.id)?'搜索中…':'搜索一次'}</button>${busy.has(t.id)?`<button type="button" data-action="cancel-search" data-task-id="${esc(t.id)}">${state.taskRuns?.[t.id]?.valuationRunning?'停止估价':'停止搜索'}</button>`:''}</div></div>${taskVerificationNotice(t)}${t.lastSlowRun?'<p class="slow-search-note">上次搜索超过 2 分钟，建议细化筛选条件或拆分服务器范围。</p>':''}</article>`;}
function empty(title,desc){return `<div class="empty">${icon('search')}<strong>${title}</strong><br>${desc}</div>`}
function taskDetailView(){
 const task=state.tasks.find(task=>task.id===selectedTaskId);if(!task)return heading('任务已删除','请返回任务列表。',`<button class="button secondary" data-page="tasks">返回任务列表</button>`);
 const run=state.taskRuns[task.id];
 return heading(esc(task.name),'该任务最近一轮搜索的结果。',`<button class="button secondary" data-page="tasks">返回任务列表</button>${taskNotificationButton(task)}<button class="button primary" data-run="${esc(task.id)}" ${taskNeedsVerification(task)||taskNeedsAccountSecurity(task)||taskScheduler.isRunning(task.id)?'disabled':''}>搜索一次</button>`,'TASK RESULTS')+`<div class="task-detail-meta"><span>${esc(roleLabel(task.roleId))}</span><span>${esc(serverNames(task))}</span><span data-countdown-task="${esc(task.id)}">${taskCountdown(task)}</span></div>${taskVerificationNotice(task)}${typeof equipmentEstimateView==='function'?equipmentEstimateView(task):''}${typeof taskChangeResults==='function'?taskChangeResults(task,run):run?rawSearchView(run):`<section class="panel">${empty('该任务暂无搜索结果','点击“搜索一次”或开启定时任务。')}</section>`}`;
}
function activityTable(events){return `<table class="log-table"><thead><tr><th>时间</th><th>任务 / 角色</th><th>事件</th><th>详情</th></tr></thead><tbody>${events.map(event=>`<tr><td>${dateTime(event.at)}</td><td>${esc(event.name|| (event.roleId?roleLabel(event.roleId):'—'))}</td><td class="activity-type">${esc(({task:'任务执行',request:'分页请求',verification_success:'安全验证通过',cookie_refresh_start:'刷新Cookie',cookie_refresh_success:'刷新成功',cookie_refresh_retry:'刷新重试',cookie_refresh_failed:'刷新失败',cookie_retry_failed:'重试失败',cookie_retry_success:'重试当前页'})[event.type]||event.type)}</td><td class="logs-message">${esc(event.message)}${event.url?`<code class="run-log-url">${esc(event.url)}</code>`:''}</td></tr>`).join('')}</tbody></table>`;}
function runLogList(rows){return `<div class="run-log-head"><span>时间</span><span>搜索任务</span><span>结果</span><span>时长</span></div><div class="run-log-list">${rows.map(row=>`<details class="run-log" data-run-key="${esc(row.id||row.taskId+':'+row.at)}"><summary><time>${dateTime(row.startedAt||row.at)}</time><strong>${esc(row.name||state.tasks.find(task=>task.id===row.taskId)?.name||'搜索任务')}</strong><span class="run-log-status ${esc(row.status)}">${esc(RunLogs.status(row.status))}</span><span ${row.status==='running'?`data-run-duration="${esc(row.id)}"`:''}>${RunLogs.duration(row.durationMs)}</span></summary><div class="run-log-details">${row.message?`<p>${esc(row.message)}</p>`:''}${row.details.length?activityTable(row.details):'<p>没有接口或会话刷新明细。</p>'}</div></details>`).join('')}</div>`;}
function logsView(){
 const tasks=new Map(state.tasks.map(t=>[t.id,t.name]));for(const log of [...state.logs,...(state.requestLogs||[])])if(!tasks.has(log.taskId))tasks.set(log.taskId,log.name||log.taskId);
 const selected=state.tasks.find(t=>t.id===logTaskFilter);
 const roles=new Map(availableRoles.map(r=>[r.id,r.nickname+' · '+r.server.name]));for(const row of [...state.tasks,...state.logs,...(state.requestLogs||[]),...roleEvents])if(row.roleId&&!roles.has(row.roleId))roles.set(row.roleId,'角色 '+row.roleId.slice(0,8));
 const live=Object.values(state.taskRuns||{}).filter(run=>(run.running||run.valuationRunning)&&run.startedAt).map(run=>({id:run.runId,taskId:run.taskId,roleId:state.tasks.find(task=>task.id===run.taskId)?.roleId,name:run.taskName,startedAt:run.startedAt,finishedAt:run.searchFinishedAt||Date.now(),at:Date.now(),status:run.running?'running':'success',durationMs:run.durationMs??Date.now()-run.startedAt}));
 const rows=RunLogs.rows([...state.logs,...live],state.requestLogs||[],roleEvents,state.tasks).filter(row=>(logTaskFilter==='all'||row.taskId===logTaskFilter)&&(logRoleFilter==='all'||row.roleId===logRoleFilter)).slice(0,200);

 return heading('运行记录','查看任务执行、分页请求和角色Cookie刷新记录。','','TASK ACTIVITY')+`<section class="panel"><div class="panel-header"><div class="panel-title">最近记录 <span class="count">${rows.length}</span></div><div class="log-filters"><label class="log-task-filter">筛选角色 <select data-log-role aria-label="筛选运行记录角色"><option value="all">全部角色</option>${[...roles].map(([id,name])=>`<option value="${esc(id)}" ${logRoleFilter===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label class="log-task-filter">筛选任务 <select data-log-task aria-label="筛选运行记录任务"><option value="all">全部任务</option>${[...tasks].map(([id,name])=>`<option value="${esc(id)}" ${logTaskFilter===id?'selected':''}>${esc(name)}</option>`).join('')}</select></label></div></div>${rows.length?runLogList(rows):empty('暂无运行记录','')}</section>`;
}
function openModal(html,className=''){if(serverPageOpen&&serverPickerContext.presentation==='dropdown')ServerPicker.close(false);document.querySelector('#overlay').innerHTML=`<section class="modal ${className}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabindex="-1">${html}</section>`;document.querySelector('#overlay').hidden=false;document.querySelector('.modal').focus();document.querySelector('#overlay input')?.focus()}
let previousFocus;
function closeModal(){if(typeof cancelManualVerification==='function'&&!cancelManualVerification())return;if(serverPageOpen&&serverPickerContext.presentation==='dropdown')ServerPicker.close(false);if(taskRoleReturn){cancelRolePending();returnTaskFromRole();return;}suitPageOpen=false;serverPageOpen=false;taskDraft=null;document.querySelector('#overlay').hidden=true;document.querySelector('#overlay').innerHTML='';previousFocus?.focus()}
function taskEditor(id){
 previousFocus=document.activeElement;
 const task=state.tasks.find(t=>t.id===id);
 taskDraft=task?JSON.parse(JSON.stringify(task)):{id:'',name:'',category:'',servers:[],interval:15,startImmediately:false,roleId:availableRoles.find(role=>canBindTaskRole(role.id))?.id||''};
 editorServerKeys=new Set((taskDraft.servers||[]).map(server=>server.key));serverPageOpen=false;suitPageOpen=false;taskRoleReturn=null;
 renderTaskEditor();
}
function renderTaskEditor(){
 if(!taskDraft)return;
 const t=taskDraft,id=t.id;
 const selected=serverList.filter(server=>editorServerKeys.has(server.key));
 openModal(`<div class="modal-head"><h2 id="dialog-title">${id?'编辑搜索任务':'新建搜索任务'}</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><form id="task-form" data-id="${esc(id)}"><div class="task-editor-body"><aside class="task-basic-settings" aria-label="任务基本设置"><div class="form-field"><label for="name">任务名称</label><input id="name" name="name" required maxlength="40" value="${esc(t.name)}" placeholder="输入任务名称"></div><div class="form-field"><label for="interval">执行间隔（分钟）</label><input id="interval" name="interval" type="number" min="1" max="1440" step="1" required value="${esc(t.interval)}"></div><div class="form-field"><div class="task-role-label"><label for="task-role">绑定角色</label><button type="button" class="text-button" data-action="add-task-role">${icon('plus')}添加角色</button></div><select id="task-role" name="roleId" required><option value="">请选择角色</option>${availableRoles.map(role=>`<option value="${esc(role.id)}" ${t.roleId===role.id?'selected':''} ${canBindTaskRole(role.id,id)?'':'disabled'}>${esc(roleLabel(role.id))}（${state.tasks.filter(task=>task.roleId===role.id).length}/${SearchParams.policy.roleTaskLimit} 任务${canBindTaskRole(role.id,id)?'':' · 已满'}）</option>`).join('')}</select>${!availableRoles.some(role=>canBindTaskRole(role.id,id))?'<p class="task-role-hint">暂无可绑定角色，点击“添加角色”即可继续，当前设置会保留。</p>':''}${roleLoadState==='error'?'<button type="button" class="text-button" data-action="reload-task-roles">重新加载角色</button>':''}</div><div class="form-field"><label for="choose-servers">服务器</label><button type="button" id="choose-servers" class="server-picker-button" data-action="choose-servers" aria-expanded="false" aria-controls="task-server-dropdown"><span>${selected.length?'已选择 '+selected.length+' 个服务器':'全服（不选服务器）'}</span>${icon('arrow')}</button><div class="selected-servers-summary" title="${esc(selected.map(server=>server.region+' · '+server.name).join('、'))}">${esc(selected.map(server=>server.name).join('、')||'不选择服务器时搜索全服')}</div><section id="task-server-dropdown" class="server-dropdown" popover="manual" role="region" aria-label="选择任务服务器"></section></div><div class="form-field"><label for="category">商品分类</label><select id="category" name="category" required><option value="">请选择分类</option>${['角色','召唤兽','装备','灵饰','上古玉魄','召唤兽装备'].map(value=>`<option ${value===t.category?'selected':''}>${value}</option>`).join('')}</select></div>${!id?`<label class="task-start-option"><span><strong>直接启动</strong><small>创建后立即搜索一次，之后按设定间隔执行。</small></span><input type="checkbox" name="startImmediately" role="switch" aria-label="直接启动" ${t.startImmediately?'checked':''} ${!SearchParams.supportsCategory(t.category)?'disabled':''}></label>`:''}</aside><section class="task-filter-panel" aria-label="品类筛选"><div id="category-options">${SearchParams.supportsCategory(t.category)?categoryOptions(t.category):'<div class="task-filter-empty"><strong>选择商品分类</strong><p>在左侧选择品类后，在这里设置搜索条件。</p></div>'}</div></section></div><div class="task-editor-footer"><div id="form-error" class="error" role="alert"></div><div class="modal-actions">${id?`<button type="button" class="danger" data-delete="${esc(id)}">删除任务</button>`:'<span></span>'}<div><button type="button" class="button secondary" data-action="close">取消</button><button type="submit" class="button primary">${id?'保存修改':'创建任务'}</button></div></div></div></form>`,'task-editor');
}
function canBindTaskRole(roleId,taskId=taskDraft?.id){return state.tasks.filter(task=>task.roleId===roleId&&task.id!==taskId).length<SearchParams.policy.roleTaskLimit;}
function openTaskRoleLogin(){captureTaskDraft();if(!taskDraft)return;taskRoleReturn={draft:JSON.parse(JSON.stringify(taskDraft)),serverKeys:[...editorServerKeys]};openRoleLogin();}
function returnTaskFromRole(roleId){
 if(!taskRoleReturn)return;const context=taskRoleReturn;taskRoleReturn=null;taskDraft=context.draft;editorServerKeys=new Set(context.serverKeys);
 if(roleId&&availableRoles.some(role=>role.id===roleId)&&canBindTaskRole(roleId,taskDraft.id))taskDraft.roleId=roleId;
 renderTaskEditor();
}
async function finishSavedRole(result,version){
 const updateMaterials=()=>{if(typeof loadMaterialPrices==='function')void loadMaterialPrices().catch(()=>{});};
 if(version!==roleModalVersion){await loadRoles();updateMaterials();return;}
 rolePending=null;await loadRoles();updateMaterials();if(version!==roleModalVersion)return;
 if(taskRoleReturn){returnTaskFromRole(result?.role?.id);toast('角色已添加，已返回原任务');}
 else{closeModal();toast('角色已保存，可以创建搜索任务');}
}
function categoryOptions(category){if(category==='上古玉魄')return yupoFiltersView();if(category==='灵饰')return lingshiFiltersView();if(category==='装备')return equipmentFiltersView();if(category==='召唤兽')return petFiltersView();if(category==='角色')return roleSearchFiltersView();if(category==='召唤兽装备')return petEquipmentFiltersView();return category?`<section class="category-options" data-category="${esc(category)}"><strong>${esc(category)}选项</strong><p>具体选项待添加</p></section>`:'';}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 try{
 if(b.dataset.page){page=b.dataset.page;render();if(page==='logs')void loadRoleEvents();if(page==='materials')void loadMaterialPrices().catch(()=>{});}
 else if(b.dataset.taskFilter){taskFilter=b.dataset.taskFilter;render()}
 else if(b.dataset.resultFilter){resultFilter=b.dataset.resultFilter;render()}
 else if(b.dataset.edit)taskEditor(b.dataset.edit);
 else if(b.dataset.run)await runTask(b.dataset.run);
 else if(b.dataset.openTask){if(typeof openTaskResults==='function')void openTaskResults(b.dataset.openTask);else{selectedTaskId=b.dataset.openTask;page='task-detail';render();}void loadRoleEvents();}
 else if(b.dataset.toggle){const task=state.tasks.find(t=>t.id===b.dataset.toggle);if(task){if(!availableRoles.some(role=>role.id===task.roleId)){toast('请先编辑任务并绑定有效角色');return;}if(taskScheduler.setEnabled(task,!task.enabled,{immediate:true})===false)return;if(!taskStorageError)toast(task.enabled?'任务已启动，立即搜索一次':'任务已暂停并保存');if(task.enabled)await taskScheduler.tick()}}

 
 else if(b.dataset.delete){const id=b.dataset.delete,nextTasks=state.tasks.filter(t=>t.id!==id);persist(nextTasks);state.tasks=nextTasks;cancelTaskSearch(id);closeModal();render();toast('任务已删除，历史结果仍保留')}
 
 else if(b.dataset.action==='create')taskEditor();
 else if(b.dataset.action==='choose-servers')openServerPage();
 else if(b.dataset.action==='close')closeModal();
 else if(b.dataset.action==='add-task-role')openTaskRoleLogin();
 else if(b.dataset.action==='reload-task-roles'){captureTaskDraft();await loadRoles();if(taskDraft)renderTaskEditor();}
 else if(b.dataset.action==='toggle-all'){const enable=!state.tasks.some(t=>t.enabled);state.tasks.forEach(task=>taskScheduler.setEnabled(task,enable&&availableRoles.some(role=>role.id===task.roleId),{immediate:true}));if(!taskStorageError)toast(enable?'已按每角色最多开启3个任务启动，其余任务保持关闭':'全部任务已暂停并保存');if(enable)await taskScheduler.tick()}
 else if(b.dataset.action==='toggle-task-notifications')toggleTaskNotifications(b.dataset.taskId);
 else if(b.dataset.action==='toggle-system-notifications')await toggleSystemNotifications();
 else if(b.dataset.action==='test-system-notification')await testSystemNotification();
 else if(b.dataset.action==='export')exportResults();
 }catch(error){toast(`操作未保存：${error.message}`)}
});
document.addEventListener('input',e=>{if(e.target.id==='task-query'){query=e.target.value;const start=e.target.selectionStart;render();const input=document.querySelector('#task-query');input.focus();input.setSelectionRange(start,start)}});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='task-form')return;e.preventDefault();
 const data=Object.fromEntries(new FormData(e.target)), id=e.target.dataset.id;
 const interval=Number(data.interval);
 if(!data.name.trim()||!Number.isInteger(interval)||interval<1||interval>1440||!['装备','召唤兽','角色','召唤兽装备','灵饰','上古玉魄'].includes(data.category)){document.querySelector('#form-error').textContent='请填写任务名称、有效的执行间隔并选择分类。';return;}
 if(!availableRoles.some(role=>role.id===data.roleId)){document.querySelector('#form-error').textContent='请先添加并绑定有效角色';return;}
 const oldTask=state.tasks.find(t=>t.id===id);
 if(oldTask?.roleId!==data.roleId&&state.tasks.filter(t=>t.id!==id&&t.roleId===data.roleId).length>=SearchParams.policy.roleTaskLimit){document.querySelector('#form-error').textContent=`同一角色最多绑定${SearchParams.policy.roleTaskLimit}个任务，请选择其他角色或删除已有任务`;return;}
 let servers=serverList.filter(server=>editorServerKeys.has(server.key));
 if(editorServerKeys.size&&(serverLoadState!=='ready'||servers.length!==editorServerKeys.size)){document.querySelector('#form-error').textContent='所选服务器数据尚未完整加载，请重新选择服务器或清空后搜索全服';return;}
 if(servers.length&&serverList.every(server=>editorServerKeys.has(server.key)))servers=[];
 try{servers=SearchParams.normalizeServers(servers);}catch(error){document.querySelector('#form-error').textContent=error.message;return;}
 if(SearchParams.supportsCategory(data.category)){const error=data.category==='上古玉魄'?validateYupoFilters():data.category==='灵饰'?validateLingshiFilters():data.category==='装备'?validateEquipmentFilters():data.category==='召唤兽'?validatePetFilters():data.category==='召唤兽装备'?validatePetEquipmentFilters():validateRoleSearchFilters();if(error){document.querySelector('#form-error').textContent=error;return;}}
 const previous=state.tasks.find(t=>t.id===id),enabled=previous?previous.enabled:data.startImmediately==='on';
 const task={id:id||uid(),name:data.name.trim(),category:data.category,roleId:data.roleId,servers,interval,enabled:enabled&&SearchParams.supportsCategory(data.category),lastRunAt:previous?.lastRunAt||null,lastError:previous?.lastError||'',changeNotifications:previous?.changeNotifications===true,nextRunAt:null};
 if(data.category==='上古玉魄'){task.yupoFilters=JSON.parse(JSON.stringify(yupoFilters()));task.valuationEnabled=previous?.category==='上古玉魄'&&previous.valuationEnabled===true;}
 if(data.category==='灵饰'){task.lingshiFilters=JSON.parse(JSON.stringify(lingshiFilters()));task.valuationEnabled=previous?.category==='灵饰'&&previous.valuationEnabled===true;}
 if(data.category==='装备'){task.equipmentFilters=JSON.parse(JSON.stringify(equipmentFilters()));const saved=previous?.category==='装备'?previous:null;task.valuationEnabled=saved?.valuationEnabled===true;}
 if(data.category==='召唤兽')task.petFilters=JSON.parse(JSON.stringify(petFilters()));
 if(data.category==='召唤兽装备')task.petEquipmentFilters=JSON.parse(JSON.stringify(petEquipmentFilters()));
 if(data.category==='角色'){task.roleFilters=JSON.parse(JSON.stringify(roleSearchFilters()));task.valuationEnabled=previous?.category==='角色'&&previous.valuationEnabled===true;}
 if(SearchParams.supportsCategory(task.category)){try{SearchParams.buildPlans(task);}catch(error){document.querySelector('#form-error').textContent=error.message;return;}}
 taskScheduler.reset(task);
 const nextTasks=previous?state.tasks.map(item=>item.id===task.id?task:item):[task,...state.tasks];
 try{completeTaskSave(task,nextTasks,Boolean(previous));}catch(error){document.querySelector('#form-error').textContent=`保存失败：${error.message}`}
});
function completeTaskSave(task,nextTasks,isEditing){
 const enabledError=SearchParams.roleEnabledTaskError(state.tasks,task);if(enabledError)throw Error(enabledError);
 if(!isEditing&&task.enabled)task.nextRunAt=Date.now();
 if(isEditing){task.lastRunAt=null;task.lastError='';task.lastViewedAt=null;task.resultRevision=uid();}
 persist(nextTasks);state.tasks=nextTasks;if(isEditing)clearTaskResults(task.id);closeModal();
 if(!isEditing){page='tasks';taskFilter='all';taskRoleFilter='all';query='';}
 render();toast(isEditing?'任务已保存，旧搜索结果已清空，已启用任务重新计时':task.enabled?'任务已创建并启动':'任务已创建并保存，尚未启动');
 if(!isEditing&&task.enabled&&!taskScheduler.isRunning(task.id))void taskScheduler.run(task.id,'automatic');
}
document.querySelector('#overlay').addEventListener('click',e=>{if(e.target.id==='overlay'){if(serverPageOpen)ServerPicker.close(false);else if(suitPageOpen)returnFromSuit(false);}});
document.addEventListener('keydown',e=>{if(document.querySelector('#overlay').hidden)return;if(e.key==='Enter'&&e.target.matches?.('#category-options input[type="search"]')){e.preventDefault();return;}if(e.key==='Escape'){if(serverPageOpen){e.preventDefault();ServerPicker.close(false);}else if(suitPageOpen){e.preventDefault();returnFromSuit(false);}else closeModal();}if(e.key==='Tab'){const nodes=[...document.querySelectorAll('.modal button,.modal input,.modal select,.modal summary')];const visibleNodes=nodes.filter(node=>node.getClientRects().length&&!node.disabled);const first=visibleNodes[0],last=visibleNodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
function exportResults(){toast('导出功能将在后续接入，当前仅展示 UI')}
document.addEventListener('change',e=>{
 if(e.target.matches?.('[data-task-role-filter]')){taskRoleFilter=e.target.value;render();return;}
 if(e.target.matches?.('[data-log-role]')){logRoleFilter=e.target.value;render();return;}
 if(e.target.matches?.('[data-log-task]')){logTaskFilter=e.target.value;render();return;}
 if(e.target.id==='category'){
  captureTaskDraft();taskDraft.category=e.target.value;
  renderTaskEditor();document.querySelector('#category')?.focus();
 }
});
state=initialState();
try{state.tasks=TaskStorage.load(localStorage);const legacyEnabled=TaskNotifications.preferences(localStorage).enabled;state.tasks=state.tasks.map(task=>typeof task.changeNotifications==='boolean'?task:{...task,changeNotifications:legacyEnabled});}catch(error){taskStorageError=error.message;taskStorageBlocked=true;}
render();
if(typeof loadStorageSettings==='function')void loadStorageSettings();
loadServers();
async function startSavedTasks(){
 const restore=[['角色',loadRoles],['筛选配置',loadSearchConfig],['搜索结果',typeof loadTaskChanges==='function'?loadTaskChanges:async()=>{}],['估价记录',typeof loadEquipmentEstimates==='function'?loadEquipmentEstimates:async()=>{}]];
 startupActivity.pending=new Set(restore.map(([name])=>name));render();
 await Promise.all(restore.map(async([name,load])=>{try{await load();}catch(error){startupActivity.error=name+'恢复失败：'+error.message;}finally{startupActivity.pending.delete(name);scheduleRender();}}));
 if(roleLoadState==='ready'){
  startupActivity.checking=true;render();try{await checkSavedVerificationStates();}catch(error){startupActivity.error='验证状态检查失败：'+error.message;}finally{startupActivity.checking=false;}
  if(typeof loadMaterialPrices==='function')void loadMaterialPrices().then(()=>loadEquipmentEstimates()).catch(()=>{});
  for(const task of state.tasks)if(task.enabled&&SearchParams.supportsCategory(task.category))task.nextRunAt=Date.now();
 }else startupActivity.error='角色读取失败：'+(roleLoadError||'自动任务未启动');
 schedulerStartupReady=true;render();
 if(roleLoadState==='ready'){schedulerChanged();await taskScheduler.tick();}
}
const startupReady=startSavedTasks();void startupReady;void loadRoleEvents();
setInterval(()=>{void loadRoleEvents();},5000);
setInterval(()=>{updateTaskCountdowns();if(schedulerStartupReady)void taskScheduler.tick();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateTaskCountdowns();if(schedulerStartupReady)void taskScheduler.tick();}});

document.addEventListener('click',event=>{if(event.target.closest('button,input,select,a'))return;const card=event.target.closest('[data-task-card]');if(card){if(typeof openTaskResults==='function')void openTaskResults(card.dataset.taskCard);else{selectedTaskId=card.dataset.taskCard;page='task-detail';render();}void loadRoleEvents();}});

for(const eventName of ['input','change','click'])document.addEventListener(eventName,refreshFilterIndicators);
