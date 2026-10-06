import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  try {
    const url = Deno.env.get("SUPABASE_URL")!
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const auth = req.headers.get("Authorization") || ""
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) throw new Error("로그인이 필요합니다.")

    const admin = createClient(url, service)
    const { data: profile } = await admin.from("profiles").select("role,access_enabled").eq("id", user.id).single()
    if (!profile || profile.role !== "admin" || !profile.access_enabled) throw new Error("관리자 권한이 없습니다.")

    const body = await req.json()
    if (!body.email || !body.name) throw new Error("이름과 이메일은 필수입니다.")

    const redirectTo = "https://clickcsr.github.io/employee-attendance/"
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(body.email, {
      redirectTo,
      data: { name: body.name }
    })
    if (inviteError) throw inviteError
    if (!invited.user) throw new Error("직원 계정을 생성하지 못했습니다.")

    const { error: profileError } = await admin.from("profiles").insert({
      id: invited.user.id,
      employee_code: "EMP-" + invited.user.id.slice(0, 8).toUpperCase(),
      name: body.name,
      role: "employee",
      job_description: body.job_description || null,
      hire_date: body.hire_date || null,
      annual_leave_total: body.annual_leave_total || 0,
      access_enabled: body.access_enabled !== false,
      employment_status: "active"
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(invited.user.id)
      throw profileError
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
  }
})