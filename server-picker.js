/* Shared regional server picker, shown in a task dropdown or role login dialog. */
const SERVER_LIST_URL='https://cbg-xyq.res.netease.com/js/server_list_data.js';
let serverList=[],serverLoadState='loading',serverLoadError='';
let serverPageOpen=false,serverQuery='',pendingServerKeys=new Set(),expandedRegions=new Set();
let serverPickerContext={multiple:true},serverPickerParent=null;
const SERVER_HISTORY_KEY='cbg:server-history:v1';
function serverHistory(){
 try{const data=JSON.parse(localStorage.getItem(SERVER_HISTORY_KEY)||'[]');if(!Array.isArray(data))return [];const records=data.filter(r=>Array.isArray(r.keys)&&r.keys.every(k=>typeof k==='string')).slice(0,5);if(data.length>5){try{localStorage.setItem(SERVER_HISTORY_KEY,JSON.stringify(records));}catch{}}return records;}catch{return [];}
}
function rememberServers(keys){
 const valid=[...keys].filter(k=>serverList.some(s=>s.key===k)).sort();if(!valid.length)return;
 const signature=JSON.stringify(valid),records=serverHistory().filter(r=>JSON.stringify([...r.keys].sort())!==signature);
 try{localStorage.setItem(SERVER_HISTORY_KEY,JSON.stringify([{keys:valid,at:Date.now()},...records].slice(0,5)));}catch{toast('服务器已选择，但选择记录保存失败');}
}
function serverHistoryMarkup(){
 const records=serverHistory().map((r,index)=>({...r,index,servers:serverList.filter(s=>r.keys.includes(s.key))})).filter(r=>r.servers.length&&(serverPickerContext.multiple||r.servers.length===1));
 return records.length?`<div class="server-history"><strong>最近选择</strong><div>${records.map(r=>`<button type="button" data-server-history="${r.index}" title="${esc(r.servers.map(s=>s.name).join('、'))}">${esc(r.servers.slice(0,3).map(s=>s.name).join('、'))}${r.servers.length>3?' 等 '+r.servers.length+' 个':''}</button>`).join('')}</div></div>`:'';
}
function parseServerList(source){
 const match=source.match(/\bvar\s+server_data\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
 if(!match)throw new Error('服务器列表格式无法识别');
 const groups=JSON.parse(match[1]), list=[];
 for(const [regionId,group] of Object.entries(groups)){
  if(!Array.isArray(group)||!Array.isArray(group[0])||typeof group[0][0]!=='string'||!Array.isArray(group[1]))throw new Error('服务器列表格式无效');
  const region=group[0][0];
  for(const row of group[1]){
   if(!Array.isArray(row)||!Number.isInteger(row[0])||typeof row[1]!=='string')throw new Error('服务器数据格式无效');
   list.push({key:`${regionId}:${row[0]}:${row[1]}`,id:row[0],name:row[1],region,regionId,pinyin:String(row[3]||''),initials:String(row[4]||''),regionPinyin:String(group[0][3]||'')});
  }
 }
 if(!list.length)throw new Error('服务器列表为空');
 const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
 return list.sort((a,b)=>collator.compare(a.regionPinyin,b.regionPinyin)||collator.compare(a.pinyin,b.pinyin)||a.name.localeCompare(b.name,'zh-Hans-CN-u-co-pinyin'));
}
async function loadServers(){
 serverLoadState='loading';serverLoadError='';renderServerPicker();
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(SERVER_LIST_URL,{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  serverList=parseServerList(await response.text());serverLoadState='ready';
 }catch(error){serverList=[];serverLoadState='error';serverLoadError=error.name==='AbortError'?'请求超时，请重试':error.message;}
 finally{clearTimeout(timeout);renderServerPicker();}
}
function regionInitial(server){return (/^[A-Z]/.exec(String(server.regionPinyin||'').trim().toUpperCase())||['#'])[0];}
function serverPicker(){
 if(serverLoadState==='loading')return '<div class="server-message" role="status">正在加载服务器列表…</div>';
 if(serverLoadState==='error')return `<div class="server-message error" role="alert">服务器列表加载失败：${esc(serverLoadError)}<button type="button" class="text-button" data-action="retry-servers">重新加载</button></div>`;
 const selected=serverList.filter(server=>pendingServerKeys.has(server.key)).length;
 const search=serverQuery.trim().toLocaleLowerCase();
 const visible=serverList.filter(server=>!search||server.name.toLocaleLowerCase().includes(search)||server.region.toLocaleLowerCase().includes(search)||server.pinyin.toLowerCase().includes(search)||server.initials.toLowerCase().includes(search)||String(server.regionPinyin||'').toLowerCase().includes(search));
 const groups=new Map();for(const server of visible){if(!groups.has(server.regionId))groups.set(server.regionId,{name:server.region,initial:regionInitial(server),items:[]});groups.get(server.regionId).items.push(server);}
 const regionSelected=id=>serverList.filter(server=>server.regionId===id&&pendingServerKeys.has(server.key)).length;
 const initials=[...new Set([...groups.values()].map(group=>group.initial))];
 return `${serverHistoryMarkup()}<div class="server-toolbar"><span id="server-selection-count" aria-live="polite">${serverPickerContext.multiple&&!selected?'全服（未限定服务器）':`已选 ${selected} / ${serverList.length} 个服务器`}</span>${serverPickerContext.multiple?`<button type="button" class="server-select-all" data-action="clear-servers">一键清空</button>`:''}</div><div class="server-picker-body"><div class="server-options" tabindex="0" aria-label="大区列表">${visible.length?[...groups.entries()].map(([id,group])=>`<details class="server-group" data-region="${esc(id)}" data-initial="${esc(group.initial)}" ${search||expandedRegions.has(id)?'open':''}><summary><span>${esc(group.name)}<span class="server-region-dot" data-region-dot="${esc(id)}" role="img" aria-label="该大区已选择服务器" ${regionSelected(id)?'':'hidden'}></span></span><span class="region-selection-count ${regionSelected(id)?'has-selection':''}" data-region-count="${esc(id)}">${regionSelected(id)?'已选 '+regionSelected(id)+' 个':'未选择'}</span>${icon('arrow')}</summary><div class="server-group-options">${group.items.map(server=>`<label class="server-option"><input type="${serverPickerContext.multiple?'checkbox':'radio'}" name="servers" value="${esc(server.key)}" ${pendingServerKeys.has(server.key)?'checked':''}><span>${esc(server.name)}</span></label>`).join('')}</div></details>`).join(''):empty('没有找到服务器','')}</div><nav class="server-initials" aria-label="大区拼音首字母">${initials.map(letter=>`<button type="button" data-server-initial="${letter}" aria-label="跳转到 ${letter} 开头的大区">${letter}</button>`).join('')}</nav></div>`;
}
function renderServerPicker(){const picker=document.querySelector('#server-picker');if(picker)picker.innerHTML=serverPicker();}

const ServerPicker=Object.freeze({
 open({selected=[],multiple=true,onConfirm=()=>{},returnLabel='返回设置',presentation='modal'}={}){
  if(serverPageOpen)return;
  serverPickerParent=document.querySelector('#overlay .modal');
  serverPickerContext={multiple,onConfirm,returnLabel,presentation};pendingServerKeys=new Set(multiple?selected:[...selected].slice(0,1));serverQuery='';serverPageOpen=true;
  if(presentation==='dropdown'){
   const dropdown=document.querySelector('#task-server-dropdown');
   dropdown.innerHTML=`<div class="server-dropdown-head"><strong>选择服务器</strong><button type="button" class="text-button" data-action="cancel-servers" aria-label="收起服务器选择">收起</button></div><div class="server-search">${icon('search')}<input id="server-search" type="search" placeholder="搜索服务器、拼音或大区" aria-label="搜索服务器"></div><div id="server-picker" role="group" aria-label="服务器列表">${serverPicker()}</div><div class="server-dropdown-footer"><span>最多选8个；不选表示全服</span><button type="button" class="button primary" data-action="confirm-servers">确认选择</button></div>`;
   dropdown.showPopover();document.querySelector('#choose-servers').setAttribute('aria-expanded','true');positionServerDropdown();document.querySelector('#server-search').focus();return;
  }
  openModal(`<div class="modal-head"><h2 id="dialog-title">选择服务器</h2><button type="button" class="icon-button" data-action="cancel-servers" aria-label="${esc(returnLabel)}">${icon('close')}</button></div><p>${multiple?'最多选择8个服务器；不选择表示全服':'请选择一个登录服务器'}，可搜索服务器名称、拼音或大区。</p><div class="server-search">${icon('search')}<input id="server-search" type="search" placeholder="搜索服务器或大区" aria-label="搜索服务器"></div><div id="server-picker" role="group" aria-label="服务器列表">${serverPicker()}</div><div class="modal-actions"><button type="button" class="button secondary" data-action="cancel-servers">返回</button><button type="button" class="button primary" data-action="confirm-servers">确认选择</button></div>`,'server-selection-page');
 },
 close(confirm=false,{restoreFocus=true}={}){
  if(!serverPageOpen)return;
  if(confirm&&!serverPickerContext.multiple&&pendingServerKeys.size!==1){toast('请选择一个登录服务器');return;}
  if(confirm&&serverPickerContext.multiple&&pendingServerKeys.size>8&&!serverList.every(s=>pendingServerKeys.has(s.key))){toast('部分区服搜索最多选择8个服务器，请缩小范围或选择全服');return;}
  const context=serverPickerContext,parent=serverPickerParent,selected=new Set(context.multiple&&serverList.length&&serverList.every(s=>pendingServerKeys.has(s.key))?[]:pendingServerKeys);
  serverPageOpen=false;serverPickerParent=null;
  if(context.presentation==='dropdown'){
   const dropdown=document.querySelector('#task-server-dropdown');dropdown?.hidePopover();if(dropdown)dropdown.innerHTML='';
   document.querySelector('#choose-servers')?.setAttribute('aria-expanded','false');
   if(confirm){rememberServers(selected);context.onConfirm(selected);}
   if(restoreFocus)document.querySelector('#choose-servers')?.focus();return;
  }
  document.querySelector('#overlay').replaceChildren(...(parent?[parent]:[]));document.querySelector('#overlay').hidden=!parent;
  if(confirm){rememberServers(selected);context.onConfirm(selected);}
  document.querySelector('.modal')?.focus();
 }
});
function updateServerCounts(){
 const count=serverList.filter(server=>pendingServerKeys.has(server.key)).length;
 document.querySelector('#server-selection-count').textContent=serverPickerContext.multiple&&!count?'全服（未限定服务器）':`已选 ${count} / ${serverList.length} 个服务器`;
 for(const group of document.querySelectorAll('.server-group')){
  const count=serverList.filter(server=>server.regionId===group.dataset.region&&pendingServerKeys.has(server.key)).length;
  const label=group.querySelector('.region-selection-count');label.textContent=count?'已选 '+count+' 个':'未选择';label.classList.toggle('has-selection',count>0);
  group.querySelector('[data-region-dot]').hidden=count===0;
 }
}
function selectServerHistory(index){
 if(!serverPageOpen)return;
 const record=serverHistory()[index];if(!record)return;
 const keys=serverList.filter(s=>record.keys.includes(s.key)).map(s=>s.key);if(!keys.length)return;
 pendingServerKeys=new Set(serverPickerContext.multiple?keys:keys.slice(0,1));
 ServerPicker.close(true);
}
document.addEventListener('keydown',event=>{if(serverPageOpen&&serverPickerContext.presentation==='dropdown'&&event.key==='Enter'&&event.target.matches?.('input')){event.preventDefault();return;}if(serverPageOpen&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();ServerPicker.close(false);}});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.serverHistory!==undefined&&serverPageOpen){
  selectServerHistory(Number(button.dataset.serverHistory));
 }
 else if(button.dataset.serverInitial){const group=[...document.querySelectorAll('.server-group')].find(group=>group.dataset.initial===button.dataset.serverInitial);if(group){group.scrollIntoView({block:'start',behavior:'auto'});group.querySelector('summary')?.focus({preventScroll:true});}}
 else if(button.dataset.action==='confirm-servers')ServerPicker.close(true);
 else if(button.dataset.action==='cancel-servers')ServerPicker.close(false);
 else if(button.dataset.action==='retry-servers')await loadServers();
 else if(button.dataset.action==='clear-servers'&&serverPageOpen&&serverPickerContext.multiple)clearServerSelection();
});
document.addEventListener('input',event=>{if(event.target.id==='server-search'){serverQuery=event.target.value;renderServerPicker();}});
document.addEventListener('change',event=>{
 if(!serverPageOpen||!event.target.matches('input[name="servers"]'))return;
 if(!serverPickerContext.multiple)pendingServerKeys.clear();
 if(event.target.checked&&serverPickerContext.multiple){const trial=new Set([...pendingServerKeys,event.target.value]);if(trial.size>8&&!serverList.every(s=>trial.has(s.key))){event.target.checked=false;toast('部分区服搜索最多选择8个服务器；如需全服，请一键清空后确认');return;}}
 if(event.target.checked)pendingServerKeys.add(event.target.value);else pendingServerKeys.delete(event.target.value);
 updateServerCounts();
});
document.addEventListener('toggle',event=>{
 if(event.target.matches('.server-group')&&!serverQuery.trim()){
  if(event.target.open)expandedRegions.add(event.target.dataset.region);else expandedRegions.delete(event.target.dataset.region);
 }
},true);

function positionServerDropdown(){
 if(!serverPageOpen||serverPickerContext.presentation!=='dropdown')return;
 const dropdown=document.querySelector('#task-server-dropdown'),anchor=document.querySelector('#choose-servers');if(!dropdown||!anchor)return;
 const area=document.querySelector('.task-filter-panel'),layout=document.querySelector('.task-editor-body');
 if(area&&layout&&getComputedStyle(layout).display==='grid'){
  const rect=area.getBoundingClientRect();
  dropdown.style.left=(rect.left+10)+'px';dropdown.style.top=(rect.top+10)+'px';
  dropdown.style.width=Math.max(0,rect.width-20)+'px';dropdown.style.height=Math.max(0,rect.height-20)+'px';
 }else{
  dropdown.style.left='16px';dropdown.style.top='24px';
  dropdown.style.width=Math.max(0,window.innerWidth-32)+'px';dropdown.style.height=Math.max(0,window.innerHeight-48)+'px';
 }
}
window.addEventListener('resize',positionServerDropdown);
document.addEventListener('click',event=>{if(serverPageOpen&&serverPickerContext.presentation==='dropdown'&&!serverPickerEventInside(event))ServerPicker.close(false,{restoreFocus:false});});

function clearServerSelection(){pendingServerKeys.clear();renderServerPicker();}
// The original event path survives rerenders that detach the clicked button.
function serverPickerEventInside(event){return event.composedPath().some(node=>node.id==='task-server-dropdown'||node.id==='choose-servers');}
