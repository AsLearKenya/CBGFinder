/* Only parses data from the official detail page; never executes page scripts. */
'use strict';
const Yupo=require('./yupo-options.js');
const {parseRoleData}=require('./role-detail-data.cjs');
function decodeDescription(input){
 const value=String(input).trim(),match=value.match(/^@([^@]+)@([A-Za-z0-9+/=\s]+)@$/);
 if(!value.startsWith('@'))return value;
 if(!match)throw Error('商品描述编码无法识别');
 const data=JSON.parse(Buffer.from(match[2],'base64').toString('latin1'));
 if(typeof data.d!=='string')throw Error('商品描述数据无效');
 return Array.from(data.d,(c,i)=>String.fromCharCode(c.charCodeAt(0)^match[1].charCodeAt(i%match[1].length))).join('');
}
function parseLpc(source){
 if(source.length>1000000)throw Error('商品属性内容过大');let i=0,nodes=0;
 const ws=()=>{while(/\s/.test(source[i]||'')&&i<source.length)i++;};
 function value(depth=0){
  ws();if(depth>40||++nodes>20000)throw Error('商品属性结构过深');
  if(source[i]==='"'){const start=i++;let escape=false;while(i<source.length){const c=source[i++];if(c==='"'&&!escape)return JSON.parse(source.slice(start,i));if(c==='\\'&&!escape)escape=true;else escape=false;}throw Error('商品属性字符串不完整');}
  const map=source.startsWith('([',i),array=source.startsWith('({',i);
  if(map||array){i+=2;const result=map?Object.create(null):[],end=map?'])':'})';ws();while(!source.startsWith(end,i)){
   const key=value(depth+1);ws();if(map){if(source[i++]!==':')throw Error('商品属性键值无效');result[String(key)]=value(depth+1);}else result.push(key);
   ws();if(source[i]===','){i++;ws();}else if(!source.startsWith(end,i))throw Error('商品属性分隔无效');
  }i+=2;return result;}
  const number=/^-?\d+(?:\.\d+)?/.exec(source.slice(i));if(number){i+=number[0].length;return Number(number[0]);}throw Error('商品属性格式无法识别');
 }
 const result=value();ws();if(i!==source.length)throw Error('商品属性存在未识别内容');return result;
}
const clean=value=>String(value??'').replace(/#r/g,'\n').replace(/#c[\da-f]{6}/gi,'').replace(/#[RGBYKWnbu]/g,'').replace(/<[^>]*>/g,'').trim();
function entity(s){return s.replace(/&(?:amp|lt|gt|quot|#39);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[c]));}
function hasRoleFields(raw){return raw&&typeof raw==='object'&&Object.hasOwn(raw,'iSchool')&&Object.hasOwn(raw,'cName');}
function readJsonVariable(html,name){
 const match=new RegExp('(?:\\b(?:var|let|const)\\s+|\\bwindow\\.)'+name+'\\s*=\\s*').exec(html);if(!match)return null;const start=match.index+match[0].length;if(html[start]!=='{')return null;let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){const ch=html[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}if(ch==='"'){quoted=true;continue;}if(ch==='{')depth++;if(ch==='}'&&!--depth){try{return JSON.parse(html.slice(start,i+1));}catch{return null;}}}return null;
}
function parseDetail(html){
 const match=html.match(/<textarea\b[^>]*\bid="(pet_desc|equip_desc_value)"[^>]*>([\s\S]*?)<\/textarea>/i);
 if(!match)throw Error(/登录|do_anon_auth|show_login/.test(html)?'登录状态已失效':'商品详情暂不可用，商品可能已下架');
 const decoded=decodeDescription(entity(match[2])),description=Yupo.renderDescription(decoded),pet=match[1]==='pet_desc';
 const roleRaw=!pet&&description.trim().startsWith('([')?parseLpc(description):null;
 const roleInfo=roleRaw&&hasRoleFields(roleRaw)?parseRoleData(roleRaw):null;
 const sections=[];let petInfo=null;
 if(!pet&&!roleInfo)sections.push({title:'装备完整属性 · 符石与制造信息',lines:clean(description).split('\n').filter(Boolean)});
 else if(pet){
  const a=description.split(';'),offset=description.indexOf('([',a.slice(0,34).join(';').length),other=offset>=0?parseLpc(description.slice(offset)):{};
  const entries=rows=>rows.filter(([i])=>a[i]!==undefined&&a[i]!=='').map(([i,label])=>({label,value:a[i]}));
  petInfo={certifiedSkillId:/^[1-9]\d*$/.test(String(a[28]||'').trim())?String(a[28]).trim():'',mengying:other.mengying,typeId:a[1],icon:'https://cbg-xyq.res.netease.com/images/small/'+Number(a[1])+'.gif',
   attributes:[{label:'气血',value:a[3]+'/'+a[16]},{label:'魔法',value:a[4]+'/'+a[17]},...entries([[5,'攻击'],[6,'防御'],[7,'速度']]),...Object.entries({法伤:other.iMagDam,法防:other.iMagDef}).filter(([,v])=>v!==undefined).map(([label,value])=>({label,value:String(value)}))],
   points:entries([[9,'体质'],[10,'魔力'],[11,'力量'],[12,'耐力'],[13,'敏捷'],[14,'潜能']]),
   aptitudes:entries([[20,'攻击资质'],[21,'防御资质'],[22,'体力资质'],[23,'法力资质'],[24,'速度资质'],[25,'躲闪资质']]),
   overview:[{label:'寿命',value:Number(a[18])>=65432?'永生':a[18]},{label:'成长',value:(Number(a[26])/1000).toFixed(3)},{label:'五行',value:({'1':'金','2':'木','3':'水','4':'火','5':'土'})[a[19]]||a[19]},{label:'是否宝宝',value:Number(a[29])?'是':'否'},...entries([[30,'已用元宵'],[32,'已用千金露'],[33,'已用炼兽珍经']]),...Object.entries({历史灵性值:other.tmp_lingxing,已用清灵仙露:other.jinjie?.cnt,已用水晶糕:other.sjg}).filter(([,v])=>v!==undefined).map(([label,value])=>({label,value:String(value)})),...(other.summon_color!==undefined&&other.summon_color!==null&&other.summon_color!==''?[{label:'已用幻色丹',value:other.summon_color===true||Number(other.summon_color)>0?'是':'否'}]:[])],
   trait:other.jinjie?.core?.name?{name:clean(other.jinjie.core.name),description:clean(other.jinjie.core.effect),enabled:other.core_close===0?true:other.core_close===1?false:null}:null};
  const attrs=[[2,'等级'],[16,'气血'],[17,'魔法'],[5,'攻击'],[6,'防御'],[7,'速度'],[15,'灵力'],[18,'寿命'],[9,'体质'],[10,'魔力'],[11,'力量'],[12,'耐力'],[13,'敏捷'],[14,'潜力'],[20,'攻击资质'],[21,'防御资质'],[22,'体力资质'],[23,'法力资质'],[24,'速度资质'],[25,'躲闪资质']];
  sections.push({title:'召唤兽属性与资质',lines:attrs.filter(([i])=>a[i]!==undefined&&a[i]!=='').map(([i,label])=>label+'：'+(i===18&&Number(a[i])>=65432?'永生':a[i])).concat(['成长：'+(Number(a[26])/1000).toFixed(3),'宝宝：'+(Number(a[29])?'是':'否')])});
  sections.push({title:'技能',skillIds:[...new Set((a[27]+'|'+(a[28]||'')).split('|').filter(id=>/^\d+$/.test(id)&&id!=='0'))],lines:[]});
  if(other.EvolSkill)sections.push({title:'赐福技能',skillIds:String(other.EvolSkill).split('|').filter(id=>/^\d+$/.test(id)),lines:[]});
  const core=other.jinjie?.core;
  const lines=[['tmp_lingxing','历史灵性'],['iMagDam','法伤'],['iMagDef','法防'],['sjg','已用水晶糕']].filter(([k])=>other[k]!==undefined).map(([k,l])=>l+'：'+other[k]);
  if(other.jinjie?.lx!==undefined)lines.push('灵性：'+other.jinjie.lx);
  if(core?.name)lines.push('特性：'+core.name,clean(core.effect));
  if(lines.length)sections.push({title:'进阶与特性',lines});
  if(other.summon_core)sections.push({title:'内丹',neidan:Object.entries(other.summon_core).map(([id,a])=>({id,level:Array.isArray(a)?a[0]:''})),lines:[]});
  let count=0;for(let i=1;i<=3;i++){const gear=other['summon_equip'+i];if(!gear)continue;count++;sections.push({title:'召唤兽装备 · '+(['','护腕','项圈','铠甲'][i]),icon:'https://cbg-xyq.res.netease.com/images/equip/small/'+Number(gear.iType)+'.gif',styledDescription:gear.cDesc,lines:clean(gear.cDesc).split('\n').filter(Boolean)});}
  if(other.summon_equip4_type){count++;sections.push({title:'召唤兽饰品',lines:clean(other.summon_equip4_desc).split('\n').filter(Boolean)});}
  if(!count)sections.push({title:'召唤兽装备',lines:['未携带装备']});
 }
 const equipBlock=html.match(/\bvar\s+equip\s*=\s*\{([\s\S]*?)\n\};/)?.[1]||'';
 function field(key){const m=equipBlock.match(new RegExp('"'+key+'"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\x27[^\\x27]*\\x27|[0-9]+|true|false)'));if(!m)return '';return m[1].startsWith('"')?JSON.parse(m[1]):m[1].replace(/^'|'$/g,'');}
 const loreMatch=!pet&&html.match(/\bvar\s+client_equip_desc\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
 let lore='';if(loreMatch){try{lore=JSON.parse(loreMatch[1]);}catch{}}
 const listing={};
 for(const key of ['is_split_main_role','is_split_independent_role','kindid','equip_type','server_name','area_name','game_ordersn','order_sn','expire_time','onsale_expire_time_desc','cross_server_poundage','cross_server_poundage_discount','gem_level','jinglian_level','repair_fail','hole_num','all_damage','init_damage','init_damage_raw','shanghai','mingzhong','init_wakan','all_wakan','init_defense','init_hp','init_dex','gem_value','special_skill','special_effect','suit_effect']){const value=field(key);if(value!=='')listing[key]=value;}
 if(!listing.game_ordersn&&listing.order_sn)listing.game_ordersn=listing.order_sn;
 if(!listing.equip_type&&!roleInfo&&!pet){const name=field('equip_name'),entry=Object.entries(require('./role-detail-config.js').equip_info).find(([,value])=>value.name===name);if(entry)listing.equip_type=entry[0];}
 if(roleInfo){
  const yes=v=>[true,1,'1','true'].includes(v);
  if(listing.is_split_independent_role!==undefined||listing.is_split_main_role!==undefined){roleInfo.saleMode=yes(listing.is_split_independent_role)?'split':'whole';roleInfo.saleModeKnown=true;}
  const dict=readJsonVariable(html,'split_equip_dict');
  for(const child of roleInfo.children||[]){const data=dict?.[child.independentEid];if(!data||typeof data!=='object')continue;const server=String(data.serverid??data.server_id??'');if(/^[1-9]\d{0,5}$/.test(server))child.independentServerId=server;}
 }
 const equipEntry=require('./role-detail-config.js').equip_info[listing.equip_type];if(equipEntry?.desc?.includes('【装备角色】女'))listing.equip_gender='女';
 return {listing,roleInfo,petInfo,market:{remaining:field('expire_time_desc'),id:field('equipid'),status:field('is_selling')==='1'?'已上架':field('is_selling')==='0'?'未上架':'',acceptBargain:field('can_bargin')===''?null:field('can_bargin')==='1',fairShow:field('is_pass_fair_show')==='0',fairShowEnd:field('fair_show_end_time'),fairShowRemaining:field('fair_show_end_time_left')},styledDescription:pet||roleInfo?'':description,lore,name:roleInfo?.name||field('equip_name')|| (pet?description.split(';')[0]:'装备详情'),category:roleInfo?'角色':pet?'召唤兽':/上古玉魄/.test(field('equip_name'))||['61717','61718'].includes(String(field('equip_type')))?'上古玉魄':field('kindid')==='29'?'召唤兽装备':['61','62','63','64'].includes(String(field('kindid')))?'灵饰':'装备',level:roleInfo?.level??field('equip_level'),price:field('price'),sections};
}
if(typeof module==='object')module.exports={parseDetail,parseLpc,decodeDescription};
