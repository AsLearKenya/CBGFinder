'use strict';
const config=require('./role-detail-config.js');
const {plain}=require('./yupo-options.js');
const number=v=>v!==undefined&&v!==null&&v!==''&&typeof v!=='boolean'&&Number.isFinite(Number(v))?Number(v):null;
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:null;
function treasure(item,kind='fabao'){
 if(!obj(item)||!Number.isSafeInteger(number(item.iType))||Number(item.iType)<=0)return null;
 const table=config[kind==='lingbao'?'lingbao_info':'fabao_info']||{},id=String(Number(item.iType)),entry=table[id]||{},rawName=typeof item.cName==='string'?plain(item.cName).trim():'';
 const label=kind==='lingbao'?'灵宝':'法宝',explicitName=rawName&&!/^(?:未知)?(?:法宝|灵宝)$/.test(rawName)?rawName:'',name=entry.name||explicitName;
 const byName=name?Object.values(table).find(row=>row.name===name):null,staticDesc=entry.desc||byName?.desc||'',desc=plain(item.cDesc||'');
 const gradeName=plain(staticDesc).match(/(?:法宝|灵宝)等级】\s*([一二三四1234])级/)?.[1],grade={'一':1,'二':2,'三':3,'四':4,'1':1,'2':2,'3':3,'4':4}[gradeName];
 return {id,name:name||`未识别${label}（编号${id}）`,identified:!!name,grade:grade??null,layer:number(desc.match(/修炼境界[：:]\s*第?\s*(\d+)\s*层/)?.[1]),minLevel:number(plain(staticDesc).match(/等级限制】\s*(\d+)级/)?.[1]),description:desc,staticDesc};
}
function fromRaw(raw={}){
 const skills=obj(raw.all_skills),skillRows=table=>skills?Object.entries(skills).filter(([id])=>config[table]?.[id]).map(([id,level])=>({id,name:typeof config[table][id]==='string'?config[table][id]:config[table][id].name||'技能 #'+id,level:number(level)})):null;
 const treasures=obj(raw.fabao)?Object.values(raw.fabao).map(item=>treasure(item)).filter(Boolean).map(({description,staticDesc,...value})=>value):null;
 const riderRows=obj(raw.AllRider)?Object.values(raw.AllRider).filter(obj).map(r=>number(r.exgrow)!==null?Number(r.exgrow)/10000:number(r.iGrow)!==null?Number(r.iGrow)/100:null).filter(v=>v!==null):[];
 if(raw.jinjie_rider_info?.isJinJie===1){const r=raw.jinjie_rider_info;if(number(r.iGrow)!==null&&number(r.iExGrow)!==null)riderRows.push(Number(r.iGrow)/100+Number(r.iExGrow)/10000);}
 const artifact=obj(raw.shenqi)?Object.values(raw.shenqi.suit||{}).filter(obj).filter(s=>!s.illusion&&!s.curr_illusion).map(s=>{
  const slots=Object.values(s.components||{}).filter(c=>c?.unlock===1).flatMap(c=>Object.values(c.wuxing||{}));
  const attr=id=>Object.values(s.attributes||{}).filter(a=>a?.disable===0&&Number(a.id)===id).reduce((sum,a)=>sum+(number(plain(a.attr||a.new_attr).match(/[+]\s*([\d.]+)/)?.[1])||0),0);
  return {waterSlots:slots.filter(x=>Number(x.id)===8).length,fireSlots:slots.filter(x=>Number(x.id)===16).length,waterValue:attr(8),fireValue:attr(16)};
 }):null;
 return {cosmetics:require('./role-cosmetics.js').fromRaw(raw),level:number(raw.iGrade),school:config.school_info?.[raw.iSchool]||null,stage:number(raw.iZhuanZhi),ascension:number(raw.i3FlyLv),cultivation:[1,2,3,4].map(n=>number(raw['iExptSki'+n])),hunting:number(raw.iExptSki5),petCultivation:[1,2,3,4].map(n=>number(raw['iBeastSki'+n])),schoolSkills:skillRows('school_skill'),lifeSkills:skillRows('life_skill'),mountGrowth:raw.AllRider!==undefined||raw.jinjie_rider_info!==undefined?(riderRows.length?Math.max(...riderRows):0):null,fortune:number(raw.jiyuan),festivalPoints:number(raw.addPoint),potentialFruit:number(raw.iNutsNum),dan:number(raw.TA_iAllNewPoint),achievement:number(raw.AchPointTotal),experienceBillions:number(raw.sum_exp),xianyu:number(raw.xianyu),reserve:number(raw.iLearnCash),niceIdType:number(raw.is_niceid_new),niceIdText:typeof raw.idbid_desc==='string'?plain(raw.idbid_desc):null,treasures,artifact};
}
module.exports={fromRaw,treasure};
