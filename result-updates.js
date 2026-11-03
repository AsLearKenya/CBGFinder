/* Keep result rows and their loaded details alive across pagination updates. */
(function(root){
 const anchorRestores=new WeakMap();
 function key(node){if(node.nodeType!==1)return '';const direct=node.getAttribute('data-equipment-key')||node.getAttribute('data-change-key')||node.getAttribute('data-run-key')||node.id;if(direct)return direct;for(const name of ['data-page','data-role-card','data-task-card','data-open-task','data-toggle','data-run','data-edit','data-delete','data-result-sort','data-result-server','data-link-item-detail'])if(node.hasAttribute(name))return name+':'+node.getAttribute(name);if(node.hasAttribute('data-action'))return 'action:'+node.getAttribute('data-action')+':'+(node.getAttribute('data-task-id')||'');return '';}

 function compatible(a,b){return a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&key(a)===key(b);}
 function patch(node,next){
  if(node.nodeType!==1){if(node.nodeValue!==next.nodeValue)node.nodeValue=next.nodeValue;return;}
  // Hydrated details have their own event handlers, tabs, dialogs and scroll state.
  if(node.classList.contains('equipment-expanded')||node.hasAttribute('data-link-item-detail'))return;
  for(const attr of [...node.attributes])if(!next.hasAttribute(attr.name)&&!(node.tagName==='DETAILS'&&attr.name==='open'))node.removeAttribute(attr.name);
  for(const attr of [...next.attributes])if(!(node.tagName==='DETAILS'&&attr.name==='open')&&node.getAttribute(attr.name)!==attr.value)node.setAttribute(attr.name,attr.value);
  const active=node===node.ownerDocument.activeElement;
  if(node.tagName==='INPUT'&&!active){node.value=next.value;node.checked=next.checked;}
  children(node,next);
  if(node.tagName==='SELECT'&&!active)node.value=next.value;
 }
 function children(parent,next){
  const old=[...parent.childNodes],used=new Set(),keyed=new Map(old.filter(n=>key(n)).map(n=>[key(n),n]));let cursor=parent.firstChild;
  for(const fresh of [...next.childNodes]){
   let node=key(fresh)?keyed.get(key(fresh)):old.find(n=>!used.has(n)&&!key(n)&&compatible(n,fresh));
   if(node&&!compatible(node,fresh))node=null;
   if(node){used.add(node);if(node!==cursor)parent.insertBefore(node,cursor);patch(node,fresh);}else{node=fresh;parent.insertBefore(node,cursor);}
   cursor=node.nextSibling;
  }
  for(const node of old)if(!used.has(node))node.remove();
 }
 function update(main,html,{preserveAnchor=true}={}){
  const template=main.ownerDocument.createElement('template');template.innerHTML=html;
  const active=main.ownerDocument.activeElement;
  const scroller=main.scrollHeight>main.clientHeight?main:main.ownerDocument.scrollingElement;
  const scrollTop=scroller.scrollTop,overflowAnchor=anchorRestores.get(scroller)?.value??scroller.style.overflowAnchor;
  // Explicit sorting keeps the viewport position, not the identity of a moved row.
  // Disable Chromium's own anchoring for this update as well as our compensation.
  if(!preserveAnchor)scroller.style.overflowAnchor='none';
  const anchor=preserveAnchor?[...main.querySelectorAll('[data-equipment-key]')].find(n=>{const r=n.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}):null;
  const top=anchor?.getBoundingClientRect().top;
  children(main,template.content);
  if(active?.isConnected&&main.ownerDocument.activeElement!==active)active.focus({preventScroll:true});
  if(!preserveAnchor){
   main.getBoundingClientRect();scroller.scrollTop=scrollTop;
   const restore={value:overflowAnchor};anchorRestores.set(scroller,restore);
   // Native compensation is applied after layout; wait for the reordered list to paint.
   requestAnimationFrame(()=>requestAnimationFrame(()=>{if(anchorRestores.get(scroller)===restore){scroller.style.overflowAnchor=restore.value;anchorRestores.delete(scroller);}}));
  }
  else if(anchor?.isConnected){const delta=anchor.getBoundingClientRect().top-top;if(delta)scroller.scrollTop+=delta;}
 }
 root.ResultUpdates={update};
})(globalThis);
