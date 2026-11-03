'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const source=['bignumjs','powerfun'].map(name=>fs.readFileSync(__dirname+'/'+name+'-reference.js','utf8')).join('\n');
async function calculate(info){
 if(info.hashFunc!=='VDF_FUNCTION'||!Number.isFinite(info.maxTime)||info.maxTime<0||info.maxTime>10000)throw Error('当前登录校验暂不支持，请稍后重试或在官网完成验证');
 let result;const sandbox={postMessage:value=>{result=value;},__info:info};sandbox.self=sandbox;
 vm.createContext(sandbox);vm.runInContext(source,sandbox,{timeout:3000});vm.runInContext('vdfFun(__info)',sandbox,{timeout:info.maxTime+3000});
 if(!result)throw Error('登录校验计算失败');delete result.maxTime;delete result.hashFunc;return result;
}
module.exports={calculate};
