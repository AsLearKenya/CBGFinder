/* Local second pass over a completed task. Derived bounds never become anchors. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation,typeof module==='object'&&module.exports?require('./lingshi-valuation.js'):root.LingshiValuation,typeof module==='object'&&module.exports?require('./yupo-valuation.js'):root.YupoValuation,typeof module==='object'&&module.exports?require('./pet-equipment-valuation.js'):root.PetEquipmentValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.ValuationReview=api;})(globalThis,function(B,L,Y,P){
 'use strict';
 const VERSION=2;
 const sumRows=rows=>rows.reduce((o,r)=>{o[r.label]=(o[r.label]||0)+r.value;return o;},{});
 const rowKey=rows=>rows.map(r=>r.label).sort().join('|');
 function fingerprint(row){return JSON.stringify([row.estimateCents,row.sampleEstimateCents,row.rough,row.precise,row.degraded,row.insufficientSamples,row.count,row.target]);}
 function rough(row){return !!row&&!row.skipped&&!row.precise&&(row.rough===true||row.insufficientSamples||Number(row.count)<(row.requiredSampleCount||B.sampleRequirement(row.target)));}
 function reliable(row){return !!row&&!row.skipped&&!row.degraded&&!row.secondaryReview&&Number.isSafeInteger(row.estimateCents)&&row.estimateCents>0&&(row.precise||!rough(row));}
 function profile(row,task){
  const t=row.target;if(!t||t.price<50||B.isRoleExclusive(t))return null;
  if(t.kind==='sword'){
   const rules=B.comparisonRules(task.equipmentFilters||{},{kindId:t.equipmentKindId,level:Number(t.level)},[t]),actual=B.actualComparisonRules(t,rules);
   if(!actual.some(r=>!r.key.startsWith('addon')&&Number.isFinite(B.ruleValue(t,r))))return null;
   const physical=B.physicalTotal(t,rules),positive=B.positiveAdditionKeys(t,physical),values=Object.fromEntries(actual.map(r=>[r.key,B.ruleValue(t,r)]));
   if(Object.values(values).some(v=>!Number.isFinite(v)))return null;
   return {key:JSON.stringify(['sword',t.level,[...B.expandFilters({types:[String(t.equipmentKindId)]}).types].sort(),B.traitKey(t),B.attributeFocus(t).usage,positive]),values,labels:Object.fromEntries(actual.map(r=>[r.key,r.label]))};
  }
  if(t.kind==='lingshi'){
   if(L.reason(t))return null;const m=L.meta(t),values=sumRows([m.main,...m.added]);
   return {key:JSON.stringify(['lingshi',t.equipmentKindId,t.level,m.main.label,rowKey(m.added),L.superSimple(t)]),values,labels:Object.fromEntries(Object.keys(values).map(k=>[k,k]))};
  }
  if(t.kind==='yupo'){
   if(Y.reason(t))return null;const m=t.yupoMeta,rows=Y.rows(t),values=sumRows(rows),effects=Y.valuedEffects(t);for(const e of effects)values[e.key]=e.value??0;
   return {key:JSON.stringify(['yupo',t.equipmentKindId,m.main.label,rowKey(rows)]),values,labels:{...Object.fromEntries(rows.map(r=>[r.label,r.label])),...Object.fromEntries(effects.map(e=>[e.key,e.label]))}};
  }
  if(t.kind==='pet-equipment'){
   if(P.reason(t)||P.risk(t))return null;const m=t.petEquipmentMeta,values={...P.metrics(t)};delete values.魔法;if(m.position!=='3')values['基础'+m.base.label]=m.base.value;
   return {key:JSON.stringify(['pet-equipment',t.equipmentKindId,t.level,P.usage(t),m.skill,Object.keys(values).sort()]),values,labels:Object.fromEntries(Object.keys(values).map(k=>[k,k]))};
  }
  return null;
 }
 function components(row,settings){
  const t=row.target,m=t.valuationMeta||{};let gem=0,extra=0,holes=0,factor=1;
  const money=(value,needed=false)=>{if(value==null&&!needed)return 0;if(!Number.isSafeInteger(value)||value<0)throw Error('缺少材料折算依据');return value;};
  if(t.kind==='sword'){
   if(!Number.isInteger(m.grade))throw Error('缺少宝石等级');
   const v=B.evaluate({...m,baseCents:0,level:Number(t.level),quotes:row.targetQuotes,gemCounts:B.gemCountsForItem(t)},settings);
   gem=v.gem.uncappedCents;holes=v.holeCents;factor=v.repairFactor;
  }else if(t.kind==='lingshi'){
   const meta=L.meta(t);gem=money(row.starCents,meta.grade>0);extra=money(row.clockCents,!!meta.stone?.id);factor=B.repairFactor(meta.failures,settings,t.level);
  }else if(t.kind==='yupo'){gem=money(row.dustCents,t.yupoMeta.grade>0);
  }else if(t.kind==='pet-equipment'){gem=money(row.spiritCents,t.petEquipmentMeta.grade>0);extra=money(row.pointCents,P.VALUED.includes(t.petEquipmentMeta.skill));factor=B.repairFactor(t.petEquipmentMeta.failures,settings,Math.floor(t.level/10)*10);
  }else throw Error('不支持的品类');
  return {gem,extra,holes,factor};
 }
 function convert(anchor,target,settings,now,memo){
  memo??={components:new Map(),bases:new Map(),caps:new Map(),settings:B.settings(settings)};
  const component=row=>{if(!memo.components.has(row)){try{memo.components.set(row,components(row,memo.settings));}catch(error){memo.components.set(row,{error});}}const value=memo.components.get(row);if(value.error)throw value.error;return value;};
  const a=component(anchor),t=component(target),multiplier=memo.settings.gemCapMultiplier;
  if(!memo.bases.has(anchor)){
   const net=anchor.estimateCents-a.extra-a.holes;if(net<=0)throw Error('价格不足以折算');
   let equipment=net-a.gem;if(equipment<0||a.gem>equipment*multiplier)equipment=net/(1+multiplier);
   memo.bases.set(anchor,Math.round(equipment/a.factor));
  }
  const base=memo.bases.get(anchor),targetEquipment=Math.round(base*t.factor),gem=Math.min(t.gem,Math.round(targetEquipment*multiplier)),converted=targetEquipment+t.holes+t.extra+gem;
  if(!memo.caps.has(target))memo.caps.set(target,B.suggestedPrice(target.target,0,now).priceCapCents);
  const price=Math.min(converted,memo.caps.get(target)??Infinity);
  if(!Number.isSafeInteger(price)||price<=0)throw Error('换算价格无效');return {price,baseCents:base,sourceComponents:a,targetComponents:t,uncappedCents:converted};
 }
 function relation(a,b){const keys=Object.keys(a.values);if(keys.length!==Object.keys(b.values).length||keys.some(k=>!Number.isFinite(a.values[k])||!Number.isFinite(b.values[k])))return null;
  const differences=keys.map(k=>a.values[k]-b.values[k]);if(differences.every(d=>Math.abs(d)<1e-7))return 'equal';if(differences.every(d=>d>=-1e-7))return 'lower';if(differences.every(d=>d<=1e-7))return 'upper';return null;
 }
 function review(rows,task,settings,now=Date.now()){
  const memo={components:new Map(),bases:new Map(),caps:new Map(),settings:B.settings(settings)},profiles=new Map(),anchors=new Map(),out={version:VERSION,at:now,items:{}};
  for(const row of rows){let p;try{p=profile(row,task);}catch{continue;}if(p)profiles.set(row.target.id,p);if(p&&reliable(row)){if(!anchors.has(p.key))anchors.set(p.key,[]);anchors.get(p.key).push(row);}}
  for(const row of rows.filter(row=>rough(row)&&Number.isFinite(row.target?.price)&&row.target.price>=200)){
   const p=profiles.get(row.target.id);if(!p)continue;let lower=null,upper=null;
   for(const anchor of anchors.get(p.key)||[]){if(anchor.target.id===row.target.id)continue;const q=profiles.get(anchor.target.id),direction=relation(p,q);if(!direction)continue;
    let converted;try{converted=convert(anchor,row,settings,now,memo);}catch{continue;}
    const ref={id:anchor.target.id,name:anchor.target.name,server:anchor.target.server,priceCents:converted.price,sourceEstimateCents:anchor.estimateCents,sourcePrecise:anchor.precise===true,fingerprint:fingerprint(anchor),conversion:converted,comparison:Object.keys(p.values).map(key=>({label:p.labels[key]||key,target:p.values[key],anchor:q.values[key]}))};
    if((direction==='lower'||direction==='equal')&&(!lower||ref.priceCents>lower.priceCents))lower=ref;
    if((direction==='upper'||direction==='equal')&&(!upper||ref.priceCents<upper.priceCents))upper=ref;
   }
   if(!lower&&!upper)continue;
   const lo=lower?.priceCents??null,hi=upper?.priceCents??null,conflict=lo!==null&&hi!==null&&lo>hi,narrow=lo!==null&&hi!==null&&!conflict&&hi<=lo*1.2;
   out.items[row.target.id]={fingerprint:fingerprint(row),lower,upper,lowerCents:lo,upperCents:hi,status:conflict?'conflict':narrow?'bounded':lo!==null&&hi!==null?'wide':'one-sided',comparisonOnly:!narrow,estimateCents:narrow?Number.isSafeInteger(row.estimateCents)?Math.max(lo,Math.min(hi,row.estimateCents)):Math.round((lo+hi)/2):null};
  }
  return out;
 }
 function apply(row,result,lookup){
  if(!rough(row)||!Number.isFinite(row.target?.price)||row.target.price<200||!result||result.fingerprint!==fingerprint(row))return row;
  for(const ref of [result.lower,result.upper].filter(Boolean))if(fingerprint(lookup(ref.id)||{})!==ref.fingerprint)return row;
  const next={...row,secondaryReview:result,originalEstimateCents:row.estimateCents,estimateCents:result.estimateCents,rough:true,precise:false,insufficientSamples:false};
  return B.enforceRoughValidity(next);
 }
 return {VERSION,fingerprint,rough,reliable,profile,components,convert,relation,review,apply};
});
