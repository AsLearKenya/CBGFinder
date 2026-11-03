(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./pet-equipment.js'):root.PetEquipment);if(typeof module==='object'&&module.exports)module.exports=api;else root.PetDetails=api;})(typeof globalThis==='object'?globalThis:this,function(PetEquipment){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const plain=value=>String(value??'').replace(/#r/g,'\n').replace(/#c[\da-f]{6}|#[RGBYKWnbu]/gi,'');
 const image=url=>/^https:\/\/cbg-xyq\.res\.netease\.com\/images\/[\w/.-]+$/.test(url||'')?url:'';
 function fields(rows){return `<dl class="pet-fields">${(rows||[]).filter(r=>r.value!==undefined&&r.value!==null&&r.value!=='').map(r=>`<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('')}</dl>`;}
 function panel(title,body,extra=''){return `<section class="pet-detail-section ${extra}"><h4>${esc(title)}</h4>${body}</section>`;}
 function render(detail,config={}){
  config=config||{};
  const info=detail.petInfo||{},sections=detail.sections||[],skills=sections.find(s=>s.title==='技能')?.skillIds||[],evol=sections.find(s=>s.title==='赐福技能')?.skillIds||[];
  const certifiedId=/^[1-9]\d*$/.test(String(info.certifiedSkillId||''))?String(info.certifiedSkillId):'';
  function skillTiles(ids,evolved=false){
   const ordered=[...new Set(ids.map(String).filter(id=>/^[1-9]\d*$/.test(id)))];
   if(!evolved&&certifiedId){const at=ordered.indexOf(certifiedId);if(at>=0)ordered.splice(at,1);ordered.push(certifiedId);}
   return ordered.length?`<div class="pet-skill-grid">${ordered.map(id=>{
   const entry=config.pet_skill_desc?.[id],mapping=config.pet_skill_high_to_other_level_mapping?.[id],name=evolved?mapping?.name||entry?.name||'技能 #'+id:entry?.name||config.pet_skills_for_front?.[id]||'技能 #'+id;
   const active=!evolved||[mapping?.high_skill,mapping?.low_skill,id].some(v=>v!=null&&skills.includes(String(v)));
   const certified=!evolved&&id===certifiedId;
   return `<div class="pet-skill-tile ${active?'is-active':'is-inactive'}${certified?' is-certified':''}" data-pet-skill-id="${id}" title="${esc((certified?'认证技能 · ':'')+name+(entry?.desc?'\n'+plain(entry.desc):''))}"><img src="https://cbg-xyq.res.netease.com/images/skill/${String(id).padStart(4,'0')}.gif" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(name)}</span>${certified?'<span class="pet-skill-certification">认证</span>':''}</div>`;
  }).join('')}</div>`:'<p class="pet-detail-empty">未提供</p>';}
  const cores=sections.find(s=>s.title==='内丹')?.neidan||[];
  const gear=sections.filter(s=>/^召唤兽装备 ·|^召唤兽饰品$/.test(s.title));
  const gearHtml=gear.length?gear.map(g=>`<details class="pet-gear-item"><summary>${image(g.icon)?`<img src="${esc(image(g.icon))}" alt="" loading="lazy" referrerpolicy="no-referrer">`:''}<span class="pet-gear-heading"><span>${esc(g.title.replace('召唤兽装备 · ',''))}</span>${PetEquipment.suit(g.styledDescription||(g.lines||[]).join('\n'))?`<span class="pet-gear-suit">套装：${esc(PetEquipment.suit(g.styledDescription||(g.lines||[]).join('\n')))}</span>`:''}</span><span class="pet-gear-chevron" aria-hidden="true">⌄</span></summary><div class="pet-gear-description">${g.title.startsWith('召唤兽装备 ·')?PetEquipment.renderCard(g):(g.lines||[]).map(l=>`<p>${esc(l)}</p>`).join('')}</div></details>`).join(''):'<p class="pet-detail-empty">未携带装备</p>';
  const coreHtml=cores.length?`<div class="pet-neidan-list">${cores.map(n=>`<div><img src="https://cbg-xyq.res.netease.com/images/neidan/${/^\d+$/.test(n.id)?n.id:'0'}.jpg" alt="" loading="lazy" referrerpolicy="no-referrer"><span>${esc(config.neidan_desc?.[n.id]?.name||config.high_neidans?.[n.id]||config.low_neidans?.[n.id]||'内丹 #'+n.id)}</span><b>${esc(n.level)}层</b></div>`).join('')}</div>`:'<p class="pet-detail-empty">未携带内丹</p>';
  const market=detail.market||{},marketRows=[{label:'价格',value:detail.price?'¥'+detail.price+' 元':''},{label:'编号',value:market.id},{label:'是否上架',value:market.status},{label:'是否接受还价',value:market.acceptBargain===null||market.acceptBargain===undefined?'未提供':market.acceptBargain?'接受':'拒绝'},...(market.fairShow?[{label:'公示剩余',value:market.fairShowRemaining},{label:'公示结束',value:market.fairShowEnd}]:[])];
  const trait=info.trait;
  const portrait=image(info.icon).replace('/images/small/','/images/big/');
  const consumptionLabels=['已用元宵','已用千金露','已用炼兽珍经','已用幻色丹'];
  const consumption=consumptionLabels.map(label=>{const row=(info.overview||[]).find(r=>r.label===label||label==='已用炼兽珍经'&&r.label==='已用炼兽真经');return {label,value:row?.value!==undefined&&row?.value!==null&&row?.value!==''?row.value:'未提供'};});
  const dreamValues=(Array.isArray(info.mengying)?info.mengying:String(info.mengying??'').split(/[,|]/)).filter(value=>value&&String(value)!=='0'),dreams=dreamValues.map(value=>config.pet_mengying?.[value]||String(value)),overview=[...(info.overview||[]).filter(row=>!consumptionLabels.includes(row.label)&&row.label!=='已用炼兽真经'),...(dreams.length?[{label:'召唤兽梦影',value:dreams.join('、')}]:[])];
  return `<div class="pet-detail-card"><header class="pet-detail-heading">${portrait?`<img src="${esc(portrait)}" alt="${esc(detail.name)}" referrerpolicy="no-referrer">`:''}<div><h3>${esc(detail.name)} <span>等级 ${esc(detail.level)}</span></h3>${fields(marketRows)}</div></header><div class="pet-detail-layout"><div>${panel('属性',`<div class="pet-attribute-columns">${fields(info.attributes)}${fields(info.points)}</div>`)}${panel('资质',fields(info.aptitudes))}${panel('培养使用情况',fields(consumption))}${panel('概况',fields(overview))}</div><div>${panel('赐福技能',skillTiles(evol,true))}${panel('技能',skillTiles(skills))}${trait?panel('特性'+(trait.enabled===null?'':trait.enabled?' · 已开启':' · 已关闭'),`<div class="pet-trait-description"><strong>${esc(trait.name)}</strong><p>${esc(trait.description)}</p></div>`):''}</div><div>${panel('装备与饰品',gearHtml)}${panel('内丹',coreHtml)}</div></div></div>`;
 }
 return {render,fields};
});
