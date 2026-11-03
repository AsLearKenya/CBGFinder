'use strict';
function parseRoles(html){
 const match=/\bvar\s+RoleList\s*=\s*/.exec(html);if(!match)throw Error('角色列表不在页面中');
 const start=match.index+match[0].length;if(html[start]!=='{')throw Error('角色列表格式无效');
 let depth=0,quoted=false,escaped=false;
 for(let i=start;i<html.length;i++){
  const ch=html[i];if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;continue;}
  if(ch==='"')quoted=true;else if(ch==='{')depth++;else if(ch==='}'&&--depth===0){const object=JSON.parse(html.slice(start,i+1));return Object.entries(object).map(([id,role])=>({...role,roleid:String(role.roleid||id)}));}
 }
 throw Error('角色列表不完整');
}
function getLevel(role){for(const key of ['level','role_level','grade','role_grade','iGrade']){const raw=role[key];if(raw!==undefined&&raw!==null&&raw!==''&&Number.isInteger(Number(raw))&&Number(raw)>=0)return Number(raw);}return null;}
function selectRole(roles){
 if(!roles.length)throw Error('该服务器没有可选择的角色');
 const preferred=roles.find(role=>getLevel(role)!==null&&getLevel(role)>=50);
 return {role:preferred||roles[0],reason:preferred?'first-level-at-least-50':roles.some(role=>getLevel(role)!==null)?'no-level-at-least-50-fallback-first':'no-level-data-fallback-first'};
}
module.exports={parseRoles,getLevel,selectRole};
