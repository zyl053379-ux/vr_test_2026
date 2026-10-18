import {createHmac,timingSafeEqual} from 'node:crypto';
export const gateCookie='vr_entrance';
export function safeEqual(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
function signature(time:string){const secret=process.env.AUTH_SECRET,password=process.env.ENTRY_PASSWORD;if(!secret||!password)throw new Error('入口尚未配置');return createHmac('sha256',secret).update('expert-entrance:'+password+':'+time).digest('base64url')}
export function issueEntrance(now=Date.now()){const time=String(now);return time+'.'+signature(time)}
export function validEntrance(value:string|undefined,now=Date.now()){if(!value)return false;const parts=value.split('.');if(parts.length!==2||!/^\d+$/.test(parts[0]))return false;const time=Number(parts[0]);if(time>now||now-time>7*86400000)return false;try{return safeEqual(parts[1],signature(parts[0]))}catch{return false}}
export function readCookie(req:Request,key:string){return (req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||''}
