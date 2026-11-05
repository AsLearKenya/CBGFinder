/* Confirmed sold listings corroborate a calculation; last asking price is not a claimed transaction price. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation,typeof module==='object'&&module.exports?require('./lingshi-valuation.js'):root.LingshiValuation,typeof module==='object'&&module.exports?require('./yupo-valuation.js'):root.YupoValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.SoldValuation=api;})(globalThis,function(B,L,Y){
 'use strict';
 function comparisons(target,sample,task){
  if(!target||!sample||target.id===sample.id||target.kind!==sample.kind||(target.kind!=='sword'&&String(target.equipmentKindId)!==String(sample.equipmentKindId))||(target.kind!=='lingshi'&&Number(target.level)!==Number(sample.level)))return null;
  if(target.kind==='sword'){if(B.skipReason(target)||B.isRoleExclusive(sample))return null;const rules=B.comparisonRules(task.equipmentFilters||{},{kindId:target.equipmentKindId,level:Number(target.level)},[target]);if(!rules.length||!rules.every(r=>Number.isFinite(B.ruleValue(target,r)))||!B.similar(target,sample,rules))return null;return B.comparisons(target,sample,rules);}
  const engine=target.kind==='lingshi'?L:target.kind==='yupo'?Y:target.kind==='pet-equipment'?(typeof module==='object'&&module.exports?require('./pet-equipment-valuation.js'):globalThis.PetEquipmentValuation):null;if(!engine||engine.reason(target))return null;for(const p of engine.plans(target)){const rows=engine.match(target,sample,p);if(rows)return rows;}return null;
 }
 function apply(row,task,history=[]){
  if(row?.precise)row={...row,estimateCents:row.calculatedEstimateCents,rough:row.calculatedRough,precise:false,soldEvidence:[],soldReferenceCents:null,soldMatchCount:0};
  if(!row||row.skipped||!Number.isSafeInteger(row.estimateCents)||row.estimateCents<=0)return row;
  const found=new Map();for(const entry of history){if(entry.status!=='sold'||!Number.isSafeInteger(entry.priceCents)||entry.priceCents<=0||entry.priceCents*5<row.estimateCents*4||!Number.isFinite(entry.confirmedAt))continue;const comparison=comparisons(row.target,entry.item,task);if(comparison){const key=JSON.stringify([String(entry.item.serverId||''),entry.item.detailEid||entry.item.id]);if(!found.has(key))found.set(key,{...entry,comparison});}}
  const matches=[...found.values()].sort((a,b)=>a.priceCents-b.priceCents);if(!matches.length)return row;
  const calculated=row.estimateCents,price=matches[0].priceCents;
  return {...row,precise:true,calculatedRough:row.rough,rough:false,calculatedEstimateCents:calculated,soldReferenceCents:price,soldMatchCount:matches.length,soldEvidence:matches.slice(0,5),estimateCents:Math.round(Math.min(calculated,price)*.95)};
 }
 return {comparisons,apply};
});
