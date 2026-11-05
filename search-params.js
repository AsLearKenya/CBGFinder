(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./server-catalog.js'):root.ServerCatalog,typeof module==='object'&&module.exports?require('./search-policy.js'):root.SearchPolicy);if(typeof module==='object'&&module.exports)module.exports=api;else root.SearchParams=api;})(typeof globalThis==='object'?globalThis:this,function(serverCatalog,policy){
 'use strict';
 const ENDPOINT='https://xyq.cbg.163.com/cgi-bin/recommend.py';
 const attributeMap={totalDamage:'all_damage',initialDamageIncludingHit:'init_damage',initialDamageExcludingHit:'init_damage_raw',initialSpirit:'init_wakan',totalSpirit:'all_wakan',initialDefense:'init_defense',initialHp:'init_hp',initialAgility:'init_dex',damage:'damage'};
 const has=value=>value!==undefined&&value!==null&&value!=='';
 function integer(value,label,min=0,max=10000){const n=Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error(`${label}必须是 ${min}～${max} 的整数`);return String(n);}
 function numericList(values,label){if(!Array.isArray(values))throw new Error(`${label}格式无效`);const tokens=values.flatMap(value=>String(value).split(','));return [...new Set(tokens.map(value=>integer(value,label,0,999999)))].join(',');}
 function priceCents(value){const match=String(value).trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);if(!match)throw new Error('价格必须为非负数，最多保留两位小数');const cents=Number(match[1])*100+Number((match[2]||'').padEnd(2,'0'));if(!Number.isSafeInteger(cents))throw new Error('价格超出有效范围');return String(cents);}
 function levelRanges(levels){
  if(!levels?.length)return [[60,160]];
  if(!Array.isArray(levels))throw new Error('装备等级格式无效');
  const selected=[...new Set(levels.map(value=>Number(integer(value,'装备等级',60,160))))].sort((a,b)=>a-b);
  if(selected.some(value=>value%10!==0))throw new Error('装备等级必须按十级选择');
  const ranges=[];for(const level of selected){const last=ranges.at(-1);if(last&&level===last[1]+10)last[1]=level;else ranges.push([level,level]);}return ranges;
 }
 function baseParams(filters){
  const f=filters||{},p={act:'recommd_by_role',page:'1',count:'15',search_type:'overall_search_equip',view_loc:'overall_search'};
  if(f.types?.length)p.kindid=numericList(f.types,'装备类型');
  else if(has(f.type))p.kindid=integer(f.type,'装备类型',1,999999);
  if(f.specialSkills?.length)p.special_skill=numericList(f.specialSkills,'特技');
  if(f.specialEffects?.length){p.special_effect=numericList(f.specialEffects,'特效');p.special_mode=f.effectMode==='any'?'or':'and';}
  if(f.gems?.length)p.gem_value=numericList(f.gems,'宝石');
  if(f.suits?.length){if(!Array.isArray(f.suits)||f.suits.some(item=>!['suit_transform_skills','suit_transform_charms','suit_append_skills','suit_added_status'].includes(item.source)))throw new Error('套装来源无效');p.suit_effect=numericList(f.suits.map(item=>item.value),'套装');}
  for(const [key,param] of Object.entries(attributeMap))if(has(f[key]))p[param]=integer(f[key],'属性阈值');
  if(Object.values(attributeMap).some(key=>has(p[key])))p.attr_with_melt='1';
  if(f.sumAttributes?.length){if(!Array.isArray(f.sumAttributes)||f.sumAttributes.some(value=>!['magic','dex','endurance','physique','power'].includes(value)))throw new Error('属性计算类型无效');p.sum_attr_type=[...new Set(f.sumAttributes)].join(',');}
  if(has(f.sumMinimum)){if(!p.sum_attr_type)throw new Error('请选择参与属性计算的属性');p.sum_attr_value=integer(f.sumMinimum,'属性总和');p.sum_attr_with_melt='1';}
  if(has(f.minPrice))p.price_min=priceCents(f.minPrice);
  if(has(f.maxPrice))p.price_max=priceCents(f.maxPrice);
  if(has(p.price_min)&&has(p.price_max)&&Number(p.price_min)>Number(p.price_max))throw new Error('最低价格不能高于最高价格');
  if(has(f.gemLevel))p.gem_level=integer(f.gemLevel,'宝石锻炼等级',0,20);
  if(has(f.holeCount))p.hole_num=integer(f.holeCount,'开孔数目',0,5);
  if(has(f.repairFailures))p.repair_fail=integer(f.repairFailures,'修理失败次数',0,5);
  if(f.excludeMixedGems)p.filter_hun_da_gem='1';
  if(f.activatedStarPosition)p.star='1';
  if(has(f.extra160))p['160_attr']=integer(f.extra160,'160级特性',1,11);
  if(has(f.origin)){const origins={system:'1',normal:'3',enhanced:'4'};if(!origins[f.origin])throw new Error('装备出处无效');p.produce_from=origins[f.origin];}
  return p;
 }
 const petNumericFields={level_min:['最低等级',180],level_max:['最高等级',180],skill_num:['技能数',10000],valid_evol_skill_num:['有效赐福技能数',4],attack_aptitude:['攻击资质',10000],defence_aptitude:['防御资质',10000],physical_aptitude:['体力资质',10000],magic_aptitude:['法力资质',10000],speed_aptitude_min:['最低速度资质',10000],speed_aptitude_max:['最高速度资质',10000],max_blood:['气血',20000],attack:['攻击',4000],defence:['防御',4000],speed_min:['最低速度',2000],speed_max:['最高速度',2000],fashang:['法伤',99999],fafang:['法防',99999],lingxing:['历史灵性值',10000],high_neidan_level:['高级内丹层数',5],low_neidan_level:['低级内丹层数',5]};
 const petListFields=['type','classTypes','skill','not_in_skill','evol_skill','kindid','texing','positive_effect','negative_effect','high_neidan','low_neidan','super_sum_star','mengying'];
 const petBooleanFields=['skill_with_suit','is_baobao','no_include_sp_skill','advanced_evol_skill'];
 const petFilterFields=[...Object.keys(petNumericFields),...petListFields,...petBooleanFields,'growth','price_min','price_max','evol_skill_mode','petClasses','neidan_count','pet_sub_type'];
 function petBaseParams(filters){
  const f=filters||{},p={act:'recommd_by_role',page:'1',count:'15',search_type:'overall_search_pet',view_loc:'overall_search',evol_skill_mode:f.evol_skill_mode==='all'?'1':'0'};
  for(const field of petListFields)if(f[field]?.length&&field!=='classTypes')p[field]=numericList(f[field],field);
  if(!p.type&&f.classTypes?.length)p.type=numericList(f.classTypes,'召唤兽分类');
  for(const [key,[label,max]] of Object.entries(petNumericFields))if(has(f[key]))p[key]=integer(f[key],label,0,max);
  for(const field of petBooleanFields)if(f[field]===true)p[field]='1';
  if(has(f.growth)){const match=String(f.growth).trim().match(/^(\d)(?:\.(\d{1,3}))?$/);if(!match)throw Error('成长必须为非负数，最多三位小数');p.growth=String(Number(match[1])*1000+Number((match[2]||'').padEnd(3,'0')));}
  if(has(f.price_min))p.price_min=priceCents(f.price_min);
  if(has(f.price_max))p.price_max=priceCents(f.price_max);
  for(const [min,max,label] of [['level_min','level_max','等级'],['price_min','price_max','价格'],['speed_aptitude_min','speed_aptitude_max','速度资质'],['speed_min','speed_max','速度']])if(has(p[min])&&has(p[max])&&Number(p[min])>Number(p[max]))throw Error('最低'+label+'不能高于最高'+label);
  if(has(f.neidan_count))p.neidan_num=integer(f.neidan_count,'内丹总数量',0,10);
  if(has(f.pet_sub_type)){if(!['1','2'].includes(String(f.pet_sub_type))||Array.isArray(f.pet_sub_type))throw Error('成品 / 胚子选项无效');p.pet_sub_type=String(f.pet_sub_type);}
  const included=new Set((p.skill||'').split(','));if((p.not_in_skill||'').split(',').some(id=>id&&included.has(id)))throw Error('同一技能不能同时包含和排除');
  if(p.no_include_sp_skill&&!p.skill_num)delete p.no_include_sp_skill;
  return p;
 }
 const roleNumericGroups={"attributes":[["shang_hai","伤害"],["ming_zhong","命中"],["ling_li","灵力"],["fang_yu","防御"],["hp","气血"],["speed","速度"],["fa_shang","法伤"],["fa_fang","法防"],["qian_neng_guo","潜能果数"],["jiyuan_and_addpoint","机缘、月饼粽子属性总和"]],"cultivation":[["expt_total","修炼总和"],["expt_gongji","攻击修炼"],["expt_fangyu","防御修炼"],["expt_fashu","法术修炼"],["expt_kangfa","抗法修炼"],["max_expt_gongji","攻击上限"],["max_expt_fangyu","防御上限"],["max_expt_fashu","法术上限"],["max_expt_kangfa","抗法上限"],["expt_lieshu","猎术修炼"]],"petCultivation":[["bb_expt_total","宠修总和"],["bb_expt_gongji","攻击控制"],["bb_expt_fangyu","防御控制"],["bb_expt_fashu","法术控制"],["bb_expt_kangfa","抗法控制"],["skill_drive_pet","育兽术"]],"schoolSkills":[["school_skill_num","技能个数"],["school_skill_level","技能等级"],["qian_yuan_dan","乾元丹"],["lin_shi_fu","临时符技能"],["smith_skill","打造熟练度"],["sew_skill","裁缝熟练度"]],"lifeSkills":[["skill_qiang_shen","强身术"],["skill_qiang_zhuang","强壮"],["skill_shensu","神速"],["skill_ming_xiang","冥想"],["skill_yangsheng","养生之道"],["skill_jianshen","健身术"],["skill_dazao","打造技巧"],["skill_caifeng","裁缝技巧"],["skill_lianjin","炼金术"],["skill_cuiling","淬灵之术"],["skill_qiaojiang","巧匠之术"],["skill_lingshi","灵石技巧"],["skill_ronglian","熔炼技巧"],["skill_zhongyao","中药医理"],["skill_pengren","烹饪技巧"],["skill_anqi","暗器技巧"],["skill_zhuibu","追捕技巧"],["skill_taoli","逃离技巧"],["skill_rain_sense","雨之感应"],["skill_snow_sense","雪之感应"],["skill_wind_sense","风之感应"]],"plotSkills":[["skill_bianhua","变化之术"],["skill_miaoshou","妙手空空"],["skill_xianling","仙灵店铺"],["skill_jianzhu","建筑之术"],["skill_danyuan","丹元济会"],["skill_huoyan","火眼金睛"],["skill_baoshi","宝石工艺"],["skill_qimen","奇门遁甲"],["skill_gudong","古董评估"],["skill_hanmo","翰墨之道"],["skill_danqing","丹青之道"]],"mount":[["jinjie_rider_level","等级"],["jinjie_rider_tongyu","统驭"],["jinjie_rider_skill_level_count","技能"]],"mountPoints":[["jinjie_rider_scheme_cor","体质"],["jinjie_rider_scheme_str","力量"],["jinjie_rider_scheme_mag","魔力"],["jinjie_rider_scheme_res","耐力"],["jinjie_rider_scheme_spe","敏捷"]],"other":[["cheng_jiu","成就"],["clothes_num","锦衣数量"],["body_caiguo","身上染色折算彩果"],["all_caiguo","所有染色折算彩果"],["box_caiguo","保存染色方案数"],["school_offer","门贡"],["org_offer","帮贡"],["badness","善恶"],["special_equip_max_level","专用装备等级"],["sbook_skill_num","召唤兽心得技能"],["cash","现金"]]};
 const roleNumericFields=Object.fromEntries(Object.values(roleNumericGroups).flat().map(([key,label])=>[key,[label,999999999]]));
 Object.assign(roleNumericFields,{school_skill_num:['师门技能个数',7],level_min:['最低等级',175],level_max:['最高等级',175],sum_exp_min:['最低总经验',999999999],sum_exp_max:['最高总经验',999999999],fabao_total_cnt:['总法宝数量',999],...Object.fromEntries([1,2,3,4].map(n=>['fabao_lv'+n+'_cnt',[n+'级法宝数量',999]]))});
 const roleListFields=['school','school_change_list','ori_race','race','limit_clothes','widget_list'];
 const roleBooleanFields=['use_original_school_skill_level','fabao_lv1_full_layer','fabao_lv2_full_layer','fabao_lv3_full_layer','fabao_lv4_full_layer','jinjie_rider_scheme_use_pct'];
 const roleFilterFields=[...Object.keys(roleNumericFields),...roleListFields,...roleBooleanFields,'price_min','price_max','jinjie_rider_growth','jinjie_rider_scheme_logic','xiangrui_list','xiangrui_match_all','perform_effect','perform_match_all','limit_clothes_logic','widget_match_all','zhuang_zhi','is_niceid_new','gender'];
 function normalizeRoleFilters(filters){
  const f={...(filters||{})};
  // Combined threshold wins when an older task also has separate thresholds.
  if(!has(f.jiyuan_and_addpoint)&&(has(f.ji_yuan_point)||has(f.addon_point))){
   f.jiyuan_and_addpoint=String(['ji_yuan_point','addon_point'].reduce((sum,key)=>sum+(has(f[key])?Number(integer(f[key],'机缘、月饼粽子属性',0,999999999)):0),0));
  }
  delete f.ji_yuan_point;delete f.addon_point;return f;
 }
 function roleBaseParams(filters){
  const f=normalizeRoleFilters(filters),p={act:'recommd_by_role',page:'1',count:'15',search_type:'overall_search_role',view_loc:'overall_search'};
  for(const [key,[label,max]] of Object.entries(roleNumericFields))if(has(f[key]))p[key]=integer(f[key],label,0,key.startsWith('jinjie_rider_scheme_')?(f.jinjie_rider_scheme_use_pct?100:999):max);
  for(const key of roleListFields)if(f[key]?.length)p[key]=numericList(f[key],key);
  for(const key of ['xiangrui_list','perform_effect'])if(f[key]?.length){if(!Array.isArray(f[key])||f[key].some(v=>typeof v!=='string'||!v||v.length>100||v.includes(',')))throw Error('外观选项格式无效');p[key]=[...new Set(f[key])].join(',');}
  for(const key of roleBooleanFields)if(f[key]===true)p[key]='1';
  for(const key of ['price_min','price_max'])if(has(f[key]))p[key]=priceCents(f[key]);
  if(has(f.jinjie_rider_growth)){const n=Number(f.jinjie_rider_growth);if(!Number.isFinite(n)||n<0||n>2.35||!/^\d+(?:\.\d{1,4})?$/.test(String(f.jinjie_rider_growth)))throw Error('进阶坐骑成长必须为0～2.35，最多四位小数');p.jinjie_rider_growth=String(n);}
  for(const [key,values] of [['jinjie_rider_scheme_logic',['all','any']],['limit_clothes_logic',['and','or']],['widget_match_all',['0','1']]])if(has(f[key])){if(!values.includes(String(f[key])))throw Error('筛选方式无效');p[key]=String(f[key]);}
  for(const key of ['xiangrui_match_all','perform_match_all'])if(f[key]===true)p[key]='1';
  if(has(f.zhuang_zhi)){const v=String(f.zhuang_zhi);if(!['1','2','10,20,30,40,50,60,70,80,90',...Array.from({length:9},(_,i)=>String((i+1)*10))].includes(v))throw Error('飞升状态无效');p.zhuang_zhi=v;}
  if(has(f.is_niceid_new)){if(!['1,2,3','2,3','3'].includes(String(f.is_niceid_new)))throw Error('靓号条件无效');p.is_niceid_new=String(f.is_niceid_new);}
  if(f.gender?.length){const male=['1','2','5','6','9','10','201','205','209','212'],female=['3','4','7','8','11','12','203','207','208','211'];if(!Array.isArray(f.gender)||f.gender.some(v=>!['male','female'].includes(v)))throw Error('性别格式无效');const allowed=f.gender.flatMap(v=>v==='male'?male:female);const ids=p.race?p.race.split(',').filter(v=>allowed.includes(v)):allowed;if(!ids.length)throw Error('所选造型与性别不匹配');p.race=ids.join(',');}
  if(['cor','str','mag','res','spe'].some(k=>has(p['jinjie_rider_scheme_'+k])))p.jinjie_rider_scheme_logic=f.jinjie_rider_scheme_logic==='any'?'any':'all';
  else{delete p.jinjie_rider_scheme_logic;delete p.jinjie_rider_scheme_use_pct;}
  if(p.limit_clothes)p.limit_clothes_logic=f.limit_clothes_logic==='and'?'and':'or';else delete p.limit_clothes_logic;
  if(p.widget_list)p.widget_match_all=String(f.widget_match_all??'0');else delete p.widget_match_all;
  if(!p.xiangrui_list)delete p.xiangrui_match_all;if(!p.perform_effect)delete p.perform_match_all;
  for(const n of [1,2,3,4])if(p['fabao_lv'+n+'_full_layer']&&!has(p['fabao_lv'+n+'_cnt']))p['fabao_lv'+n+'_cnt']='0';
  for(const [min,max,label] of [['level_min','level_max','等级'],['price_min','price_max','价格'],['sum_exp_min','sum_exp_max','总经验']])if(has(p[min])&&has(p[max])&&Number(p[min])>Number(p[max]))throw Error('最低'+label+'不能高于最高'+label);
  return p;
 }
 const petEquipNumericFields={speed:'速度',fangyu:'防御',mofa:'魔法',shanghai:'伤害',hit_ratio:'命中率',hp:'气血',xiang_qian_level:'宝石等级',addon_sum_min:'属性总和',addon_minjie_reduce:'敏捷减少'};
 const petEquipFlags=['addon_tizhi','addon_liliang','addon_fali','addon_lingli','addon_naili','addon_minjie','include_no_skill','include_can_cover_skill','addon_sum_include_damage'];
 const petEquipFilterFields=[...Object.keys(petEquipNumericFields),...petEquipFlags,'level_min','level_max','price_min','price_max','equip_pos','xiangqian_stone_attr','repair_failed_times','addon_status'];
 function petEquipBaseParams(filters){
  const f=filters||{},p={act:'recommd_by_role',page:'1',count:'15',search_type:'overall_search_pet_equip',view_loc:'overall_search'};
  for(const [key,label] of Object.entries(petEquipNumericFields))if(has(f[key]))p[key]=integer(f[key],label,0,999999999);
  for(const key of ['level_min','level_max'])if(has(f[key]))p[key]=integer(f[key],'装备等级',5,145);
  for(const key of ['price_min','price_max'])if(has(f[key]))p[key]=priceCents(f[key]);
  for(const [key,allowed] of [['equip_pos',['1','2','3']],['xiangqian_stone_attr',['1','2','3','4','5','6']]])if(f[key]?.length){if(!Array.isArray(f[key])||f[key].some(value=>!allowed.includes(String(value))))throw Error('召唤兽装备选项无效');p[key]=[...new Set(f[key].map(String))].join(',');}
  for(const key of petEquipFlags)if(f[key]===true)p[key]='1';
  if(has(f.repair_failed_times))p.repair_failed_times=integer(f.repair_failed_times,'修理失败次数',0,3);
  if(has(f.addon_status)){if(typeof f.addon_status!=='string'||f.addon_status.length>50||!/^[\u3400-\u9fffA-Za-z（）()·]+$/.test(f.addon_status))throw Error('套装效果格式无效');p.addon_status=f.addon_status;}
  if(!p.addon_status)delete p.include_can_cover_skill;
  for(const [min,max,label] of [['level_min','level_max','等级'],['price_min','price_max','价格']])if(has(p[min])&&has(p[max])&&Number(p[min])>Number(p[max]))throw Error('最低'+label+'不能高于最高'+label);
  return p;
 }
 const lingshiBasicFields={damage:'戒指·伤害',defense:'戒指·防御',magic_damage:'耳饰·法伤',magic_defense:'耳饰·法防',fengyin:'手镯·封印',anti_fengyin:'手镯·抗封',speed:'佩饰·速度'};
 const lingshiFilterFields=['price_min','price_max','equip_level_min','equip_level_max','kindid','basicType','basicValue','addedFront','addedBack','synthesizedType','synthesizedValue','suit_effect','suit_effect_level','jinglian_level','repair_fail','special_effect'];
 function lingshiBaseParams(filters){
  const f=filters||{},p={act:'recommd_by_role',page:'1',count:'15',search_type:'overall_search_lingshi',view_loc:'overall_search',equip_level_min:integer(has(f.equip_level_min)?f.equip_level_min:60,'最低灵饰等级',60,160),equip_level_max:integer(has(f.equip_level_max)?f.equip_level_max:160,'最高灵饰等级',60,160)};
  if(f.kindid?.length){if(!Array.isArray(f.kindid)||f.kindid.some(id=>!['61','62','63','64'].includes(String(id))))throw Error('灵饰类型无效');p.kindid=numericList(f.kindid,'灵饰类型');}
  for(const key of ['price_min','price_max'])if(has(f[key]))p[key]=priceCents(f[key]);
  if(has(f.basicType)){if(!Object.hasOwn(lingshiBasicFields,f.basicType))throw Error('灵饰基础属性无效');p[f.basicType]=integer(has(f.basicValue)?f.basicValue:1,'基础属性',0,10000);}else if(has(f.basicValue))throw Error('请选择基础属性类型');
  for(const [key,min,max] of [['addedFront',1,11],['addedBack',12,19]])if(f[key]!==undefined){if(!Array.isArray(f[key])||f[key].length>3)throw Error('每组最多选择三条附加属性');for(const id of f[key].filter(has)){const value=integer(id,'附加属性',min,max),param='added_attr.'+value;p[param]=String(Number(p[param]||0)+1);}}
  if(Object.keys(p).some(key=>key.startsWith('added_attr.')))p.added_attr_logic='detail';
  if(has(f.synthesizedType)){const id=integer(f.synthesizedType,'综合属性',1,19);p.synthesized_attr_total=JSON.stringify({[id]:integer(has(f.synthesizedValue)?f.synthesizedValue:1,'综合属性数值',0,999999)});}else if(has(f.synthesizedValue))throw Error('请选择综合属性类型');
  for(const [key,label,max] of [['jinglian_level','精炼等级',16],['repair_fail','修理失败次数上限',3],['suit_effect','套装效果',999],['suit_effect_level','套装等级',99]])if(has(f[key]))p[key]=integer(f[key],label,key==='suit_effect'?1:0,max);
  if(has(f.suit_effect_level)&&!has(f.suit_effect))throw Error('请选择套装效果');
  if(f.special_effect===true)p.special_effect='1';
  for(const [min,max,label] of [['equip_level_min','equip_level_max','等级'],['price_min','price_max','价格']])if(has(p[min])&&has(p[max])&&Number(p[min])>Number(p[max]))throw Error('最低'+label+'不能高于最高'+label);
  return p;
 }
 const yupoAttrIds=['101','102','103','104','105','106','107','108','109','201','202','203','204','205','206','207','208','209','210','211'];
 const yupoFilterFields=['price_min','price_max','equip_type','same_prop_cnt','special_teji','special_daoju','init_attrsType','init_attrsValue','base_attrs1Type','base_attrs1Value','base_attrs2Type','base_attrs2Value','total_attrsType','total_attrsValue','minghun_effectType','minghun_effectValue','minghun_level_min','include_ext_mh_lv'];
 function yupoBaseParams(f={}){
  const p={act:'recommd_by_role',page:'1',count:'15',search_type:'yupo_search',view_loc:'overall_search'};
  for(const key of ['price_min','price_max'])if(has(f[key]))p[key]=priceCents(f[key]);
  if(has(p.price_min)&&has(p.price_max)&&Number(p.price_min)>Number(p.price_max))throw Error('最低价格不能高于最高价格');
  for(const [key,allowed] of [['equip_type',['61717','61718']],['special_teji',Array.from({length:10},(_,i)=>String(61750+i))],['special_daoju',Array.from({length:12},(_,i)=>String(61738+i))]])if(f[key]!==undefined){if(!Array.isArray(f[key])||f[key].some(id=>!allowed.includes(String(id))))throw Error('上古玉魄选项无效');if(f[key].length)p[key]=numericList(f[key],'上古玉魄选项');}
  for(const key of ['init_attrs','base_attrs1','base_attrs2','total_attrs','minghun_effect']){
   const type=f[key+'Type'],value=f[key+'Value'];if(!has(type)){if(has(value))throw Error('请选择属性或特效类型');continue;}
   const allowed=key==='minghun_effect'?['1','4','5','6','7','8']:f.equip_type?.length===1?yupoAttrIds.filter(id=>String(f.equip_type[0])==='61718'?id.startsWith('2'):id.startsWith('1')):yupoAttrIds;
   if(!allowed.includes(String(type)))throw Error('属性或特效不适用于当前玉魄类型');
   const n=has(value)?value:1;let encoded;
   if(key==='minghun_effect'){const text=String(n);if(!/^\d+(?:\.\d)?$/.test(text)||Number(n)<=0||Number(n)>999)throw Error('特效数值必须大于0，最多保留一位小数');encoded=Math.round(Number(n)*10);}else encoded=Number(integer(n,'属性数值',1,999));
   p[key]=JSON.stringify({[type]:encoded});
  }
  if(has(f.same_prop_cnt))p.same_prop_cnt=integer(f.same_prop_cnt,'相同属性条目',1,2);
  if(has(f.minghun_level_min))p.minghun_level_min=integer(f.minghun_level_min,'灵尘等级',0,99);
  if(f.include_ext_mh_lv===true)p.include_ext_mh_lv='1';
  return p;
 }
 function supportsCategory(category){return ['装备','召唤兽','角色','召唤兽装备','灵饰','上古玉魄'].includes(category);}
 function normalizeServers(servers,{allowExcess=false}={}){
  if(!Array.isArray(servers))throw Error('服务器选择格式无效');
  const ids=new Set(servers.map(s=>integer(s.id,'服务器 ID',1,999999)));
  if(serverCatalog?.length&&ids.size===serverCatalog.length&&serverCatalog.every(id=>ids.has(String(id))))return [];
  if(!allowExcess&&ids.size>8)throw Error('部分区服搜索最多选择8个服务器，请缩小范围、拆分任务，或选择全服');
  return servers;
 }
 function buildPlans(task,{allowExcessServers=false}={}){
  if(!task||!supportsCategory(task.category))throw new Error('该品类尚未接入搜索');
  const selected=normalizeServers(task.servers,{allowExcess:allowExcessServers});
  const servers=new Map();for(const server of selected){const id=integer(server.id,'服务器 ID',1,999999);if(!servers.has(id))servers.set(id,{id,names:[]});const names=servers.get(id).names;if(!names.includes(String(server.name)))names.push(String(server.name));}
  if(!servers.size)servers.set('',{id:'',names:['全服']});
  const isPet=task.category==='召唤兽',isRole=task.category==='角色',isPetEquip=task.category==='召唤兽装备',isLingshi=task.category==='灵饰',isYupo=task.category==='上古玉魄',base=isYupo?yupoBaseParams(task.yupoFilters):isLingshi?lingshiBaseParams(task.lingshiFilters):isPetEquip?petEquipBaseParams(task.petEquipmentFilters):isRole?roleBaseParams(task.roleFilters):isPet?petBaseParams(task.petFilters):baseParams(task.equipmentFilters);
  const f=task.equipmentFilters||{};
  const ranges=isYupo?[[0,0]]:isLingshi?[[Number(base.equip_level_min),Number(base.equip_level_max)]]:isPet||isRole||isPetEquip?[[Number(base.level_min??(isPetEquip?5:0)),Number(base.level_max??(isPetEquip?145:isRole?175:180))]]:has(f.levelMin)||has(f.levelMax)?[[Number(integer(has(f.levelMin)?f.levelMin:60,'最低装备等级',60,160)),Number(integer(has(f.levelMax)?f.levelMax:160,'最高装备等级',60,160))]]:levelRanges(f.levels),plans=[];
  if(ranges.some(([min,max])=>min>max))throw Error('最低等级不能高于最高等级');
  for(const server of servers.values())for(const range of ranges)plans.push({server,levelRange:range,params:{...base,order_by:'price ASC',...(server.id?{serverid:server.id}:{}),...(isYupo?{}:isLingshi?{equip_level_min:String(range[0]),equip_level_max:String(range[1])}:{level_min:String(range[0]),level_max:String(range[1])})}});
  return plans;
 }
 function pagePlan(plan,page=1){return {...plan,params:{...plan.params,page:integer(page,'页码',1,Number.MAX_SAFE_INTEGER)}};}
 function nextPage(response,page,count=15){
  const pager=response.pager||{};
  if(has(pager.cur_page)&&Number(pager.cur_page)!==page)throw new Error(`分页异常：请求第 ${page} 页，官网返回第 ${pager.cur_page} 页，未搜完整`);
  if(has(pager.total_pages)){
   const total=Number(pager.total_pages);
   if(!Number.isSafeInteger(total)||total<0||total<page&&(response.equip_list.length>0||total!==0))throw new Error('官网返回的总页数无效，未搜完整');
   if(page>=total)return null;
   if(!response.equip_list.length)throw new Error('尚未到最后一页却返回空列表，未搜完整');
   return page+1;
  }
  // Without a pager, a full page may have a successor, even if it is the last nonempty page.
  return response.equip_list.length>=count?page+1:null;
 }
 function requestUrl(plan,now=Date.now()){return ENDPOINT+'?'+new URLSearchParams({callback:'cbg_raw_response',_:String(now),...plan.params}).toString();}
 function roleTaskError(tasks,task){if(policy.roleTaskLimit==null||!task.roleId)return "";const peers=tasks.filter(t=>t.roleId===task.roleId);return peers.findIndex(t=>t.id===task.id)>=policy.roleTaskLimit?`同一角色最多绑定${policy.roleTaskLimit}个任务，请删除多余任务或改绑其他角色`:"";}
 function roleEnabledTaskError(tasks,task){if(!task.roleId||!task.enabled)return '';return tasks.filter(t=>t.id!==task.id&&t.roleId===task.roleId&&t.enabled).length>=policy.roleEnabledTaskLimit?`同一角色最多开启${policy.roleEnabledTaskLimit}个任务，请先关闭其他任务`:'';}
 return {roleEnabledTaskError,normalizeRoleFilters,yupoFilterFields,yupoBaseParams,lingshiBasicFields,lingshiFilterFields,lingshiBaseParams,petEquipNumericFields,petEquipFlags,petEquipFilterFields,petEquipBaseParams,policy,roleTaskError,normalizeServers,ENDPOINT,attributeMap,roleNumericGroups,roleNumericFields,roleFilterFields,roleBaseParams,petNumericFields,petFilterFields,petBaseParams,supportsCategory,priceCents,levelRanges,baseParams,buildPlans,pagePlan,nextPage,requestUrl};
});
