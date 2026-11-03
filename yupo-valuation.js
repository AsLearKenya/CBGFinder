/* Ancient jade: compare native stats, before five-colour dust bonuses. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation,typeof module==='object'&&module.exports?require('./yupo-options.js'):root.Yupo);if(typeof module==='object'&&module.exports)module.exports=api;else root.YupoValuation=api;})(globalThis,function(B,Y){
 'use strict';
 const VERSION=1;
 const ALIASES={'法术暴击等级':'法术暴击','物理暴击等级':'物理暴击','狂暴等级':'狂暴','穿刺等级':'穿刺','法术伤害结果':'法伤结果','封印命中等级':'封印命中','固伤暴击等级':'固伤暴击','固定伤害暴击等级':'固伤暴击','固定伤害':'固伤','法术防御':'法防','格挡等级':'格挡','抵抗封印等级':'抗封印','抗封':'抗封印','回复能力':'气血回复','气血回复效果':'气血回复','回复':'气血回复','抗物理暴击':'抗物理','抗法术暴击':'抗法术','抗固伤暴击':'抗固伤'};
 const canonical=n=>ALIASES[n]||n;
 const GROUPS={spell:[['法术伤害','法术暴击','速度'],['法伤结果','伤害']],physical:[['伤害','物理暴击','速度'],['狂暴','穿刺']],fixed:[['固伤','固伤暴击'],['伤害']],support:[['治疗能力','封印命中','速度']]};
 const AUX=['治疗能力','封印命中'],YIN=[['气血','防御'],['法防'],['格挡','抗封印','气血回复']],TOL={'气血':10,'防御':2,'法防':2,'格挡':3,'抗封印':3,'气血回复':3};
 const IDS=Object.fromEntries(Object.entries(Y.config.minghun_attr).map(([id,n])=>[n,id]));
 const yang=i=>String(i.equipmentKindId)==='61718',rows=i=>{const m=i.yupoMeta;return m?[m.main,...m.added]:[];},same=(a,b)=>a.length===b.length&&a.slice().sort().join('|')===b.slice().sort().join('|');
 const triple=r=>r.length===3&&r.every(a=>a.label===r[0].label),rank=n=>YIN.findIndex(g=>g.includes(n));
 function metadata(source,raw={}){
  const {data,styled}=Y.splitDescription(source),rendered=Y.renderDescription(source);
  const parse=s=>{const m=Y.plain(s).match(/^\s*(.+?)\s*\+\s*(\d+(?:\.\d+)?)/);return m?{label:canonical(m[1].trim()),value:Number(m[2])}:null;};
  const lines=rendered.split(/#r|\n/),main=parse(data?.init?.desc||lines.find(l=>!/#G/.test(l)&&parse(l))||''),added=(Array.isArray(data?.base)?data.base.map(r=>r.desc):lines.filter(l=>/#G/.test(l))).map(parse).filter(Boolean);
  const hole=Y.plain(data?.hole?.desc||'')||Y.plain(styled).match(/灵尘等级\s*\d+(?:\s*\[\s*\+\d+\s*\])?/)?.[0]||'';
  // The bracketed extension is inherent to repeated stats, not purchased dust.
  const gradeRaw=raw.minghun_level??hole.match(/灵尘等级\s*(\d+)/)?.[1];
  const grade=gradeRaw===undefined?null:Number(gradeRaw),effectText=Y.plain([data?.effect?.desc2,data?.effect?.desc,rendered].filter(Boolean).join('\n')),effect=effectText.match(/奇袭法术(?:概率|几率)?\s*[+：:]?\s*([\d.]+)\s*%/);
  return {main,added,grade,extraGrade:Number(hole.match(/\[\s*\+(\d+)\s*\]/)?.[1]||raw.minghun_level_ext||0),spellChance:effect?Number(effect[1]):null};
 }
 function plans(item){
  const r=rows(item);if(r.length!==3||r.some(a=>!a||!Number.isFinite(a.value)))return [];
  const exact=n=>[n],all=r.map(a=>a.label),out=[];
  const known=yang(item)?Object.values(GROUPS).flat(2):[...YIN.flat(),'抗物理','抗法术','抗固伤'];if(all.some(n=>!known.includes(n)))return [];
  const add=(mode,allowed,kept,group='')=>out.push({mode,allowed,kept,group,tier:0});
  if(triple(r)){add('triple',all.map(exact),[0,1,2]);return out;}
  if(yang(item)){
   const complete=Object.entries(GROUPS).filter(([,tiers])=>r.every(a=>tiers.flat().includes(a.label)));
   if(complete.length){add('exact',all.map(exact),[0,1,2]);return out;}
   for(const [group,tiers]of Object.entries(GROUPS))for(const tier of tiers){
    for(const i of [1,2])if(tier.includes(all[0])&&tier.includes(all[i])){const j=3-i,allowed=[null,null,null];allowed[0]=all[0]===all[i]?exact(all[0]):tier;allowed[i]=exact(all[i]);const kept=[0,i];if(AUX.includes(all[j])){allowed[j]=exact(all[j]);kept.push(j);}add('main-pair',allowed,kept,group);}
    if(tier.includes(all[1])&&tier.includes(all[2])){const allowed=[null,null,null],strict=tiers.indexOf(tier)===0||all[1]===all[2];allowed[1]=strict?exact(all[1]):tier;allowed[2]=strict?exact(all[2]):tier;const kept=[1,2];if(AUX.includes(all[0])){allowed[0]=exact(all[0]);kept.unshift(0);}add('sub-pair',allowed,kept,group);}
   }
  }else{
   const ranks=all.map(rank),valid=ranks.map(n=>n>=0);
   if(valid.every(Boolean)){const allowed=all.map(n=>YIN[rank(n)]);if(all[1]===all[2])allowed[1]=allowed[2]=exact(all[1]);for(const i of [1,2])if(all[i]===all[0]){allowed[0]=exact(all[0]);allowed[i]=exact(all[i]);}add('yin-all',allowed,[0,1,2]);return out;}
   for(const i of [1,2])if(valid[0]&&valid[i]){const allowed=[null,null,null];allowed[0]=all[0]===all[i]?exact(all[0]):YIN[ranks[0]];allowed[i]=exact(all[i]);add('yin-main-pair',allowed,[0,i]);}
   if(valid[1]&&valid[2]&&ranks[1]===ranks[2]){const allowed=[null,YIN[ranks[1]],YIN[ranks[2]]];if(all[1]===all[2])allowed[1]=allowed[2]=exact(all[1]);add('yin-sub-pair',allowed,[1,2]);}
  }
  return [...new Map(out.map(p=>[JSON.stringify([p.allowed,p.kept]),p])).values()];
 }
 function reason(item){if(!Number.isFinite(item.price)||item.price<50)return '挂牌价低于50元，不估价';if(!['61717','61718'].includes(String(item.equipmentKindId)))return '缺少阴玉／阳玉类型';if(rows(item).length!==3||!item.yupoMeta?.main)return '缺少玉魄的主属性及两条副属性，请重新读取详情';if(!plans(item).length)return '属性未形成可估价的有效组别，不估价';if(!Number.isInteger(item.yupoMeta.grade)||item.yupoMeta.grade<0||item.yupoMeta.grade>15)return '缺少有效五色灵尘镶嵌等级';return '';}
 function comparison(target,sample,plan){
  const a=rows(target),b=rows(sample);if(b.length!==3||b.some(r=>!r||!Number.isFinite(r.value)))return null;
  const dist=r=>r.map(x=>rank(x.label)).sort().join(',');
  if(!yang(target)&&['yin-all','yin-sub-pair'].includes(plan.mode)&&dist(a)!==dist(b))return null;
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
  const a=target.yupoMeta.spellChance,b=sample.yupoMeta.spellChance;
  if((a===null||a===undefined)!==(b===null||b===undefined)||a!=null&&(!Number.isFinite(b)||Math.abs(a-b)>0.10000001))return null;
  const result=comparison(target,sample,plan);if(result&&a!=null)result.push({label:'奇袭法术概率（%）',target:a,sample:b});return result;
 }
 function dustCents(grade,quotes,settings){if(!Number.isInteger(grade)||grade<0||grade>15)throw Error('缺少有效五色灵尘镶嵌等级');let total=0;for(let n=1;n<=grade;n++){if(!Number.isSafeInteger(quotes[n]?.priceCents))throw Error('缺少'+n+'级五色灵尘报价');total+=quotes[n].priceCents;}return Math.round(total*B.settings(settings).gemDiscount/100);}
 function convert(target,sample,dust,settings){const cap=B.capGemValue(dust,sample.baseCents,settings);return {baseCents:sample.baseCents,repairFactor:1,holeCents:0,equipmentCents:sample.baseCents,gemComparisonCents:sample.baseCents,gem:cap,totalCents:sample.baseCents+cap.valueCents};}
 function estimate(target,samples,quotes,settings,now=Date.now()){
  const error=reason(target);if(error)return {target,count:0,estimateCents:null,skipped:true,error};const dust=dustCents(target.yupoMeta.grade,quotes,settings),found=new Map();
  for(const p of plans(target))for(const sample of samples){const c=match(target,sample,p);if(c&&!found.has(sample.id))found.set(sample.id,{sample,comparison:c,converted:convert(target,sample,dust,settings),ignoredLabels:rows(target).filter((_,i)=>!p.kept.includes(i)).map(r=>r.label),matchGroup:p.group});}
  const selected=B.supportedPrices([...found.values()],{now}),pricing=B.suggestedPrice(target,selected.estimateCents,now);return {target,...selected,...pricing,rough:selected.rough||selected.count<5,targetQuotes:{},dustQuotes:quotes,dustCents:dust,attributeFocus:null};
 }
 function queries(item){const out=[];for(const p of plans(item))for(const order of [[0,1,2],[0,2,1]])for(const main of p.allowed[0]||[null]){const f={equip_type:[String(item.equipmentKindId)]};for(const [i,prefix]of ['init_attrs','base_attrs1','base_attrs2'].entries()){const names=i===0?(main?[main]:null):p.allowed[order[i]];if(names?.length===1&&IDS[names[0]]){f[prefix+'Type']=IDS[names[0]];f[prefix+'Value']=1;}}const chance=item.yupoMeta.spellChance;if(chance!=null&&chance>0){f.minghun_effectType='1';f.minghun_effectValue=Math.max(0.1,Math.round((chance-0.1)*10)/10);}out.push({plan:p,filters:f,signature:JSON.stringify([VERSION,item.equipmentKindId,item.yupoMeta,p,f])});}return [...new Map(out.map(q=>[JSON.stringify(q.filters),q])).values()];}
 function groups(task,items){return [...new Map((items||[]).filter(i=>i.kind==='yupo').map(i=>[i.equipmentKindId,{kindId:String(i.equipmentKindId),level:0,name:yang(i)?'上古玉魄·阳':'上古玉魄·阴'}])).values()];}
 return {VERSION,GROUPS,YIN,TOL,canonical,metadata,rows,plans,reason,match,dustCents,convert,estimate,queries,groups};
});
