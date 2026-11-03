/* Carried items have no independent asking price or listing-age ceiling. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./link-valuation.js'):root.LinkValuation);if(typeof module==='object'&&module.exports)module.exports=api;else root.RoleCarriedValuation=api;})(globalThis,function(Link){
 'use strict';
 function extract(detail){return (detail?.roleInfo?.children||[]).filter(d=>d.carriedItem&&(!d.split||detail.roleInfo?.saleMode!=='split')&&['装备','灵饰','上古玉魄'].includes(d.category)).filter(d=>{try{build(d,{serverId:'149',detailEid:'202610232200113-149-CARRIED',id:'probe'},'probe',0);return true;}catch{return false;}});}
 function build(detail,parent,taskId,index,config={},independent=null){
  // A sentinel only satisfies the shared converter's price validation. It is
  // never shown as an asking price and never used to set the reference value.
  const source=independent||{...detail,price:50,market:{},listing:{...detail.listing,expire_time:'',onsale_expire_time_desc:''}};
  const item=Link.item(source,{serverId:String(independent?detail.independentServerId||parent.serverId:parent.serverId),eid:independent?detail.independentEid:parent.detailEid},{taskId,config,serverName:parent.server});
  return independent?{...item,carriedTarget:true,independentListing:true}:{...item,id:parent.id+':carried:'+index,carriedTarget:true,price:50,priceDisplay:'',valuationMeta:{...item.valuationMeta,expiresAt:null,crossFeeCents:null}};
 }
 function total(items=[]){return items.reduce((sum,item)=>sum+(Number.isSafeInteger(item.estimateCents)&&item.estimateCents>=5000?item.estimateCents:0),0);}
 return {extract,build,total};
});
