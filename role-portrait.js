/* Official get_role_iconid mapping: paired weapon shapes share a portrait. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RolePortrait=api;})(globalThis,function(){
 function id(value){if(!/^\d+$/.test(String(value)))return null;let icon=Number(value);if(!Number.isSafeInteger(icon)||icon<1)return null;for(const [min,max] of [[13,24],[37,48],[61,72],[213,224],[237,248],[261,272]])if(icon>=min&&icon<=max){icon-=12;break;}return icon;}
 function url(value,{large=false}={}){const icon=id(value);return icon===null?'':'https://cbg-xyq.res.netease.com/images/'+(large?'bigface/':'role_icon/small/')+icon+'.gif';}
 return {id,url};
});
