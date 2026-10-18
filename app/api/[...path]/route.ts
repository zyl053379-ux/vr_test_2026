import {env} from '../../../lib/runtime';
import {serveMedia} from '../../../lib/media';
export const runtime='nodejs';
import { rubric } from '../../rubric';
import {validProfile,profileFields} from '../../profile-fields';
export const dynamic='force-dynamic';
const letters=['A','B','C','D','E'];
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
const reply=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function cookie(req:Request,key:string){return (req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||''}
const publicMode=()=>String((env as any).PUBLIC_COLLAB)==='true';
async function adminToken(supplied:string){const key=(env as any).ADMIN_KEY;return !!key&&!!supplied&&(await sha(supplied))===(await sha(key))}
async function admin(req:Request){return adminToken(req.headers.get('authorization')?.replace(/^Bearer /,'')||cookie(req,'vr_admin'))}
const trial=(req:Request)=>new URL(req.url).searchParams.get('test')==='1';
async function nextLabel(prefix:string){const row=await env.DB!.prepare("SELECT COALESCE(MAX(CAST(substr(label,2) AS INTEGER)),0) n FROM experts WHERE label ~ ?").bind('^'+prefix+'[0-9]+$').first<any>();return prefix+String(Number(row.n)+1).padStart(2,'0')}
const slotLabels=['E01','E02','E03','E04','E05'];
async function expert(req:Request){
 const testMode=trial(req),cookieName=testMode?'vr_trial':'vr_expert',c=cookie(req,cookieName);
 if(c){const e=await env.DB!.prepare('SELECT e.id,e.label,e.sequence,s.label AS panel_label FROM experts e LEFT JOIN panel_slots s ON s.expert_id=e.id WHERE e.token_hash=?').bind(await sha(c)).first<any>();if(e)return {...e,label:testMode?e.label:(e.panel_label||'待分配'),needsEnrollment:!testMode&&!e.panel_label,cookieName,testMode}}
 if(!testMode)return {id:null,label:'待分配',sequence:'[]',needsEnrollment:true,cookieName,testMode:false};
 if(!publicMode())return null;
 const id=crypto.randomUUID(),newToken=crypto.randomUUID()+crypto.randomUUID(),sequence=JSON.stringify(letters);
 for(let i=0;i<8;i++){try{const label=await nextLabel('T');await env.DB!.prepare('INSERT INTO experts(id,token_hash,label,sequence,created_at) VALUES(?,?,?,?,?)').bind(id,await sha(newToken),label,sequence,new Date().toISOString()).run();return {id,label,sequence,newToken,cookieName,testMode:true,needsEnrollment:false}}catch(error){if(!/unique|duplicate key|23505/i.test(String(error))||i===7)throw error}}
 return null
}

const validReview=(b:any)=>Array.isArray(b.scores)&&b.scores.length===5&&b.scores.every((s:any)=>s==='NA'||(Number.isInteger(s)&&s>=1&&s<=5))&&Array.isArray(b.comments)&&b.comments.length===5&&b.comments.every((s:any)=>typeof s==='string'&&s.trim().length>0&&s.length<=6000)&&typeof b.extra==='string'&&b.extra.length<=6000;
const validKey=(s:string)=>/^media\/[A-E]\/(video\.mp4|(?:[1-9]|1[0-6])\.jpg|说明\.pdf)$/.test(s);
async function handle(req:Request){try{
 const path=decodeURIComponent(new URL(req.url).pathname.slice(5)), method=req.method;
 if(method!=='GET'&&req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return reply({error:'请求来源不匹配'},403);
 if(path==='login'&&method==='POST'){
 const b=await req.json() as any;if(typeof b.token!=='string'||b.token.length>200)return reply({error:'请输入有效访问码'},400);
 let name='vr_expert';
 if(b.admin){if(!await adminToken(b.token))return reply({error:'管理访问码不正确'},403);name='vr_admin'}
 else if(!await env.DB!.prepare('SELECT id FROM experts WHERE token_hash=?').bind(await sha(b.token)).first())return reply({error:'邀请链接无效，请联系研究者'},403);
 return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':name+'='+b.token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800'+(new URL(req.url).protocol==='https:'?'; Secure':'')}});
 }
 if(path==='logout'&&method==='POST'){const r=reply({ok:true});r.headers.append('Set-Cookie','vr_expert=; Path=/; Max-Age=0');r.headers.append('Set-Cookie','vr_trial=; Path=/; Max-Age=0');r.headers.append('Set-Cookie','vr_admin=; Path=/; Max-Age=0');return r}
 if(path.startsWith('admin')){
 if(!await admin(req))return reply({error:'请先输入管理访问码'},401);
 if(path==='admin/data-snapshot'&&method==='GET'){
 const tables=['experts','profiles','panel_slots','reviews','submissions'],data:any={};
 for(const table of tables)data[table]=(await env.DB!.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results;
 return reply({data,fingerprint:await sha(JSON.stringify(data))})
 }
 if(path==='admin/reset-data'&&method==='POST'){
 const b=await req.json() as any;if(b.confirm!=='RESET_EVALUATION_DATA')return reply({error:'清理确认不匹配'},400);
 const tables=['experts','profiles','panel_slots','reviews','submissions'],data:any={};
 for(const table of tables)data[table]=(await env.DB!.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results;
 if(b.fingerprint!==await sha(JSON.stringify(data)))return reply({error:'数据已经变化，请重新备份后清理'},409);
 const ids=data.experts.map((r:any)=>r.id);if(!ids.length)return reply({ok:true,deletedExperts:0});
 const placeholders=ids.map(()=>'?').join(','),ops=['submissions','reviews','profiles','panel_slots'].map(table=>env.DB!.prepare('DELETE FROM '+table+' WHERE expert_id IN ('+placeholders+')').bind(...ids));
 ops.push(env.DB!.prepare('DELETE FROM experts WHERE id IN ('+placeholders+')').bind(...ids));
 await env.DB!.batch(ops);return reply({ok:true,deletedExperts:ids.length})
 }
 if(path==='admin'&&method==='GET'){
 const experts=(await env.DB!.prepare('SELECT e.id,s.label,e.sequence,e.created_at,p.data AS profile FROM panel_slots s JOIN experts e ON e.id=s.expert_id LEFT JOIN profiles p ON p.expert_id=e.id ORDER BY s.label').all()).results;
 const reviews=(await env.DB!.prepare('SELECT r.*,s.label,e.sequence FROM reviews r JOIN experts e ON e.id=r.expert_id JOIN panel_slots s ON s.expert_id=e.id ORDER BY submitted_at DESC').all()).results;
 const trialExperts=(await env.DB!.prepare("SELECT e.id,e.label,e.sequence,e.created_at,p.data AS profile FROM experts e LEFT JOIN profiles p ON p.expert_id=e.id WHERE e.label ~ '^T[0-9]+$' ORDER BY e.created_at").all()).results;
 const trialReviews=(await env.DB!.prepare("SELECT r.*,e.label,e.sequence FROM reviews r JOIN experts e ON e.id=r.expert_id WHERE e.label ~ '^T[0-9]+$' ORDER BY submitted_at DESC").all()).results;
 const readiness=[];for(const m of letters){const files=await env.BUCKET!.list({prefix:'media/'+m+'/'});readiness.push({material:m,video:files.objects.some(o=>o.key.endsWith('/video.mp4')),images:files.objects.filter(o=>/\.jpg$/.test(o.key)).length})}
 const submissions=(await env.DB!.prepare('SELECT expert_id,submitted_at,is_current FROM submissions').all()).results as any[];
 const withStatus=(rows:any[])=>rows.map(row=>{const overall=submissions.find(s=>s.expert_id===(row.expert_id||row.id));return {...row,overall_submitted:overall?.is_current===1,overall_submitted_at:overall?.submitted_at||null}});
 return reply({experts:withStatus(experts),reviews:withStatus(reviews),trialExperts:withStatus(trialExperts),trialReviews:withStatus(trialReviews),readiness,mediaProxy:!!process.env.MEDIA_ORIGIN,slotLabels,publicMode:false})
 }
 if(path==='admin/review'&&method==='POST'){
 const b=await req.json() as any;if(typeof b.id!=='string'||!validReview(b))return reply({error:'请完整填写五项评分和评语'},400);
 const record=await env.DB!.prepare('SELECT expert_id FROM reviews WHERE id=?').bind(b.id).first<any>();if(!record)return reply({error:'评价不存在'},404);
 await env.DB!.batch([env.DB!.prepare('UPDATE reviews SET scores=?,comments=?,extra=?,submitted_at=? WHERE id=?').bind(JSON.stringify(b.scores),JSON.stringify(b.comments.map((s:string)=>s.trim())),b.extra,new Date().toISOString(),b.id),env.DB!.prepare('UPDATE submissions SET is_current=0 WHERE expert_id=?').bind(record.expert_id)]);return reply({ok:true})
 }
 if(path==='admin/invite'&&method==='POST'){await req.json();return reply({error:'已改为固定5位专家。请发送统一专家链接，，登记时自动分配E01—E05编号。'},409)}
 if(path==='admin/export'&&method==='GET'){
 const isTrial=new URL(req.url).searchParams.get('scope')==='trial';
 const query=isTrial?"SELECT r.*,e.label,e.sequence,p.data AS profile FROM reviews r JOIN experts e ON e.id=r.expert_id LEFT JOIN profiles p ON p.expert_id=e.id WHERE e.label ~ '^T[0-9]+$' ORDER BY e.label,r.material":"SELECT r.*,s.label,e.sequence,p.data AS profile FROM reviews r JOIN experts e ON e.id=r.expert_id JOIN panel_slots s ON s.expert_id=e.id LEFT JOIN profiles p ON p.expert_id=e.id ORDER BY s.label,r.material";
 const rows=(await env.DB!.prepare(query).all()).results as any[];
 const submissions=(await env.DB!.prepare('SELECT expert_id,submitted_at,is_current FROM submissions').all()).results as any[];
 const cell=(v:any)=>'"'+String(/^[=+\-@\t\r]/.test(String(v))?"'"+v:v).replaceAll('"','""')+'"';
 const titles=['专家编号','材料编号','观看顺序',...rubric.map(d=>d.name+'评分'),...rubric.map(d=>d.name+'评语'),'补充意见','提交时间（UTC）','相关领域','其他领域',...profileFields.map(f=>f.title),'整份提交状态','整份提交时间（UTC）'];
 const lines=[titles,...rows.map(r=>{const p=r.profile?JSON.parse(r.profile):null,overall=submissions.find(s=>s.expert_id===r.expert_id);return [r.label,r.material,JSON.parse(r.sequence).indexOf(r.material)+1,...JSON.parse(r.scores).map((s:any)=>s==='NA'?'无法判断':s),...JSON.parse(r.comments),r.extra,r.submitted_at,p?.areas.join('；')||'',p?.otherArea||'',...profileFields.map(f=>p?.[f.key]||''),overall?.is_current===1?'已全部提交':overall?'修改后待重新提交':'填写中',overall?.submitted_at||'']})];
 return new Response('\uFEFF'+lines.map(r=>r.map(cell).join(',')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="expert-reviews.csv"','Cache-Control':'no-store'}})
 }
 if(path==='admin/images'&&method==='POST'){
 const b=await req.json() as any;if(!letters.includes(b.material)||!Array.isArray(b.images)||b.images.length>16)return reply({error:'图片参数不正确'},400);
 for(const image of b.images){if(!Number.isInteger(image.number)||image.number<1||image.number>16||typeof image.data!=='string'||image.data.length>4000000)return reply({error:'图片编号或大小不正确'},400)}
 for(const image of b.images){const bytes=Uint8Array.from(atob(image.data),(c:string)=>c.charCodeAt(0));await env.BUCKET!.put('media/'+b.material+'/'+image.number+'.jpg',bytes,{httpMetadata:{contentType:'image/jpeg'}})}return reply({ok:true,count:b.images.length})
 }
 return reply({error:'没有此操作'},404)
 }
 if(path.startsWith('media/')&&method==='GET')return serveMedia(req,path);
 const e=await expert(req);if(!e)return reply({error:'请通过研究者提供的专属链接进入'},401);
 if(path==='session'&&method==='GET'){
 const profile=e.id?await env.DB!.prepare('SELECT data FROM profiles WHERE expert_id=?').bind(e.id).first<any>():null;
 const occupied=(await env.DB!.prepare('SELECT label,expert_id FROM panel_slots').all()).results as any[];
 const availableSlots=slotLabels.map(label=>({label,available:!occupied.some(s=>s.label===label&&s.expert_id!==e.id)}));
 const reviews=e.id?(await env.DB!.prepare('SELECT material,scores,comments,extra,submitted_at FROM reviews WHERE expert_id=?').bind(e.id).all()).results:[];
 const submission=e.id?await env.DB!.prepare('SELECT submitted_at,is_current FROM submissions WHERE expert_id=?').bind(e.id).first():null;
 const r=reply({draftKey:e.id,submission,label:e.label,publicMode:false,testMode:e.testMode,needsEnrollment:!!e.needsEnrollment,availableSlots,profile:profile?JSON.parse(profile.data):null,sequence:JSON.parse(e.sequence),reviews});
 if(e.newToken)r.headers.set('Set-Cookie',e.cookieName+'='+e.newToken+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'+(new URL(req.url).protocol==='https:'?'; Secure':''));return r
 }
 if(path==='enroll'&&method==='POST'){
 const b=await req.json() as any;if(!validProfile(b.profile)||e.testMode)return reply({error:'请完成三项专业背景信息'},400);
 const id=e.id||crypto.randomUUID(),newToken=e.id?null:crypto.randomUUID()+crypto.randomUUID(),now=new Date().toISOString();
 const p=b.profile,profile={areas:p.areas,otherArea:p.areas.includes('其他相关领域')?p.otherArea.trim():'',...Object.fromEntries(profileFields.map(f=>[f.key,p[f.key]]))};
 for(let attempt=0;attempt<8;attempt++){
 const bound=await env.DB!.prepare('SELECT label FROM panel_slots WHERE expert_id=?').bind(id).first<any>();
 const occupied=(await env.DB!.prepare('SELECT label FROM panel_slots').all()).results as any[];
 const label=bound?.label||slotLabels.find(label=>!occupied.some(s=>s.label===label));
 if(!label)return reply({error:'5个正式专家名额已登记完毕。若您已登记，请用原浏览器继续；研究者试填请使用试填链接。'},409);
 const index=slotLabels.indexOf(label),sequence=JSON.stringify([...letters.slice(index),...letters.slice(0,index)]);
 const ops=[];if(!e.id&&!bound)ops.push(env.DB!.prepare('INSERT INTO experts(id,token_hash,label,sequence,created_at) VALUES(?,?,?,?,?)').bind(id,await sha(newToken!),'panel-'+id,sequence,now));
 if(!bound)ops.push(env.DB!.prepare('INSERT INTO panel_slots(label,expert_id,created_at) VALUES(?,?,?)').bind(label,id,now));
 ops.push(env.DB!.prepare('UPDATE experts SET sequence=? WHERE id=?').bind(sequence,id));
 ops.push(env.DB!.prepare('INSERT INTO profiles(expert_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(expert_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(id,JSON.stringify(profile),now));
 try{await env.DB!.batch(ops)}catch(error){if(/unique|duplicate key|23505/i.test(String(error)))continue;throw error}
 const r=reply({ok:true,label});if(newToken)r.headers.set('Set-Cookie','vr_expert='+newToken+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'+(new URL(req.url).protocol==='https:'?'; Secure':''));return r
 }
 return reply({error:'登记人数较多，请稍后再次提交，您的填写内容会保留。'},409)
 }
 if(path==='finalize'&&method==='POST'){
 const b=await req.json() as any;if(!e.id||e.needsEnrollment)return reply({error:'请先完成专家信息登记'},409);
 const p=await env.DB!.prepare('SELECT data FROM profiles WHERE expert_id=?').bind(e.id).first<any>();if(!p||!validProfile(JSON.parse(p.data)))return reply({error:'请先完成专业背景信息'},409);
 const stored=(await env.DB!.prepare('SELECT material,scores,comments,extra,watched FROM reviews WHERE expert_id=?').bind(e.id).all()).results as any[];
 const values=Array.isArray(b.reviews)?b.reviews:stored.map(r=>({...r,scores:JSON.parse(r.scores),comments:JSON.parse(r.comments),watched:r.watched===1}));
 const missing=letters.filter(m=>!values.some((r:any)=>r.material===m&&validReview(r)&&r.watched===true));
 if(values.length!==5||new Set(values.map((r:any)=>r.material)).size!==5||missing.length)return reply({error:'请先完整填写并确认材料'+(missing.length?missing.join('、'):'A—E')+'的评价'},400);
 const rows=letters.map(material=>{const r=values.find((r:any)=>r.material===material);return {material,scores:r.scores,comments:r.comments.map((t:string)=>t.trim()),extra:r.extra,watched:true}}),time=new Date().toISOString();
 const ops=rows.map(r=>env.DB!.prepare('INSERT INTO reviews(id,expert_id,material,scores,comments,extra,submitted_at,watched) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(expert_id,material) DO UPDATE SET scores=excluded.scores,comments=excluded.comments,extra=excluded.extra,submitted_at=excluded.submitted_at').bind(crypto.randomUUID(),e.id,r.material,JSON.stringify(r.scores),JSON.stringify(r.comments),r.extra,time));
 ops.push(env.DB!.prepare('INSERT INTO submissions(expert_id,submitted_at,snapshot,is_current) VALUES(?,?,?,1) ON CONFLICT(expert_id) DO UPDATE SET submitted_at=excluded.submitted_at,snapshot=excluded.snapshot,is_current=1').bind(e.id,time,JSON.stringify({profile:JSON.parse(p.data),reviews:rows})));
 await env.DB!.batch(ops);return reply({ok:true,submittedAt:time})
 }
 if(path==='profile'&&method==='POST'){
 const p=await req.json() as any;if(!e.id||e.needsEnrollment)return reply({error:'请先登记专业背景信息'},409);if(!validProfile(p))return reply({error:'请完成专业背景选项，并检查填写内容'},400);
 const data={areas:p.areas,otherArea:p.areas.includes('其他相关领域')?p.otherArea.trim():'',...Object.fromEntries(profileFields.map(f=>[f.key,p[f.key]]))},json=JSON.stringify(data),time=new Date().toISOString();
 const previous=await env.DB!.prepare('SELECT data FROM profiles WHERE expert_id=?').bind(e.id).first<any>();
 const ops=[env.DB!.prepare('INSERT INTO profiles(expert_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(expert_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').bind(e.id,json,time)];
 if(previous?.data!==json)ops.push(env.DB!.prepare('UPDATE submissions SET is_current=0 WHERE expert_id=?').bind(e.id));
 await env.DB!.batch(ops);return reply({ok:true})
 }
 if(path==='review'&&method==='POST'){
 const b=await req.json() as any;
 if(!e.id||e.needsEnrollment)return reply({error:'请先完成专家信息登记'},409);
 if(!await env.DB!.prepare('SELECT expert_id FROM profiles WHERE expert_id=?').bind(e.id).first())return reply({error:'请先填写一次专业背景信息，再提交评价'},409);
 if(!letters.includes(b.material)||!Array.isArray(b.scores)||b.scores.length!==5||!b.scores.every((s:any)=>s==='NA'||(Number.isInteger(s)&&s>=1&&s<=5))||!Array.isArray(b.comments)||b.comments.length!==5||!b.comments.every((s:any)=>typeof s==='string'&&s.trim().length>0&&s.length<=6000)||typeof b.extra!=='string'||b.extra.length>6000||b.watched!==true)return reply({error:'请完成五项评分、五项评语，并确认已查看材料'},400);
 const time=new Date().toISOString();await env.DB!.batch([env.DB!.prepare('INSERT INTO reviews(id,expert_id,material,scores,comments,extra,submitted_at,watched) VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(expert_id,material) DO UPDATE SET scores=excluded.scores,comments=excluded.comments,extra=excluded.extra,submitted_at=excluded.submitted_at').bind(crypto.randomUUID(),e.id,b.material,JSON.stringify(b.scores),JSON.stringify(b.comments.map((s:string)=>s.trim())),b.extra,time),env.DB!.prepare('UPDATE submissions SET is_current=0 WHERE expert_id=?').bind(e.id)]);return reply({ok:true,submittedAt:time})
 }
 return reply({error:'没有此页面'},404)
 }catch(error){console.error('review request failed',error instanceof Error?error.message:'unknown');return reply({error:'服务暂时不可用，请稍后重试；您的本地草稿仍保留'},500)}}
export const GET=handle;export const POST=handle;export const PUT=handle;
