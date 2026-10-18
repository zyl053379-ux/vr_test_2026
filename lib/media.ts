import {list,put} from '@vercel/blob';
export const validMediaKey=(key:string)=>/^media\/[A-E]\/(video\.mp4|(?:[1-9]|1[0-6])\.jpg|说明\.pdf)$/.test(key);
export const bucket={async list({prefix}:{prefix:string}){let cursor:string|undefined;const objects:{key:string}[]=[];do{const result=await list({prefix,cursor,limit:1000});objects.push(...result.blobs.map(b=>({key:b.pathname})));cursor=result.hasMore?result.cursor:undefined}while(cursor);return {objects}},async put(key:string,bytes:Uint8Array,options:any){if(!validMediaKey(key))throw new Error('文件编号不正确');return put(key,Buffer.from(bytes),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:options.httpMetadata.contentType})}};
export async function serveMedia(req:Request,key:string){
 if(!validMediaKey(key))return Response.json({error:'没有此材料'},{status:404});
 const token=process.env.BLOB_READ_WRITE_TOKEN;if(!token)return Response.json({error:'材料存储尚未配置'},{status:503});
 const {blobs}=await list({prefix:key,limit:100});const blob=blobs.find(b=>b.pathname===key);if(!blob)return Response.json({error:'材料尚未上传，请联系研究者'},{status:404});
 const url=new URL(blob.url);if(url.protocol!=='https:'||!url.hostname.endsWith('.private.blob.vercel-storage.com'))throw new Error('材料存储必须为私有');
 const headers=new Headers({Authorization:'Bearer '+token});for(const key of ['Range','If-Range']){const value=req.headers.get(key);if(value)headers.set(key,value)}
 const response=await fetch(url,{headers,cache:'no-store',redirect:'error'});const output=new Headers({'Cache-Control':'private, no-store'});for(const key of ['Content-Type','Content-Length','Content-Range','Accept-Ranges','ETag']){const value=response.headers.get(key);if(value)output.set(key,value)}
 return new Response(response.body,{status:response.status,headers:output});
}
