/* Official option dictionaries are fetched as text and parsed as JSON, never executed. */
const SEARCH_CONFIG_URL='https://cbg-xyq.res.netease.com/js/auto_search_config.js';
const SEARCH_CONFIG_STORAGE_KEY='cbg:auto-search-config';
let autoSearchConfig=null, searchConfigState='loading', searchConfigError='', searchConfigSavedAt=null, searchConfigSaveError='';
let suitPageOpen=false, pendingSuits=[], suitQuery='';
const equipmentSections=[['price','价格（元）'],['level','等级'],['type','类型'],['skills','特技'],['effects','特效'],['suit','套装'],['attributes','属性'],['sum','属性计算'],['gems','镶嵌宝石'],['extra','160级装备特性'],['holes','装备开运'],['repair','装备修理失败'],['source','装备出处']];
const equipmentAttributeFields=[['totalDamage','总伤'],['initialDamageIncludingHit','初伤（包含命中）'],['initialDamageExcludingHit','初伤（不含命中）'],['initialSpirit','初灵'],['totalSpirit','总灵'],['initialDefense','初防'],['initialHp','初血'],['initialAgility','初敏'],['damage','伤害']];
const suitSources=[['suit_transform_skills','变身术'],['suit_added_status','附加状态'],['suit_append_skills','追加法术'],['suit_transform_charms','变化咒之']];
// Rows transcribed top to bottom from the user's five tables; rendered in reverse.
// IDs are always resolved from the freshly downloaded official dictionary.
const transformSuitGroups=[
 {key:'agility',label:'敏捷套',rows:['赌徒','大蝙蝠','骷髅怪','狐狸精','狼','虾兵','兔子怪','雷鸟人','风伯','凤凰','幽灵','吸血鬼','画魂','雾中仙','机关鸟','巴蛇','猫灵（人型）','修罗傀儡妖']},
 {key:'magic',label:'魔力套',rows:['巨蛙','花妖','小龙女','蜘蛛精','蝴蝶仙子','古代瑞兽','蛟龙','雨师','如意仙子','星灵仙子','净瓶女娲','灵符女娲','灵鹤','炎魔神','葫芦宝贝','混沌兽','长眉灵猴','蜃气妖']},
 {key:'strength',label:'力量套',rows:['强盗','海毛虫','蛤蟆精','老虎','马面','天将','地狱战神','巡游天神','鬼将','夜罗刹','噬天虎','狂豹（人型）','巨力神猿','修罗傀儡鬼']},
 {key:'constitution',label:'体质套',rows:['大海龟','树怪','山贼','野猪','黑熊','野鬼','龟丞相','黑熊精','僵尸','白熊','黑山老妖','大力金刚','踏云兽','机关兽','金身罗汉','藤蔓妖花']},
 {key:'endurance',label:'耐力套',rows:['护卫','羊头怪','牛妖','蟹将','牛头','天兵','芙蓉仙子','律法女娲','幽萤娃娃','红萼仙子','龙龟','连弩车','蝎子精','曼珠沙华']}
];
function groupedSuitOptions(){
 const source='suit_transform_skills',all=objectOptions(autoSearchConfig[source]);
 const byName=new Map(all.map(option=>[option.label,option])),assigned=new Set();
 const groups=transformSuitGroups.map(group=>({key:group.key,label:group.label,source,options:group.rows.slice().reverse().map(name=>byName.get(name)).filter(Boolean).map(option=>{assigned.add(option.value);return option;})}));
 const other=all.filter(option=>!assigned.has(option.value));
 if(other.length)groups.push({key:'transform-other',label:'变身术（其他）',source,options:other});
 for(const [source,label] of suitSources.slice(1))groups.push({key:source,label,source,options:objectOptions(autoSearchConfig[source])});
 return groups;
}
function suitIsSelected(source,value){return pendingSuits.some(selection=>selection.source===source&&selection.value===value);}

function parseSearchConfig(source){
 const match=source.match(/^\s*var\s+AUTO_SEARCH_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
 if(!match)throw new Error('筛选配置格式无法识别');
 const config=JSON.parse(match[1]);
 if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('筛选配置格式无效');
 for(const field of ['weapon_armors','equip_special_skills','wjd_equip_level'])if(!Array.isArray(config[field])||!config[field].length)throw new Error(`缺少配置：${field}`);
 for(const field of ['equip_special_effect','gems_name','equip_160_attrs','sum_attrs',...suitSources.map(([key])=>key)]){
  if(!config[field]||typeof config[field]!=='object'||Array.isArray(config[field]))throw new Error(`缺少配置：${field}`);
 }
 if(config.weapon_armors.some(row=>!Array.isArray(row)||row.length<2||typeof row[1]!=='string')||config.equip_special_skills.some(row=>!Array.isArray(row)||row.length<2||typeof row[1]!=='string'))throw new Error('装备选项格式无效');
 return config;
}
async function loadSearchConfig(){
 searchConfigState='loading';searchConfigError='';searchConfigSaveError='';renderEquipmentOptions();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(SEARCH_CONFIG_URL,{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const config=parseSearchConfig(await response.text());
  const fetchedAt=new Date().toISOString();
  try{localStorage.setItem(SEARCH_CONFIG_STORAGE_KEY,JSON.stringify({sourceUrl:SEARCH_CONFIG_URL,fetchedAt,config}));searchConfigSavedAt=fetchedAt;}
  catch(error){searchConfigSavedAt=null;searchConfigSaveError='配置已加载，但浏览器本地保存失败';}
  autoSearchConfig=config;searchConfigState='ready';
 }catch(error){autoSearchConfig=null;searchConfigState='error';searchConfigError=error.name==='AbortError'?'请求超时，请重试':error.message;}
 finally{clearTimeout(timer);renderEquipmentOptions();if(typeof renderPetOptions==='function')renderPetOptions();if(typeof renderRoleSearchOptions==='function')renderRoleSearchOptions();if(typeof renderPetEquipmentOptions==='function')renderPetEquipmentOptions();if(typeof renderLingshiOptions==='function')renderLingshiOptions();if(typeof renderYupoOptions==='function')renderYupoOptions();}
}
function equipmentFilters(){const filters=taskDraft.equipmentFilters||(taskDraft.equipmentFilters={});if(filters.type!==undefined){if(!Array.isArray(filters.types))filters.types=[String(filters.type)];delete filters.type;}return filters;}
function objectOptions(object){return Object.entries(object).map(([value,label])=>({value:String(value),label}));}
function pairOptions(rows){return rows.map(([value,label])=>({value:String(value),label}));}
function equipmentChoices(field,options,multi=false){
 const filters=equipmentFilters(),selected=filters[field];
 return `<div class="equipment-choices" role="group">${options.map(option=>{
  const active=multi?Array.isArray(selected)&&selected.includes(option.value):String(selected??'')===String(option.value);
  return `<button type="button" class="equipment-chip ${active?'selected':''}" data-equip-field="${field}" data-equip-value="${esc(option.value)}" ${multi?'data-equip-multi="true"':''} aria-pressed="${active}">${esc(option.label)}</button>`;
 }).join('')}</div>`;
}
function equipmentNumber(field,label,{min=0,step='1'}={}){
 const value=equipmentFilters()[field]??'';
 return `<label class="equipment-number"><span>${esc(label)}</span><span class="equipment-threshold"><span aria-hidden="true">≥</span><input type="number" min="${min}" step="${step}" data-equip-input="${field}" value="${esc(value)}" aria-label="${esc(label)}" placeholder="不限"></span></label>`;
}
function equipmentSwitch(field,label){return `<label class="equipment-switch-row"><span>${label}</span><input type="checkbox" data-equip-input="${field}" ${equipmentFilters()[field]?'checked':''}></label>`;}
function equipmentSection(id,body){return `<details id="equip-${id}" class="equipment-section" open><summary>${filterSectionLabel('装备',id,equipmentSections.find(([key])=>key===id)[1])}${icon('arrow')}</summary><div class="equipment-section-body">${body}</div></details>`;}
function suitLabel(selection){if(!selection)return '';return autoSearchConfig?.[selection.source]?.[selection.value]||'';}
function equipmentFiltersView(){
 if(searchConfigState==='loading')return '<div class="equipment-load" role="status">正在加载官方筛选配置…</div>';
 if(searchConfigState==='error')return `<div class="equipment-load error" role="alert">筛选配置加载失败：${esc(searchConfigError)}<button type="button" class="text-button" data-action="retry-search-config">重新加载</button></div>`;
 const c=autoSearchConfig,f=equipmentFilters();
 const aliases={'21':'饰物','18':'铠甲','17':'头盔'};
 const allTypes=pairOptions(c.weapon_armors).map(type=>({...type,label:aliases[type.value]||type.label}));
 const sumOptions=objectOptions(c.sum_attrs).sort((a,b)=>['physique','magic','power','endurance','dex'].indexOf(a.value)-['physique','magic','power','endurance','dex'].indexOf(b.value));
 const sections=[
  equipmentSection('price',`<div class="equipment-price-range"><label><span class="sr-only">最低价格（元）</span><input type="number" min="0" step="0.01" data-equip-input="minPrice" value="${esc(f.minPrice??'')}" placeholder="最低价格" aria-label="最低价格（元）"></label><span>—</span><label><span class="sr-only">最高价格（元）</span><input type="number" min="0" step="0.01" data-equip-input="maxPrice" value="${esc(f.maxPrice??'')}" placeholder="最高价格" aria-label="最高价格（元）"></label></div>`),
  equipmentSection('level',`<div class="equipment-price-range"><input type="number" min="60" max="160" step="1" data-equip-input="levelMin" value="${esc(f.levelMin??'')}" placeholder="最低" aria-label="最低装备等级"><span>—</span><input type="number" min="60" max="160" step="1" data-equip-input="levelMax" value="${esc(f.levelMax??'')}" placeholder="最高" aria-label="最高装备等级"></div>${f.levels?.length?`<p class="equipment-selection-hint">原任务等级：${esc(f.levels.join('、'))}；填写新范围后将覆盖。</p>`:''}`),
  equipmentSection('type',`<p class="equipment-selection-hint">可多选，不选择则不限类型</p>`+equipmentChoices('types',allTypes,true)),
  equipmentSection('skills',`<p class="equipment-selection-hint">可多选</p>`+equipmentChoices('specialSkills',pairOptions(c.equip_special_skills),true)),
  equipmentSection('effects',`<label class="equipment-mode">筛选方式<select data-equip-input="effectMode" aria-label="特效筛选方式"><option value="all" ${f.effectMode!=='any'?'selected':''}>全部满足</option><option value="any" ${f.effectMode==='any'?'selected':''}>满足任意</option></select></label>`+equipmentChoices('specialEffects',objectOptions(c.equip_special_effect),true)),
  equipmentSection('suit',`<button type="button" class="equipment-suit-button" data-action="choose-suit"><span>${f.suits?.length?'已选择 '+f.suits.length+' 个套装':'选择套装（可多选）'}</span>${icon('arrow')}</button>${f.suits?.length?`<div class="equipment-selected-suits">${esc(f.suits.map(suitLabel).filter(Boolean).join('、'))}</div><button type="button" class="equipment-clear-suit" data-action="clear-suit">清除套装</button>`:''}`),
  equipmentSection('attributes',`<div class="equipment-attribute-grid">${equipmentAttributeFields.map(([key,label])=>equipmentNumber(key,label)).join('')}</div>`),
  equipmentSection('sum',equipmentChoices('sumAttributes',sumOptions,true)+equipmentNumber('sumMinimum','属性总和')),
  equipmentSection('gems',equipmentChoices('gems',objectOptions(c.gems_name),true)+equipmentNumber('gemLevel','宝石锻炼等级',{step:'1'})+equipmentSwitch('excludeMixedGems','过滤混打宝石')),
  equipmentSection('extra',equipmentChoices('extra160',objectOptions(c.equip_160_attrs))),
  equipmentSection('holes',equipmentNumber('holeCount','装备开孔数目',{step:'1'})+equipmentSwitch('activatedStarPosition','限开启星位')),
  equipmentSection('repair',equipmentChoices('repairFailures',[{value:'0',label:'无失败'},{value:'1',label:'≤1次'},{value:'2',label:'≤2次'},{value:'3',label:'≤3次'}])),
  equipmentSection('source',equipmentChoices('origin',[{value:'system',label:'系统产出'},{value:'normal',label:'普通打造'},{value:'enhanced',label:'强化打造'}]))
 ];
 return `<section class="equipment-filter" data-category="装备"><div class="equipment-header"><strong>装备筛选</strong><button type="button" class="text-button" data-action="reset-equipment">清除筛选</button></div>${searchConfigSaveError?`<p class="equipment-save-error" role="alert">${searchConfigSaveError}</p>`:''}<div class="equipment-layout"><nav class="equipment-section-nav" aria-label="装备筛选分组">${equipmentSections.map(([id,label])=>`<button type="button" data-equip-section="${id}">${filterSectionLabel('装备',id,label)}</button>`).join('')}</nav><div class="equipment-scroll">${sections.join('')}</div></div></section>`;
}
function renderEquipmentOptions(){
 if(!taskDraft||taskDraft.category!=='装备'||serverPageOpen||suitPageOpen)return;
 const target=document.querySelector('#category-options');if(target)target.innerHTML=equipmentFiltersView();
}
function refreshEquipmentControls(){
 const scroller=document.querySelector('.equipment-scroll'),top=scroller?.scrollTop||0;
 const folded=[...document.querySelectorAll('.equipment-section:not([open])')].map(el=>el.id);
 renderEquipmentOptions();
 for(const id of folded){const section=document.getElementById(id);if(section)section.open=false;}
 const current=document.querySelector('.equipment-scroll');if(current)current.scrollTop=top;
}
function validateEquipmentFilters(){
 const f=equipmentFilters();
 if(searchConfigState!=='ready')return '请等待装备筛选配置加载成功后再提交';
 if(searchConfigSaveError)return '筛选配置尚未成功保存，请检查浏览器本地存储权限后重新加载页面';
 for(const key of ['minPrice','maxPrice',...equipmentAttributeFields.map(([key])=>key),'sumMinimum','gemLevel','holeCount']){
  if(f[key]!==undefined&&f[key]!==''&&(!Number.isFinite(Number(f[key]))||Number(f[key])<0))return '筛选数值必须为有效的非负数';
 }
 if(f.minPrice!==undefined&&f.minPrice!==''&&f.maxPrice!==undefined&&f.maxPrice!==''&&Number(f.minPrice)>Number(f.maxPrice))return '最低价格不能高于最高价格';
 if(f.sumMinimum!==undefined&&f.sumMinimum!==''&&!(f.sumAttributes||[]).length)return '请先选择参与属性总和计算的属性';
 for(const key of ['gemLevel','holeCount'])if(f[key]!==undefined&&f[key]!==''&&!Number.isInteger(Number(f[key])))return '宝石等级和开孔数目必须为整数';
 return '';
}
function suitPicker(){
 const query=suitQuery.trim();
 return groupedSuitOptions().map(group=>{
  const {source,label,key}=group;
  const options=group.options.filter(option=>!query||option.label.includes(query)||label.includes(query)||(source==='suit_transform_skills'&&'变身术'.includes(query)));
  if(!options.length)return '';
  return `<details class="suit-group" data-suit-group="${esc(key)}" open><summary>${label}${icon('arrow')}</summary><div class="equipment-choices">${options.map(option=>`<button type="button" class="equipment-chip ${suitIsSelected(source,option.value)?'selected':''}" data-suit-source="${source}" data-suit-value="${esc(option.value)}" aria-pressed="${suitIsSelected(source,option.value)}">${esc(option.label)}</button>`).join('')}</div></details>`;
 }).join('')||empty('没有找到套装','');
}
function openSuitPage(){
 captureTaskDraft();pendingSuits=(equipmentFilters().suits||[]).map(selection=>({...selection}));suitQuery='';suitPageOpen=true;
 openModal(`<div class="modal-head"><h2 id="dialog-title">选择套装</h2><button type="button" class="icon-button" data-action="cancel-suit" aria-label="返回任务设置">${icon('close')}</button></div><p>变身术按属性分类，可跨分类多选，点击已选项可取消。</p><div class="server-search">${icon('search')}<input id="suit-search" type="search" placeholder="搜索套装名称或属性分类" aria-label="搜索套装"></div><div id="suit-selection-count" class="suit-selection-status" role="status" aria-live="polite">已选择 ${pendingSuits.length} 个套装</div><div id="suit-picker">${suitPicker()}</div><div class="modal-actions"><button type="button" class="button secondary" data-action="reset-suit">重置</button><div><button type="button" class="button secondary" data-action="cancel-suit">返回</button><button type="button" class="button primary" data-action="confirm-suit">完成</button></div></div>`,'suit-selection-page');
}
function returnFromSuit(confirm){
 if(confirm){if(pendingSuits.length)equipmentFilters().suits=pendingSuits.map(selection=>({...selection}));else delete equipmentFilters().suits;}
 suitPageOpen=false;renderTaskEditor();document.querySelector('[data-action="choose-suit"]').focus();
}
function updateSuitSelection(){
 for(const option of document.querySelectorAll('[data-suit-source]')){
  const active=suitIsSelected(option.dataset.suitSource,option.dataset.suitValue);
  option.classList.toggle('selected',active);option.setAttribute('aria-pressed',String(active));
 }
 document.querySelector('#suit-selection-count').textContent=`已选择 ${pendingSuits.length} 个套装`;
}
function updateEquipmentInput(input){
 if(!taskDraft)return;
 const f=equipmentFilters(),field=input.dataset.equipInput;
 f[field]=input.type==='checkbox'?input.checked:input.value;
 if(['levelMin','levelMax'].includes(field)&&(f.levelMin!==''||f.levelMax!==''))delete f.levels;
}
document.addEventListener('input',event=>{
 if(event.target.matches('[data-equip-input]'))updateEquipmentInput(event.target);
 if(event.target.id==='suit-search'){suitQuery=event.target.value;document.querySelector('#suit-picker').innerHTML=suitPicker();}
});
document.addEventListener('change',event=>{if(event.target.matches('[data-equip-input]'))updateEquipmentInput(event.target);});
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.action==='retry-search-config'){await loadSearchConfig();return;}
 if(!taskDraft)return;
 const f=equipmentFilters();
 if(button.dataset.equipField){
  const field=button.dataset.equipField,value=button.dataset.equipValue;
  if(button.dataset.equipMulti){const values=new Set(f[field]||[]);if(values.has(value))values.delete(value);else values.add(value);f[field]=[...values];}
  else{if(String(f[field]??'')===value)delete f[field];else f[field]=value;}
  refreshEquipmentControls();
 }
 else if(button.dataset.equipSection){const target=document.getElementById('equip-'+button.dataset.equipSection);if(target){target.open=true;const container=target.closest('.equipment-scroll');container.scrollTop=target.offsetTop;}}
 else if(button.dataset.action==='reset-equipment'){taskDraft.equipmentFilters={};refreshEquipmentControls();}
 else if(button.dataset.action==='choose-suit')openSuitPage();
 else if(button.dataset.action==='cancel-suit')returnFromSuit(false);
 else if(button.dataset.action==='confirm-suit')returnFromSuit(true);
 else if(button.dataset.action==='clear-suit'){delete f.suits;refreshEquipmentControls();}
 else if(button.dataset.action==='reset-suit'){pendingSuits=[];updateSuitSelection();}
 else if(button.dataset.suitSource){
  const source=button.dataset.suitSource,value=button.dataset.suitValue;
  if(suitIsSelected(source,value))pendingSuits=pendingSuits.filter(selection=>!(selection.source===source&&selection.value===value));
  else pendingSuits.push({source,value});
  updateSuitSelection();
 }

});

function filterSectionLabel(category,id,label){const fields=category==='装备'?'equipmentFilters':category==='召唤兽'?'petFilters':category==='召唤兽装备'?'petEquipmentFilters':category==='上古玉魄'?'yupoFilters':category==='灵饰'?'lingshiFilters':'roleFilters';return `<span>${esc(label)}<span class="filter-filled-dot" data-filter-indicator="${id}" role="img" aria-label="已设置筛选条件" ${FilterIndicators.active(category,id,taskDraft?.[fields])?'':'hidden'}></span></span>`;}
function refreshFilterIndicators(){if(!taskDraft)return;const category=taskDraft.category,fields=category==='装备'?'equipmentFilters':category==='召唤兽'?'petFilters':category==='召唤兽装备'?'petEquipmentFilters':category==='上古玉魄'?'yupoFilters':category==='灵饰'?'lingshiFilters':'roleFilters';document.querySelectorAll('[data-filter-indicator]').forEach(dot=>{dot.hidden=!FilterIndicators.active(category,dot.dataset.filterIndicator,taskDraft[fields]);});}
