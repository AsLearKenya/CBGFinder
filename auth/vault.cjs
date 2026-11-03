'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
class Vault{
 constructor(directory){this.directory=directory;this.queue=Promise.resolve();}
 async key(){await fs.mkdir(this.directory,{recursive:true,mode:0o700});const file=path.join(this.directory,'key');try{await fs.writeFile(file,crypto.randomBytes(32),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}const key=await fs.readFile(file);if(key.length!==32)throw Error('本机角色存储密钥无效');return key;}
 async load(){const key=await this.key();try{const data=JSON.parse(await fs.readFile(path.join(this.directory,'roles.enc'),'utf8'));const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(data.iv,'base64'));decipher.setAuthTag(Buffer.from(data.tag,'base64'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data.data,'base64')),decipher.final()]).toString('utf8'));}catch(error){if(error.code==='ENOENT')return {roles:[],events:[]};throw Error('角色存档无法读取，原文件已保留');}}
 save(data){const snapshot=JSON.stringify(data);const work=async()=>{const key=await this.key(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(snapshot,'utf8'),cipher.final()]);const file=path.join(this.directory,'roles.enc'),temp=file+'.tmp-'+crypto.randomUUID();try{await fs.writeFile(temp,JSON.stringify({version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}};this.queue=this.queue.then(work,work);return this.queue;}
}
module.exports={Vault};
