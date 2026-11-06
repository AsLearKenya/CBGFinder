/* Ancient jade: compare native stats, before five-colour dust bonuses. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation,typeof module==='object'&&module.exports?require('./yupo-options.js'):root.Yupo);if(typeof module==='object'&&module.exports)module.exports=api;else root.YupoValuation=api;})(globalThis,function(B,Y){
 'use strict';
 const VERSION=7;
 const ALIASES={'法术暴击等级':'法术暴击','物理暴击等级':'物理暴击','狂暴等级':'狂暴','穿刺等级':'穿刺','法术伤害结果':'法伤结果','封印命中等级':'封印命中','固伤暴击等级':'固伤暴击','固定伤害暴击等级':'固伤暴击','固定伤害':'固伤','法术防御':'法防','格挡':'格挡值','格挡等级':'格挡值','抵抗封印等级':'抗封印','抗封':'抗封印','回复能力':'气血回复','气血回复效果':'气血回复','回复':'气血回复','抗物理暴击':'抗物理','抗法术暴击':'抗法术','抗固伤暴击':'抗固伤'};
 const canonical=n=>ALIASES[n]||n;
 const GROUPS={spell:[['法术伤害','法术暴击','速度'],['法伤结果','伤害']],physical:[['伤害','物理暴击','速度'],['狂暴','穿刺']],fixed:[['固伤','固伤暴击'],['伤害']],support:[['治疗能力','封印命中','速度']]};
 const AUX=['治疗能力','封印命中'],YIN=[['气血','防御'],['法防'],['格挡值','抗封印','气血回复']],TOL={'气血':12,'防御':4,'法防':6,'格挡值':8,'抗封印':8,'气血回复':8};
 const IDS=Object.fromEntries(Object.entries(Y.config.minghun_attr).map(([id,n])=>[canonical(n),id]));
 const yang=i=>String(i.equipmentKindId)==='61718',rows=i=>{const m=i.yupoMeta;return m?[m.main,...m.added]:[];},same=(a,b)=>a.length===b.length&&a.slice().sort().join('|')===b.slice().sort().join('|');
 const triple=r=>r.length===3&&r.every(a=>a.label===r[0].label),rank=n=>YIN.findIndex(g=>g.includes(n));
 // Official upgrade table: https://xyq.163.com/news/20250416/4999_1227842.html
 const DUST_SPELL_BONUSES=[[2,.5],[6,.5],[8,1],[12,1],[14,1],[15,1]];
 function dustSpellBonus(grade){return DUST_SPELL_BONUSES.reduce((sum,[min,bonus])=>sum+(Number(grade)>=min?bonus:0),0);}
 function spellProbabilities(data,rendered,grade){
  const pattern=/奇袭法术(?:概率|几率)?\s*[+：:]?\s*([\d.]+)\s*%/g;
  const read=text=>{const m=Y.plain(text).match(new RegExp(pattern.source));return m?Number(m[1]):null;};
  const dust=read(data?.effect?.desc2)??dustSpellBonus(grade);
  // CBG's desc2 is the dust bonus; desc is the separate innate effect, not their sum.
  if(data)return {spellChance:read(data.effect?.desc),dustSpellChance:dust,spellChanceBasis:'innate'};
  const plain=Y.plain(rendered),matches=[...plain.matchAll(pattern)],level=plain.indexOf('灵尘等级');
  let innate=null;
  if(matches.length>1)innate=Number(matches.at(-1)[1]);
  else if(matches.length){const m=matches[0],value=Number(m[1]);
   const total=/合计|总计|总概率|总几率/.test(plain.slice(Math.max(0,m.index-12),m.index+m[0].length+12));
   if(total)innate=Math.max(0,Math.round((value-dust)*10000)/10000)||null;
   else if(level>=0)innate=m.index>level?value:null;
   else innate=Math.max(0,Math.round((value-dust)*10000)/10000)||null;
  }
  return {spellChance:innate,dustSpellChance:dust,spellChanceBasis:'innate'};
 }
 function metadata(source,raw={}){
  const {data,styled}=Y.splitDescription(source),rendered=Y.renderDescription(source);
  const parse=s=>{const m=Y.plain(s).match(/^\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/);return m?{label:canonical(m[1].trim()),value:Number(m[2])}:null;};
  const lines=rendered.split(/#r|\n/),main=parse(data?.init?.desc||lines.find(l=>!/#G/.test(l)&&parse(l))||''),added=(Array.isArray(data?.base)?data.base.map(r=>r.desc):lines.filter(l=>/#G/.test(l))).map(parse).filter(Boolean);
  const hole=Y.plain(data?.hole?.desc||'')||Y.plain(styled).match(/灵尘等级\s*\d+(?:\s*\[\s*\+\d+\s*\])?/)?.[0]||'';
  // The bracketed extension is inherent to repeated stats, not purchased dust.
  const gradeRaw=raw.minghun_level??hole.match(/灵尘等级\s*(\d+)/)?.[1];
  const grade=gradeRaw===undefined?0:Number(gradeRaw),effectText=Y.plain([data?.effect?.desc2,data?.effect?.desc,rendered].filter(Boolean).join('\n'));
  return {main,added,grade,extraGrade:Number(hole.match(/\[\s*\+(\d+)\s*\]/)?.[1]||raw.minghun_level_ext||0),...spellProbabilities(data,rendered,grade),physicalMitigation:percentage(effectText,'物伤化劲'),spellMitigation:percentage(effectText,'法伤化劲')};
 }
 function percentage(text,label){const m=Y.plain(text).match(new RegExp(label+'\\s*[+：:]?\\s*([\\d.]+)\\s*%'));return m?Number(m[1]):null;}
 function isSpellJade(item){
  if(!yang(item))return false;const candidates=plans(item),max=Math.max(0,...candidates.map(p=>p.kept.length)),groups=new Set();
  for(const p of candidates.filter(p=>p.kept.length===max)){if(p.group)groups.add(p.group);else for(const [name,tiers]of Object.entries(GROUPS))if(rows(item).every(r=>tiers.flat().includes(r.label)))groups.add(name);}
  return groups.size===1&&groups.has('spell');
 }
 function effectValue(item,key,label){const m=item.yupoMeta||{};if(key==='spellChance'&&m.spellChanceBasis!=='innate'&&item.description&&/奇袭法术/.test(item.description))return metadata(item.description,{minghun_level:m.grade}).spellChance;if(Object.hasOwn(m,key))return m[key];return percentage([item.description,...(item.specialEffects||[])].filter(Boolean).join('\n'),label);}
 function valuedEffects(item){const fields=[{key:'spellChance',label:'先天奇袭法术概率',tolerance:.1,type:'1'},{key:'physicalMitigation',label:'物伤化劲',tolerance:.5,type:'4'}];if(!isSpellJade(item))fields.push({key:'spellMitigation',label:'法伤化劲',tolerance:.5,type:'5'});return fields.map(f=>({...f,value:effectValue(item,f.key,f.label)}));}
 function plans(item){
  const r=rows(item);if(r.length!==3||r.some(a=>!a||!Number.isFinite(a.value)))return [];
  const exact=n=>[n],all=r.map(a=>a.label),out=[];
  const known=yang(item)?Object.values(GROUPS).flat(2):[...YIN.flat(),'抗物理','抗法术','抗固伤'];if(all.some(n=>!known.includes(n)))return [];
  const add=(mode,allowed,kept,group='')=>out.push({mode,allowed,kept,group,tier:0});
  if(triple(r)){add('triple',all.map(exact),[0,1,2]);return out;}
  if(yang(item)){
   const complete=Object.entries(GROUPS).filter(([,tiers])=>r.every(a=>tiers.flat().includes(a.label)));
   if(complete.length){for(const [group,tiers]of complete){const allowed=all.map(exact),tier=tiers.find(t=>t.includes(all[0]));if(tiers.indexOf(tier)>0&&!all.slice(1).includes(all[0]))allowed[0]=tier;add('exact',allowed,[0,1,2],group);}return out;}
   for(const [group,tiers]of Object.entries(GROUPS))for(const tier of tiers){
    for(const i of [1,2])if(tier.includes(all[0])&&tier.includes(all[i])){const j=3-i,allowed=[null,null,null];allowed[0]=tiers.indexOf(tier)===0||all[0]===all[i]?exact(all[0]):tier;allowed[i]=exact(all[i]);const kept=[0,i];if(AUX.includes(all[j])){allowed[j]=exact(all[j]);kept.push(j);}add('main-pair',allowed,kept,group);}
    if(tier.includes(all[1])&&tier.includes(all[2])){const allowed=[null,exact(all[1]),exact(all[2])];const kept=[1,2];if(AUX.includes(all[0])){allowed[0]=exact(all[0]);kept.unshift(0);}add('sub-pair',allowed,kept,group);}
   }
  }else{
   const ranks=all.map(rank),valid=ranks.map(n=>n>=0);
   if(valid.every(Boolean)){const allowed=all.map(exact);if(ranks[0]>0)allowed[0]=YIN[ranks[0]];if(all[1]===all[2])allowed[1]=allowed[2]=exact(all[1]);for(const i of [1,2])if(all[i]===all[0]){allowed[0]=exact(all[0]);allowed[i]=exact(all[i]);}add('yin-all',allowed,[0,1,2]);return out;}
   for(const i of [1,2])if(valid[0]&&valid[i]){const allowed=[null,null,null];allowed[0]=ranks[0]===0||all[0]===all[i]?exact(all[0]):YIN[ranks[0]];allowed[i]=exact(all[i]);add('yin-main-pair',allowed,[0,i]);}
   if(valid[1]&&valid[2]&&ranks[1]===ranks[2]){const allowed=[null,exact(all[1]),exact(all[2])];if(all[1]===all[2])allowed[1]=allowed[2]=exact(all[1]);add('yin-sub-pair',allowed,[1,2]);}
  }
  return [...new Map(out.map(p=>[JSON.stringify([p.allowed,p.kept]),p])).values()];
 }
 function reason(item){if(!Number.isFinite(item.price)||item.price<50)return '挂牌价低于50元，不估价';if(!['61717','61718'].includes(String(item.equipmentKindId)))return '缺少阴玉／阳玉类型';if(rows(item).length!==3||!item.yupoMeta?.main)return '缺少玉魄的主属性及两条副属性，请重新读取详情';if(!plans(item).length)return '属性未形成可估价的有效组别，不估价';if(!Number.isInteger(item.yupoMeta.grade??0)||item.yupoMeta.grade<0||item.yupoMeta.grade>15)return '缺少有效五色灵尘镶嵌等级';return '';}
 function comparison(target,sample,plan){
  const a=rows(target),b=rows(sample);if(b.length!==3||b.some(r=>!r||!Number.isFinite(r.value)))return null;
  const dist=r=>r.map(x=>rank(x.label)).sort().join(',');
  if(!yang(target)&&plan.mode==='yin-all'&&dist(a)!==dist(b))return null;
  for(const order of [[0,1,2],[0,2,1]]){
   const c=order.map(i=>b[i]);if(plan.allowed.some((names,i)=>names&&!names.includes(c[i].label)))continue;
   if(plan.mode==='exact'&&!same(a.slice(1).map(r=>r.label),c.slice(1).map(r=>r.label)))continue;
   const groups=new Map(),result=[];
   for(const i of plan.kept){const label=a[i].label;if(!groups.has(label))groups.set(label,[]);groups.get(label).push(i);}
   let valid=true;
   for(const [label,indexes]of groups){const av=indexes.reduce((n,i)=>n+a[i].value,0),bv=indexes.reduce((n,i)=>n+c[i].value,0),sameLabel=indexes.every(i=>c[i].label===label);
    const delta=bv-av,tol=yang(target)?2:TOL[label];
    if((yang(target)||sameLabel&&tol!==undefined)&&(delta<(label==='速度'?0:-tol)-1e-8||delta>tol+1e-8)){valid=false;break;}
    result.push({label:label+(indexes.length>1?'合计（'+indexes.length+'条）':''),target:av,sample:sameLabel?bv:c[indexes[0]].label+' '+bv});
   }
   if(valid)return result;
  }
  return null;
 }
 function match(target,sample,plan){
  if(target.id===sample.id||String(target.equipmentKindId)!==String(sample.equipmentKindId)||!sample.yupoMeta)return null;
  const effects=valuedEffects(target),effectRows=[];
  for(const e of effects){const a=e.value,b=effectValue(sample,e.key,e.label);if((a==null)!==(b==null)||a!=null&&(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>e.tolerance+1e-8))return null;if(a!=null)effectRows.push({label:e.label+'（%）',target:a,sample:b});}
  const result=comparison(target,sample,plan);if(result)result.push(...effectRows);return result;
 }
 function dustCents(grade,quotes,settings){grade??=0;if(!Number.isInteger(grade)||grade<0||grade>15)throw Error('缺少有效五色灵尘镶嵌等级');let total=0;for(let n=1;n<=grade;n++){if(!Number.isSafeInteger(quotes[n]?.priceCents))throw Error('缺少'+n+'级五色灵尘报价');total+=quotes[n].priceCents;}return Math.round(total*B.settings(settings).gemDiscount/100);}
 function convert(target,sample,dust,settings){const cap=B.capGemValue(dust,sample.baseCents,settings);return {baseCents:sample.baseCents,repairFactor:1,holeCents:0,equipmentCents:sample.baseCents,gemComparisonCents:sample.baseCents,gem:cap,totalCents:sample.baseCents+cap.valueCents};}
 function estimate(target,samples,quotes,settings,now=Date.now()){
  const error=reason(target);if(error)return {target,count:0,estimateCents:null,skipped:true,error};const dust=dustCents(target.yupoMeta.grade,quotes,settings),found=new Map();
  for(const p of plans(target))for(const sample of samples){const c=match(target,sample,p);if(c&&!found.has(sample.id))found.set(sample.id,{sample,comparison:c,converted:convert(target,sample,dust,settings),ignoredLabels:rows(target).filter((_,i)=>!p.kept.includes(i)).map(r=>r.label),matchGroup:p.group});}
  const selected=B.supportedPrices([...found.values()],{now,targetPriceCents:B.targetAskingCents(target)}),pricing=B.suggestedPrice(target,selected.estimateCents,now);return {target,...selected,...pricing,rough:selected.rough||selected.count<B.sampleRequirement(target),targetQuotes:{},dustQuotes:quotes,dustCents:dust,attributeFocus:null};
 }
 function queries(item){
  const out=[],r=rows(item);
  for(const p of plans(item))for(const order of [[0,1,2],[0,2,1]])for(const main of p.allowed[0]||[null]){
   const f={equip_type:[String(item.equipmentKindId)]};
   for(const [i,prefix]of ['init_attrs','base_attrs1','base_attrs2'].entries()){
    const index=order[i],names=i===0?(main?[main]:null):p.allowed[index];
    if(names?.length===1&&IDS[names[0]]){
     const name=names[0],duplicates=p.kept.filter(j=>r[j].label===r[index].label).length>1,tol=yang(item)?2:TOL[name];
     // Repeated stats may redistribute across main/secondary positions; only their sum has a floor.
     const floor=!duplicates&&name===r[index].label?Math.ceil(r[index].value-(name==='速度'?0:tol??0)-1e-8):1;
     f[prefix+'Type']=IDS[name];f[prefix+'Value']=Math.max(1,floor);
    }
   }
   const repeated=p.kept.find(i=>p.kept.filter(j=>r[j].label===r[i].label).length>1);
   if(repeated!==undefined){const name=r[repeated].label,tol=yang(item)?2:TOL[name];f.total_attrsType=IDS[name];f.total_attrsValue=Math.max(1,Math.ceil(p.kept.filter(i=>r[i].label===name).reduce((v,i)=>v+r[i].value,0)-(name==='速度'?0:tol??0)-1e-8));}
   const effect=valuedEffects(item).find(e=>e.value!=null&&e.value>0);if(effect){f.minghun_effectType=effect.type;f.minghun_effectValue=Math.max(0.1,Math.round((effect.value-effect.tolerance)*10)/10);}
   out.push({plan:p,filters:f,signature:JSON.stringify([VERSION,item.equipmentKindId,item.yupoMeta,p,f])});
  }
  return [...new Map(out.map(q=>[JSON.stringify(q.filters),q])).values()];
 }

 function groups(task,items){return [...new Map((items||[]).filter(i=>i.kind==='yupo').map(i=>[i.equipmentKindId,{kindId:String(i.equipmentKindId),level:0,name:yang(i)?'上古玉魄·阳':'上古玉魄·阴'}])).values()];}
 return {VERSION,DUST_SPELL_BONUSES,dustSpellBonus,isSpellJade,valuedEffects,GROUPS,YIN,TOL,canonical,metadata,rows,plans,reason,match,dustCents,convert,estimate,queries,groups};
});
