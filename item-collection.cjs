'use strict';
function createCollectionHandler({roles,gate,fetch,officialFetch=(roleId,url,options)=>fetch(url,options),isCaptcha,isExpired}){
 const pending=new Set();
 return async(input,{userAgent='Mozilla/5.0'}={})=>{
  if(typeof input.roleId!=='string'||!input.roleId||input.roleId.length>100||! /^[1-9]\d{0,5}$/.test(String(input.serverId))||typeof input.orderSn!=='string'||!/^\d{1,10}_\d{1,16}_\d{1,20}$/.test(input.orderSn)||typeof input.collected!=='boolean')throw Error('收藏参数无效');
  await roles.get(input.roleId);
  const key=JSON.stringify([input.roleId,String(input.serverId),input.orderSn]);if(pending.has(key))throw Error('该商品的收藏操作正在处理中，请勿重复点击');pending.add(key);
  try{
   const url=new URL('https://xyq.cbg.163.com/cgi-bin/userinfo.py');url.search=new URLSearchParams({act:input.collected?'ajax_add_collect':'ajax_del_collect',order_sn:input.orderSn,obj_server_id:String(input.serverId),...(input.collected?{attention:'1',query_tag:''}:{}),refer_app:'list'}).toString();
   const signal=AbortSignal.timeout(30000);
   const load=async session=>gate.run(input.roleId,async()=>{
    if(session&&roles.cookieSnapshot)Object.assign(session,await roles.cookieSnapshot(input.roleId,url.href,{signal}));
    const response=await officialFetch(input.roleId,url.href,{method:'GET',headers:{Cookie:session?.cookie||await roles.cookie(input.roleId,url.href),Accept:'application/json','Accept-Language':'zh-CN,zh;q=0.9','User-Agent':userAgent,Referer:'https://xyq.cbg.163.com/cgi-bin/query.py?act=recommend_search&recommend_type=1','X-Requested-With':'XMLHttpRequest','X-Request':'JSON'},redirect:'manual',signal});
    const bytes=await response.arrayBuffer();if(bytes.byteLength>262144)throw Error('收藏接口响应异常');
    const body=new TextDecoder(/charset=gb/i.test(response.headers.get('content-type')||'')?'gb18030':'utf-8').decode(bytes);
    if(isCaptcha(body)){const message='官网要求验证码，已暂停该角色的请求，请完成安全验证后再收藏';gate.block(input.roleId,message);throw Error(message);}
    if(response.status===429){const message='官网返回请求过于频繁，已暂停该角色的请求，请稍后处理';gate.block(input.roleId,message);throw Error(message);}
    return {body,status:response.status};
   },{signal});
   let result;if(roles.request)result=(await roles.request(input.roleId,url.href,load,{signal,isExpired:value=>isExpired(value.body,value.status)})).response;
   else {result=await load();if(isExpired(result.body,result.status)){await roles.refresh(input.roleId);result=await load();}}
   if(isExpired(result.body,result.status))throw Error('角色登录已过期，请在角色管理中处理后重试');
   if(result.status<200||result.status>=300)throw Error('官网收藏请求失败：HTTP '+result.status);
   let data;try{data=JSON.parse(result.body);}catch{throw Error('官网收藏响应格式异常，请稍后确认收藏状态');}
   if(!data||![1,'1',true].includes(data.status))throw Error(String(data?.msg||data?.message||'官网未确认收藏操作成功').slice(0,300));
   return {ok:true,collected:input.collected,...(Number.isInteger(data.collect_num)&&data.collect_num>=0?{collectCount:data.collect_num}:{})};
  }finally{pending.delete(key);}
 };
}
module.exports={createCollectionHandler};
