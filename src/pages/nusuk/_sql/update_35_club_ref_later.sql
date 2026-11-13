-- =====================================================================
-- Nusuk · update 35 · add a referral code later, from the account page
-- Run once in Supabase → SQL Editor (after update 34), BEFORE pushing.
-- Safe to run again.
--
-- The sign-up form no longer asks for a referral code (a ?ref= link or QR
-- code still fills it in by itself). A member without one can add it once
-- from their account. Rules:
--   • only once; the code must belong to a member who joined BEFORE them
--   • not their own code, and not someone they brought in themselves
--   • tickets (joined-with-code bonus + the owner's referral ticket) follow the
--     competitions running at that moment, same as at sign-up
--   • no referral tickets if this browser is another member's device
-- =====================================================================

create or replace function public.nusuk_club_set_ref(p_ref text, p_device text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cfg jsonb := public.nusuk_club_cfg();
  uid uuid := auth.uid();
  me public.nusuk_club_members;
  ref public.nusuk_club_members;
  v_device text := case when p_device ~ '^[0-9a-fA-F-]{36}$' then p_device else null end;
  v_ok boolean;
  c public.nusuk_club_contests;
begin
  if uid is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  select * into me from public.nusuk_club_members where user_id = uid for update;
  if me.user_id is null then return jsonb_build_object('ok', false, 'reason', 'signin'); end if;
  if not coalesce((cfg->>'on')::boolean, false) then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
  if me.referred_by is not null then return jsonb_build_object('ok', false, 'reason', 'has_ref'); end if;

  select * into ref from public.nusuk_club_members where lower(nusuk_code) = lower(btrim(coalesce(p_ref, '')));
  if ref.user_id is null then return jsonb_build_object('ok', false, 'reason', 'bad_ref'); end if;
  if ref.user_id = uid then return jsonb_build_object('ok', false, 'reason', 'self_ref'); end if;
  if ref.sl > me.sl or ref.referred_by = uid then return jsonb_build_object('ok', false, 'reason', 'ref_newer'); end if;

  v_ok := v_device is not null
    and coalesce(ref.device, '') <> v_device
    and not exists (select 1 from public.nusuk_club_members where device = v_device and user_id <> uid);

  update public.nusuk_club_members set referred_by = ref.user_id, ref_ok = v_ok, updated_at = now() where user_id = uid;
  if v_ok then
    for c in select * from public.nusuk_club_live() loop
      perform public.nusuk_club_give(uid, c.id, 'ref_bonus', c.t_ref_bonus, ref.user_id);
      perform public.nusuk_club_give(ref.user_id, c.id, 'referral', c.t_referral, uid);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'ref_counted', v_ok, 'name', split_part(ref.name, ' ', 1));
end $$;

grant execute on function public.nusuk_club_set_ref(text, text) to authenticated;
