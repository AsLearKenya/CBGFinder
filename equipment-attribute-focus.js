(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./weapon-forging-ranges.js'):root.WeaponForgingRanges);if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentAttributeFocus=api;})(typeof globalThis==='object'?globalThis:this,function(ranges){
 'use strict';
 const WEAPONS=new Set(['4','5','6','7','8','9','10','11','12','13','14','15','52','53','54','72','73','74','83','91']);
 function applicable(kind){return WEAPONS.has(String(kind))||['18','59'].includes(String(kind));}
 function analyze({kindId,level,gemIds=[],gemGrade,values={},initialDamage,initialTotalDamage}={}){
  const kind=String(kindId),category=WEAPONS.has(kind)?'weapon':['18','59'].includes(kind)?'armor':'none';
  const result=(mode,keys,reason,thresholds)=>({category,usage:['spell','physical'].includes(mode)?mode:null,mode:keys.length>1?'balanced':mode,keys:keys.length>1?[]:keys,reason:keys.length>1?reason+'；双侧重按平级规则':reason,...(thresholds?{thresholds}:{})});
  if(category==='none')return result('none',[],'');
  const present=key=>Number.isFinite(values[key])&&values[key]>0;
  const picks=keys=>keys.filter(present);
  const ranked=groups=>groups.map(picks).find(keys=>keys.length)||[];
  const dominant=keys=>{const sorted=picks(keys).sort((a,b)=>values[b]-values[a]);return sorted.length===2&&values[sorted[0]]*100+1e-7>=values[sorted[1]]*120?[sorted[0]]:[];};
  const ids=[...new Set(gemIds.map(String).filter(Boolean))],gemmed=gemGrade===0?false:Number(gemGrade)>0||ids.length>0;
  if(category==='weapon'){
   if(gemmed){
    if(ids.includes('1'))return result('physical',picks(['power','dex']),'含红玛瑙，侧重力量、敏捷');
    if(ids.length&&ids.every(id=>id==='2'))return result('spell',picks(['magic','dex']),'纯太阳石，侧重魔力、敏捷');
    return result('balanced',[],'含非太阳石宝石，不能判为法系；附加属性按平级规则');
   }
   if(present('power')&&present('magic')){
    const range=ranges.levels[level];
    if(!range||!Number.isFinite(initialDamage)||!Number.isFinite(initialTotalDamage))return result('balanced',[],'缺少初伤或初总伤，力魔按平级规则');
    const thresholds={initialDamage:range.damage[1]*.86,initialTotalDamage:(range.damage[1]+range.hit[1]/3)*.9};
    const spell=initialDamage*100+1e-7>=range.damage[1]*86,physical=initialTotalDamage*300+1e-7>=(range.damage[1]*3+range.hit[1])*90;
    if(spell&&physical){const keys=dominant(['power','magic']);return result(keys.length?(keys[0]==='magic'?'spell':'physical'):'balanced',keys,keys.length?'初伤、初总伤均达标，按高出至少 20% 的属性侧重':'初伤、初总伤均达标，力魔差距不足 20%，按平级规则',thresholds);}
    if(spell)return result('spell',['magic'],'初伤达到强化伤害上限的 86%，侧重魔力',thresholds);
    if(physical)return result('physical',['power'],'初总伤达到强化初总伤上限的 90%，侧重力量',thresholds);
    return result('balanced',[],'初伤、初总伤均未达到分类阈值，力魔按平级规则',thresholds);
   }
   return result('ranked',ranked([['power','magic','dex'],['physique'],['endurance']]),'无宝石：力量／魔力／敏捷优先，其次体质、耐力');
  }
  if(gemmed){
   if(ids.length&&ids.every(id=>id==='3'))return result('spell',picks(['magic','dex']),'纯舍利子，侧重魔力、敏捷');
   return result('ranked',ranked([['dex'],['power'],['physique'],['endurance']]),'含非舍利子宝石，不侧重魔力；按敏捷、力量、体质、耐力排序');
  }
  const core=picks(['power','dex','magic']);
  if(core.length===2&&Object.values(values).filter(v=>Number.isFinite(v)&&v!==0).length<=2){const keys=dominant(core);return result(keys.length?'dominant':'balanced',keys,keys.length?'无宝石，侧重高出另一个属性至少 20% 的点数':'无宝石，主属性点数差距不足 20%，按平级规则');}
  return result(core.length?'ranked':'balanced',core,core.length?'无宝石，侧重本件携带的力量、敏捷、魔力':'无宝石且无力量、敏捷、魔力，按平级规则');
 }
 return {applicable,analyze};
});
