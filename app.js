try{document.getElementById('appStatus').textContent='프로그램 준비 완료';}catch(e){}
const SUPABASE_URL='https://wgrbolqqemcywxikhjzt.supabase.co';
const SUPABASE_KEY='sb_publishable_hCQV9SPMKUD3cbgbJdjkMg_Z0y6AXGo';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s); const now=new Date(); let adminView=new Date(now.getFullYear(),now.getMonth(),1), employeeView=new Date(now.getFullYear(),now.getMonth(),1);
const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmtMonth=d=>d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',timeZone:'Asia/Seoul'});
$('#adminMonth').textContent=fmtMonth(now); $('#employeeMonth').textContent=fmtMonth(now)+' 근태';
let holidayMap={}; let employeeCalendarAttendance={}; let employeeCalendarLeaves={}; let adminCalendarDetails={}; let adminApprovedOtMap={}; let selectedApprovedOtId=null;
async function loadHolidays(){
 const years=[adminView.getFullYear(),employeeView.getFullYear()]; const y0=Math.min(...years),y1=Math.max(...years);
 const {data,error}=await db.from('holidays').select('holiday_date,name').gte('holiday_date',y0+'-01-01').lte('holiday_date',y1+'-12-31');
 if(!error) holidayMap=Object.fromEntries((data||[]).map(x=>[x.holiday_date,x.name]));
}
function localDateKey(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function isNonWorkingToday(){const d=new Date(),w=d.getDay();return w===0||w===6||!!holidayMap[kstDate()]}
function calendar(el){
 el.innerHTML=''; const view=el.id==='adminCalendar'?adminView:employeeView; const y=view.getFullYear(),m=view.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();
 ['일','월','화','수','목','금','토'].forEach(n=>el.insertAdjacentHTML('beforeend','<div class="dayname">'+n+'</div>'));
 for(let i=0;i<first;i++)el.insertAdjacentHTML('beforeend','<div></div>');
 for(let d=1;d<=last;d++){
  const dt=new Date(y,m,d),w=dt.getDay(),isToday=d===now.getDate(),weekend=w===0||w===6,key=localDateKey(y,m,d),holiday=holidayMap[key];
  const off=weekend||holiday; const att=employeeCalendarAttendance[key], leave=employeeCalendarLeaves[key];
  let label=holiday||((weekend)?'휴무':(isToday?'오늘':''));
  let detail='';
  if(leave){label='';const half=leave.startsWith('__HALF__');const txt=leave.replace('__HALF__','').replace('__ANNUAL__','');detail='<span class="calEvent '+(half?'half':'annual')+'">'+txt+'</span>'}
  if(el.id==='adminCalendar'&&adminCalendarDetails[key]){
    detail=adminCalendarDetails[key].map(x=>adminApprovedOtMap[x]?'<button type="button" class="calEvent overtime otApprovedItem" data-token="'+x+'">'+adminApprovedOtMap[x].employee_name+' '+String(adminApprovedOtMap[x].requested_start).slice(0,5)+'→'+String(adminApprovedOtMap[x].requested_end).slice(0,5)+' '+adminApprovedOtMap[x].duration+'</button>':x).join('');
  }
  if(att?.check_in){
    const mins=att.work_minutes||minutesBetween(att.check_in,att.check_out);
    label='';
    detail='<span class="calEvent normal">'+timeKst(att.check_in)+'→'+(att.check_out?timeKst(att.check_out):'근무중')+(att.check_out?' '+hm(mins):'')+'</span>';
  }
  el.insertAdjacentHTML('beforeend','<div class="day '+(weekend?'weekend ':'')+(holiday?'holiday ':'')+(isToday?'todayCell ':'')+'"><span class="num">'+d+'</span><small>'+label+'</small>'+(detail?'<div class="calEvents">'+String(detail).split('|||').join('')+'</div>':'')+'</div>')
 }
}
async function refreshCalendars(){await loadHolidays();$('#adminCalMonth').textContent=fmtMonth(adminView);$('#employeeCalMonth').textContent=fmtMonth(employeeView);calendar($('#adminCalendar'));calendar($('#employeeCalendar'))}
refreshCalendars();
setInterval(()=>$('#clock').textContent=new Date().toLocaleTimeString('ko-KR',{timeZone:'Asia/Seoul'}),1000);
function show(id){['login','admin','employee','resetPassword'].forEach(x=>$('#'+x).classList.add('hidden'));$('#'+id).classList.remove('hidden');$('#logout').classList.toggle('hidden',id==='login')}
async function profileFor(user){const {data,error}=await db.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;return data}
async function route(session){if(!session){show('login');return}try{const p=await profileFor(session.user);if(!p.access_enabled)throw new Error('접근 권한이 비활성화된 계정입니다.');if(p.role==='admin'){show('admin');await loadAdmin()}else{show('employee');await loadEmployee(p)}}catch(e){await db.auth.signOut();show('login');$('#loginMsg').textContent='계정 프로필을 확인할 수 없습니다: '+e.message}}
$('#loginBtn').onclick=async()=>{const email=$('#userid').value.trim(),password=$('#password').value;$('#loginMsg').textContent='로그인 중...';const {data,error}=await db.auth.signInWithPassword({email,password});if(error){ $('#loginMsg').textContent='로그인 실패: '+error.message;return}$('#loginMsg').textContent='';await route(data.session)};
$('#logout').onclick=async()=>{await db.auth.signOut();show('login')};
$('#forgotPassword').onclick=async()=>{
 const email=$('#userid').value.trim();
 if(!email){$('#loginMsg').textContent='먼저 등록된 이메일을 입력하세요.';return}
 $('#loginMsg').textContent='재설정 메일을 보내는 중...';
 const redirectTo=location.origin+location.pathname;
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
 $('#loginMsg').textContent=error?'메일 발송 실패: '+error.message:'비밀번호 재설정 메일을 보냈습니다. 이메일의 링크를 눌러주세요.';
};
$('#saveNewPassword').onclick=async()=>{
 const a=$('#newPassword').value,b=$('#newPassword2').value;
 if(a.length<8){$('#resetMsg').textContent='비밀번호는 8자 이상으로 설정하세요.';return}
 if(a!==b){$('#resetMsg').textContent='두 비밀번호가 일치하지 않습니다.';return}
 const {error}=await db.auth.updateUser({password:a});
 if(error){$('#resetMsg').textContent='변경 실패: '+error.message;return}
 $('#resetMsg').textContent='비밀번호가 변경되었습니다. 잠시 후 로그인 화면으로 이동합니다.';
 await db.auth.signOut(); setTimeout(()=>{history.replaceState({},'',location.pathname);show('login')},900);
};
function hm(mins){mins=Math.max(0,Number(mins)||0);return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0')}
function minutesBetween(a,b){if(!a||!b)return 0;return Math.max(0,Math.round((new Date(b)-new Date(a))/60000))}
function overtimeRequestMinutes(o){if(!o?.requested_start||!o?.requested_end)return 0;const s=String(o.requested_start).slice(0,5).split(':').map(Number),e=String(o.requested_end).slice(0,5).split(':').map(Number);return Math.max(0,(e[0]*60+e[1])-(s[0]*60+s[1]))}
function approvedOtMinutes(att,ot){
 if(!att?.check_out||!ot||ot.status!=='approved')return 0;
 const out=new Date(att.check_out);
 const [sh,sm]=String(ot.requested_start).slice(0,5).split(':').map(Number),[eh,em]=String(ot.requested_end).slice(0,5).split(':').map(Number);
 const approvedStart=new Date(att.check_out); approvedStart.setHours(sh,sm,0,0);
 const approvedEnd=new Date(att.check_out); approvedEnd.setHours(eh,em,0,0);
 const isReturn=String(ot.reason||'').startsWith('[퇴근 후 긴급복귀]');
 if(isReturn)return Math.max(0,Math.round((approvedEnd-approvedStart)/60000));
 const regularEnd=new Date(att.check_out); regularEnd.setHours(16,0,0,0);
 const actualEnd=out<approvedEnd?out:approvedEnd,actualStart=approvedStart>regularEnd?approvedStart:regularEnd;
 return actualEnd>actualStart?Math.round((actualEnd-actualStart)/60000):0
}
function boundsFor(view){const y=view.getFullYear(),m=String(view.getMonth()+1).padStart(2,'0'),last=new Date(y,view.getMonth()+1,0).getDate();return [y+'-'+m+'-01',y+'-'+m+'-'+String(last).padStart(2,'0')]}
function monthBounds(){return boundsFor(employeeView)}
function timeKst(v){return v?new Date(v).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}):'-'}
async function loadAdmin(){
 await loadHolidays(); $('#adminCalMonth').textContent=fmtMonth(adminView);
 const {data:profiles}=await db.from('profiles').select('*').eq('role','employee').order('name'); const ps=profiles||[];
 $('#employeeCount').textContent=ps.length; $('#leaveCount').textContent=ps.filter(x=>x.employment_status==='leave').length;
 const ids=ps.map(x=>x.id); let histories=[],todayAtt=[],monthAtt=[],grants=[],leaveReq=[],approvedOts=[];
 if(ids.length){
   histories=(await db.from('employment_history').select('*').in('employee_id',ids).order('hire_date',{ascending:false})).data||[];
   todayAtt=(await db.from('attendance').select('*').in('employee_id',ids).eq('work_date',kstDate())).data||[];
   const [ms,me]=boundsFor(adminView); monthAtt=(await db.from('attendance').select('*').in('employee_id',ids).gte('work_date',ms).lte('work_date',me)).data||[];
   grants=(await db.from('annual_leave_grants').select('*').in('employee_id',ids).eq('leave_year',now.getFullYear())).data||[];
   leaveReq=(await db.from('annual_leave_requests').select('*').in('employee_id',ids).eq('status','approved').gte('start_date',ms).lte('start_date',me)).data||[]; approvedOts=(await db.from('overtime_requests').select('*').in('employee_id',ids).eq('status','approved').gte('work_date',ms).lte('work_date',me)).data||[];
 }
 adminCalendarDetails={};
 const year=adminView.getFullYear();
 const yearGrants=(await db.from('annual_leave_grants').select('*').in('employee_id',ids).eq('leave_year',year)).data||[];
 const yearLeaves=(await db.from('annual_leave_requests').select('*').in('employee_id',ids).eq('status','approved').gte('start_date',year+'-01-01').lte('start_date',year+'-12-31').order('start_date',{ascending:true})).data||[];
 const cumulativeByEmployee={};
 yearLeaves.forEach(l=>{cumulativeByEmployee[l.employee_id]=(cumulativeByEmployee[l.employee_id]||0)+Number(l.days||0);const total=yearGrants.filter(g=>g.employee_id===l.employee_id).reduce((s,g)=>s+Number(g.granted_days||0),0);let d=new Date(l.start_date+'T00:00:00Z'),e=new Date(l.end_date+'T00:00:00Z');while(d<=e){const k=d.toISOString().slice(0,10);(adminCalendarDetails[k]??=[]).push('<span class="calEvent '+(Number(l.days)===0.5?'half':'annual')+'">'+(ps.find(p=>p.id===l.employee_id)?.name||'직원')+' '+cumulativeByEmployee[l.employee_id]+'/'+total+'</span>');d.setUTCDate(d.getUTCDate()+1)}});
 monthAtt.forEach(a=>{const p=ps.find(x=>x.id===a.employee_id);if(!p)return;const mins=a.work_minutes||minutesBetween(a.check_in,a.check_out);const line='<span class="calEvent normal">'+p.name+' '+timeKst(a.check_in)+'→'+(a.check_out?timeKst(a.check_out):'근무중')+(a.check_out?' '+hm(mins):'')+'</span>';(adminCalendarDetails[a.work_date]??=[]).push(line)});
 adminApprovedOtMap={};
 approvedOts.forEach(o=>{const p=ps.find(x=>x.id===o.employee_id);if(!p)return;const start=String(o.requested_start).slice(0,5),end=String(o.requested_end).slice(0,5);const mins=Math.max(0,(Number(end.slice(0,2))*60+Number(end.slice(3,5)))-(Number(start.slice(0,2))*60+Number(start.slice(3,5))));const token='__OT_'+o.id+'__';(adminCalendarDetails[o.work_date]??=[]).push(token);adminApprovedOtMap[token]={...o,employee_name:p.name,duration:hm(mins)}});
 calendar($('#adminCalendar'));
 document.querySelectorAll('.otApprovedItem').forEach(b=>b.onclick=()=>openApprovedOt(b.dataset.token));
 const currentFor=id=>histories.find(x=>x.employee_id===id&&['active','leave'].includes(x.status));
 $('#employeeRows').innerHTML=ps.length?ps.map(p=>{const cur=currentFor(p.id),a=todayAtt.find(x=>x.employee_id===p.id),mins=a?(a.work_minutes||minutesBetween(a.check_in,a.check_out||new Date().toISOString())):0;const state=cur?(cur.status==='leave'?'휴직':a?.check_in?(a.check_out?'퇴근':'근무중'):'미출근'):'퇴사/입사대기';const granted=grants.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.granted_days||0),0),used=leaveReq.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.days||0),0);return '<tr><td>'+p.name+'</td><td>'+(cur?.job_description||p.job_description||'-')+'</td><td>'+timeKst(a?.check_in)+'</td><td>'+timeKst(a?.check_out)+'</td><td>'+hm(mins)+'</td><td>'+state+'</td><td><b>'+used+' / '+granted+'</b></td><td><button class="small manageEmp" data-id="'+p.id+'">관리</button></td></tr>'}).join(''):'<tr><td colspan="8">등록된 직원이 없습니다.</td></tr>';
 document.querySelectorAll('.manageEmp').forEach(b=>b.onclick=()=>openManage(b.dataset.id,ps,histories));
 $('#monthlyRows').innerHTML=ps.length?ps.map(p=>{const pa=monthAtt.filter(x=>x.employee_id===p.id),mins=pa.reduce((s,a)=>s+(a.work_minutes||minutesBetween(a.check_in,a.check_out)),0);const ot=approvedOts.filter(o=>o.employee_id===p.id).reduce((s,o)=>s+overtimeRequestMinutes(o),0);const regular=mins;const granted=grants.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.granted_days||0),0);const used=leaveReq.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.days||0),0);return '<tr><td>'+p.name+'</td><td>'+hm(mins)+'</td><td>'+hm(ot)+'</td><td>'+hm(regular+ot)+'</td><td>'+used+' / '+granted+'</td></tr>'}).join(''):'<tr><td colspan="5">등록된 직원이 없습니다.</td></tr>';
 const {data:ots}=await db.from('overtime_requests').select('*').eq('status','pending').order('work_date',{ascending:true}); const pending=ots||[]; $('#pendingCount').textContent=pending.length; $('#todayCount').textContent=todayAtt.filter(x=>x.check_in).length;
 const nameOf=id=>ps.find(p=>p.id===id)?.name||'직원';
 $('#overtimeRequests').innerHTML=pending.length?pending.map(o=>'<div class="request" style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #eee"><b>'+nameOf(o.employee_id)+' · '+o.work_date+'</b><span>'+String(o.requested_start).slice(0,5)+' → '+String(o.requested_end).slice(0,5)+'</span><small>'+o.reason+'</small><div><button class="small approveOt" data-id="'+o.id+'">승인</button><button class="small danger rejectOt" data-id="'+o.id+'">거절</button></div></div>').join(''):'<span class="muted">승인 대기 신청이 없습니다.</span>';
 document.querySelectorAll('.approveOt').forEach(b=>b.onclick=()=>reviewOvertime(b.dataset.id,'approved'));
 document.querySelectorAll('.rejectOt').forEach(b=>b.onclick=()=>reviewOvertime(b.dataset.id,'rejected'));
 const {data:pendingLeaves}=await db.from('annual_leave_requests').select('*').eq('status','pending').order('start_date',{ascending:true});
 const pls=pendingLeaves||[];
 $('#leaveRequests').innerHTML=pls.length?pls.map(l=>'<div class="request" style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #eee"><b>'+nameOf(l.employee_id)+' · '+l.start_date+(l.end_date!==l.start_date?' ~ '+l.end_date:'')+'</b><span>'+Number(l.days)+'일</span><small>'+(l.reason||'사유 없음')+'</small><div><button class="small approveLeave" data-id="'+l.id+'">승인</button><button class="small danger rejectLeave" data-id="'+l.id+'">거절</button></div></div>').join(''):'<span class="muted">승인 대기 신청이 없습니다.</span>';
 document.querySelectorAll('.approveLeave').forEach(b=>b.onclick=()=>reviewLeave(b.dataset.id,'approved'));
 document.querySelectorAll('.rejectLeave').forEach(b=>b.onclick=()=>reviewLeave(b.dataset.id,'rejected'))
}
async function loadEmployee(p){
 window.currentEmployeeProfile=p; await loadHolidays(); $('#employeeCalMonth').textContent=fmtMonth(employeeView);
 $('#employeeName').textContent=p.name+'님'; $('#employeeJob').textContent='담당업무 · '+(p.job_description||'미지정');
 const y=employeeView.getFullYear(),[ms,me]=boundsFor(employeeView);
 const {data:gr}=await db.from('annual_leave_grants').select('granted_days').eq('employee_id',p.id).eq('leave_year',y);
 const granted=(gr||[]).reduce((s,x)=>s+Number(x.granted_days||0),0);
 const {data:lr}=await db.from('annual_leave_requests').select('days').eq('employee_id',p.id).eq('status','approved').gte('start_date',ms).lte('start_date',me);
 const used=(lr||[]).reduce((s,x)=>s+Number(x.days||0),0); $('#leaveUsage').textContent=used+' / '+granted;
 const {data:ma}=await db.from('attendance').select('*').eq('employee_id',p.id).gte('work_date',ms).lte('work_date',me);
 employeeCalendarAttendance=Object.fromEntries((ma||[]).map(a=>[a.work_date,a]));
 const {data:calLeaves}=await db.from('annual_leave_requests').select('start_date,end_date,days').eq('employee_id',p.id).eq('status','approved').lte('start_date',me).gte('end_date',ms);
 employeeCalendarLeaves={};
 const approvedYear=(await db.from('annual_leave_requests').select('start_date,end_date,days').eq('employee_id',p.id).eq('status','approved').gte('start_date',y+'-01-01').lte('start_date',y+'-12-31').order('start_date',{ascending:true})).data||[];
 let cumulative=0;
 approvedYear.forEach(l=>{cumulative+=Number(l.days||0);let d=new Date(l.start_date+'T00:00:00Z'),e=new Date(l.end_date+'T00:00:00Z');while(d<=e){const k=d.toISOString().slice(0,10);employeeCalendarLeaves[k]=(Number(l.days)===0.5?'__HALF__':'__ANNUAL__')+cumulative+'/'+granted;d.setUTCDate(d.getUTCDate()+1)}});
 calendar($('#employeeCalendar'));
 const monthMinutes=(ma||[]).reduce((s,a)=>s+(a.work_minutes||minutesBetween(a.check_in,a.check_out)),0); $('#monthHours').textContent=hm(monthMinutes);
 const {data:ots}=await db.from('overtime_requests').select('*').eq('employee_id',p.id).eq('status','approved').gte('work_date',ms).lte('work_date',me);
 (ots||[]).forEach(o=>{const k=o.work_date,txt='<span class="calEvent overtime">'+String(o.requested_start).slice(0,5)+'→'+String(o.requested_end).slice(0,5)+'</span>';employeeCalendarLeaves[k]=(employeeCalendarLeaves[k]?employeeCalendarLeaves[k]+'|||':'')+txt});
 const otMinutes=(ots||[]).reduce((s,o)=>s+overtimeRequestMinutes(o),0); $('#monthOvertime').textContent=hm(otMinutes);
 const {data:a}=await db.from('attendance').select('*').eq('employee_id',p.id).eq('work_date',kstDate()).maybeSingle();
 if(a){$('#inTime').textContent=a.check_in?timeKst(a.check_in):'미등록';$('#outTime').textContent=a.check_out?timeKst(a.check_out):'미등록';$('#todayHours').textContent=hm(a.work_minutes||minutesBetween(a.check_in,a.check_out||new Date().toISOString()));$('#checkIn').disabled=!!a.check_in;$('#checkOut').disabled=!a.check_in||!!a.check_out}else{$('#inTime').textContent='미등록';$('#outTime').textContent='미등록';$('#todayHours').textContent='00:00';$('#checkIn').disabled=isNonWorkingToday();$('#checkOut').disabled=true}
 if(isNonWorkingToday()&&!a?.check_in){const reason=holidayMap[kstDate()]||'주말';$('#todayHours').textContent=reason+' · 휴무'}
}

$('#checkIn').onclick=async()=>{if(isNonWorkingToday())return alert('오늘은 '+(holidayMap[kstDate()]||'주말')+'로 일반 근무일이 아닙니다.');const {data:{user}}=await db.auth.getUser();const {error}=await db.from('attendance').insert({employee_id:user.id,work_date:kstDate(),check_in:new Date().toISOString()});if(error)return alert(error.message);location.reload()};
$('#checkOut').onclick=async()=>{const {data:{user}}=await db.auth.getUser();const {data:a,error:rerr}=await db.from('attendance').select('*').eq('employee_id',user.id).eq('work_date',kstDate()).single();if(rerr)return alert(rerr.message);const out=new Date().toISOString(),mins=minutesBetween(a.check_in,out);const {error}=await db.from('attendance').update({check_out:out,work_minutes:mins}).eq('employee_id',user.id).eq('work_date',kstDate());if(error)return alert(error.message);location.reload()};
$('#annualLeave').onclick=()=>{$('#leaveStart').value=kstDate();$('#leaveEnd').value=kstDate();$('#leaveDays').value='1';$('#leaveDialog').showModal()};
$('#submitLeave').onclick=async e=>{e.preventDefault();const start=$('#leaveStart').value,end=$('#leaveEnd').value,days=Number($('#leaveDays').value),reason=$('#leaveReason').value.trim();if(!start||!end)return alert('연차 날짜를 선택하세요.');if(end<start)return alert('종료일은 시작일보다 빠를 수 없습니다.');if(!(days>0))return alert('사용 일수를 확인하세요.');const {data:{user}}=await db.auth.getUser();const year=new Date(start+'T00:00:00').getFullYear();const {data:g}=await db.from('annual_leave_grants').select('granted_days').eq('employee_id',user.id).eq('leave_year',year);const granted=(g||[]).reduce((s,x)=>s+Number(x.granted_days||0),0);const {data:u}=await db.from('annual_leave_requests').select('days').eq('employee_id',user.id).eq('status','approved').gte('start_date',year+'-01-01').lte('start_date',year+'-12-31');const used=(u||[]).reduce((s,x)=>s+Number(x.days||0),0);if(days>granted-used)return alert('잔여 연차가 부족합니다. 현재 잔여 '+(granted-used)+'일');const {error}=await db.from('annual_leave_requests').insert({employee_id:user.id,start_date:start,end_date:end,days,reason:reason||null,status:'pending'});if(error)return alert('연차 신청 실패: '+error.message);$('#leaveDialog').close();alert('연차 신청이 등록되었습니다.')};
$('#overtime').onclick=()=>{$('#otDate').value=kstDate();$('#otStart').value='16:00';$('#otEnd').value='';$('#otType').value='continuous';$('#otDialog').showModal()};
function openApprovedOt(token){const o=adminApprovedOtMap[token];if(!o)return;selectedApprovedOtId=o.id;$('#approvedOtDetail').innerHTML='<b>'+o.employee_name+'</b><br>'+o.work_date+'<br>'+String(o.requested_start).slice(0,5)+' → '+String(o.requested_end).slice(0,5)+' ('+o.duration+')<br>'+o.reason;$('#cancelOtReason').value='';$('#cancelOtMsg').textContent='';$('#approvedOtDialog').showModal()}
$('#cancelApprovedOt').onclick=async()=>{const reason=$('#cancelOtReason').value.trim();if(!reason){$('#cancelOtMsg').textContent='승인 취소 사유를 입력하세요.';return}const old=(await db.from('overtime_requests').select('*').eq('id',selectedApprovedOtId).single()).data;if(!old){$('#cancelOtMsg').textContent='초과근무 기록을 찾을 수 없습니다.';return}const {data:{user}}=await db.auth.getUser();const {error}=await db.from('overtime_requests').update({status:'rejected',reviewed_at:new Date().toISOString(),approved_by:user.id}).eq('id',selectedApprovedOtId);if(error){$('#cancelOtMsg').textContent='취소 실패: '+error.message;return}const log=await db.from('audit_log').insert({table_name:'overtime_requests',record_id:String(selectedApprovedOtId),action:'APPROVAL_CANCELLED',changed_by:user.id,old_data:old,new_data:{...old,status:'rejected'},reason});if(log.error){$('#cancelOtMsg').textContent='승인은 취소됐지만 이력 저장 실패: '+log.error.message;return}$('#approvedOtDialog').close();await loadAdmin()};
async function reviewLeave(id,status){const label=status==='approved'?'승인':'거절';if(!confirm('이 연차 신청을 '+label+'하시겠습니까?'))return;const {data:{user}}=await db.auth.getUser();const {error}=await db.from('annual_leave_requests').update({status,approved_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',id);if(error)return alert(label+' 실패: '+error.message);await loadAdmin()}
async function reviewOvertime(id,status){const label=status==='approved'?'승인':'거절';if(!confirm('이 초과근무 신청을 '+label+'하시겠습니까?'))return;const {data:{user}}=await db.auth.getUser();const {error}=await db.from('overtime_requests').update({status,approved_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',id);if(error)return alert(label+' 실패: '+error.message);await loadAdmin()}$('#submitOt').onclick=async e=>{e.preventDefault();const reason=$('#otReason').value.trim();if(!reason)return alert('사유를 입력하세요.');const {data:{user}}=await db.auth.getUser();const date=$('#otDate').value||kstDate(),start=$('#otStart').value,end=$('#otEnd').value,type=$('#otType').value;if(!start||!end)return alert('시작시간과 종료시간을 입력하세요.');if(end<=start)return alert('종료시간은 시작시간보다 늦어야 합니다.');if(type==='continuous'&&start<'16:00')return alert('정규근무 후 초과근무 시작은 16:00 이후여야 합니다.');const duration=Math.round((new Date(date+'T'+end+':00+09:00')-new Date(date+'T'+start+':00+09:00'))/60000);const fullReason=(type==='return'?'[퇴근 후 긴급복귀] ':'[연속 초과근무] ')+reason+' [실제 '+hm(duration)+']';const {error}=await db.from('overtime_requests').insert({employee_id:user.id,work_date:date,requested_start:start,requested_end:end,reason:fullReason});if(error)return alert(error.message);$('#otDialog').close();alert('초과근무 신청이 등록되었습니다.')};
function actionFields(){
 const a=$('#manageAction').value,y=new Date().getFullYear();
 const map={
 hire:'<label>입사일<input id="mDate" type="date" required></label><label>담당업무<input id="mJob" required></label>',
 leaveGrant:'<label>연도<input id="mYear" type="number" value="'+y+'" required></label><label>조정 방식<select id="mLeaveMode" style="width:100%;padding:12px;margin-top:7px;border:1px solid #ccd4df;border-radius:9px"><option value="set">총 연차 수정</option><option value="add">추가 연차 부여</option></select></label><label>일수<input id="mDays" type="number" min="0" step="0.5" required></label><label>조정 사유<input id="mNote" required placeholder="예: 최초 부여 오류 정정 / 포상 연차 1일 추가"></label><p class="muted">총 연차 수정은 해당 연도의 최종 부여량을 지정하고, 추가 연차 부여는 현재 부여량에 더합니다.</p>',
 loa:'<label>휴직 시작일<input id="mDate" type="date" required></label><label>휴직 종류<input id="mType" placeholder="예: 육아휴직" required></label><label>사유<input id="mReason"></label>',
 return:'<label>복귀일<input id="mDate" type="date" required></label>',
 terminate:'<label>퇴사일<input id="mDate" type="date" required></label><label>퇴사 사유<input id="mReason"></label>',
 accessOn:'<p class="muted">직원의 웹사이트 로그인을 허용합니다.</p>',
 accessOff:'<p class="muted">과거 데이터는 유지하고 웹사이트 로그인만 차단합니다.</p>',tempPassword:'<label>새 임시 비밀번호<input id="mPassword" type="password" minlength="8" required></label><label>비밀번호 확인<input id="mPassword2" type="password" minlength="8" required></label><p class="muted">기존 비밀번호는 조회되지 않으며 새 비밀번호로만 재설정됩니다.</p>',attendanceEdit:'<label>정정 날짜<input id="mAttDate" type="date" required></label><label>출근시간<input id="mIn" type="time"></label><label>퇴근시간<input id="mOut" type="time"></label><label>정정 사유<textarea id="mEditReason" required placeholder="예: 직원 출근버튼 누락 확인"></textarea></label><p class="muted">기존 기록이 없어도 생성할 수 있으며 모든 변경은 수정이력에 기록됩니다.</p>'
 }; $('#actionFields').innerHTML=map[a]||''
}
function openManage(id,ps,histories){const p=ps.find(x=>x.id===id),hs=histories.filter(x=>x.employee_id===id);$('#manageEmployeeId').value=id;$('#manageTitle').textContent=p.name+' 직원 관리';$('#manageSummary').innerHTML='담당업무: '+(p.job_description||'-')+'<br>재직 이력: '+(hs.length?hs.map(x=>x.hire_date+' ~ '+(x.termination_date||'현재')).join('<br>'):'없음');$('#manageAction').value=hs.some(x=>['active','leave'].includes(x.status))?'leaveGrant':'hire';actionFields();$('#manageDialog').showModal()}
$('#manageAction').onchange=actionFields; $('#cancelManage').onclick=()=>$('#manageDialog').close();
$('#manageForm').onsubmit=async e=>{e.preventDefault();const id=$('#manageEmployeeId').value,a=$('#manageAction').value;$('#manageMsg').textContent='처리 중...';let err=null;
 const active=async()=>{const r=await db.from('employment_history').select('*').eq('employee_id',id).in('status',['active','leave']).maybeSingle();return r.data};
 if(a==='hire'){const r=await db.from('employment_history').insert({employee_id:id,hire_date:$('#mDate').value,job_description:$('#mJob').value,status:'active'});err=r.error;if(!err)err=(await db.from('profiles').update({employment_status:'active',access_enabled:true,job_description:$('#mJob').value}).eq('id',id)).error}
 if(a==='leaveGrant'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{const year=Number($('#mYear').value),inputDays=Number($('#mDays').value),mode=$('#mLeaveMode').value,note=$('#mNote').value.trim();if(!note){err={message:'연차 조정 사유를 입력하세요.'}}else{const existing=(await db.from('annual_leave_grants').select('*').eq('employee_id',id).eq('employment_id',cur.id).eq('leave_year',year).maybeSingle()).data;const oldDays=Number(existing?.granted_days||0),newDays=mode==='add'?oldDays+inputDays:inputDays;const {data:{user}}=await db.auth.getUser();let r;if(existing)r=await db.from('annual_leave_grants').update({granted_days:newDays,note,updated_at:new Date().toISOString()}).eq('id',existing.id);else r=await db.from('annual_leave_grants').insert({employee_id:id,employment_id:cur.id,leave_year:year,granted_days:newDays,note,created_by:user.id});err=r.error;if(!err){const log=await db.from('audit_log').insert({table_name:'annual_leave_grants',record_id:existing?String(existing.id):id+'@'+year,action:existing?'UPDATE':'INSERT',changed_by:user.id,old_data:existing||null,new_data:{employee_id:id,employment_id:cur.id,leave_year:year,granted_days:newDays,mode},reason:note});if(log.error)err={message:'연차는 조정됐지만 수정이력 저장 실패: '+log.error.message}}}}}
 if(a==='loa'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{const {data:{user}}=await db.auth.getUser();err=(await db.from('leave_of_absence').insert({employee_id:id,leave_type:$('#mType').value,reason:$('#mReason').value||null,start_date:$('#mDate').value,created_by:user.id})).error;if(!err){await db.from('employment_history').update({status:'leave'}).eq('id',cur.id);await db.from('profiles').update({employment_status:'leave'}).eq('id',id)}}}
 if(a==='return'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{await db.from('employment_history').update({status:'active'}).eq('id',cur.id);await db.from('profiles').update({employment_status:'active'}).eq('id',id)}}
 if(a==='terminate'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{err=(await db.from('employment_history').update({status:'terminated',termination_date:$('#mDate').value,termination_reason:$('#mReason').value||null}).eq('id',cur.id)).error;if(!err)err=(await db.from('profiles').update({employment_status:'retired',access_enabled:false}).eq('id',id)).error}}
 if(a==='accessOn')err=(await db.from('profiles').update({access_enabled:true}).eq('id',id)).error;
 if(a==='accessOff')err=(await db.from('profiles').update({access_enabled:false}).eq('id',id)).error;
 if(a==='tempPassword'){const pw=$('#mPassword').value,pw2=$('#mPassword2').value;if(pw.length<8){err={message:'비밀번호는 8자 이상이어야 합니다.'}}else if(pw!==pw2){err={message:'두 비밀번호가 일치하지 않습니다.'}}else{const r=await db.functions.invoke('reset-employee-password',{body:{employee_id:id,password:pw}});if(r.error)err={message:r.error.message};else if(r.data?.error)err={message:r.data.error}}}
 if(a==='attendanceEdit'){const date=$('#mAttDate').value,ins=$('#mIn').value,outs=$('#mOut').value,reason=$('#mEditReason').value.trim();if(!date||!reason){err={message:'정정 날짜와 사유는 필수입니다.'}}else if(!ins&&!outs){err={message:'출근 또는 퇴근시간을 입력하세요.'}}else if(ins&&outs&&outs<ins){err={message:'퇴근시간은 출근시간보다 빠를 수 없습니다.'}}else{const old=(await db.from('attendance').select('*').eq('employee_id',id).eq('work_date',date).maybeSingle()).data;const iso=t=>t?new Date(date+'T'+t+':00+09:00').toISOString():null;const checkIn=ins?iso(ins):(old?.check_in||null),checkOut=outs?iso(outs):(old?.check_out||null);const mins=checkIn&&checkOut?minutesBetween(checkIn,checkOut):0;let r;if(old)r=await db.from('attendance').update({check_in:checkIn,check_out:checkOut,work_minutes:mins,note:'관리자 정정: '+reason,updated_at:new Date().toISOString()}).eq('id',old.id);else r=await db.from('attendance').insert({employee_id:id,work_date:date,check_in:checkIn,check_out:checkOut,work_minutes:mins,note:'관리자 정정: '+reason});err=r.error;if(!err){const {data:{user}}=await db.auth.getUser();const log=await db.from('audit_log').insert({table_name:'attendance',record_id:old?String(old.id):id+'@'+date,action:old?'UPDATE':'INSERT',changed_by:user.id,old_data:old||null,new_data:{employee_id:id,work_date:date,check_in:checkIn,check_out:checkOut,work_minutes:mins},reason});if(log.error)err={message:'근태는 정정됐지만 수정이력 저장 실패: '+log.error.message}}}}
 if(err){$('#manageMsg').textContent='처리 실패: '+err.message;return}$('#manageMsg').textContent='처리되었습니다.';setTimeout(()=>{$('#manageDialog').close();loadAdmin()},600)
};
$('#addEmployee').onclick=()=>$('#employeeDialog').showModal();
$('#cancelEmployee').onclick=()=>$('#employeeDialog').close();
$('#employeeForm').onsubmit=async(e)=>{
 e.preventDefault(); $('#employeeFormMsg').textContent='직원 계정을 생성하는 중...';
 const payload={name:$('#empName').value.trim(),email:$('#empEmail').value.trim(),job_description:$('#empJob').value.trim(),access_enabled:$('#empAccess').checked};
 const {data,error}=await db.functions.invoke('create-employee',{body:payload});
 if(error){
   let detail=error.message;
   try{
     if(error.context instanceof Response){
       const body=await error.context.clone().json();
       if(body?.error) detail=body.error;
     }
   }catch(_){}
   $('#employeeFormMsg').textContent='등록 실패: '+detail;
   return
 }
 if(data?.error){$('#employeeFormMsg').textContent='등록 실패: '+data.error;return}
 $('#employeeFormMsg').textContent='직원을 등록했고 초대 메일을 발송했습니다.';
 setTimeout(()=>{ $('#employeeDialog').close(); $('#employeeForm').reset(); loadAdmin(); },900);
};
db.auth.onAuthStateChange((event,session)=>{
 if(event==='PASSWORD_RECOVERY'){document.querySelector('#resetPassword h2').textContent='새 비밀번호 설정';show('resetPassword')}
 if(event==='SIGNED_IN' && (location.hash.includes('type=invite') || location.search.includes('type=invite'))){document.querySelector('#resetPassword h2').textContent='최초 비밀번호 설정';show('resetPassword')}
});
db.auth.getSession().then(({data})=>{
 const u=(location.hash||'')+(location.search||'');
 if(u.includes('type=recovery')||u.includes('type=invite')){
   document.querySelector('#resetPassword h2').textContent=u.includes('type=invite')?'최초 비밀번호 설정':'새 비밀번호 설정';
   show('resetPassword');
 } else route(data.session)
});
function shiftMonth(which,delta){
 if(which==='admin'){adminView=new Date(adminView.getFullYear(),adminView.getMonth()+delta,1);loadAdmin()}
 else{employeeView=new Date(employeeView.getFullYear(),employeeView.getMonth()+delta,1);loadEmployee(window.currentEmployeeProfile)}
}
$('#adminPrev').onclick=()=>shiftMonth('admin',-1); $('#adminNext').onclick=()=>shiftMonth('admin',1);
$('#employeePrev').onclick=()=>shiftMonth('employee',-1); $('#employeeNext').onclick=()=>shiftMonth('employee',1);
