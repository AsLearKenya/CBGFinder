/* Pet choices come from the same freshly downloaded official configuration as equipment. */
let petTypeQuery='',petSkillQuery='';
const petSections=[['price','价格（元）'],['level','等级'],['fight','参战等级'],['stage','成品 / 胚子'],['baby','只显示宝宝'],['class','召唤兽分类'],['skills','技能'],['evol','赐福技能'],['excluded','不含技能'],['overview','概况'],['type','类型'],['stars','神兽星级'],['aptitudes','资质'],['attributes','属性'],['traits','特性'],['neidan','内丹'],['appearance','召唤兽梦影']];
function petFilters(){return taskDraft.petFilters||(taskDraft.petFilters={});}
function petOptions(rows){return (rows||[]).map(row=>Array.isArray(row)?{value:String(row[0]),label:row[1]}:{...row,value:String(row.value)});}
function petChoices(field,options,{skills=false,single=false}={}){
 const selected=petFilters()[field]??(single?'':[]);
 return `<div class="equipment-choices ${skills?'pet-skill-grid':''}">${options.map(option=>{const active=single?selected===option.value:selected.includes(option.value);const desc=skills?SearchResults.text(autoSearchConfig?.pet_skill_desc?.[option.value]?.desc):'';return `<button type="button" class="equipment-chip ${skills?'pet-skill-chip ':''}${active?'selected':''}" data-pet-field="${field}" data-pet-value="${esc(option.value)}" ${single?'data-pet-single="true"':''} aria-pressed="${active}" title="${esc(desc||option.label)}">${skills?`<img loading="lazy" referrerpolicy="no-referrer" alt="" src="https://cbg-xyq.res.netease.com/images/skill/${option.value.padStart(4,'0')}.gif">`:''}<span>${esc(option.label)}</span></button>`;}).join('')}</div>`;
}
function petNumber(field,label,{step='1',max,operator='≥'}={}){
 const bounds=SearchParams.petNumericFields[field];
 return `<label class="equipment-number"><span>${esc(label)}</span><span class="equipment-threshold"><span aria-hidden="true">${operator}</span><input type="number" min="0" ${max!==undefined||bounds?`max="${max??bounds[1]}"`:''} step="${step}" data-pet-input="${field}" value="${esc(petFilters()[field]??'')}" placeholder="不限" aria-label="${esc(label)}"></span></label>`;
}
function petSwitch(field,label){return `<label class="equipment-switch-row"><span>${esc(label)}</span><input type="checkbox" data-pet-input="${field}" ${petFilters()[field]?'checked':''}></label>`;}
function petSection(id,content){return `<details class="equipment-section" id="pet-${id}" open><summary>${filterSectionLabel('召唤兽',id,petSections.find(([key])=>key===id)[1])}${icon('arrow')}</summary><div class="equipment-section-body">${content}</div></details>`;}
function petRange(minKey,maxKey,label,step='1'){const f=petFilters();return `<div class="equipment-price-range"><input type="number" min="0" step="${step}" data-pet-input="${minKey}" value="${esc(f[minKey]??'')}" placeholder="最低" aria-label="最低${label}"><span>—</span><input type="number" min="0" step="${step}" data-pet-input="${maxKey}" value="${esc(f[maxKey]??'')}" placeholder="最高" aria-label="最高${label}"></div>`;}
function petTypeOptions(){return petOptions(autoSearchConfig?.pet_type_info_for_app||autoSearchConfig?.pet_type_info_for_front||[]).sort((a,b)=>a.label.localeCompare(b.label,'zh-CN-u-co-pinyin'));}
function petClass(option){return option.label.includes('变异')?'mutant':option.label.startsWith('超级')?'god':'normal';}
function visiblePetTypes(){const classes=petFilters().petClasses||[],query=petTypeQuery.trim().toLowerCase();return petTypeOptions().filter(option=>(!classes.length||classes.includes(petClass(option)))&&(!query||(option.label+String(option.pinyin||'')).toLowerCase().includes(query)));}
function petTypesView(){return petChoices('type',visiblePetTypes())||empty('未找到类型','');}
function petSkillGroups(excluded=false){
 const c=autoSearchConfig,groups=[
  {label:'高级技能 · 物理',options:petOptions(c.pet_skills_phy_high)},
  {label:'高级技能 · 法术',options:petOptions(c.pet_skills_mag_high)},
  {label:'高级技能 · 通用',options:petOptions(c.pet_skills_common_high)},
  {label:'特殊技能',options:petOptions(c.pet_skills_special)},
  {label:'超级技能',options:petOptions(c.pet_web_super_skill_options)}
 ];
 const low=petOptions(excluded?c.pet_skills_low_for_not_exist:c.pet_skills_low),classification=c.pet_skill_classification?.['初级技能']||{},assigned=new Set();
 for(const type of ['物理','法术','通用']){
  const ids=new Set((classification[type]||[]).map(option=>String(option.value)));
  const options=low.filter(option=>ids.has(option.value));options.forEach(option=>assigned.add(option.value));groups.push({label:'初级技能 · '+type,options});
 }
 const others=low.filter(option=>!assigned.has(option.value));if(others.length)groups.push({label:'初级技能 · 其他',options:others});
 return groups;
}
function petSkillsView(excluded=false){
 const query=petSkillQuery.trim(),field=excluded?'not_in_skill':'skill';
 return petSkillGroups(excluded).map(group=>{const options=group.options.filter(option=>!query||(group.label+option.label).includes(query));return options.length?`<details class="pet-skill-group" open><summary>${esc(group.label)}</summary>${petChoices(field,options,{skills:true})}</details>`:'';}).join('')||empty('未找到技能','');
}
function petFiltersView(){
 if(searchConfigState==='loading')return '<div class="equipment-load" role="status">正在加载官方召唤兽筛选配置…</div>';
 if(searchConfigState==='error')return `<div class="equipment-load error">筛选配置加载失败：${esc(searchConfigError)}<button type="button" class="text-button" data-action="retry-search-config">重新加载</button></div>`;
 const c=autoSearchConfig,f=petFilters();
 for(const key of ['pet_skills_phy_high','pet_skills_mag_high','pet_skills_common_high','pet_skills_special','pet_web_super_skill_options','pet_skills_low','pet_type_info_for_app'])if(!Array.isArray(c[key]))return `<p class="error">官网召唤兽配置缺少 ${esc(key)}，请重新加载筛选配置。</p>`;
 const highOrder=['催心浪','生死决','碎甲刃','舍身击','双星爆','腾挪劲','电魂闪','隐匿击','玄武躯','通灵法','血债偿','龙胄铠','神机步','朱雀甲','凛冽气','阴阳护','玉砥柱','棱光镜','燎原势','破竹锋'];
 const lowOrder=['迅敏','连环','矫健','灵光','灵身','狂怒','静岳','撞击','阴伤','擅咒','狙刺','钢化','深思','慧心','圣洁','坚甲','淬毒','愤恨','无畏','岿然','穿透','劫火','怒水','狂雷','崩岩','协力'];
 const ordered=(dictionary,order)=>objectOptions(dictionary||{}).sort((a,b)=>(order.includes(a.label)?order.indexOf(a.label):999)-(order.includes(b.label)?order.indexOf(b.label):999));
 const sections=[
  petSection('price',petRange('price_min','price_max','价格（元）','0.01')),
  petSection('level',petRange('level_min','level_max','等级')),
  petSection('fight',petChoices('kindid',['65','66','67','68','69','75','70','71','80'].filter(id=>c.fight_levels?.[id]).map(value=>({value,label:c.fight_levels[value]})))),
  petSection('stage',petChoices('pet_sub_type',[{value:'',label:'不限'},{value:'2',label:'成品'},{value:'1',label:'胚子'}],{single:true})),
  petSection('baby',petSwitch('is_baobao','只显示宝宝')),
  petSection('class',petChoices('petClasses',[{value:'normal',label:'普通'},{value:'mutant',label:'变异'},{value:'god',label:'神兽'}])+`<p class="equipment-selection-hint">可多选，分类按官方类型列表筛选。</p>`),
  petSection('skills',petSwitch('skill_with_suit','包含套装技能')+`<label class="pet-query">搜索技能<input type="search" data-pet-query="skills" value="${esc(petSkillQuery)}" placeholder="输入技能名称" aria-label="搜索召唤兽技能"></label><div id="pet-included-skills">${petSkillsView()}</div>`),
  petSection('evol',`<label class="equipment-mode">筛选方式<select data-pet-input="evol_skill_mode" aria-label="赐福技能筛选方式"><option value="any" ${f.evol_skill_mode!=='all'?'selected':''}>满足一种</option><option value="all" ${f.evol_skill_mode==='all'?'selected':''}>全部满足</option></select></label>`+petChoices('evol_skill',petOptions(c.pet_web_evol_skill_options))),
  petSection('excluded',`<p class="equipment-selection-hint">排除所选技能，支持多选。</p><div id="pet-excluded-skills">${petSkillsView(true)}</div>`),
  petSection('overview',`<div class="equipment-attribute-grid">${petNumber('skill_num','技能数')}${petSwitch('no_include_sp_skill','不含认证技能')}${petNumber('lingxing','历史灵性值')}${petNumber('growth','成长',{step:'0.001',max:9.999})}${petNumber('neidan_count','内丹总数量',{max:10})}${petNumber('valid_evol_skill_num','有效赐福技能数')}</div>`+petSwitch('advanced_evol_skill','仅包含高级技能赐福')+'<p class="equipment-hint">内丹总数量统计已装内丹颗数，由官网接口筛选；内丹层数请在“内丹”中设置。</p>'),
  petSection('type',`<details class="pet-more-types"><summary>选择类型（可多选）</summary><label class="pet-query">搜索类型<input type="search" data-pet-query="types" value="${esc(petTypeQuery)}" placeholder="输入类型名称或拼音首字母" aria-label="搜索召唤兽类型"></label><div class="pet-type-options" id="pet-type-options">${petTypesView()}</div></details>`),
  petSection('stars',petChoices('super_sum_star',['初始','一星','二星','三星'].map((label,value)=>({value:String(value),label})))),
  petSection('aptitudes',`<div class="equipment-attribute-grid">${['attack_aptitude','defence_aptitude','physical_aptitude','magic_aptitude','speed_aptitude_min','speed_aptitude_max'].map(field=>petNumber(field,SearchParams.petNumericFields[field][0],{operator:field.endsWith('_max')?'≤':'≥'})).join('')}</div>`),
  petSection('attributes',`<div class="equipment-attribute-grid">${['max_blood','attack','defence','speed_min','fashang','fafang'].map(field=>petNumber(field,SearchParams.petNumericFields[field][0])).join('')}</div>`),
  petSection('traits',petChoices('texing',petOptions(c.texing_type_list))+`<h4>正面效果</h4>`+petChoices('positive_effect',objectOptions(c.texing_poistive_effect_types).reverse())+`<h4>负面效果</h4>`+petChoices('negative_effect',objectOptions(c.texing_poistive_effect_types).reverse())),
  petSection('neidan',`<h4>高级内丹</h4>`+petChoices('high_neidan',ordered(c.high_neidans,highOrder))+petNumber('high_neidan_level','高级内丹层数')+`<h4>低级内丹</h4>`+petChoices('low_neidan',ordered(c.low_neidans,lowOrder))+petNumber('low_neidan_level','低级内丹层数')),
  petSection('appearance',petChoices('mengying',objectOptions(c.pet_mengying||{})))
 ];
 return `<section class="equipment-filter pet-filter" data-category="召唤兽"><div class="equipment-header"><strong>召唤兽筛选</strong><button type="button" class="text-button" data-action="reset-pet">清除筛选</button></div><div class="equipment-layout"><nav class="equipment-section-nav" aria-label="召唤兽筛选分组">${petSections.map(([id,label])=>`<button type="button" data-pet-section="${id}">${filterSectionLabel('召唤兽',id,label)}</button>`).join('')}</nav><div class="equipment-scroll">${sections.join('')}</div></div></section>`;
}
function renderPetOptions(){if(!taskDraft||taskDraft.category!=='召唤兽'||serverPageOpen||suitPageOpen)return;const target=document.querySelector('#category-options');if(target)target.innerHTML=petFiltersView();}
function refreshPetControls(){
 const scroller=document.querySelector('.pet-filter .equipment-scroll'),top=scroller?.scrollTop||0;
 const folded=[...document.querySelectorAll('.pet-filter details:not([open])')].map(node=>node.id).filter(Boolean);
 const moreOpen=document.querySelector('.pet-more-types')?.open;
 renderPetOptions();for(const id of folded){const section=document.getElementById(id);if(section)section.open=false;}
 const more=document.querySelector('.pet-more-types');if(more)more.open=!!moreOpen;
 const current=document.querySelector('.pet-filter .equipment-scroll');if(current)current.scrollTop=top;
}
function validatePetFilters(){
 if(searchConfigState!=='ready')return '请等待召唤兽筛选配置加载成功';
 if(searchConfigSaveError)return '筛选配置尚未保存，请检查本地存储权限';
 try{SearchParams.petBaseParams(petFilters());return '';}catch(error){return error.message;}
}
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button||!taskDraft||taskDraft.category!=='召唤兽')return;
 if(button.dataset.petField){
  const f=petFilters(),key=button.dataset.petField,value=button.dataset.petValue;
  if(button.dataset.petSingle==='true'){f[key]=f[key]===value?'':value;refreshPetControls();return;}
  const selected=new Set(f[key]||[]);if(selected.has(value))selected.delete(value);else selected.add(value);f[key]=[...selected];
  if(key==='skill'||key==='not_in_skill'){const other=key==='skill'?'not_in_skill':'skill';f[other]=(f[other]||[]).filter(item=>!selected.has(item));}
  if(key==='petClasses'){
   const types=petTypeOptions().filter(option=>!f.petClasses.length||f.petClasses.includes(petClass(option)));
   f.classTypes=f.petClasses.length?types.map(option=>option.value):[];
   const permitted=new Set(types.map(option=>option.value));f.type=(f.type||[]).filter(value=>permitted.has(value));
  }
  refreshPetControls();
 }else if(button.dataset.petSection){const section=document.getElementById('pet-'+button.dataset.petSection);if(section){section.open=true;section.scrollIntoView({behavior:'auto',block:'start'});}}
 else if(button.dataset.action==='reset-pet'){taskDraft.petFilters={};petTypeQuery='';petSkillQuery='';renderPetOptions();}
});
document.addEventListener('input',event=>{
 if(!taskDraft||taskDraft.category!=='召唤兽')return;
 if(event.target.dataset.petInput){const input=event.target;petFilters()[input.dataset.petInput]=input.type==='checkbox'?input.checked:input.value;}
 if(event.target.dataset.petQuery==='types'){petTypeQuery=event.target.value;document.querySelector('#pet-type-options').innerHTML=petTypesView();}
 if(event.target.dataset.petQuery==='skills'){petSkillQuery=event.target.value;document.querySelector('#pet-included-skills').innerHTML=petSkillsView();document.querySelector('#pet-excluded-skills').innerHTML=petSkillsView(true);}
});
document.addEventListener('change',event=>{if(taskDraft?.category==='召唤兽'&&event.target.dataset.petInput){const input=event.target;petFilters()[input.dataset.petInput]=input.type==='checkbox'?input.checked:input.value;}});
document.addEventListener('error',event=>{if(event.target.matches?.('.pet-skill-chip img'))event.target.hidden=true;},true);
