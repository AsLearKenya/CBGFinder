'use strict';
const https=require('node:https');
class Session {
 constructor(){this.cookies=new Map();}
 setCookies(url,headers){
  const origin=new URL(url);
  for(const header of headers||[]){
   const parts=header.split(';').map(p=>p.trim()),cut=parts[0].indexOf('=');if(cut<1)continue;
   const row={name:parts[0].slice(0,cut),value:parts[0].slice(cut+1),domain:origin.hostname,path:origin.pathname.slice(0,origin.pathname.lastIndexOf('/')+1)||'/',hostOnly:true,secure:false,expires:Infinity};
   for(const part of parts.slice(1)){const at=part.indexOf('='),name=(at<0?part:part.slice(0,at)).toLowerCase(),value=at<0?'':part.slice(at+1);if(name==='domain'){row.domain=value.replace(/^\./,'').toLowerCase();row.hostOnly=false;}else if(name==='path')row.path=value;else if(name==='secure')row.secure=true;else if(name==='max-age')row.expires=Date.now()+Number(value)*1000;else if(name==='expires'&&row.expires===Infinity)row.expires=Date.parse(value);}
   if(origin.hostname!==row.domain&&!origin.hostname.endsWith('.'+row.domain))continue;
   const key=[row.domain,row.path,row.name].join('|');if(row.expires<=Date.now())this.cookies.delete(key);else this.cookies.set(key,row);
  }
 }
 header(url){const u=new URL(url);return [...this.cookies.values()].filter(c=>c.expires>Date.now()&&(!c.secure||u.protocol==='https:')&&(u.hostname===c.domain||!c.hostOnly&&u.hostname.endsWith('.'+c.domain))&&(u.pathname===c.path||u.pathname.startsWith(c.path.endsWith('/')?c.path:c.path+'/'))).sort((a,b)=>b.path.length-a.path.length).map(c=>c.name+'='+c.value).join('; ');}
 async request(url,{method='GET',headers={},body}={}){
  const u=new URL(url);if(u.protocol!=='https:'||!['dl.reg.163.com','xyq.cbg.163.com','reg.163.com','cbg.163.com'].includes(u.hostname))throw Error('Unexpected authentication destination');
  const cookie=this.header(url);if(cookie)headers={...headers,Cookie:cookie};if(body!==undefined)headers={...headers,'Content-Length':Buffer.byteLength(body)};
  return new Promise((resolve,reject)=>{const req=https.request(u,{method,headers,timeout:20000},res=>{this.setCookies(url,res.headers['set-cookie']);const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({http:res.statusCode,headers:res.headers,body:Buffer.concat(chunks),text:Buffer.concat(chunks).toString('utf8'),url}));});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('Request timeout')));req.end(body);});
 }
 async navigate(url,referer){
  for(let hop=0;hop<8;hop++){
   const response=await this.request(url,{headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',Accept:'text/html,application/xhtml+xml,*/*',...(referer?{Referer:referer}:{})}});
   if(response.http>=300&&response.http<400&&response.headers.location){referer=url;url=new URL(response.headers.location,url).href;continue;}
   return response;
  }
  throw Error('Too many redirects');
 }
}
module.exports={Session};
