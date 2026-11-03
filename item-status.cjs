'use strict';
// Status IDs follow the official CONSTANTS.EQUIP_STATUS / EquipStatus map.
const SearchParams=require('./search-params.js'),SearchResults=require('./search-results.js');
function parseFields(html){
 const block=String(html).match(/\bvar\s+equip\s*=\s*\{([\s\S]*?)\n\};/)?.[1]||'';
 const fields={};let depth=0;
 for(let i=0;i<block.length;i++){
  const c=block[i];if(c==='"'||c==="'"){const quote=c,start=i++;while(i<block.length){if(block[i]==='\\'){i+=2;continue;}if(block[i]===quote)break;i++;}const name=block.slice(start+1,i);if(depth===0){const value=block.slice(i+1).match(/^\s*:\s*["']?(\d+(?:\.\d{1,2})?)(?:["']?\s*[,}]|["']?\s*$)/);if(value)fields[name]=value[1];}}
  else if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
 }
 return fields;
}
function parseStatus(html){
 const fields=parseFields(html),field=name=>fields[name];
 const code=field('status');
 if(['4','5','6'].includes(code))return {status:'sold',label:'已售出'};
 if(['0','1'].includes(code))return {status:'offsale',label:code==='0'?'卖家已取回':'已下架'};
 if(code==='3')return {status:'reserved',label:'已被下单，未确认成交'};
 if(code==='2'||field('is_selling')==='1')return {status:'listed',label:'仍在售，本轮未检索到'};
 return {status:'unknown',label:'官网未明确返回成交或下架状态'};
}
function createStatusHandler({roles,gate,fetch,officialFetch=(roleId,url,options)=>fetch(url,options),isCaptcha,isExpired}){return async(input,{userAgent='Mozilla/5.0'}={})=>{
 if(typeof input.roleId!=='string'||!input.roleId||!/^[1-9]\d{0,5}$/.test(String(input.serverId))||!/^\d{15}-\d+-[A-Za-z0-9]{1,40}$/.test(String(input.eid)))throw Error('商品状态参数无效');
 await roles.get(input.roleId);const url='https://xyq.cbg.163.com/equip?s='+input.serverId+'&eid='+input.eid,signal=AbortSignal.timeout(30000);
 async function request(target,accept){
 const load=async session=>gate.run(input.roleId,async()=>{if(session&&roles.cookieSnapshot)Object.assign(session,await roles.cookieSnapshot(input.roleId,target,{signal}));const response=await officialFetch(input.roleId,target,{headers:{Cookie:session?.cookie||await roles.cookie(input.roleId,target),'User-Agent':userAgent,Accept:accept,Referer:'https://xyq.cbg.163.com/'},redirect:'manual',signal});const bytes=await response.arrayBuffer();if(bytes.byteLength>3000000)throw Error('商品状态响应过大');const body=new TextDecoder(/charset=utf-?8|application\/json/i.test(response.headers.get('content-type')||'')?'utf-8':'gb18030').decode(bytes);if(isCaptcha(body)){const message='官网要求验证码，已暂停该角色的请求，请完成安全验证';gate.block(input.roleId,message);throw Error(message);}if(response.status===429){const message='官网返回请求过于频繁，已暂停该角色的请求';gate.block(input.roleId,message);throw Error(message);}return {body,status:response.status};},{signal,taskId:input.task?.id});
 let result;if(roles.request)result=(await roles.request(input.roleId,target,load,{signal,taskId:input.task?.id,isExpired:value=>isExpired(value.body,value.status)})).response;else result=await load();
 if(isExpired(result.body,result.status))throw Error('角色登录已过期，请处理后重试');return result;
 }
 const result=await request(url,'text/html');
 if(result.status===404)return {status:'unknown',label:'官网商品页已不可用，无法确认原因'};
 if(result.status!==200)throw Error('官网商品状态查询失败：HTTP '+result.status);
 const status=parseStatus(result.body);if(status.status!=='listed'||!input.task)return status;
 const task=input.task;if(task.roleId!==input.roleId||typeof task.id!=='string')throw Error('复核任务与角色不一致');
 const plans=SearchParams.buildPlans(task),server=String(input.serverId);
 const applicable=plans.filter(plan=>!plan.server.id||plan.server.id===server);
 if(!applicable.length)return {...status,match:'no',label:'仍在售，所在服务器不符合任务条件'};
 const priceText=parseFields(result.body).price,price=priceText===undefined?NaN:Number(SearchParams.priceCents(priceText));
 if(!Number.isSafeInteger(price)||price<0)return {...status,match:'unknown',label:'仍在售，当前价格无法确认，筛选条件待复核'};
 const eligible=applicable.filter(plan=>(plan.params.price_min===undefined||price>=Number(plan.params.price_min))&&(plan.params.price_max===undefined||price<=Number(plan.params.price_max)));
 if(!eligible.length)return {...status,match:'no',label:'仍在售，当前价格不符合任务条件'};
 let requests=0;const checked=new Set();
 for(const plan of eligible){
  const narrowed={...plan,params:{...plan.params,serverid:server,price_min:String(price),price_max:String(price)}};
  Object.keys(plan.params).filter(key=>!['act','page','count','search_type','view_loc','order_by'].includes(key)).forEach(key=>checked.add(key));
  let page=1;const seen=new Set();
  while(page!==null){
   if(++requests>20)return {...status,match:'unknown',label:'仍在售，复核结果较多，尚未确认全部筛选条件'};
   const response=await request(SearchParams.requestUrl(SearchParams.pagePlan(narrowed,page)),'application/json');
   if(response.status!==200)throw Error('筛选条件复核失败：HTTP '+response.status);
   const data=SearchResults.parseResponse(response.body),signature=JSON.stringify(data.equip_list);
   if(data.equip_list.length&&seen.has(signature))throw Error('官网复核分页重复，无法确认筛选条件');seen.add(signature);
   const found=data.equip_list.find(item=>String(item.eid||item.equip_sn||'')===input.eid&&String(item.serverid||item.server_id||server)===server);
   if(found)return {...status,match:'yes',label:'全部任务条件已通过官网复核，已补回搜索结果',item:found,checkedFilters:[...checked]};
   page=SearchParams.nextPage(data,page);
  }
 }
 return {...status,match:'unknown',label:'仍在售，原条件复核未命中；可能不再符合条件或官网索引尚未同步'};

};}
module.exports={parseStatus,createStatusHandler};
