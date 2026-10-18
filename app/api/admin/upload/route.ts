import {handleUpload,type HandleUploadBody} from '@vercel/blob/client';
import {createHash} from 'node:crypto';
import {gateCookie,validEntrance,readCookie,safeEqual} from '../../../../lib/access';
import {validMediaKey} from '../../../../lib/media';
export const runtime='nodejs';
export async function POST(req:Request){try{const body=await req.json() as HandleUploadBody;const response=await handleUpload({body,request:req,onBeforeGenerateToken:async pathname=>{if(req.headers.get('origin')!==new URL(req.url).origin||!validEntrance(readCookie(req,gateCookie)))throw new Error('请先输入入口密码');const token=readCookie(req,'vr_admin'),admin=process.env.ADMIN_KEY;const hash=(s:string)=>createHash('sha256').update(s).digest('hex');if(!token||!admin||!safeEqual(hash(token),hash(admin)))throw new Error('请先登录研究者后台');if(!validMediaKey(pathname))throw new Error('材料文件名不正确');return {allowedContentTypes:['video/mp4','image/jpeg','application/pdf'],maximumSizeInBytes:5*1024**3,addRandomSuffix:false,allowOverwrite:true}},onUploadCompleted:async()=>{}});return Response.json(response)}catch{return Response.json({error:'上传未获授权或参数不正确'},{status:403})}}
