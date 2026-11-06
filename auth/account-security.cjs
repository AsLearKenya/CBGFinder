'use strict';
// Local recovery rule based on the user's confirmed App verification flow.
// Keep the feedback code visible; it is not an official MIBAO_AUTH response.
function inferredAccountSecurity(text){
 const source=String(text||'');let decoded;try{const data=decoded=JSON.parse(source.trim().replace(/^[\w.$]+\s*\(/,'').replace(/\)\s*;?\s*$/,''));if(String(data.status)==='1'||data.status===true||['MIBAO_AUTH','OTP_AUTH','CAPTCHA_AUTH','ACCOUNT_RESTRICTED'].includes(data.status_code))return null;}catch{}
 const message=String(decoded?.msg||decoded?.message||source);
 const restriction=message.match(/(?:账号|帐号|账户)[^\n]{0,80}(?:保护性冻结|冻结|封禁|限制登录)|(?:保护性冻结|账号冻结|帐号冻结)/)?.[0];
 if(restriction)return {status:0,status_code:'ACCOUNT_RESTRICTED',inferred:true,msg:message};
 const feedback=source.match(/\b(?:e-b-1008|eb-re410)\b/i)?.[0];
 if(!feedback)return null;
 return {status:0,status_code:'MIBAO_AUTH',inferred:true,feedback_code:feedback,msg:'可能需要将军令验证，请在当前会话的官方窗口中完成验证后尝试请求（按本地规则提示，原始错误：'+feedback+'）'};
}
module.exports={inferredAccountSecurity};
