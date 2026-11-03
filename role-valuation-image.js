/* Public role report, portrait rendering and clipboard export. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RoleValuationImage=api;})(globalThis,function(){
 'use strict';
 const text=v=>v==null?'':String(v).replace(/\s+/g,' ').trim();
 function cleanCarried(rows){return rows.map(r=>({...r,value:/(?:法宝|灵宝)$/.test(r.label)?r.value.split('、').filter(n=>!['法宝','灵宝','未知法宝','未知灵宝'].includes(n.trim())).join('、'):r.value})).filter(r=>r.value);}
 function portrait(value){const m=String(value||'').match(/^https:\/\/cbg-xyq\.res\.netease\.com\/images\/(?:bigface|role_icon\/small)\/(\d{1,6})\.gif$/);return m?'/api/role-portrait/'+m[1]:'';}
 const amount=v=>Number.isFinite(v)?'¥'+(v/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2}):'未确定';
 function snapshot(detail={},context={}){
  const info=detail.roleInfo||{},fields=rows=>(rows||[]).filter(r=>r&&r.label!=null&&r.value!=null).map(r=>({label:text(r.label),value:text(r.value)})),skills=rows=>(rows||[]).map(s=>text(s.name)+' '+text(s.level)+'级');
  const carriedEstimator=typeof module==='object'&&module.exports?require('./role-carried-valuation.js'):globalThis.RoleCarriedValuation;
  const saleMode=info.saleModeKnown?info.saleMode:context.roleSaleMode||(context.roleBadges?.includes('拆')?'split':context.roleBadges?.includes('整')?'whole':info.saleMode||'whole');
  return {saleMode,carriedItems:carriedEstimator?.extract({...detail,roleInfo:{...info,saleMode}})||[],portrait:portrait(info.icon),name:text(info.name),level:text(info.level||detail.level),stage:text(info.stage),market:{price:text(detail.price),id:text(detail.market?.id),status:text(detail.market?.status),remaining:text(detail.market?.remaining)},basic:fields(info.basic),combat:fields(info.combat),schoolSkills:skills(info.skills?.school),lifeSkills:skills(info.skills?.life),plotSkills:skills(info.skills?.plot),riders:(info.riders||[]).map(r=>text(r.name)+' '+fields(r.fields).map(f=>f.label+f.value).join(' ')),carried:cleanCarried(Object.entries(info.groups||{}).filter(([label,v])=>Array.isArray(v)&&v.length&&(saleMode!=='split'||!['拆卖道具','拆卖召唤兽'].includes(label))).map(([label,items])=>({label:text(label),value:items.map(i=>text(i.name)+(i.level!=null?' '+text(i.level)+'级':'')).join('、')})))};
 }
 function model(row,item={}){
  if(!row?.result)throw Error('角色估价尚未完成');const r=row.result,d=row.reportDetails||{},data=row.data||{},facts=[];
  const add=(label,value)=>{if(text(value))facts.push({label,value:text(value)});};
  add('角色',d.name||row.name);add('等级／门派',[d.level||data.level,data.school,d.stage].filter(Boolean).join(' · '));add('区服',[item.area,item.server||row.serverName].filter(Boolean).join(' · '));
  add('挂牌价格',item.priceDisplay?'¥'+item.priceDisplay:d.market?.price?'¥'+d.market.price:Number.isFinite(item.price)?'¥'+item.price:'');add('商品编号',d.market?.id||item.detailEid);add('状态／剩余',[d.market?.status||item.status,d.market?.remaining||item.remaining].filter(Boolean).join(' · '));
  const excluded=new Set(['名称','级别','已用潜能果数量','机缘属性','月饼粽子属性','新版乾元丹数量','成就点数']);
  const detailFields=[...(d.basic||[]),...(d.combat||[])].filter(f=>!excluded.has(f.label)),seen=new Set();
  const brief=detailFields.filter(f=>{if(seen.has(f.label))return false;seen.add(f.label);return true;});
  const skills=(key,fallback)=>d[key]?.length?d[key].join('、'):(data[fallback]||[]).map(s=>text(s.name)+' '+text(s.level)+'级').join('、');
  const character=[];
  for(const [label,keys] of [['战斗属性',['气血','魔法','命中','伤害','防御','速度','法伤','法防','灵力']],['人物属性',['体质','魔力','力量','耐力','敏捷','潜力']]]){const values=brief.filter(f=>keys.includes(f.label));if(values.length)character.push({label,value:values.map(f=>f.label+' '+f.value).join('　')});}
  if(Array.isArray(data.cultivation))character.push({label:'人物修炼',value:data.cultivation.map((v,i)=>['攻击','防御','法术','法抗'][i]+' '+(v==null?'未提供':v)).join('　')});
  for(const [label,key,fallback] of [['师门技能','schoolSkills','schoolSkills'],['生活技能','lifeSkills','lifeSkills']]){const value=skills(key,fallback);if(value)character.push({label,value});}
  if(d.plotSkills?.length)character.push({label:'剧情技能',value:d.plotSkills.join('、')});if(d.riders?.length)character.push({label:'坐骑',value:d.riders.join('；')});
  const baseRows=r.rows.map(x=>({label:x.label,value:x.value,price:x.status==='unpriced'?'未计入':x.amountCents<0?'−'+amount(x.actualDeductionCents||0):amount(x.amountCents),tone:x.amountCents<0?'negative':x.status==='unpriced'||x.amountCents===0?'muted':'normal',note:x.amountCents<0&&x.actualDeductionCents!==-x.amountCents?'理论扣款'+amount(-x.amountCents)+'，保护后扣'+amount(x.actualDeductionCents||0):''}));
  const appearance=r.cosmeticsBreakdown||{},cosmeticRows=(appearance.rows||[]).map(x=>({label:({combo:'组合包',clothes:'锦衣',mounts:'祥瑞',widgets:'挂件',effects:'施法／攻击特效',dye:'染色'}[x.kind]||'外观')+' · '+x.name,value:x.owned,price:x.status==='unpriced'?'未单独定价':x.status==='incomplete'?'未全染，不计价':x.status==='bundled'?'已含在组合中':amount(x.amountCents),tone:['unpriced','incomplete','bundled'].includes(x.status)||x.amountCents===0?'muted':'normal',note:['unpriced','incomplete','bundled'].includes(x.status)?x.rule:x.kind==='combo'?x.rule:''}));
  const notes=[...(r.warnings||[]),...(appearance.warnings||[]),...(appearance.missing?.length?['未提供外观资料：'+appearance.missing.join('、')]:[])];
  const carriedRows=(row.carried?.items||[]).map(i=>({label:i.name||row.reportDetails?.carriedItems?.[i.index]?.name||'携带物',value:(i.category||'')+(i.listedTarget?' · 独立挂牌'+amount(Math.round(i.listedTarget.price*100)):''),price:i.skipped?'不估价，不计入':i.estimateCents>=5000?amount(i.estimateCents):i.estimateCents!=null?'低于50元，不计入':'未估价',tone:i.skipped?'muted':i.estimateCents==null?'unestimated':!i.precise&&(i.rough||i.count>0&&i.count<5)?'rough':i.estimateCents>=5000?'normal':'muted',note:i.error||((i.count||0)+'件样本'+(i.precise?' · 精确估价':i.rough?' · 粗略估价':''))}));
  return {carriedRows,carriedValue:r.carriedCents||0,portrait:/^\/api\/role-portrait\/\d{1,6}$/.test(d.portrait||'')?d.portrait:portrait(item.icon),title:'角色估价',name:d.name||row.name||'角色',facts,character,baseRows,cosmeticRows,total:r.estimateCents,base:r.roleBaseCents,cosmetics:r.cosmeticsCents||0,rough:r.rough,formula:'底子 '+amount(r.subtotalCents)+' − 实际扣款 '+amount(r.actualDeductionCents)+' ＝ '+amount(r.roleBaseCents),protection:'理论扣款 '+amount(r.theoreticalDeductionCents)+' · 保护免扣 '+amount(r.protectedCents),carried:cleanCarried(d.carried||[]),notes,at:r.at};
 }
 function wrap(value,maxWidth,measure){
  const lines=[];for(const paragraph of String(value??'').split('\n')){let line='';for(const token of paragraph.match(/[A-Za-z0-9¥￥%.,_/-]+|[\s\S]/gu)||[]){if(line&&measure(line+token)>maxWidth){lines.push(line);line='';}if(measure(token)>maxWidth){for(const ch of Array.from(token)){if(line&&measure(line+ch)>maxWidth){lines.push(line);line=ch;}else line+=ch;}}else line+=token;}lines.push(line);}return lines.length?lines:[''];
 }
 const COLORS={ink:'#202b38',muted:'#657388',unpriced:'#9aa3af',accent:'#d85b2b',line:'#dce2e9',soft:'#f3f5f8',negative:'#c93b3b',warning:'#8c4b12',warningBg:'#fff2d9',rough:'#b77900',unestimated:'#c93b3b'};
 function layout(report,measure){
  const width=1120,margin=52,content=width-margin*2,commands=[];let y=48;
  const line=(value,x,top,size=19,color=COLORS.ink,bold=false)=>commands.push({type:'text',text:text(value),x,y:top,size,color,bold});
  const rect=(x,top,w,h,fill)=>commands.push({type:'rect',x,y:top,width:w,height:h,fill});
  const wrapped=(value,x,top,w,size=19,color=COLORS.ink,bold=false)=>{const lines=wrap(value,w,t=>measure(t,size,bold));for(const [i,t] of lines.entries())line(t,x,top+i*(size+9),size,color,bold);return lines.length*(size+9);};
  const section=title=>{y+=22;rect(margin,y,content,42,COLORS.soft);line(title,margin+14,y+9,22,COLORS.ink,true);y+=56;};
  const headerX=report.portrait?margin+114:margin;
  if(report.portrait)commands.push({type:'image',x:margin,y,width:92,height:92});
  y+=wrapped(report.title+' · '+report.name,headerX,y,width-margin-headerX,30,COLORS.ink,true)+7;
  const highlighted=report.facts.filter(f=>['区服','挂牌价格'].includes(f.label));
  for(const f of highlighted)y+=wrapped(f.label+'：'+f.value,headerX,y,width-margin-headerX,25,f.label==='挂牌价格'?COLORS.accent:COLORS.ink,true)+8;
  y+=12;const facts=report.facts.filter(f=>!['角色','区服','挂牌价格'].includes(f.label));
  for(let i=0;i<facts.length;i+=2){const row=facts.slice(i,i+2);let height=0;row.forEach((f,j)=>{height=Math.max(height,wrapped(f.label+'：'+f.value,margin+j*(content/2+8),y,content/2-24,19));});y+=height+8;}
  y+=12;rect(margin,y,content,112,COLORS.soft);const totals=[[report.rough?'参考估价（粗略）':'参考估价',report.total],['角色底子',report.base],['锦衣祥瑞及外观',report.cosmetics],...(report.carriedRows?.length?[['携带物',report.carriedValue]]:[])],boxWidth=content/totals.length;
  for(const [i,pair] of totals.entries()){line(pair[0],margin+20+i*boxWidth,y+17,18,COLORS.muted);line(amount(pair[1]),margin+20+i*boxWidth,y+51,30,i===0?(report.rough?COLORS.rough:COLORS.accent):COLORS.ink,true);}y+=132;
  if(report.character.length){section('角色资料');for(const f of report.character){line(f.label,margin,y,19,COLORS.muted,true);y+=wrapped(f.value,margin+120,y,content-120,19)+14;}}
  function table(title,rows,subtotal){
   section(title);const valueX=margin+290,priceX=margin+content-210;
   line('项目',margin+10,y,18,COLORS.muted);line('实际资料',valueX,y,18,COLORS.muted);line('估价',priceX,y,18,COLORS.muted);y+=34;
   for(const row of rows){
    const labelLines=wrap(row.label,260,t=>measure(t,18,true)),valueLines=wrap(row.value||'—',content-290-234,t=>measure(t,18,false)),priceLines=wrap(row.price,204,t=>measure(t,18,true)),noteLines=row.note?wrap(row.note,content-24,t=>measure(t,16,false)):[];
    const height=Math.max(labelLines.length,valueLines.length,priceLines.length)*27+20+(noteLines.length?noteLines.length*23+5:0),color=row.tone==='unestimated'?COLORS.unestimated:row.tone==='rough'?COLORS.rough:row.tone==='negative'?COLORS.negative:row.tone==='warning'?COLORS.warning:row.tone==='muted'?COLORS.unpriced:COLORS.ink;
    if(row.tone==='warning'||row.tone==='rough')rect(margin,y-6,content,height,COLORS.warningBg);
    labelLines.forEach((v,i)=>line(v,margin+10,y+i*27,18,color,true));valueLines.forEach((v,i)=>line(v,valueX,y+i*27,18,color));priceLines.forEach((v,i)=>line(v,priceX,y+i*27,18,color,true));
    let noteY=y+Math.max(labelLines.length,valueLines.length,priceLines.length)*27+2;noteLines.forEach((v,i)=>line(v,margin+12,noteY+i*23,16,row.tone==='unestimated'?COLORS.unestimated:row.tone==='rough'?COLORS.rough:row.tone==='negative'?COLORS.negative:row.tone==='muted'?COLORS.unpriced:COLORS.muted));y+=height;rect(margin,y-5,content,1,COLORS.line);
   }
   if(!rows.length){line('无可计价项目',margin+10,y,18,COLORS.muted);y+=38;}
   line('小计  '+amount(subtotal),margin+10,y+6,21,COLORS.ink,true);y+=46;
  }
  table('角色底子估价明细',report.baseRows,report.base);
  y+=wrapped(report.formula,margin,y,content,18,COLORS.muted);y+=wrapped(report.protection,margin,y,content,17,COLORS.muted)+8;
  table('锦衣祥瑞与外观明细',report.cosmeticRows,report.cosmetics);
  if(report.carriedRows?.length)table('携带物估价明细',report.carriedRows,report.carriedValue);
  if(report.carried.length){section(report.carriedRows?.length?'携带物概览':'携带物概览（不计入本次估价）');for(const f of report.carried){line(f.label,margin,y,18,COLORS.unpriced,true);y+=wrapped(f.value,margin+150,y,content-150,18,COLORS.unpriced)+12;}}
  if(report.notes.length){section('未覆盖／推算项');for(const n of report.notes)y+=wrapped('· '+n,margin,y,content,17,COLORS.muted)+7;}
  y+=20;rect(margin,y,content,1,COLORS.line);y+=20;y+=wrapped(report.carriedRows?.length?'估价合计＝角色底子＋锦衣祥瑞及外观＋已估价携带物。单件低于50元不计入；召唤兽与其他道具不计价。':'估价合计＝角色底子＋锦衣祥瑞及外观。携带物需手动估价后计入，召唤兽与其他道具不计价。',margin,y,content,16,COLORS.muted);
  return {width,height:Math.ceil(y+40),commands};
 }
 async function png(row,item={}){
  if(document.fonts?.ready)await document.fonts.ready;
  const report=model(row,item),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw Error('当前环境无法生成图片');
  const font=(size,bold)=>`${bold?'600':'400'} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  let avatar=null;if(report.portrait){avatar=new Image();avatar.src=report.portrait;try{await avatar.decode();}catch{throw Error('角色头像加载失败，请重试');}}
  const plan=layout(report,(value,size,bold)=>{ctx.font=font(size,bold);return ctx.measureText(value).width;});
  const scale=Math.min(2,32760/plan.height,Math.sqrt(30000000/(plan.width*plan.height)));canvas.width=Math.ceil(plan.width*scale);canvas.height=Math.ceil(plan.height*scale);ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,plan.width,plan.height);ctx.textBaseline='top';
  for(const c of plan.commands){if(c.type==='image'){if(avatar){const ratio=Math.min(c.width/avatar.naturalWidth,c.height/avatar.naturalHeight),width=avatar.naturalWidth*ratio,height=avatar.naturalHeight*ratio;ctx.drawImage(avatar,c.x+(c.width-width)/2,c.y+(c.height-height)/2,width,height);}}else if(c.type==='rect'){ctx.fillStyle=c.fill;ctx.fillRect(c.x,c.y,c.width,c.height);}else{ctx.fillStyle=c.color;ctx.font=font(c.size,c.bold);ctx.fillText(c.text,c.x,c.y);}}
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('图片生成失败');return {blob,width:canvas.width,height:canvas.height,report};
 }
 return {snapshot,model,layout,wrap,png,portrait};
});

if(typeof document!=='undefined'){
 let roleImageUrl='',roleImageBlob=null,roleImageGeneration=0;
 function copyRoleImage(pending){
  if(window.desktopClipboard?.writeImage)return pending.then(async blob=>{const result=await window.desktopClipboard.writeImage(await blob.arrayBuffer());if(!result?.ok)throw Error(result?.message||'剪贴板写入失败');});
  if(navigator.clipboard?.write&&typeof ClipboardItem!=='undefined')return navigator.clipboard.write([new ClipboardItem({'image/png':pending})]);
  return Promise.reject(Error('当前环境不支持复制图片，请使用桌面版或支持图片剪贴板的浏览器'));
 }
 async function generateRoleValuationImage(taskId,id,button){
  const row=roleValuationRow(taskId,id),run=valuationRunById(taskId),item=roleValuationItems(taskId,run).find(i=>i.id===id)||{};
  if(!row){toast('请先完成角色估价');return;}const generation=++roleImageGeneration;if(button){button.disabled=true;button.textContent='生成中…';}
  try{const pending=RoleValuationImage.png(row,item);const copied=copyRoleImage(pending.then(output=>output.blob));const [output]=await Promise.all([pending,copied]);if(generation!==roleImageGeneration)return;if(roleImageUrl)URL.revokeObjectURL(roleImageUrl);roleImageBlob=output.blob;roleImageUrl=URL.createObjectURL(output.blob);
   openModal(`<div class="modal-head"><h2 id="dialog-title">图片已复制到剪贴板</h2><div class="role-valuation-actions"><button type="button" class="button secondary" data-role-image-back-task="${esc(taskId)}" data-role-image-back-item="${esc(id)}">返回估价</button><button type="button" class="button primary" data-role-image-copy>再次复制图片</button><button class="icon-button" data-action="close" aria-label="关闭">${icon('close')}</button></div></div><div class="role-image-preview"><img src="${esc(roleImageUrl)}" alt="${esc(output.report.name)}的角色资料与估价长图"></div>`,'role-image-modal');toast('图片已复制，可直接粘贴');
  }catch(error){toast('生成图片失败：'+error.message);}finally{if(button){button.disabled=false;button.textContent='生成图片';}}
 }
 document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.roleImageTask){event.preventDefault();void generateRoleValuationImage(b.dataset.roleImageTask,b.dataset.roleImageItem,b);}else if(b.hasAttribute('data-role-image-copy')){void copyRoleImage(Promise.resolve(roleImageBlob)).then(()=>toast('图片已复制，可直接粘贴')).catch(error=>toast('复制图片失败：'+error.message));}else if(b.dataset.roleImageBackTask)openRoleValuation(b.dataset.roleImageBackTask,b.dataset.roleImageBackItem);else if(b.dataset.action==='close')roleImageGeneration++;});
 window.addEventListener('beforeunload',()=>{if(roleImageUrl)URL.revokeObjectURL(roleImageUrl);});
}
