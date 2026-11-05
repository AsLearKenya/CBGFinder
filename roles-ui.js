let availableRoles=[],roleLoadState='loading',roleLoadError='',roleEvents=[],rolePending=null,roleModalVersion=0,roleLoadPromise=null,roleLoginServerKey='';
const roleOperations=new Set();
async function roleApi(path,data){let response;try{response=await fetch('/api/'+path,data===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}catch{throw Error('无法连接本地服务，请确认服务已启动后重试。');}let result;try{result=await response.json();}catch{throw Error('本地服务响应异常，请确认已运行 npm start');}if(!response.ok)throw Error(result.message||'操作失败');return result;}
function loadRoles(){
 if(roleLoadPromise)return roleLoadPromise;
 roleLoadState='loading';roleLoadError='';render();
 roleLoadPromise=(async()=>{
  try{
   const data=await roleApi('roles');
   if(!Array.isArray(data.roles))throw Error('角色列表响应异常，请重试。');
   if(data.officialVerificationWindow&&!window.desktopVerification)window.desktopVerification={open:input=>roleApi('verification/window/open',input),finish:input=>roleApi('verification/window/finish',input),onClosed(){}};
   availableRoles=data.roles;roleLoadState='ready';if(typeof startupActivity!=='undefined'&&startupActivity.error.startsWith('角色读取失败：'))startupActivity.error='';
   let changed=false;for(const task of state.tasks){const role=availableRoles.find(role=>role.id===task.roleId);if(role?.lastVerifiedAt>(task.lastRunAt||0)&&!role.requestQueue?.blocked&&/CAPTCHA_AUTH|验证码/.test(task.lastError||'')){task.lastError='';taskScheduler.reset(task);changed=true;}}for(const task of state.tasks)if(task.enabled&&!availableRoles.some(role=>role.id===task.roleId)){task.enabled=false;task.nextRunAt=null;changed=true;}if(changed)persist();
  }catch(error){roleLoadState='error';roleLoadError=error.message;}
  finally{roleLoadPromise=null;render();}
 })();return roleLoadPromise;
}
async function loadRoleEvents(){try{const events=(await roleApi('activity')).events,changed=JSON.stringify(events)!==JSON.stringify(roleEvents);roleEvents=events;if(changed){if(page==='logs')render();await loadRoles();}}catch{}}
function roleLabel(id){const role=availableRoles.find(role=>role.id===id);return role?`${role.nickname||'角色'} · ${role.server?.name||'未知服务器'}${role.level!==null?' · '+role.level+'级':''}`:'未绑定有效角色';}
function rolesView(){
 const content=roleLoadState==='loading'&&!availableRoles.length?empty('正在读取角色',''):roleLoadState==='error'&&!availableRoles.length?`<div class="role-empty"><p>${esc(roleLoadError)}</p><button class="button secondary" data-action="reload-roles">重新加载</button></div>`:!availableRoles.length?`<div class="role-empty">${icon('role')}<h3>还没有添加角色</h3><p>登录账号并选择角色后，就可以创建搜索任务。</p><button class="button primary" data-action="add-role">添加角色</button></div>`:`<div class="roles-grid">${availableRoles.map(role=>`<article class="role-card" data-role-card="${esc(role.id)}"><div class="role-card-heading"><span class="task-art art-role">${icon('role')}</span><div><h3>${esc(role.nickname)} ${role.level!==null?`<small>${role.level}级</small>`:''}</h3><p>${esc(role.server.region)} / ${esc(role.server.name)}</p></div><span class="status ${role.status==='ready'?'':'paused'}"><i></i>${roleOperations.has(role.id)||role.refreshing?'刷新中':role.status==='ready'?'可用':'需要处理'}</span></div><dl><dt>账号</dt><dd>${esc(role.account)}</dd><dt>角色 ID</dt><dd>${esc(role.gameRoleId)}</dd><dt>最近刷新</dt><dd>${role.lastRefreshedAt?dateTime(role.lastRefreshedAt):'—'}</dd><dt>自动刷新</dt><dd>${role.refreshIntervalMinutes?'每 '+role.refreshIntervalMinutes+' 分钟':'未开启'}</dd><dt>下次刷新</dt><dd>${role.refreshing?'正在刷新':role.nextRefreshAt?dateTime(role.nextRefreshAt):'—'}</dd><dt>失败重试</dt><dd>最多 ${role.refreshRetryLimit??2} 次，同角色任务共用</dd><dt>绑定任务</dt><dd>${state.tasks.filter(task=>task.roleId===role.id).length} 个（不限数量，最多开启3个）</dd><dt>请求通道</dt><dd>同角色最多 ${SearchParams.policy.roleConcurrency} 并发，启动间隔 ${SearchParams.policy.minRequestGapMs/1000} 秒</dd><dt>请求队列</dt><dd>${role.requestQueue?.active||0} 执行 · ${role.requestQueue?.queued||0} 等待</dd></dl>${role.requestQueue?.blocked?`<p class="error">${esc(role.requestQueue.blocked)}</p>`:''}${role.lastError?`<p class="error">${esc(role.lastError)}</p>`:''}<div class="role-card-actions"><button class="button secondary" data-manual-verify-role="${esc(role.id)}" ${roleOperations.has(role.id)?'disabled':''}>安全验证</button><button class="button secondary" data-refresh-role="${esc(role.id)}" ${roleOperations.has(role.id)||role.refreshing?'disabled':''}>刷新cookie</button><button class="button secondary" data-role-cookie-settings="${esc(role.id)}" ${roleOperations.has(role.id)||role.refreshing?'disabled':''}>Cookie设置</button><button class="text-button" data-delete-role="${esc(role.id)}">删除角色</button></div></article>`).join('')}</div>`;
 return heading('角色管理','登录一次并保存角色，任务会自动维护对应角色的登录会话。',`<button class="button primary" data-action="add-role">${icon('plus')}添加角色</button>`,'YOUR GAME ROLES')+(roleLoadError&&availableRoles.length?`<p class="error" role="alert">${esc(roleLoadError)}</p>`:'')+content;
}
function openRoleCookieSettings(id){
 const role=availableRoles.find(r=>r.id===id);if(!role)return;
 openModal(`<div class="modal-head"><h2 id="dialog-title">Cookie刷新设置</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><p>${esc(role.nickname)} · 绑定此角色的任务共用刷新状态和重试次数。</p><form id="role-cookie-settings" data-role-id="${esc(id)}"><div class="form-field"><label for="cookie-refresh-interval">自动刷新间隔（分钟）</label><input id="cookie-refresh-interval" name="refreshIntervalMinutes" type="number" min="0" max="10080" step="1" required value="${role.refreshIntervalMinutes||0}"><small>设为 0 关闭自动刷新。</small></div><div class="form-field"><label for="cookie-refresh-retries">失败后最多重试次数</label><input id="cookie-refresh-retries" name="refreshRetryLimit" type="number" min="0" max="5" step="1" required value="${role.refreshRetryLimit??2}"></div><p class="role-storage-note">定时、手动和任务触发共用同一次刷新。刷新期间相关任务等待；重试耗尽后统一报失败，可手动刷新或等待下一次自动刷新。</p><p id="cookie-settings-error" class="error" role="alert"></p><div class="modal-actions"><span></span><button class="button primary" type="submit">保存设置</button></div></form>`,'role-editor');
}
function openRoleDelete(id){
 const role=availableRoles.find(role=>role.id===id);if(!role)return;
 if(roleOperations.has(id)){toast('请等待该角色的操作完成');return;}
 const tasks=state.tasks.filter(task=>task.roleId===id);
 openModal(`<div class="modal-head"><h2 id="dialog-title">删除角色</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><p>确定删除角色「${esc(role.nickname)}」吗？</p>${tasks.length?`<div class="role-delete-warning">删除后，以下 ${tasks.length} 个绑定任务也会全部移除；正在执行的任务将停止。此操作无法撤销。</div><ul class="role-bound-tasks">${tasks.map(task=>`<li><strong>${esc(task.name)}</strong><span>${esc(task.category)} · ${task.enabled?'运行中':'未启动'}</span></li>`).join('')}</ul>`:'<p>该角色没有绑定任务。删除后，已保存的登录信息也会移除。</p>'}<p id="role-delete-error" class="error" role="alert"></p><div class="modal-actions"><button class="button secondary" data-action="close">取消</button><button class="button danger-primary" data-confirm-delete-role="${esc(id)}">${tasks.length?'删除角色及 '+tasks.length+' 个任务':'确认删除角色'}</button></div>`,'role-editor');
}
async function deleteRoleAndTasks(id,button){
 if(roleOperations.has(id))return;
 const previous=state.tasks,next=previous.filter(task=>task.roleId!==id),removed=previous.filter(task=>task.roleId===id);
 const errorNode=document.querySelector('#role-delete-error');
 roleOperations.add(id);if(button)button.disabled=true;
 try{
  persist(next);state.tasks=next;
  for(const task of removed)cancelTaskSearch(task.id);
  try{await roleApi('roles/delete',{id});}
  catch(error){state.tasks=previous;try{persist(previous);}catch(rollbackError){throw Error(error.message+'；任务存档恢复失败：'+rollbackError.message);}throw error;}
  for(const task of removed)delete state.taskRuns[task.id];
  availableRoles=availableRoles.filter(role=>role.id!==id);if(typeof taskRoleFilter==='string'&&taskRoleFilter===id)taskRoleFilter='all';closeModal();render();toast(`角色已删除，已移除 ${removed.length} 个绑定任务`);
 }catch(error){errorNode.textContent=error.message;if(button)button.disabled=false;}
 finally{roleOperations.delete(id);}
}
function openRoleLogin(){
 rolePending=null;roleModalVersion++;roleLoginServerKey='';
 openModal(`<div class="modal-head"><h2 id="dialog-title">添加角色</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><div class="role-login-warning" role="note"><strong>建议使用 50 级以上的小号</strong><p>使用高价值账号导致的损失概不负责。</p></div><p>账号需在所选服务器下拥有角色。</p><form id="role-login-form"><div class="form-field"><label for="role-account">游戏账号</label><input id="role-account" name="account" autocomplete="username" required maxlength="254" placeholder="网易游戏账号"></div><div class="form-field"><label for="role-password">密码</label><input id="role-password" name="password" type="password" autocomplete="current-password" required maxlength="117"></div><div class="form-field"><label for="choose-role-server">登录服务器</label><button type="button" id="choose-role-server" class="server-picker-button" data-action="choose-role-server"><span>选择有角色的服务器</span>${icon('arrow')}</button></div><p class="role-storage-note">登录信息加密保存在本机，用于会话过期后重新登录。保存前需要选择角色。</p><p id="role-error" class="error" role="alert"></p><div class="modal-actions"><span id="role-login-progress"></span><button type="submit" class="button primary">登录并获取角色</button></div></form>`,'role-editor');
}
function renderRoleLoginVerification(){
 openModal(`<div class="modal-head"><h2 id="dialog-title">完成官方登录验证</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><p>已打开独立的官方登录窗口。请在该窗口登录并完成验证码或将军令验证，停留在角色选择页后点击继续。</p><p>此窗口与本次添加角色使用同一会话，验证后可直接获取角色。</p><p id="role-error" class="error" role="alert"></p><div class="modal-actions"><button class="button secondary" data-action="focus-role-login">显示官方窗口</button><button class="button primary" data-action="complete-role-login">已完成验证，获取角色</button></div>`,'role-editor');
}
document.addEventListener('click',async event=>{const button=event.target.closest('button'),action=button?.dataset.action;if(!['focus-role-login','complete-role-login'].includes(action)||!rolePending)return;const pending=rolePending,version=roleModalVersion;button.disabled=true;try{const result=await roleApi(action==='focus-role-login'?'roles/login-focus':'roles/login-complete',{pendingId:pending.pendingId});if(version!==roleModalVersion)return;if(action==='complete-role-login'){rolePending=result;renderRoleChoice();}}catch(error){if(version===roleModalVersion){const node=document.querySelector('#role-error');if(node)node.textContent=error.message;}}finally{button.disabled=false;}});
function renderRoleChoice(){
 const pending=rolePending;
 openModal(`<div class="modal-head"><h2 id="dialog-title">选择并保存角色</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><p>${esc(pending.server.region)} / ${esc(pending.server.name)} · 保存后可绑定多个搜索任务。</p><form id="role-choice-form"><div class="role-choices">${pending.roles.map(role=>`<label class="role-choice"><input type="radio" name="gameRoleId" value="${esc(role.id)}" ${role.id===pending.defaultRoleId&&!role.locked?'checked':''} ${role.locked?'disabled':''} required><span><strong>${esc(role.name)}</strong><small>ID ${esc(role.id)}${role.level!==null?' · '+role.level+'级':' · 等级将在登录角色后获取'}${role.locked?' · 不可登录':''}</small></span></label>`).join('')}</div><p id="role-error" class="error" role="alert"></p><div class="modal-actions"><span id="role-login-progress"></span><button type="submit" class="button primary">保存角色</button></div></form>`,'role-editor');
}
function cancelRolePending(){roleModalVersion++;if(rolePending){void roleApi('roles/cancel',{pendingId:rolePending.pendingId}).catch(()=>{});rolePending=null;}}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 try{
  if(button.dataset.action==='add-role')openRoleLogin();
  else if(button.dataset.action==='choose-role-server')ServerPicker.open({selected:roleLoginServerKey?[roleLoginServerKey]:[],multiple:false,returnLabel:'返回添加角色',onConfirm:keys=>{
   roleLoginServerKey=[...keys][0];const server=serverList.find(server=>server.key===roleLoginServerKey);
   document.querySelector('#choose-role-server span').textContent=server?`${server.region} / ${server.name}`:'选择有角色的服务器';
  }});
  else if(button.dataset.action==='reload-roles')await loadRoles();
  else if(button.dataset.action==='close')cancelRolePending();
  else if(button.dataset.refreshRole){const id=button.dataset.refreshRole;if(roleOperations.has(id))return;roleOperations.add(id);render();try{await roleApi('roles/refresh',{id});toast('角色会话刷新成功');}finally{roleOperations.delete(id);await loadRoles();await loadRoleEvents();}}
  else if(button.dataset.roleCookieSettings)openRoleCookieSettings(button.dataset.roleCookieSettings);
  else if(button.dataset.deleteRole)openRoleDelete(button.dataset.deleteRole);
  else if(button.dataset.confirmDeleteRole)await deleteRoleAndTasks(button.dataset.confirmDeleteRole,button);
 }catch(error){toast(error.message);}
});
document.addEventListener('submit',async event=>{
 const form=event.target;
 if(form.id==='role-cookie-settings'){event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;try{const data=Object.fromEntries(new FormData(form));await roleApi('roles/settings',{id:form.dataset.roleId,refreshIntervalMinutes:Number(data.refreshIntervalMinutes),refreshRetryLimit:Number(data.refreshRetryLimit)});closeModal();await loadRoles();toast('Cookie刷新设置已保存');}catch(error){form.querySelector('#cookie-settings-error').textContent=error.message;button.disabled=false;}return;}
 if(!['role-login-form','role-choice-form'].includes(form.id))return;event.preventDefault();
 const version=roleModalVersion,button=form.querySelector('button[type="submit"]'),errorNode=form.querySelector('#role-error'),progress=form.querySelector('#role-login-progress');button.disabled=true;errorNode.textContent='';progress.textContent=form.id==='role-login-form'?'正在登录，请稍候…':'正在登录角色并保存…';
 try{
  if(form.id==='role-login-form'){
   const data=Object.fromEntries(new FormData(form)),server=serverList.find(server=>server.key===roleLoginServerKey);if(!server)throw Error('请选择登录服务器');
   form.querySelector('#role-password').value='';const pending=await roleApi('roles/login',{account:data.account,password:data.password,server});data.password='';
   if(version!==roleModalVersion){void roleApi('roles/cancel',{pendingId:pending.pendingId}).catch(()=>{});return;}rolePending=pending;if(pending.requiresVerification)renderRoleLoginVerification();else renderRoleChoice();
  }else{
   const data=Object.fromEntries(new FormData(form));const result=await roleApi('roles/save',{pendingId:rolePending.pendingId,gameRoleId:data.gameRoleId});await finishSavedRole(result,version);
  }
 }catch(error){if(version===roleModalVersion){errorNode.textContent=error.message;button.disabled=false;progress.textContent='';}}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented)cancelRolePending();});

const verificationChecks=new Map(),verificationCheckResults=new Map(),verificationResumes=new Map();
function resumeVerifiedRoleTasks(roleId){
 if(verificationResumes.has(roleId))return verificationResumes.get(roleId);
 const ids=state.tasks.filter(task=>task.roleId===roleId&&task.enabled&&SearchParams.supportsCategory(task.category)&&!taskScheduler.isRunning(task.id)).map(task=>task.id);
 const work=Promise.all(ids.map(id=>taskScheduler.run(id,'automatic')));verificationResumes.set(roleId,work);
 return work.finally(()=>{if(verificationResumes.get(roleId)===work)verificationResumes.delete(roleId);});
}
async function checkTaskVerification(task,{quiet=false}={}){
 if(!task||!availableRoles.some(role=>role.id===task.roleId))return {available:false};
 if(verificationChecks.has(task.roleId))return verificationChecks.get(task.roleId);
 const current=verificationCheckResults.get(task.roleId);if(current&&Date.now()-current.at<30000)return current;
 const pending=(async()=>{try{
  const result=await roleApi('verification/check',{task:JSON.parse(JSON.stringify(task))});
  if(!state.tasks.some(value=>value.id===task.id&&value.roleId===task.roleId&&value.resultRevision===task.resultRevision))return {available:false};
  verificationCheckResults.set(task.roleId,{...result,at:Date.now()});
  if(result.available){
   if(result.role)availableRoles=availableRoles.map(role=>role.id===task.roleId?result.role:role);else availableRoles=availableRoles.map(role=>role.id===task.roleId?{...role,requestQueue:{...role.requestQueue,blocked:''}}:role);
   const peers=state.tasks.filter(peer=>peer.roleId===task.roleId);for(const peer of peers)if(/CAPTCHA_AUTH|验证码|MIBAO_AUTH|OTP_AUTH|官方验证窗口/.test(peer.lastError||''))peer.lastError='';for(const peer of peers)taskScheduler.reset(peer);persist();if(!quiet)toast('实际请求已恢复，无需验证码');
  }else if(result.requiresAccountSecurity){
   availableRoles=availableRoles.map(role=>role.id===task.roleId?{...role,requestQueue:{...role.requestQueue,blocked:result.message}}:role);
   for(const peer of state.tasks.filter(peer=>peer.roleId===task.roleId)){peer.lastError=result.message;peer.nextRunAt=null;}persist();if(!quiet)toast(result.message);
  }else if(result.requiresVerification){
   const message=result.message||'官网要求验证码，请在本地完成官方安全验证';availableRoles=availableRoles.map(role=>role.id===task.roleId?{...role,requestQueue:{...role.requestQueue,blocked:message}}:role);for(const peer of state.tasks.filter(peer=>peer.roleId===task.roleId)){peer.lastError=message;peer.nextRunAt=null;}persist();if(!quiet)toast('官网仍要求验证码，请点击“在本地完成验证”');
  }else if(!quiet)toast(result.message||'暂时无法确认，请稍后再试');
  return result;
 }catch(error){if(!quiet)toast(error.message);return {available:false,message:error.message};}finally{verificationChecks.delete(task.roleId);render();}})();verificationChecks.set(task.roleId,pending);render();return pending;
}
async function checkSavedVerificationStates(){
 const checked=new Set();for(const task of state.tasks){if(!(taskNeedsVerification(task)||taskNeedsAccountSecurity(task))||checked.has(task.roleId))continue;checked.add(task.roleId);await checkTaskVerification(task,{quiet:true});}
}
function taskNeedsAccountSecurity(task){const role=availableRoles.find(role=>role.id===task.roleId);return /MIBAO_AUTH|OTP_AUTH/.test(role?.requestQueue?.blocked||'')||state.tasks.some(peer=>peer.roleId===task.roleId&&/MIBAO_AUTH|OTP_AUTH/.test(peer.lastError||''));}
function taskNeedsVerification(task){
 const role=availableRoles.find(role=>role.id===task.roleId);
 return /CAPTCHA_AUTH|验证码|官方验证窗口/.test(role?.requestQueue?.blocked||'')||state.tasks.some(peer=>peer.roleId===task.roleId&&/CAPTCHA_AUTH|验证码|官方验证窗口/.test(peer.lastError||''));
}
function taskVerificationUrl(task){
 const url=new URL(['角色','召唤兽装备','灵饰','上古玉魄'].includes(task.category)?'https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py':'https://xyq.cbg.163.com/cgi-bin/equipquery.py');
 url.searchParams.set('act',task.category==='上古玉魄'?'show_overall_search_yupo':task.category==='灵饰'?'show_overall_search_lingshi':task.category==='召唤兽装备'?'show_pet_equip_search_form':task.category==='角色'?'show_search_role_form':task.category==='召唤兽'?'show_overall_search_pet':'show_overall_search_equip');
 return url.href;
}
function taskVerificationNotice(task){
 if(taskNeedsAccountSecurity(task)){
  const role=availableRoles.find(role=>role.id===task.roleId),message=role?.requestQueue?.blocked||state.tasks.find(peer=>peer.roleId===task.roleId&&/MIBAO_AUTH|OTP_AUTH/.test(peer.lastError||''))?.lastError||'';
  const pending=verificationChecks.has(task.roleId)||roleOperations.has(task.roleId);
  return `<div class="task-verification" role="alert"><div><strong>需要处理账号安全状态</strong><p>${esc(message)}</p><p>${window.desktopVerification?'在官方窗口中输入将军令，完成后点击“验证完成”。':'官网浏览器与本地会话独立；桌面版支持在同一会话内验证。'}</p></div><div class="task-verification-actions">${window.desktopVerification?`<button type="button" class="button primary" data-manual-verify-task="${esc(task.id)}" ${pending?'disabled':''}>在当前会话中验证</button>`:`<button type="button" class="button primary" data-refresh-verification="${esc(task.id)}" ${pending?'disabled':''}>${roleOperations.has(task.roleId)?'正在刷新…':'刷新会话并重试'}</button>`}<button type="button" class="button secondary" data-check-verification="${esc(task.id)}" ${pending?'disabled':''}>尝试请求</button></div></div>`;
 }

 if(!taskNeedsVerification(task))return '';
 const checking=verificationChecks.has(task.roleId);const pending=checking||roleOperations.has(task.roleId)||state.tasks.some(peer=>peer.roleId===task.roleId&&taskScheduler.isRunning(peer.id));
 return `<div class="task-verification" role="alert"><div><strong>${checking?'正在检查实际请求':'上次搜索需要验证'}</strong><p>${checking?'正在请求一页确认是否仍需验证。':'建议先使用手机藏宝阁登录对应账号完成验证，再点击“验证完成”检查当前会话。'}</p></div><div class="task-verification-actions"><button type="button" class="button secondary" data-check-verification="${esc(task.id)}" ${pending?'disabled':''}>${checking?'检查中…':'验证完成'}</button><button type="button" class="button primary" data-manual-verify-task="${esc(task.id)}" ${pending?'disabled':''}>${roleOperations.has(task.roleId)?'验证中…':'打开验证窗口'}</button></div></div>`;
}
// A successfully loaded detail confirms that this role can currently read the official site.
function clearVerificationAfterDetail(roleId){
 let changed=false;
 const role=availableRoles.find(role=>role.id===roleId);
 if(/官网要求验证码/.test(role?.requestQueue?.blocked||'')){role.requestQueue.blocked='';changed=true;}
 const peers=state.tasks.filter(task=>task.roleId===roleId);
 for(const task of peers)if(/官网要求验证码，已暂停该角色的请求/.test(task.lastError||'')){task.lastError='';changed=true;}
 if(!changed)return;
 for(const task of peers)taskScheduler.reset(task);
 try{persist();}catch(error){toast('任务状态未能保存：'+error.message);}
 render();
}

let manualVerification=null;
async function openManualVerification(taskId,roleId){
 const task=state.tasks.find(task=>task.id===taskId);roleId=task?.roleId||roleId;
 if(!roleId||roleOperations.has(roleId))return;
 if(window.desktopVerification)return openDesktopVerification(taskId,roleId);
 if(state.tasks.some(peer=>peer.roleId===roleId&&taskScheduler.isRunning(peer.id))){toast('请等待该角色当前请求结束');return;}
 const popup=window.open('about:blank#cbg-human-verification','cbg-human-verification','width=440,height=560');
 if(!popup){toast('浏览器阻止了验证窗口，请允许本地应用打开弹窗后重试');return;}
 roleOperations.add(roleId);
 try{
  const reviewTask=task||state.tasks.find(value=>value.roleId===roleId);
  if(reviewTask){const check=await checkTaskVerification(reviewTask,{quiet:true});if(check.available){popup.close();roleOperations.delete(roleId);render();toast('实际请求已恢复，无需验证码');await resumeVerifiedRoleTasks(roleId);return;}if(check.requiresAccountSecurity){popup.close();roleOperations.delete(roleId);render();toast(check.message);return;}}
  const flow=await roleApi('verification/start',{roleId});
  if(popup.closed){await roleApi('verification/cancel',{id:flow.id});roleOperations.delete(roleId);return;}
  manualVerification={id:flow.id,nonce:flow.id,roleId,taskId,widgetUrl:flow.widgetUrl,popup,busy:false};
  popup.location.href=flow.widgetUrl;
  openModal(`<div class="modal-head"><h2 id="dialog-title">完成官方安全验证</h2><button type="button" class="icon-button" data-action="close" aria-label="关闭验证">${icon('close')}</button></div><div class="human-verification-body"><p>验证已在独立窗口打开，请在该窗口亲自完成网易官方验证。通过后继续使用当前会话，同账号所有已开启任务会立即搜索一次。</p><p id="human-verification-status" role="status">正在加载独立验证窗口…</p><p>建议先使用手机藏宝阁登录对应账号完成验证，再点击“验证完成”检查当前会话。</p><div class="modal-actions"><button type="button" class="button secondary" data-action="open-verification-window">打开验证窗口</button><button type="button" class="button primary" data-action="finish-manual-verification">验证完成</button></div></div>`,'human-verification-modal');
 }catch(error){popup.close();roleOperations.delete(roleId);toast(error.message);}
}
async function finishManualVerification(){
 const flow=manualVerification;if(!flow||flow.busy)return;const task=state.tasks.find(t=>t.id===flow.taskId)||state.tasks.find(t=>t.roleId===flow.roleId);
 if(!task){toast('请在验证窗口完成验证后，通过任务请求检查');return;}
 flow.busy=true;const status=document.querySelector('#human-verification-status');status.textContent='正在检查验证状态…';
 try{await roleApi('verification/cancel',{id:flow.id});flow.popup?.close();clearTimeout(flow.loadTimer);manualVerification=null;roleOperations.delete(flow.roleId);verificationCheckResults.delete(flow.roleId);const result=await checkTaskVerification(task,{quiet:true});closeModal();if(result.available)await resumeVerifiedRoleTasks(flow.roleId);else toast(result.message||'仍需验证，请重新打开验证窗口');
 }catch(error){status.textContent=error.message;}finally{flow.busy=false;}
}
function cancelManualVerification(){
 if(desktopVerificationFlow){void finishDesktopVerification();return false;}
 const flow=manualVerification;if(!flow)return true;
 if(flow.busy){toast('验证正在提交，请稍候');return false;}
 manualVerification=null;clearTimeout(flow.loadTimer);flow.popup?.close();roleOperations.delete(flow.roleId);void roleApi('verification/cancel',{id:flow.id}).catch(error=>toast(error.message));return true;
}
async function handleManualVerificationMessage(event){
 const flow=manualVerification,data=event.data;
 if(!flow||event.source!==flow.popup||data?.channel!=='cbg-human-verification'||data.nonce!==flow.nonce)return;
 const status=document.querySelector('#human-verification-status');
 if(data.type==='ready'){flow.ready=true;clearTimeout(flow.loadTimer);status.textContent='请在独立窗口完成官方安全验证。';return;}
 if(data.type==='load-error'){status.textContent='官方组件未能加载：'+String(data.value?.message||'请在组件内重试。').slice(0,160)+(data.value?.code?'（'+String(data.value.code).slice(0,30)+'）':'');return;}
 if(data.type!=='validate'||flow.busy||typeof data.value!=='string')return;
 flow.busy=true;status.textContent='正在提交验证结果…';
 try{
  const result=await roleApi('verification/submit',{id:flow.id,validate:data.value});
  if(manualVerification!==flow)return;
  availableRoles=availableRoles.map(role=>role.id===flow.roleId?result.role:role);
  for(const peer of state.tasks.filter(task=>task.roleId===flow.roleId)){if(/CAPTCHA_AUTH|验证码|MIBAO_AUTH|OTP_AUTH|官方验证窗口/.test(peer.lastError||''))peer.lastError='';taskScheduler.reset(peer);}
  event.source.postMessage({nonce:flow.nonce,type:'success'},'*');
  flow.popup?.close();clearTimeout(flow.loadTimer);
  manualVerification=null;roleOperations.delete(flow.roleId);closeModal();
  try{persist();}catch(error){toast('验证通过，但任务状态保存失败：'+error.message);}
  render();toast('官方验证已通过，当前会话已更新');
  verificationCheckResults.delete(flow.roleId);await resumeVerifiedRoleTasks(flow.roleId);
 }catch(error){status.textContent=error.message;event.source.postMessage({nonce:flow.nonce,type:'retry',message:error.message},'*');}
 finally{flow.busy=false;}
}
window.addEventListener('message',event=>{void handleManualVerificationMessage(event);});
document.addEventListener('click',event=>{const button=event.target.closest('button');if(button?.dataset.action==='finish-manual-verification')void finishManualVerification();if(button?.dataset.action==='open-verification-window'&&manualVerification){if(manualVerification.popup&&!manualVerification.popup.closed)manualVerification.popup.focus();else manualVerification.popup=window.open(manualVerification.widgetUrl,'cbg-human-verification','width=440,height=560');if(!manualVerification.popup)toast('浏览器阻止了验证窗口，请允许本地应用打开弹窗');}if(button?.dataset.manualVerifyTask)void openManualVerification(button.dataset.manualVerifyTask);if(button?.dataset.manualVerifyRole)void openManualVerification(null,button.dataset.manualVerifyRole);});

document.addEventListener('click',event=>{const id=event.target.closest('button')?.dataset.checkVerification;if(!id)return;const task=state.tasks.find(task=>task.id===id);if(task)void checkTaskVerification(task).then(result=>{if(result.available)void resumeVerifiedRoleTasks(task.roleId);});});

async function refreshTaskVerification(task){
 if(!task||roleOperations.has(task.roleId)||verificationChecks.has(task.roleId))return;
 if(state.tasks.some(peer=>peer.roleId===task.roleId&&taskScheduler.isRunning(peer.id))){toast('请等待该角色当前请求结束');return;}
 roleOperations.add(task.roleId);render();
 try{
  await roleApi('roles/refresh',{id:task.roleId});verificationCheckResults.delete(task.roleId);
  const result=await checkTaskVerification(task);
  if(result.available)await resumeVerifiedRoleTasks(task.roleId);
 }catch(error){toast(error.message);}finally{roleOperations.delete(task.roleId);await loadRoles();}
}
document.addEventListener('click',event=>{const id=event.target.closest('button')?.dataset.refreshVerification;if(id)void refreshTaskVerification(state.tasks.find(task=>task.id===id));});

let desktopVerificationFlow=null;
function desktopVerificationStatus(page){
 if(page?.state==='error')return '官网验证页加载失败'+(page.code?'（'+page.code+'）':'')+'，尚未进入验证。建议先用手机藏宝阁登录对应账号完成验证，再打开验证窗口重试。';
 if(page?.state==='login')return '官网提示登录已过期，请在此窗口中重新登录后，再尝试原任务请求。';
 return '';
}
async function navigateDesktopVerification(entry){
 const flow=desktopVerificationFlow;if(!flow||flow.busy)return;
 flow.busy=true;const status=document.querySelector('#desktop-verification-status');if(status)status.textContent='正在加载官方页面…';
 try{const result=await window.desktopVerification.open({roleId:flow.roleId,retry:entry!=='focus',entry:['search','login'].includes(entry)?entry:undefined});if(status)status.textContent=desktopVerificationStatus(result?.page);}catch(error){if(status)status.textContent=error.message;}finally{flow.busy=false;}
}
async function openDesktopVerification(taskId,roleId){
 if(state.tasks.some(peer=>peer.roleId===roleId&&taskScheduler.isRunning(peer.id))){toast('请等待该角色当前请求结束');return;}
 roleOperations.add(roleId);render();
 try{
  const task=state.tasks.find(task=>task.id===taskId)||state.tasks.find(task=>task.roleId===roleId);
  const account=task?taskNeedsAccountSecurity(task):/MIBAO_AUTH|OTP_AUTH/.test(availableRoles.find(role=>role.id===roleId)?.requestQueue?.blocked||'');
  const opened=await window.desktopVerification.open({roleId,kind:account?'account':'captcha',url:task?taskVerificationUrl(task):undefined});
  desktopVerificationFlow={roleId,taskId:task?.id,busy:false};availableRoles=availableRoles.map(role=>role.id===roleId?{...role,requestQueue:{...role.requestQueue,blocked:'官方验证窗口已打开，等待手动验证'}}:role);render();
  openModal(`<div class="modal-head"><h2 id="dialog-title">在当前角色会话中完成验证</h2><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div><p>已在独立窗口打开官方页面，沿用此角色的任务会话。请在窗口内完成将军令或滑块验证；如先显示搜索页，请点击官方搜索触发验证。</p><p>建议先使用手机藏宝阁登录对应账号完成验证，再点击“验证完成”检查当前会话。请求恢复后，同账号所有已开启任务会立即搜索一次。</p><p id="desktop-verification-status" role="status">${esc(desktopVerificationStatus(opened?.page))}</p><div class="modal-actions"><button class="button secondary" data-action="focus-official-verification">打开验证窗口</button><button class="button primary" data-action="finish-official-verification">验证完成</button></div>`,'human-verification-modal');
 }catch(error){roleOperations.delete(roleId);toast(error.message);render();}
}
async function finishDesktopVerification({closed=false,error=''}={}){
 const flow=desktopVerificationFlow;if(!flow||flow.busy)return;flow.busy=true;
 const status=document.querySelector('#desktop-verification-status');if(status)status.textContent='正在同步会话并检查实际请求…';
 try{
  if(error)throw Error(error);
  if(!closed)await window.desktopVerification.finish({roleId:flow.roleId});
  desktopVerificationFlow=null;roleOperations.delete(flow.roleId);closeModal();verificationCheckResults.delete(flow.roleId);
  const task=state.tasks.find(task=>task.id===flow.taskId)||state.tasks.find(task=>task.roleId===flow.roleId&&task.enabled)||state.tasks.find(task=>task.roleId===flow.roleId);
  if(task){const result=await checkTaskVerification(task);if(result.available)await resumeVerifiedRoleTasks(task.roleId);}else toast('会话已同步，请通过任务请求确认验证状态');
 }catch(error){toast(error.message);desktopVerificationFlow=null;roleOperations.delete(flow.roleId);closeModal();}
 finally{await loadRoles();}
}
window.desktopVerification?.onClosed(value=>{if(desktopVerificationFlow?.roleId===value.roleId)void finishDesktopVerification({closed:true,error:value.error});});
document.addEventListener('click',event=>{const action=event.target.closest('button')?.dataset.action;if(action==='finish-official-verification')void finishDesktopVerification();if(action==='focus-official-verification')void navigateDesktopVerification('focus');if(action==='retry-official-verification')void navigateDesktopVerification('account');if(action==='search-official-verification')void navigateDesktopVerification('search');if(action==='login-official-verification')void navigateDesktopVerification('login');});
