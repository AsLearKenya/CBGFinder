'use strict';
// This page runs on its own loopback port, isolated from app storage and APIs.
const recipient=window.opener||parent;
const nonce=location.hash.slice(1),statusNode=document.getElementById('status'),retry=document.getElementById('retry');
let widget=null,submitting=false;
function report(type,value){recipient.postMessage({channel:'cbg-human-verification',nonce,type,value},'*');}
function failed(error){statusNode.textContent='官方验证组件加载失败，请重试。若官网限制本地页面加载，将无法在此完成验证。';retry.style.display='inline-block';retry.textContent='重新加载组件';report('load-error',{code:String(error?.code||''),message:String(error?.message||error?.msg||'组件或网络加载失败').slice(0,160)});}
function init(){
 retry.style.display='none';statusNode.textContent='请亲自完成下方官方验证。';
 try{window.initNECaptcha({captchaId:'e8079a8b61ab419e97693235b68a33f9',element:'#captcha',mode:'embed',width:'320px',protocol:'https',https:true,onReady(){statusNode.textContent='官方组件已就绪，请亲自完成验证。';report('ready');},onVerify(error,data){if(error||!data?.validate||submitting)return;submitting=true;statusNode.textContent='组件验证通过，正在等待官网确认…';report('validate',data.validate);}},instance=>widget=instance,failed);}catch{failed();}
}
function load(){if(window.initNECaptcha){init();return;}const script=document.createElement('script');script.src='https://cstaticdun.126.net/load.min.js';script.onload=()=>window.initNECaptcha?init():failed(new Error('官方脚本未能初始化'));script.onerror=()=>failed(new Error('官方组件脚本无法加载')); document.head.appendChild(script);}
retry.addEventListener('click',()=>{submitting=false;if(widget){widget.refresh();retry.style.display='none';statusNode.textContent='请重新完成官方验证。';}else load();});
window.addEventListener('message',event=>{if(event.source!==recipient||event.data?.nonce!==nonce)return;if(event.data.type==='retry'){submitting=false;statusNode.textContent=event.data.message||'官网尚未确认，请重新完成官方验证。';retry.style.display='inline-block';retry.textContent='重新验证';widget?.refresh();}if(event.data.type==='success'){statusNode.textContent='验证已通过。';}});
load();
