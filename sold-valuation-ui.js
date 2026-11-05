function soldSamplesForTask(task,target){
 if(typeof taskChangeStore==='undefined')return [];
 const ids=new Set([task.parentTaskId||task.id,...state.tasks.filter(t=>t.category===task.category).map(t=>t.id)]),rows=[];
 const buyer=typeof availableRoles==='undefined'?null:availableRoles.find(r=>r.id===task.roleId)?.server?.id;
 for(const id of ids)for(const row of taskChangeStore.peek(id).soldHistory||[]){const item=row.item;if(row.priceCents===20000&&(!buyer||String(item.serverId)!==String(buyer)))continue;if(target&&item.kind!==target.kind)continue;if(buyer&&String(item.serverId)!==String(buyer)&&!(item.valuationMeta?.crossFeeCents>0))continue;rows.push(row);}
 return rows;
}
function withSoldValuation(task,row){return typeof SoldValuation==='object'?SoldValuation.apply(row,task,soldSamplesForTask(task,row?.target)):row;}
function soldValuationEvidenceHtml(row,task){
 if(!row.precise||!row.soldEvidence?.length)return '';
 return `<section class="valuation-sold-evidence"><h3>已售出价格佐证</h3><div class="valuation-mean-formula">精确估价 = min(计算估价 ${valuationAmount(row.calculatedEstimateCents)}, 已售出商品标价 ${valuationAmount(row.soldReferenceCents)}) × 95% = <strong>${valuationAmount(row.estimateCents)}</strong></div><p class="setting-help">官网已确认售出；采用最后记录的挂牌价，不代表实际成交价。属性按当前规则匹配；已售出标价不得低于计算估价的80%，高价不限。</p><div class="valuation-evidence-grid">${row.soldEvidence.map(ref=>{const item=ref.item,detail={name:item.name,category:item.kind==='pet-equipment'?'召唤兽装备':item.kind==='yupo'?'上古玉魄':item.kind==='lingshi'?'灵饰':'装备',styledDescription:item.description||'',sections:[]};return `<article class="valuation-evidence-sample"><header><strong>${esc(item.name)}</strong><span>${esc(item.server||valuationServerName(item.serverId))}</span>${ProductActions.render({...item,taskId:task.id})}</header><p>已售出 · 最后标价 ${valuationAmount(ref.priceCents)} · ${dateTime(ref.confirmedAt)}核对</p>${EquipmentDisclosure.renderDetail(detail)}<table class="valuation-comparison-table"><thead><tr><th>属性</th><th>本件商品</th><th>已售出商品</th></tr></thead><tbody>${ref.comparison.map(r=>`<tr><th>${esc(r.label)}</th><td>${esc(r.target)}</td><td>${esc(r.sample)}</td></tr>`).join('')}</tbody></table></article>`;}).join('')}</div></section>`;
}
