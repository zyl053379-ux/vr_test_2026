export const professionalAreas=['VR／XR','交互设计','游戏设计与开发','视听设计／影视动画','叙事研究或创作','用户体验研究','其他相关领域'];
export const profileFields=[
 {key:'years',title:'相关研究或实践年限',options:['不足1年','1—3年','4—6年','7—10年','10年以上']},
 {key:'vrExperience',title:'亲自体验VR作品的经验',options:['尚未亲自体验过','体验过1—2部','体验过3—10部','体验过10部以上']}
] as const;
export type ExpertProfile={areas:string[],otherArea:string,years:string,vrExperience:string};
export function validProfile(p:any):p is ExpertProfile{return !!p&&Array.isArray(p.areas)&&p.areas.length>0&&p.areas.length<=professionalAreas.length&&new Set(p.areas).size===p.areas.length&&p.areas.every((v:any)=>professionalAreas.includes(v))&&typeof p.otherArea==='string'&&p.otherArea.length<=100&&profileFields.every(f=>(f.options as readonly string[]).includes(p[f.key]))}
