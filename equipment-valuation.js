(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-attribute-focus.js'):root.EquipmentAttributeFocus,typeof module==='object'&&module.exports?require('./equipment-openings.js'):root.EquipmentOpenings,typeof module==='object'&&module.exports?require('./lingshi.js'):root.Lingshi,typeof module==='object'&&module.exports?require('./pet-equipment-valuation.js'):root.PetEquipmentValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentValuation=api;})(typeof globalThis==='object'?globalThis:this,function(AttributeFocus,EquipmentOpenings,Lingshi,PetValuation){
 'use strict';
 const COMPARISON_VERSION=45;
 const STORAGE_KEY='cbg:equipment-valuation:v1';
 const GEM_TYPES=Object.freeze({'1':{name:'红玛瑙',type:'4011'},'2':{name:'太阳石',type:'4002'},'3':{name:'舍利子',type:'4012'},'4':{name:'光芒石',type:'4004'},'5':{name:'月亮石',type:'4003'},'6':{name:'黑宝石',type:'4010'},'7':{name:'神秘石',type:null},'12':{name:'翡翠石',type:'4249'},'4006':{name:'红宝石',type:null},'4007':{name:'黄宝石',type:null},'4008':{name:'蓝宝石',type:null},'4009':{name:'绿宝石',type:null}});
 const MATERIALS=Object.freeze([...Object.entries(GEM_TYPES).filter(([,gem])=>gem.type!==null).map(([gemId,gem])=>({id:gemId,...gem,family:'gem'})),{id:'starlight',name:'星辉石',type:'4244',family:'starlight'},{id:'dust',name:'五色灵尘',type:'61719',family:'dust'},...Lingshi.CLOCK_TYPES,...PetValuation.MATERIALS]);
 function materialMaxGrade(material){const family=typeof material==='string'?material:material.family;return family==='point'?1:family==='gem'?20:family==='clock'?8:15;}
 function marketGrades(material){return material.family==='point'?[1]:material.family==='clock'?[6]:MARKET_GRADES;}
 function materialUnits(family,grade){
  const n=integer(grade,'材料等级',1,materialMaxGrade(family));
  if(family==='point')return 1;if(family==='clock')return Lingshi.CLOCK_UNITS[n];if(['gem','jingpo'].includes(family))return 2**(n-1);if(family==='starlight')return 3**(n-1);if(family!=='dust')throw Error('未知材料类型');
  let prev=1,current=2;if(n===1)return prev;for(let i=3;i<=n;i++){const next=2*current+prev;prev=current;current=next;}return current;
 }
 function materialPrice(material,grade,quote){
  if(!quote||!Number.isInteger(quote.grade)||quote.grade<1||quote.grade>(materialMaxGrade(material))||!Number.isSafeInteger(quote.priceCents)||quote.priceCents<=0)throw Error('缺少'+material.name+'有效报价');
  return quote.priceCents*materialUnits(material.family,grade)/materialUnits(material.family,quote.grade);
 }
 const MARKET_GRADES=Object.freeze([5,6,7,8,9,10]);
 const CLOCK_PRICE_GROUPS=Object.freeze([Object.freeze(['烈火燎原','参天古木']),Object.freeze(['金石之坚','波浪滔天','水来土掩'])]);
 function clockPricePeers(material){const names=material.family==='clock'&&CLOCK_PRICE_GROUPS.find(group=>group.includes(material.name));return names?MATERIALS.filter(m=>m.family==='clock'&&m.id!==material.id&&names.includes(m.name)):[];}
 function resolveMaterialPrice(material,grade,entry){
  const own=ownMaterialPrice(material,grade,entry);if(own)return own;
  const prices=clockPricePeers(material).map(peer=>{const quote=ownMaterialPrice(peer,grade,entry);return quote?{...quote,basisMaterialId:peer.id,basisMaterialName:peer.name}:null;}).filter(Boolean).sort((a,b)=>a.priceCents-b.priceCents||a.basisMaterialId.localeCompare(b.basisMaterialId));
  return prices.length?{...prices[0],source:'group',groupSource:prices[0].source}:null;
 }
 function ownMaterialPrice(material,grade,entry){
  integer(grade,'材料等级',1,materialMaxGrade(material));
  const custom=entry?.custom?.[material.id]||{},market=entry?.quotes?.[material.id]||{},valid=q=>Number.isSafeInteger(q?.priceCents)&&q.priceCents>0;
  if(valid(custom[grade]))return {...custom[grade],grade,source:'custom',basisGrade:grade,serverId:String(entry.serverId)};
  if(material.family==='point')return valid(market[grade])?{...market[grade],grade,source:'market',basisGrade:grade,serverId:String(entry.serverId)}:null;
  const reliable=Object.entries(market).filter(([g,q])=>valid(q)&&Number(g)>=1&&Number(g)<=(materialMaxGrade(material))&&q.priceCents>1000).map(([g,q])=>({...q,grade:Number(g),source:'market'}));
  const floorLimited=valid(market[grade])&&market[grade].floorLimited!==false&&market[grade].priceCents<=1000;
  if((marketGrades(material).includes(grade)||material.family==='clock')&&valid(market[grade])&&!floorLimited)return {...market[grade],grade,source:'market',basisGrade:grade,serverId:String(entry.serverId)};
  if(!['clock','starlight'].includes(material.family)&&marketGrades(material).includes(grade)&&!floorLimited)return null;
  const candidates=floorLimited?reliable.sort((a,b)=>a.grade-b.grade):[...reliable,...Object.entries(custom).filter(([g,q])=>valid(q)&&Number(g)>=1&&Number(g)<=(materialMaxGrade(material))).map(([g,q])=>({...q,grade:Number(g),source:'custom'}))].sort((a,b)=>Math.abs(a.grade-grade)-Math.abs(b.grade-grade)||Number(b.source==='custom')-Number(a.source==='custom')||a.grade-b.grade);
  if(!candidates.length)return null;const base=candidates[0];
  return {grade,priceCents:Math.max(1,Math.round(materialPrice(material,grade,base))),serverId:String(entry.serverId),source:'computed',basisGrade:base.grade,basisSource:base.source,floorAdjusted:floorLimited,missingMarketFallback:material.family==='starlight'&&marketGrades(material).includes(grade)&&!valid(market[grade]),at:base.at};
 }
 const PHYSICAL_POWER_SPLIT=60; // Query partition only; larger values use an overflow query.
 const WEAPON_GROUPS=[['14','6'],['4','10'],['15','53','91'],['14','4','6','10','15','53','91','7','8','9','11','12','13','52','54','72','73','74']];
 const ALL_WEAPONS=new Set([...WEAPON_GROUPS.flat(),'5','83']);
 const HOLE_KEYS=['60','90','120','130','140','150','160'];
 function defaults(){return {version:1,gemDiscount:100,gemCapMultiplier:1.2,repairDiscounts:{'1':90,'2':70,'3':50},repairDiscountTiers:{below100:{'1':100,'2':95,'3':90},from100to120:{'1':90,'2':80,'3':70}},holeDeductions:{'60':0,'90':20,'120':80,'130':200,'140':300,'150':400,'160':600}};}
 function amount(value,label){if(value===null||value===undefined||value===''||typeof value==='boolean'||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1e9)throw Error(label+'必须是有效的非负金额');return Math.round(Number(value)*100);}
 function percent(value,label,{allowZero=true}={}){if(value===null||value===undefined||value===''||typeof value==='boolean'||!Number.isFinite(Number(value))||Number(value)<(allowZero?0:0.01)||Number(value)>100)throw Error(label+'必须在 '+(allowZero?'0':'0.01')+'～100% 之间');return Number(value);}
 function settings(value){
  if(!value||value.version!==1)throw Error('装备估价设置版本无效');
  const out=defaults();out.gemDiscount=percent(value.gemDiscount,'宝石计价比例');
  const cap=value.gemCapMultiplier===undefined?1.2:value.gemCapMultiplier;if(cap===null||cap===''||typeof cap==='boolean'||!Number.isFinite(Number(cap))||Number(cap)<0||Number(cap)>100)throw Error('宝石价值上限倍数必须在0～100之间');out.gemCapMultiplier=Number(cap);
  for(const key of ['1','2','3'])out.repairDiscounts[key]=percent(value.repairDiscounts?.[key],key+'次失败折扣',{allowZero:false});
  for(const tier of ['below100','from100to120'])for(const key of ['1','2','3'])out.repairDiscountTiers[tier][key]=percent(value.repairDiscountTiers?.[tier]?.[key]??out.repairDiscountTiers[tier][key],tier+' '+key+'次失败折扣',{allowZero:false});
  for(const key of HOLE_KEYS)out.holeDeductions[key]=amount(value.holeDeductions?.[key],'开孔计价')/100;
  if(out.holeDeductions['60']!==0)throw Error('60级及以下满孔不计价');
  return out;
 }
 function load(storage){const raw=storage.getItem(STORAGE_KEY);return raw===null?defaults():settings(JSON.parse(raw));}
 function save(storage,value){const next=settings(value);storage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}
 function integer(value,label,min,max){if(value===null||value===undefined||value===''||typeof value==='boolean'||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)throw Error(label+'无效');return Number(value);}
 function repairFactor(failures,value=defaults(),level=160){const n=integer(failures,'失败次数',0,3),s=settings(value),discounts=Number(level)<100?s.repairDiscountTiers.below100:Number(level)<=120?s.repairDiscountTiers.from100to120:s.repairDiscounts;return n===0?1:discounts[String(n)]/100;}
 function holeValue(level,holes,value=defaults()){
  const n=integer(level,'装备等级',0,160),h=integer(holes,'开孔数量',0,5),tier=n<=60?'60':n<=90?'90':n<=120?'120':String(Math.ceil(n/10)*10),full=n<=60?2:n<=90?3:n<=120?4:5;
  if(h!==full)return 0;return amount(settings(value).holeDeductions[tier],'开孔计价');
 }
 // All monetary calculations use cents; the configured cap excludes holes.
 function capGemValue(gemCents,equipmentCents,value=defaults()){
  for(const n of [gemCents,equipmentCents])if(!Number.isSafeInteger(n)||n<0||n>1e11)throw Error('估价金额无效');
  const limit=Math.round(equipmentCents*settings(value).gemCapMultiplier),capped=gemCents>limit;
  return {valueCents:capped?limit:gemCents,capped,uncappedCents:gemCents,equipmentCents};
 }
 // Recover only counts supported by totals or explicit initial attributes.
 function inferGemCounts({gemIds=[],grade,kindId,totals={},initials={}}){
  if(grade===null||grade===undefined||grade==='')return {};
  const ids=[...new Set(gemIds.map(String))],g=Number(grade),kind=String(kindId),weapon=!['17','58','18','59','19','20','21'].includes(kind),fixed={};
  if(!Number.isInteger(g)||g<0||ids.length>4)return {};
  if(!g)return Object.fromEntries(ids.map(id=>[id,0]));
  if(ids.length===1)return {[ids[0]]:g};
  const specs={'1':['命中',25,null,!weapon],'2':['伤害',8,'initialDamageExcludingHit',!weapon],'3':['灵力',6,'initialSpirit',kind!=='21'],'4':['气血',40,'initialHp',kind!=='20'],'5':['防御',12,'initialDefense',false],'6':['速度',8,null,true]};
  for(const id of ids){const spec=specs[id];if(!spec)continue;const [label,unit,key,noBase]=spec,total=totals[label],initial=key?initials[key]:undefined;
   if(!Number.isFinite(total))continue;
   const n=Number.isFinite(initial)?(total-initial)/unit:noBase?total/unit:NaN;
   if(Number.isInteger(n))fixed[id]=n;
  }
  const candidates=[];
  function walk(index,left,counts){if(index===ids.length){if(left===0)candidates.push(counts);return;}const id=ids[index],remaining=ids.length-index-1;for(let n=1;n<=left-remaining;n++){if(fixed[id]!==undefined&&fixed[id]!==n)continue;walk(index+1,left-n,{...counts,[id]:n});}}
  walk(0,g,{});if(!candidates.length)return {};
  return Object.fromEntries(ids.filter(id=>candidates.every(c=>c[id]===candidates[0][id])).map(id=>[id,candidates[0][id]]));
 }
 function restoreInitialMetrics({gemIds=[],grade,kindId,totals={},initials={}}){
  if(grade===null||grade===undefined||grade===''||!Number.isInteger(Number(grade))||Number(grade)<0||Number(grade)>0&&!gemIds.length)return {...initials};
  const counts=inferGemCounts({gemIds,grade,kindId,totals,initials}),ids=new Set(gemIds.map(String)),bonus=(id,unit)=>!ids.has(id)||Number(grade)===0?0:counts[id]===undefined?NaN:counts[id]*unit,result={...initials};
  const set=(key,n)=>{if(result[key]===undefined&&Number.isFinite(n))result[key]=Number(n.toFixed(3));};
  set('initialDamageExcludingHit',totals['伤害']-bonus('2',8));
  set('initialDamageIncludingHit',Math.floor(totals['伤害']-bonus('2',8)+(totals['命中']-bonus('1',25))/3));
  set('initialSpirit',totals['灵力']-bonus('3',6));set('initialDefense',totals['防御']-bonus('5',12));set('initialHp',totals['气血']-bonus('4',40));set('initialAgility',totals['敏捷']);
  return result;
 }
 function gemValue({gemIds,grade,quotes,gemCounts},value=defaults()){
  const config=settings(value),g=integer(grade,'宝石等级',0,20);
  if(g===0)return {valueCents:0,gemId:null,quoteGrade:null};
  if(!Array.isArray(gemIds)||!gemIds.length)throw Error('缺少宝石类型，不能按零元估价');
  const ids=[...new Set(gemIds.map(String))];for(const id of ids)if(!GEM_TYPES[id])throw Error('未知宝石类型：'+id);
  if(ids.length>g)throw Error('混打宝石种类超过锻炼等级');
  const values=ids.map(id=>{const gem=GEM_TYPES[id],quote=quotes?.[id];
   if(gem.type===null)return {gemId:id,quoteGrade:null,unitCents:0};
   if(!quote||!Number.isInteger(quote.grade)||!Number.isSafeInteger(quote.priceCents)||quote.priceCents<=0)throw Error('缺少'+gem.name+g+'级的本服报价');
   return {gemId:id,quoteGrade:quote.grade,unitCents:materialPrice({name:gem.name,family:'gem'},1,quote)};
  }).sort((a,b)=>a.unitCents-b.unitCents);
  if(values.length===1){const gem=values[0];return {gemId:gem.gemId,quoteGrade:gem.quoteGrade,valueCents:Math.round(gem.unitCents*2**g*config.gemDiscount/100)};}
  // Assign the known counts to contiguous stages, expensive first. Without
  // unique counts, reserve one low stage per expensive type as a lower bound.
  const known=gemCounts&&ids.every(id=>Number.isInteger(gemCounts[id])&&gemCounts[id]>0)&&ids.reduce((n,id)=>n+gemCounts[id],0)===g;
  const counts=known?gemCounts:Object.fromEntries(values.map((gem,i)=>[gem.gemId,i===0?g-values.length+1:1]));
  const allocation=[],cheapest=values[0];let cents=0,stage=1;
  for(const gem of [...values].reverse())for(let n=0;n<counts[gem.gemId];n++,stage++){const price=gem.unitCents*2**(stage-1);cents+=price;allocation.push({gemId:gem.gemId,stage,valueCents:price});}

  return {gemId:cheapest.gemId,quoteGrade:cheapest.quoteGrade,allocation,valueCents:Math.round(cents*config.gemDiscount/100)};
 }
 function evaluate({baseCents,level,holes,holeSets,failures,gemIds,grade,quotes,gemCounts},value=defaults()){
  if(!Number.isSafeInteger(baseCents)||baseCents<0||baseCents>1e11)throw Error('装备基础估价无效');
  const factor=repairFactor(failures,value,level),holeCents=EquipmentOpenings.parse({holeSets,holes}).reduce((sum,n)=>sum+holeValue(level,n,value),0),gemComparisonCents=Math.round(baseCents*factor),equipmentCents=gemComparisonCents+holeCents;
  const gem=gemValue({gemIds,grade,quotes,gemCounts},value),cap=capGemValue(gem.valueCents,gemComparisonCents,value);
  return {baseCents,repairFactor:factor,holeCents,equipmentCents,gemComparisonCents,gem:{...gem,...cap},totalCents:equipmentCents+cap.valueCents};
 }
 function expandFilters(filters){
  const next=JSON.parse(JSON.stringify(filters||{}));
  for(const key of ['gems','gemLevel','excludeMixedGems','repairFailures','holeCount','activatedStarPosition'])delete next[key];
  if(next.maxPrice!==undefined&&next.maxPrice!==null&&next.maxPrice!=='')next.maxPrice=(Math.floor(amount(next.maxPrice,'价格上限')*120/100)/100).toFixed(2);
  const source=next.types?.length?next.types:next.type!==undefined&&next.type!==''?[next.type]:[];
  if(source.length){next.types=[...new Set(source.flatMap(id=>{const key=String(id);return ALL_WEAPONS.has(key)&&!['5','83'].includes(key)?(WEAPON_GROUPS.find(group=>group.includes(key))||[key]):[key];}))];delete next.type;}
  return next;
 }
 // Five protected days, then a quadratic markdown that accelerates toward expiry.
 function listingDiscount(meta={},now=Date.now()){
  const expires=meta.expiresAt;
  if(!Number.isFinite(expires)||expires<=0)return {timeFactor:1,remainingDays:null,listingDays:null};
  const remainingDays=Math.min(17,Math.max(0,(expires-now)/86400000));
  const listingDays=17-remainingDays,progress=Math.max(0,listingDays-5)/12;
  return {timeFactor:1-.2*progress*progress,remainingDays,listingDays};
 }
 function suggestedPrice(target,sampleEstimateCents,now=Date.now()){
  const age=listingDiscount(target.valuationMeta,now),askingCents=amount(target.price,'商品挂牌价');
  const priceCapCents=age.listingDays!==null&&age.listingDays>5?Math.round(askingCents*age.timeFactor):null;
  const estimateCents=sampleEstimateCents==null?null:priceCapCents===null?sampleEstimateCents:Math.min(sampleEstimateCents,priceCapCents);
  return {estimateCents,sampleEstimateCents,priceCapCents,targetListing:age,cappedByListing:estimateCents!==null&&estimateCents<sampleEstimateCents,belowComparableAsk:age.listingDays!==null&&age.listingDays<=5&&sampleEstimateCents>askingCents};
 }
 function sampleBase(item,gemCents,value=defaults(),now=Date.now(),clockCents=0){
  if(!Number.isSafeInteger(clockCents)||clockCents<0||clockCents>1e11)throw Error('样本钟灵石金额无效');
  if(!Number.isSafeInteger(gemCents)||gemCents<0||gemCents>1e11)throw Error('样本宝石金额无效');
  const m=item.valuationMeta;if(!m)throw Error('缺少装备折算信息');
  const age=listingDiscount(m,now),price=Math.round(amount(item.price,'样本价格')*age.timeFactor),holes=EquipmentOpenings.parse(m,item.description||(item.traits||[]).join('\n')).reduce((sum,n)=>sum+holeValue(m.level,n,value),0),net=price-holes-clockCents,factor=repairFactor(m.failures,value,m.level??item.level);
  if(net<=0)throw Error(clockCents?'扣除钟灵石金额后没有有效装备价格':'扣除满孔金额后没有有效装备价格');
  let equipment=net-gemCents,capped=false;const multiplier=settings(value).gemCapMultiplier;
  if(equipment<0||gemCents>equipment*multiplier){equipment=net/(1+multiplier);capped=true;if(gemCents<=equipment*multiplier)throw Error('挂牌价无法按宝石上限规则一致折算');}
  const baseCents=Math.round(equipment/factor);if(baseCents<=0||!Number.isSafeInteger(baseCents))throw Error('样本基础价格无效');
  return {...item,baseCents,adjustments:{...age,timeAdjustedPriceCents:price,clockCents,gemCents:capped?net-Math.round(equipment):gemCents,uncappedGemCents:gemCents,gemCapped:capped,holeCents:holes,repairFactor:factor}};
 }
 function confidence(count){return count>=60?{level:'normal',label:'样本充足'}:count>=30?{level:'limited',label:'样本不足'}:count>=15?{level:'low',label:'可信度较低'}:count>=5?{level:'rough',label:'仅供粗略参考'}:{level:'insufficient',label:'不足 5 个有效样本，不提供自动区间'};}
 function summarize(samples){
  const sorted=[...samples].sort((a,b)=>a.baseCents-b.baseCents),n=sorted.length,state=confidence(n);if(n<5)return {...state,count:n,baseRange:null,references:sorted.map(row=>({...row,referenceLabel:'少量样本（不生成区间）'}))};
  const quantile=q=>{const i=(n-1)*q,lo=Math.floor(i),hi=Math.ceil(i);return Math.round(sorted[lo].baseCents+(sorted[hi].baseCents-sorted[lo].baseCents)*(i-lo));};
  const baseRange={low:quantile(.25),median:quantile(.5),high:quantile(.75)},chosen=new Map();
  for(const [label,point] of [['区间下沿',baseRange.low],['区间中位',baseRange.median],['区间上沿',baseRange.high]]){const row=sorted.reduce((best,row)=>Math.abs(row.baseCents-point)<Math.abs(best.baseCents-point)?row:best);if(!chosen.has(row.id))chosen.set(row.id,{...row,referenceLabel:label});}
  for(const row of sorted.filter(row=>row.valuationMeta.grade===0&&row.valuationMeta.failures===0).slice(0,2))if(chosen.size<5&&!chosen.has(row.id))chosen.set(row.id,{...row,referenceLabel:'无宝石无失败样本'});
  return {...state,count:n,baseRange,references:[...chosen.values()]};
 }
 function groups(task,items){
  const f=task.equipmentFilters||{},pairs=new Map();
  for(const item of items||[])if(item.kind==='sword'&&item.equipmentKindId&&Number(item.level)>=60&&Number(item.level)<=160)pairs.set(item.equipmentKindId+':'+item.level,{kindId:String(item.equipmentKindId),level:Number(item.level),name:item.type||item.name});
  const levels=f.levels?.length?f.levels.map(Number):f.levelMin||f.levelMax?Array.from({length:11},(_,i)=>60+i*10).filter(level=>level>=Number(f.levelMin||60)&&level<=Number(f.levelMax||160)):[],types=f.types?.length?f.types:f.type?[f.type]:[];
  for(const type of types)for(const level of levels)if(!pairs.has(type+':'+level))pairs.set(type+':'+level,{kindId:String(type),level,name:'装备类型 '+type});
  return [...pairs.values()].sort((a,b)=>b.level-a.level||a.kindId.localeCompare(b.kindId));
 }
 // Compare category-specific base attributes and the additions selected by the task.
 const METRICS={totalDamage:'总伤',initialDamageIncludingHit:'初伤（含命中）',initialDamageExcludingHit:'初伤（不含命中）',damage:'伤害',initialSpirit:'初灵',totalSpirit:'总灵',initialDefense:'初防',initialHp:'初血',initialAgility:'初敏'};
 const ADDITIONS={negative:'负属性合计',power:'力量',magic:'魔力',dex:'敏捷',endurance:'耐力',physique:'体质'};
 // Reinforced, non-exclusive base spirit ranges, before gems/melting.
 // https://xyq.17173.com/player/newer22_2.htm ; 160: https://3g.ali213.net/gl/html/1331805.html
 const NECKLACE_SPIRIT_RANGES={60:[80,104],70:[93,120],80:[106,137],90:[118,153],100:[131,170],110:[143,185],120:[156,202],130:[169,219],140:[181,235],150:[194,252],160:[196,267]};
 function additionRules(additions){
  const rules=additions.map(key=>({key:'addon:'+key,label:ADDITIONS[key],tolerance:2,alternativeTolerance:3,unrestrictedTotalGain:3,actualAdditions:true}));
  if(additions.length)rules.push({key:'addonTotal',label:'属性总点数',additions,actualAdditions:true,tolerance:2,minimumDelta:-2,wideMinimumDelta:0,unrestrictedTotalGain:3});
  return rules;
 }
 function actualAdditionKeys(item){if(item.equipmentKindId&&!AttributeFocus.applicable(item.equipmentKindId))return [];const values=metrics(item);return Object.keys(ADDITIONS).filter(key=>key!=='negative'&&Number.isFinite(values['addon:'+key])&&values['addon:'+key]!==0);}
 function physicalTotal(target,rules){return attributeFocus(target).usage==='physical'&&rules.some(r=>['totalDamage','initialDamageIncludingHit','initialDamageExcludingHit','damage'].includes(r.key));}
 function positiveAdditionKeys(item,ignorePower=false){const v=metrics(item);return actualAdditionKeys(item).filter(k=>v['addon:'+k]>0&&(!ignorePower||k!=='power'));}
 function actualComparisonRules(target,rules){
  const focus=attributeFocus(target),physical=physicalTotal(target,rules),keys=positiveAdditionKeys(target,physical),hasAdditions=actualAdditionKeys(target).length>0;
  const base=rules.filter(r=>!r.key.startsWith('addon:')&&r.key!=='addonTotal').map(r=>physical&&['totalDamage','initialDamageIncludingHit','initialDamageExcludingHit','damage'].includes(r.key)?{...r,key:r.key==='totalDamage'?'totalDamage':'initialDamageIncludingHit',label:(r.key==='totalDamage'?'总伤':'初总伤')+'（含力量×0.67）',physicalPower:true}:r);
  return [...new Map(base.map(r=>[r.key,r])).values(),...additionRules(hasAdditions?[...keys,...(actualAdditionKeys(target).some(k=>(!physical||k!=='power')&&metrics(target)['addon:'+k]<0)?['negative']:[])]:[]).map(rule=>({...rule,ignorePower:physical,...(rule.key==='addonTotal'&&focus.keys.some(k=>!physical||k!=='power')?{minimumDelta:-1}:{}),preferred:rule.key!=='addon:negative'&&rule.key.startsWith('addon:')&&focus.keys.includes(rule.key.slice(6))}))];
 }

 function comparisonRules(filters={},group={},targets){
  const selected=k=>filters[k]!==undefined&&filters[k]!==null&&filters[k]!=='';
  const kind=String(group.kindId||filters.types?.[0]||filters.type||'');
  const rule=(key,tolerance)=>({key,label:METRICS[key],tolerance});
  const additions=targets?[...new Set(targets.flatMap(t=>[...positiveAdditionKeys(t),...(actualAdditionKeys(t).some(k=>metrics(t)['addon:'+k]<0)?['negative']:[])]))]:[...new Set((filters.sumAttributes||[]).filter(k=>ADDITIONS[k]))];
  const addonRules=additionRules(additions);
  if(kind==='21')return [{...rule('initialSpirit',3),necklace:true}];
  if(['18','59'].includes(kind))return [rule('initialDefense',4),...addonRules];
  if(['17','58'].includes(kind))return [rule('initialDefense',2)];
  if(kind==='20')return [rule('initialDefense',2),rule('initialHp',10)];
  if(kind==='19')return [rule('initialDefense',2),rule('initialAgility',1)];
  const damage=['totalDamage','initialDamageIncludingHit','initialDamageExcludingHit','damage'].find(selected);
  return [...(filters.automaticWeaponComparison?['initialDamageExcludingHit','initialDamageIncludingHit'].filter(selected).map(key=>rule(key,4)):damage?[rule(damage,4)]:[]),...Object.keys(METRICS).filter(k=>!['totalDamage','initialDamageIncludingHit','initialDamageExcludingHit','damage'].includes(k)&&selected(k)).map(key=>rule(key,4)),...addonRules];
 }
 function ruleValue(item,rule){
  const values=metrics(item);if(rule.physicalPower)return Number.isFinite(values[rule.key])?Number((values[rule.key]+(values['addon:power']||0)*.67).toFixed(3)):undefined;if(rule.key==='addon:negative')return actualAdditionKeys(item).filter(k=>values['addon:'+k]<0&&(!rule.ignorePower||k!=='power')).reduce((n,k)=>n+values['addon:'+k],0);if(!rule.additions)return rule.actualAdditions&&rule.key.startsWith('addon:')?(values[rule.key]??0):values[rule.key];
  const additions=rule.actualAdditions?actualAdditionKeys(item).filter(k=>!rule.ignorePower||k!=='power'):rule.additions;
  return additions.every(key=>Number.isFinite(values['addon:'+key]))?additions.reduce((sum,key)=>sum+values['addon:'+key],0):undefined;
 }
 function equipmentTotals(item){
  const totals=Object.fromEntries((item.attributes||[]).map(a=>[a.label,Number(a.value)]));
  const supplied=new Set(Object.keys(totals)),description=item.description||'',head=description.split(/熔炼效果|符石|星位|制造者/)[0];
  for(const line of head.split('\n'))if(/^(?:伤害|命中|防御|灵力|气血|魔法|速度|敏捷)\s*[+-]?\d/.test(line.trim()))for(const m of line.matchAll(/(伤害|命中|防御|灵力|气血|魔法|速度|敏捷)\s*([+-]?\d+(?:\.\d+)?)/g))if(totals[m[1]]===undefined)totals[m[1]]=Number(m[2]);
  const melting=description.split('熔炼效果')[1]||'';
  for(const m of melting.matchAll(/([+-]\d+(?:\.\d+)?)\s*(伤害|命中|防御|灵力|气血|魔法|速度|敏捷)/g))if(!supplied.has(m[2]))totals[m[2]]=(totals[m[2]]||0)+Number(m[1]);
  return totals;
 }
 function gemCountsForItem(item){return inferGemCounts({gemIds:item.valuationMeta?.gemIds??item.equipmentGemIds??[],grade:item.valuationMeta?.grade??item.equipmentGemLevel,kindId:item.equipmentKindId,totals:equipmentTotals(item),initials:item.valuationMeta?.metrics||{}});}
 function metrics(item){
  const values={...(item.valuationMeta?.metrics||{})};
  for(const [key,label] of Object.entries(METRICS)){const v=item.attributes?.find(a=>a.label===label)?.value;if(values[key]===undefined&&v!==undefined&&Number.isFinite(Number(v)))values[key]=Number(v);}
  if(item.kind==='sword'||item.equipmentKindId){
   const totals=equipmentTotals(item);
   Object.assign(values,restoreInitialMetrics({gemIds:item.valuationMeta?.gemIds??item.equipmentGemIds??[],grade:item.valuationMeta?.grade??item.equipmentGemLevel,kindId:item.equipmentKindId,totals,initials:values}));
  }
  const text=(item.added||[]).join(' ');
  for(const [key,label] of Object.entries(ADDITIONS)){const match=text.match(new RegExp(label+'\\s*([+-]?\\d+(?:\\.\\d+)?)'));if(match)values['addon:'+key]=Number(match[1]);}
  return values;
 }
 function attributeFocus(item){
  const m=item.valuationMeta||{},v=metrics(item),gemIds=m.gemIds??item.equipmentGemIds??[],gemGrade=m.grade??item.equipmentGemLevel;
  let total=v.initialDamageIncludingHit;
  if(!Number.isFinite(total)&&gemGrade===0){const hit=Number(item.attributes?.find(a=>a.label==='命中')?.value);if(Number.isFinite(hit)&&Number.isFinite(v.initialDamageExcludingHit))total=v.initialDamageExcludingHit+hit/3;else if(Number.isFinite(v.totalDamage))total=v.totalDamage;}
  return AttributeFocus.analyze({kindId:item.equipmentKindId,level:Number(item.level??m.level),gemIds,gemGrade,values:Object.fromEntries(Object.keys(ADDITIONS).map(key=>[key,v['addon:'+key]])),initialDamage:v.initialDamageExcludingHit??(gemGrade===0?v.damage:undefined),initialTotalDamage:total});
 }
 function metricBounds(target,rule){
  const n=ruleValue(target,rule);if(rule.preferred)return [n-1,Number.MAX_SAFE_INTEGER];if(rule.tolerance===0)return [n,n];
  // A gain of three permits any individual distribution or higher total.
  // Keep finite open bounds so persisted coverage survives JSON serialization.
  if(rule.key==='addonTotal'&&rule.minimumDelta!==undefined)return [n+rule.minimumDelta,Number.MAX_SAFE_INTEGER];
  if(rule.key.startsWith('addon:')&&rule.unrestrictedTotalGain!==undefined)return [-Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER];
  if(rule.key==='initialSpirit'&&(rule.necklace||String(target.equipmentKindId)==='21')){
   const max=NECKLACE_SPIRIT_RANGES[Number(target.level)]?.[1];if(!max)return [n,n];
   // The first three bands retain their lower limits and permit +2 upward,
   // including crossing a band boundary. Lower bands keep the original ±3.
   const top=max-12,tier=n>=top?0:n>=top-10?1:n>=top-20?2:3;
   if(tier===0)return [n,n+2];
   const lower=Math.max(n-tier,tier===3?0:top-tier*10);
   return [lower,tier<3?n+2:Math.min(n+3,top-21)];
  }
  const tolerance=rule.alternativeTolerance??rule.tolerance;
  return [n-tolerance,n+tolerance];
 }
 function exactAttributes(target,sample,rules){return actualComparisonRules(target,rules).every(r=>Number.isFinite(ruleValue(target,r))&&ruleValue(target,r)===ruleValue(sample,r));}
 function comparisons(target,sample,rules){
  rules=actualComparisonRules(target,rules);
  const rows=rules.map(rule=>{const bounds=metricBounds(target,rule),a=ruleValue(target,rule),b=ruleValue(sample,rule);return {...rule,target:a,sample:b,matches:Number.isFinite(a)&&Number.isFinite(b)&&b>=bounds[0]&&b<=bounds[1]};});
  const total=rows.find(r=>r.key==='addonTotal'&&r.minimumDelta!==undefined),additions=rows.filter(r=>r.key.startsWith('addon:'));
  if(total&&additions.length){
   const finite=[total,...additions].every(r=>Number.isFinite(r.target)&&Number.isFinite(r.sample));
   const delta=total.sample-total.target;
   const matches=finite&&additions.every(r=>!r.preferred||r.sample>=r.target-1)&&(!total.ignorePower&&delta>=total.unrestrictedTotalGain||delta>=total.wideMinimumDelta&&additions.every(r=>Math.abs(r.sample-r.target)<=r.alternativeTolerance)||delta>=total.minimumDelta&&additions.every(r=>Math.abs(r.sample-r.target)<=r.tolerance));
   for(const row of [total,...additions])row.matches=matches;
  }
  return rows;
 }
 const IMPORTANT_EFFECTS={'1':'无级别限制','2':'简易','3':'愤怒','5':'永不磨损','7':'神佑','9':'坚固','12':'专注','14':'易修理'};
 const IMPORTANT_SKILLS={'1020':'野兽之力','1030':'放下屠刀','1036':'破血狂攻','1013':'破甲术','2013':'玄鸟之灵','2010':'琴音三叠','2017':'攻心术','2015':'伯牙绝弦','1012':'水清诀','1014':'玉清诀','1015':'晶清诀','1008':'四海升平','1011':'慈航普度','1027':'罗汉金钟','2009':'金刚怒目'};
 const IMPORTANT_SUITS=Object.freeze({"1040":{"name":"凤凰","source":"suit_transform_skills"},"1041":{"name":"蛟龙","source":"suit_transform_skills"},"1042":{"name":"雨师","source":"suit_transform_skills"},"1043":{"name":"如意仙子","source":"suit_transform_skills"},"1045":{"name":"巡游天神","source":"suit_transform_skills"},"1046":{"name":"星灵仙子","source":"suit_transform_skills"},"1047":{"name":"幽灵","source":"suit_transform_skills"},"1048":{"name":"鬼将","source":"suit_transform_skills"},"1049":{"name":"吸血鬼","source":"suit_transform_skills"},"1050":{"name":"净瓶女娲","source":"suit_transform_skills"},"1052":{"name":"灵符女娲","source":"suit_transform_skills"},"1053":{"name":"画魂","source":"suit_transform_skills"},"1054":{"name":"幽萤娃娃","source":"suit_transform_skills"},"1055":{"name":"大力金刚","source":"suit_transform_skills"},"1056":{"name":"雾中仙","source":"suit_transform_skills"},"1057":{"name":"灵鹤","source":"suit_transform_skills"},"1058":{"name":"夜罗刹","source":"suit_transform_skills"},"1059":{"name":"炎魔神","source":"suit_transform_skills"},"1060":{"name":"噬天虎","source":"suit_transform_skills"},"1061":{"name":"踏云兽","source":"suit_transform_skills"},"1062":{"name":"红萼仙子","source":"suit_transform_skills"},"1063":{"name":"龙龟","source":"suit_transform_skills"},"1064":{"name":"机关兽","source":"suit_transform_skills"},"1065":{"name":"机关鸟","source":"suit_transform_skills"},"1066":{"name":"连弩车","source":"suit_transform_skills"},"1067":{"name":"巴蛇","source":"suit_transform_skills"},"1069":{"name":"葫芦宝贝","source":"suit_transform_skills"},"1070":{"name":"猫灵（人型）","source":"suit_transform_skills"},"1071":{"name":"狂豹（人型）","source":"suit_transform_skills"},"1072":{"name":"蝎子精","source":"suit_transform_skills"},"1073":{"name":"混沌兽","source":"suit_transform_skills"},"1074":{"name":"长眉灵猴","source":"suit_transform_skills"},"1075":{"name":"巨力神猿","source":"suit_transform_skills"},"1076":{"name":"修罗傀儡鬼","source":"suit_transform_skills"},"1077":{"name":"修罗傀儡妖","source":"suit_transform_skills"},"1078":{"name":"金身罗汉","source":"suit_transform_skills"},"1079":{"name":"藤蔓妖花","source":"suit_transform_skills"},"1080":{"name":"曼珠沙华","source":"suit_transform_skills"},"1081":{"name":"蜃气妖","source":"suit_transform_skills"},"3011":{"name":"满天花雨","source":"suit_append_skills","minLevel":150},"4002":{"name":"定心术","source":"suit_added_status"},"4005":{"name":"逆鳞","source":"suit_added_status"},"4011":{"name":"变身","source":"suit_added_status","excludeFemale":true},"4015":{"name":"杀气诀","source":"suit_added_status"},"4017":{"name":"碎星诀","source":"suit_added_status"},"4019":{"name":"天神护体","source":"suit_added_status"}});
 const SUIT_VALUE_GROUPS=Object.freeze({
  '体质':[['1079','1078','1064','1061','1055']],
  '魔力':[['1081','1074','1073','1057','1059','1069'],['1052','1050','1046','1043','1041','1042']],
  '敏捷':[['1077','1070','1056','1065','1067','1053'],['1047','1049','1040']],
  '耐力':[['1080','1072','1066','1063','1062','1054']],
  '力量':[['1058','1075','1076','1071','1060'],['1048','1045']]
 });
 const SUIT_ATTRIBUTE_GROUPS=Object.freeze(Object.fromEntries(Object.entries(SUIT_VALUE_GROUPS).map(([label,groups])=>[label,groups.flat().map(id=>IMPORTANT_SUITS[id].name)])));
 function suitValueKeys(id){const keys=[];for(const [label,groups] of Object.entries(SUIT_VALUE_GROUPS))groups.forEach((group,i)=>{if(group.includes(id))keys.push(label+':'+i);});return keys.length?keys:['suit:'+id];}
 function comparisonSuits(item){
  const ids=new Set();for(const suit of importantSuits(item)){ids.add(suit.id);for(const groups of Object.values(SUIT_VALUE_GROUPS))for(const group of groups)if(group.includes(suit.id))for(const id of group)ids.add(id);}
  return [...ids].sort().map(id=>({value:id,source:IMPORTANT_SUITS[id].source}));
 }
 function suitsMatch(a,b){
  if(a.length!==b.length)return false;
  const match=(i,remaining)=>i===a.length||remaining.some((id,j)=>suitValueKeys(a[i]).some(key=>suitValueKeys(id).includes(key))&&match(i+1,remaining.filter((_id,k)=>k!==j)));
  return match(0,b);
 }
 function traitsMatch(a,b){const usage=attributeFocus(a).usage;const left=importantTraits(a,usage),right=importantTraits(b,usage);return JSON.stringify([left.effects,left.skills])===JSON.stringify([right.effects,right.skills])&&suitsMatch(left.suits,right.suits);}
 function importantSuits(item,usage=attributeFocus(item).usage){
  const ids=new Set((Array.isArray(item.valuationMeta?.suitIds)?item.valuationMeta.suitIds:[]).map(String));
  const normalize=name=>String(name).replace(/人型/g,'人形').replace(/藤蔓花妖/g,'藤蔓妖花').replace(/长眉灵魂/g,'长眉灵猴').replace(/幽莹娃娃/g,'幽萤娃娃').replace(/漫天花雨/g,'满天花雨').replace(/\s/g,'');
  if(!ids.size)for(const raw of item.suits||[]){const label=normalize(raw);if(/变化咒/.test(label))continue;const transform=/变身术/.test(label),name=label.replace(/^(?:套装效果[:：]?)?(?:变身术|附加状态|追加状态|追加法术|附加法术)?[·:：之]*/,'').replace(/（(?:体质|魔力|敏捷|耐力|力量)套）$/,'');for(const [id,rule] of Object.entries(IMPORTANT_SUITS)){if(transform&&rule.source!=='suit_transform_skills')continue;if(normalize(rule.name)===name)ids.add(id);}}
  const ignored=usage==='spell'?new Set(['4005','4011','4015','4017','3011']):usage==='physical'?new Set(['4002']):new Set();
  const female=['58','59'].includes(String(item.equipmentKindId))||/女头|女衣/.test(item.type||'');
  return [...ids].sort().filter(id=>Object.hasOwn(IMPORTANT_SUITS,id)&&!ignored.has(id)).map(id=>({id,...IMPORTANT_SUITS[id]})).filter(rule=>(!rule.minLevel||Number(item.level)>=rule.minLevel)&&(!rule.excludeFemale||!female));
 }
 function skillValued(item,id){
  if(String(id)!=='2009')return true;
  const focus=attributeFocus(item);
  if(!['weapon','armor'].includes(focus.category))return true;
  return focus.keys.includes('dex')||focus.keys.length===0&&(metrics(item)['addon:dex']??0)>0;
 }
 function importantTraits(item,usage=attributeFocus(item).usage){
  const pick=(dict,ids,names)=>Object.keys(dict).filter(id=>(ids||[]).map(String).includes(id)||(names||[]).some(name=>String(name).includes(dict[id])||id==='1'&&dict===IMPORTANT_EFFECTS&&String(name).includes('无级别')));
  return {effects:pick(IMPORTANT_EFFECTS,item.valuationMeta?.effectIds,item.specialEffects).filter(id=>(id!=='2'||[70,110,130].includes(Number(item.level)))&&(id!=='9'||Number(item.level)>=100)&&(id!=='14'||repairFailures(item)===0&&Number(item.level)>=100)),skills:pick(IMPORTANT_SKILLS,item.valuationMeta?.skillIds,item.specialSkills).filter(id=>skillValued(item,id)),suits:importantSuits(item,usage).map(suit=>suit.id)};
 }
 function traitKey(item){const traits=importantTraits(item);return JSON.stringify({...traits,suits:traits.suits.map(id=>suitValueKeys(id).join('|')).sort()});}
 function repairFailures(item){
  const value=item.valuationMeta?.failures;if(Number.isInteger(value)&&value>=0)return value;
  const text=[...(item.traits||[]),item.description||''].join(' '),match=text.match(/修理失败\s*(\d+)\s*次/);return match?Number(match[1]):0;
 }
 function repairSampleMax(item){const n=repairFailures(item),level=Number(item.level??item.valuationMeta?.level??160);return level<100?(n<=2?2:3):level<=120?(n<=1?1:3):(n<=1?1:n===2?2:3);}
 function repairGroup(item){const max=repairSampleMax(item);return max===1?'low':max===2?'max2':'all';}
 function isRoleExclusive(item={}){return item.roleExclusive===true||item.valuationMeta?.roleExclusive===true||/专用/.test([item.description,item.styledDescription,...(item.traits||[])].filter(Boolean).join('\n'));}
 function skipReason(item){return isRoleExclusive(item)?'角色专用装备，不估价':Number.isFinite(item.price)&&item.price<50?'挂牌价低于50元，不估价':'';}
 function isMixedGems(item){
  const grade=item.valuationMeta?.grade??item.equipmentGemLevel;
  if(Number(grade)===0)return false;
  const raw=item.valuationMeta?.gemIds??item.equipmentGemIds;
  const ids=Array.isArray(raw)?raw.map(String).filter(id=>id&&id!=='0'):Object.entries(GEM_TYPES).filter(([,gem])=>(item.description||'').includes(gem.name)).map(([id])=>id);
  return new Set(ids).size>1;
 }
 function mixedGemWarning(item){return isMixedGems(item)?'混打宝石可能导致估价偏差，请核对样本':'';}
 function similar(target,sample,rules){if(isMixedGems(sample)&&!isMixedGems(target))return false;if(isRoleExclusive(target)||isRoleExclusive(sample))return false;if(JSON.stringify(positiveAdditionKeys(target,physicalTotal(target,rules)))!==JSON.stringify(positiveAdditionKeys(sample,physicalTotal(target,rules))))return false;if(repairFailures(sample)>repairSampleMax(target))return false;if(target.level!==undefined&&sample.level!==undefined&&Number(target.level)!==Number(sample.level))return false;if(target.equipmentKindId&&sample.equipmentKindId&&!expandFilters({types:[String(target.equipmentKindId)]}).types.includes(String(sample.equipmentKindId)))return false;return target.id!==sample.id&&traitsMatch(target,sample)&&comparisons(target,sample,rules).every(r=>r.matches);}
 const DOWNGRADABLE_EFFECTS=['7','9','12'];
 function downgradeVariants(target){
  const ids=importantTraits(target).effects.filter(id=>DOWNGRADABLE_EFFECTS.includes(id)),variants=[];
  for(let mask=1;mask<2**ids.length;mask++){
   const ignoredEffects=ids.filter((id,index)=>mask&(1<<index)),ignored=new Set(ignoredEffects);
   variants.push({...target,valuationMeta:{...target.valuationMeta,effectIds:(target.valuationMeta?.effectIds||[]).map(String).filter(id=>!ignored.has(id))},specialEffects:(target.specialEffects||[]).filter(name=>!ignoredEffects.some(id=>String(name).includes(IMPORTANT_EFFECTS[id]))),ignoredEffects});
  }
  return variants.sort((a,b)=>a.ignoredEffects.length-b.ignoredEffects.length);
 }
 function downgradeTier(target,sample,rules){const variant=downgradeVariants(target).find(candidate=>similar(candidate,sample,rules));return variant?variant.ignoredEffects:null;}
 function parameterKey(target,rules){return JSON.stringify([traitKey(target),repairGroup(target),attributeFocus(target).keys,rules.map(rule=>[rule.key,ruleValue(target,rule)])]);}
 function targetBox(target,rules){return Object.fromEntries(rules.map(r=>[r.key,metricBounds(target,r)]));}
 function rangeCovers(range,target,rules){const box=targetBox(target,rules);return range.traits===traitKey(target)&&(range.repairMax??3)>=repairSampleMax(target)&&rules.every(r=>Number.isFinite(box[r.key][0])&&range.bounds[r.key]&&range.bounds[r.key][0]<=box[r.key][0]&&range.bounds[r.key][1]>=box[r.key][1]);}
 function planRanges(targets,rules){
  const traits=new Map();for(const target of targets){if(rules.some(r=>!Number.isFinite(ruleValue(target,r))))continue;const key=traitKey(target)+':'+repairGroup(target)+':'+(physicalTotal(target,rules)?'physical:':'')+positiveAdditionKeys(target,physicalTotal(target,rules)).join(',')+':'+(actualAdditionKeys(target).some(k=>metrics(target)['addon:'+k]<0)?'negative':'');if(!traits.has(key))traits.set(key,[]);traits.get(key).push(target);}
  const result=[];
  // Sampling groups need overlapping fuzzy windows, not the comparison rule's
  // unbounded upward allowance. This affects requests only; matching stays unchanged.
  const planningBounds=(target,rule)=>{
   const n=ruleValue(target,rule);
   if(rule.key==='addonTotal')return [n-2,n+3];
   if(rule.key.startsWith('addon:'))return [n-3,n+3];
   return metricBounds(target,rule);
  };
  const split=(rows,depth=0)=>{
   let best=null;
   for(const rule of rules){
    const sorted=[...rows].sort((a,b)=>ruleValue(a,rule)-ruleValue(b,rule));let hasGap=false;
    for(let i=1;i<sorted.length;i++){const left=planningBounds(sorted[i-1],rule),right=planningBounds(sorted[i],rule),gap=(right[0]-left[1])/Math.max(1,left[1]-left[0],right[1]-right[0])+1;if(gap>1){hasGap=true;if(!best||gap>best.gap)best={gap,sorted,i};}}
    const bounds=sorted.map(t=>planningBounds(t,rule)),lower=Math.max(...bounds.map(b=>b[0])),upper=Math.min(...bounds.map(b=>b[1]));
    if(!hasGap&&lower>upper&&sorted.length>1){const middle=sorted.length/2,cuts=sorted.map((t,i)=>i).filter(i=>i>0&&ruleValue(sorted[i-1],rule)!==ruleValue(sorted[i],rule)).sort((a,b)=>Math.abs(a-middle)-Math.abs(b-middle));if(cuts.length){const gap=1+(lower-upper)/Math.max(1,...bounds.map(b=>b[1]-b[0]));if(!best||gap>best.gap)best={gap,sorted,i:cuts[0]};}}
   }

   if(best&&depth<5){split(best.sorted.slice(0,best.i),depth+1);split(best.sorted.slice(best.i),depth+1);return;}
   result.push({targets:rows,traits:traitKey(rows[0]),repairMax:repairSampleMax(rows[0])===3?null:repairSampleMax(rows[0]),bounds:Object.fromEntries(rules.map(r=>[r.key,[Math.min(...rows.map(t=>metricBounds(t,r)[0])),Math.max(...rows.map(t=>metricBounds(t,r)[1]))]]))});
  };
  for(const rows of traits.values())split(rows);return result;
 }
 function comparableCandidates(target,samples,rules,quotes,value,matcher){
  const valid=[],seen=new Set();let excluded=0;
  for(const sample of samples){if(seen.has(sample.id)||!matcher(target,sample,rules))continue;seen.add(sample.id);try{valid.push({sample,equivalentSuit:JSON.stringify(importantSuits(target).map(s=>s.id))!==JSON.stringify(importantSuits(sample).map(s=>s.id)),converted:evaluate({baseCents:sample.baseCents,...target.valuationMeta,level:Number(target.level),quotes},value),comparison:comparisons(target,sample,rules)});}catch{excluded++;}}
  valid.sort((a,b)=>a.converted.totalCents-b.converted.totalCents||a.sample.price-b.sample.price||String(a.sample.id).localeCompare(String(b.sample.id)));
  return {valid,excluded};
 }
 function averageComparables(target,samples,rules,quotes,value=defaults(),matcher=similar){
  const {valid,excluded}=comparableCandidates(target,samples,rules,quotes,value,matcher);
  const selected=valid.slice(0,5);return {count:selected.length,exactCount:selected.filter(row=>exactAttributes(target,row.sample,rules)).length,availableCount:valid.length,rough:selected.length<5,excluded,estimateCents:selected.length?Math.round(selected.reduce((sum,row)=>sum+row.converted.totalCents,0)/selected.length):null,references:selected};
 }
 function supportedComparables(target,samples,rules,quotes,value=defaults(),matcher=similar,now=Date.now()){
  const candidates=comparableCandidates(target,samples,rules,quotes,value,matcher);
  return supportedPrices(candidates.valid,{targetPriceCents:targetAskingCents(target),sampleGoal:sampleRequirement(target),excluded:candidates.excluded,now,isExact:row=>exactAttributes(target,row.sample,rules)});
 }
 function targetAskingCents(target){return target&&(!target.carriedTarget||target.independentListing)&&Number.isFinite(target.price)&&target.price>0?Math.round(target.price*100):null;}
 function enforceRoughValidity(row){
  if(!row||row.precise||row.skipped||row.insufficientSamples)return row;
  const asking=targetAskingCents(row.target),estimate=row.estimateCents,rough=row.rough===true||Number.isFinite(row.count)&&row.count<sampleRequirement(row.target);
  if(!rough||!Number.isSafeInteger(asking)||!Number.isSafeInteger(estimate)||estimate<=0||asking*5>=estimate*4)return row;
  return {...row,estimateCents:null,insufficientSamples:true,invalidEstimateCents:estimate,insufficientReason:'粗略估价溢价率低于−20%，样本不足'};
 }
 function sampleRequirement(target){return target?.samplingMinimum===5?5:(targetAskingCents(target)??0)>=500000?3:5;}
 function supportedPrices(input,{excluded=0,now=Date.now(),isExact=()=>false,targetPriceCents=null,sampleGoal=null}={}){
  const valid=input.filter(row=>listingDiscount(row.sample.valuationMeta,now).remainingDays!==0).sort((a,b)=>a.converted.totalCents-b.converted.totalCents||String(a.sample.id).localeCompare(String(b.sample.id)));excluded+=input.length-valid.length;
  const ages=valid.map(row=>listingDiscount(row.sample.valuationMeta,now));
  const highPrice=Number.isSafeInteger(targetPriceCents)&&targetPriceCents>=500000;
  const requiredSampleCount=[3,5].includes(sampleGoal)?sampleGoal:highPrice?3:5;
  const requiredSupportCount=highPrice||valid.length<5?1:2;
  const hasPriceSupport=i=>i+requiredSupportCount<valid.length&&valid[i+requiredSupportCount].converted.totalCents*100<=valid[i].converted.totalCents*120;
  const hasAgeSupport=i=>ages[i].listingDays>7&&ages[i].remainingDays>0;
  const nearTarget=valid.length>0&&Number.isSafeInteger(targetPriceCents)&&targetPriceCents>0&&Math.abs(valid[0].converted.totalCents-targetPriceCents)*100<=targetPriceCents*10;
  const index=nearTarget?0:valid.findIndex((_row,i)=>hasPriceSupport(i)||hasAgeSupport(i));
  const anchor=index<0?null:valid[index],price=anchor?.converted.totalCents??null;
  const supportBasis=anchor?(hasPriceSupport(index)?'prices':hasAgeSupport(index)?'listing-age':'target-price'):null,anchorListingDays=anchor?ages[index].listingDays:null;
  const supporters=anchor?valid.slice(index+1).filter(row=>row.converted.totalCents*100<=price*120):[];
  const chosen=new Set();
  for(const row of [...(anchor?[anchor,...supporters.slice(0,requiredSupportCount),...valid.slice(0,2)]:[]),...valid]){if(chosen.size>=requiredSampleCount)break;chosen.add(row);}
  const references=[...chosen].sort((a,b)=>valid.indexOf(a)-valid.indexOf(b)).map(row=>({...row,listingDays:ages[valid.indexOf(row)].listingDays,priceSupportCount:row===anchor?supporters.length:undefined,evidenceRole:row===anchor?(supportBasis==='listing-age'?'aged-anchor':supportBasis==='target-price'?'target-price-anchor':'anchor'):supporters.includes(row)?'support':anchor&&row.converted.totalCents<price?'isolated':'comparison'}));
  return {strategy:'supported-lowest-95',requiredSampleCount,requiredSupportCount,supportBasis,anchorListingDays,count:references.length,exactCount:references.filter(isExact).length,availableCount:valid.length,rough:valid.length<requiredSampleCount||supportBasis==='listing-age'||supportBasis==='target-price',excluded,supportedPriceCents:price,supportCount:supporters.length,lowestPriceCents:valid[0]?.converted.totalCents??null,isolatedLowCents:index>0?valid[0].converted.totalCents:null,estimateCents:price===null?null:Math.round(price*95/100),references,error:anchor?'':valid.length<2?'不足 2 件有效样本，且缺少超过 7 天的挂牌依据':'报价分散且缺少挂牌时长依据，暂缺可靠估价'};
 }
 function estimateComparables(target,samples,rules,quotes,value=defaults(),now=Date.now()){
  const exact=supportedComparables(target,samples,rules,quotes,value,similar,now);if(exact.count)return {...exact,degraded:false,ignoredEffects:[]};
  for(const tier of [1,2,3]){
   const result=supportedComparables(target,samples,rules,quotes,value,(t,s,r)=>downgradeTier(t,s,r)?.length===tier,now);
   if(result.count){const references=result.references.map(row=>({...row,ignoredEffects:downgradeTier(target,row.sample,rules)}));return {...result,references,degraded:true,ignoredEffects:[...new Set(references.flatMap(row=>row.ignoredEffects))]};}
  }
  return {...exact,degraded:false,ignoredEffects:[]};
 }
 function comparisonFilters(filters,targets,rules){
  const next=expandFilters(filters);
  const physical=targets.some(t=>physicalTotal(t,rules)),additions=[...new Set(targets.flatMap(t=>positiveAdditionKeys(t,physicalTotal(t,rules))))];if(additions.length)next.sumAttributes=additions;else delete next.sumAttributes;
  for(const key of Object.keys(METRICS))delete next[key];delete next.sumMinimum;
  for(const rule of rules.filter(r=>Object.hasOwn(METRICS,r.key)&&!(physical&&['totalDamage','initialDamageIncludingHit','initialDamageExcludingHit','damage'].includes(r.key)))){const values=targets.map(t=>metricBounds(t,rule)[0]).filter(Number.isFinite);if(values.length)next[rule.key]=Math.max(0,Math.min(...values));}
  if(physical){const floors=targets.map(target=>{const rule=actualComparisonRules(target,rules).find(r=>r.physicalPower);return rule?{key:rule.key,value:Math.max(0,Math.floor(metricBounds(target,rule)[0]-.67*PHYSICAL_POWER_SPLIT))}:null;}).filter(Boolean);for(const key of new Set(floors.map(r=>r.key)))next[key]=Math.min(...floors.filter(r=>r.key===key).map(r=>r.value));}
  // Share one broad sum query across actual combinations. Type identity and
  // per-item point tolerances are checked locally before a sample can count.
  if(additions.length){const sums=targets.map(t=>actualAdditionKeys(t).filter(k=>!physicalTotal(t,rules)||k!=='power').reduce((n,key)=>n+metrics(t)['addon:'+key],0)-2);next.sumMinimum=Math.max(0,Math.min(...sums));}
  if(filters.physicalPowerOverflow){for(const key of Object.keys(METRICS))delete next[key];next.sumAttributes=['power'];next.sumMinimum=PHYSICAL_POWER_SPLIT+1;}
  delete next.physicalPowerOverflow;
  return next;
 }
 function cheapestComparable(target,samples,rules,quotes,value=defaults()){
  const valid=[];let excluded=0;
  for(const sample of samples){if(!similar(target,sample,rules))continue;try{const converted=evaluate({baseCents:sample.baseCents,...target.valuationMeta,level:Number(target.level),quotes},value);valid.push({sample,converted,comparison:comparisons(target,sample,rules)});}catch{excluded++;}}
  valid.sort((a,b)=>a.converted.totalCents-b.converted.totalCents||a.sample.price-b.sample.price||String(a.sample.id).localeCompare(String(b.sample.id)));
  return {count:valid.length,excluded,best:valid[0]||null};
 }
 return {PHYSICAL_POWER_SPLIT,enforceRoughValidity,sampleRequirement,CLOCK_PRICE_GROUPS,clockPricePeers,targetAskingCents,physicalTotal,positiveAdditionKeys,gemCountsForItem,inferGemCounts,restoreInitialMetrics,isMixedGems,mixedGemWarning,isRoleExclusive,skipReason,supportedPrices,skillValued,IMPORTANT_SUITS,SUIT_ATTRIBUTE_GROUPS,SUIT_VALUE_GROUPS,comparisonSuits,importantSuits,materialMaxGrade,marketGrades,MARKET_GRADES,resolveMaterialPrice,MATERIALS,materialUnits,materialPrice,repairFailures,repairSampleMax,repairGroup,attributeFocus,actualAdditionKeys,actualComparisonRules,ruleValue,listingDiscount,suggestedPrice,NECKLACE_SPIRIT_RANGES,metricBounds,exactAttributes,COMPARISON_VERSION,STORAGE_KEY,GEM_TYPES,WEAPON_GROUPS,defaults,settings,load,save,repairFactor,holeValue,capGemValue,gemValue,evaluate,expandFilters,sampleBase,confidence,summarize,groups,METRICS,comparisonRules,metrics,comparisons,similar,comparisonFilters,cheapestComparable,IMPORTANT_EFFECTS,IMPORTANT_SKILLS,importantTraits,traitKey,parameterKey,targetBox,rangeCovers,planRanges,averageComparables,supportedComparables,DOWNGRADABLE_EFFECTS,downgradeVariants,downgradeTier,estimateComparables};
});
