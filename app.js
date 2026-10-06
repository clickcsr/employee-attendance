const SUPABASE_URL='https://wgrbolqqemcywxikhjzt.supabase.co';
const SUPABASE_KEY='sb_publishable_hCQV9SPMKUD3cbgbJdjkMg_Z0y6AXGo';
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const $=s=>document.querySelector(s); const now=new Date();
const kstDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmtMonth=d=>d.toLocaleDateString('ko-KR',{year:'numeric',month:'long',timeZone:'Asia/Seoul'});
$('#adminMonth').textContent=fmtMonth(now); $('#employeeMonth').textContent=fmtMonth(now)+' 근태';
function calendar(el){el.innerHTML='';const y=now.getFullYear(),m=now.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate();['일','월','화','수','목','금','토'].forEach(n=>el.insertAdjacentHTML('beforeend','<div class="dayname">'+n+'</div>'));for(let i=0;i<first;i++)el.insertAdjacentHTML('beforeend','<div></div>');for(let d=1;d<=last;d++){const dt=new Date(y,m,d),w=dt.getDay(),isToday=d===now.getDate(),weekend=w===0||w===6;el.insertAdjacentHTML('beforeend','<div class="day '+(weekend?'weekend ':'')+(isToday?'todayCell ':'')+'"><span class="num">'+d+'</span><small>'+(weekend?'휴무':isToday?'오늘':'')+'</small></div>')}} calendar($('#adminCalendar'));calendar($('#employeeCalendar'));
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
async function loadAdmin(){const {data:profiles}=await db.from('profiles').select('*').eq('role','employee').order('name');const ps=profiles||[];$('#employeeCount').textContent=ps.length;$('#leaveCount').textContent=ps.filter(x=>x.employment_status==='leave').length;$('#employeeRows').innerHTML=ps.length?ps.map(p=>'<tr><td>'+p.name+'</td><td>'+(p.job_description||'-')+'</td><td>'+p.employment_status+'</td></tr>').join(''):'<tr><td colspan="3">등록된 직원이 없습니다.</td></tr>';$('#monthlyRows').innerHTML=ps.length?ps.map(p=>'<tr><td>'+p.name+'</td><td>00:00</td><td>0 / '+p.annual_leave_total+'</td></tr>').join(''):'<tr><td colspan="3">등록된 직원이 없습니다.</td></tr>';const {data:ots}=await db.from('overtime_requests').select('*').eq('status','pending');$('#pendingCount').textContent=(ots||[]).length;const {data:ats}=await db.from('attendance').select('employee_id').eq('work_date',kstDate()).not('check_in','is',null);$('#todayCount').textContent=(ats||[]).length}
async function loadEmployee(p){$('#employeeName').textContent=p.name+'님';$('#employeeJob').textContent='담당업무 · '+(p.job_description||'미지정');$('#leaveUsage').textContent='0 / '+p.annual_leave_total;const {data:a}=await db.from('attendance').select('*').eq('employee_id',p.id).eq('work_date',kstDate()).maybeSingle();if(a){$('#inTime').textContent=a.check_in?new Date(a.check_in).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}):'미등록';$('#outTime').textContent=a.check_out?new Date(a.check_out).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul'}):'미등록';$('#checkIn').disabled=!!a.check_in;$('#checkOut').disabled=!a.check_in||!!a.check_out}else{$('#checkIn').disabled=false;$('#checkOut').disabled=true}}
$('#checkIn').onclick=async()=>{const {data:{user}}=await db.auth.getUser();const {error}=await db.from('attendance').insert({employee_id:user.id,work_date:kstDate(),check_in:new Date().toISOString()});if(error)return alert(error.message);location.reload()};
$('#checkOut').onclick=async()=>{const {data:{user}}=await db.auth.getUser();const {error}=await db.from('attendance').update({check_out:new Date().toISOString()}).eq('employee_id',user.id).eq('work_date',kstDate());if(error)return alert(error.message);location.reload()};
$('#overtime').onclick=()=>$('#otDialog').showModal();$('#submitOt').onclick=async e=>{e.preventDefault();const reason=$('#otReason').value.trim();if(!reason)return alert('사유를 입력하세요.');const {data:{user}}=await db.auth.getUser();const {error}=await db.from('overtime_requests').insert({employee_id:user.id,work_date:kstDate(),requested_start:'16:00',requested_end:$('#otEnd').value,reason});if(error)return alert(error.message);$('#otDialog').close();alert('초과근무 신청이 등록되었습니다.')};
$('#addEmployee').onclick=()=>$('#employeeDialog').showModal();
$('#cancelEmployee').onclick=()=>$('#employeeDialog').close();
$('#employeeForm').onsubmit=async(e)=>{
 e.preventDefault(); $('#employeeFormMsg').textContent='직원 계정을 생성하는 중...';
 const payload={name:$('#empName').value.trim(),email:$('#empEmail').value.trim(),job_description:$('#empJob').value.trim(),access_enabled:$('#empAccess').checked};
 const {data,error}=await db.functions.invoke('create-employee',{body:payload});
 if(error){$('#employeeFormMsg').textContent='등록 실패: '+error.message;return}
 if(data?.error){$('#employeeFormMsg').textContent='등록 실패: '+data.error;return}
 $('#employeeFormMsg').textContent='직원을 등록했고 초대 메일을 발송했습니다.';
 setTimeout(()=>{ $('#employeeDialog').close(); $('#employeeForm').reset(); loadAdmin(); },900);
};
db.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){show('resetPassword')}});
db.auth.getSession().then(({data})=>{const hash=location.hash||'';if(hash.includes('type=recovery')){show('resetPassword')}else route(data.session)});