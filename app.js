const SUPABASE_URL='https://wgrbolqqemcywxikhjzt.supabase.co';
const SUPABASE_KEY='sb_publishable_hCQV9SPMKUD3cbgbJdjkMg_Z0y6AXGo';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s); const now=new Date();
const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmtMonth=d=>d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',timeZone:'Asia/Seoul'});
$('#adminMonth').textContent=fmtMonth(now); $('#employeeMonth').textContent=fmtMonth(now)+' 근태';
let holidayMap={};
async function loadHolidays(){
 const y=now.getFullYear();
 const {data,error}=await db.from('holidays').select('holiday_date,name').gte('holiday_date',y+'-01-01').lte('holiday_date',y+'-12-31');
 if(!error) holidayMap=Object.fromEntries((data||[]).map(x=>[x.holiday_date,x.name]));
}
function localDateKey(y,m,d){return y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0')}
function isNonWorkingToday(){const d=new Date(),w=d.getDay();return w===0||w===6||!!holidayMap[kstDate()]}
function calendar(el){
 el.innerHTML=''; const y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();
 ['일','월','화','수','목','금','토'].forEach(n=>el.insertAdjacentHTML('beforeend','<div class="dayname">'+n+'</div>'));
 for(let i=0;i<first;i++)el.insertAdjacentHTML('beforeend','<div></div>');
 for(let d=1;d<=last;d++){
  const dt=new Date(y,m,d),w=dt.getDay(),isToday=d===now.getDate(),weekend=w===0||w===6,key=localDateKey(y,m,d),holiday=holidayMap[key];
  const off=weekend||holiday; const label=holiday||((weekend)?'휴무':(isToday?'오늘':''));
  el.insertAdjacentHTML('beforeend','<div class="day '+(weekend?'weekend ':'')+(holiday?'holiday ':'')+(isToday?'todayCell ':'')+'"><span class="num">'+d+'</span><small>'+label+'</small></div>')
 }
}
async function refreshCalendars(){await loadHolidays();calendar($('#adminCalendar'));calendar($('#employeeCalendar'))}
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
function monthBounds(){const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),last=new Date(y,now.getMonth()+1,0).getDate();return [y+'-'+m+'-01',y+'-'+m+'-'+String(last).padStart(2,'0')]}
function timeKst(v){return v?new Date(v).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Seoul'}):'-'}
async function loadAdmin(){
 const {data:profiles}=await db.from('profiles').select('*').eq('role','employee').order('name'); const ps=profiles||[];
 $('#employeeCount').textContent=ps.length; $('#leaveCount').textContent=ps.filter(x=>x.employment_status==='leave').length;
 const ids=ps.map(x=>x.id); let histories=[],todayAtt=[],monthAtt=[],grants=[],leaveReq=[];
 if(ids.length){
   histories=(await db.from('employment_history').select('*').in('employee_id',ids).order('hire_date',{ascending:false})).data||[];
   todayAtt=(await db.from('attendance').select('*').in('employee_id',ids).eq('work_date',kstDate())).data||[];
   const [ms,me]=monthBounds(); monthAtt=(await db.from('attendance').select('*').in('employee_id',ids).gte('work_date',ms).lte('work_date',me)).data||[];
   grants=(await db.from('annual_leave_grants').select('*').in('employee_id',ids).eq('leave_year',now.getFullYear())).data||[];
   leaveReq=(await db.from('annual_leave_requests').select('*').in('employee_id',ids).eq('status','approved').gte('start_date',ms).lte('start_date',me)).data||[];
 }
 const currentFor=id=>histories.find(x=>x.employee_id===id&&['active','leave'].includes(x.status));
 $('#employeeRows').innerHTML=ps.length?ps.map(p=>{const cur=currentFor(p.id),a=todayAtt.find(x=>x.employee_id===p.id),mins=a?(a.work_minutes||minutesBetween(a.check_in,a.check_out||new Date().toISOString())):0;const state=cur?(cur.status==='leave'?'휴직':a?.check_in?(a.check_out?'퇴근':'근무중'):'미출근'):'퇴사/입사대기';return '<tr><td>'+p.name+'</td><td>'+(cur?.job_description||p.job_description||'-')+'</td><td>'+timeKst(a?.check_in)+'</td><td>'+timeKst(a?.check_out)+'</td><td>'+hm(mins)+'</td><td>'+state+'</td><td><button class="small manageEmp" data-id="'+p.id+'">관리</button></td></tr>'}).join(''):'<tr><td colspan="7">등록된 직원이 없습니다.</td></tr>';
 document.querySelectorAll('.manageEmp').forEach(b=>b.onclick=()=>openManage(b.dataset.id,ps,histories));
 $('#monthlyRows').innerHTML=ps.length?ps.map(p=>{const mins=monthAtt.filter(x=>x.employee_id===p.id).reduce((s,a)=>s+(a.work_minutes||minutesBetween(a.check_in,a.check_out)),0);const granted=grants.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.granted_days||0),0);const used=leaveReq.filter(x=>x.employee_id===p.id).reduce((s,x)=>s+Number(x.days||0),0);return '<tr><td>'+p.name+'</td><td>'+hm(mins)+'</td><td>'+used+' / '+granted+'</td></tr>'}).join(''):'<tr><td colspan="3">등록된 직원이 없습니다.</td></tr>';
 const {data:ots}=await db.from('overtime_requests').select('*').eq('status','pending').order('work_date',{ascending:true}); const pending=ots||[]; $('#pendingCount').textContent=pending.length; $('#todayCount').textContent=todayAtt.filter(x=>x.check_in).length;
 const nameOf=id=>ps.find(p=>p.id===id)?.name||'직원';
 $('#overtimeRequests').innerHTML=pending.length?pending.map(o=>'<div class="request" style="padding-bottom:12px;margin-bottom:12px;border-bottom:1px solid #eee"><b>'+nameOf(o.employee_id)+' · '+o.work_date+'</b><span>16:00 → '+o.requested_end+'</span><small>'+o.reason+'</small><div><button class="small approveOt" data-id="'+o.id+'">승인</button><button class="small danger rejectOt" data-id="'+o.id+'">거절</button></div></div>').join(''):'<span class="muted">승인 대기 신청이 없습니다.</span>';
 document.querySelectorAll('.approveOt').forEach(b=>b.onclick=()=>reviewOvertime(b.dataset.id,'approved'));
 document.querySelectorAll('.rejectOt').forEach(b=>b.onclick=()=>reviewOvertime(b.dataset.id,'rejected'))
}
async function loadEmployee(p){
 $('#employeeName').textContent=p.name+'님'; $('#employeeJob').textContent='담당업무 · '+(p.job_description||'미지정');
 const y=now.getFullYear(),[ms,me]=monthBounds();
 const {data:gr}=await db.from('annual_leave_grants').select('granted_days').eq('employee_id',p.id).eq('leave_year',y);
 const granted=(gr||[]).reduce((s,x)=>s+Number(x.granted_days||0),0);
 const {data:lr}=await db.from('annual_leave_requests').select('days').eq('employee_id',p.id).eq('status','approved').gte('start_date',ms).lte('start_date',me);
 const used=(lr||[]).reduce((s,x)=>s+Number(x.days||0),0); $('#leaveUsage').textContent=used+' / '+granted;
 const {data:ma}=await db.from('attendance').select('*').eq('employee_id',p.id).gte('work_date',ms).lte('work_date',me);
 const monthMinutes=(ma||[]).reduce((s,a)=>s+(a.work_minutes||minutesBetween(a.check_in,a.check_out)),0); $('#monthHours').textContent=hm(monthMinutes);
 const {data:a}=await db.from('attendance').select('*').eq('employee_id',p.id).eq('work_date',kstDate()).maybeSingle();
 if(a){$('#inTime').textContent=a.check_in?timeKst(a.check_in):'미등록';$('#outTime').textContent=a.check_out?timeKst(a.check_out):'미등록';$('#todayHours').textContent=hm(a.work_minutes||minutesBetween(a.check_in,a.check_out||new Date().toISOString()));$('#checkIn').disabled=!!a.check_in;$('#checkOut').disabled=!a.check_in||!!a.check_out}else{$('#inTime').textContent='미등록';$('#outTime').textContent='미등록';$('#todayHours').textContent='00:00';$('#checkIn').disabled=isNonWorkingToday();$('#checkOut').disabled=true}
 if(isNonWorkingToday()&&!a?.check_in){const reason=holidayMap[kstDate()]||'주말';$('#todayHours').textContent=reason+' · 휴무'}
}

$('#checkIn').onclick=async()=>{if(isNonWorkingToday())return alert('오늘은 '+(holidayMap[kstDate()]||'주말')+'로 일반 근무일이 아닙니다.');const {data:{user}}=await db.auth.getUser();const {error}=await db.from('attendance').insert({employee_id:user.id,work_date:kstDate(),check_in:new Date().toISOString()});if(error)return alert(error.message);location.reload()};
$('#checkOut').onclick=async()=>{const {data:{user}}=await db.auth.getUser();const {data:a,error:rerr}=await db.from('attendance').select('*').eq('employee_id',user.id).eq('work_date',kstDate()).single();if(rerr)return alert(rerr.message);const out=new Date().toISOString(),mins=minutesBetween(a.check_in,out);const {error}=await db.from('attendance').update({check_out:out,work_minutes:mins}).eq('employee_id',user.id).eq('work_date',kstDate());if(error)return alert(error.message);location.reload()};
$('#overtime').onclick=()=>{$('#otDate').value=kstDate();$('#otDialog').showModal()};
async function reviewOvertime(id,status){const label=status==='approved'?'승인':'거절';if(!confirm('이 초과근무 신청을 '+label+'하시겠습니까?'))return;const {data:{user}}=await db.auth.getUser();const {error}=await db.from('overtime_requests').update({status,approved_by:user.id,reviewed_at:new Date().toISOString()}).eq('id',id);if(error)return alert(label+' 실패: '+error.message);await loadAdmin()}$('#submitOt').onclick=async e=>{e.preventDefault();const reason=$('#otReason').value.trim();if(!reason)return alert('사유를 입력하세요.');const {data:{user}}=await db.auth.getUser();const date=$('#otDate').value||kstDate();const end=$('#otEnd').value;if(end<='16:00')return alert('예상 종료시간은 16:00 이후여야 합니다.');const {data:dup}=await db.from('overtime_requests').select('id,status').eq('employee_id',user.id).eq('work_date',date).in('status',['pending','approved']);if((dup||[]).length)return alert('해당 날짜에 이미 신청 또는 승인된 초과근무가 있습니다.');const {error}=await db.from('overtime_requests').insert({employee_id:user.id,work_date:date,requested_start:'16:00',requested_end:end,reason});if(error)return alert(error.message);$('#otDialog').close();alert('초과근무 신청이 등록되었습니다.')};
function actionFields(){
 const a=$('#manageAction').value,y=new Date().getFullYear();
 const map={
 hire:'<label>입사일<input id="mDate" type="date" required></label><label>담당업무<input id="mJob" required></label>',
 leaveGrant:'<label>연도<input id="mYear" type="number" value="'+y+'" required></label><label>부여 연차<input id="mDays" type="number" min="0" step="0.5" required></label><label>메모<input id="mNote"></label>',
 loa:'<label>휴직 시작일<input id="mDate" type="date" required></label><label>휴직 종류<input id="mType" placeholder="예: 육아휴직" required></label><label>사유<input id="mReason"></label>',
 return:'<label>복귀일<input id="mDate" type="date" required></label>',
 terminate:'<label>퇴사일<input id="mDate" type="date" required></label><label>퇴사 사유<input id="mReason"></label>',
 accessOn:'<p class="muted">직원의 웹사이트 로그인을 허용합니다.</p>',
 accessOff:'<p class="muted">과거 데이터는 유지하고 웹사이트 로그인만 차단합니다.</p>'
 }; $('#actionFields').innerHTML=map[a]||''
}
function openManage(id,ps,histories){const p=ps.find(x=>x.id===id),hs=histories.filter(x=>x.employee_id===id);$('#manageEmployeeId').value=id;$('#manageTitle').textContent=p.name+' 직원 관리';$('#manageSummary').innerHTML='담당업무: '+(p.job_description||'-')+'<br>재직 이력: '+(hs.length?hs.map(x=>x.hire_date+' ~ '+(x.termination_date||'현재')).join('<br>'):'없음');$('#manageAction').value=hs.some(x=>['active','leave'].includes(x.status))?'leaveGrant':'hire';actionFields();$('#manageDialog').showModal()}
$('#manageAction').onchange=actionFields; $('#cancelManage').onclick=()=>$('#manageDialog').close();
$('#manageForm').onsubmit=async e=>{e.preventDefault();const id=$('#manageEmployeeId').value,a=$('#manageAction').value;$('#manageMsg').textContent='처리 중...';let err=null;
 const active=async()=>{const r=await db.from('employment_history').select('*').eq('employee_id',id).in('status',['active','leave']).maybeSingle();return r.data};
 if(a==='hire'){const r=await db.from('employment_history').insert({employee_id:id,hire_date:$('#mDate').value,job_description:$('#mJob').value,status:'active'});err=r.error;if(!err)err=(await db.from('profiles').update({employment_status:'active',access_enabled:true,job_description:$('#mJob').value}).eq('id',id)).error}
 if(a==='leaveGrant'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{const {data:{user}}=await db.auth.getUser();const r=await db.from('annual_leave_grants').upsert({employee_id:id,employment_id:cur.id,leave_year:Number($('#mYear').value),granted_days:Number($('#mDays').value),note:$('#mNote').value||null,created_by:user.id},{onConflict:'employee_id,employment_id,leave_year'});err=r.error}}
 if(a==='loa'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{const {data:{user}}=await db.auth.getUser();err=(await db.from('leave_of_absence').insert({employee_id:id,leave_type:$('#mType').value,reason:$('#mReason').value||null,start_date:$('#mDate').value,created_by:user.id})).error;if(!err){await db.from('employment_history').update({status:'leave'}).eq('id',cur.id);await db.from('profiles').update({employment_status:'leave'}).eq('id',id)}}}
 if(a==='return'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{await db.from('employment_history').update({status:'active'}).eq('id',cur.id);await db.from('profiles').update({employment_status:'active'}).eq('id',id)}}
 if(a==='terminate'){const cur=await active();if(!cur){err={message:'현재 재직 이력이 없습니다.'}}else{err=(await db.from('employment_history').update({status:'terminated',termination_date:$('#mDate').value,termination_reason:$('#mReason').value||null}).eq('id',cur.id)).error;if(!err)err=(await db.from('profiles').update({employment_status:'retired',access_enabled:false}).eq('id',id)).error}}
 if(a==='accessOn')err=(await db.from('profiles').update({access_enabled:true}).eq('id',id)).error;
 if(a==='accessOff')err=(await db.from('profiles').update({access_enabled:false}).eq('id',id)).error;
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