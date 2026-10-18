import {env} from '../../../lib/runtime';
import {serveMedia} from '../../../lib/media';
import {postgresSchema} from '../../../lib/schema';
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
 if(path==='admin/setup'&&method==='POST'){
 const b=await req.json() as any;if(b.confirm!=='INITIALIZE_SCHEMA')return reply({error:'初始化确认不匹配'},400);
 await env.DB.batch(postgresSchema.split(';').map(s=>s.trim()).filter(Boolean).map(s=>env.DB.prepare(s)));return reply({ok:true})
 }
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
 const experts=(await env.DB!.prepare('SELECT e.id,s.label,e.sequence,e.created_at,p.data AS profile FROM panel_slots s JOIN experts e ON e.id=s.expert_id LEFT JOIN profiles p ON p.expert_id=e.id JOIN submissions complete ON complete.expert_id=e.id ORDER BY s.label').all()).results;
 const reviews=(await env.DB!.prepare('SELECT r.*,s.label,e.sequence FROM reviews r JOIN experts e ON e.id=r.expert_id JOIN panel_slots s ON s.expert_id=e.id JOIN submissions complete ON complete.expert_id=e.id ORDER BY submitted_at DESC').all()).results;
 const trialExperts=(await env.DB!.prepare("SELECT e.id,e.label,e.sequence,e.created_at,p.data AS profile FROM experts e LEFT JOIN profiles p ON p.expert_id=e.id WHERE e.label ~ '^T[0-9]+$' AND EXISTS(SELECT 1 FROM submissions complete WHERE complete.expert_id=e.id) ORDER BY e.created_at").all()).results;
 const trialReviews=(await env.DB!.prepare("SELECT r.*,e.label,e.sequence FROM reviews r JOIN experts e ON e.id=r.expert_id WHERE e.label ~ '^T[0-9]+$' AND EXISTS(SELECT 1 FROM submissions complete WHERE complete.expert_id=e.id) ORDER BY submitted_at DESC").all()).results;
 const readiness=[];for(const m of letters){const files=await env.BUCKET!.list({prefix:'media/'+m+'/'});readiness.push({material:m,video:files.objects.some(o=>o.key.endsWith('/video.mp4')),images:files.objects.filter(o=>/\.jpg$/.test(o.key)).length})}
 const submissions=(await env.DB!.prepare('SELECT expert_id,submitted_at,is_current FROM submissions').all()).results as any[];
 const withStatus=(rows:any[])=>rows.map(row=>{const overall=submissions.find(s=>s.expert_id===(row.expert_id||row.id));return {...row,overall_submitted:overall?.is_current===1,overall_submitted_at:overall?.submitted_at||null}});
 return reply({experts:withStatus(experts),reviews:withStatus(reviews),trialExperts:withStatus(trialExperts),trialReviews:withStatus(trialReviews),readiness,mediaProxy:!!process.env.MEDIA_ORIGIN,slotLabels,publicMode:false})
 }
 if(path==='admin/review'&&method==='POST'){
 const b=await req.json() as any;if(typeof b.id!=='string'||!validReview(b))return reply({error:'请完整填写五项评分和评语'},400);
 const record=await env.DB!.prepare('SELECT expert_id FROM reviews WHERE id=?').bind(b.id).first<any>();if(!record)return reply({error:'评价不存在'},404);
 await env.DB!.batch([env.DB!.prepare('UPDATE reviews SET scores=?,comments=?,extra=?,submitted_at=? WHERE id=?').bind(JSON.stringify(b.scores),JSON.stringify(b.comments.map((s:string)=>s.trim())),b.extra,new Date().toISOString(),b.id)]);return reply({ok:true})
 }
 if(path==='admin/invite'&&method==='POST'){await req.json();return reply({error:'已改为固定5位专家。请发送统一专家链接，，登记时自动分配E01—E05编号。'},409)}
 if(path==='admin/export'&&method==='GET'){
 const isTrial=new URL(req.url).searchParams.get('scope')==='trial';
 const query=isTrial?"SELECT r.*,e.label,e.sequence,p.data AS profile FROM reviews r JOIN experts e ON e.id=r.expert_id LEFT JOIN profiles p ON p.expert_id=e.id WHERE e.label ~ '^T[0-9]+$' AND EXISTS(SELECT 1 FROM submissions complete WHERE complete.expert_id=e.id) ORDER BY e.label,r.material":"SELECT r.*,s.label,e.sequence,p.data AS profile FROM reviews r JOIN experts e ON e.id=r.expert_id JOIN panel_slots s ON s.expert_id=e.id LEFT JOIN profiles p ON p.expert_id=e.id JOIN submissions complete ON complete.expert_id=e.id ORDER BY s.label,r.material";
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
 if(path==='session'&&method==='GET')return reply({label:'本次评价',testMode:trial(req),needsEnrollment:false,availableSlots:[],profile:null,reviews:[],submission:null,sequence:letters});
 if(['enroll','profile','review'].includes(path)&&method==='POST'){await req.json();return reply({error:'填写仅暂存在页面，请使用“提交全部评价”统一提交'},409)}
 if(path==='finalize'&&method==='POST'){
 const b=await req.json() as any;if(!validProfile(b.profile)||typeof b.submissionKey!=='string'||!/^[0-9a-f-]{72}$/i.test(b.submissionKey))return reply({error:'请填写专业背景后完成全部评价'},400);
 if(!Array.isArray(b.reviews)||b.reviews.length!==5||new Set(b.reviews.map((r:any)=>r.material)).size!==5||!letters.every(m=>b.reviews.some((r:any)=>r.material===m&&validReview(r)&&r.watched===true)))return reply({error:'请完整填写五份材料，并确认已查看全部材料后再提交'},400);
 const tokenHash=await sha(b.submissionKey),testMode=trial(req),p=b.profile,profile={areas:p.areas,otherArea:p.areas.includes('其他相关领域')?p.otherArea.trim():'',...Object.fromEntries(profileFields.map(f=>[f.key,p[f.key]]))};
 const sequence=Array.isArray(b.sequence)&&b.sequence.length===5&&new Set(b.sequence).size===5&&b.sequence.every((m:any)=>letters.includes(m))?b.sequence:letters;
 const rows=letters.map(material=>{const r=b.reviews.find((r:any)=>r.material===material);return {material,scores:r.scores,comments:r.comments.map((s:string)=>s.trim()),extra:r.extra,watched:true}});
 for(let attempt=0;attempt<8;attempt++){
 const existing=await env.DB.prepare('SELECT e.id,e.label,s.submitted_at,p.label AS panel_label FROM experts e JOIN submissions s ON s.expert_id=e.id LEFT JOIN panel_slots p ON p.expert_id=e.id WHERE token_hash=?').bind(tokenHash).first<any>();
 if(existing)return reply({ok:true,label:existing.panel_label||existing.label,submittedAt:existing.submitted_at});
 const occupied=(await env.DB.prepare('SELECT p.label FROM panel_slots p JOIN submissions s ON s.expert_id=p.expert_id').all()).results as any[],label=testMode?await nextLabel('T'):slotLabels.find(label=>!occupied.some(s=>s.label===label));
 if(!label)return reply({error:'本轮五份正式专家答卷已收齐，请联系研究者'},409);
 const id=crypto.randomUUID(),time=new Date().toISOString(),ops=[env.DB.prepare('INSERT INTO experts(id,token_hash,label,sequence,created_at) VALUES(?,?,?,?,?)').bind(id,tokenHash,testMode?label:'panel-'+id,JSON.stringify(sequence),time)];
 if(!testMode){
 // Reassign slots held only by legacy incomplete registrations. Their expert/profile rows are preserved.
 ops.push(env.DB.prepare('INSERT INTO panel_slots(label,expert_id,created_at) VALUES(?,?,?) ON CONFLICT(label) DO UPDATE SET expert_id=excluded.expert_id,created_at=excluded.created_at WHERE NOT EXISTS(SELECT 1 FROM submissions s WHERE s.expert_id=panel_slots.expert_id)').bind(label,id,time));
 // Abort the complete transaction if a concurrent final submission claimed this slot first.
 ops.push(env.DB.prepare('SELECT 1 / COUNT(*)::integer FROM panel_slots WHERE label=? AND expert_id=?').bind(label,id));
 }
 ops.push(env.DB.prepare('INSERT INTO profiles(expert_id,data,updated_at) VALUES(?,?,?)').bind(id,JSON.stringify(profile),time));
 for(const row of rows)ops.push(env.DB.prepare('INSERT INTO reviews(id,expert_id,material,scores,comments,extra,submitted_at,watched) VALUES(?,?,?,?,?,?,?,1)').bind(crypto.randomUUID(),id,row.material,JSON.stringify(row.scores),JSON.stringify(row.comments),row.extra,time));
 ops.push(env.DB.prepare('INSERT INTO submissions(expert_id,submitted_at,snapshot,is_current) VALUES(?,?,?,1)').bind(id,time,JSON.stringify({profile,reviews:rows})));
 try{await env.DB.batch(ops);return reply({ok:true,label,submittedAt:time})}catch(error){if(/unique|duplicate key|23505|division by zero/i.test(String(error)))continue;throw error}
 }
 return reply({error:'提交人数较多，请稍后再次提交；当前页面内容仍保留'},409)
 }
 return reply({error:'没有此页面'},404)
 }catch(error){console.error('review request failed',error instanceof Error?error.message:'unknown');return reply({error:'服务暂时不可用，请稍后重试；请保留当前页面，稍后重试'},500)}}
export const GET=handle;export const POST=handle;export const PUT=handle;
