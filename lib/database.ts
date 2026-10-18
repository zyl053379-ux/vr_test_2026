import {neon} from '@neondatabase/serverless';
function connection(){const url=process.env.DATABASE_URL;if(!url)throw new Error('数据库尚未配置');return neon(url)}
export function postgresSql(sql:string){let index=0;return sql.replace(/\?/g,()=>'$'+(++index))}
class Statement{
 constructor(public sql:string,public args:any[]=[]){ }
 bind(...args:any[]){return new Statement(this.sql,args)}
 async all(){return {results:await connection().query(postgresSql(this.sql),this.args)}}
 async first<T=any>():Promise<T|null>{const {results}=await this.all();return (results[0] as T)||null}
 async run(){await this.all();return {success:true}}
}
export const database={prepare:(sql:string)=>new Statement(sql),async batch(ops:Statement[]){const sql=connection();return sql.transaction(ops.map(op=>sql.query(postgresSql(op.sql),op.args)))}};
