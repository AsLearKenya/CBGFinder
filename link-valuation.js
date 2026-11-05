/* Public listing links and detail-to-listing conversion shared by browser and tests. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./search-results.js'):root.SearchResults,typeof module==='object'&&module.exports?require('./equipment-valuation.js'):root.EquipmentValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.LinkValuation=api;})(globalThis,function(R,V){
 'use strict';
 function parseLink(input){
  let url;try{url=new URL(String(input||'').trim());}catch{throw Error('请输入完整的藏宝阁商品详情链接');}
  if(!['https:','http:'].includes(url.protocol)||!['xyq.cbg.163.com','xyq-m.cbg.163.com'].includes(url.hostname)||url.port||url.username||url.password)throw Error('仅支持梦幻西游藏宝阁官网商品详情链接');
  let serverId,eid;const mobile=url.pathname.match(/^\/cgi\/mweb\/equip\/(\d{1,6})\/(\d{15}-\d+-[A-Za-z0-9]{1,40})\/?$/);
  if(mobile){serverId=mobile[1];eid=mobile[2];}
  else if(['/equip','/equip/','/cgi-bin/equip.py'].includes(url.pathname)){serverId=url.searchParams.get('s')||url.searchParams.get('serverid')||url.searchParams.get('server_id');eid=url.searchParams.get('eid');}
  if(!/^[1-9]\d{0,5}$/.test(serverId||'')||!/^\d{15}-\d+-[A-Za-z0-9]{1,40}$/.test(eid||''))throw Error('链接中缺少有效的商品编号或服务器编号');
  return {serverId:String(serverId),eid};
 }
 // Item-type prefixes come from the local official equipment catalog.
 // Kind IDs: https://cbg-xyq.res.netease.com/js/auto_search_config.js Female
 // armor/helm codes have independent prefixes; never infer category from stats.
 const KINDS={'10':'6','11':'14','12':'15','13':'9','14':'5','15':'10','16':'4','17':'12','18':'11','19':'8','20':'13','21':'7','22':'54','23':'52','24':'53','25':'17','26':'18','27':'19','28':'21','29':'20','55':'58','56':'59'};
 function item(detail,identity,{taskId,config={},serverName=''}={}){
  if(!['装备','角色','灵饰','上古玉魄'].includes(detail.category))throw Error('目前仅支持装备、灵饰、上古玉魄和角色估价');
  const raw={...(detail.listing||{}),accept_bargain:detail.market?.acceptBargain??detail.listing?.accept_bargain,eid:identity.eid,serverid:identity.serverId,equip_name:detail.name,equip_level:detail.level,price:Math.round(Number(detail.price)*100),server_name:detail.listing?.server_name||serverName,onsale_expire_time_desc:detail.market?.remaining||detail.listing?.onsale_expire_time_desc,large_equip_desc:detail.styledDescription};
  if(!Number.isFinite(raw.price)||raw.price<=0)throw Error('商品详情缺少有效挂牌价格，无法估价');
  if(['灵饰','上古玉魄','召唤兽装备'].includes(detail.category))return R.normalize(raw,{config,category:detail.category,taskId});
  if(detail.category==='角色'){
   const result=R.normalize({...raw,school:detail.roleInfo?.valuationData?.school,icon:''},{config,category:'角色',taskId});
   return {...result,name:detail.name,icon:detail.roleInfo?.icon||'',type:detail.roleInfo?.valuationData?.school||result.type,roleValuationData:detail.roleInfo?.valuationData,roleValuationDetailLoaded:true,roleReportDetails:typeof RoleValuationImage==='object'?RoleValuationImage.snapshot(detail,result):undefined};
  }
  const id=String(raw.equip_type||'');raw.kindid=raw.kindid||(raw.equip_gender==='女'&&id.startsWith('25')?'58':raw.equip_gender==='女'&&id.startsWith('26')?'59':KINDS[id.slice(0,-2)]);
  if(!raw.kindid)throw Error('官网详情缺少装备类型，无法安全匹配估价样本');
  const level=Number(raw.equip_level);if(level<60||level>160||level%10!==0)throw Error('当前装备估价支持60～160级装备');
  const source=R.text(detail.styledDescription||''),base=R.equipmentBreakdown(source),stat=name=>base.find(r=>r.label===name)?.total;
  const gems=Object.entries(V.GEM_TYPES).filter(([,v])=>(source.match(/镶嵌宝石[：:]?\s*([^\n]+)/)?.[1]||'').includes(v.name)).map(([id])=>id);
  const grade=Number(source.match(/锻炼等级\s*(\d+)/)?.[1]||raw.gem_level||0);
  if(raw.gem_value==null)raw.gem_value=gems;if(raw.gem_level==null)raw.gem_level=grade;
  const gemIds=R.tokens(raw.gem_value),totals=Object.fromEntries(base.map(r=>[r.label,r.total]));
  const set=(key,v)=>{if(raw[key]==null&&Number.isFinite(v))raw[key]=Number(v.toFixed(3));};
  set('shanghai',stat('伤害'));set('mingzhong',stat('命中'));set('defense',stat('防御'));set('lingli',stat('灵力'));set('qixue',stat('气血'));set('speed',stat('速度'));
  const fields={initialDamageExcludingHit:'init_damage_raw',initialDamageIncludingHit:'init_damage',initialSpirit:'init_wakan',initialDefense:'init_defense',initialHp:'init_hp',initialAgility:'init_dex'};
  const initials=Object.fromEntries(Object.entries(fields).filter(([,field])=>raw[field]!=null&&Number.isFinite(Number(raw[field]))).map(([key,field])=>[key,Number(raw[field])]));
  const restored=V.restoreInitialMetrics({gemIds,grade,kindId:raw.kindid,totals,initials});for(const [key,field] of Object.entries(fields))set(field,restored[key]);
  set('all_damage',Math.floor(stat('伤害')+stat('命中')/3));
  raw.agg_added_attrs=base.filter(r=>['力量','魔力','敏捷','体质','耐力'].includes(r.label)).map(r=>r.label+' '+(r.total>=0?'+':'')+r.total);
  if(!raw.icon&&id)raw.icon=id+'.gif';
  const result=R.normalize(raw,{config,category:'装备',taskId});
  // The current matcher also recognizes trait/suit names from the description.
  return result;
 }
 function weaponMetrics(item){
  const m=V.metrics(item),focus=V.attributeFocus(item),gems=item.valuationMeta?.gemIds||[],grade=item.valuationMeta?.grade;
  if(grade!==0&&gems.length)return [gems.every(id=>id==='2')?'initialDamageExcludingHit':'initialDamageIncludingHit'];
  if(focus.usage==='spell')return ['initialDamageExcludingHit'];if(focus.usage==='physical')return ['initialDamageIncludingHit'];
  if((m['addon:magic']||0)>0&&!(m['addon:power']>0))return ['initialDamageExcludingHit'];
  if((m['addon:power']||0)>0&&!(m['addon:magic']>0))return ['initialDamageIncludingHit'];
  return ['initialDamageExcludingHit','initialDamageIncludingHit'];
 }
 function filters(item){
  const f={types:[String(item.equipmentKindId)],levels:[Number(item.level)]};
  if(!['17','58','18','59','19','20','21'].includes(String(item.equipmentKindId))){const keys=weaponMetrics(item);f.automaticWeaponComparison=true;for(const key of keys){const v=V.metrics(item)[key];if(!Number.isFinite(v))throw Error('详情缺少武器比对所需属性');f[key]=v;}}
  return f;
 }
 return {parseLink,item,filters,weaponMetrics};
});
