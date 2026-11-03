/* Editing appearance prices uses the same item categories as role search. */
let roleCosmeticDraft=null,roleCosmeticKind='clothes',roleCosmeticQuery='',roleCosmeticOpenCombo='',roleCosmeticSelections={};
const roleCosmeticComposing=new WeakSet();
function cosmeticDraft(){return roleCosmeticDraft||(roleCosmeticDraft=JSON.parse(JSON.stringify(roleValuationSettings.cosmetics)));}
function cosmeticChoiceRows(kind){
 const fields={clothes:'limit_clothes',mounts:'xiangrui_list',widgets:'widget_list',effects:'perform_effect'};
 const live=typeof roleSearchOptionRows==='function'?roleSearchOptionRows(fields[kind]):[];
 return live.length?[...new Set(live.flatMap(r=>RoleCosmetics.priceNames(kind,r.label)))].map(name=>({name,key:RoleCosmetics.key(kind,name)})):RoleCosmetics.options(kind);
}
function cosmeticSelect(kind,name,selected=''){if(name==='newCosmetic')selected=roleCosmeticSelections[kind]||selected;return `<select name="${esc(name)}" aria-label="选择外观">${cosmeticChoiceRows(kind).map(o=>`<option value="${esc(o.key)}" ${selected===o.key?'selected':''}>${esc(o.name)}</option>`).join('')}</select>`;}
function cosmeticKindSelect(name,selected){return `<select name="${esc(name)}" aria-label="外观类别">${Object.entries(RoleCosmetics.KINDS).map(([k,label])=>`<option value="${k}" ${k===selected?'selected':''}>${label}</option>`).join('')}</select>`;}
function cosmeticPriceTable(entries,kind,d,query,amount){
 const line=(key,p,child=false,family='')=>`<div class="cosmetic-price-line cosmetic-price-grid ${child?'is-dye':''}" data-cosmetic-entry="${esc(key)}" data-change-key="cosmetic-price:${esc(key)}"><span class="cosmetic-price-label">${esc(child?RoleCosmetics.dye(key.slice(key.indexOf(':')+1))+'染色增值':kind==='clothes'?(family&&key.slice(key.indexOf(':')+1)!==family?key.slice(key.indexOf(':')+1).slice(family.length).replace(/^·/,'')+'形态':'基础款'):key.slice(key.indexOf(':')+1))}</span>${amount('male',p.male,`data-cosmetic-price="${esc(key)}" data-price-sex="male" aria-label="${esc(key)}男号价格"`)}${amount('female',p.female,`data-cosmetic-price="${esc(key)}" data-price-sex="female" aria-label="${esc(key)}女号价格"`)}<button type="button" class="text-button" data-cosmetic-remove-price="${esc(key)}">移除</button></div>`;
 if(kind!=='clothes')return `<div class="role-valuation-table-wrap"><table class="role-valuation-table cosmetic-price-table"><thead><tr><th colspan="4"><div class="cosmetic-price-grid"><span>款式</span><span>男号（元）</span><span>女号（元）</span><span>操作</span></div></th></tr></thead><tbody>${entries.map(([key,p])=>`<tr data-change-key="cosmetic-single:${esc(key)}"><td colspan="4">${line(key,p)}</td></tr>`).join('')}<tr data-cosmetic-empty ${entries.length?'hidden':''}><td colspan="4">暂无单独定价</td></tr></tbody></table></div>`;
 const groups=new Map();for(const [key,p] of entries){const name=key.slice(key.indexOf(':')+1),family=RoleCosmetics.family(kind,name);if(!groups.has(family))groups.set(family,[]);groups.get(family).push([key,p]);}
 let matched=0;const rows=[...groups].map(([family,items])=>{
  const visible=!query||items.some(([k])=>k.includes(query));if(visible)matched++;
  const base=items.filter(([k])=>!RoleCosmetics.dye(k.slice(k.indexOf(':')+1))),children=items.filter(([k])=>RoleCosmetics.dye(k.slice(k.indexOf(':')+1))).sort(([a],[b])=>RoleCosmetics.dye(a)==='月白'?-1:RoleCosmetics.dye(b)==='月白'?1:a.localeCompare(b));
  const fallback=RoleCosmetics.defaultPriceFor(kind,family,d);
  return `<tr data-cosmetic-family="${esc(family)}" data-change-key="cosmetic-family:${esc(family)}" ${visible?'':'hidden'}><td colspan="4"><div class="cosmetic-outfit-title">${esc(family)}</div>${base.length?base.map(([k,p])=>line(k,p,false,family)).join(''):`<div class="cosmetic-price-line cosmetic-price-grid cosmetic-default-line"><span>基础款 <small>未单独定价</small></span><span>${esc(fallback)} <small>默认价</small></span><span>${esc(fallback)} <small>默认价</small></span><span>—</span></div>`}<div class="cosmetic-dye-children">${children.map(([k,p])=>line(k,p,true)).join('')}</div></td></tr>`;
 }).join('');
 return `<div class="role-valuation-table-wrap"><table class="role-valuation-table cosmetic-price-table"><thead><tr><th colspan="4"><div class="cosmetic-price-grid"><span>套装／款式</span><span>男号（元）</span><span>女号（元）</span><span>操作</span></div></th></tr></thead><tbody>${rows}<tr data-cosmetic-empty ${matched?'hidden':''}><td colspan="4">${entries.length?'没有匹配的已设置条目':'暂无单独定价'}</td></tr></tbody></table></div>`;
}
function roleCosmeticSettingsView(){
 const d=cosmeticDraft(),kind=roleCosmeticKind,entries=Object.entries(d.prices).filter(([k])=>k.startsWith(kind+':')).sort(([a],[b])=>a.localeCompare(b,'zh-CN'));
 const query=RoleCosmetics.clean(roleCosmeticQuery),matches=entries.filter(([k])=>k.includes(query)).length;
 const amount=(name,value,attrs='')=>`<input type="number" min="0" max="100000000" step="0.01" name="${esc(name)}" value="${esc(value)}" ${attrs} required>`;
 return `<section class="panel role-cosmetic-settings"><div class="panel-header"><div class="panel-title">锦衣祥瑞与外观估价</div></div><div class="settings-body"><p>限量锦衣、武器锦衣、祥瑞分别按默认价，已确认免费赠送的外观不计默认价；挂件和施法特效须单独定价。组合包优先，不再累加包内单件及染色。</p><form id="role-cosmetic-prices-form"><div class="valuation-grid"><label class="valuation-field"><span>限量锦衣默认单价（元）</span>${amount('defaultPrice',d.defaultPrice,'data-cosmetic-default="defaultPrice"')}</label><label class="valuation-field"><span>限量武器锦衣默认单价（元）</span>${amount('weaponDefaultPrice',d.weaponDefaultPrice,'data-cosmetic-default="weaponDefaultPrice"')}</label><label class="valuation-field"><span>限量祥瑞默认单价（元）</span>${amount('mountDefaultPrice',d.mountDefaultPrice,'data-cosmetic-default="mountDefaultPrice"')}</label><label class="valuation-field"><span>月白／墨黑默认染色增值（元／色）</span>${amount('dyePrice',d.dyePrice,'data-cosmetic-default="dyePrice"')}</label></div><p class="setting-help">上下装、多形态合并；同套多样式不累计件数，月白／墨黑与单套基础件数一致时各加一次染色价值，点星、点黛不加价。男／女价格相同时两栏填相同数值。</p><div class="valuation-category-tabs" aria-label="外观价格类别">${Object.entries(RoleCosmetics.KINDS).map(([k,label])=>`<button type="button" data-cosmetic-kind="${k}" aria-pressed="${kind===k}">${label}</button>`).join('')}<button type="button" data-cosmetic-kind="combos" aria-pressed="${kind==='combos'}">组合包</button></div>${kind==='combos'?`<p class="setting-help">同件外观只进入一个组合。重叠组合按“组合价＋包外单件价”比较，取较低总价。</p>${d.combos.map(c=>`<details data-change-key="cosmetic-combo:${esc(c.id)}" class="role-cosmetic-combo" ${roleCosmeticOpenCombo===c.id?'open':''}><summary>${esc(c.name)} · 男 ${esc(c.male)}／女 ${esc(c.female)} 元</summary><div class="valuation-grid"><label class="valuation-field"><span>组合名称</span><input maxlength="80" value="${esc(c.name)}" data-cosmetic-combo="${esc(c.id)}" data-combo-field="name" required></label><label class="valuation-field"><span>男号价格</span>${amount('comboMale',c.male,`data-cosmetic-combo="${esc(c.id)}" data-combo-field="male"`)}</label><label class="valuation-field"><span>女号价格</span>${amount('comboFemale',c.female,`data-cosmetic-combo="${esc(c.id)}" data-combo-field="female"`)}</label></div><div class="role-cosmetic-members">${c.members.map(k=>`<span>${esc(RoleCosmetics.KINDS[k.split(':')[0]])} · ${esc(k.slice(k.indexOf(':')+1))}<button type="button" aria-label="移除${esc(k)}" data-cosmetic-remove-member="${esc(k)}" data-combo-id="${esc(c.id)}">×</button></span>`).join('')}</div><div class="role-cosmetic-add" data-combo-add-row="${esc(c.id)}">${cosmeticKindSelect('memberKind','clothes')}${cosmeticSelect('clothes','member')}<button type="button" class="button secondary" data-cosmetic-add-member="${esc(c.id)}">加入组合</button><button type="button" class="text-button" data-cosmetic-remove-combo="${esc(c.id)}">删除组合</button></div></details>`).join('')}<button type="button" class="button secondary" data-cosmetic-add-combo>新建组合包</button>`:`<div class="role-cosmetic-toolbar"><input type="search" placeholder="筛选已设置条目" aria-label="筛选外观价格" value="${esc(roleCosmeticQuery)}" data-cosmetic-query><span data-cosmetic-count>${query?`匹配 ${matches}／已设置 ${entries.length} 项`:`已设置 ${entries.length} 项`}</span></div>${cosmeticPriceTable(entries,kind,d,query,amount)}<div class="role-cosmetic-add">${cosmeticSelect(kind,'newCosmetic')}<button type="button" class="button secondary" data-cosmetic-add-price>添加单件价格</button></div>`}<div class="valuation-save"><button type="submit" class="button primary">保存外观估价设置</button></div><p class="setting-help">修改后点击保存生效，并重算已加载角色。移除单价后，锦衣祥瑞回到默认价，挂件／施法特效不计价。</p></form></div></section>`;
}
function saveRoleCosmeticPrices(){
 const draft=RoleCosmetics.settings(cosmeticDraft());
 roleValuationSettings=RoleValuation.save(localStorage,{...roleValuationSettings,cosmetics:draft});roleCosmeticDraft=null;
 for(const t of state.tasks.filter(t=>t.category==='角色'&&t.valuationEnabled)){const run=state.taskRuns?.[t.id];if(run){roleDetailQueues.delete(run);updateRoleValuation(t,run);}}
 render();toast('外观价格已保存，已加载角色已重新估价');
}
document.addEventListener('change',event=>{
 const el=event.target;if(!el.closest?.('#role-cosmetic-prices-form'))return;const d=cosmeticDraft();
 if(el.dataset.cosmeticDefault)d[el.dataset.cosmeticDefault]=el.value;
 else if(el.dataset.cosmeticPrice&&d.prices[el.dataset.cosmeticPrice])d.prices[el.dataset.cosmeticPrice][el.dataset.priceSex]=el.value;
 else if(el.dataset.cosmeticCombo){const c=d.combos.find(c=>c.id===el.dataset.cosmeticCombo);if(c)c[el.dataset.comboField]=el.value;}
 else if(el.name==='newCosmetic')roleCosmeticSelections[roleCosmeticKind]=el.value;
 else if(el.name==='memberKind'){const row=el.closest('[data-combo-add-row]');const old=row?.querySelector('select[name="member"]');if(old)old.outerHTML=cosmeticSelect(el.value,'member');}
});
function filterRoleCosmeticPrices(input){
 roleCosmeticQuery=input.value;const form=input.closest('#role-cosmetic-prices-form');if(!form)return;
 const query=RoleCosmetics.clean(roleCosmeticQuery),rows=[...form.querySelectorAll('[data-cosmetic-entry]')];let count=0;
 const groups=[...form.querySelectorAll('[data-cosmetic-family]')];
 for(const row of rows){const hit=row.dataset.cosmeticEntry.includes(query);if(hit)count++;if(!groups.length){row.hidden=!hit;const tr=row.closest('tr');if(tr)tr.hidden=!hit;}}
 for(const group of groups){const show=[...group.querySelectorAll('[data-cosmetic-entry]')].some(row=>row.dataset.cosmeticEntry.includes(query));group.hidden=!show;for(const row of group.querySelectorAll('[data-cosmetic-entry]'))row.hidden=false;}
 const label=form.querySelector('[data-cosmetic-count]');if(label)label.textContent=query?`匹配 ${count}／已设置 ${rows.length} 项`:`已设置 ${rows.length} 项`;
 const empty=form.querySelector('[data-cosmetic-empty]');if(empty){empty.hidden=count>0;empty.querySelector('td').textContent=rows.length?'没有匹配的已设置条目':'暂无单独定价';}
}
function focusRoleCosmeticPrice(key){
 roleCosmeticQuery='';const form=document.querySelector('#role-cosmetic-prices-form'),input=form?.querySelector('[data-cosmetic-query]');if(input){input.value='';filterRoleCosmeticPrices(input);}
 const row=[...(form?.querySelectorAll('[data-cosmetic-entry]')||[])].find(r=>r.dataset.cosmeticEntry===key);if(!row)return;
 row.classList.add('is-price-highlighted');row.scrollIntoView({block:'center'});const price=row.querySelector('[data-cosmetic-price]');price?.focus({preventScroll:true});price?.select();setTimeout(()=>row.classList.remove('is-price-highlighted'),2000);
}
document.addEventListener('compositionstart',event=>{if(event.target.hasAttribute?.('data-cosmetic-query'))roleCosmeticComposing.add(event.target);});
document.addEventListener('compositionend',event=>{if(event.target.hasAttribute?.('data-cosmetic-query')){roleCosmeticComposing.delete(event.target);filterRoleCosmeticPrices(event.target);}});
document.addEventListener('input',event=>{if(event.target.hasAttribute?.('data-cosmetic-query')&&!event.isComposing&&!roleCosmeticComposing.has(event.target))filterRoleCosmeticPrices(event.target);});
document.addEventListener('click',event=>{
 const el=event.target.closest('button');if(!el||!el.closest?.('#role-cosmetic-prices-form'))return;const d=cosmeticDraft();
 if(el.dataset.cosmeticKind){roleCosmeticKind=el.dataset.cosmeticKind;roleCosmeticQuery='';render();}
 else if(el.hasAttribute('data-cosmetic-add-price')){
  const select=el.closest('form').elements.newCosmetic,k=select?.value;if(!k)return;
  roleCosmeticSelections[roleCosmeticKind]=k;
  if(d.prices[k]){focusRoleCosmeticPrice(k);toast(k.slice(k.indexOf(':')+1)+'已设置价格，可直接修改');return;}
  const kind=k.split(':')[0],name=k.slice(k.indexOf(':')+1),v=['widgets','effects'].includes(kind)||RoleCosmetics.isFree(kind,name)?0:RoleCosmetics.dye(name)?d.dyePrice:RoleCosmetics.defaultPriceFor(kind,name,d);
  d.prices[k]={male:v,female:v};roleCosmeticQuery='';render();focusRoleCosmeticPrice(k);toast('已添加价格，修改后请保存');
 }
 else if(el.dataset.cosmeticRemovePrice){delete d.prices[el.dataset.cosmeticRemovePrice];render();}
 else if(el.hasAttribute('data-cosmetic-add-combo')){const id=crypto.randomUUID();d.combos.push({id,name:'新组合包',members:[],male:0,female:0});roleCosmeticOpenCombo=id;render();}
 else if(el.dataset.cosmeticRemoveCombo){d.combos=d.combos.filter(c=>c.id!==el.dataset.cosmeticRemoveCombo);render();}
 else if(el.dataset.cosmeticAddMember){const c=d.combos.find(c=>c.id===el.dataset.cosmeticAddMember),select=el.closest('[data-combo-add-row]').querySelector('[name="member"]');if(c&&select?.value&&!c.members.includes(select.value)){c.members.push(select.value);roleCosmeticOpenCombo=c.id;render();}}
 else if(el.dataset.cosmeticRemoveMember){const c=d.combos.find(c=>c.id===el.dataset.comboId);if(c){c.members=c.members.filter(k=>k!==el.dataset.cosmeticRemoveMember);roleCosmeticOpenCombo=c.id;render();}}
});
document.addEventListener('submit',event=>{if(event.target.id!=='role-cosmetic-prices-form')return;event.preventDefault();try{saveRoleCosmeticPrices();}catch(error){toast(error.message);}});

function roleCosmeticBreakdownHtml(detail){
 if(!detail)return '<h3>锦衣祥瑞与外观明细</h3><p class="role-cosmetic-unpriced">未提供外观数据，未计价</p>';
 const rows=detail.rows||[],groups=[],families=new Map();
 for(const r of rows){if(['clothes','dye'].includes(r.kind)){const family=RoleCosmetics.family('clothes',r.name);if(!families.has(family)){const group={family,rows:[]};families.set(family,group);groups.push(group);}families.get(family).rows.push(r);}else groups.push({rows:[r]});}
 const entry=(r,grouped)=>{
  const label=grouped?(r.kind==='dye'?RoleCosmetics.dye(r.name)+'染色':'基础款'):(r.kind==='combo'?'组合包':RoleCosmetics.KINDS[r.kind])+' · '+r.name;
  const owned=grouped&&r.kind==='clothes'?r.owned.split('、').filter(n=>!RoleCosmetics.dye(n)).join('、')||r.owned:r.owned;
  return `<div data-cosmetic-evidence-entry class="cosmetic-evidence-line cosmetic-evidence-grid ${r.kind==='dye'?'is-dye':''} ${r.amountCents===0||['unpriced','incomplete','bundled'].includes(r.status)?'is-unpriced':''} ${r.status==='unpriced'?'role-cosmetic-unpriced':''}"><span class="cosmetic-price-label">${esc(label)}</span><span>${esc(owned)}</span><span>${r.status==='unpriced'?'<strong>未单独定价 · 未计入</strong>':esc(r.rule)}</span><span>${r.status==='unpriced'?'<strong>未计价</strong>':r.status==='incomplete'?'未全染 · 不计染色':r.status==='bundled'?'已含在组合中':valuationAmount(r.amountCents)}</span></div>`;
 };
 return `<h3>锦衣祥瑞与外观明细</h3>${detail.missing?.length?`<p class="role-cosmetic-unpriced">未提供：${esc(detail.missing.join('、'))}，未计价</p>`:''}<div class="role-valuation-table-wrap"><table class="role-valuation-table role-cosmetic-breakdown"><thead><tr><th colspan="4"><div class="cosmetic-evidence-grid"><span>套装／款式</span><span>已拥有</span><span>计价依据</span><span>金额</span></div></th></tr></thead><tbody>${groups.map(group=>`<tr ${group.family?`data-cosmetic-evidence-family="${esc(group.family)}"`:''}><td colspan="4">${group.family?`<div class="cosmetic-outfit-title ${group.rows.every(r=>r.amountCents===0)?'is-unpriced':''}">${esc(group.family)}</div>`:''}${group.rows.map(r=>entry(r,!!group.family)).join('')}</td></tr>`).join('')||'<tr><td colspan="4">无可计价外观</td></tr>'}</tbody><tfoot><tr><td colspan="4"><div class="cosmetic-evidence-grid cosmetic-evidence-total"><strong>外观合计</strong><strong>${valuationAmount(detail.totalCents||0)}</strong></div></td></tr></tfoot></table></div>${detail.warnings?.length?`<p class="setting-help">${esc(detail.warnings.join('；'))}</p>`:''}`;
}
