(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./role-valuation-costs.js'):root.RoleValuationCosts,typeof module==='object'&&module.exports?require('./role-cosmetics.js'):root.RoleCosmetics);if(typeof module==='object'&&module.exports)module.exports=api;else root.RoleValuation=api;})(globalThis,function(Costs,Cosmetics){
 'use strict';
 const VERSION=16,STORAGE_KEY='cbg:role-valuation-settings:v1';
 const GAME_RULES=Object.freeze({edition:'2026',fortuneMax:69});
 const PET={0:0,5:50,6:65,7:80,8:120,9:150,10:200,11:250,12:300,13:380,14:430,15:500,16:580,17:650,18:780,19:880,20:1000,21:1150,22:1320,23:1500,24:1750,25:2000};
 const CULT_EXP=[0,150,360,650,1040,1550,2200,3010,4000,5190,6600,8250,10160,12350,14840,17650,20800,24310,28200,32490,37200,42350,47960,54050,60640,67750];
 const STRONG={10:50,20:100,21:110,22:120,23:130,24:150,25:160,26:180,27:190,28:210,29:230,30:250,31:270,32:290,33:310,34:330,35:360,36:380,37:410,38:440,39:470,40:500,41:550,42:600,43:650,44:700,45:750,46:800,47:880,48:1000,49:1150,50:1300,51:1500,52:1700,53:1900,54:2100,55:2300,56:2500,57:2700,58:2900,59:3100,60:3300};
 const PACKS={129:[[15,10,900],[20,15,1400],[21,15,1750],[21,20,1850],[21,21,2100]],159:[[20,15,2300],[20,20,2650],[25,20,3700],[25,25,4600]],175:[[20,20,3650],[25,20,4550],[25,25,5400]]};
 const KEY_FOUR=['重明战鼓','凌波仙符','河图洛书','苍灵雪羽','落星飞鸿','归元圣印'];
 const SCHOOL_TREASURE={'大唐官府':['干将莫邪'],'化生寺':['慈悲'],'女儿村':['曼陀罗'],'方寸山':['救命毫毛'],'天宫':['伏魔天书'],'普陀山':['普渡'],'龙宫':['镇海珠'],'五庄观':['奇门五行令'],'狮驼岭':['失心钹'],'魔王寨':['五火神焰印'],'阴曹地府':['九幽'],'盘丝洞':['忘情'],'神木林':['月影'],'凌波城':['斩魔'],'无底洞':['金蟾']};
 const numeric=v=>v!==null&&v!==undefined&&v!==''&&typeof v!=='boolean'&&Number.isFinite(Number(v));
 const level=(v,max)=>numeric(v)&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=max;
 const money=v=>Math.round(v*100),round=v=>Math.round(v*100)/100;
 function defaults(){return {version:1,goldPrices:{},cosmetics:Cosmetics.defaults()};}
 function settings(input=defaults()){
  if(input?.version!==1)throw Error('角色估价设置版本无效');
  const goldPrices={};for(const [id,value] of Object.entries(input.goldPrices||{})){if(!/^\d{1,8}$/.test(id)||!numeric(value)||Number(value)<=0||Number(value)>100000)throw Error('服务器金价无效');goldPrices[id]=Number(value);}
  return {version:1,goldPrices,cosmetics:Cosmetics.settings(input.cosmetics||Cosmetics.defaults())};
 }
 function load(storage){const raw=storage.getItem(STORAGE_KEY);return raw===null?defaults():settings(JSON.parse(raw));}
 function save(storage,value){const s=settings(value);storage.setItem(STORAGE_KEY,JSON.stringify(s));return s;}
 function band(value){return [175,159,129,109,89,69].find(n=>Number(value)>=n)||null;}
 function interpolate(points,n){const p=[...points].sort((a,b)=>a[0]-b[0]);if(n<=p[0][0])return p[0][1];if(n>=p.at(-1)[0])return p.at(-1)[1];const i=p.findIndex(r=>r[0]>=n),[a,b]=[p[i-1],p[i]];return a[1]+(b[1]-a[1])*(n-a[0])/(b[0]-a[0]);}
 function petPrice(n){if(!level(n,25))return null;if(n<5)return 50*CULT_EXP[n]/CULT_EXP[5];return PET[n];}
 function singlePrice(n,kind='main'){
  if(!level(n,25))return null;const ratio=kind==='main'?3/7:2/7;
  const points=[[0,0],[9,220*ratio],[13,580*ratio],[17,850*ratio],[21,2100*ratio]];
  const value20=interpolate(points.map(([lv,v])=>[petPrice(lv),v]),PET[20]);points.push([25,value20+(kind==='main'?1050:450)]);
  return interpolate(points.map(([lv,v])=>[petPrice(lv),v]),petPrice(n));
 }
 function strongPrice(n){return level(n,60)?n<10?0:n<20?50:STRONG[n]:null;}
 const cost=(kind,n)=>interpolate(Object.entries(Costs[kind]).map(([k,v])=>[Number(k),v]),n);
 function lifePrice(n){if(!level(n,160))return null;return n>=160?150:n>=140?100:n>=120?50:0;}
 function danPrice(n,grade){if(!level(n,9))return null;return grade===129&&n>=5?400:grade===159&&n>=7?400:grade===175&&n>=9?300:0;}
 function fromListing(raw={},config={}){
  const num=k=>numeric(raw[k])?Number(raw[k]):null;
  return {level:num('equip_level'),school:config.school_info?.[raw.school]||null,cultivation:['expt_gongji','expt_fangyu','expt_fashu','expt_kangfa'].map(num),petCultivation:['bb_expt_gongji','bb_expt_fangyu','bb_expt_fashu','bb_expt_kangfa'].map(num),experienceBillions:num('sum_exp'),niceIdType:num('is_niceid_new')};
 }
 function evaluate(data={},context={},prefs=defaults()){
  const cfg=settings(prefs),rows=[],warnings=[],deductions=[];let positive=0,critical=false;
  function add(key,label,value,rule,amount=0){const cents=money(amount),row={key,label,value:String(value??''),rule,amountCents:cents,status:cents<0?'deduction':'included'};rows.push(row);if(cents<0)deductions.push(row);else positive+=cents;return row;}
  function unknown(key,label,rule='官网未提供，未计入',value='未提供'){rows.push({key,label,value:String(value),rule,amountCents:0,status:'unpriced'});warnings.push(label+'：'+rule);}
  const grade=level(data.level,175)?band(data.level):null;
  const c=data.cultivation||[],validCult=c.length===4&&c.every(n=>level(n,25));
  let main,def,anti,base=0;
  if(!grade){unknown('base','等级／人修基准','仅支持 69～175 级角色');critical=true;}
  else if(!validCult){unknown('base','等级／人修基准','缺少完整人物修炼数据');critical=true;}
  else{
   main=Math.max(c[0],c[2]);def=c[1];anti=c[3];const singles=singlePrice(main)+singlePrice(def,'resistance')+singlePrice(anti,'resistance');
   const pack=(PACKS[grade]||[]).find(([m,r])=>m===main&&r===def&&r===anti);
   base=grade===69?700:pack?pack[2]:grade===175?Math.max(3500,singles+1925):grade===159?singles+925:singles;
   add('base','等级／人修基准',`${data.level}级 → ${grade}档；主修${main}／防御${def}／抗法${anti}`,grade===69?'七修9打包基准700，缺项最后扣；三修9拆价220':pack?'采用已确认成套价':`主修${round(singlePrice(main))}＋防御${round(singlePrice(def,'resistance'))}＋抗法${round(singlePrice(anti,'resistance'))}${grade>=159?'＋等级／已含宠修调整':''}；按3∶2及宠修曲线推算${grade===175?'，175基准不低于3500元':''}`,base);
   if(grade===69){const actual=singlePrice(Math.min(main,9))+singlePrice(Math.min(def,9),'resistance')+singlePrice(Math.min(anti,9),'resistance');if(actual<220)add('cult-short','人修缺口',`满档三修9；实际${main}／${def}／${anti}`,'按220元三修部分倒扣，最后受1000元保护',actual-220);}
   if(!pack&&grade!==69)warnings.push('人修组合使用曲线推算，供粗略参考');
  }
  const pet=data.petCultivation||[],petKnown=pet.length===4&&pet.every(n=>level(n,25));
  if(petKnown){const names=['攻击控制力','防御控制力','法术控制力','抗法控制力'];pet.forEach((n,i)=>{let amount=petPrice(n),rule='按宠修详表单项计价';if(grade===69){amount=n<=9?(amount-150)*.8:amount-150;rule='七修9已含该项120元；9修内缺口按打包80%倒扣，超9部分按详表追加';}else if(grade>=159){amount-=200;rule='等级基准已含该项10修200元，按详表补差';}add('pet-'+i,'宠修 · '+names[i],n+'级',rule,amount);});}else unknown('pet','宝宝修炼','缺少完整四项宠修数据，未推断为零');
  if(numeric(data.mountGrowth)&&data.mountGrowth>=0)add('mount','坐骑成长',data.mountGrowth,'≥2.35加200；≥2.3加100；其余0',data.mountGrowth>=2.35?200:data.mountGrowth>=2.3?100:0);else unknown('mount','坐骑成长');
  if(numeric(data.fortune)&&numeric(data.festivalPoints)){const total=Number(data.fortune)+Number(data.festivalPoints),gap=Math.max(0,GAME_RULES.fortuneMax-total);add('fortune','机缘／月饼粽子',`${total}／${GAME_RULES.fortuneMax}，缺${gap}点`,'缺0～6点加500；缺7～9点加450；其余0',gap<=6?500:gap<=9?450:0);}else unknown('fortune','机缘／月饼粽子','缺少机缘或月饼粽子字段');
  if(level(data.potentialFruit,200))add('fruit','潜能果',data.potentialFruit+'个','不足100个扣50；达到100不加不扣',data.potentialFruit<100?-50:0);else unknown('fruit','潜能果');
  if(Array.isArray(data.schoolSkills)){
   const usable=data.schoolSkills.filter(s=>level(s.level,180));let amount=0,rule='该等级档师门技能不单独加价';
   if(grade===175){const progress=usable.reduce((sum,s)=>sum+(s.level<=150?0:cost('school',s.level)/cost('school',180)),0);amount=interpolate([[0,0],[1,700],[2,1300],[3,1800],[4,2200]],progress);rule='按150～180技能消耗完成度，套用700／1300／1800／2200曲线，最高暂计2200';if(usable.filter(s=>s.level===180).length>=5)warnings.push('5项及以上180：缺少同服化圣裸号上限，暂按4项2200元封顶');}
   add('school','师门技能',usable.map(s=>s.name+' '+s.level).join('、')||'无已学技能',rule,amount);
  }else unknown('school','师门技能');
  if(Array.isArray(data.lifeSkills)){
   const life=new Map(data.lifeSkills.map(s=>[String(s.id),s]));const find=id=>life.get(String(id))?.level??0;
   for(const [id,label] of [['230','强壮'],['237','神速']]){const n=find(id),p=strongPrice(n);if(p===null)unknown(id,label,'等级数据无效');else add(id,label,n+'级','按详表；1～9为0；10～19按10级50元',p);}
   const body=find('201');add('body','强身术',body+'级','不足120扣50；其余0',body<120?-50:0);
   const four=['204','205','207','231'],bundle=four.every(id=>find(id)>=160);
   if(bundle)add('four','四打160','打造／裁缝／炼金／淬灵均160','成套500，覆盖四项单独计价',500);
   for(const skill of data.lifeSkills.filter(s=>!['201','230','237'].includes(String(s.id))&&!(bundle&&four.includes(String(s.id))))){const p=lifePrice(skill.level);if(p===null){unknown('life-'+skill.id,skill.name,'等级无有效计价档');continue;}add('life-'+skill.id,'生活 · '+skill.name,skill.level+'级','120／140／160分别50／100／150；向下取档，不插值',p);}
   const limits={'201':140,'202':140,'203':160,'204':160,'205':160,'206':160,'207':160,'208':160,'209':160,'210':160,'211':160,'212':160,'216':160,'217':160,'218':120,'230':60,'231':160,'237':60,'239':20,'240':20,'241':20};
   const mastery=Object.entries(limits).every(([id,max])=>find(id)>=max);add('mastery','融会贯通',mastery?'满足全部已知辅助技能满级':'未达成','达成加2000，强壮神速不在生活技能中重复计算',mastery?2000:0);
  }else{unknown('life','生活技能');unknown('230','强壮');unknown('237','神速');}
  if(level(data.dan,9))add('dan','乾元丹',data.dan+'颗',`${grade===175?'九丹300':grade===159?'七丹400':grade===129?'五丹400':'该档不额外计价'}，未达门槛计0，不插值`,danPrice(data.dan,grade));else unknown('dan','乾元丹');
  if(level(data.hunting,25))add('hunt','猎术',data.hunting+'级','向下取档：＜15为0；15～19为100；≥20为300',data.hunting>=20?300:data.hunting>=15?100:0);else unknown('hunt','猎术');
  if(numeric(data.xianyu)&&data.xianyu>=0)add('xianyu','仙玉',data.xianyu+'点','角色余额按0.05元／点，折后不足50元不计',data.xianyu>=1000?data.xianyu*.05:0);else unknown('xianyu','仙玉');
  if(numeric(data.reserve)&&data.reserve>=0)add('reserve','储备金',data.reserve+'两','达到2000万计入；余额÷3000万×100元（已含折价）',data.reserve>=20000000?data.reserve/30000000*100:0);else unknown('reserve','储备金');
  if(Array.isArray(data.treasures)){
   const treasures=[...new Map(data.treasures.map(t=>[t.id,t])).values()],full=t=>numeric(t.layer)&&numeric(t.grade)&&t.layer>=[0,9,12,15,18][t.grade];
   const keys=Number(data.level)>=100?[['月光宝盒／灵光宝匣',['月光宝盒','灵光宝匣']],...(SCHOOL_TREASURE[data.school]||[]).map(name=>[name,[name]])]:[];
   if(Number(data.level)>=100&&!SCHOOL_TREASURE[data.school])warnings.push('该门派专属关键法宝名单尚未确定，未推断缺失扣款');
   for(const [label,names] of keys){const owned=treasures.filter(t=>names.includes(t.name));if(owned.some(full))add('key-'+label,'关键法宝 · '+label,'已拥有满层','满足，不扣款');else if(owned.some(t=>!numeric(t.layer)))unknown('key-'+label,'关键法宝 · '+label,'有法宝但层数未提供，不推断缺失');else add('key-'+label,'关键法宝 · '+label,owned.length?'未满层':'未拥有','缺失或未满层扣50；替代法宝不重复扣',-50);}
   for(const t of treasures.filter(t=>t.grade===4&&t.identified!==false)){
    if(grade===109)add('treasure-'+t.id,'四级法宝 · '+t.name,t.layer===null?'层数未提供':t.layer+'层','109档每件50，不要求满层',50);
    else if(grade>=129&&KEY_FOUR.includes(t.name)){if(!numeric(t.layer))unknown('treasure-'+t.id,'四级法宝 · '+t.name,'未提供层数，满层增值未计');else add('treasure-'+t.id,'四级法宝 · '+t.name,t.layer+'层','满层重明战鼓／凌波仙符30；其余指定法宝10',full(t)?['重明战鼓','凌波仙符'].includes(t.name)?30:10:0);}
   }
   for(const t of treasures.filter(t=>t.identified===false))unknown('treasure-unknown-'+t.id,t.name,'名称未识别，未计入法宝增值');
   if(!treasures.some(t=>t.grade===4))add('treasure-none','四级法宝增值','无四级法宝','该项0元');
  }else unknown('treasures','关键法宝／四级法宝','未提供完整法宝列表，不推断缺失扣款');
  if(numeric(data.niceIdType)||data.niceIdText!==null&&data.niceIdText!==undefined){const gold=Number(data.niceIdType)>=2||/土豪金/.test(data.niceIdText||'');add('nice-id','土豪金',gold?'有':'无','真实标识加700；不计算稀有号码另行溢价',gold?700:0);}else unknown('nice-id','土豪金');
  if(numeric(data.experienceBillions)&&data.experienceBillions>=0)add('experience','千亿经验',data.experienceBillions+'亿','≥1000亿加1500，仅计一次；未估领取奖励物品',data.experienceBillions>=1000?1500:0);else unknown('experience','千亿经验');
  if(numeric(data.achievement)&&data.achievement>=0)add('achievement','成就点',data.achievement+'点','≥4800加500；更高不重复加',data.achievement>=4800?500:0);else unknown('achievement','成就点');
  if(Array.isArray(data.artifact)){let best=0,desc='未达到图示档位';for(const a of data.artifact){const water=a.waterSlots===12,fire=a.fireSlots===12,p=water&&a.waterValue>=91?1400:fire&&a.fireValue>=91?1000:water||fire?600:0;if(p>best){best=p;desc=water?`12水，属性${a.waterValue}`:`12火，属性${a.fireValue}`;}}add('artifact','神器',desc,'图示档位：12水／火600；91水1400；91火1000；只取最高一套，不另估灵犀玉',best);}else unknown('artifact','神器','未提供可识别的永久神器方案');
  if(Number(data.ascension)>0)warnings.push('化圣层数溢价未设置；当前仅给角色基础估价');
  if(Number(data.level)!==grade&&grade)warnings.push(`人物等级${data.level}向下使用${grade}档`);
  if(grade>=129&&(!numeric(data.stage)||Number(data.stage)<(grade>=159?2:1)))warnings.push('飞升／渡劫状态与基准档不一致，该部分仅粗略参考');
  const theoretical=deductions.reduce((sum,r)=>sum-r.amountCents,0),actual=Math.min(theoretical,Math.max(0,positive-100000));
  let budget=actual;for(const row of deductions){row.actualDeductionCents=Math.min(-row.amountCents,budget);budget-=row.actualDeductionCents;}
  const appearance=Cosmetics.evaluate(data.cosmetics,cfg.cosmetics),roleBaseCents=critical?null:positive-actual;
  return {version:VERSION,band:grade,rows,warnings:[...new Set(warnings)],rough:warnings.length>0||rows.some(r=>r.status==='unpriced')||appearance.missing.length>0,roleBaseCents,cosmeticsCents:appearance.totalCents,cosmeticsBreakdown:appearance,estimateCents:critical?null:roleBaseCents+appearance.totalCents,subtotalCents:positive,theoreticalDeductionCents:theoretical,actualDeductionCents:actual,protectedCents:theoretical-actual,excluded:['装备、灵饰','召唤兽、孩子','携带材料／道具','房屋与家具','烟花区溢价'],at:context.at??Date.now()};
 }
 return {VERSION,GAME_RULES,STORAGE_KEY,PET,STRONG,KEY_FOUR,SCHOOL_TREASURE,defaults,settings,load,save,band,petPrice,singlePrice,strongPrice,lifePrice,danPrice,fromListing,evaluate};
});
