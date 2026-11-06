(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./pet-equipment.js'):root.PetEquipment,typeof module==='object'&&module.exports?require('./lingshi.js'):root.Lingshi,typeof module==='object'&&module.exports?require('./yupo-options.js'):root.Yupo,typeof module==='object'&&module.exports?require('./role-portrait.js'):root.RolePortrait,typeof module==='object'&&module.exports?require('./product-actions.js'):root.ProductActions,typeof module==='object'&&module.exports?require('./pet-carry-levels.js'):root.PetCarryLevels,typeof module==='object'&&module.exports?require('./equipment-openings.js'):root.EquipmentOpenings,typeof module==='object'&&module.exports?require('./pet-equipment-valuation.js'):root.PetEquipmentValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.SearchResults=api;})(typeof globalThis==='object'?globalThis:this,function(PetEquipment,Lingshi,Yupo,RolePortrait,ProductActions,PetCarryLevels,EquipmentOpenings,PetValuation){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const has=value=>value!==undefined&&value!==null&&value!=='';
 function text(value){
  if(!has(value)||typeof value==='object')return '';
  const str=String(value);if(/^@[A-Za-z0-9+/=]{8,}@/.test(str))return '';
  return str.replace(/#r/g,'\n').replace(/#c[\da-f]{6}/gi,'').replace(/#[RGBYKWnbu]/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&amp;/gi,'&').trim();
 }
 function tokens(value){return [...new Set((Array.isArray(value)?value:[value]).flatMap(part=>typeof part==='string'?part.split(/[,|]/):[part]).filter(part=>has(part)&&String(part)!=='0').map(String))];}
 function names(value,dictionary,label){return tokens(value).map(id=>dictionary[id]?text(dictionary[id]):`${label} #${id}`);}
 function money(value){return Number.isFinite(Number(value))&&has(value)?(Number(value)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'';}
 function parseResponse(raw){
  const trimmed=String(raw??'').trim();let data;
  try{data=JSON.parse(trimmed);}catch{
   const wrapped=trimmed.match(/^[a-z_$][\w.$]*\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?$/i);
   if(!wrapped)throw new Error('接口返回无法识别的 JSON / JSONP 内容');
   try{data=JSON.parse(wrapped[1]);}catch{throw new Error('接口返回的 JSONP 数据格式无效');}
  }
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('接口返回的数据格式无效');
  if(has(data.status)&&String(data.status)!=='1')throw new Error([text(data.msg)||'官网未返回成功状态',text(data.status_code)].filter(Boolean).join(' · '));
  if(!Array.isArray(data.equip_list)&&Array.isArray(data.pet_list))data.equip_list=data.pet_list;
  if(!Array.isArray(data.equip_list)&&Array.isArray(data.role_list))data.equip_list=data.role_list;
  if(!Array.isArray(data.equip_list))throw new Error(text(data.msg)||'接口响应缺少商品列表');
  return data;
 }
 function safeIcon(raw){
  const candidate=raw.icon_url||raw.equip_face_img||raw.icon;
  if(!candidate||typeof candidate!=='string')return '';
  if(/^(https?:)?\/\//i.test(candidate)){
   try{const url=new URL(candidate.startsWith('//')?'https:'+candidate:candidate);if(!['cbg-xyq.res.netease.com','cbg.res.netease.com'].includes(url.hostname)||url.username||url.password||url.port)return '';url.protocol='https:';return url.href;}catch{return '';}
  }
  if(!/^[\w./-]+$/.test(candidate)||candidate.includes('..'))return '';
  return 'https://cbg-xyq.res.netease.com/images/small/'+candidate.split('/').map(encodeURIComponent).join('/');
 }
 function roleStage(raw,summary){
  const stages=[],numerals=['一','二','三','四','五','六','七','八','九'];
  const value=Number(raw.zhuang_zhi);
  if(value===1)stages.push({rank:1,layer:0,label:'已飞升'});else if(value===2)stages.push({rank:2,layer:0,label:'已渡劫'});else if(value>=10&&value<=90&&value%10===0)stages.push({rank:3,layer:value/10,label:'化圣'+numerals[value/10-1]});
  for(const m of summary.matchAll(/(?:已)?化圣(?:([一二三四五六七八九1-9])(?:层|境)?)?|(?:已)?渡劫|(?:已)?飞升|未飞升/g)){
   if(m[0]==='未飞升')stages.push({rank:0,layer:0,label:'未飞升'});
   else if(m[0].includes('化圣')){const layer=m[1]?(numerals.includes(m[1])?numerals.indexOf(m[1])+1:Number(m[1])):0;stages.push({rank:3,layer,label:layer?'化圣'+numerals[layer-1]:'已化圣'});}
   else stages.push({rank:m[0].includes('渡劫')?2:1,layer:0,label:m[0].includes('渡劫')?'已渡劫':'已飞升'});
  }
  return stages.sort((a,b)=>b.rank-a.rank||b.layer-a.layer)[0]?.label||'';
 }
 function normalize(raw,{config={},category='装备',taskId='',taskName='',serverName='',serverId='',foundAt=Date.now(),transformGroups=[]}={}){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const description=text(raw.large_equip_desc)||text(raw.desc)||text(raw.desc_sumup);
  const skillNames={};for(const [ids,name] of config.equip_special_skills||[])for(const id of String(ids).split(','))skillNames[id]=name;
  const kinds=Object.fromEntries(config.weapon_armors||[]),suitIds=tokens(raw.suit_effect||raw.suit_skill),suitNames=[];
  const suitSources=[['suit_transform_skills','变身术'],['suit_added_status','附加状态'],['suit_append_skills','追加法术'],['suit_transform_charms','变化咒之']];
  for(const id of suitIds){let found=false;for(const [key,prefix] of suitSources){const label=config[key]?.[id];if(label){const group=key==='suit_transform_skills'?transformGroups.find(group=>group.rows.includes(label)):null;suitNames.push(`${prefix}·${label}${group?'（'+group.label+'）':''}`);found=true;break;}}if(!found)suitNames.push(config.suit_effects?.[id]||`套装 #${id}`);}
  if(!suitNames.length){const match=description.match(/套装(?:效果)?[：:]\s*([^\n]+)/);if(match)suitNames.push(text(match[1]));}
  const specialSkills=names(raw.special_skill,skillNames,'特技'),specialEffects=names(raw.special_effect,config.equip_special_effect||{},'特效');
  for(const [label,list] of [['特技',specialSkills],['特效',specialEffects]]){
   const match=description.match(new RegExp(label+'[：:]\\s*([^\\n]+)'));if(match&&!list.length)list.push(text(match[1]));
  }
  const attributes=[];
  const fields=[['all_damage','总伤'],['init_damage','初伤（含命中）'],['init_damage_raw','初伤（不含命中）'],['shanghai','伤害'],['mingzhong','命中'],['init_wakan','初灵'],['all_wakan','总灵'],['lingli','灵力'],['init_defense','初防'],['defense','防御'],['init_hp','初血'],['qixue','气血'],['init_dex','初敏'],['speed','速度'],['mofa','魔法'],['magic_damage','法伤'],['magic_defense','法防'],['fengyin','封印'],['anti_fengyin','抗封']];
  for(const [key,label] of fields)if(Number(raw[key])!==0&&Number.isFinite(Number(raw[key]))&&has(raw[key]))attributes.push({label,value:String(raw[key])});
  for(const [key,fallback,label] of [['shanghai','damage','伤害'],['defense','fangyu','防御'],['qixue','hp','气血']])if(!Number(raw[key])&&Number(raw[fallback]))attributes.push({label,value:String(raw[fallback])});
  let added=(Array.isArray(raw.agg_added_attrs)?raw.agg_added_attrs:has(raw.agg_added_attrs)?[raw.agg_added_attrs]:[]).map(text).filter(Boolean);
  if(!added.length)for(const [key,label] of Object.entries(config.addon_attrs||{addon_liliang:'力量',addon_fali:'魔力',addon_minjie:'敏捷',addon_naili:'耐力',addon_tizhi:'体质'}))if(Number(raw[key]))added.push(`${label} ${Number(raw[key])>0?'+':''}${raw[key]}`);
  // The API explicitly returns zero for absent additions. Keep those zeros in
  // valuation metadata, while aggregated additions retain the post-melting value.
  const addonMetrics={};
  for(const [key,field] of Object.entries({power:'addon_liliang',magic:'addon_fali',dex:'addon_minjie',endurance:'addon_naili',physique:'addon_tizhi'}))if(has(raw[field])&&Number(raw[field])===0)addonMetrics['addon:'+key]=0;
  let expiresAt=null;
  const expiry=String(raw.expire_time||'').match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
  if(expiry){const parsed=Date.parse(expiry[1]+'T'+expiry[2]+'+08:00');if(Number.isFinite(parsed))expiresAt=parsed;}
  if(expiresAt===null){const remaining=text(raw.onsale_expire_time_desc);if(/^(?:\d+天)?(?:\d+时)?(?:\d+分)?$/.test(remaining)&&remaining){const days=Number(remaining.match(/(\d+)天/)?.[1]||0),hours=Number(remaining.match(/(\d+)时/)?.[1]||0),minutes=Number(remaining.match(/(\d+)分/)?.[1]||0);expiresAt=foundAt+((days*24+hours)*60+minutes)*60000;}}
  const highlights=[];
  for(const item of [...(Array.isArray(raw.highlights)?raw.highlights:[]),...(Array.isArray(raw.highlight)?raw.highlight:[]),...(Array.isArray(raw.dynamic_tags)?raw.dynamic_tags:[])]){
   if(item&&typeof item==='object'&&item.show===false)continue;
   const label=text(typeof item==='string'?item:item?.name||item?.text||item?.label||item?.content);
   if(label&&!highlights.includes(label))highlights.push(label);
  }
  const traits=[];
  const gems=names(raw.gem_value,config.gems_name||{},'宝石');
  if(gems.length)traits.push(gems.join('、')+(has(raw.gem_level)?` · ${raw.gem_level}锻`:''));
  else if(has(raw.gem_level)&&Number(raw.gem_level)===0)traits.push('未镶嵌宝石');
  const durability=description.match(/耐久(?:度)?\s*[：:]?\s*(\d+)/);if(durability)traits.push('耐久 '+durability[1]);
  const hole=description.match(/开运孔数[：:]\s*([^\n]+)/);if(hole)traits.push('开孔 '+hole[1].trim());else if(has(raw.hole_num))traits.push('开孔 '+raw.hole_num);
  if(has(raw.repair_fail))traits.push('修理失败 '+raw.repair_fail+'次');
  if(raw.star===1)traits.push('已开启星位');
  if(has(raw['160_attr']))traits.push(...names(raw['160_attr'],config.equip_160_attrs||{},'160级特性'));
  if(raw.is_weijianding===true)traits.push('未鉴定');
  if(raw.is_split_independent_equip===true)traits.push('拆售装备');
  if(raw.is_time_lock===true)traits.push('时间锁'+(has(raw.time_lock_days)?' '+raw.time_lock_days+'天':''));
  if(raw.appointed_roleid)traits.push('指定交易');
  if(raw.accept_bargain===true||['1','true'].includes(String(raw.accept_bargain)))traits.push('可还价');
  const sellingStatus=text(raw.equip_status_desc||raw.status_desc),fairShow=raw.pass_fair_show===false||String(raw.pass_fair_show)==='0';
  const id=String(raw.eid||raw.game_ordersn||raw.equipid||raw.equip_sn||'');
  const server=String(raw.serverid||raw.server_id||serverId||'');
  const result={
   id:server+':'+id,detailEid:/^[0-9]{15}-[0-9]+-[A-Za-z0-9]+$/.test(String(raw.eid||''))?String(raw.eid):'',hasStableId:!!id,taskId,taskName,foundAt,
   name:text(raw.equip_name||raw.equip_type_name)||'名称未提供',level:has(raw.equip_level)?String(raw.equip_level):has(raw.level)?String(raw.level):'',
   type:text(kinds[raw.kindid]),kind:'sword',equipmentKindId:String(raw.kindid??''),...(has(raw.gem_value)?{equipmentGemIds:tokens(raw.gem_value)}:{}),equipmentGemLevel:has(raw.gem_level)?Number(raw.gem_level):null,icon:safeIcon(raw),
   valuationMeta:{roleExclusive:/专用/.test(description),suitIds,expiresAt,effectIds:tokens(raw.special_effect),skillIds:tokens(raw.special_skill),metrics:{...addonMetrics,...Object.fromEntries(Object.entries({totalDamage:'all_damage',initialDamageIncludingHit:'init_damage',initialDamageExcludingHit:'init_damage_raw',damage:'shanghai',initialSpirit:'init_wakan',totalSpirit:'all_wakan',initialDefense:'init_defense',initialHp:'init_hp',initialAgility:'init_dex'}).filter(([,key])=>has(raw[key])&&Number.isFinite(Number(raw[key]))).map(([key,field])=>[key,Number(raw[field])]))},level:Number(raw.equip_level??raw.level),grade:has(raw.gem_level)?Number(raw.gem_level):null,gemIds:tokens(raw.gem_value),holeSets:EquipmentOpenings.parse(raw,description),holes:has(raw.hole_num)?Number(raw.hole_num):Number(description.match(/开运孔数[：:]\s*(\d+)/)?.[1]||0),failures:has(raw.repair_fail)?Number(raw.repair_fail):Number(description.match(/修理失败\s*(\d+)\s*次/)?.[1]||0),crossFeeCents:has(raw.cross_server_poundage_discount)||has(raw.cross_server_poundage)?Math.max(Number(raw.cross_server_poundage_discount)||0,Number(raw.cross_server_poundage)||0):null},
   price:has(raw.price)&&Number.isFinite(Number(raw.price))?Number(raw.price)/100:null,priceDisplay:money(raw.price),
   area:text(raw.area_name),server:text(raw.server_name)||serverName,serverId:server,
   attributes,added,specialSkills,specialEffects,suits:suitNames,traits,highlights,
   description,customDescription:text(raw.diy_desc),summary:text(raw.desc_sumup),
   status:sellingStatus,fairShow,fairShowEnd:text(raw.fair_show_end_time),fairShowLeft:fairShow?text(raw.fair_show_end_time_left):'',
   remaining:text(raw.onsale_expire_time_desc),expireTime:text(raw.expire_time||raw.time_left),sellingTime:text(raw.selling_time),sellingAgo:text(raw.selling_time_ago_desc),
   collectCount:has(raw.collect_num)?String(raw.collect_num):'',collected:[true,1,'1'].includes(raw.has_collect),orderSn:/^\d{1,10}_\d{1,16}_\d{1,20}$/.test(String(raw.game_ordersn||''))?String(raw.game_ordersn):'',
   crossFee:Number(raw.cross_server_poundage)>0?money(raw.cross_server_poundage):'',reservationFee:Number(raw.fair_show_poundage)>0?money(raw.fair_show_poundage):'',
   seller:text(raw.seller_nickname),orderNumber:text(raw.game_ordersn||raw.eid||raw.equip_sn),
   tags:[...specialSkills,...specialEffects,...suitNames]
  };
  if(category==='角色'){
   const valuation=typeof module==='object'&&module.exports?require('./role-valuation.js'):globalThis.RoleValuation;
   if(valuation)result.roleValuationData=valuation.fromListing(raw,config);
   result.roleValuationHints={...(has(raw.is_niceid_new)?{niceIdType:Number(raw.is_niceid_new)}:{})};
   result.kind='role';result.type=text(config.school_info?.[raw.school])||text(Object.entries(config.school_to_kindid||{}).find(([,id])=>String(id)===String(raw.kindid))?.[0])||'角色';result.name=result.type;
   result.icon=RolePortrait.url(raw.icon)||safeIcon(raw);
   result.roleStage=roleStage(raw,result.summary);
   result.summary=[result.roleStage,result.summary.replace(/未飞升|(?:已)?化圣(?:[一二三四五六七八九1-9](?:层|境)?)?|(?:已)?渡劫|(?:已)?飞升/g,'').trim()].filter(Boolean).join(' ');
   result.roleBadges=[...(raw.is_split_main_role===true||raw.is_split_main_role===1?['整']:[]),...(raw.is_split_independent_role===true||raw.is_split_independent_role===1?['拆']:[])];
   result.roleTags=[...new Set((Array.isArray(raw.highlight)?raw.highlight:[]).map(row=>text(Array.isArray(row)?row[0]:typeof row==='string'?row:row?.name)).filter(label=>label&&!/性价比|收藏率|浏览|刚刚|组队招募/.test(label)))];
   if(has(raw.sum_exp)&&!result.roleTags.some(label=>label.startsWith('总经验')))result.roleTags.push('总经验'+text(raw.sum_exp)+'亿');
   return result;
  }
  if(category==='上古玉魄'){
   let other=raw.other_info;if(typeof other==='string'){try{other=JSON.parse(other);}catch{other={};}}
   const parsed=Yupo.summary(other?.desc||raw.large_equip_desc||raw.desc||raw.desc_sumup||'');
   result.kind='yupo';result.type='';result.level=0;result.equipmentKindId=String(raw.equip_type||(/阳/.test(result.name)?'61718':/阴/.test(result.name)?'61717':''));result.description=Yupo.plain(Yupo.renderDescription(other?.desc||raw.large_equip_desc||raw.desc||raw.desc_sumup||''));
   const yv=typeof module==='object'&&module.exports?require('./yupo-valuation.js'):globalThis.YupoValuation;result.yupoMeta=yv?.metadata(other?.desc||raw.large_equip_desc||raw.desc||raw.desc_sumup||'',raw);result.valuationMeta={...result.valuationMeta,level:0,failures:0,grade:0,gemIds:[],holes:0,holeSets:[0]};
   result.equipmentSummary={attributes:parsed.attributes,added:parsed.added};result.dustLevel=result.yupoMeta?String(result.yupoMeta.grade)+(result.yupoMeta.extraGrade?'[+'+result.yupoMeta.extraGrade+']':''):parsed.dustLevel||String(raw.minghun_level_total??raw.minghun_level??0);
   result.specialSkills=[];result.suits=[];result.specialEffects=parsed.effects.length?parsed.effects:[...result.description.matchAll(/(?:奇袭(?:特技|道具)[：:]\s*[^\n]+|(?:奇袭法术|物伤化劲|法伤化劲|固伤化劲|坚固无痕|坚如磐石)\s*\+[\d.]+%)/g)].map(m=>m[0]);
   result.traits=result.traits.filter(value=>value==='可还价');return result;
  }
  if(category==='灵饰'){
   result.kind='lingshi';result.type=({'61':'戒指','62':'耳饰','63':'手镯','64':'佩饰'})[String(raw.kindid)]||'灵饰';
   let other=raw.other_info;if(typeof other==='string'){try{other=JSON.parse(other);}catch{other={};}}
   const styled=other?.desc||raw.large_equip_desc||raw.desc||raw.desc_sumup||'';result.description=text(styled);
   result.equipmentSummary=Lingshi.summary(styled);
   if(!result.equipmentSummary.attributes.length)result.equipmentSummary.attributes=result.attributes.filter(a=>!['总伤','初伤（含命中）','初伤（不含命中）'].includes(a.label));
   result.equipmentSummary.added=result.equipmentSummary.added.map(a=>a.label+' +'+a.value);
   const effectNames=[...result.description.matchAll(/特效[：:]\s*([^\n]+)/g)].map(m=>m[1].trim());
   result.specialSkills=[];result.specialEffects=[...new Set([...effectNames,...(tokens(raw.special_effect).includes('1')?['超级简易']:[])])];
   result.suits=tokens(raw.suit_effect).map(id=>config.lingshi_suit_effects?.[Number(id)-1]).filter(value=>typeof value==='string');
   result.traits=result.traits.filter(value=>value==='可还价');
   const ls=Lingshi.initialSummary(styled);result.lingshiMeta={main:ls.attributes[0]||null,added:ls.added,grade:Number(raw.jinglian_level??result.description.match(/精[炼练]等级\s*(\d+)/)?.[1]??0),failures:Number(raw.repair_fail??result.description.match(/修理失败\s*(\d+)次/)?.[1]??0)};result.valuationMeta={...result.valuationMeta,grade:0,gemIds:[],holes:0,holeSets:[0],failures:result.lingshiMeta.failures};result.lingshiMeta.stone=Lingshi.clockStone(raw,styled);
   result.refineLevel=has(raw.jinglian_level)?String(raw.jinglian_level):result.description.match(/精[炼练]等级\s*(\d+)/)?.[1]??'';
   return result;
  }
  if(category==='召唤兽装备'){result.kind='pet-equipment';result.petEquipmentMeta=PetValuation.metadata(description,raw);result.equipmentKindId=result.petEquipmentMeta.position;result.valuationMeta={...result.valuationMeta,level:Math.floor(Number(result.level)/10)*10,grade:result.petEquipmentMeta.grade,failures:result.petEquipmentMeta.failures,holeSets:[],holes:0,gemIds:[]};const attrs=PetEquipment.attributes(description);result.suits=[PetEquipment.suit(description)||text(raw.addon_status)].filter(Boolean);result.equipmentSummary={attributes:attrs,added:[]};return result;}
  if(category!=='召唤兽')result.equipmentSummary=equipmentSummary(result);
  return category==='召唤兽'?normalizePet(raw,result,config):result;
 }
 // Read only a bounded, balanced LPC map; never execute the description text.
 function readPetCore(source){
  const match=/"summon_core"\s*:\s*\(\[/.exec(source);if(!match)return [];
  let depth=1,quote=false,escaped=false,end=match.index+match[0].length;
  const start=end;for(;end<source.length;end++){
   const char=source[end];if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quote=false;continue;}
   if(char==='"')quote=true;else if(char==='[')depth++;else if(char===']'&&--depth===0)break;
  }
  if(depth!==0)return null;
  const entries=new Map();for(const item of source.slice(start,end).matchAll(/(?:^|[,\s])(\d+)\s*:\s*\(\{\s*(\d+)/g))entries.set(item[1],Number(item[2]));
  return [...entries];
 }
 function normalizePet(raw,result,config){
  let pet={...raw};
  const description=[raw.large_equip_desc,raw.pet_desc,raw.equip_desc,raw.desc].find(value=>typeof value==='string'&&value.split(';').length>=30);
  let parsedDescription=false;
  if(typeof description==='string'){
   const values=description.split(';');
   if(values.length>=30&&/^\d+$/.test(values[1])&&/^\d+$/.test(values[2])){
    const fields={pet_name:0,pet_type:1,pet_level:2,max_blood:16,attack:5,defence:6,speed:7,attack_aptitude:20,defence_aptitude:21,physical_aptitude:22,magic_aptitude:23,speed_aptitude:24,growth:26,all_skill:27};
    parsedDescription=true;for(const [key,index] of Object.entries(fields))pet[key]=values[index];
    pet.is_baobao=Number(values[29])>0;const extra=values.slice(34).join(';');
    for(const [key,target] of [['iMagDam','fashang'],['iMagDef','fafang'],['tmp_lingxing','lingxing']]){const match=extra.match(new RegExp('\"'+key+'\"\\s*:\\s*(\\d+)'));if(match)pet[target]=match[1];}
    const core=readPetCore(extra);pet.coreEntries=core;pet.neidan_count=core?core.length:null;
    if(Number(values[28])>0)pet.all_skill=[values[27],values[28]].filter(Boolean).join('|');
   }
  }
  const types=config.pet_type_info_for_front||[],typeId=String((parsedDescription?pet.pet_type:null)||pet.equip_type||pet.pet_type||pet.type||'');
  const matched=types.find(row=>String(row[0]).split(',').includes(typeId));
  if(parsedDescription)result.description='';
  result.kind='pet';result.type=text(matched?.[1]||pet.type_name||PetCarryLevels?.info(typeId)?.name||'召唤兽');
  result.petTypeId=typeId;
  const grade=config.pet_equip_type_to_grade_mapping?.[typeId],info=PetCarryLevels?.resolve(typeId,result.type,grade);
  result.petCarryLevel=info?.level??null;result.petCarryStage=info?.stage??null;
  result.name=text(raw.equip_name||pet.pet_name||matched?.[1])||result.name;
  if(has(pet.pet_level))result.level=String(pet.pet_level);
  const skillDict={...(config.pet_skills_for_front||{})};for(const [id,info] of Object.entries(config.pet_skill_desc||{}))if(info?.name)skillDict[id]=info.name;
  const skills=pet.all_skill||pet.skills||pet.skill||pet.pet_skills;
  const skillIds=Array.isArray(skills)?skills.map(item=>typeof item==='object'?item.id||item.skill_id||item.skill_type||item.name:item):skills;
  if(!has(pet.skill_num)){const summaryCount=text(raw.desc_sumup).match(/技能数[：:\s]*(\d+)|(\d+)\s*(?:个)?技能/);if(summaryCount)pet.skill_num=Number(summaryCount[1]??summaryCount[2]);else if(has(skills))pet.skill_num=tokens(skillIds).length;}
  result.specialSkills=names(skillIds,skillDict,'技能');result.specialEffects=names(pet.texing,config.texing_types||{},'特性');result.suits=[];result.added=[];result.attributes=[];result.traits=result.traits.filter(t=>t==='可还价');
  const fields=[['neidan_count','内丹数'],['max_blood','气血'],['attack','攻击'],['defence','防御'],['speed','速度'],['fashang','法伤'],['fafang','法防'],['attack_aptitude','攻击资质'],['defence_aptitude','防御资质'],['physical_aptitude','体力资质'],['magic_aptitude','法力资质'],['speed_aptitude','速度资质'],['lingxing','历史灵性值'],['skill_num','技能数'],['valid_evol_skill_num','有效赐福技能数']];
  for(const [key,label] of fields)if(has(pet[key])&&Number.isFinite(Number(pet[key])))result.attributes.push({label,value:String(pet[key])});
  if(has(pet.growth)&&Number.isFinite(Number(pet.growth))){const value=Number(pet.growth);result.attributes.push({label:'成长',value:(value>10?value/1000:value).toFixed(3)});}
  if(pet.is_baobao===true||String(pet.is_baobao)==='1')result.traits.push('宝宝');
  const evol=Object.fromEntries((config.pet_web_evol_skill_options||[]).map(row=>[row[0],row[1]]));result.traits.push(...names(pet.evol_skill,evol,'赐福技能'));
  result.mengying=names(pet.mengying,config.pet_mengying||{},'梦影');
  for(const [key,dict,label] of [['high_neidan',config.high_neidans||{},'高级内丹'],['low_neidan',config.low_neidans||{},'低级内丹'],['mengying',config.pet_mengying||{},'梦影']])result.traits.push(...names(pet[key],dict,label));
  for(const [key,label] of [['high_neidan_level','高级内丹层数'],['low_neidan_level','低级内丹层数']])if(has(pet[key]))result.traits.push(label+' '+text(pet[key]));
  for(const [key,label] of [['positive_effect','正面效果'],['negative_effect','负面效果']])if(has(pet[key]))result.traits.push(label+'：'+names(pet[key],config.texing_poistive_effect_types||{},'等级').join('、'));
  if(has(pet.super_sum_star))result.traits.push('神兽星级 '+(String(pet.super_sum_star)==='0'?'初始':names(pet.super_sum_star,{'1':'一星','2':'二星','3':'三星'},'星级').join('、')));
  result.neidanCount=has(pet.neidan_count)&&Number.isSafeInteger(Number(pet.neidan_count))&&Number(pet.neidan_count)>=0?Number(pet.neidan_count):null;
  if(pet.coreEntries)for(const [id,level] of pet.coreEntries){const name=config.high_neidans?.[id]||config.low_neidans?.[id]||`内丹 #${id}`;result.traits.push(name+' · '+level+'层');}
  result.tags=[...result.specialSkills,...result.specialEffects,...result.traits];
  return result;
 }
 function equipmentBreakdown(description){
  const clean=text(description),[head,...rest]=clean.split('熔炼效果'),meltText=rest.join('熔炼效果'),base=new Map(),melt=new Map();
  const prefix=head.split(/符石|星位|制造者/)[0];
  for(const line of prefix.split('\n')){
   if(!/^(?:伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防|魔力|力量|敏捷|耐力|体质)\s*[+-]?\d/.test(line.trim()))continue;
   for(const m of line.matchAll(/(伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防|魔力|力量|敏捷|耐力|体质)\s*([+-]?\d+(?:\.\d+)?)/g))base.set(m[1],Number(m[2]));
  }
  for(const m of meltText.matchAll(/([+-]\d+(?:\.\d+)?)\s*(伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防|魔力|力量|敏捷|耐力|体质)/g))melt.set(m[2],(melt.get(m[2])||0)+Number(m[1]));
  return [...new Set([...base.keys(),...melt.keys()])].map(label=>({label,base:base.get(label)||0,melt:melt.get(label)||0,total:Number(((base.get(label)||0)+(melt.get(label)||0)).toFixed(3))}));
 }
 function equipmentSummary(item){
  const labels=['伤害','命中','防御','灵力','气血','魔法','速度','法伤','法防'];
  const basic=new Map(),description=item.description||'',head=description.split(/耐久(?:度)?/)[0];
  for(const m of head.matchAll(/(伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防)\s*([+-]?\d+(?:\.\d+)?)/g))basic.set(m[1],Number(m[2]));
  const melt=description.split('熔炼效果')[1]||'';
  if(basic.size){for(const m of melt.matchAll(/([+-]\d+(?:\.\d+)?)\s*(伤害|命中|防御|灵力|气血|魔法|速度|法伤|法防)/g))if(basic.has(m[2]))basic.set(m[2],basic.get(m[2])+Number(m[1]));}
  else for(const a of item.attributes||[])if(labels.includes(a.label)&&!basic.has(a.label))basic.set(a.label,Number(a.value));
  const shoe=String(item.equipmentKindId||'')==='19'||!item.equipmentKindId&&/鞋/.test(item.type||'');
  if(shoe){
   const breakdown=equipmentBreakdown(description);
   for(const [label,metric,initial] of [['防御','initialDefense','初防'],['敏捷','initialAgility','初敏']]){
    const parsed=breakdown.find(a=>a.label===label),official=item.valuationMeta?.metrics?.[metric]??item.attributes?.find(a=>a.label===initial)?.value??item.attributes?.find(a=>a.label===label)?.value;
    // The detail description has base and melt separately; official initial
    // fields already include melt and must not have it added a second time.
    if(parsed&&parsed.base!==0)basic.set(label,parsed.total);
    else if(official!==undefined&&official!==null&&Number.isFinite(Number(official)))basic.set(label,Number(official));
   }
  }
  const added=[];for(const line of item.added||[]){const pairs=[...line.matchAll(/([\u4e00-\u9fff]+)\s*([+-]?\d+(?:\.\d+)?)/g)];if(pairs.length)added.push(...pairs.filter(m=>!basic.has(m[1])).map(m=>m[1]+' '+(Number(m[2])>=0?'+':'')+Number(m[2])));else added.push(line);}
  if(!added.length)for(const a of equipmentBreakdown(description))if(!basic.has(a.label))added.push(a.label+' '+(a.total>=0?'+':'')+a.total);
  const kind=String(item.equipmentKindId||''),type=item.type||'';
  const weapon=['4','5','6','7','8','9','10','11','12','13','14','15','52','53','54','72','73','74','83','91'].includes(kind)||(!kind&&(item.attributes||[]).some(a=>['初伤（不含命中）','初伤（含命中）'].includes(a.label)));
  const gemNames={'1':'红玛瑙','2':'太阳石','3':'舍利子','5':'月亮石'},gemIds=new Set(Array.isArray(item.equipmentGemIds)?item.equipmentGemIds.map(String):[]);
  if(!Array.isArray(item.equipmentGemIds)){
   const inlaid=(description.match(/镶嵌宝石[：:]?\s*([^\n]+)/)||[])[1]||'',traits=(item.traits||[]).join(' '),source=/红玛瑙|太阳石|舍利子|月亮石|宝石 #\d/.test(traits)?traits:inlaid;
   for(const [id,name] of Object.entries(gemNames))if(source.includes(name)||new RegExp('宝石 #'+id+'(?!\\d)').test(source))gemIds.add(id);
  }
  if(item.equipmentGemLevel===0||(item.traits||[]).includes('未镶嵌宝石'))gemIds.clear();
  // Gems change total stats, not initial stats. Only show initial values when
  // the corresponding gem bonus makes them useful alongside the total.
  const initialFields=weapon?[...(gemIds.has('2')?[['初伤（不含命中）','初伤']]:[]),...(gemIds.has('2')||gemIds.has('1')?[['初伤（含命中）','初总伤']]:[])]:kind==='21'||/项链|饰品/.test(type)?(gemIds.has('3')?[['初灵','初灵']]:[]):['18','59'].includes(kind)||/男衣|女衣|铠甲/.test(type)?(gemIds.has('5')?[['初防','初防']]:[]):[];
  // Official initial values are used directly, without recalculating gems or melt.
  const initial=[];for(const [source,label] of initialFields){const a=(item.attributes||[]).find(a=>a.label===source);if(a&&Number.isFinite(Number(a.value))&&Number(a.value)>0)initial.push({label,value:String(a.value)});}
  return {attributes:[...[...basic].map(([label,value])=>({label,value:String(Number(value.toFixed(3)))})),...initial],added:[...new Set(added)],withMelt:!!melt.trim()};
 }
 function equipmentKey(item){return JSON.stringify([item.taskId||'',item.serverId||'',item.detailEid||item.id]);}
 function tradeBadges(item){return `${item.fairShow?'<span class="trade-mark trade-fair" title="公示期商品" aria-label="公示期">公</span>':''}${item.traits.includes('可还价')?'<span class="trade-mark trade-bargain" title="可还价" aria-label="可还价">还</span>':''}`;}
 function lingshiListSummary(item){
  const m=item.lingshiMeta;
  if(m?.main&&Array.isArray(m.added))return {attributes:[{label:m.main.label,value:String(m.main.value)}],added:m.added.map(a=>a.label+' +'+a.value)};
  const saved=item.equipmentSummary||{attributes:[],added:[]},parsed=Lingshi.initialSummary(item.description||''),pool=[...parsed.attributes,...parsed.added].slice(1),used=new Set();
  const attributes=saved.attributes?.length?[saved.attributes[0]]:parsed.attributes.length?[{label:parsed.attributes[0].label,value:String(parsed.attributes[0].value)}]:[];
  const grade=has(item.refineLevel)?Number(item.refineLevel):Number((item.traits||[]).find(t=>/^精炼 \d+级$/.test(t))?.match(/\d+/)?.[0]);
  const added=(saved.added||[]).map(line=>{const entry=Lingshi.initialSummary('#G'+line).added[0];if(!entry)return line;const index=pool.findIndex((a,i)=>!used.has(i)&&a.label===entry.label&&a.value+a.bonus===entry.value);if(index>=0){used.add(index);return entry.label+' +'+pool[index].value;}return entry.label+(grade===0?' +'+entry.value:' 基础值未提供');});
  return {attributes,added};
 }
 function crossFeeCents(item){
  const display=Number(String(item.crossFee||'').replace(/,/g,'')),raw=Number(item.valuationMeta?.crossFeeCents);
  return display>0&&Number.isFinite(display)?Math.round(display*100):raw>0&&Number.isFinite(raw)?Math.round(raw):0;
 }
 function crossFeeLine(item){const fee=crossFeeCents(item);return fee?`<span class="listing-cross-fee">跨服费 ¥ ${escape(money(fee))}</span>`:'';}
 function renderEquipment(item){
  const pet=item.kind==='pet',petEquip=item.kind==='pet-equipment',lingshi=item.kind==='lingshi',yupo=item.kind==='yupo',compact=lingshi||yupo,key=equipmentKey(item),open=typeof EquipmentDisclosure==='object'&&EquipmentDisclosure.isOpen(key),summary=yupo&&item.yupoMeta?.main?{attributes:[{label:item.yupoMeta.main.label,value:String(item.yupoMeta.main.value)}],added:item.yupoMeta.added.map(r=>r.label+' +'+r.value)}:lingshi?lingshiListSummary(item):item.kind==='sword'?equipmentSummary(item):item.equipmentSummary||equipmentSummary(item);
  const refineLevel=has(item.refineLevel)?item.refineLevel:lingshi?(item.traits.find(value=>/^精炼 \d+级$/.test(value))?.match(/\d+/)?.[0]??''):'';
  const labels=(values,kind,label)=>[...new Set(values)].map(v=>`<span class="eq-label eq-${kind}">${label?`<small>${label}</small>`:''}${escape(compact?v.replace(/^(.+?)[（(](\d+)级[）)]$/,'$2级$1'):v)}</span>`).join('');
  const traits=[...new Set(item.traits)].filter(t=>!item.specialSkills.includes(t)&&!item.specialEffects.includes(t)&&!item.suits.includes(t));
  const facts=petEquip||compact?[]:traits.filter(t=>t!=='可还价');
  if(item.kind==='sword'||lingshi){const count=(lingshi?item.lingshiMeta?.failures:undefined)??item.valuationMeta?.failures??Number([...traits,item.description||''].join(' ').match(/修理失败\s*(\d+)\s*次/)?.[1]||0);for(let i=facts.length-1;i>=0;i--)if(/^修理失败/.test(facts[i]))facts.splice(i,1);if(count>0)facts.push('修理失败 '+count+'次');}
  const petStats=pet?`<div class="eq-base pet-list-stats">${['成长','技能数'].map(label=>`<span>${label} <b>${escape((item.attributes||[]).find(a=>a.label===label)?.value??'—')}</b></span>`).join('')}</div>`:'';
  return `<details class="listing-row equipment-listing${pet?' pet-listing':''}${lingshi?' lingshi-listing':''}" role="listitem" data-equipment-key="${escape(key)}" data-detail-eid="${escape(item.detailEid||'')}" data-detail-server="${escape(item.serverId)}" data-detail-task="${escape(item.taskId)}" data-detail-mengying="${escape(JSON.stringify(item.mengying||[]))}" ${open?'open':''}><summary aria-label="${escape(item.name)}，展开或收起${pet?'召唤兽':yupo?'上古玉魄':lingshi?'灵饰':'装备'}详情"><div class="eq-overview${pet?' pet-overview':''}"><div class="listing-identity"><div class="listing-icon"><span aria-hidden="true">${pet?'宠':'装'}</span>${item.icon?`<img src="${escape(item.icon)}" alt="${escape(item.name)}" loading="lazy" referrerpolicy="no-referrer">`:''}</div><div><h3>${tradeBadges(item)}${escape(item.name)}</h3><div class="listing-level">${yupo?'':escape(item.level)+'级'}${item.type&&(!pet||item.type!==item.name)?' · '+escape(item.type):''}</div>${petStats}</div></div>${pet?'':`<div class="eq-parameters"><div class="eq-base">${summary.attributes.map(a=>`<span>${escape(compact?Lingshi.shortName(a.label):a.label)} <b>${compact&&Number(a.value)>0?'+':''}${escape(a.value)}</b></span>`).join('')}${yupo&&Number(item.yupoMeta?.grade??parseFloat(item.dustLevel))>0?`<span>灵尘等级 <b>${escape(item.dustLevel)}</b></span>`:''}${lingshi&&Number(refineLevel)>0?`<span>精炼等级 <b>${escape(refineLevel)}</b></span>`:''}</div>${summary.added.length?`<div class="eq-added">${compact?'':'<small>附加属性</small>'}${summary.added.map(a=>`<span>${escape(compact?Lingshi.shortName(a):a)}</span>`).join('')}</div>`:''}<div class="eq-facts">${facts.map(t=>`<span>${escape(t)}</span>`).join('')}</div><div class="eq-labels">${petEquip?'':labels(item.specialSkills,'skill','特技')}${petEquip?'':labels(item.specialEffects,'effect',compact?'':'特效')}${labels(item.suits,'suit',compact?'':'套装')}</div>${petEquip&&PetValuation.risk(item)?`<p class="pet-equipment-risk ${PetValuation.risk(item).tone==='danger'?'is-unestimated':'is-rough'}">${escape(PetValuation.risk(item).message)}</p>`:''}</div>`}<div class="listing-market">${item.collectCount!==''?`<span>收藏 ${escape(item.collectCount)}</span>`:''}<span class="listing-status${item.availabilityStatus&&item.availabilityStatus!=='listed'?' is-unavailable':''}">${escape(item.status)}${item.recovered?' · 复核补回':''}${item.fairShow?' · 公示期':''}</span>${item.remaining?`<span>剩余 ${escape(item.remaining)}</span>`:''}${item.fairShowLeft?`<span>公示剩余 ${escape(item.fairShowLeft)}</span>`:''}</div><div class="listing-price-server"><strong class="listing-price">${item.priceDisplay?'¥ '+escape(item.priceDisplay):'价格未提供'}</strong>${crossFeeLine(item)}${typeof equipmentInlineValuation==='function'?equipmentInlineValuation(item):''}<b class="listing-server">${escape(item.server)}</b>${item.area?`<span>${escape(item.area)}</span>`:''}<span class="eq-expand-hint" aria-hidden="true"></span>${ProductActions.render(item)}</div></div></summary><div class="equipment-expanded">${ProductActions.render(item)}<div class="equipment-full-detail"><p role="status">展开后加载详情…</p></div><dl class="eq-metadata">${[['上架时间',item.sellingTime],['下架时间',item.expireTime],['卖家',item.seller],['商品编号',item.orderNumber]].filter(([,v])=>v).map(([k,v])=>`<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join('')}</dl>${item.customDescription?`<div class="eq-seller-note"><span>卖家说明</span><p>${escape(item.customDescription)}</p></div>`:''}</div></details>`;
 }
 function renderRole(item){return `<details class="listing-row equipment-listing role-listing" role="listitem" data-equipment-key="${escape(equipmentKey(item))}" data-detail-eid="${escape(item.detailEid||'')}" data-detail-server="${escape(item.serverId)}" data-detail-task="${escape(item.taskId)}" ${typeof EquipmentDisclosure==='object'&&EquipmentDisclosure.isOpen(equipmentKey(item))?'open':''}><summary aria-label="${escape(item.name)}，展开或收起角色详情"><div class="eq-overview"><div class="listing-identity"><div class="listing-icon"><span aria-hidden="true">角</span>${item.icon?`<img src="${escape(item.icon)}" alt="${escape(item.name)}" loading="lazy" referrerpolicy="no-referrer">`:''}</div><div class="role-list-copy"><h3>${(item.roleBadges||[]).map(label=>`<span class="trade-mark role-trade-${label==='拆'?'split':'whole'}" title="${label==='拆'?'拆售角色':'整号'}" aria-label="${label==='拆'?'拆售角色':'整号'}">${label}</span>`).join('')}${tradeBadges(item)}<strong>${escape(item.type)}</strong><span class="role-title-divider" aria-hidden="true">｜</span><span class="listing-level">${escape(item.level)}级</span></h3><div class="role-summary">${escape(item.summary)}${item.recovered?' · 复核补回':''}</div>${item.roleTags?.length?`<div class="role-fact-tags">${item.roleTags.map(tag=>`<span>${escape(tag)}</span>`).join('')}</div>`:''}</div></div><div class="listing-price-server"><b class="listing-server">${escape([item.area,item.server].filter(Boolean).join('-'))}</b><strong class="listing-price">${item.priceDisplay?'¥ '+escape(item.priceDisplay):'价格未提供'}</strong>${crossFeeLine(item)}${typeof equipmentInlineValuation==='function'?equipmentInlineValuation(item):''}${item.sellingAgo?`<span>${escape(item.sellingAgo)}</span>`:''}${item.fairShowLeft?`<span>公示剩余 ${escape(item.fairShowLeft)}</span>`:''}${ProductActions.render(item)}</div></div></summary><div class="equipment-expanded">${ProductActions.render(item)}<div class="equipment-full-detail"><p role="status">展开后加载角色详情…</p></div></div></details>`;}

 function renderItem(item){return item.kind==='role'?renderRole(item):renderEquipment(item);}
 function sortItems(items,{by='price',direction='asc',valuation=item=>({estimateCents:item.sampleEstimateCents,rough:item.rough})}={}){
  const collator=new Intl.Collator('zh-CN-u-co-pinyin',{numeric:true,sensitivity:'base'}),sign=direction==='desc'?-1:1;
  const priceCompare=(a,b)=>{
   const aValid=typeof a.price==='number'&&Number.isFinite(a.price),bValid=typeof b.price==='number'&&Number.isFinite(b.price);
   if(!aValid||!bValid)return aValid?-1:bValid?1:0;
   return (a.price-b.price)*sign;
  };
  const totalPriceCompare=(a,b)=>{const av=typeof a.price==='number'&&Number.isFinite(a.price),bv=typeof b.price==='number'&&Number.isFinite(b.price);return av&&bv?(Math.round(a.price*100)+crossFeeCents(a))-(Math.round(b.price*100)+crossFeeCents(b)):av?-1:bv?1:0;};
  const serverCompare=(a,b)=>collator.compare(a.area||'',b.area||'')||collator.compare(a.server||'',b.server||'')||collator.compare(String(a.serverId||''),String(b.serverId||''));
  const numericDesc=(a,b)=>{const av=has(a)&&Number.isFinite(Number(a)),bv=has(b)&&Number.isFinite(Number(b));return av&&bv?Number(b)-Number(a):av?-1:bv?1:0;};
  const ascendingPrice=(a,b)=>{const av=typeof a.price==='number'&&Number.isFinite(a.price),bv=typeof b.price==='number'&&Number.isFinite(b.price);return av&&bv?a.price-b.price:av?-1:bv?1:0;};
  const carry=item=>PetCarryLevels?.info(item.petTypeId||'',item.type)||(has(item.petCarryLevel)?{level:item.petCarryLevel,stage:item.petCarryStage}:null);
  const growth=item=>(item.attributes||[]).find(a=>a.label==='成长')?.value;
  const shape=item=>(item.type&&item.type!=='召唤兽'?item.type:PetCarryLevels?.info(item.petTypeId||'')?.name||item.name||'').replace(/^变异/,'');
  const premiums=by==='premium'?new Map(items.map(item=>{const quote=valuation(item),estimate=quote?.estimateCents,asking=Math.round(item.price*100),valid=typeof item.price==='number'&&Number.isFinite(item.price)&&asking>0&&typeof estimate==='number'&&Number.isFinite(estimate)&&estimate>0;return [item,{group:valid?0:1,rate:valid?(asking-estimate)/estimate:null}];})):null;
  const premiumCompare=(a,b)=>{const av=premiums.get(a),bv=premiums.get(b);return av.group-bv.group||(av.rate!==null&&bv.rate!==null?av.rate-bv.rate:0)||ascendingPrice(a,b);};
  return [...items].sort((a,b)=>by==='totalPrice'?totalPriceCompare(a,b)||ascendingPrice(a,b):by==='premium'?premiumCompare(a,b):by==='shape'?numericDesc(carry(a)?.level,carry(b)?.level)||numericDesc(carry(a)?.stage,carry(b)?.stage)||collator.compare(shape(a),shape(b))||ascendingPrice(a,b):by==='growth'?numericDesc(growth(a),growth(b))||ascendingPrice(a,b):by==='server-price'?serverCompare(a,b)||priceCompare(a,b):by==='server'?serverCompare(a,b)*sign:priceCompare(a,b));
 }
 function renderList(items){return items.length?`<div class="equipment-result-list" role="list" aria-label="${items[0]?.kind==='role'?'角色搜索结果':items[0]?.kind==='pet'?'召唤兽搜索结果':items[0]?.kind==='pet-equipment'?'召唤兽装备搜索结果':items[0]?.kind==='yupo'?'上古玉魄搜索结果':items[0]?.kind==='lingshi'?'灵饰搜索结果':'装备搜索结果'}">${items.map(renderItem).join('')}</div>`:'<div class="listing-empty">暂无匹配商品</div>';}
 return {escape,text,tokens,money,parseResponse,safeIcon,roleStage,normalize,renderItem,renderList,sortItems,equipmentSummary,equipmentKey,equipmentBreakdown};
});
