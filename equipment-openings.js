(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EquipmentOpenings=api;})(globalThis,function(){
 'use strict';
 // A slash denotes opened/max holes within ONE set, never a second set.
 function parse(meta={},description=''){
  const valid=n=>Number.isInteger(Number(n))&&Number(n)>=0&&Number(n)<=5;
  if(Array.isArray(meta.holeSets)&&meta.holeSets.length&&meta.holeSets.length<=2&&meta.holeSets.every(valid))return meta.holeSets.map(Number);
  const source=String(description||'');
  const sets=[...source.matchAll(/(?:开运孔数|第[二2]套(?:开运)?孔数)[：:]\s*(\d+)\s*(?:孔)?(?:\s*\/\s*\d+\s*孔)?/g)].map(m=>Number(m[1])).filter(valid);
  const double=source.match(/(?:双|两套?)[\s（(]*(\d+)\s*孔/);
  if(double&&valid(double[1]))return [Number(double[1]),Number(double[1])];
  if(sets.length>1)return sets.slice(0,2);
  const line=source.match(/开运孔数[：:]([^\n]+)/)?.[1]||'';
  const pairs=[...line.matchAll(/(\d+)\s*孔\s*\/\s*\d+\s*孔/g)].map(m=>Number(m[1])).filter(valid);
  if(pairs.length>1)return pairs.slice(0,2);
  const raw=meta.hole_num??meta.holes;
  if(Array.isArray(raw)&&raw.length&&raw.length<=2&&raw.every(valid))return raw.map(Number);
  if(sets.length)return sets;
  return valid(raw)?[Number(raw)]:[0];
 }
 return {parse};
});
