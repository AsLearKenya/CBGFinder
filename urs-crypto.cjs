// Password and optional request encryption observed in the public NetEase URS bundle.
// This module performs no network requests and does not store credentials.
'use strict';
const {createPublicKey,publicEncrypt,constants,randomInt,createCipheriv,getCiphers}=require('node:crypto');
const PUBLIC_KEY=`-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC5gsH+AA4XWONB5TDcUd+xCz7e
jOFHZKlcZDx+pF1i7Gsvi1vjyJoQhRtRSn950x498VUkx7rUxg1/ScBVfrRxQOZ8
xFBye3pjAzfb22+RCuYApSVpJ3OO3KsEuKExftz9oFBv3ejxPlYc5yq7YiBO8XlT
nQN0Sa4R4qhPO3I2MQIDAQAB
-----END PUBLIC KEY-----`;
const nativeSM4=getCiphers().includes('sm4-ecb');
const SM4_KEY='BC60B8B9E4FFEFFA219E5AD77F11F9E2';
function encryptPassword(password,{publicKey=PUBLIC_KEY,random=randomInt}={}){
 if(typeof password!=='string'||!password.length)throw new Error('密码不能为空');
 // The observed URS RSA routine pads charCodeAt values directly, without UTF-8 encoding.
 if(/[^\x00-\xff]/.test(password))throw new Error('当前官网 RSA 密码编码仅支持单字节字符');
 const key=createPublicKey(publicKey),size=Math.ceil(key.asymmetricKeyDetails.modulusLength/8);
 const message=Buffer.from(password,'latin1');
 if(message.length>size-11)throw new Error(`密码超出 RSA 加密长度上限（${size-11} 字节）`);
 const block=Buffer.alloc(size);block[1]=2;message.copy(block,size-message.length);
 // Match URS pkcs1pad2: random padding bytes are drawn from 1 through 254.
 for(let i=size-message.length-2;i>=2;i--){const value=random(1,255);if(!Number.isInteger(value)||value<1||value>254)throw new Error('无效的随机填充值');block[i]=value;}
 try{return publicEncrypt({key,padding:constants.RSA_NO_PADDING},block).toString('base64');}
 finally{message.fill(0);block.fill(0);}
}
function encryptParams(params){
 const json=JSON.stringify(params);if(json===undefined)throw new Error('请求参数必须可以序列化');
 // Electron uses BoringSSL, which does not expose SM4. Preserve the exact URS wire format.
 if(!nativeSM4)return require('sm-crypto').sm4.encrypt(json,SM4_KEY,{mode:'ecb',padding:'pkcs#7',output:'string'});
 const cipher=createCipheriv('sm4-ecb',Buffer.from(SM4_KEY,'hex'),null);
 return Buffer.concat([cipher.update(json,'utf8'),cipher.final()]).toString('hex');
}
module.exports={PUBLIC_KEY,encryptPassword,encryptParams};
