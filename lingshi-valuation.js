/* Spirit ornament comparison rules. All comparisons use stats before starlight. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation,typeof module==='object'&&module.exports?require('./lingshi.js'):root.Lingshi);if(typeof module==='object'&&module.exports)module.exports=api;else root.LingshiValuation=api;})(globalThis,function(B,L){
 'use strict';
 const VERSION=9,FRONT={spell:['法术伤害','法术暴击等级','法术伤害结果','速度','伤害'],physical:['伤害','物理暴击等级','狂暴等级','穿刺等级','速度'],fixed:['固定伤害','伤害'],support:['速度','封印命中等级','治疗能力']},AUX=['治疗能力','封印命中等级'];
 const IDS={'固定伤害':'1','伤害':'2','速度':'3','法术伤害':'4','狂暴等级':'5','物理暴击等级':'6','法术暴击等级':'7','封印命中等级':'8','法术伤害结果':'9','穿刺等级':'10','治疗能力':'11','气血':'12','防御':'13','法术防御':'14','抗物理暴击':'15','抗法术暴击':'16','抵抗封印等级':'17','格挡等级':'18','回复能力':'19'};
 const MAIN={'伤害':'damage','防御':'defense','法术伤害':'magic_damage','法术防御':'magic_defense','封印命中等级':'fengyin','抵抗封印等级':'anti_fengyin','速度':'speed'},SCORE={'气血':3,'防御':3,'法术防御':2,'格挡等级':1,'抵抗封印等级':1,'回复能力':1,'抗物理暴击':0,'抗法术暴击':0},TOL={'气血':10,'防御':2,'法术防御':2,'格挡等级':3,'抵抗封印等级':3,'回复能力':3};
 const SUPER_SIMPLE_LEVELS=new Set([80,120,140,160]),superSimple=item=>SUPER_SIMPLE_LEVELS.has(Number(item.level))&&(item.specialEffects||[]).some(s=>s.includes('超级简易'));
 const distribution=rows=>rows.map(r=>SCORE[r.label]??0).sort((a,b)=>a-b).join(',');
 const front=i=>['61','62'].includes(String(i.equipmentKindId)),key=rows=>rows.map(r=>r.label).sort().join('|'),counts=rows=>rows.reduce((o,r)=>(o[r.label]=(o[r.label]||0)+1,o),{});
 function metadata(styled,{grade,failures=0}={}){const summary=L.initialSummary(styled);return {main:summary.attributes[0]||null,added:summary.added,stone:L.clockStone({},styled),grade:Number(grade??L.plain(styled).match(/精[炼练]等级\s*(\d+)/)?.[1]??0),failures:Number(failures)};}
 function meta(item){const m=item.lingshiMeta;return m?{...m,stone:m.stone??L.clockStone({},item.description)}:m;}
 const tripleSame=rows=>rows?.length===3&&rows.every(r=>r.label===rows[0].label);
 function plans(item){
  const m=meta(item);if(!m?.main||!MAIN[m.main.label]||!Number.isFinite(m.main.value)||![2,3].includes(m.added?.length)||m.added.some(a=>!IDS[a.label]||!Number.isFinite(a.value)))return [];
  if(tripleSame(m.added))return [{group:'triple',rows:m.added,tier:0}];
  if(!front(item))return [{group:'back',rows:m.added,tier:0}];
  if(m.added.length===2||Object.values(FRONT).some(names=>m.added.every(r=>names.includes(r.label))))return [{group:'exact',rows:m.added,tier:0}];
  const labels=m.added.map(r=>r.label),physicalFirst=labels.includes('速度')&&labels.includes('伤害'),out=[];
  for(const [group,names] of Object.entries(FRONT)){
   if(physicalFirst&&!['physical','spell'].includes(group))continue;
   const indexes=labels.map((n,i)=>names.includes(n)?i:-1).filter(i=>i>=0);if(indexes.length<2)continue;
   const kept=m.added.filter((r,i)=>indexes.includes(i)||(['spell','physical','fixed'].includes(group)&&AUX.includes(r.label)));
   out.push({group,rows:kept,tier:physicalFirst&&group==='spell'?1:0});
  }
  const unique=new Map();for(const p of out){const k=p.tier+':'+key(p.rows);if(!unique.has(k))unique.set(k,p);}return [...unique.values()].filter(p=>p.rows.length===Math.max(...[...unique.values()].filter(q=>q.tier===p.tier).map(q=>q.rows.length))).sort((a,b)=>a.tier-b.tier||b.rows.length-a.rows.length);
 }
 function exactWordsRequired(item,plan){return ['exact','triple'].includes(plan.group)||plan.group==='back'&&meta(item)?.added.length===2;}
 function sampleLevels(item,plan){const level=Number(item.level);if(!exactWordsRequired(item,plan)||level<=80)return [level,level];return [level===100?80:level-40,level];}
 function ignoresMainValue(item,plan){return String(item.equipmentKindId)==='62'&&meta(item)?.main?.label==='法术伤害'&&(plan.group==='physical'||['exact','triple'].includes(plan.group)&&plan.rows.every(r=>FRONT.physical.includes(r.label)));}
 function reason(item){if(!Number.isFinite(item.price)||item.price<50)return '挂牌价低于50元，不估价';const m=meta(item);if(!m?.main||![2,3].includes(m.added?.length))return '缺少主属性或两／三条副属性的初始数值，请重新搜索或读取详情';if(String(item.equipmentKindId)==='64'&&m.main.label!=='速度')return '配饰主属性应为速度';if(!plans(item).length)return '三条副属性没有两条处于同一有效组别，不估价';return '';}
 function groupRows(rows){const groups=new Map();for(const row of rows){if(!groups.has(row.label))groups.set(row.label,[]);groups.get(row.label).push(row);}return groups;}
 const frontTolerance=label=>label==='速度'?[0,2]:[-2,2];
 function pairRows(target,sample,tolerance=frontTolerance){
  if(target.length!==sample.length||[...target,...sample].some(r=>!Number.isFinite(r.value)))return null;
  const other=groupRows(sample),rows=[];
  for(const [label,values] of groupRows(target)){
   const matches=other.get(label);if(matches?.length!==values.length)return null;
   const total=values.reduce((n,r)=>n+r.value,0),sampleTotal=matches.reduce((n,r)=>n+r.value,0);
   const allowed=tolerance(label),bounds=Array.isArray(allowed)?allowed:[-allowed,allowed],delta=sampleTotal-total;
   if(delta<bounds[0]||delta>bounds[1])return null;
   rows.push({label:L.shortName(label)+(values.length>1?'合计（'+values.length+'条）':''),target:total,sample:sampleTotal});
  }
  return rows;
 }

 function hasSharedMain(item){const m=meta(item);return !!m?.added?.some(r=>r.label===m.main?.label);}
 function addMain(rows,main){let included=false;return rows.map(r=>{if(!included&&r.label===main.label){included=true;return {...r,value:r.value+main.value};}return r;});}
 function match(target,sample,plan){
  let a=meta(target),b=meta(sample);if(!a||!b||![2,3].includes(b.added?.length)||target.id===sample.id||String(target.equipmentKindId)!==String(sample.equipmentKindId)||![60,80,100,120,140,160].includes(Number(sample.level))||Number(sample.level)<sampleLevels(target,plan)[0]||Number(sample.level)>sampleLevels(target,plan)[1])return null;
  const ignoreMainValue=ignoresMainValue(target,plan),sharedMain=hasSharedMain(target);
  if(a.main.label!==b.main?.label||!Number.isFinite(b.main.value)||!sharedMain&&!ignoreMainValue&&(b.main.value<a.main.value||b.main.value>a.main.value+(String(target.equipmentKindId)==='64'?1:2)))return null;
  if(B.repairFailures(sample)>B.repairSampleMax(target))return null;
  if(superSimple(target)!==superSimple(sample))return null;
  if(sharedMain){a={...a,added:addMain(a.added,a.main)};b={...b,added:addMain(b.added,b.main)};plan={...plan,rows:addMain(plan.rows,a.main)};}
  let rows;
  if(tripleSame(a.added)){
   if(!tripleSame(b.added)||a.added[0].label!==b.added[0].label)return null;
   rows=front(target)?pairRows(a.added,b.added):pairRows(a.added,b.added,label=>TOL[label]??Infinity);
  }else if(front(target)){
   if(plan.group==='physical'&&a.added.some(r=>r.label==='速度')&&a.added.some(r=>r.label==='伤害')&&b.added.some(r=>['法术伤害','法术暴击等级','法术伤害结果'].includes(r.label)))return null;
   if(plan.group==='exact'){if(b.added.length!==a.added.length)return null;rows=pairRows(a.added,b.added);}
   else{const candidate=b.added.length===2?b.added:b.added.filter(r=>FRONT[plan.group].includes(r.label)||(['spell','physical','fixed'].includes(plan.group)&&AUX.includes(r.label)));rows=pairRows(plan.rows,candidate);}
  }else if(a.added.length===2){
   if(b.added.filter(r=>SCORE[r.label]>0).length!==2)return null;
   const required=new Set(a.added.map(r=>r.label)),candidate=b.added.filter(r=>required.has(r.label));
   rows=pairRows(a.added,candidate,label=>TOL[label]??Infinity);
  }else{
   if(a.added.length!==b.added.length)return null;
   if(a.added.length===3&&distribution(a.added)!==distribution(b.added))return null;
   const ca=counts(a.added),cb=counts(b.added);for(const [label,n] of Object.entries(ca))if(n>=2&&cb[label]!==n)return null;
   const score=x=>x.reduce((n,r)=>n+(SCORE[r.label]??0),0);if(score(b.added)<score(a.added))return null;
   rows=[];if(key(a.added)===key(b.added)){rows=pairRows(a.added,b.added,label=>TOL[label]??Infinity);if(!rows)return null;}else{
    for(const [label,values] of groupRows(a.added)){
     const same=b.added.filter(r=>r.label===label),tolerance=TOL[label]??Infinity;
     if(values.length>1){const comparison=pairRows(values,same,()=>tolerance);if(!comparison)return null;rows.push(...comparison);}
     else if(same.length){const found=same.find(r=>Number.isFinite(r.value)&&Math.abs(r.value-values[0].value)<=tolerance);if(!found)return null;rows.push({label:L.shortName(label),target:values[0].value,sample:found.value});}
     else rows.push({label:L.shortName(label),target:values[0].value,sample:'更高／同档属性'});
    }
   }
  }
  if(!rows)return null;if(sharedMain)return rows.map(r=>r.label.startsWith(L.shortName(a.main.label))?{...r,label:L.shortName(a.main.label)+'合计（含主属性）'}:r);return [{label:'主属性 · '+L.shortName(a.main.label)+(ignoreMainValue?'（不限制数值）':''),target:a.main.value,sample:b.main.value},...rows];
 }
 function starCents(grade,quotes,settings){if(!Number.isInteger(grade)||grade<0||grade>15)throw Error('缺少有效精炼等级');let total=0;for(let n=1;n<=grade;n++){const q=quotes[n];if(!q||!Number.isSafeInteger(q.priceCents))throw Error('缺少'+n+'级星辉石报价');total+=q.priceCents;}return Math.round(total*B.settings(settings).gemDiscount/100);}
 function clockCents(stone,quote){if(!L.clockValued(stone))return 0;if(!stone.id||!Number.isInteger(stone.grade)||stone.grade<1||stone.grade>8)throw Error('缺少有效钟灵石类型或等级');if(!Number.isSafeInteger(quote?.priceCents)||quote.priceCents<=0)throw Error('缺少'+stone.grade+'级'+stone.name+'钟灵石报价');return quote.priceCents;}
 function convert(target,sample,gemCents,settings,stoneCents=0){const equipmentCents=Math.round(sample.baseCents*B.repairFactor(meta(target).failures,settings,target.level)),cap=B.capGemValue(gemCents,equipmentCents,settings);return {baseCents:sample.baseCents,repairFactor:B.repairFactor(meta(target).failures,settings,target.level),holeCents:0,equipmentCents,gemComparisonCents:equipmentCents,gem:cap,clockCents:stoneCents,totalCents:equipmentCents+cap.valueCents+stoneCents};}
 function estimate(target,samples,quotes,settings,now=Date.now(),stoneQuote=null){
  const stoneCents=clockCents(meta(target)?.stone,stoneQuote);
  const error=reason(target);if(error)return {target,count:0,estimateCents:null,skipped:true,error};const gemCents=starCents(meta(target).grade,quotes,settings);let selected=null;const combined=new Map();
  for(const tier of [...new Set(plans(target).map(p=>p.tier))]){const found=new Map();for(const p of plans(target).filter(p=>p.tier===tier))for(const sample of samples){const comparison=match(target,sample,p);if(comparison&&!found.has(sample.id))found.set(sample.id,{sample,comparison,converted:convert(target,sample,gemCents,settings,stoneCents),matchGroup:p.group,ignoredSampleLabels:!front(target)&&meta(target).added.length===2?meta(sample).added.filter(r=>!meta(target).added.some(t=>t.label===r.label)).map(r=>L.shortName(r.label)):[],ignoredLabels:meta(target).added.filter(r=>!p.rows.includes(r)).map(r=>L.shortName(r.label))});}for(const [id,row] of found)if(!combined.has(id))combined.set(id,row);const result=B.supportedPrices([...combined.values()],{now});selected={...result,matchTier:tier};if(result.count>=5)break;}
  const pricing=B.suggestedPrice(target,selected.estimateCents,now);return {target,...selected,...pricing,rough:selected.rough||selected.count<5,targetQuotes:{},starQuotes:quotes,starCents:gemCents,clockCents:stoneCents,clockStone:meta(target).stone,clockQuote:stoneQuote,attributeFocus:null};
 }
 function queries(item){const m=meta(item);return plans(item).map(p=>({plan:p,signature:JSON.stringify([item.equipmentKindId,item.level,m.main.label,ignoresMainValue(item,p)?null:m.main.value,B.repairGroup(item),superSimple(item),p.group,key(p.rows),[...groupRows(p.rows)].map(([label,rows])=>[label,rows.reduce((n,r)=>n+r.value,0)]).sort()]),filters:{kindid:[String(item.equipmentKindId)],equip_level_min:sampleLevels(item,p)[0],equip_level_max:sampleLevels(item,p)[1],basicType:MAIN[m.main.label],basicValue:hasSharedMain(item)||ignoresMainValue(item,p)?0:m.main.value,...(front(item)?{addedFront:p.rows.map(r=>IDS[r.label])}:{addedBack:m.added.length===2?m.added.map(r=>IDS[r.label]):Object.entries(counts(m.added)).filter(([,n])=>n>=2).flatMap(([label,n])=>Array(n).fill(IDS[label]))}),...(B.repairSampleMax(item)<3?{repair_fail:B.repairSampleMax(item)}:{}),...(superSimple(item)?{special_effect:true}:{})}}));}
 function groups(task,items){return [...new Map((items||[]).filter(i=>i.kind==='lingshi').map(i=>[i.equipmentKindId+':'+i.level,{kindId:String(i.equipmentKindId),level:Number(i.level),name:i.type||i.name}])).values()];}
 return {groups,exactWordsRequired,sampleLevels,VERSION,FRONT,SCORE,TOL,SUPER_SIMPLE_LEVELS,superSimple,ignoresMainValue,tripleSame,metadata,meta,front,plans,reason,match,pairRows,starCents,clockCents,convert,estimate,queries};
});
