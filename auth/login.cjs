'use strict';
const crypto=require('node:crypto');
const {Session}=require('./session-http.cjs');
const {encryptPassword,encryptParams}=require('../urs-crypto.cjs');
const {parseRoles,getLevel}=require('./role-parser.cjs');
const {calculate}=require('./pv.cjs');
const USER_AGENT='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FRAME='https://dl.reg.163.com/webzj/v1.0.1/pub/index2_new.html?pkid=aqpOBwV&product=cbg&cdnhostname=webzj.netstatic.net';
const randomId=()=>{const alphabet='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';return Array.from({length:32},()=>alphabet[crypto.randomInt(alphabet.length)]).join('');};
function parse(text){try{return JSON.parse(text.replace(/^\s*[\w.$]+\s*\(/,'').replace(/\)\s*;?\s*$/,''));}catch{throw Error('网易登录接口响应格式异常');}}
function safeRole(role){return {id:role.roleid,name:role.nickname||role.roleid,level:getLevel(role),locked:!!role.is_locked};}
function cookie(session,name){return session.header('https://xyq.cbg.163.com/').split('; ').find(value=>value.startsWith(name+'='))?.slice(name.length+1);}
function validateServer(server){if(!server||!Number.isInteger(Number(server.id))||Number(server.id)<1||!Number.isInteger(Number(server.regionId))||Number(server.regionId)<1||typeof server.name!=='string'||!server.name||typeof server.region!=='string'||!server.region)throw Error('请选择有效的登录服务器');return {id:Number(server.id),name:server.name,regionId:String(server.regionId),region:server.region};}
class LoginService{
 async login(account,password,inputServer){
  const server=validateServer(inputServer);
  if(typeof account!=='string'||!account.trim()||account.length>254||typeof password!=='string'||!password||password.length>117)throw Error('请填写有效的账号和密码');
  const un=account.trim().toLowerCase(),pw=encryptPassword(password),session=new Session();session.setCookies('https://dl.reg.163.com/',['utid='+randomId()+'; Path=/; Secure']);
  const loginQuery={act:'show_login',area_id:server.regionId,area_name:server.region,server_id:String(server.id),server_name:server.name};
  const top='https://xyq.cbg.163.com/cgi-bin/show_login.py?'+new URLSearchParams(loginQuery);
  const base=()=>({pd:'cbg',pkid:'aqpOBwV',channel:0,topURL:top,rtid:randomId()});
  const post=async(path,data)=>{const response=await session.request('https://dl.reg.163.com'+path,{method:'POST',body:JSON.stringify({encParams:encryptParams(data)}),headers:{'User-Agent':USER_AGENT,Accept:'application/json, text/javascript, */*; q=0.01',Referer:FRAME,'Content-Type':'application/json',Origin:'https://dl.reg.163.com'}});if(response.http!==200)throw Error('网易登录接口 HTTP '+response.http);return parse(response.text);};
  const check=(data,label)=>{if(Number(data.capFlag)>0||['108','109','110','111','441','444','445','447'].includes(String(data.ret)))throw Object.assign(Error('需要在同一登录会话的官方窗口完成验证码或二次验证'),{code:'LOGIN_VERIFICATION_REQUIRED',loginSession:session});if(String(data.ret)!=='201')throw Error(`${label}失败（${String(data.ret||'未知状态')}）`);};
  const ini=await post('/dl/zj/mail/ini',{...base(),pkht:'cbg.163.com'});check(ini,'登录初始化');
  let proof,login;
  const getProof=async()=>{const data=await post('/dl/zj/mail/powGetP',{...base(),un,...(proof?.sid?{pvSid:proof.sid}:{})});check(data,'登录校验');return data.pVInfo?.needCheck?calculate(data.pVInfo):undefined;};
  if(ini.pv)proof=await getProof();
  for(let attempt=0;attempt<2;attempt++){
   const ticket=await post('/dl/zj/mail/gt',{...base(),un});check(ticket,'获取登录票据');if(!ticket.tk)throw Error('登录票据缺失');
   login=await post('/dl/zj/mail/l',{...base(),un,pw,tk:ticket.tk,l:0,d:10,t:Date.now(),pwdKeyUp:0,domains:'',...(proof?{pVParam:proof}:{})});
   if(attempt===0&&['805','806'].includes(String(login.ret))&&proof){proof=await getProof();continue;}break;
  }
  check(login,'账号登录');
  const query=new URLSearchParams({...loginQuery,act:'check_suc_login',username:un,equip_id:''});
  await session.navigate('https://xyq.cbg.163.com/cgi-bin/reg_login.py?'+query,top);
  const response=await session.navigate('https://xyq.cbg.163.com/cgi-bin/login.py?'+new URLSearchParams({act:'show_role_select_page',serverid:String(server.id)}),top);
  if(response.http!==200)throw Error('获取角色列表失败');
  const html=new TextDecoder('gb18030').decode(response.body);
  if(html.includes('登录超时'))throw Error('藏宝阁登录超时，请重试');
  const roles=parseRoles(html);if(!roles.length)throw Error('该账号在所选服务器下没有可用角色');
  return {session,roles,server,account:un,choices:roles.map(safeRole)};
 }
 async select(context,gameRoleId){
  const role=context.roles.find(role=>role.roleid===String(gameRoleId));if(!role)throw Error('所选角色不在本次登录列表中');if(role.is_locked)throw Error('所选角色被限制登录');
  const url='https://xyq.cbg.163.com/cgi-bin/login.py?'+new URLSearchParams({act:'chose_role',roleid:role.roleid});
  const response=await context.session.navigate(url,'https://xyq.cbg.163.com/cgi-bin/login.py?act=show_role_select_page&serverid='+context.server.id);
  if(response.http!==200||cookie(context.session,'is_user_login')!=='1'||cookie(context.session,'login_user_roleid')!==role.roleid)throw Error('藏宝阁角色登录失败');
  return {gameRoleId:role.roleid,nickname:role.nickname||role.roleid,level:Number(cookie(context.session,'login_user_level'))||getLevel(role),school:cookie(context.session,'login_user_school')||'',cookies:[...context.session.cookies.values()]};
 }
}
module.exports={LoginService,validateServer};
