(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Yupo=api;})(typeof globalThis==='object'?globalThis:this,function(){
 // Official public CBG_GAME_CONFIG minghun definitions, retrieved 2026-10-27.
 const config={"minghun_attr": {"101": "气血", "102": "防御", "103": "法防", "104": "抗物理", "105": "抗法术", "106": "抗封印", "107": "格挡值", "108": "气血回复", "109": "抗固伤", "201": "伤害", "202": "速度", "203": "法术伤害", "204": "狂暴", "205": "物理暴击", "206": "法术暴击", "207": "封印命中", "208": "法伤结果", "209": "穿刺", "210": "治疗能力", "211": "固伤暴击"}, "minghun_attr_yang": {"201": "伤害", "202": "速度", "203": "法术伤害", "204": "狂暴", "205": "物理暴击", "206": "法术暴击", "207": "封印命中", "208": "法伤结果", "209": "穿刺", "210": "治疗能力", "211": "固伤暴击"}, "minghun_attr_yin": {"101": "气血", "102": "防御", "103": "法防", "104": "抗物理", "105": "抗法术", "106": "抗封印", "107": "格挡值", "108": "气血回复", "109": "抗固伤"}, "minghun_daoju": {"61738": "小还丹", "61739": "千年保心丹", "61740": "蛇蝎美人", "61741": "金香玉", "61742": "红雪散", "61743": "风水混元丹", "61744": "定神香", "61745": "十香返生丸", "61746": "紫心玉露丸", "61747": "黑玉云苓膏", "61748": "百炼金乌丸", "61749": "回春龙沙散"}, "minghun_effect": {"1": "奇袭法术", "4": "物伤化劲", "5": "法伤化劲", "6": "固伤化劲", "7": "坚固无痕", "8": "坚如磐石"}, "minghun_teji": {"61750": "野兽之力", "61751": "放下屠刀", "61752": "光辉之甲", "61753": "破甲术", "61754": "玄鸟之灵", "61755": "伯牙绝弦", "61756": "妙法之护", "61757": "攻心术", "61758": "流云诀", "61759": "凝滞术"}};
 const plain=value=>String(value??'').replace(/#r/g,'\n').replace(/#c[\da-f]{6}|#[RGBYKWnbu]/gi,'').replace(/<[^>]*>/g,'').trim();
 function splitDescription(source){const s=String(source||''),m=s.match(/<json>([\s\S]*?)<\/json>/);let data=null;try{data=JSON.parse(m?m[1]:s).minghun||null;}catch{}return {styled:s.replace(/<json>[\s\S]*?<\/json>/g,''),data};}
 function renderDescription(source){const {styled,data}=splitDescription(source);if(!data)return String(source||'');
 const lines=[],push=(text,color='#Y')=>{if(typeof text==='string'&&text)lines.push(color+text);};
 push(data.init?.desc);push(data.effect?.desc2);push(data.last,data.last==='耐久度 0'?'#R':'#Y');push(data.hole?.desc);
 if(Array.isArray(data.base))for(const row of data.base)push(row?.desc,'#G');
 if(Array.isArray(data.special))for(const id of data.special){const label=config.minghun_daoju[id]||config.minghun_teji[id]||(Number(id)===0?'[空]':String(id));push((Number(data.item)===61717?'奇袭道具':'奇袭特技')+'：'+label,'#c4DBAF4');}
 push(data.effect?.desc,'#c4DBAF4');push(data.expire_time);
 const rendered=lines.join('#r');return String(source).includes('<json>')?String(source).replace(/<json>[\s\S]*?<\/json>/,rendered):rendered;
 }
 function summary(source){const {styled,data}=splitDescription(source);const parse=value=>{const m=plain(value).match(/^(.+?)\s*\+([\d.]+)(?:\s*\[\s*\+([\d.]+)\s*\])?/);return m?{label:m[1],value:String(Number(m[2]))}:null;};
 const lines=styled.split(/#r|\n/),base=data?.init?.desc?[data.init.desc]:lines.filter(line=>!/#G/.test(line)&&!/%|奇袭|化劲|耐久|灵尘/.test(line));
 const added=Array.isArray(data?.base)?data.base.map(row=>row.desc):lines.filter(line=>/#G/.test(line));
 return {styled,attributes:base.map(parse).filter(Boolean),added:added.map(parse).filter(Boolean).map(row=>row.label+' +'+row.value),dustLevel:plain(data?.hole?.desc||'').replace(/灵尘等级\s*/,'')||plain(styled).match(/灵尘等级\s*(\d+(?:\s*\[\s*\+\d+\s*\])?)/)?.[1]||'',effects:[...(Array.isArray(data?.special)?data.special.filter(id=>Number(id)!==0).map(id=>config.minghun_daoju[id]||config.minghun_teji[id]||String(id)):[]),data?.effect?.desc,data?.effect?.desc2].filter(Boolean).map(plain)};
 }
 return {config,plain,splitDescription,renderDescription,summary};
});
