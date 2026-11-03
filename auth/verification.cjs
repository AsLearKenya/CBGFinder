'use strict';
const crypto=require('node:crypto');
const VERIFY_URL='https://xyq.cbg.163.com/cgi-bin/login.py';
const REFERER='https://xyq.cbg.163.com/cgi-bin/xyq_overall_search.py?act=show_search_role_form';
function parseVerificationResponse(bytes,contentType=''){
 const encoding=/charset\s*=\s*["']?(?:gbk|gb2312|gb18030)/i.test(contentType)?'gb18030':'utf-8';
 const body=new TextDecoder(encoding).decode(bytes).replace(/^\uFEFF/,'').trim();
 if(body.length>262144)throw Error('官网验证响应异常');
 let result;try{result=JSON.parse(body);}catch{
  if(/系统繁忙/.test(body)){const code=body.match(/\b(?:eb|ec)-[a-z0-9-]+\b/i)?.[0];throw Error('验证码组件已通过，但官网提交失败：系统繁忙'+(code?'（'+code+'）':'')+'，请稍后重试');}
  if(/登录超时|登录过期|show_login|do_anon_auth/.test(body))throw Error('当前角色会话已过期，请刷新角色会话后重新验证');
  throw Error('官网未返回验证确认结果，请稍后重试');
 }
 if(!result||typeof result!=='object'||Array.isArray(result))throw Error('官网验证响应格式无效');
 return result;
}
// The user operates NetEase's official widget. Only its result is submitted here.
class VerificationService{
 constructor({roles,fetch=globalThis.fetch,officialFetch=(roleId,url,options)=>fetch(url,options),now=Date.now}){this.roles=roles;this.fetch=fetch;this.officialFetch=officialFetch;this.now=now;this.flows=new Map();}
 clear(id){const flow=this.flows.get(id);if(flow){clearTimeout(flow.timer);this.flows.delete(id);this.roles.verifying?.delete(flow.roleId);}}
 async begin(roleId,{userAgent='Mozilla/5.0'}={}){
  if(typeof userAgent!=='string'||userAgent.length>1024||/[\r\n]/.test(userAgent))throw Error('浏览器信息无效');
  if(typeof roleId!=='string'||!roleId)throw Error('请选择待验证角色');
  for(const [id,flow] of this.flows)if(flow.expires<=this.now())this.clear(id);
  if([...this.flows.values()].some(flow=>flow.roleId===roleId))throw Error('该角色已有验证窗口，请先完成或关闭');
  const snapshot=await this.roles.cookieSnapshot(roleId,VERIFY_URL);
  if([...this.flows.values()].some(flow=>flow.roleId===roleId))throw Error('该角色已有验证窗口，请先完成或关闭');
  const id=crypto.randomUUID(),flow={roleId,version:snapshot.version,cookie:snapshot.cookie,userAgent,expires:this.now()+300000,busy:false};
  this.roles.verifying?.add(roleId);this.flows.set(id,flow);flow.timer=setTimeout(()=>this.clear(id),300000);flow.timer.unref?.();return {id,expires:flow.expires};
 }
 cancel(id){const flow=this.flows.get(id);if(flow?.busy)throw Error('验证正在提交，请稍候');this.clear(id);}
 async submit({id,validate}){
  const flow=this.flows.get(id);if(!flow||flow.expires<=this.now()){this.clear(id);throw Error('验证已过期，请重新打开验证窗口');}
  if(typeof validate!=='string'||!validate||validate.length>8192||/[\r\n]/.test(validate))throw Error('验证结果无效，请手动完成官方验证');
  if(flow.busy)throw Error('验证正在提交，请勿重复操作');flow.busy=true;
  try{
   const snapshot=await this.roles.cookieSnapshot(flow.roleId,VERIFY_URL);
   if(snapshot.version!==flow.version){this.clear(id);throw Error('角色会话已变化，请重新打开验证窗口');}
   const response=await this.officialFetch(flow.roleId,VERIFY_URL,{method:'POST',headers:{Accept:'application/json','X-Requested-With':'XMLHttpRequest','X-Request':'JSON',Origin:'https://xyq.cbg.163.com','Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Cookie:flow.cookie,Referer:REFERER,'User-Agent':flow.userAgent},body:new URLSearchParams({act:'ajax_do_netease_captcha_auth',version:'v3',client_type:'web',captcha_validate:validate}).toString(),redirect:'error',signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error('官网验证提交失败：HTTP '+response.status);
   const bytes=await response.arrayBuffer();if(bytes.byteLength>262144)throw Error('官网验证响应异常');const result=parseVerificationResponse(bytes,response.headers.get('content-type')||'');
   if(result.status!==1&&result.status!=='1')throw Error('官网未通过验证，请在组件中重新操作');
   await this.roles.acceptVerification(flow.roleId,{version:flow.version,cookieHeaders:response.headers.getSetCookie?.()||[]});
   this.clear(id);return {roleId:flow.roleId};
  }finally{flow.busy=false;}
 }
}
module.exports={VerificationService,VERIFY_URL,parseVerificationResponse};
