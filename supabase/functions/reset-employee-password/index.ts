import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}
serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors})
 try{
  const url=Deno.env.get("SUPABASE_URL")!
  const publishable=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}")["default"]
  const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}")["default"]
  if(!url||!publishable||!secret)throw new Error("Supabase 서버 키 설정을 확인하세요.")
  const auth=req.headers.get("Authorization")||""
  const caller=createClient(url,publishable,{global:{headers:{Authorization:auth}}})
  const {data:{user},error:userError}=await caller.auth.getUser()
  if(userError||!user)throw new Error("로그인이 필요합니다.")
  const admin=createClient(url,secret,{auth:{autoRefreshToken:false,persistSession:false}})
  const {data:p,error:pe}=await admin.from("profiles").select("role,access_enabled").eq("id",user.id).single()
  if(pe)throw new Error("관리자 확인 실패: "+pe.message)
  if(!p||p.role!=="admin"||!p.access_enabled)throw new Error("관리자 권한이 없습니다.")
  const body=await req.json(), employeeId=String(body.employee_id||""), password=String(body.password||"")
  if(!employeeId)throw new Error("직원을 선택하세요.")
  if(password.length<8)throw new Error("비밀번호는 8자 이상이어야 합니다.")
  const {data:target,error:te}=await admin.from("profiles").select("role,name").eq("id",employeeId).single()
  if(te||!target)throw new Error("직원 정보를 찾을 수 없습니다.")
  if(target.role!=="employee")throw new Error("직원 계정만 재설정할 수 있습니다.")
  const {error:updateError}=await admin.auth.admin.updateUserById(employeeId,{password})
  if(updateError)throw new Error("비밀번호 변경 실패: "+updateError.message)
  return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}})
 }catch(e){const m=e instanceof Error?e.message:String(e);console.error("[reset-employee-password]",m);return new Response(JSON.stringify({error:m}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}
})