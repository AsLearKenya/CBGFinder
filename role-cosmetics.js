/* Role appearance prices are user-adjustable references, independent of account base value. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./role-cosmetics-catalog.js'):root.RoleCosmeticsCatalog);if(typeof module==='object'&&module.exports)module.exports=api;else root.RoleCosmetics=api;})(globalThis,function(Catalog){
 'use strict';
 const KINDS={clothes:'锦衣',mounts:'祥瑞',widgets:'挂件',effects:'施法／攻击特效'};
 const clean=n=>String(n||'').trim().replace(/[.．]/g,'·').replace(/\s+/g,'').replace(/（(?:上衣|下衣|上装|下装|发饰|头饰|头|身)）|\((?:上衣|下衣|上装|下装|发饰|头饰|头|身)\)/g,'').replace(/浪淘沙/g,'浪淘纱').replace(/合鸣飘带|飘带扣鸣/g,'飘带合鸣');
 // Confirmed activity/faction gifts; exact names keep paid similarly named outfits intact.
 // Sources: xyq.163.com/2026/chunjie/ and xyq.yzz.cn/special/2024sjzlp/
 const FREE_CLOTHES=new Set(['齐天小圣','吕布狮头套','吕布醒狮头','舞狮头套','幺鸡头套','黄金幺鸡头套','萌芽发卡','影行轻衣','影行束发','巡骑护心','巡骑面甲']);
 const FREE_MOUNTS=new Set(['齐天小圣']);
 const isFree=(kind,name)=>kind==='clothes'&&FREE_CLOTHES.has(family(kind,name))||kind==='mounts'&&FREE_MOUNTS.has(family(kind,name));
 const key=(kind,name)=>kind+':'+clean(name);
 const price=(male,female=male)=>({male,female});
 const CLOTHES_PAIRS=['旃檀香/青蛇醉','许仙/白娘子','今何许/素心同'];
 function priceNames(kind,value){const n=clean(value),pair=kind==='clothes'&&CLOTHES_PAIRS.find(p=>n===p||n.startsWith(p+'·'));return pair?pair.split('/').map(part=>part+n.slice(pair.length)):[n];}
 function priceKeys(k){const at=k.indexOf(':');return priceNames(k.slice(0,at),k.slice(at+1)).map(n=>key(k.slice(0,at),n));}
 const HUNDRED_CLOTHES=['霞姿月韵','云龙梦','瑰梦潋·渔','绯雪织','鹿角弯弯·咩咩','碧华锦','落星织','羽仙歌','雪眸影','铃儿叮当','葫芦娃','星河乐章','喵绒绒','花间梦','花重云','夜之幽兰','夜之孤煞','女儿情','龙卷风','衔龙环','灼灼韶华','喜羊羊','巫山曲','幽蔷盛宴','旃檀香','青蛇醉','许仙','白娘子','驯龙高手','水云归'];
 const HUNDRED_MOUNTS=['幻·帝江','晓·白泽','幽·白泽','独角马','八部天龙马'];
 const hundredPrices=()=>Object.fromEntries([...HUNDRED_CLOTHES.map(n=>[key('clothes',n),price(100)]),...HUNDRED_MOUNTS.map(n=>[key('mounts',n),price(100)])]);
 function defaults(){return {defaultsRevision:2,defaultPrice:50,weaponDefaultPrice:50,mountDefaultPrice:50,widgetDefaultPrice:200,effectDefaultPrice:500,dyePrice:100,prices:{
  ...hundredPrices(),
  [key('clothes','青花瓷')]:price(67000,15000),[key('mounts','天使猪猪')]:price(14000,17000),[key('mounts','九尾冰狐')]:price(7000,9000),[key('mounts','黑猪')]:price(1000),
  [key('clothes','冰雪玉兔')]:price(1900,2900),[key('clothes','如意金箍棒')]:price(2000),[key('clothes','如意金箍棒·月白')]:price(300),[key('clothes','如意金箍棒·墨黑')]:price(300),
  [key('clothes','凤羽吉光')]:price(1000),[key('clothes','凤羽吉光·月白')]:price(500),[key('clothes','凤羽吉光·墨黑')]:price(500),[key('mounts','恶魔猪猪')]:price(1000),[key('effects','万物生长')]:price(2000),[key('widgets','飘带合鸣')]:price(10000),
  ...Object.fromEntries(['浪淘纱','冰寒绡','飞天舞'].map(n=>[key('clothes',n),price(300)])),
  ...Object.fromEntries(['群英·乱世惊鸿'].map(n=>[key('clothes',n),price(200)])),
  [key('clothes','盖世方天画戟')]:price(500),[key('clothes','玉振冰心')]:price(200),[key('clothes','鲛鲨水枪')]:price(200),
  ...Object.fromEntries(['浪淘纱','冰寒绡','飞天舞','盖世方天画戟','水云归','群英·乱世惊鸿'].flatMap(n=>['月白','墨黑'].map(d=>[key('clothes',n+'·'+d),price(['水云归','群英·乱世惊鸿'].includes(n)?300:200)]))),
  ...Object.fromEntries(['瑰梦潋','绯雪织','鹿角弯弯','碧华锦','落星织','羽仙歌','雪眸影','铃儿叮当','葫芦娃','星河乐章','喵绒绒','花间梦','花重云','夜之幽兰','夜之孤煞','衔龙环','灼灼韶华','喜羊羊','巫山曲','幽蔷盛宴','旃檀香','青蛇醉','许仙','白娘子','驯龙高手'].flatMap(n=>['月白','墨黑'].map(d=>[key('clothes',n+'·'+d),price(200)]))),
  ...Object.fromEntries(['鲨鱼','深海狂鲨','海豚恋人','幽骨战龙','飞天猪猪','冰晶魅灵'].map(n=>[key('mounts',n),price(500)]))
 },combos:[
  {id:'tianqing',name:'天青',members:[key('clothes','青花瓷'),key('mounts','天使猪猪')],...price(210000,85000)},
  {id:'bingqing',name:'冰青',members:[key('clothes','青花瓷'),key('mounts','九尾冰狐')],...price(65000,25000)},
  {id:'eqing',name:'恶青',members:[key('clothes','青花瓷'),key('mounts','恶魔猪猪')],...price(80000,20000)},
  {id:'ice-rabbit',name:'冰寒绡＋冰雪玉兔',members:[key('clothes','冰寒绡'),key('clothes','冰雪玉兔')],...price(2500,4000)}
 ]};}
 const validMoney=v=>typeof v!=='boolean'&&v!==''&&v!=null&&Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=100000000;
 const validKey=k=>typeof k==='string'&&/^(clothes|mounts|widgets|effects):[^<>\r\n]{1,100}$/.test(k);
 function settings(input=defaults()){
  if(!validMoney(input.defaultPrice)||!validMoney(input.dyePrice))throw Error('外观默认价格无效');
  const migrate=input.defaultsRevision!==2;
  const legacyDefault=migrate&&Number(input.defaultPrice)===100?50:Number(input.defaultPrice);
  const weaponDefaultPrice=input.weaponDefaultPrice??legacyDefault,mountDefaultPrice=input.mountDefaultPrice??legacyDefault,widgetDefaultPrice=input.widgetDefaultPrice??200,effectDefaultPrice=input.effectDefaultPrice??500;
  if(!validMoney(widgetDefaultPrice)||!validMoney(effectDefaultPrice))throw Error('挂件／特效默认价格无效');
  if(!validMoney(weaponDefaultPrice)||!validMoney(mountDefaultPrice))throw Error('武器锦衣／祥瑞默认价格无效');
  const prices=migrate?hundredPrices():{};for(const [k,p] of Object.entries(input.prices||{})){if(!validKey(k)||!validMoney(p?.male)||!validMoney(p?.female))throw Error('外观单件价格无效');for(const expanded of priceKeys(k)){if(expanded!==k&&Object.prototype.hasOwnProperty.call(input.prices,expanded))continue;prices[expanded]={male:Number(p.male),female:Number(p.female)};}}
  if(!Array.isArray(input.combos)||input.combos.length>100)throw Error('组合设置无效（最多100组）');
  const ids=new Set(),combos=input.combos.map(c=>{
   const members=[...new Set(c.members||[])];if(!/^[a-zA-Z0-9_-]{1,80}$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>80||members.length<2||members.length>30||members.some(k=>!validKey(k))||!validMoney(c.male)||!validMoney(c.female))throw Error('组合需有名称、至少两件不同外观及有效价格');ids.add(c.id);return {id:c.id,name:c.name.trim(),members,male:Number(c.male),female:Number(c.female)};
  });return {defaultsRevision:2,defaultPrice:legacyDefault,weaponDefaultPrice:Number(weaponDefaultPrice),mountDefaultPrice:Number(mountDefaultPrice),widgetDefaultPrice:Number(widgetDefaultPrice),effectDefaultPrice:Number(effectDefaultPrice),dyePrice:Number(input.dyePrice),prices,combos};
 }
 const optionNames={clothes:(Catalog.clothesOptions||[]).map(r=>r[1]),mounts:Catalog.mountOptions||[],widgets:(Catalog.widgetOptions||[]).map(r=>r[1]),effects:Catalog.effectOptions||[]};
 function isWeaponClothes(name,items=[]){
  const parts=items.map(garmentPart).filter(p=>p!==null);if(parts.length)return parts.includes('5');
  const f=family('clothes',name);return (Catalog.clothesOptions||[]).some(([id,n])=>family('clothes',n)===f&&((Number(id)>=14400&&Number(id)<15000)||(Number(id)>=92000&&Number(id)<93000)));
 }
 function defaultPriceFor(kind,name,cfg,items=[]){if(kind==='widgets')return Number(cfg.widgetDefaultPrice??200);if(kind==='effects')return Number(cfg.effectDefaultPrice??500);if(isFree(kind,name))return 0;if(kind==='mounts')return Number(cfg.mountDefaultPrice??cfg.defaultPrice);if(kind==='clothes')return Number(isWeaponClothes(name,items)?cfg.weaponDefaultPrice??cfg.defaultPrice:cfg.defaultPrice);return 0;}
 function options(kind){return [...new Set((optionNames[kind]||[]).flatMap(n=>priceNames(kind,n)))].map(name=>({key:key(kind,name),name,kind}));}
 const knownNames=Object.fromEntries(Object.keys(KINDS).map(k=>[k,new Set(options(k).map(o=>o.name))]));
 const aliases={mounts:{'炽·麒麟':'麒麟','炫·麒麟':'麒麟','晓·白泽':'白泽','幽·白泽':'白泽','鲲之大':'鲲',...Object.fromEntries(['金翅','玄宿','绯羽','岚冥','琼翎','紫霆','鎏月','青梧','九霄'].map(n=>[n+'凤凰','凤凰']))}};
 function family(kind,name){const n=clean(name).replace(/·(?:点星|点黛|月白|墨黑)(?=\(|（|$)/,'');if(aliases[kind]?.[n])return aliases[kind][n];const prefixes=[...(knownNames[kind]||[])].filter(base=>n===base||n.startsWith(base+'·')).sort((a,b)=>a.length-b.length);return prefixes[0]||n;}
 function dyedName(base,color){const at=base.search(/[（(]/);return at<0?base+'·'+color:base.slice(0,at)+'·'+color+base.slice(at);}
 function dye(name){const n=clean(name);return /·月白(?=[·(（]|$)/.test(n)?'月白':/·墨黑(?=[·(（]|$)/.test(n)?'墨黑':null;}
 const clothesIds=new Map();for(const [name,ids] of Object.entries(Catalog.limitedClothes||{})){const names=priceNames('clothes',name);for(const [index,id] of ids.entries())clothesIds.set(String(id),names.length===2?names[index%2]:names[0]);}
 const widgetIds=new Map(Object.entries(Catalog.widgetNames||{}));for(const [ids,n] of Catalog.widgetOptions||[])for(const id of String(ids).split(','))if(!widgetIds.has(id))widgetIds.set(id,n);
 function gender(raw){
  if(['男','male'].includes(raw.gender))return 'male';if(['女','female'].includes(raw.gender))return 'female';
  let n=Number(raw.iIcon);if(n>=1&&n<=72)n=(n-1)%12+1;else if(n>=201&&n<=272)n=(n-201)%24+201;
  return [1,2,5,6,9,10,201,205,209,212].includes(n)?'male':[3,4,7,8,11,12,203,207,208,211].includes(n)?'female':null;
 }
 function fromRaw(raw={}){
  const values=v=>v&&typeof v==='object'?Object.values(v):[],owned=v=>v&&typeof v==='object'?(v.count??v.num??1)>0:true;
  const clothes=raw.ExAvt===undefined?null:values(raw.ExAvt).filter(i=>i&&typeof i==='object'&&(clothesIds.has(String(i.iType))||Number(i.extra_info)===0&&([1,2,3,4,5].includes(Number(i.wear_pos))||i.wear_pos==null||isFree('clothes',i.cName)))).filter(i=>Number(i.extra_info)!==1).map(i=>({id:String(i.iType),name:priceNames('clothes',i.cName).length===1&&clean(i.cName)?clean(i.cName):clothesIds.get(String(i.iType))||'',limited:true,part:garmentPart(i)})).filter(i=>i.name);
  const mounts=raw.HugeHorse===undefined?null:values(raw.HugeHorse).filter(i=>i&&typeof i==='object').map(i=>({id:String(i.iType),name:clean(i.cName||Catalog.mountNames[i.iType]),limited:Number(i.nosale)===1||knownNames.mounts.has(clean(i.cName||Catalog.mountNames[i.iType]))||isFree('mounts',i.cName||Catalog.mountNames[i.iType])})).filter(i=>i.name&&i.limited);
  const widgets=raw.avt_widget===undefined?null:Object.entries(raw.avt_widget||{}).filter(([,v])=>v!==false&&v!==0).map(([id,v])=>({id,name:clean(widgetIds.get(id)||v?.name||v?.cName||'未知挂件 #'+id)}));
  const effects=raw.perform_effect===undefined?null:values(raw.perform_effect).filter(owned).map(i=>({name:clean(typeof i==='object'?i.name||i.cName||i.desc:i)})).filter(i=>i.name);
  return {gender:gender(raw),clothes,mounts,widgets,effects};
 }
 // Preserve detail metadata; dye completeness compares item counts within a single style.
 function garmentPart(item){
  const value=item.part??item.wear_pos;
  if(value!==null&&value!==undefined&&value!==''&&Number.isInteger(Number(value))&&Number(value)>=0)return String(Number(value));
  const name=String(item.cName||item.name||'');
  if(/[（(](?:上衣|上装)[）)]/.test(name))return '1';
  if(/[（(](?:下衣|下装)[）)]/.test(name))return '2';
  if(/[（(](?:发饰|头饰|头)[）)]/.test(name))return '3';
  return null;
 }
 function dyeCoverage(group,color){
  const perStyle=items=>{const counts=new Map();for(const item of items){const name=clean(item.name);counts.set(name,(counts.get(name)||0)+1);}return {count:Math.max(0,...counts.values()),styles:counts.size};};
  const base=perStyle(group.items.filter(i=>!dye(i.name)&&!/·(?:点星|点黛)/.test(clean(i.name))));
  const dyed=perStyle(group.items.filter(i=>dye(i.name)===color));
  return {complete:base.count>0&&dyed.count===base.count,owned:dyed.count,required:base.count,baseStyles:base.styles,dyeStyles:dyed.styles};
 }
 // Minimize package prices plus uncovered singles. Packages remain mandatory when matched:
 // choose a maximal compatible set, not the all-single price. Memoized graph components avoid
 // multiplying independent overlap decisions and keep disjoint packages independent.
 function choosePackages(packages,singlePrices){
  const n=packages.length;if(!n)return [];
  const bits=packages.map((_,i)=>1n<<BigInt(i)),neighbors=packages.map((a,i)=>packages.reduce((mask,b,j)=>i===j||a.families.some(f=>b.families.includes(f))?mask|bits[j]:mask,0n));
  const deltas=packages.map(p=>p.amountCents-p.families.reduce((sum,f)=>sum+(singlePrices.get(f)||0),0)),memo=new Map();
  const indices=mask=>bits.flatMap((b,i)=>mask&b?[i]:[]);
  function solve(mask){
   if(mask===0n)return {cost:0,selected:[]};if(memo.has(mask))return memo.get(mask);
   const left=indices(mask);let component=bits[left[0]],frontier=component;
   while(frontier){let next=0n;for(const i of indices(frontier))next|=neighbors[i]&mask;next&=~component;component|=next;frontier=next;}
   if(component!==mask){const a=solve(component),b=solve(mask&~component),r={cost:a.cost+b.cost,selected:[...a.selected,...b.selected]};memo.set(mask,r);return r;}
   const pivot=left.reduce((best,i)=>indices(neighbors[i]&mask).length<indices(neighbors[best]&mask).length?i:best,left[0]);let best=null;
   for(const i of indices(neighbors[pivot]&mask)){const rest=solve(mask&~neighbors[i]),candidate={cost:deltas[i]+rest.cost,selected:[i,...rest.selected]};if(!best||candidate.cost<best.cost)best=candidate;}
   memo.set(mask,best);return best;
  }
  return solve((1n<<BigInt(n))-1n).selected.map(i=>packages[i]);
 }
 function evaluate(data,cfg=defaults()){
  cfg=settings(cfg);const rows=[],groups=new Map(),gender=data?.gender,sexPrice=p=>gender==='female'?p.female:gender==='male'?p.male:Math.min(p.male,p.female),warnings=[];
  if(!data)return {totalCents:0,rows:[],missing:['锦衣','祥瑞','挂件','施法／攻击特效'],warnings:['未提供外观数据']};
  const missing=[];
  for(const kind of Object.keys(KINDS)){
   if(!Array.isArray(data[kind])){missing.push(KINDS[kind]);continue;}
   for(const item of data[kind]){const name=kind==='clothes'&&priceNames(kind,item.name).length>1?clothesIds.get(String(item.id))||'':clean(item.name);if(!name)continue;const f=family(kind,name),id=key(kind,f);if(!groups.has(id))groups.set(id,{id,kind,family:f,names:new Set(),items:[]});const g=groups.get(id);g.names.add(name);g.items.push(item);}
  }
  const available=new Set(),standalone=new Map(),singlePrices=new Map();
  for(const g of groups.values()){
   const ownRows=[],names=[...g.names];available.add(g.id);
   g.fullColors=new Set(['月白','墨黑'].filter(c=>dyeCoverage(g,c).complete));
   for(const n of names)if(g.kind!=='clothes'||!dye(n)||g.fullColors.has(dye(n)))available.add(key(g.kind,n));
   if(g.kind==='clothes'){
    const candidates=names.filter(n=>!dye(n)&&!/·(?:点星|点黛)/.test(n));candidates.push(g.family);
    const best=[...new Set(candidates)].map(n=>({name:n,value:cfg.prices[key(g.kind,n)]?sexPrice(cfg.prices[key(g.kind,n)]):defaultPriceFor(g.kind,n,cfg,g.items)})).sort((a,b)=>b.value-a.value)[0];
    ownRows.push({kind:g.kind,name:best.name,owned:names.join('、'),rule:isFree(g.kind,g.family)&&!cfg.prices[key(g.kind,best.name)]?'官方活动／阵营赠送，不计默认限量价':'同款服饰／上下装／多形态合并计一次',amountCents:Math.round(best.value*100),status:'included'});
    for(const color of ['月白','墨黑'])if(names.some(n=>dye(n)===color)){
     const coverage=dyeCoverage(g,color),p=cfg.prices[key('clothes',dyedName(g.family,color))],value=p?sexPrice(p):isFree(g.kind,g.family)?0:cfg.dyePrice;
     ownRows.push({kind:'dye',name:dyedName(g.family,color),owned:color+coverage.owned+'件／基础款'+coverage.required+'件'+(coverage.baseStyles>1?'（'+coverage.baseStyles+'种基础样式合并）':''),rule:coverage.complete?'同套不同样式不累计件数；染色与单套基础件数一致，增值计一次':'染色数量未与单套基础件数一致，按未染处理',amountCents:coverage.complete?Math.round(value*100):0,status:coverage.complete?'included':'incomplete'});
    }
   }else{
    const configured=[...new Set([...names,g.family])].map(name=>({name,p:cfg.prices[key(g.kind,name)]})).filter(x=>x.p),has=configured.length>0,best=has?configured.map(x=>({name:x.name,value:sexPrice(x.p)})).sort((a,b)=>b.value-a.value)[0]:{name:g.family,value:defaultPriceFor(g.kind,g.family,cfg,g.items)};
    ownRows.push({kind:g.kind,name:best.name,owned:names.join('、'),rule:has?'单独设置价格；染色／多形态取最高一次':isFree(g.kind,g.family)?'官方免费赠送，不计默认限量价':g.kind==='mounts'?'统一限量价；染色／多形态计一次':'默认'+KINDS[g.kind]+'单价；同款计一次',amountCents:Math.round(best.value*100),status:'included'});
   }
   standalone.set(g.id,ownRows);singlePrices.set(g.id,ownRows.reduce((sum,r)=>sum+r.amountCents,0));
  }
  const packages=cfg.combos.map(c=>({...c,members:c.members.map(k=>priceKeys(k).find(actual=>available.has(actual)))})).filter(c=>c.members.every(Boolean)).map(c=>({...c,amountCents:Math.round(sexPrice(c)*100),families:[...new Set(c.members.map(k=>{const at=k.indexOf(':');return key(k.slice(0,at),family(k.slice(0,at),k.slice(at+1)));}))]})).sort((a,b)=>a.id.localeCompare(b.id));
  const selected=choosePackages(packages,singlePrices),used=new Set(selected.flatMap(c=>c.families));
  for(const combo of selected)rows.push({kind:'combo',name:combo.name,owned:combo.members.map(k=>k.slice(k.indexOf(':')+1)).join('＋'),rule:'重叠组合比较组合价＋包外单件价，取较低总价；包内不重复计价',amountCents:combo.amountCents,status:'included',members:combo.members});
  for(const g of groups.values())if(used.has(g.id))rows.push({kind:g.kind,name:g.family,owned:[...g.names].join('、'),rule:'已计入组合包，不重复计价',amountCents:0,status:'bundled'});else rows.push(...standalone.get(g.id));
  if(!gender&&rows.some(r=>r.amountCents>0))warnings.push('未提供性别，男女差价项暂取较低值');
  return {totalCents:rows.reduce((n,r)=>n+r.amountCents,0),rows,missing,warnings};
 }
 return {KINDS,FREE_CLOTHES,FREE_MOUNTS,isFree,isWeaponClothes,defaultPriceFor,clean,key,priceNames,family,dye,options,defaults,settings,fromRaw,evaluate};
});
