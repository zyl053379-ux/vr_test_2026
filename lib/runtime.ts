import {database} from './database';
import {bucket} from './media';
export const env={DB:database,BUCKET:bucket,get ADMIN_KEY(){return process.env.ADMIN_KEY},get PUBLIC_COLLAB(){return process.env.PUBLIC_COLLAB}};
