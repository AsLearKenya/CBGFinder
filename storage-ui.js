/* Desktop profile location is selected through the native folder picker. */
let storageSettings=null,storageGuideVisible=false,storageSettingBusy=false,storageSettingError='';
async function loadStorageSettings(){
 if(!window.desktopStorage)return;
 try{storageSettings=await window.desktopStorage.info();storageGuideVisible=storageSettings.shouldGuide===true;storageSettingError=storageSettings.migrationError||'';render();}catch(error){storageSettingError='存储路径读取失败：'+error.message;render();}
}
function storageGuide(){return storageGuideVisible&&window.desktopStorage?`<aside id="storage-guide" class="storage-guide" role="note"><span>可在系统设置中选择本地数据存储路径。</span><div><button type="button" data-action="storage-guide-settings">设置路径</button><button type="button" data-action="storage-guide-skip">跳过</button></div></aside>`:'';}
function storageSettingsView(){
 if(!window.desktopStorage)return `<section class="panel storage-settings"><div class="panel-header"><div class="panel-title">本地数据</div></div><div class="settings-body"><p class="setting-help">浏览器模式由浏览器管理本地数据。桌面版支持选择数据存储路径。</p></div></section>`;
 const pending=storageSettings?.pendingPath;
 return `<section class="panel storage-settings"><div class="panel-header"><div class="panel-title">本地数据</div></div><div class="settings-body"><div class="setting-row"><div><strong>数据存储路径</strong><p>保存角色登录信息、任务、搜索结果快照及偏好设置。</p><code class="storage-path">${esc(storageSettings?.path||'正在读取…')}</code></div><div class="storage-actions"><button type="button" class="button secondary" data-action="storage-choose" ${storageSettingBusy||!storageSettings?'disabled':''}>${storageSettingBusy?'处理中…':'更改路径'}</button><button type="button" class="button secondary" data-action="storage-open" ${!storageSettings?'disabled':''}>打开文件夹</button></div></div>${pending?`<div class="storage-pending"><strong>待应用路径</strong><code class="storage-path">${esc(pending)}</code><p>重启后迁移现有数据并使用新路径，原目录会保留。迁移失败会继续使用原路径。</p><div class="storage-actions"><button type="button" class="button primary" data-action="storage-restart" ${storageSettingBusy?'disabled':''}>重启并应用</button><button type="button" class="button secondary" data-action="storage-cancel" ${storageSettingBusy?'disabled':''}>取消更改</button></div></div>`:'<p class="setting-help">更改时请选择空文件夹，现有数据会在重启时迁移。也可继续使用当前默认路径。</p>'}${storageSettingError?`<p class="error" role="alert">${esc(storageSettingError)}</p>`:''}</div></section>`;
}
async function storageAction(action){
 if(action==='storage-guide-settings'){storageGuideVisible=false;page='settings';render();return;}
 if(action==='storage-guide-skip'){storageGuideVisible=false;render();return;}
 if(!window.desktopStorage||storageSettingBusy)return;
 storageSettingBusy=true;storageSettingError='';render();
 try{
  if(action==='storage-choose'){const result=await window.desktopStorage.choose();if(!result.cancelled){storageSettings=result;storageGuideVisible=false;toast(result.pendingPath?'已保存新路径，重启后迁移数据':'继续使用当前存储路径');}}
  if(action==='storage-open'){const error=await window.desktopStorage.open();if(error)throw Error(error);}
  if(action==='storage-cancel')storageSettings=await window.desktopStorage.cancel();
  if(action==='storage-restart'){
   if(!storageSettings?.pendingPath)return;
   const wasReady=schedulerStartupReady;schedulerStartupReady=false;
   try{if(busy.size||Object.values(state.taskRuns||{}).some(run=>run.running)||availableRoles.some(role=>role.refreshing)||typeof taskStatusJobs!=='undefined'&&taskStatusJobs.size)throw Error('请等待正在执行的搜索、状态查询或角色刷新结束后再重启');persist();if(typeof taskChangeStore!=='undefined')await taskChangeStore.flush();await window.desktopStorage.restart();}catch(error){schedulerStartupReady=wasReady;throw error;}
  }
 }catch(error){storageSettingError=error.message;toast(error.message);}finally{storageSettingBusy=false;render();}
}
document.addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.action;if(action?.startsWith('storage-'))void storageAction(action);});
