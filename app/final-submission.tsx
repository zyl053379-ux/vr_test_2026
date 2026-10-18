'use client';
export default function FinalSubmission({savedCount,submission,busy,onSubmit}:{savedCount:number,submission:any,busy:boolean,onSubmit:()=>void}){
 const submitted=submission?.is_current===1;
 return <section className={'finalsubmission '+(submitted?'complete':'')} aria-label="整份评价提交"><div><span className="eyebrow">{submitted?'SUBMITTED':'FINAL SUBMISSION'}</span><h2>{submitted?'全部评价已提交，感谢您的参与':'提交全部评价'}</h2><p>{submitted?'您的五份材料评价已统一提交给研究者。本次提交已完成，可以关闭页面。':savedCount===5?'五份材料均已填写完整。请点击下方按钮统一提交，所有材料的最新内容会一并保存。':'已完整填写'+savedCount+'/5份材料，请完成其余材料后统一提交。'}</p>{submission?.submitted_at&&<small>最近一次提交：{new Date(submission.submitted_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}{!submitted?' · 修改后待重新提交':''}</small>}</div><button type="button" className="primary" disabled={busy||savedCount!==5||submitted} onClick={onSubmit}>{busy?'正在处理…':submitted?'已完成提交':'提交全部评价 →'}</button></section>
}
