'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const APP='com.kenya.cbgfinder',CONFIG='storage-location.json';
const excluded=new Set([CONFIG,'SingletonLock','SingletonSocket','SingletonCookie','lockfile','Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','Crash Reports']);
function atomic(file,value){const tmp=file+'.tmp-'+crypto.randomUUID();try{fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(tmp,file);}finally{fs.rmSync(tmp,{force:true});}}
function inside(child,parent){const rel=path.relative(parent,child);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));}
function ensureTarget(target,source){
 if(!path.isAbsolute(target))throw Error('存储路径必须是绝对路径');
 if(fs.existsSync(target)&&fs.lstatSync(target).isSymbolicLink())throw Error('存储路径必须是普通文件夹');
 target=fs.existsSync(target)?fs.realpathSync(target):path.join(fs.realpathSync(path.dirname(target)),path.basename(target));source=fs.realpathSync(source);
 if(inside(target,source)||inside(source,target))throw Error('请选择与当前数据目录互不包含的独立目录');
 if(fs.existsSync(target)){if(fs.lstatSync(target).isSymbolicLink()||!fs.statSync(target).isDirectory())throw Error('存储路径必须是普通文件夹');if(fs.readdirSync(target).length)throw Error('请选择空文件夹，避免覆盖已有数据');}
 const parent=fs.realpathSync(fs.existsSync(target)?target:path.dirname(target));fs.accessSync(parent,fs.constants.W_OK);
 return path.resolve(target);
}
function verifyCopy(source,target){for(const entry of fs.readdirSync(source,{withFileTypes:true})){if(excluded.has(entry.name))continue;const a=path.join(source,entry.name),b=path.join(target,entry.name);if(entry.isSymbolicLink())throw Error('数据目录包含符号链接，迁移已停止');if(entry.isDirectory())verifyCopy(a,b);else if(entry.isFile()){const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');if(digest(a)!==digest(b))throw Error('数据复制校验失败：'+entry.name);}}}
function createLocation(defaultPath){
 defaultPath=path.resolve(defaultPath);fs.mkdirSync(defaultPath,{recursive:true});const configFile=path.join(defaultPath,CONFIG);let config={version:1,activePath:defaultPath,pendingPath:null,guideSeen:false};
 if(fs.existsSync(configFile)){config=JSON.parse(fs.readFileSync(configFile,'utf8'));if(config.version!==1||!path.isAbsolute(config.activePath)||config.pendingPath!==null&&typeof config.pendingPath!=='string')throw Error('存储路径配置损坏，请保留原数据后检查配置');}
 const save=next=>{atomic(configFile,next);config=next;};
 if(!fs.existsSync(config.activePath))throw Error('原数据目录不可用，请恢复目录或连接对应磁盘后重启：'+config.activePath);
 if(config.pendingPath){
  const target=config.pendingPath,temp=path.join(path.dirname(target),'.cbg-migrate-'+crypto.randomUUID());
  try{ensureTarget(target,config.activePath);fs.cpSync(config.activePath,temp,{recursive:true,errorOnExist:true,force:false,filter:source=>source===config.activePath||!excluded.has(path.basename(source))});verifyCopy(config.activePath,temp);atomic(path.join(temp,'.cbg-profile.json'),{app:APP,version:1});if(fs.existsSync(target))fs.rmdirSync(target);fs.renameSync(temp,target);save({...config,activePath:target,pendingPath:null,migrationError:''});}
  catch(error){fs.rmSync(temp,{recursive:true,force:true});save({...config,pendingPath:null,migrationError:'数据迁移未完成，继续使用原路径：'+error.message});}
 }
 return {
  get path(){return config.activePath;},
  info(consumeGuide=false){const shouldGuide=!config.guideSeen;if(consumeGuide&&shouldGuide)save({...config,guideSeen:true});return {path:config.activePath,pendingPath:config.pendingPath,shouldGuide,migrationError:config.migrationError||''};},
  choose(target){target=path.resolve(target);if(target===config.activePath){save({...config,pendingPath:null,guideSeen:true,migrationError:''});return this.info();}target=ensureTarget(target,config.activePath);save({...config,pendingPath:target,guideSeen:true,migrationError:''});return this.info();},
  cancel(){save({...config,pendingPath:null,migrationError:''});return this.info();}
 };
}
function install({ipcMain,dialog,shell,win,origin,location,restart}){
 let choosing=false;
 const trusted=event=>{try{return event.sender===win.webContents&&event.senderFrame===win.webContents.mainFrame&&new URL(event.senderFrame.url).origin===origin;}catch{return false;}};
 function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(!trusted(event))throw Error('只允许本地应用主窗口设置存储路径');return fn(...args);});}
 handle('storage-location-info',()=>location.info(true));
 handle('storage-location-choose',async()=>{if(choosing)return {cancelled:true};choosing=true;try{const result=await dialog.showOpenDialog(win,{title:'选择空文件夹作为数据存储目录',defaultPath:location.path,properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths[0])return {cancelled:true};return location.choose(result.filePaths[0]);}finally{choosing=false;}});
 handle('storage-location-cancel',()=>location.cancel());
 handle('storage-location-open',()=>shell.openPath(location.path));
 handle('storage-location-restart',async()=>{if(!location.info().pendingPath)return;await Promise.resolve(win.webContents.session.flushStorageData());restart();});
}
module.exports={createLocation,install};
