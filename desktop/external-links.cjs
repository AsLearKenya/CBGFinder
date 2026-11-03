'use strict';
// Only our public official search-form links may leave the desktop application.
function isVerificationUrl(value){
 try{const url=new URL(value);if(url.origin!=='https://xyq.cbg.163.com'||url.username||url.password||url.hash)return false;
 const actions={'/cgi-bin/equipquery.py':['show_overall_search_equip','show_overall_search_pet'],'/cgi-bin/xyq_overall_search.py':['show_search_role_form','show_pet_equip_search_form','show_overall_search_lingshi','show_overall_search_yupo']};
 return actions[url.pathname]?.includes(url.searchParams.get('act'))===true&&[...url.searchParams.keys()].every(key=>key==='act')&&url.searchParams.getAll('act').length===1;
 }catch{return false;}
}
module.exports={isVerificationUrl};
