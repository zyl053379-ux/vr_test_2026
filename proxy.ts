import {NextRequest,NextResponse} from 'next/server';
import {gateCookie,validEntrance} from './lib/access';
export function proxy(req:NextRequest){const path=req.nextUrl.pathname;if(path==='/entrance'||path==='/api/entrance'||path==='/api/admin/upload')return NextResponse.next();if(validEntrance(req.cookies.get(gateCookie)?.value))return NextResponse.next();if(path.startsWith('/api/'))return NextResponse.json({error:'请先输入入口密码'},{status:401,headers:{'Cache-Control':'no-store'}});const url=new URL('/entrance',req.url);if(req.nextUrl.searchParams.get('test')==='1')url.searchParams.set('test','1');return NextResponse.redirect(url)}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg).*)']};
