'use client';
import { supabase } from '../../lib/supabase';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_EMAILS = ['i.g.webmaster.web@gmail.com'];
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export default function AdminPage() {
  const [user, setUser]               = useState<any>(null);
  const [matches, setMatches]         = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  // خريطة بيانات البروفايل الكاملة (تليفون/فيسبوك/فريق...) من جدول profiles
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [leagues, setLeagues]         = useState<any[]>([]);
  const [leagueMembers, setLeagueMembers] = useState<Record<string,any[]>>({});
  const [expandedLeague, setExpandedLeague] = useState<string|null>(null);
  const [loading, setLoading]         = useState(true);
  // ① loadError ✅
  const [loadError, setLoadError]     = useState(false);
  // 🔐 بوابة يوزرنيم + باسورد (طبقة ثانية فوق دخول الإيميل)
  const [gateOk, setGateOk]           = useState(false);
  const [gateUser, setGateUser]       = useState('');
  const [gatePass, setGatePass]       = useState('');
  const [gateErr, setGateErr]         = useState('');
  const [gateBusy, setGateBusy]       = useState(false);
  // موديل تغيير كلمة المرور
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwOld, setPwOld]             = useState('');
  const [pwNew, setPwNew]             = useState('');
  const [pwNew2, setPwNew2]           = useState('');
  const [pwMsg, setPwMsg]             = useState('');
  const [pwBusy, setPwBusy]           = useState(false);
  // 🔒 تحكم إيقاف/تشغيل التسجيل
  const [regOpen, setRegOpen]         = useState(true);
  const [regMsgText, setRegMsgText]   = useState('');
  const [regBusy, setRegBusy]         = useState(false);
  const [regSaveMsg, setRegSaveMsg]   = useState('');
  // 🔢 ضبط عدد الأعضاء المعروض
  const [mdReal, setMdReal]           = useState<number|null>(null);
  const [mdDisplayed, setMdDisplayed] = useState<number|null>(null);
  const [mdInput, setMdInput]         = useState('');
  const [mdBusy, setMdBusy]           = useState(false);
  const [mdSaveMsg, setMdSaveMsg]     = useState('');
  const [activeTab, setActiveTab]     = useState<'matches'|'predictions'|'leaderboard'|'leagues'|'prizes'|'reports'>('matches');
  // ⑫ التقارير — أكثر الداعين / نقاط مشبوهة / غير نشطين / إحصائيات عامة
  const [rptOverview, setRptOverview]     = useState<any>(null);
  const [rptReferrers, setRptReferrers]   = useState<any[]>([]);
  const [rptSuspicious, setRptSuspicious] = useState<any[]>([]);
  const [rptInactive, setRptInactive]     = useState<any[]>([]);
  // التقارير الإضافية الأربعة
  const [rptRoundCompletion, setRptRoundCompletion] = useState<any[]>([]);
  const [rptPointsDist, setRptPointsDist]           = useState<any[]>([]);
  const [rptLeagueActivity, setRptLeagueActivity]   = useState<any[]>([]);
  const [rptTopPerRound, setRptTopPerRound]         = useState<any[]>([]);
  // تقارير الكنترول السبعة
  const [rptGrowth, setRptGrowth]             = useState<any[]>([]);
  const [rptBonusAudit, setRptBonusAudit]     = useState<any[]>([]);
  const [rptPenalties, setRptPenalties]       = useState<any[]>([]);
  const [rptIntegrity, setRptIntegrity]       = useState<any[]>([]);
  const [rptSocial, setRptSocial]             = useState<any[]>([]);
  const [rptFinishedOpen, setRptFinishedOpen] = useState<any[]>([]);
  const [rptPrizeLifecycle, setRptPrizeLifecycle] = useState<any[]>([]);
  const [rptDreamSurvey, setRptDreamSurvey] = useState<any[]>([]);
  const [rptLoaded, setRptLoaded]         = useState(false);
  const [rptLoading, setRptLoading]       = useState(false);
  const [activeReport, setActiveReport]   = useState<'referrers'|'suspicious'|'inactive'|'round_completion'|'points_dist'|'league_activity'|'top_per_round'|'growth'|'bonus_audit'|'penalties'|'integrity'|'social'|'finished_open'|'prize_lifecycle'|'dream_survey'>('referrers');
  const [activeRound, setActiveRound] = useState('Group Stage - 1');
  // ⑦ فلتر التوقعات بالجولة
  const [predRoundFilter, setPredRoundFilter] = useState<string>('all');
  const [predStatusFilter, setPredStatusFilter] = useState<'all'|'ungraded'>('all');
  const [updating, setUpdating]       = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [syncingSquads, setSyncingSquads] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [lastAutoUpdate, setLastAutoUpdate] = useState('');
  const [message, setMessage]         = useState('');
  const [msgType, setMsgType]         = useState<'success'|'error'>('success');
  const [showModal, setShowModal]     = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [homeScore, setHomeScore]     = useState(0);
  const [awayScore, setAwayScore]     = useState(0);
  const [firstScorer, setFirstScorer] = useState('');
  const [extraTime, setExtraTime]     = useState(false);
  const [redCard,    setRedCard]    = useState(false);
  const [penalty,    setPenalty]    = useState(false);
  const [bothTeams,  setBothTeams]  = useState(false);
  // ① savingResult moved to top ✅
  const [savingResult, setSavingResult] = useState(false);
  // ── Prize Phases & Daily ──
  const [prizePhases, setPrizePhases]           = useState<any[]>([]);
  const [prizeWinners, setPrizeWinners]         = useState<any[]>([]);
  const [dailyScorers, setDailyScorers]         = useState<any[]>([]);
  const [phaseLeaderboard, setPhaseLeaderboard] = useState<any[]>([]);
  const [selectedPhase, setSelectedPhase]       = useState<any>(null);
  const [showPrizeModal, setShowPrizeModal]     = useState(false);
  const [prizeModalLoading, setPrizeModalLoading] = useState(false);
  const [savingWinner, setSavingWinner]         = useState(false);
  // user_ids المختارين يدوياً كفائزين من قائمة المودال
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<string[]>([]);

  // ── Breakdown Modal ──
  const [breakdownUser, setBreakdownUser]   = useState<any>(null);
  const [breakdownPreds, setBreakdownPreds] = useState<any[]>([]);
  const [showBreakdown, setShowBreakdown]   = useState(false);
  // بيانات البروفايل الكاملة (الإيميل من auth.users) التي تجلبها الدالة الآمنة
  const [profileDetails, setProfileDetails] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  // ⑩ إعادة حساب نقاط مستخدم واحد من نافذة التفاصيل
  const [recalcingUser, setRecalcingUser] = useState(false);
  // ⑧ بحث بالاسم/الإيميل في التوقعات والصدارة
  const [predSearch, setPredSearch] = useState('');
  const [lbSearch, setLbSearch] = useState('');
  // ① صدارة الجولات: 'general' = الصدارة العامة، أو اسم الجولة
  const [lbScope, setLbScope] = useState<string>('general');
  const [roundLeaderboard, setRoundLeaderboard] = useState<any[]>([]);
  const [loadingRoundLb, setLoadingRoundLb] = useState(false);
const [participantsCount, setParticipantsCount] = useState(0);
  // ── إدارة النقاط (بونص/خصم) ──
  const [adjBusy, setAdjBusy] = useState(false);
  const [adjKind, setAdjKind] = useState<'bonus'|'penalty'>('bonus');
  const [adjEmail, setAdjEmail] = useState('');
  const [adjPoints, setAdjPoints] = useState('');
  const [adjReason, setAdjReason] = useState('');
  // مودال المنح الفردية لعضو معيّن (من تقرير تدقيق البونص)
  const [grantsModalUser, setGrantsModalUser] = useState<any>(null);
  const [grantsRows, setGrantsRows] = useState<any[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const [totalPredictionsCount, setTotalPredictionsCount] = useState(0);
const [gradedPredictionsCount, setGradedPredictionsCount] = useState(0);
const [ungradedPredictionsCount, setUngradedPredictionsCount] = useState(0);
  const router = useRouter();

  // ── جلب كل الصفوف بتجاوز حد PostgREST (1000 صف) عبر التقسيم ──
  const fetchAll = useCallback(async (build: () => any): Promise<any[]> => {
    const PAGE = 1000;
    let from = 0;
    const all: any[] = [];
    while (true) {
      const { data, error } = await build().range(from, from + PAGE - 1);
      if (error) { console.error('fetchAll:', error); break; }
      const chunk = data || [];
      all.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }, []);

  const roundLabels: Record<string,string> = {
    'Group Stage - 1':'الجولة الأولى','Group Stage - 2':'الجولة الثانية',
    'Group Stage - 3':'الجولة الثالثة','Round of 16':'دور الـ 16',
    'Quarter-finals':'ربع النهائي','Semi-finals':'نصف النهائي',
    '3rd Place Final':'مباراة الثالث','Final':'النهائي',
  };

  const showMsg = useCallback((msg: string, type: 'success'|'error' = 'success') => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(''), 5000);
  }, []);

  const loadMatches = useCallback(async () => {
    try {
      const res = await fetch('/api/fixtures');
      const data = await res.json();
      const apiMatches = data.response || [];
      const { data: sbFixtures } = await supabase.from('fixtures')
        .select('api_fixture_id,is_open,actual_home_score,actual_away_score,first_scorer,first_scorer_id,scorers_ids_json,went_extra_time,red_card_in_match,penalty_in_match,both_teams_scored,updated_at');
      const sbMap = new Map(sbFixtures?.map((f: any) => [f.api_fixture_id, f]) || []);
      const merged = apiMatches.map((m: any) => {
        const sb = sbMap.get(m.fixture.id);
        return {
          ...m,
          is_open:            sb?.is_open ?? false,
          actual_home_score:  sb?.actual_home_score ?? null,
          actual_away_score:  sb?.actual_away_score ?? null,
          first_scorer:       sb?.first_scorer ?? '',
          first_scorer_id:    sb?.first_scorer_id ?? null,
          scorers_ids_json:   sb?.scorers_ids_json ?? [],
          went_extra_time:    sb?.went_extra_time ?? false,
          red_card_in_match:  sb?.red_card_in_match ?? false,
          penalty_in_match:   sb?.penalty_in_match ?? false,
          both_teams_scored:  sb?.both_teams_scored ?? false,
          updated_at:         sb?.updated_at ?? null,
        };
      });
      setMatches(merged);
      const avail = [...new Set(merged.map((m: any) => m.league?.round).filter(Boolean))] as string[];
      if (avail.length > 0) setActiveRound(prev => avail.includes(prev) ? prev : avail[0]);
    } catch (err) {
      console.error('loadMatches:', err);
      setLoadError(true); // ① catch → setLoadError ✅
    }
    setLoading(false);
  }, []);

 const loadPredictions = useCallback(async () => {
  try {
    const [
      preds,
      pts,
      { count: totalCount },
      { count: gradedCount },
      { count: ungradedCount },
    ] = await Promise.all([
      fetchAll(() =>
        supabase
          .from('predictions')
          .select('*')
          .not('fixture_id', 'is', null)
          .order('submitted_at', { ascending: false })
      ),

      fetchAll(() =>
        supabase
          .from('user_points')
          .select('user_id,full_name,user_email')
      ),

      supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .not('fixture_id', 'is', null),

      supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .not('fixture_id', 'is', null)
        .not('points', 'is', null),

      supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .not('fixture_id', 'is', null)
        .is('points', null),
    ]);

    setTotalPredictionsCount(totalCount ?? 0);
    setGradedPredictionsCount(gradedCount ?? 0);
    setUngradedPredictionsCount(ungradedCount ?? 0);

    const nameMap = new Map(
      pts?.map((p: any) => [p.user_id, p.full_name || p.user_email?.split('@')[0]]) || []
    );

    setPredictions(
      (preds || []).map((p: any) => ({
        ...p,
        user_name: nameMap.get(p.user_id) || p.user_email?.split('@')[0],
      }))
    );
  } catch (err) {
    console.error('loadPredictions:', err);
  }
}, [fetchAll]);

const loadLeaderboard = useCallback(async () => {
  try {
    const [data, { count }, profs] = await Promise.all([
      fetchAll(() => supabase.from('user_points').select('*').order('total_points', { ascending: false })),
      supabase.from('user_points').select('*', { count: 'exact', head: true }),
      // بيانات البروفايل الكاملة (تليفون/فيسبوك/فريق/تاريخ ميلاد)
      fetchAll(() => supabase.from('profiles').select('id,full_name,phone,facebook_url,facebook_id,football_team,date_of_birth,avatar_url,referral_code,created_at')),
    ]);

    setParticipantsCount(count ?? 0);

    // خريطة البروفايل بـ user_id
    const pMap: Record<string, any> = {};
    (profs || []).forEach((pr: any) => { pMap[pr.id] = pr; });
    setProfilesMap(pMap);

    setLeaderboard((data || []).map((row: any) => {
      const prof = pMap[row.user_id] || {};
      return {
      user_id: row.user_id,
      user_email: row.user_email,
      full_name: row.full_name || prof.full_name,
      total: row.total_points || 0,
      count: row.predictions_count || 0,
      referral_count: row.referral_count || 0,
      bonus_points_awarded: row.bonus_points_awarded ?? false,
      facebook_bonus_awarded: row.facebook_bonus_awarded ?? false,
      profile_completed: row.profile_completed ?? false,
      bonus_points: row.bonus_points ?? 0,
      // ── بيانات البروفايل للعرض في نافذة التفاصيل ──
      phone: prof.phone || null,
      facebook_url: prof.facebook_url || null,
      facebook_id: prof.facebook_id || null,
      football_team: prof.football_team || null,
      date_of_birth: prof.date_of_birth || null,
      avatar_url: prof.avatar_url || row.avatar_url || null,
      referral_code: prof.referral_code || null,
      };
    }));
  } catch (err) {
    console.error('loadLeaderboard:', err);
  }
}, [fetchAll]);

  const loadLeagues = useCallback(async () => {
    try {
      const lgs     = await fetchAll(() => supabase.from('mini_leagues').select('*').order('created_at',{ascending:false}));
      const members = await fetchAll(() => supabase.from('mini_league_members').select('*'));
      const invites = await fetchAll(() => supabase.from('mini_league_invitations').select('league_id,status'));
      const userPts = await fetchAll(() => supabase.from('user_points').select('user_id,full_name,user_email,total_points'));
      const userPtsMap = new Map((userPts||[]).map((u:any)=>[u.user_id,u]));
      const enrichedMembers = (members||[]).map((m:any)=>({...m,_profile:userPtsMap.get(m.user_id)||null}));
      const membersMap: Record<string,any[]> = {};
      enrichedMembers.forEach((m:any)=>{ if(!membersMap[m.league_id]) membersMap[m.league_id]=[]; membersMap[m.league_id].push(m); });
      const pendingMap: Record<string,number> = {};
      (invites||[]).filter((i:any)=>i.status==='pending').forEach((i:any)=>{ pendingMap[i.league_id]=(pendingMap[i.league_id]||0)+1; });
      const ownerMap: Record<string,string> = {};
      (lgs||[]).forEach((lg:any)=>{ const o=(membersMap[lg.id]||[]).find((m:any)=>m.role==='owner'||m.user_id===lg.created_by); if(o) ownerMap[lg.id]=o._profile?.full_name||o._profile?.user_email?.split('@')[0]||'غير معروف'; });
      setLeagueMembers(membersMap);
      setLeagues((lgs||[]).map((lg:any)=>{ const m=membersMap[lg.id]||[]; const pts=m.map((x:any)=>x._profile?.total_points||0); return {...lg,member_count:m.length,pending_invites:pendingMap[lg.id]||0,top_points:pts.length?Math.max(...pts):0,owner_name:ownerMap[lg.id]||'—'}; }));
    } catch (err) { console.error('loadLeagues:', err); }
  }, [fetchAll]);

  const loadPrizes = useCallback(async () => {
  try {
    const [
      { data: phases },
      { data: winners },
      { data: daily },
    ] = await Promise.all([
      supabase.from('prize_phases').select('*').order('id'),
      supabase.from('prize_winners').select('*').order('phase_id').order('rank'),
      supabase.rpc('get_daily_top_scorers', {
        p_date: new Date().toISOString().split('T')[0],
        p_limit: 10,
      }),
    ]);

    // جلب أسماء الفائزين المسجّلين فقط (بدل جلب 13ألف صف والتوقف عند 1000) — يحل مشكلة الاسم “—”
    const winnerIds = Array.from(new Set((winners || []).map((w: any) => w.user_id)));
    let userMap = new Map<string, string>();
    if (winnerIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', winnerIds);
      userMap = new Map(
        (profs || []).map((p: any) => [p.id, p.full_name || '—'])
      );
    }

    const enrichedWinners = (winners || []).map((w: any) => ({
      ...w,
      winner_name: userMap.get(w.user_id) || '—',
    }));

    setPrizePhases(phases || []);
    setPrizeWinners(enrichedWinners);
    setDailyScorers(daily || []);
  } catch (err) {
    console.error('loadPrizes:', err);
  }
}, []);
  const silentUpdateResults = useCallback(async () => {
  if (updating) return;
  setAutoUpdating(true);
  try {
    await fetch('/api/sync-fixtures');

    const res = await fetch('/api/update-results');
    const data = await res.json();

    if (data.success && data.updated > 0) {
      showMsg(`🔄 تحديث أوتوماتيك: ${data.message || `${data.updated} توقع`}`);
      await loadMatches();
      await loadPredictions();
      await loadLeaderboard();
    }

    setLastAutoUpdate(
      new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    );
  } catch (err) {
    console.warn('silent update failed:', err);
  }
  setAutoUpdating(false);
}, [updating, showMsg, loadMatches, loadPredictions, loadLeaderboard]);

  // تحقق من دخول الإيميل أولًا (الطبقة الأولى)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !ADMIN_EMAILS.includes(data.user.email||'')) { router.push('/dashboard'); return; }
      setUser(data.user);
      // البوابة الثانية: لو الجلسة اتأكدت قبل كده في نفس التبويبة
      if (typeof window !== 'undefined' && sessionStorage.getItem('wc_admin_gate') === '1') {
        setGateOk(true);
      }
    });
  }, [router]);

  // تحميل البيانات بعد اجتياز البوابة الثانية
  useEffect(() => {
    if (!user || !gateOk) return;
    loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues(); loadPrizes();
    // 🔒 جلب حالة التسجيل + ضبط عدد الأعضاء المعروض
    (async () => {
      const { data } = await supabase.rpc('get_registration_status');
      if (data) { setRegOpen(data.open !== false); setRegMsgText(data.message || ''); }
      const { data: md } = await supabase.rpc('get_members_display_admin', { p_username: 'wcup-admin' });
      if (md) {
        setMdReal(md.real ?? null);
        setMdDisplayed(md.displayed ?? null);
        setMdInput(String(md.override ?? md.displayed ?? ''));
      }
    })();
  }, [user, gateOk, loadMatches, loadPredictions, loadLeaderboard, loadLeagues, loadPrizes]);

  // 🔢 حفظ الرقم المعروض (override) أو الرجوع للحقيقي (reset)
  const saveMembersDisplay = async (mode: 'override'|'reset') => {
    setMdBusy(true); setMdSaveMsg('');
    try {
      const val = mode === 'override' ? parseInt(mdInput, 10) : 0;
      if (mode === 'override' && (isNaN(val) || val < 0)) { setMdSaveMsg('❌ اكتب رقم صحيح'); setMdBusy(false); return; }
      const { data, error } = await supabase.rpc('set_members_display', { p_username: 'wcup-admin', p_mode: mode, p_value: val });
      if (error) throw error;
      // جلب القيم المحدّثة
      const { data: md } = await supabase.rpc('get_members_display_admin', { p_username: 'wcup-admin' });
      if (md) { setMdReal(md.real ?? null); setMdDisplayed(md.displayed ?? null); setMdInput(String(md.override ?? md.displayed ?? '')); }
      setMdSaveMsg(mode === 'reset' ? '✅ رجع للعدد الحقيقي' : '✅ اتحفظ الرقم المعروض');
      setTimeout(() => setMdSaveMsg(''), 2500);
      void data;
    } catch (err: any) {
      setMdSaveMsg('❌ ' + (err?.message || 'حصل خطأ'));
    } finally {
      setMdBusy(false);
    }
  };

  // 🔒 حفظ حالة التسجيل (إيقاف/تشغيل + نص الرسالة)
  const saveRegStatus = async (nextOpen: boolean) => {
    setRegBusy(true); setRegSaveMsg('');
    try {
      const { data, error } = await supabase.rpc('set_registration_status', {
        p_username: 'wcup-admin', p_open: nextOpen, p_message: regMsgText,
      });
      if (error) throw error;
      if (data) {
        setRegOpen((data as any).open !== false);
        setRegMsgText((data as any).message || '');
        setRegSaveMsg(nextOpen ? '✅ التسجيل مفتوح دلوقتي' : '✅ التسجيل مقفول والرسالة اتحفظت');
        setTimeout(() => setRegSaveMsg(''), 2500);
      }
    } catch (err: any) {
      setRegSaveMsg('❌ ' + (err?.message || 'حصل خطأ'));
    } finally {
      setRegBusy(false);
    }
  };

  // تحقق من يوزرنيم/باسورد عبر دالة DB الآمنة
  const submitGate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateErr(''); setGateBusy(true);
    try {
      const { data, error } = await supabase.rpc('verify_admin_login', { p_username: gateUser.trim(), p_password: gatePass });
      if (error) throw error;
      if (data === true) {
        if (typeof window !== 'undefined') sessionStorage.setItem('wc_admin_gate', '1');
        setGateOk(true); setGatePass('');
      } else {
        setGateErr('اليوزرنيم أو كلمة المرور غلط');
      }
    } catch (err: any) {
      setGateErr(err?.message || 'حصل خطأ، حاول تاني');
    } finally {
      setGateBusy(false);
    }
  };

  // تغيير كلمة المرور
  const submitPwChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(''); 
    if (pwNew !== pwNew2) { setPwMsg('❌ كلمتا المرور الجديدتان غير متطابقتين'); return; }
    if (pwNew.length < 8) { setPwMsg('❌ كلمة المرور الجديدة لازم 8 أحرف على الأقل'); return; }
    setPwBusy(true);
    try {
      const { data, error } = await supabase.rpc('change_admin_password', { p_username: 'wcup-admin', p_old_password: pwOld, p_new_password: pwNew });
      if (error) throw error;
      if (data === true) {
        setPwMsg('✅ تم تغيير كلمة المرور بنجاح');
        setPwOld(''); setPwNew(''); setPwNew2('');
        setTimeout(() => { setShowPwModal(false); setPwMsg(''); }, 1400);
      } else {
        setPwMsg('❌ كلمة المرور الحالية غلط');
      }
    } catch (err: any) {
      setPwMsg('❌ ' + (err?.message || 'حصل خطأ'));
    } finally {
      setPwBusy(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const firstRun = setTimeout(() => silentUpdateResults(), 30 * 1000);
    autoIntervalRef.current = setInterval(() => silentUpdateResults(), AUTO_REFRESH_INTERVAL);
    return () => { clearTimeout(firstRun); if (autoIntervalRef.current) clearInterval(autoIntervalRef.current); };
  }, [user, silentUpdateResults]);

  const toggleMatchOpen = async (match: any) => {
    const newStatus = !match.is_open; const fid = match.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      if (ex) {
        const { error } = await supabase.from('fixtures').update({is_open:newStatus}).eq('api_fixture_id',fid);
        if(error) throw error;
      }
      else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id:   fid,
          is_open:          newStatus,
          match_date:       match.fixture.date,
          round:            match.league.round,
          home_team:        match.teams.home.name,
          away_team:        match.teams.away.name,
          home_team_name:   match.teams.home.name,
          away_team_name:   match.teams.away.name,
          home_team_id:     match.teams.home.id,
          away_team_id:     match.teams.away.id,
          home_team_logo:   match.teams.home.logo,
          away_team_logo:   match.teams.away.logo,
        });
        if(error) throw error;
      }
      await loadMatches();
      showMsg(newStatus ? '✅ التوقعات مفتوحة' : '🔒 التوقعات مغلقة');
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const openResultModal = (match: any) => {
    setSelectedMatch(match);
    setHomeScore(match.actual_home_score ?? 0);
    setAwayScore(match.actual_away_score ?? 0);
    setFirstScorer(match.first_scorer ?? '');
    setExtraTime(match.went_extra_time ?? false);
    setRedCard(match.red_card_in_match ?? false);
    setPenalty(match.penalty_in_match ?? false);
    setBothTeams(match.both_teams_scored ?? false);
    setShowModal(true);
  };

  const saveResult = async () => {
    if (!selectedMatch) return;
    setSavingResult(true);
    const fid = selectedMatch.fixture.id;
    try {
      const { data: ex, error: se } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
      if (se) throw se;
      const payload = {
        actual_home_score: homeScore,
        actual_away_score: awayScore,
        first_scorer:      firstScorer || null,
        went_extra_time:   extraTime,
        red_card_in_match: redCard,
        penalty_in_match:  penalty,
        both_teams_scored: bothTeams,
      };
      if (ex) {
        const { error } = await supabase.from('fixtures').update(payload).eq('api_fixture_id',fid);
        if(error) throw error;
      }
      else {
        const { error } = await supabase.from('fixtures').insert({
          api_fixture_id:   fid,
          is_open:          false,
          match_date:       selectedMatch.fixture.date,
          round:            selectedMatch.league.round,
          home_team:        selectedMatch.teams.home.name,
          away_team:        selectedMatch.teams.away.name,
          home_team_name:   selectedMatch.teams.home.name,
          away_team_name:   selectedMatch.teams.away.name,
          home_team_id:     selectedMatch.teams.home.id,
          away_team_id:     selectedMatch.teams.away.id,
          home_team_logo:   selectedMatch.teams.home.logo,
          away_team_logo:   selectedMatch.teams.away.logo,
          ...payload,
        });
        if(error) throw error;
      }
      const res  = await fetch('/api/update-results');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'خطأ في حساب النقاط');
      setShowModal(false);
      await loadMatches(); await loadPredictions(); await loadLeaderboard();
      showMsg(`✅ تم حفظ النتيجة وتحديث النقاط — ${data.message || ''}`);
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ في الحفظ'),'error'); }
    setSavingResult(false);
  };

  const openAllMatches = async () => {
    if (!confirm(`فتح توقعات جميع ماتشات \"${roundLabels[activeRound]||activeRound}\"؟`)) return;
    setUpdating(true);
    const filtered = matches.filter(m => m.league.round === activeRound);
    let ok=0, fail=0;
    for (const match of filtered) {
      const fid = match.fixture.id;
      try {
        const { data: ex } = await supabase.from('fixtures').select('id').eq('api_fixture_id',fid).maybeSingle();
        if (ex) {
          await supabase.from('fixtures').update({is_open:true}).eq('api_fixture_id',fid);
        }
        else {
          await supabase.from('fixtures').insert({
            api_fixture_id:   fid,
            is_open:          true,
            match_date:       match.fixture.date,
            round:            match.league.round,
            home_team:        match.teams.home.name,
            away_team:        match.teams.away.name,
            home_team_name:   match.teams.home.name,
            away_team_name:   match.teams.away.name,
            home_team_id:     match.teams.home.id,
            away_team_id:     match.teams.away.id,
            home_team_logo:   match.teams.home.logo,
            away_team_logo:   match.teams.away.logo,
          });
        }
        ok++;
      } catch { fail++; }
    }
    await loadMatches(); setUpdating(false);
    showMsg(fail===0 ? `✅ تم فتح ${ok} ماتش` : `⚠️ فتح ${ok} — فشل ${fail}`, fail===0?'success':'error');
  };

  const closeAllMatches = async () => {
    if (!confirm('غلق جميع الماتشات الآن؟')) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/admin-close-all');
      const data = await res.json();
      showMsg(data.success ? '🔒 تم غلق كل الماتشات' : '❌ '+data.error, data.success?'success':'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في الغلق','error'); }
    setUpdating(false);
  };

  const updateAllPoints = async () => {
  setUpdating(true);
  try {
    await fetch('/api/sync-fixtures');

    const res = await fetch('/api/update-results');
    const data = await res.json();

    showMsg(
      data.success ? data.message || '✅ تم مزامنة النتائج وتحديث النقاط' : '❌ ' + data.error,
      data.success ? 'success' : 'error'
    );

    if (data.success) {
      await loadMatches();
      await loadPredictions();
      await loadLeaderboard();
    }
  } catch {
    showMsg('❌ خطأ في الاتصال', 'error');
  }
  setUpdating(false);
};

  const syncFixtures = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-fixtures');
      const data = await res.json();
      showMsg(data.success ? `✅ تم مزامنة ${data.count||''} ماتش` : '❌ '+data.error, data.success?'success':'error');
      await loadMatches();
    } catch { showMsg('❌ خطأ في المزامنة','error'); }
    setSyncing(false);
  };

  const syncSquads = async () => {
    setSyncingSquads(true);
    try {
      const res = await fetch('/api/sync-squads');
      const data = await res.json();
      showMsg(data.success ? `✅ ${data.message}` : '❌ '+data.error, data.success?'success':'error');
    } catch { showMsg('❌ خطأ في تحديث السكواد','error'); }
    setSyncingSquads(false);
  };

  const adminDeleteLeague = async (lg: any) => {
    if (!confirm(`حذف ليج \"${lg.name}\" نهائياً؟`)) return;
    try {
      await supabase.from('mini_league_invitations').delete().eq('league_id',lg.id);
      await supabase.from('mini_league_members').delete().eq('league_id',lg.id);
      const { error } = await supabase.from('mini_leagues').delete().eq('id',lg.id);
      if (error) throw error;
      showMsg(`🗑️ تم حذف ليج \"${lg.name}\"`); await loadLeagues();
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const adminRemoveMember = async (leagueId: string, userId: string, memberName: string) => {
    if (!confirm(`إزالة \"${memberName}\" من الليج؟`)) return;
    try {
      const { error } = await supabase.from('mini_league_members').delete().eq('league_id',leagueId).eq('user_id',userId);
      if (error) throw error;
      showMsg(`✅ تم إزالة \"${memberName}\"`); await loadLeagues();
    } catch (err:any) { showMsg('❌ '+(err?.message||'خطأ'),'error'); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // ⑧ Export CSV helpers
  const exportPredictionsCSV = () => {
    const headers = ['اللاعب','المباراة','توقع','نتيجة فعلية','نقاط','وقت التسجيل'];
    const rows = predictions.map(p => [
      p.user_name||p.user_email?.split('@')[0]||'—',
      `${p.home_team} × ${p.away_team}`,
      `${p.predicted_home_score}-${p.predicted_away_score}`,
      p.actual_home_score!==null ? `${p.actual_home_score}-${p.actual_away_score}` : '—',
      p.actual_home_score!==null ? (p.points||0) : '—',
      p.submitted_at ? new Date(p.submitted_at).toLocaleString('ar-EG') : '—',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `predictions-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const exportLeaderboardCSV = () => {
    const headers = ['#','الاسم','الإيميل','النقاط','عدد التوقعات'];
    const rows = leaderboard.map((p,i) => [i+1, p.full_name||'—', p.user_email, p.total, p.count]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `leaderboard-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // 📦 تصدير شامل لكل الأعضاء ببياناتهم الكاملة
  const exportAllMembersCSV = () => {
    const esc = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    };
    const headers = ['#','الاسم','الإيميل','التليفون','رابط فيسبوك','Facebook ID','الفريق المفضل','تاريخ الميلاد','كود الإحالة','إجمالي النقاط','عدد التوقعات','عدد الإحالات','البروفايل مكتمل','تاريخ التسجيل'];
    const rows = leaderboard.map((p,i) => {
      const prof = profilesMap[p.user_id] || {};
      const created = prof.created_at ? new Date(prof.created_at).toLocaleString('ar-EG') : '';
      return [
        i+1, p.full_name||'—', p.user_email||'', p.phone||'', p.facebook_url||'', p.facebook_id||'',
        p.football_team||'', p.date_of_birth||'', p.referral_code||'', p.total||0, p.count||0,
        p.referral_count||0, p.profile_completed ? 'نعم':'لا', created,
      ].map(esc);
    });
    const csv = [headers.map(esc), ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `all-members-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // ⑫ تحميل التقارير من الـ views (مرة واحدة عند فتح التاب)
  const loadReports = useCallback(async (force = false) => {
    if ((rptLoaded && !force) || rptLoading) return;
    setRptLoading(true);
    try {
      const [ov, ref, sus, inact, rc, pd, la, tpr, gr, ba, pen, integ, soc, fo, pl] = await Promise.all([
        supabase.from('admin_report_overview_stats_v1').select('*').single(),
        supabase.from('admin_report_top_referrers_v1').select('*').order('referral_count',{ascending:false}).limit(500),
        supabase.from('admin_report_suspicious_late_points_v1').select('*').order('total_late_points',{ascending:false}).limit(500),
        supabase.from('admin_report_inactive_users_v1').select('*').order('created_at',{ascending:false}).limit(500),
        supabase.from('admin_report_round_completion_v1').select('*').order('round_start',{ascending:true}),
        supabase.from('admin_report_points_distribution_v1').select('*'),
        supabase.from('admin_report_league_activity_v1').select('*').order('member_count',{ascending:false}).limit(500),
        supabase.from('admin_report_top_per_round_v1').select('*').order('round',{ascending:true}).order('rank_in_round',{ascending:true}),
        supabase.from('admin_report_user_growth_v1').select('*').order('day',{ascending:false}).limit(60),
        supabase.from('admin_report_bonus_audit_v1').select('*').order('duplicate_grants',{ascending:false}).limit(500),
        supabase.from('admin_report_penalties_v1').select('*').order('penalty_points',{ascending:false}).limit(500),
        supabase.from('admin_report_integrity_repeat_offenders_v1').select('*').order('rounds_affected',{ascending:false}).limit(500),
        supabase.from('admin_report_social_activity_v1').select('*').order('total_activities',{ascending:false}).limit(500),
        supabase.from('admin_report_finished_but_open_v1').select('*').order('match_date',{ascending:false}),
        supabase.from('admin_report_prize_lifecycle_v1').select('*').order('start_date',{ascending:true}),
      ]);
      // الاستفتاء: نجلب كل الصفوف عبر التقسيم (PostgREST بيسقّف عند 1000 حتى مع limit أكبر)
      const dsRows = await fetchAll(() =>
        supabase.from('admin_report_dream_survey_v1').select('*').order('updated_at',{ascending:false})
      );
      if (ov.data) setRptOverview(ov.data);
      if (ref.data) setRptReferrers(ref.data);
      if (sus.data) setRptSuspicious(sus.data);
      if (inact.data) setRptInactive(inact.data);
      if (rc.data) setRptRoundCompletion(rc.data);
      if (pd.data) setRptPointsDist(pd.data);
      if (la.data) setRptLeagueActivity(la.data);
      if (tpr.data) setRptTopPerRound(tpr.data);
      if (gr.data) setRptGrowth(gr.data);
      if (ba.data) setRptBonusAudit(ba.data);
      if (pen.data) setRptPenalties(pen.data);
      if (integ.data) setRptIntegrity(integ.data);
      if (soc.data) setRptSocial(soc.data);
      if (fo.data) setRptFinishedOpen(fo.data);
      if (pl.data) setRptPrizeLifecycle(pl.data);
      setRptDreamSurvey(dsRows);
      setRptLoaded(true);
    } catch {
      showMsg('⚠️ تعذّر تحميل التقارير', 'error');
    } finally {
      setRptLoading(false);
    }
  }, [rptLoaded, rptLoading, showMsg, fetchAll]);

  // تصدير عام لأي تقرير (CSV متوافق مع Excel — BOM + UTF-8)
  const exportReportCSV = (headers: string[], rows: (string|number|null)[][], name: string) => {
    const esc = (v: string|number|null) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const csv = [headers, ...rows].map(r => r.map(esc).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${name}-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  const exportReferrersCSV = () => exportReportCSV(
    ['#','الاسم','التليفون','الإيميل','عدد الدعوات','مدعو من','الدعوات المحتسبة','نقاط الدعوة'],
    rptReferrers.map((r,i)=>[i+1, r.full_name||'—', r.phone||'', r.user_email||'', r.referral_count, r.referred_by_name||'', r.counted_referrals, r.referral_points]),
    'top-referrers'
  );
  const exportSuspiciousCSV = () => exportReportCSV(
    ['#','الاسم','الإيميل','ماتشات استفاد منها','إجمالي النقاط المتأخرة','أقصى تأخير','تصنيف التأخير'],
    rptSuspicious.map((r,i)=>[i+1, r.display_name||'—', r.user_email||'', r.benefited_fixtures, r.total_late_points, r.max_delay_overall||'', r.delay_bucket]),
    'suspicious-late-points'
  );
  const exportInactiveCSV = () => exportReportCSV(
    ['#','الاسم','التليفون','الإيميل','البروفايل مكتمل','من دعوة','تاريخ التسجيل'],
    rptInactive.map((r,i)=>[i+1, r.full_name||'—', r.phone||'', r.user_email||'', r.profile_completed?'نعم':'لا', r.came_from_referral?'نعم':'لا', r.created_at?String(r.created_at).slice(0,10):'']),
    'inactive-members'
  );
  const exportRoundCompletionCSV = () => exportReportCSV(
    ['الجولة','عدد الماتشات','عدد التوقعات','عدد المتوقعين','متوسط التوقعات/مستخدم','نسبة الاكتمال %'],
    rptRoundCompletion.map(r=>[roundLabels[r.round]||r.round, r.fixtures_count, r.predictions_count, r.predictors_count, r.avg_preds_per_user, r.fill_rate_pct]),
    'round-completion'
  );
  const exportPointsDistCSV = () => exportReportCSV(
    ['الشريحة','عدد الأعضاء','النسبة %'],
    rptPointsDist.map(r=>[r.bucket_label, r.members_count, r.pct]),
    'points-distribution'
  );
  const exportLeagueActivityCSV = () => exportReportCSV(
    ['#','اسم الليج','الكود','نشط','المنشئ','إيميل المنشئ','عدد الأعضاء','دعوات معلّقة','تاريخ الإنشاء'],
    rptLeagueActivity.map((r,i)=>[i+1, r.league_name||'—', r.code||'', r.is_active?'نعم':'لا', r.creator_name||'', r.creator_email||'', r.member_count, r.pending_invites, r.created_at?String(r.created_at).slice(0,10):'']),
    'league-activity'
  );
  const exportTopPerRoundCSV = () => exportReportCSV(
    ['الجولة','الترتيب','الاسم','الإيميل','النقاط','عدد التوقعات'],
    rptTopPerRound.map(r=>[roundLabels[r.round]||r.round, r.rank_in_round, r.display_name||'—', r.user_email||'', r.total_points, r.predictions_count]),
    'top-per-round'
  );
  const exportGrowthCSV = () => exportReportCSV(
    ['اليوم','أعضاء جدد','بروفايل مكتمل','من دعوة','من فيسبوك','من جوجل','التراكمي'],
    rptGrowth.map(r=>[r.day?String(r.day).slice(0,10):'', r.new_members, r.completed_profiles, r.from_referral, r.from_facebook, r.from_google, r.cumulative_members]),
    'user-growth'
  );
  const exportBonusAuditCSV = () => exportReportCSV(
    ['الاسم','الإيميل','التليفون','عدد المنح','أصناف متميزة','إجمالي النقاط','منح مكررة','به تكرار؟','المصادر','أول منحة','آخر منحة'],
    rptBonusAudit.map(r=>[r.full_name||'—', r.email||'', r.phone||'', r.grant_count, r.distinct_categories, r.total_bonus_points, r.duplicate_grants, r.has_duplicate?'نعم':'لا', r.sources||'', r.first_granted?String(r.first_granted).slice(0,10):'', r.last_granted?String(r.last_granted).slice(0,10):'']),
    'bonus-audit'
  );
  const exportPenaltiesCSV = () => exportReportCSV(
    ['الاسم','الإيميل','التليفون','النقاط','الحالة','نشط؟','المصدر','الرسالة','تاريخ الإنشاء'],
    rptPenalties.map(r=>[r.display_name||'—', r.user_email||'', r.phone||'', r.penalty_points, r.status, r.is_active?'نعم':'لا', r.source||'', r.message||'', r.created_at?String(r.created_at).slice(0,10):'']),
    'penalties'
  );
  const exportIntegrityCSV = () => exportReportCSV(
    ['الاسم','الإيميل','جولات متأثرة','توقعات متأخرة','إجمالي النقاط المتأخرة','أقصى تأخير (ثانية)','مخالف متكرر؟'],
    rptIntegrity.map(r=>[r.display_name||'—', r.user_email||'', r.rounds_affected, r.late_predictions, r.total_late_points, r.max_delay_seconds, r.is_repeat_offender?'نعم':'لا']),
    'integrity-offenders'
  );
  const exportSocialCSV = () => exportReportCSV(
    ['الاسم','الإيميل','إجمالي الأنشطة','مشاركات','أحداث ربح نقاط','أحداث خسارة نقاط','دعوات','انضمام ليجات','آخر نشاط'],
    rptSocial.map(r=>[r.display_name||'—', r.user_email||'', r.total_activities, r.shares, r.points_earned_events, r.points_lost_events, r.invites, r.league_joins, r.last_activity?String(r.last_activity).slice(0,10):'']),
    'social-activity'
  );
  const exportFinishedOpenCSV = () => exportReportCSV(
    ['ID','API ID','الجولة','الفريق المستضيف','الفريق الضيف','هدف المستضيف','هدف الضيف','تاريخ الماتش','مفتوح؟'],
    rptFinishedOpen.map(r=>[r.id, r.api_fixture_id, roundLabels[r.round]||r.round, r.home_team_name||'', r.away_team_name||'', r.actual_home_score, r.actual_away_score, r.match_date?String(r.match_date).slice(0,16).replace('T',' '):'', r.is_open?'نعم':'لا']),
    'finished-but-open'
  );
  const exportPrizeLifecycleCSV = () => exportReportCSV(
    ['الاسم','المفتاح','البداية','النهاية','الحالة','الفائزون المتوقعون','الجائزة','تراكمي؟','فائزون مسجلون','انتهت الفترة؟','يحتاج فائزين؟','ناقص فائزين؟'],
    rptPrizeLifecycle.map(r=>[r.name||'—', r.phase_key||'', r.start_date?String(r.start_date).slice(0,10):'', r.end_date?String(r.end_date).slice(0,10):'', r.status, r.expected_winners, r.prize_label||'', r.is_cumulative?'نعم':'لا', r.recorded_winners, r.period_ended?'نعم':'لا', r.needs_winners?'نعم':'لا', r.incomplete_winners?'نعم':'لا']),
    'prize-lifecycle'
  );
  const exportDreamSurveyCSV = () => exportReportCSV(
    ['#','الاسم','التليفون','الإيميل','الاختيار','تاريخ الاختيار'],
    rptDreamSurvey.map((r,i)=>[i+1, r.full_name||'—', r.phone||'', r.user_email||'', r.choice_label||r.choice, r.updated_at?String(r.updated_at).slice(0,16).replace('T',' '):'']),
    'dream-league-survey'
  );

  // تطبيع اسم الهداف: يشيل الحركات (Muñoz→munoz) + lowercase + trim
  const normalizeScorerName = (name: string | null | undefined): string =>
    (name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const openBreakdown = (p: any) => {
  const userPreds = predictions
    .filter(pr => pr.user_id === p.user_id && pr.points !== null)
    .map(pr => {
      const items: { icon: string; label: string; pts: number }[] = [];

      // جلب حقائق الماتش من matches state (لأنها في جدول fixtures مش predictions)
      const mx = matches.find((m: any) => m.fixture.id === pr.fixture_id);
      const actualFirstScorer = mx?.first_scorer ?? '';
      const actualFirstScorerId = mx?.first_scorer_id ?? null;
      const scorersIds: number[] = Array.isArray(mx?.scorers_ids_json) ? mx.scorers_ids_json : [];
      const redCardInMatch = mx?.red_card_in_match ?? false;
      const penaltyInMatch = mx?.penalty_in_match ?? false;
      const wentExtraTime = mx?.went_extra_time ?? false;
      const wentPenaltyShootout = mx?.went_penalty_shootout ?? false;
      const bothTeamsScored = mx?.both_teams_scored ?? false;

      const isExact =
        pr.predicted_home_score === pr.actual_home_score &&
        pr.predicted_away_score === pr.actual_away_score;

      if (isExact) {
        items.push({ icon: '🎯', label: 'نتيجة كاملة', pts: 10 });
      } else {
        const homeWin = pr.actual_home_score > pr.actual_away_score;
        const awayWin = pr.actual_away_score > pr.actual_home_score;
        const isDraw = pr.actual_home_score === pr.actual_away_score;

        const pHomeWin = pr.predicted_home_score > pr.predicted_away_score;
        const pAwayWin = pr.predicted_away_score > pr.predicted_home_score;
        const pDraw = pr.predicted_home_score === pr.predicted_away_score;

        const correctOutcome =
          (homeWin && pHomeWin) ||
          (awayWin && pAwayWin) ||
          (isDraw && pDraw);

        if (correctOutcome) {
          items.push({ icon: '✅', label: 'فائز/تعادل صح', pts: 5 });
        }
      }

      // أول هدف: أولوية للـ ID (مطابقة دقيقة)، ثم fallback بالاسم المُطبَّع (زي منطق update-results)
      const predScorerId =
        pr.predicted_first_scorer_id !== null && pr.predicted_first_scorer_id !== undefined
          ? Number(pr.predicted_first_scorer_id)
          : null;
      const scorerExactById =
        predScorerId !== null && actualFirstScorerId !== null &&
        predScorerId === Number(actualFirstScorerId);
      const scorerInListById =
        predScorerId !== null && scorersIds.map(Number).includes(predScorerId);
      const scorerByName =
        !!pr.predicted_first_scorer && !!actualFirstScorer &&
        normalizeScorerName(pr.predicted_first_scorer) === normalizeScorerName(actualFirstScorer);

      if (scorerExactById || scorerByName) {
        items.push({ icon: '⚽', label: 'أول هدف صح', pts: 3 });
      } else if (scorerInListById) {
        items.push({ icon: '⚽', label: 'سجّل هدف (مش الأول)', pts: 1 });
      }

      if (pr.predicted_red_card && redCardInMatch) {
        items.push({ icon: '🟥', label: 'كرت أحمر صح', pts: 3 });
      }
      if (!redCardInMatch && pr.predicted_red_card) {
        items.push({ icon: '🟥', label: 'كرت أحمر غلط', pts: -1 });
      }

      if (pr.predicted_penalty && penaltyInMatch) {
        items.push({ icon: '⚽', label: 'ضربة جزاء في الماتش صح', pts: 3 });
      }
      if (!penaltyInMatch && pr.predicted_penalty) {
        items.push({ icon: '⚽', label: 'ضربة جزاء في الماتش غلط', pts: -1 });
      }

      if (pr.predicted_extra_time && wentExtraTime) {
        items.push({ icon: '⏱️', label: 'وقت إضافي صح', pts: 2 });
      }
      if (!wentExtraTime && pr.predicted_extra_time) {
        items.push({ icon: '⏱️', label: 'وقت إضافي غلط', pts: -1 });
      }

      if (pr.predicted_penalty_shootout && wentPenaltyShootout) {
        items.push({ icon: '🎯', label: 'الماتش راح لركلات الترجيح صح', pts: 3 });
      }
      if (!wentPenaltyShootout && pr.predicted_penalty_shootout) {
        items.push({ icon: '🎯', label: 'الماتش راح لركلات الترجيح غلط', pts: -1 });
      }

      if (pr.predicted_both_teams && bothTeamsScored) {
        items.push({ icon: '🔄', label: 'الفريقين سجلا', pts: 2 });
      }

      return {
        ...pr,
        first_scorer_actual: actualFirstScorer, // للعرض في نافذة التفاصيل
        items,
        calcTotal: Math.max(0, items.reduce((s, i) => s + i.pts, 0)),
      };
    });

  setBreakdownUser(p);
  setBreakdownPreds(userPreds);
  setShowBreakdown(true);

  // ── جلب بيانات البروفايل الكاملة (الإيميل من auth.users) عبر الدالة الآمنة ──
  setProfileDetails(null);
  setLoadingProfile(true);
  (async () => {
    try {
      const { data, error } = await supabase.rpc('admin_profile_full', { p_user_id: p.user_id });
      if (!error && data && data.length > 0) setProfileDetails(data[0]);
    } catch (err) {
      console.error('admin_profile_full:', err);
    } finally {
      setLoadingProfile(false);
    }
  })();
};

  // ⑩ إعادة حساب نقاط مستخدم واحد (يستدعي refreshuserpoints) ثم يحدّث الواجهة
  const recalcSingleUser = async (userId: string, name: string) => {
    setRecalcingUser(true);
    try {
      const { error } = await supabase.rpc('refreshuserpoints', { p_userid: userId });
      if (error) throw error;
      // إعادة تحميل الصدارة لجلب النقاط المحدّثة
      await loadLeaderboard();
      showMsg(`✅ تم إعادة حساب نقاط "${name}"`);
      setShowBreakdown(false);
    } catch (err: any) {
      showMsg('❌ ' + (err?.message || 'خطأ في إعادة الحساب'), 'error');
    }
    setRecalcingUser(false);
  };

  // ── نداء موحّد لـ API إدارة النقاط ──
  const callAdjustment = async (payload: Record<string, any>, okMsg: string) => {
    setAdjBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('انتهت الجلسة، سجّل الدخول من جديد');
      const res = await fetch('/api/admin-adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok || !j?.success) throw new Error(j?.error || 'فشل الطلب');
      showMsg(okMsg);
      await loadLeaderboard();
      await loadReports(true); // إعادة تحميل التقارير (بونص/خصومات) بعد التعديل
      return j;
    } catch (err: any) {
      showMsg('❌ ' + (err?.message || 'خطأ في الطلب'), 'error');
      return null;
    } finally {
      setAdjBusy(false);
    }
  };

  // إضافة بونص أو خصم من الفورم الموحّد (بالإيميل)
  const submitAdjustment = async () => {
    const email = adjEmail.trim().toLowerCase();
    const pts = Number(adjPoints);
    const reason = adjReason.trim();
    if (!email) { showMsg('❌ الإيميل مطلوب', 'error'); return; }
    if (!Number.isFinite(pts) || pts <= 0) { showMsg('❌ عدد النقاط لازم يكون رقم موجب', 'error'); return; }
    if (!reason) { showMsg('❌ السبب مطلوب', 'error'); return; }
    const payload = adjKind === 'bonus'
      ? { action:'bonus_add', email, bonus_points: pts, source: reason }
      : { action:'penalty_add', email, penalty_points: pts, message: reason };
    const ok = await callAdjustment(payload, adjKind==='bonus' ? `✅ تمت إضافة بونص ${pts} لـ ${email}` : `✅ تم خصم ${pts} من ${email}`);
    if (ok) { setAdjEmail(''); setAdjPoints(''); setAdjReason(''); }
  };

  // فتح مودال المنح الفردية لعضو (يجيب صفوف bonus_grants الخاصة به)
  const openGrantsModal = async (row: any) => {
    setGrantsModalUser(row);
    setGrantsLoading(true);
    try {
      const { data, error } = await supabase
        .from('bonus_grants').select('*').eq('user_id', row.user_id).order('granted_at', { ascending: false });
      if (error) throw error;
      setGrantsRows(data || []);
    } catch (err: any) {
      showMsg('❌ خطأ في جلب المنح', 'error');
      setGrantsRows([]);
    }
    setGrantsLoading(false);
  };

  const reloadGrantsModal = async () => {
    if (grantsModalUser) await openGrantsModal(grantsModalUser);
  };

  // ① تحميل صدارة جولة معينة من الـ view الجاهز (نفس مصدر صفحة الصدارة)
  const loadRoundLeaderboard = async (round: string) => {
    setLoadingRoundLb(true);
    try {
      const { data, error } = await supabase
        .from('leaderboard_rounds_v1')
        .select('*')
        .eq('round', round)
        .order('total_points', { ascending: false })
        .order('predictions_count', { ascending: false });
      if (error) throw error;
      setRoundLeaderboard((data || []).map((row: any) => ({
        user_id: row.user_id,
        user_email: row.user_email || '',
        full_name: row.display_name || row.user_email?.split('@')[0] || '—',
        total: row.total_points || 0,
        count: row.predictions_count || 0,
        profile_completed: row.profile_completed ?? false,
        bonus_points: row.bonus_points ?? 0,
        referral_count: 0,
      })));
    } catch (err: any) {
      console.error('loadRoundLeaderboard:', err);
      setRoundLeaderboard([]);
      showMsg('❌ خطأ في تحميل صدارة الجولة', 'error');
    }
    setLoadingRoundLb(false);
  };

  // ① عند اختيار نطاق الصدارة (عام / جولة)
  const selectLbScope = (scope: string) => {
    setLbScope(scope);
    setLbSearch('');
    if (scope !== 'general') loadRoundLeaderboard(scope);
  };
  // ─── Render states ─────────────────────────────────────
  // 🔐 البوابة الثانية: يوزرنيم + باسورد (بعد تأكيد الإيميل وقبل فتح اللوحة)
  if (user && !gateOk) return (
    <div style={{display:'grid',placeItems:'center',minHeight:'100vh',background:'#070809',fontFamily:"'Cairo',sans-serif",padding:24}}>
      <form onSubmit={submitGate} style={{width:'100%',maxWidth:360,background:'linear-gradient(180deg,#141a26,#0f141e)',border:'1px solid #1e2836',borderRadius:16,padding:'28px 22px',display:'flex',flexDirection:'column',gap:14,boxShadow:'0 8px 40px rgba(0,0,0,.5)'}}>
        <div style={{textAlign:'center',marginBottom:4}}>
          <div style={{fontSize:38}}>🔐</div>
          <div style={{fontSize:19,fontWeight:900,color:'#d9b25f',marginTop:6}}>دخول لوحة التحكم</div>
          <div style={{fontSize:12,color:'#a8a39a',marginTop:4}}>ادخل يوزرنيم وكلمة مرور الأدمن</div>
        </div>
        <input value={gateUser} onChange={e=>setGateUser(e.target.value)} placeholder="اليوزرنيم" autoComplete="username" style={{padding:'11px 13px',borderRadius:10,border:'1px solid #263041',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",direction:'ltr',textAlign:'left'}} />
        <input value={gatePass} onChange={e=>setGatePass(e.target.value)} placeholder="كلمة المرور" type="password" autoComplete="current-password" style={{padding:'11px 13px',borderRadius:10,border:'1px solid #263041',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",direction:'ltr',textAlign:'left'}} />
        {gateErr && <div style={{color:'#f87171',fontSize:12,fontWeight:700,textAlign:'center'}}>{gateErr}</div>}
        <button type="submit" disabled={gateBusy||!gateUser||!gatePass} style={{padding:'12px',borderRadius:10,border:'none',background:gateBusy?'#5a4d2a':'#d9b25f',color:'#0b0f16',fontSize:15,fontWeight:900,fontFamily:"'Cairo',sans-serif",cursor:gateBusy?'default':'pointer',opacity:(!gateUser||!gatePass)?.6:1}}>{gateBusy?'…جارٍ التحقق':'دخول'}</button>
        <button type="button" onClick={async()=>{ await supabase.auth.signOut(); router.push('/login'); }} style={{background:'none',border:'none',color:'#a8a39a',fontSize:12,fontFamily:"'Cairo',sans-serif",cursor:'pointer',marginTop:2}}>تسجيل خروج</button>
      </form>
    </div>
  );

  if (loading) return (
    <div style={{display:'grid',placeItems:'center',height:'100vh',background:'#070809',color:'#d9b25f',fontFamily:"'Cairo',sans-serif",gap:16,fontSize:18}}>
      <div style={{fontSize:40}}>⚙️</div>
      <div>جاري التحميل...</div>
    </div>
  );

  // ① شاشة الخطأ + retry ✅
  if (loadError) return (
    <div style={{display:'grid',placeItems:'center',height:'100vh',background:'#070809',fontFamily:"'Cairo',sans-serif",gap:16,textAlign:'center',padding:24}}>
      <div style={{fontSize:48}}>⚠️</div>
      <div style={{fontSize:18,color:'#f4f1e8'}}>حدث خطأ أثناء تحميل البيانات</div>
      <div style={{fontSize:13,color:'#a8a39a'}}>تحقق من اتصالك بالإنترنت وحاول مجدداً</div>
      <button
        onClick={() => { setLoadError(false); setLoading(true); loadMatches(); loadPredictions(); loadLeaderboard(); loadLeagues(); }}
        style={{padding:'12px 32px',borderRadius:14,border:'none',background:'#d9b25f',color:'#1a1200',fontFamily:"'Cairo',sans-serif",fontSize:16,fontWeight:700,cursor:'pointer'}}
      >
        🔄 إعادة المحاولة
      </button>
    </div>
  );

  // ④ computed stats ✅
  const filteredMatches    = matches.filter(m => m.league.round === activeRound);
  const medals             = ['🥇','🥈','🥉'];
  const totalLeagueMembers = leagues.reduce((s,lg)=>s+lg.member_count,0);
  const totalPending       = leagues.reduce((s,lg)=>s+lg.pending_invites,0);
  const biggestLeague      = leagues.reduce((best,lg)=>lg.member_count>(best?.member_count||0)?lg:best,null as any);
  const rounds             = [...new Set(matches.map((m:any)=>m.league?.round).filter(Boolean))] as string[];

  // ③ ماتشات خلصت (ليها نتيجة) بس لسة مفتوحة للتوقع — حماية من نسيان الغلق
  const finishedButOpen = matches.filter(m => m.actual_home_score !== null && m.actual_home_score !== undefined && m.is_open);

  // ⑦ filtered predictions ✅
  // ⑧ بحث التوقعات (اسم/إيميل)، مُطبَّع
  const predSearchQ = normalizeScorerName(predSearch);
  const visiblePredictions = predictions.filter(p => {
    if (predRoundFilter !== 'all') {
      const m = matches.find(m => m.fixture.id === p.fixture_id);
      if (!m || m.league?.round !== predRoundFilter) return false;
    }
   if (predStatusFilter === 'ungraded' && p.points !== null) return false;
    if (predSearchQ) {
      const hay = normalizeScorerName(`${p.user_name || ''} ${p.user_email || ''}`);
      if (!hay.includes(predSearchQ)) return false;
    }
    return true;
  });

  // ⑧ بحث الصدارة (اسم/إيميل)، مُطبَّع — مع الحفاظ على الترتيب الأصلي
  const lbSearchQ = normalizeScorerName(lbSearch);
  const lbSource = lbScope === 'general' ? leaderboard : roundLeaderboard;
  const visibleLeaderboard = lbSearchQ
    ? lbSource.filter((p: any) =>
        normalizeScorerName(`${p.full_name || ''} ${p.user_email || ''}`).includes(lbSearchQ))
    : lbSource;

  // ⑥ round badges ✅
  const roundOpenMap: Record<string,{open:number,total:number}> = {};
  rounds.forEach(r => {
    const rm = matches.filter(m => m.league?.round === r);
    roundOpenMap[r] = { open: rm.filter(m => m.is_open).length, total: rm.length };
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
        :root{--bg:#070809;--surface:#111315;--surface-2:#171a1d;--surface-3:#1d2125;--line:rgba(255,255,255,.08);--text:#f4f1e8;--muted:#a8a39a;--gold:#d9b25f;--red:#c93a2f;--green:#27b06e}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:var(--bg);color:var(--text);font-family:'Cairo',sans-serif;direction:rtl;min-height:100vh}
        .tab-btn{padding:10px 22px;border-radius:12px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-family:'Cairo',sans-serif;font-size:14px;font-weight:700;transition:all .2s;white-space:nowrap;flex-shrink:0}
        .tab-btn.active{background:linear-gradient(135deg,rgba(217,178,95,.15),rgba(217,178,95,.05));border-color:rgba(217,178,95,.28);color:var(--gold)}
        .round-btn{padding:8px 16px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--muted);cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;transition:all .2s;white-space:nowrap;flex-shrink:0}
        .round-btn.active{background:rgba(217,178,95,.14);border-color:rgba(217,178,95,.3);color:var(--gold)}
        .action-btn{padding:10px 20px;border-radius:12px;border:none;color:#fff;cursor:pointer;font-family:'Cairo',sans-serif;font-size:13px;font-weight:700;transition:opacity .18s}
        .action-btn:disabled{opacity:.6;cursor:not-allowed}
        .action-btn:hover:not(:disabled){opacity:.85}
        .field-input{width:100%;padding:12px 16px;border-radius:12px;background:var(--surface-3);border:1px solid var(--line);color:var(--text);font-family:'Cairo',sans-serif;font-size:14px;outline:none;transition:border-color .2s}
        .field-input:focus{border-color:rgba(217,178,95,.4)}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 14px;text-align:right;border-bottom:1px solid var(--line);font-size:13px}
        th{color:var(--muted);font-weight:700;background:var(--surface-2)}
        tr:hover td{background:rgba(255,255,255,.015)}
        .league-card{background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,.01));border:1px solid var(--line);border-radius:18px;padding:16px 20px;margin-bottom:10px}
        .league-card:hover{border-color:rgba(217,178,95,.2)}
        .del-btn{padding:6px 12px;border-radius:10px;border:1px solid rgba(201,58,47,.25);background:rgba(201,58,47,.08);color:#ff9c91;font-size:12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;transition:opacity .18s}
        .del-btn:hover{opacity:.75}
        .export-btn{padding:8px 16px;border-radius:10px;border:1px solid rgba(217,178,95,.25);background:rgba(217,178,95,.08);color:var(--gold);font-size:12px;font-weight:700;font-family:'Cairo',sans-serif;cursor:pointer;transition:opacity .18s}
        .export-btn:hover{opacity:.75}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        .auto-pulse{animation:pulse 2s ease-in-out infinite}
      `}</style>

      {/* HEADER */}
      <div style={{background:'var(--surface)',borderBottom:'1px solid var(--line)',padding:'14px 24px',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{fontSize:28}}>⚙️</div>
        <div>
          <div style={{fontWeight:800,fontSize:18,color:'var(--gold)'}}>لوحة التحكم</div>
          <div style={{fontSize:12,color:'var(--muted)'}}>كأس العالم 2026 — الشمعدان</div>
        </div>
        {/* ⑤ lastAutoUpdate معروض ✅ */}
        <div style={{marginRight:'auto',display:'flex',alignItems:'center',gap:8,fontSize:12,color:'var(--muted)'}}>
          <span className={autoUpdating ? 'auto-pulse' : ''} style={{color:autoUpdating?'var(--gold)':'var(--muted)'}}>🔄</span>
          <span>{autoUpdating ? 'تحديث أوتوماتيك...' : lastAutoUpdate ? `آخر تحديث: ${lastAutoUpdate}` : 'تحديث كل 5 دقايق'}</span>
        </div>
        <a href="/leaderboard" style={{color:'var(--gold)',textDecoration:'none',fontSize:13,fontWeight:700}}>🏁 الصدارة</a>
        <button onClick={syncFixtures} disabled={syncing} className="action-btn" style={{background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',fontSize:12}}>
          {syncing?'⏳ مزامنة...':'🔄 مزامنة'}
        </button>
        <button onClick={syncSquads} disabled={syncingSquads} className="action-btn" style={{background:'linear-gradient(135deg,#6366f1,#4338ca)',fontSize:12}}>
          {syncingSquads ? '⏳ جاري التحديث...' : '👥 تحديث السكواد'}
        </button>
        <button onClick={updateAllPoints} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:12}}>
          {updating?'⏳ جاري...':'⚡ تحديث النقاط'}
        </button>
        <button onClick={()=>{setShowPwModal(true);setPwMsg('');setPwOld('');setPwNew('');setPwNew2('');}} className="action-btn" style={{background:'rgba(217,178,95,.12)',border:'1px solid rgba(217,178,95,.25)',color:'#d9b25f',fontSize:12}}>🔑 تغيير كلمة المرور</button>
        <button onClick={handleLogout} className="action-btn" style={{background:'rgba(201,58,47,.2)',border:'1px solid rgba(201,58,47,.3)',color:'#ff9c91',fontSize:12}}>خروج</button>
      </div>

      {/* 🔒 لوحة تحكم إيقاف/تشغيل التسجيل */}
      <div style={{margin:'0 24px 4px',padding:'14px 16px',borderRadius:14,border:'1px solid rgba(217,178,95,.22)',background:'rgba(217,178,95,.05)',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:16}}>{regOpen?'🟢':'🔒'}</span>
            <div>
              <div style={{fontSize:14,fontWeight:900,color:'#f4f1e8'}}>حالة التسجيل: {regOpen?'مفتوح':'مقفول'}</div>
              <div style={{fontSize:11,color:'#a8a39a'}}>لمّا يقفل، الأعضاء الحاليين بس يقدروا يدخلوا (برابط الإيميل)، والرسالة تظهر في الداشبورد وصفحة الدخول</div>
            </div>
          </div>
          <button onClick={()=>saveRegStatus(!regOpen)} disabled={regBusy} className="action-btn" style={{background:regOpen?'rgba(201,58,47,.2)':'rgba(39,176,110,.2)',border:`1px solid ${regOpen?'rgba(201,58,47,.35)':'rgba(39,176,110,.35)'}`,color:regOpen?'#ff9c91':'#5effa8',fontSize:12,fontWeight:800}}>
            {regBusy?'…جارٍ':(regOpen?'🔒 قفل التسجيل':'🟢 فتح التسجيل')}
          </button>
        </div>
        <textarea value={regMsgText} onChange={e=>setRegMsgText(e.target.value)} rows={2} placeholder="نص الرسالة اللي تظهر للأعضاء وقت إيقاف التسجيل…" style={{width:'100%',resize:'vertical',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:'#0b0f16',color:'#f4f1e8',fontSize:13,fontFamily:"'Cairo',sans-serif",lineHeight:1.7}} />
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>saveRegStatus(regOpen)} disabled={regBusy} className="action-btn" style={{background:'rgba(217,178,95,.15)',border:'1px solid rgba(217,178,95,.3)',color:'#d9b25f',fontSize:12,fontWeight:800}}>💾 حفظ نص الرسالة</button>
          {regSaveMsg && <span style={{fontSize:12,fontWeight:700,color:regSaveMsg.startsWith('✅')?'#5effa8':'#ff9c91'}}>{regSaveMsg}</span>}
        </div>
      </div>

      {/* 🔢 ضبط عدد الأعضاء المعروض للجمهور */}
      <div style={{margin:'0 24px 4px',padding:'14px 16px',borderRadius:14,border:'1px solid rgba(127,209,255,.22)',background:'rgba(127,209,255,.05)',display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
          <span style={{fontSize:16}}>🔢</span>
          <div>
            <div style={{fontSize:14,fontWeight:900,color:'#f4f1e8'}}>عدد الأعضاء المعروض (الرئيسية)</div>
            <div style={{fontSize:11,color:'#a8a39a'}}>
              الحقيقي: <strong style={{color:'#f4f1e8'}}>{mdReal ?? '…'}</strong> · المعروض حاليًا: <strong style={{color:'#7fd1ff'}}>{mdDisplayed ?? '…'}</strong> — بيغيّر العرض بس، ما بيمسش أي عضو
            </div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <input value={mdInput} onChange={e=>setMdInput(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="الرقم اللي يظهر" style={{width:140,padding:'10px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,.12)',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",textAlign:'center',fontVariantNumeric:'tabular-nums'}} />
          <button onClick={()=>saveMembersDisplay('override')} disabled={mdBusy} className="action-btn" style={{background:'rgba(127,209,255,.15)',border:'1px solid rgba(127,209,255,.3)',color:'#7fd1ff',fontSize:12,fontWeight:800}}>💾 تثبيت الرقم</button>
          <button onClick={()=>saveMembersDisplay('reset')} disabled={mdBusy} className="action-btn" style={{background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.14)',color:'#a8a39a',fontSize:12,fontWeight:700}}>↺ الرجوع للحقيقي</button>
          {mdSaveMsg && <span style={{fontSize:12,fontWeight:700,color:mdSaveMsg.startsWith('✅')?'#5effa8':'#ff9c91'}}>{mdSaveMsg}</span>}
        </div>
      </div>

      {message && (
        <div style={{padding:'12px 24px',background:msgType==='success'?'rgba(39,176,110,.15)':'rgba(201,58,47,.15)',borderBottom:`1px solid ${msgType==='success'?'rgba(39,176,110,.25)':'rgba(201,58,47,.25)'}`,color:msgType==='success'?'var(--green)':'#ff9c91',fontWeight:700,fontSize:14,textAlign:'center'}}>
          {message}
        </div>
      )}

      {/* 🔑 موديل تغيير كلمة المرور */}
      {showPwModal && (
        <div onClick={()=>!pwBusy&&setShowPwModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'grid',placeItems:'center',zIndex:1000,padding:20}}>
          <form onClick={e=>e.stopPropagation()} onSubmit={submitPwChange} style={{width:'100%',maxWidth:360,background:'linear-gradient(180deg,#141a26,#0f141e)',border:'1px solid #1e2836',borderRadius:16,padding:'24px 22px',display:'flex',flexDirection:'column',gap:12}}>
            <div style={{textAlign:'center',fontSize:17,fontWeight:900,color:'#d9b25f'}}>🔑 تغيير كلمة المرور</div>
            <input value={pwOld} onChange={e=>setPwOld(e.target.value)} placeholder="كلمة المرور الحالية" type="password" autoComplete="current-password" style={{padding:'11px 13px',borderRadius:10,border:'1px solid #263041',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",direction:'ltr',textAlign:'left'}} />
            <input value={pwNew} onChange={e=>setPwNew(e.target.value)} placeholder="كلمة المرور الجديدة (8 أحرف فأكثر)" type="password" autoComplete="new-password" style={{padding:'11px 13px',borderRadius:10,border:'1px solid #263041',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",direction:'ltr',textAlign:'left'}} />
            <input value={pwNew2} onChange={e=>setPwNew2(e.target.value)} placeholder="تأكيد كلمة المرور الجديدة" type="password" autoComplete="new-password" style={{padding:'11px 13px',borderRadius:10,border:'1px solid #263041',background:'#0b0f16',color:'#f4f1e8',fontSize:14,fontFamily:"'Cairo',sans-serif",direction:'ltr',textAlign:'left'}} />
            {pwMsg && <div style={{fontSize:12,fontWeight:700,textAlign:'center',color:pwMsg.startsWith('✅')?'#5fd39a':'#f87171'}}>{pwMsg}</div>}
            <div style={{display:'flex',gap:8,marginTop:4}}>
              <button type="submit" disabled={pwBusy||!pwOld||!pwNew||!pwNew2} style={{flex:1,padding:'11px',borderRadius:10,border:'none',background:'#d9b25f',color:'#0b0f16',fontSize:14,fontWeight:900,fontFamily:"'Cairo',sans-serif",cursor:'pointer',opacity:(pwBusy||!pwOld||!pwNew||!pwNew2)?.6:1}}>{pwBusy?'…جارٍ':'حفظ'}</button>
              <button type="button" onClick={()=>setShowPwModal(false)} disabled={pwBusy} style={{padding:'11px 16px',borderRadius:10,border:'1px solid #263041',background:'transparent',color:'#a8a39a',fontSize:14,fontFamily:"'Cairo',sans-serif",cursor:'pointer'}}>إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* الإحصائيات انتقلت بالكامل لتاب 📊 التقارير (لوحة موحّدة من مصدر واحد) */}

      {/* ③ TABS — overflowX: auto ✅ */}
      <div style={{display:'flex',gap:8,padding:'20px 24px 16px',overflowX:'auto',scrollbarWidth:'none',WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
        {([
          {id:'matches',     label:`🏟️ الماتشات (${matches.length})`},
          {id:'predictions', label:`📋 التوقعات (${totalPredictionsCount})`},
          {id:'leaderboard', label:`🏆 الصدارة (${participantsCount})`},
          {id:'leagues',     label:`🏅 الليجات (${leagues.length})`},
          {id:'prizes',      label:`🥇 الجوائز (${prizePhases.length})`},
          {id:'reports',     label:`📊 التقارير`},
        ] as const).map(({id,label})=>(
          <button key={id} className={`tab-btn${activeTab===id?' active':''}`} onClick={()=>{setActiveTab(id); if(id==='reports') loadReports();}}>{label}</button>
        ))}
      </div>

      <div style={{padding:'0 24px 40px'}}>

        {/* ══ MATCHES ══ */}
        {activeTab==='matches' && (
          <>
            {/* ⑥ Round buttons — badge مفتوح/إجمالي ✅ */}
            <div style={{display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none',marginBottom:16,paddingBottom:4} as React.CSSProperties}>
              {rounds.map(r=>{
                const {open,total} = roundOpenMap[r]||{open:0,total:0};
                return (
                  <button key={r} className={`round-btn${activeRound===r?' active':''}`} onClick={()=>setActiveRound(r)}>
                    {roundLabels[r]||r}
                    <span style={{marginRight:6,fontSize:11,opacity:.75,fontVariantNumeric:'tabular-nums'}}>
                      ({open > 0 ? <span style={{color:'var(--green)'}}>{open}</span> : 0}/{total})
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
              <button onClick={openAllMatches} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,#22c55e,#16a34a)'}}>🟢 فتح الكل</button>
              <button onClick={closeAllMatches} disabled={updating} className="action-btn" style={{background:'linear-gradient(135deg,#ef4444,#b91c1c)'}}>🔒 غلق الكل</button>
            </div>
            {/* ③ تنبيه: ماتشات خلصت بس لسة مفتوحة للتوقع */}
            {finishedButOpen.length > 0 && (
              <div style={{background:'rgba(201,58,47,.1)',border:'1px solid rgba(201,58,47,.25)',borderRadius:14,padding:'12px 18px',marginBottom:16,display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <span style={{fontSize:20}}>⚠️</span>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{fontWeight:800,fontSize:13,color:'#ff9c91'}}>
                    في {finishedButOpen.length} ماتش خلص بس لسة مفتوح للتوقع
                  </div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:700,marginTop:2}}>
                    {finishedButOpen.slice(0,4).map((m:any)=>`${m.teams.home.name} × ${m.teams.away.name}`).join('، ')}{finishedButOpen.length>4?` وأخرى...`:''}
                  </div>
                </div>
              </div>
            )}
            {filteredMatches.map(match=>{
              const hasResult  = match.actual_home_score !== null && match.actual_home_score !== undefined;
              const matchPreds = predictions.filter(p=>p.fixture_id===match.fixture.id);
              // ⑨ % مشاركة ✅
              const participationPct = participantsCount > 0
  ? Math.round((matchPreds.length / participantsCount) * 100)
  : 0;
              return (
                <div key={match.fixture.id} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:18,padding:'16px 20px',marginBottom:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{fontWeight:800,fontSize:15,marginBottom:4}}>{match.teams.home.name} × {match.teams.away.name}</div>
                    <div style={{fontSize:12,color:'var(--muted)',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
                      <span>{new Date(match.fixture.date).toLocaleDateString('ar-EG',{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
                      <span style={{color:match.is_open?'var(--green)':'var(--red)',fontWeight:700}}>{match.is_open?'مفتوح':'مغلق'}</span>
                      {matchPreds.length > 0 && (
                        <span style={{color:'#38bdf8'}}>
                          👥 {matchPreds.length}
                          {leaderboard.length > 0 && (
                            <span style={{
                              marginRight:4, fontSize:10,
                              color: participationPct >= 70 ? 'var(--green)' : participationPct >= 40 ? '#facc15' : '#f87171',
                            }}>
                              ({participationPct}%)
                            </span>
                          )}
                        </span>
                      )}
                      {hasResult && <span style={{color:'var(--gold)',fontWeight:700}}>النتيجة: {match.actual_home_score} - {match.actual_away_score}</span>}
                      {/* ①② آخر تحديث للنتيجة */}
                      {match.updated_at && <span style={{color:'var(--muted)',fontSize:11}}>🕒 آخر تحديث: {new Date(match.updated_at).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>}
                    </div>
                  </div>
                  <button onClick={()=>toggleMatchOpen(match)} className="action-btn" style={{background:match.is_open?'linear-gradient(135deg,#ef4444,#b91c1c)':'linear-gradient(135deg,#22c55e,#16a34a)',fontSize:12,padding:'8px 14px'}}>
                    {match.is_open?'🔒 غلق':'🟢 فتح'}
                  </button>
                  <button onClick={()=>openResultModal(match)} className="action-btn" style={{background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:12,padding:'8px 14px'}}>
                    📝 {hasResult?'تعديل':'إدخال نتيجة'}
                  </button>
                </div>
              );
            })}
            {filteredMatches.length===0 && <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد ماتشات في هذه الجولة</div>}
          </>
        )}

        {/* ══ PREDICTIONS ══ */}
        {activeTab==='predictions' && (
          <>
            {/* ⑦ فلاتر التوقعات ✅ */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap',alignItems:'center'}}>
              <select
                value={predRoundFilter}
                onChange={e=>setPredRoundFilter(e.target.value)}
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',fontFamily:"'Cairo',sans-serif",fontSize:13,cursor:'pointer'}}
              >
                <option value="all">كل الجولات</option>
                {rounds.map(r=><option key={r} value={r}>{roundLabels[r]||r}</option>)}
              </select>
              <button
                onClick={()=>setPredStatusFilter(s=>s==='all'?'ungraded':'all')}
                style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${predStatusFilter==='ungraded'?'rgba(251,146,60,.4)':'var(--line)'}`,background:predStatusFilter==='ungraded'?'rgba(251,146,60,.1)':'var(--surface-2)',color:predStatusFilter==='ungraded'?'#fb923c':'var(--muted)',fontFamily:"'Cairo',sans-serif",fontSize:13,fontWeight:700,cursor:'pointer'}}
              >
                {predStatusFilter==='ungraded'?'✅ غير محسوبة فقط':'⬜ غير محسوبة فقط'}
              </button>
              {/* ⑧ بحث بالاسم/الإيميل */}
              <input
                type="text"
                value={predSearch}
                onChange={e=>setPredSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الإيميل"
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',fontFamily:"'Cairo',sans-serif",fontSize:13,outline:'none',minWidth:200}}
              />
              <span style={{fontSize:12,color:'var(--muted)',marginRight:4}}>
                يعرض {visiblePredictions.length} من {predictions.length}
              </span>
              {/* ⑧ Export CSV ✅ */}
              <button onClick={exportPredictionsCSV} className="export-btn" style={{marginRight:'auto'}}>
                ⬇️ تصدير CSV
              </button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead><tr><th>اللاعب</th><th>المباراة</th><th>توقع</th><th>نتيجة فعلية</th><th>نقاط</th><th>وقت التسجيل</th></tr></thead>
                <tbody>
                  {visiblePredictions.length===0 ? (
                    <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد توقعات</td></tr>
                  ) : visiblePredictions.map((p,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:700}}>{p.user_name||p.user_email?.split('@')[0]||'—'}</td>
                      <td>{p.home_team} × {p.away_team}</td>
                      <td style={{fontVariantNumeric:'tabular-nums'}}>{p.predicted_home_score} - {p.predicted_away_score}{p.predicted_extra_time?' (و)':''}</td>
                      <td style={{fontVariantNumeric:'tabular-nums'}}>{p.actual_home_score!==null?`${p.actual_home_score} - ${p.actual_away_score}`:'—'}</td>
                      <td style={{color:p.points>0?'var(--green)':'var(--muted)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{p.actual_home_score!==null?(p.points||0):'—'}</td>
                      <td style={{color:'var(--muted)'}}>{p.submitted_at?new Date(p.submitted_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ LEADERBOARD ══ */}
        {activeTab==='leaderboard' && (
          <>
            {/* ① شريط نطاق الصدارة: العامة + زر لكل جولة */}
            <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
              <button
                onClick={()=>selectLbScope('general')}
                style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(lbScope==='general'?'var(--gold)':'var(--line)'),background:lbScope==='general'?'rgba(217,178,95,.15)':'var(--surface-2)',color:lbScope==='general'?'var(--gold)':'var(--muted)',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}
              >🏆 الصدارة العامة</button>
              {rounds.map(r=>(
                <button
                  key={r}
                  onClick={()=>selectLbScope(r)}
                  style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(lbScope===r?'var(--gold)':'var(--line)'),background:lbScope===r?'rgba(217,178,95,.15)':'var(--surface-2)',color:lbScope===r?'var(--gold)':'var(--muted)',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif",whiteSpace:'nowrap'}}
                >{roundLabels[r]||r}</button>
              ))}
            </div>
            {/* ⑧ بحث الصدارة + Export CSV */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
              <input
                type="text"
                value={lbSearch}
                onChange={e=>setLbSearch(e.target.value)}
                placeholder="🔍 بحث بالاسم أو الإيميل"
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--text)',fontFamily:"'Cairo',sans-serif",fontSize:13,outline:'none',minWidth:220}}
              />
              {lbSearchQ
                ? <span style={{fontSize:12,color:'var(--muted)'}}>يعرض {visibleLeaderboard.length} من {lbSource.length}</span>
                : lbScope!=='general' && <span style={{fontSize:12,color:'var(--muted)'}}>{loadingRoundLb?'⏳ جاري التحميل...':`صدارة ${roundLabels[lbScope]||lbScope} · ${lbSource.length} لاعب`}</span>}
              <button onClick={exportLeaderboardCSV} className="export-btn" style={{marginRight:'auto'}}>⬇️ تصدير CSV</button>
              <button onClick={exportAllMembersCSV} className="export-btn">📦 تصدير كل الأعضاء (بيانات كاملة)</button>
            </div>
            <div style={{overflowX:'auto'}}>
              <table>
                <thead><tr><th>#</th><th>اللاعب</th><th>الإيميل</th><th>النقاط</th><th>التوقعات</th><th></th></tr></thead>
                <tbody>
                  {visibleLeaderboard.length===0 ? (
                    <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>{lbSearchQ ? 'لا يوجد مطابق' : 'لا توجد بيانات'}</td></tr>
                  ) : visibleLeaderboard.map((p)=>{
                    // الرتبة الأصلية من المصدر الكامل (عام أو جولة) — تثبت حتى مع البحث
                    const i = lbSource.indexOf(p);
                    return (
                    <tr key={p.user_id || i}>
                      <td style={{fontWeight:800,color:i<3?'var(--gold)':'var(--muted)'}}>{i<3?medals[i]:`#${i+1}`}</td>
                      {/* اسم اللاعب قابل للنقر لعرض تفاصيل بروفايله */}
                      <td style={{fontWeight:700}}>
                        <span onClick={()=>openBreakdown(p)} style={{cursor:'pointer',color:'var(--gold)',borderBottom:'1px dashed rgba(217,178,95,.4)'}}>
                          {p.full_name || p.user_email?.split('@')[0] || '—'}
                        </span>
                      </td>
                      <td style={{color:'var(--muted)',fontSize:12}}>{p.user_email}</td>
                      <td style={{color:'var(--gold)',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{p.total}</td>
                      <td style={{color:'var(--muted)'}}>{p.count}</td>
                      <td>
                        <button
                          onClick={()=>openBreakdown(p)}
                          style={{padding:'5px 12px',borderRadius:8,border:'1px solid rgba(217,178,95,.3)',background:'rgba(217,178,95,.08)',color:'var(--gold)',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'Cairo,sans-serif',whiteSpace:'nowrap'}}
                        >🔍 تفاصيل</button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ══ LEAGUES ══ */}
        {activeTab==='leagues' && (
          <>
            {biggestLeague && (
              <div style={{background:'rgba(217,178,95,.08)',border:'1px solid rgba(217,178,95,.2)',borderRadius:14,padding:'12px 18px',marginBottom:16,fontSize:13,color:'var(--gold)',fontWeight:700,display:'flex',flexWrap:'wrap',gap:16}}>
                <span>🏆 أكبر ميني ليج: <strong>{biggestLeague.name}</strong> ({biggestLeague.member_count} أعضاء)</span>
                <span>📩 دعوات معلقة: <strong>{totalPending}</strong></span>
                <span>📊 متوسط أعضاء: <strong>{leagues.length?(totalLeagueMembers/leagues.length).toFixed(1):0}</strong></span>
              </div>
            )}
            {leagues.length===0 ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد ليجات بعد</div>
            ) : leagues.map(lg=>{
              const members    = leagueMembers[lg.id]||[];
              const isExpanded = expandedLeague===lg.id;
              return (
                <div key={lg.id} className="league-card">
                  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:800,fontSize:15,color:'var(--gold)',marginBottom:4}}>{lg.name}</div>
                      <div style={{fontSize:12,color:'var(--muted)',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
                        {/* زر نسخ الكود مباشرة ✅ */}
                        <span
                          onClick={()=>navigator.clipboard.writeText(lg.code).then(()=>showMsg(`✅ تم نسخ كود ${lg.name}`))}
                          style={{cursor:'pointer',display:'flex',alignItems:'center',gap:4}}
                          title="اضغط لنسخ الكود"
                        >
                          كود: <strong style={{color:'var(--text)',letterSpacing:1}}>{lg.code}</strong>
                          <span style={{fontSize:10,color:'var(--gold)'}}>📋</span>
                        </span>
                        <span>👑 {lg.owner_name}</span>
                        <span>👥 {lg.member_count} عضو</span>
                        {lg.pending_invites>0 && <span style={{color:'#fb923c'}}>📩 {lg.pending_invites} معلق</span>}
                        <span>{new Date(lg.created_at).toLocaleDateString('ar-EG',{month:'short',day:'numeric'})}</span>
                      </div>
                    </div>
                    <button onClick={()=>setExpandedLeague(isExpanded?null:lg.id)} className="action-btn" style={{background:'rgba(217,178,95,.12)',border:'1px solid rgba(217,178,95,.2)',color:'#ffe3a6',fontSize:12,padding:'8px 14px'}}>
                      {isExpanded?'▲ إخفاء':'▼ الأعضاء'}
                    </button>
                    <button onClick={()=>adminDeleteLeague(lg)} className="del-btn">🗑️ حذف</button>
                  </div>
                  {isExpanded && (
                    <div style={{marginTop:14,borderTop:'1px solid var(--line)',paddingTop:14}}>
                      <div style={{fontSize:13,color:'var(--gold)',fontWeight:700,marginBottom:10}}>أعضاء الليج ({members.length})</div>
                      {members.length===0 ? (
                        <div style={{color:'var(--muted)',fontSize:13}}>لا يوجد أعضاء</div>
                      ) : members
                        .sort((a:any,b:any)=>(b._profile?.total_points||0)-(a._profile?.total_points||0))
                        .map((m:any,idx:number)=>{
                          const name    = m._profile?.full_name||m._profile?.user_email?.split('@')[0]||'لاعب';
                          const pts     = m._profile?.total_points||0;
                          const isOwner = m.role==='owner';
                          return (
                            <div key={m.user_id} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 0',borderBottom:'1px solid var(--line)'}}>
                              <span style={{color:'var(--muted)',fontSize:12,minWidth:24}}>#{idx+1}</span>
                              <span style={{flex:1,fontWeight:700}}>{name} {isOwner && <span style={{fontSize:11,color:'var(--gold)'}}>👑 مالك</span>}</span>
                              <span style={{color:'var(--gold)',fontWeight:800,fontSize:13}}>{pts} نقطة</span>
                              {!isOwner && <button onClick={()=>adminRemoveMember(lg.id,m.user_id,name)} className="del-btn">إزالة</button>}
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {activeTab==='prizes' && (
          <div>
            {/* ── أكثر نقاط اليوم ── */}
            <div style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:18,padding:'18px 20px',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div style={{fontWeight:800,fontSize:15,color:'var(--gold)'}}>🌟 أكثر نقاط اليوم</div>
                <button onClick={loadPrizes} style={{fontSize:12,padding:'4px 12px',borderRadius:8,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--muted)',cursor:'pointer',fontFamily:'Cairo,sans-serif'}}>🔄 تحديث</button>
              </div>
              {dailyScorers.length === 0
                ? <div style={{color:'var(--muted)',fontSize:13,textAlign:'center',padding:'16px 0'}}>لا توجد نقاط مسجلة اليوم بعد</div>
                : dailyScorers.map((s: any, i: number) => (
                  <div key={s.user_id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:'var(--surface-2)',borderRadius:12,marginBottom:8}}>
                    <div style={{fontWeight:900,fontSize:18,minWidth:28,textAlign:'center'}}>{i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</div>
                    <div style={{flex:1,fontWeight:700,fontSize:14}}>{s.full_name || 'مجهول'}</div>
                    <div style={{fontWeight:900,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{s.daily_points} نقطة</div>
                    <div style={{fontSize:12,color:'var(--muted)',background:'var(--surface-3)',borderRadius:8,padding:'2px 8px'}}>{s.preds_count} توقع</div>
                  </div>
                ))
              }
            </div>

            {/* ── مراحل الجوائز ── */}
            <div style={{fontWeight:800,fontSize:15,marginBottom:14}}>🏆 مراحل الجوائز (5 مراحل)</div>
            {prizePhases.map((phase: any) => {
              const phaseWins  = prizeWinners.filter((w: any) => w.phase_id === phase.id);
              const today      = new Date().toISOString().split('T')[0];
              const isFinished = phaseWins.length > 0;
              const isPast     = phase.end_date < today;
              const isActive   = !isFinished && phase.start_date <= today && phase.end_date >= today;
              const prizes     = [phase.prize_label, phase.prize_label_2, phase.prize_label_3].filter(Boolean);
              const badge      = isFinished
                ? { bg:'rgba(39,176,110,.12)', bd:'rgba(39,176,110,.25)', c:'#5effa8',  t:'✅ مكتملة' }
                : isActive
                  ? { bg:'rgba(217,178,95,.12)',bd:'rgba(217,178,95,.25)',c:'var(--gold)',t:'🔴 نشطة' }
                  : isPast
                    ? { bg:'rgba(201,58,47,.1)', bd:'rgba(201,58,47,.2)', c:'#ff9c91',  t:'⏳ انتهت' }
                    : { bg:'rgba(255,255,255,.04)',bd:'var(--line)',        c:'var(--muted)',t:'⏰ قادمة' };
              return (
                <div key={phase.id} style={{background:'var(--surface)',border:`1px solid ${isFinished?'rgba(39,176,110,.3)':isActive?'rgba(217,178,95,.3)':'var(--line)'}`,borderRadius:18,padding:'18px 20px',marginBottom:12}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>{phase.name}</div>
                      <div style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>
                        📅 {new Date(phase.start_date+'T12:00:00').toLocaleDateString('ar-EG',{month:'long',day:'numeric'})}
                        {' — '}
                        {new Date(phase.end_date+'T12:00:00').toLocaleDateString('ar-EG',{month:'long',day:'numeric',year:'numeric'})}
                        {'  ·  '}
                        <span style={{color:phase.is_cumulative?'var(--gold)':'var(--muted)'}}>
                          {phase.is_cumulative ? '📊 تراكمي' : '📋 غير تراكمي'}
                        </span>
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {prizes.map((p: string, i: number) => (
                          <span key={i} style={{background:'rgba(217,178,95,.1)',border:'1px solid rgba(217,178,95,.2)',borderRadius:999,padding:'4px 14px',fontSize:12,fontWeight:700,color:'#ffe3a6'}}>
                            {prizes.length > 1 ? ['🥇','🥈','🥉'][i]+' ' : ''}{p}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:8}}>
                      <span style={{fontSize:11,padding:'4px 12px',borderRadius:999,fontWeight:700,whiteSpace:'nowrap',background:badge.bg,color:badge.c,border:`1px solid ${badge.bd}`}}>{badge.t}</span>
                      {(isPast || isActive) && !isFinished && (
                        <button
                          onClick={async () => {
                            setSelectedPhase(phase);
                            setShowPrizeModal(true);
                            setPrizeModalLoading(true);
                            setPhaseLeaderboard([]);
                            setSelectedWinnerIds([]);
                            const { data } = await supabase.rpc('get_phase_leaderboard', { p_phase_key: phase.phase_key });
                            // نعرض أعلى 10 للاختيار منهم، ونحدد أعلى winner_count مبدئياً
                            const top = (data || []).slice(0, 10);
                            setPhaseLeaderboard(top);
                            setSelectedWinnerIds(top.slice(0, phase.winner_count || 1).map((r: any) => r.user_id));
                            setPrizeModalLoading(false);
                          }}
                          style={{padding:'8px 16px',borderRadius:10,border:'none',background:'linear-gradient(135deg,#e0bc73,#b9892d)',color:'#1a0a00',fontWeight:800,fontSize:12,fontFamily:'Cairo,sans-serif',cursor:'pointer'}}
                        >
                          🏅 إعلان الفائز
                        </button>
                      )}
                    </div>
                  </div>
                  {isFinished && (
                    <div style={{marginTop:14,borderTop:'1px solid var(--line)',paddingTop:14}}>
                      <div style={{fontSize:12,color:'var(--gold)',fontWeight:700,marginBottom:10}}>الفائزون المُعلنون:</div>
                      {phaseWins.map((w: any) => (
                        <div key={w.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                          <span style={{fontSize:20}}>{['🥇','🥈','🥉'][w.rank - 1] || '🏅'}</span>
                          <span style={{fontWeight:700,flex:1}}>{w.winner_name || '—'}</span>
                          <span style={{color:'var(--gold)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{w.points} نقطة</span>
                          <span style={{fontSize:11,color:'#ffe3a6',background:'rgba(217,178,95,.1)',borderRadius:8,padding:'2px 8px'}}>{prizes[w.rank - 1] || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ REPORTS ══ */}
        {activeTab==='reports' && (
          <div>
            {rptLoading && !rptLoaded ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:40}}>⏳ جاري تحميل التقارير...</div>
            ) : (
            <>
              {/* ── لوحة الإحصائيات الموحّدة (مصدر واحد: admin_report_overview_stats_v1) ── */}
              {rptOverview && (() => {
                const fmt = (v:any) => Number(v).toLocaleString('en-US');
                const groups = [
                  { title:'👥 الأعضاء', cards:[
                    {label:'إجمالي الأعضاء',   value:fmt(rptOverview.total_members),       c:'var(--gold)'},
                    {label:'بروفايلات مكتملة', value:fmt(rptOverview.completed_profiles),  c:'#5effa8'},
                    {label:'لديهم تليفون',      value:fmt(rptOverview.members_with_phone),  c:'#7fd1ff'},
                    {label:'جاءوا بدعوة',       value:fmt(rptOverview.members_from_referral),c:'#ffd27f'},
                    {label:'أعضاء نشطون',       value:fmt(rptOverview.active_predictors),   c:'#5effa8'},
                    {label:'غير نشطين',         value:fmt(rptOverview.inactive_members),    c:'#ff9c91'},
                    {label:'بروفايل غير مكتمل', value:fmt(rptOverview.incomplete_profiles), c:'#fbbf24'},
                    {label:'إيميل غير مؤكَّد',   value:fmt(rptOverview.unconfirmed_email),   c:'#ff9c91'},
                    {label:'لم يدخل أبداً',      value:fmt(rptOverview.never_signed_in),     c:'#f87171'},
                  ]},
                  { title:'📋 التوقعات والماتشات', cards:[
                    {label:'إجمالي التوقعات',   value:fmt(rptOverview.total_predictions),   c:'var(--gold)'},
                    {label:'مُقيَّمة',           value:fmt(rptOverview.graded_predictions),  c:'#5effa8'},
                    {label:'غير مُقيَّمة',        value:fmt(rptOverview.ungraded_predictions),c:rptOverview.ungraded_predictions>0?'#ff9c91':'var(--muted)'},
                    {label:'إجمالي الماتشات',   value:fmt(rptOverview.total_fixtures),      c:'#a78bfa'},
                    {label:'ماتشات مفتوحة',     value:fmt(rptOverview.open_fixtures),       c:'#facc15'},
                    {label:'بدون نتيجة',        value:fmt(rptOverview.no_result_fixtures),  c:'#f87171'},
                  ]},
                  { title:'🏆 الليجات والنقاط', cards:[
                    {label:'ميني ليجات',        value:fmt(rptOverview.total_leagues),       c:'#a78bfa'},
                    {label:'أعضاء الليجات',     value:fmt(rptOverview.total_league_members),c:'#7fd1ff'},
                    {label:'دعوات معلّقة',       value:fmt(rptOverview.pending_invites),     c:'#fb923c'},
                    {label:'أعلى نقاط',         value:fmt(rptOverview.top_score),           c:'#4ade80'},
                    {label:'متوسط النشطين',     value:rptOverview.avg_points_active,        c:'#38bdf8'},
                    {label:'صفر أو أقل',        value:fmt(rptOverview.zero_or_less_members),c:'#f87171'},
                  ]},
                ];
                return (
                  <div style={{marginBottom:24}}>
                    {groups.map(g=>(
                      <div key={g.title} style={{marginBottom:14}}>
                        <div style={{fontSize:13,fontWeight:800,color:'var(--muted)',marginBottom:8}}>{g.title}</div>
                        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
                          {g.cards.map(s=>(
                            <div key={s.label} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 14px',textAlign:'center'}}>
                              <div style={{fontSize:10,color:'var(--muted)',marginBottom:6,fontWeight:700}}>{s.label}</div>
                              <div style={{fontSize:22,fontWeight:900,color:s.c,fontVariantNumeric:'tabular-nums'}}>{s.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* ── 🛠️ إدارة النقاط: إضافة بونص/خصم بالإيميل ── */}
              <div style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:14,padding:16,marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                  <span style={{fontSize:14,fontWeight:900,color:'var(--gold)'}}>🛠️ إدارة النقاط</span>
                  <span style={{fontSize:11,color:'var(--muted)'}}>إضافة بونص أو خصم لعضو بالإيميل · بيتعاد حساب النقاط تلقائياً</span>
                </div>
                <div style={{display:'flex',gap:8,marginBottom:10}}>
                  {([{k:'bonus',l:'🎁 بونص (+)',c:'#5effa8'},{k:'penalty',l:'⛔ خصم (−)',c:'#ff6b6b'}] as const).map(({k,l,c})=>(
                    <button key={k} onClick={()=>setAdjKind(k)} style={{padding:'7px 16px',borderRadius:10,border:'1px solid '+(adjKind===k?c:'var(--line)'),background:adjKind===k?(k==='bonus'?'rgba(94,255,168,.12)':'rgba(255,107,107,.12)'):'var(--surface-2)',color:adjKind===k?c:'var(--muted)',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>{l}</button>
                  ))}
                </div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8,marginBottom:8}}>
                  <input value={adjEmail} onChange={e=>setAdjEmail(e.target.value)} placeholder="إيميل العضو" dir="ltr" style={{padding:'10px 12px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--fg,#fff)',fontSize:13,textAlign:'left'}} />
                  <input value={adjPoints} onChange={e=>setAdjPoints(e.target.value.replace(/[^0-9]/g,''))} inputMode="numeric" placeholder="عدد النقاط" style={{padding:'10px 12px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--fg,#fff)',fontSize:13,textAlign:'center',fontVariantNumeric:'tabular-nums'}} />
                </div>
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8}}>
                  <input value={adjReason} onChange={e=>setAdjReason(e.target.value)} placeholder={adjKind==='bonus'?'سبب البونص (مثال: مسابقة)':'سبب الخصم (مثال: مخالفة)'} style={{padding:'10px 12px',borderRadius:10,border:'1px solid var(--line)',background:'var(--surface-2)',color:'var(--fg,#fff)',fontSize:13}} />
                  <button disabled={adjBusy} onClick={submitAdjustment} style={{padding:'10px 12px',borderRadius:10,border:'none',background:adjBusy?'var(--surface-2)':(adjKind==='bonus'?'linear-gradient(90deg,#2fae6a,#5effa8)':'linear-gradient(90deg,#c0392b,#ff6b6b)'),color:adjBusy?'var(--muted)':'#0b0b0b',fontSize:13,fontWeight:900,cursor:adjBusy?'default':'pointer',fontFamily:"'Cairo',sans-serif"}}>{adjBusy?'⏳ ...':(adjKind==='bonus'?'➕ إضافة بونص':'➖ تطبيق خصم')}</button>
                </div>
              </div>

              {/* ── مبدّل التقارير ── */}
              <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                {([
                  {id:'referrers',        label:`📨 أكثر الداعين (${rptReferrers.length})`},
                  {id:'suspicious',       label:`⚠️ نقاط مشبوهة (${rptSuspicious.length})`},
                  {id:'inactive',         label:`💤 أعضاء غير نشطين (${rptInactive.length})`},
                  {id:'round_completion', label:`📊 اكتمال الجولات (${rptRoundCompletion.length})`},
                  {id:'points_dist',      label:`📈 توزيع النقاط (${rptPointsDist.length})`},
                  {id:'league_activity',  label:`🏆 نشاط الميني ليجات (${rptLeagueActivity.length})`},
                  {id:'top_per_round',    label:`🥇 الأعلى لكل جولة (${rptTopPerRound.length})`},
                  {id:'growth',           label:`📈 نمو المستخدمين (${rptGrowth.length})`},
                  {id:'bonus_audit',      label:`🎁 تدقيق البونص (${rptBonusAudit.length})`},
                  {id:'penalties',        label:`⛔ العقوبات (${rptPenalties.length})`},
                  {id:'integrity',        label:`🛡️ تدقيق النزاهة (${rptIntegrity.length})`},
                  {id:'social',           label:`💬 نشاط الـ Feed (${rptSocial.length})`},
                  {id:'finished_open',    label:`🔓 خلصت لكن مفتوحة (${rptFinishedOpen.length})`},
                  {id:'prize_lifecycle',  label:`🏅 دورة الجوائز (${rptPrizeLifecycle.length})`},
                  {id:'dream_survey',     label:`🔥 استطلاع الدوري الجديد (${rptDreamSurvey.length})`},
                ] as const).map(({id,label})=>(
                  <button key={id} onClick={()=>setActiveReport(id)} style={{padding:'8px 16px',borderRadius:10,border:'1px solid '+(activeReport===id?'var(--gold)':'var(--line)'),background:activeReport===id?'rgba(217,178,95,.15)':'var(--surface-2)',color:activeReport===id?'var(--gold)':'var(--muted)',fontSize:13,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif",whiteSpace:'nowrap'}}>{label}</button>
                ))}
              </div>

              {/* ── تقرير: أكثر الداعين ── */}
              {activeReport==='referrers' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>أعلى {rptReferrers.length} عضو من حيث عدد الدعوات · النقاط بحد أقصى 50 (10 دعوات)</span>
                    <button onClick={exportReferrersCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>#</th><th>الاسم</th><th>التليفون</th><th>الإيميل</th><th>عدد الدعوات</th><th>محتسبة</th><th>نقاط الدعوة</th><th>مدعو من</th></tr></thead>
                      <tbody>
                        {rptReferrers.length===0 ? (
                          <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptReferrers.map((r,i)=>(
                          <tr key={r.referrer_id}>
                            <td style={{fontWeight:800,color:i<3?'var(--gold)':'var(--muted)'}}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                            <td style={{fontWeight:700}}>{r.full_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.phone||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{color:'var(--gold)',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.referral_count}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.counted_referrals}</td>
                            <td style={{color:'#5effa8',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{r.referral_points}</td>
                            <td style={{color:'var(--muted)',fontSize:12}}>{r.referred_by_name||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: نقاط مشبوهة (بج التوقع المتأخر) ── */}
              {activeReport==='suspicious' && (
                <>
                  <div style={{background:'rgba(201,58,47,.08)',border:'1px solid rgba(201,58,47,.2)',borderRadius:12,padding:'10px 14px',marginBottom:12,fontSize:12,color:'#ff9c91',fontWeight:700}}>
                    ⚠️ أعضاء حصلوا على نقاط من توقعات أُرسلت <strong>بعد بداية الماتش</strong> (بسبب بج في السيستم). كلما زاد التأخير زاد الاشتباه.
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
                    <button onClick={exportSuspiciousCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>#</th><th>الاسم</th><th>الإيميل</th><th>ماتشات استفاد منها</th><th>النقاط المتأخرة</th><th>أقصى تأخير</th><th>التصنيف</th></tr></thead>
                      <tbody>
                        {rptSuspicious.length===0 ? (
                          <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد حالات مشبوهة</td></tr>
                        ) : rptSuspicious.map((r,i)=>{
                          const bk = r.delay_bucket;
                          const bdg = bk==='huge_delay' ? {t:'تأخير ضخم (≥24س)',c:'#ff6b5e'}
                            : bk==='very_long' ? {t:'طويل جدًا (≥6س)',c:'#ff9c91'}
                            : bk==='long' ? {t:'طويل (≥1س)',c:'#ffd27f'}
                            : {t:'قصير',c:'var(--muted)'};
                          return (
                          <tr key={r.user_id}>
                            <td style={{fontWeight:800,color:'var(--muted)'}}>{`#${i+1}`}</td>
                            <td style={{fontWeight:700}}>{r.display_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.benefited_fixtures}</td>
                            <td style={{color:'#ff9c91',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.total_late_points}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.max_delay_overall||'—'}</td>
                            <td><span style={{color:bdg.c,fontWeight:700,fontSize:12}}>{bdg.t}</span></td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: أعضاء غير نشطين ── */}
              {activeReport==='inactive' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>سجّلوا ولم يضعوا أي توقع · يعرض أحدث {rptInactive.length} (الإجمالي {rptOverview?Number(rptOverview.inactive_members).toLocaleString('en-US'):'—'})</span>
                    <button onClick={exportInactiveCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>#</th><th>الاسم</th><th>التليفون</th><th>الإيميل</th><th>البروفايل</th><th>من دعوة</th><th>تاريخ التسجيل</th></tr></thead>
                      <tbody>
                        {rptInactive.length===0 ? (
                          <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا يوجد أعضاء غير نشطين</td></tr>
                        ) : rptInactive.map((r,i)=>(
                          <tr key={r.user_id}>
                            <td style={{fontWeight:800,color:'var(--muted)'}}>{`#${i+1}`}</td>
                            <td style={{fontWeight:700}}>{r.full_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.phone||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td>{r.profile_completed?<span style={{color:'#5effa8',fontWeight:700,fontSize:12}}>✅ مكتمل</span>:<span style={{color:'var(--muted)',fontSize:12}}>— ناقص</span>}</td>
                            <td>{r.came_from_referral?<span style={{color:'var(--gold)',fontSize:12}}>نعم</span>:<span style={{color:'var(--muted)',fontSize:12}}>لا</span>}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.created_at?String(r.created_at).slice(0,10):'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: اكتمال الجولات ── */}
              {activeReport==='round_completion' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>نسبة الاكتمال = (عدد التوقعات الفعلية ÷ (عدد الماتشات × عدد المتوقعين)) لكل جولة</span>
                    <button onClick={exportRoundCompletionCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الجولة</th><th>الماتشات</th><th>التوقعات</th><th>المتوقعون</th><th>متوسط/مستخدم</th><th>نسبة الاكتمال</th></tr></thead>
                      <tbody>
                        {rptRoundCompletion.length===0 ? (
                          <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptRoundCompletion.map((r)=>(
                          <tr key={r.round}>
                            <td style={{fontWeight:800,color:'var(--gold)'}}>{roundLabels[r.round]||r.round}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.fixtures_count}</td>
                            <td style={{fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{Number(r.predictions_count).toLocaleString('en-US')}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{Number(r.predictors_count).toLocaleString('en-US')}</td>
                            <td style={{color:'#7fd1ff',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{r.avg_preds_per_user}</td>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <div style={{flex:1,minWidth:60,height:8,background:'var(--surface-3)',borderRadius:4,overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(100,Number(r.fill_rate_pct))}%`,height:'100%',background:'var(--gold)'}} />
                                </div>
                                <span style={{color:'var(--gold)',fontWeight:900,fontSize:12,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{r.fill_rate_pct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: توزيع النقاط ── */}
              {activeReport==='points_dist' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>توزيع الأعضاء حسب شرائح النقاط النهائية (leaderboard_general_v1)</span>
                    <button onClick={exportPointsDistCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الشريحة</th><th>عدد الأعضاء</th><th>النسبة</th></tr></thead>
                      <tbody>
                        {rptPointsDist.length===0 ? (
                          <tr><td colSpan={3} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptPointsDist.map((r)=>(
                          <tr key={r.bucket_key}>
                            <td style={{fontWeight:700}}>{r.bucket_label}</td>
                            <td style={{color:'var(--gold)',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{Number(r.members_count).toLocaleString('en-US')}</td>
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <div style={{flex:1,minWidth:60,height:8,background:'var(--surface-3)',borderRadius:4,overflow:'hidden'}}>
                                  <div style={{width:`${Math.min(100,Number(r.pct))}%`,height:'100%',background:'#5effa8'}} />
                                </div>
                                <span style={{color:'#5effa8',fontWeight:800,fontSize:12,fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{r.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: نشاط الميني ليجات ── */}
              {activeReport==='league_activity' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>الميني ليجات مرتّبة حسب عدد الأعضاء · يعرض أعلى {rptLeagueActivity.length}</span>
                    <button onClick={exportLeagueActivityCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>#</th><th>اسم الليج</th><th>الكود</th><th>الحالة</th><th>المنشئ</th><th>الأعضاء</th><th>دعوات معلّقة</th><th>الإنشاء</th></tr></thead>
                      <tbody>
                        {rptLeagueActivity.length===0 ? (
                          <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد ميني ليجات</td></tr>
                        ) : rptLeagueActivity.map((r,i)=>(
                          <tr key={r.league_id}>
                            <td style={{fontWeight:800,color:i<3?'var(--gold)':'var(--muted)'}}>{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
                            <td style={{fontWeight:700}}>{r.league_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.code||'—'}</td>
                            <td>{r.is_active?<span style={{color:'#5effa8',fontWeight:700,fontSize:12}}>✅ نشط</span>:<span style={{color:'var(--muted)',fontSize:12}}>— موقوف</span>}</td>
                            <td style={{color:'var(--muted)',fontSize:12}}>{r.creator_name||'—'}</td>
                            <td style={{color:'var(--gold)',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.member_count}</td>
                            <td style={{color:'#ffd27f',fontWeight:700,fontVariantNumeric:'tabular-nums'}}>{r.pending_invites}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.created_at?String(r.created_at).slice(0,10):'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: الأعلى لكل جولة ── */}
              {activeReport==='top_per_round' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>أعلى 10 لاعبين في كل جولة حسب نقاط الجولة (leaderboard_rounds_v1)</span>
                    <button onClick={exportTopPerRoundCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الجولة</th><th>الترتيب</th><th>الاسم</th><th>الإيميل</th><th>النقاط</th><th>التوقعات</th></tr></thead>
                      <tbody>
                        {rptTopPerRound.length===0 ? (
                          <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptTopPerRound.map((r)=>(
                          <tr key={`${r.round}-${r.user_id}`}>
                            <td style={{fontWeight:800,color:'var(--gold)',fontSize:12}}>{roundLabels[r.round]||r.round}</td>
                            <td style={{fontWeight:800,color:r.rank_in_round<=3?'var(--gold)':'var(--muted)'}}>{r.rank_in_round<=3?['🥇','🥈','🥉'][r.rank_in_round-1]:`#${r.rank_in_round}`}</td>
                            <td style={{fontWeight:700}}>{r.display_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{color:'#5effa8',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.total_points}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.predictions_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: نمو المستخدمين ── */}
              {activeReport==='growth' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>التسجيل اليومي لآخر 60 يوم · أعضاء جدد + التراكمي + مصادر الانضمام</span>
                    <button onClick={exportGrowthCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>اليوم</th><th>أعضاء جدد</th><th>بروفايل مكتمل</th><th>من دعوة</th><th>فيسبوك</th><th>جوجل</th><th>التراكمي</th></tr></thead>
                      <tbody>
                        {rptGrowth.length===0 ? (
                          <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptGrowth.map((r)=>(
                          <tr key={String(r.day)}>
                            <td style={{fontWeight:800,color:'var(--gold)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.day?String(r.day).slice(0,10):'—'}</td>
                            <td style={{fontWeight:900,color:'#5effa8',fontVariantNumeric:'tabular-nums'}}>{r.new_members}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.completed_profiles}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.from_referral}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.from_facebook}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.from_google}</td>
                            <td style={{fontWeight:800,color:'var(--text)',fontVariantNumeric:'tabular-nums'}}>{r.cumulative_members}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: تدقيق البونص ── */}
              {activeReport==='bonus_audit' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>تدقيق منح البونص · المنح المكررة محسوبة بعد تطبيع المصدر (إزالة لاحقة التاريخ)</span>
                    <button onClick={exportBonusAuditCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الاسم</th><th>الإيميل</th><th>عدد المنح</th><th>أصناف</th><th>إجمالي النقاط</th><th>منح مكررة</th><th>المصادر</th><th>إجراءات</th></tr></thead>
                      <tbody>
                        {rptBonusAudit.length===0 ? (
                          <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptBonusAudit.map((r)=>(
                          <tr key={r.user_id} style={r.has_duplicate?{background:'rgba(255,107,107,.06)'}:undefined}>
                            <td style={{fontWeight:700}}>{r.has_duplicate?'⚠️ ':''}{r.full_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.email||'—'}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.grant_count}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.distinct_categories}</td>
                            <td style={{color:'#5effa8',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.total_bonus_points}</td>
                            <td style={{fontWeight:900,color:r.duplicate_grants>0?'#ff6b6b':'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.duplicate_grants}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.sources||'—'}</td>
                            <td><button onClick={()=>openGrantsModal(r)} style={{padding:'5px 10px',borderRadius:8,border:'1px solid var(--gold)',background:'rgba(217,178,95,.12)',color:'var(--gold)',fontSize:11,fontWeight:800,cursor:'pointer',whiteSpace:'nowrap',fontFamily:"'Cairo',sans-serif"}}>📝 المنح</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: العقوبات ── */}
              {activeReport==='penalties' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>سجلّ العقوبات (user_penalty_notices) · مرتّب تنازلياً حسب النقاط</span>
                    <button onClick={exportPenaltiesCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الاسم</th><th>الإيميل</th><th>النقاط</th><th>الحالة</th><th>نشط</th><th>المصدر</th><th>الرسالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
                      <tbody>
                        {rptPenalties.length===0 ? (
                          <tr><td colSpan={9} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptPenalties.map((r)=>(
                          <tr key={r.id}>
                            <td style={{fontWeight:700}}>{r.display_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{color:'#ff6b6b',fontWeight:900,fontVariantNumeric:'tabular-nums'}}>{r.penalty_points}</td>
                            <td style={{color:'var(--muted)',fontSize:12}}>{r.status}</td>
                            <td style={{fontWeight:800}}>{r.is_active?'✅':'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.source||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:11,maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.message||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.created_at?String(r.created_at).slice(0,10):'—'}</td>
                            <td>
                              <div style={{display:'flex',gap:6,flexWrap:'nowrap'}}>
                                <button disabled={adjBusy} onClick={async()=>{
                                  const np = prompt('عدد نقاط الخصم الجديد:', String(r.penalty_points));
                                  if (np===null) return;
                                  const n = Number(np);
                                  if (!Number.isFinite(n)||n<0) { showMsg('❌ رقم غير صالح','error'); return; }
                                  await callAdjustment({action:'penalty_edit',id:r.id,penalty_points:n}, '✅ تم تعديل الخصم');
                                }} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #7fd1ff',background:'rgba(127,209,255,.1)',color:'#7fd1ff',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>✏️</button>
                                <button disabled={adjBusy} onClick={async()=>{
                                  await callAdjustment({action:'penalty_edit',id:r.id,is_active:!r.is_active}, r.is_active?'✅ تم إلغاء تفعيل الخصم':'✅ تم تفعيل الخصم');
                                }} style={{padding:'5px 9px',borderRadius:8,border:'1px solid var(--gold)',background:'rgba(217,178,95,.1)',color:'var(--gold)',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>{r.is_active?'🚫 إيقاف':'✅ تفعيل'}</button>
                                <button disabled={adjBusy} onClick={async()=>{
                                  if (!confirm(`حذف خصم ${r.penalty_points} نقطة نهائياً؟`)) return;
                                  await callAdjustment({action:'penalty_delete',id:r.id}, '✅ تم حذف الخصم');
                                }} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #ff6b6b',background:'rgba(255,107,107,.1)',color:'#ff6b6b',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: تدقيق النزاهة (متكررون) ── */}
              {activeReport==='integrity' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>المخالفون المتكررون — توقعات متأخرة في ≥ جولتين · مؤشّر إخلال محتمل بالنزاهة</span>
                    <button onClick={exportIntegrityCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الاسم</th><th>الإيميل</th><th>جولات متأثرة</th><th>توقعات متأخرة</th><th>إجمالي النقاط المتأخرة</th><th>أقصى تأخير</th><th>متكرر</th></tr></thead>
                      <tbody>
                        {rptIntegrity.length===0 ? (
                          <tr><td colSpan={7} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptIntegrity.map((r)=>(
                          <tr key={r.user_id} style={r.is_repeat_offender?{background:'rgba(255,107,107,.06)'}:undefined}>
                            <td style={{fontWeight:700}}>{r.is_repeat_offender?'🚩 ':''}{r.display_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{fontWeight:900,color:r.rounds_affected>=2?'#ff6b6b':'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.rounds_affected}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.late_predictions}</td>
                            <td style={{color:'var(--gold)',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{r.total_late_points}</td>
                            <td style={{color:'var(--muted)',fontSize:12,fontVariantNumeric:'tabular-nums'}}>{r.max_delay_seconds}ث</td>
                            <td style={{fontWeight:800}}>{r.is_repeat_offender?'🚩':'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: نشاط الـ Feed ── */}
              {activeReport==='social' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>تفاعل المستخدمين عبر social_feed · أكثر الأعضاء نشاطاً</span>
                    <button onClick={exportSocialCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الاسم</th><th>الإيميل</th><th>الأنشطة</th><th>مشاركات</th><th>ربح نقاط</th><th>خسارة نقاط</th><th>دعوات</th><th>ليجات</th><th>آخر نشاط</th></tr></thead>
                      <tbody>
                        {rptSocial.length===0 ? (
                          <tr><td colSpan={9} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد بيانات</td></tr>
                        ) : rptSocial.map((r)=>(
                          <tr key={r.user_id}>
                            <td style={{fontWeight:700}}>{r.display_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.user_email||'—'}</td>
                            <td style={{fontWeight:900,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{r.total_activities}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.shares}</td>
                            <td style={{color:'#5effa8',fontVariantNumeric:'tabular-nums'}}>{r.points_earned_events}</td>
                            <td style={{color:'#ff6b6b',fontVariantNumeric:'tabular-nums'}}>{r.points_lost_events}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.invites}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.league_joins}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.last_activity?String(r.last_activity).slice(0,10):'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: خلصت لكن مفتوحة ── */}
              {activeReport==='finished_open' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>ماتشات لها نتيجة فعلية لكن ما زالت is_open=true (يجب إغلاقها) · 0 = سليم</span>
                    <button onClick={exportFinishedOpenCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>الجولة</th><th>المستضيف</th><th>الضيف</th><th>النتيجة</th><th>تاريخ الماتش</th><th>الحالة</th></tr></thead>
                      <tbody>
                        {rptFinishedOpen.length===0 ? (
                          <tr><td colSpan={6} style={{textAlign:'center',color:'#5effa8',padding:40}}>✅ لا توجد ماتشات معلّقة — كله سليم</td></tr>
                        ) : rptFinishedOpen.map((r)=>(
                          <tr key={r.id} style={{background:'rgba(255,107,107,.06)'}}>
                            <td style={{fontWeight:800,color:'var(--gold)',fontSize:12}}>{roundLabels[r.round]||r.round}</td>
                            <td style={{fontWeight:700}}>{r.home_team_name||'—'}</td>
                            <td style={{fontWeight:700}}>{r.away_team_name||'—'}</td>
                            <td style={{fontWeight:900,color:'var(--text)',fontVariantNumeric:'tabular-nums'}}>{r.actual_home_score} - {r.actual_away_score}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.match_date?String(r.match_date).slice(0,16).replace('T',' '):'—'}</td>
                            <td style={{color:'#ff6b6b',fontWeight:800}}>🔓 مفتوح</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: دورة الجوائز ── */}
              {activeReport==='prize_lifecycle' && (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>مراحل الجوائز (prize_phases) ومدى تسجيل الفائزين · 🚩 = الفترة انتهت ويحتاج رصد فائزين</span>
                    <button onClick={exportPrizeLifecycleCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>المرحلة</th><th>البداية</th><th>النهاية</th><th>الحالة</th><th>متوقع</th><th>مسجّل</th><th>الجائزة</th><th>المتابعة</th></tr></thead>
                      <tbody>
                        {rptPrizeLifecycle.length===0 ? (
                          <tr><td colSpan={8} style={{textAlign:'center',color:'var(--muted)',padding:40}}>لا توجد مراحل</td></tr>
                        ) : rptPrizeLifecycle.map((r)=>(
                          <tr key={r.id} style={r.needs_winners?{background:'rgba(255,107,107,.06)'}:undefined}>
                            <td style={{fontWeight:700}}>{r.needs_winners?'🚩 ':''}{r.name||'—'}{r.is_cumulative?' (تراكمي)':''}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.start_date?String(r.start_date).slice(0,10):'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.end_date?String(r.end_date).slice(0,10):'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12}}>{r.status}</td>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{r.expected_winners}</td>
                            <td style={{fontWeight:900,color:r.incomplete_winners?'#ff6b6b':'#5effa8',fontVariantNumeric:'tabular-nums'}}>{r.recorded_winners}</td>
                            <td style={{color:'var(--muted)',fontSize:11,maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.prize_label||'—'}</td>
                            <td style={{fontWeight:800,fontSize:11}}>{r.needs_winners?'🚩 يحتاج رصد':(r.incomplete_winners?'⚠️ ناقص':(r.period_ended?'✅ مكتمل':'⏳ جارٍ'))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── تقرير: استطلاع الدوري الجديد (البريمير/التشامبيونز) ── */}
              {activeReport==='dream_survey' && (() => {
                const readyCount = rptDreamSurvey.filter((r)=>r.choice==='ready').length;
                const thinkingCount = rptDreamSurvey.filter((r)=>r.choice==='thinking').length;
                return (
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'var(--muted)'}}>مين اختار إيه في استطلاع دوري توقعات البريمير ليج / التشامبيونز ليج</span>
                    <button onClick={exportDreamSurveyCSV} className="export-btn">⬇️ تصدير CSV</button>
                  </div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:16}}>
                    <div style={{flex:'1 1 140px',background:'rgba(217,178,95,.1)',border:'1px solid rgba(217,178,95,.3)',borderRadius:14,padding:'12px 16px'}}>
                      <div style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>🔥 جاهزين</div>
                      <div style={{fontSize:24,fontWeight:900,color:'#ffe3a6',fontVariantNumeric:'tabular-nums'}}>{readyCount}</div>
                    </div>
                    <div style={{flex:'1 1 140px',background:'rgba(148,163,184,.1)',border:'1px solid rgba(148,163,184,.3)',borderRadius:14,padding:'12px 16px'}}>
                      <div style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>🤔 لسه بيفكروا</div>
                      <div style={{fontSize:24,fontWeight:900,color:'#cbd5e1',fontVariantNumeric:'tabular-nums'}}>{thinkingCount}</div>
                    </div>
                    <div style={{flex:'1 1 140px',background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 16px'}}>
                      <div style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>📊 إجمالي المشاركين</div>
                      <div style={{fontSize:24,fontWeight:900,color:'#7db1ff',fontVariantNumeric:'tabular-nums'}}>{rptDreamSurvey.length}</div>
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table>
                      <thead><tr><th>#</th><th>الاسم</th><th>التليفون</th><th>الإيميل</th><th>الاختيار</th><th>التاريخ</th></tr></thead>
                      <tbody>
                        {rptDreamSurvey.length===0 ? (
                          <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:40}}>مفيش مشاركات لسه</td></tr>
                        ) : rptDreamSurvey.map((r,i)=>(
                          <tr key={r.user_id}>
                            <td style={{color:'var(--muted)',fontVariantNumeric:'tabular-nums'}}>{i+1}</td>
                            <td style={{fontWeight:700}}>{r.full_name||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:12,direction:'ltr',textAlign:'right'}}>{r.phone||'—'}</td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.user_email||'—'}</td>
                            <td><span style={{fontWeight:800,fontSize:12,color:r.choice==='ready'?'#ffe3a6':'#cbd5e1'}}>{r.choice==='ready'?'🔥 جاهز':'🤔 بيفكر'}</span></td>
                            <td style={{color:'var(--muted)',fontSize:11,direction:'ltr',textAlign:'right'}}>{r.updated_at?String(r.updated_at).slice(0,16).replace('T',' '):'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
                );
              })()}

            </>
            )}
          </div>
        )}

      </div>

      {/* ══ RESULT MODAL ══ */}
      {showModal && selectedMatch && (
        <div onClick={()=>setShowModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',backdropFilter:'blur(6px)',display:'grid',placeItems:'center',zIndex:1000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:24,padding:28,width:'100%',maxWidth:480,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div>
                <div style={{fontWeight:900,fontSize:16,color:'var(--gold)'}}>{selectedMatch.teams.home.name} × {selectedMatch.teams.away.name}</div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:3}}>إدخال / تعديل النتيجة</div>
              </div>
              <button onClick={()=>setShowModal(false)} style={{background:'var(--surface-3)',border:'1px solid var(--line)',borderRadius:10,width:34,height:34,cursor:'pointer',color:'var(--text)',fontSize:16,display:'grid',placeItems:'center'}}>✕</button>
            </div>
            <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:10}}>النتيجة الفعلية</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:18}}>
              {[{label:selectedMatch.teams.home.name,val:homeScore,set:setHomeScore},{label:selectedMatch.teams.away.name,val:awayScore,set:setAwayScore}].map(({label,val,set})=>(
                <div key={label} style={{background:'var(--surface-2)',borderRadius:16,padding:'12px 16px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:8,fontWeight:700}}>{label}</div>
                  <input type="number" min={0} value={val}
                    onChange={e=>set(Number(e.target.value))}
                    style={{width:'100%',height:66,borderRadius:14,background:'#fff',color:'#000',fontSize:34,fontWeight:900,textAlign:'center',border:'none',outline:'none',fontFamily:"'Cairo',sans-serif"}} />
                </div>
              ))}
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:6}}>⚽ أول هدف</div>
              <input type="text" value={firstScorer} onChange={e=>setFirstScorer(e.target.value)}
                placeholder="مثال: محمد صلاح" className="field-input" />
            </div>
            <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 16px',marginBottom:18}}>
              <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:12}}>أحداث الماتش (+2 نقطة لكل توقع صح)</div>
              {[
                { label:'⏱️ ذهبت لوقت إضافي',   val:extraTime,  set:setExtraTime  },
                { label:'🟥 كان في بطاقة حمراء', val:redCard,    set:setRedCard    },
                { label:'⚽ كان في ركلة جزاء',   val:penalty,    set:setPenalty    },
                { label:'🎯 كلا الفريقين سجّلا', val:bothTeams,  set:setBothTeams  },
              ].map(({label,val,set})=>(
                <label key={label} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,cursor:'pointer'}}>
                  <input type="checkbox" checked={val} onChange={e=>set(e.target.checked)}
                    style={{width:18,height:18,accentColor:'var(--gold)',flexShrink:0}} />
                  <span style={{fontSize:14,fontWeight:600}}>{label}</span>
                </label>
              ))}
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowModal(false)} style={{flex:1,padding:'13px 0',borderRadius:16,background:'var(--surface-2)',border:'1px solid var(--line)',color:'var(--muted)',cursor:'pointer',fontFamily:"'Cairo',sans-serif",fontWeight:700,fontSize:14}}>إلغاء</button>
              <button onClick={saveResult} disabled={savingResult} className="action-btn" style={{flex:2,padding:'13px 0',borderRadius:16,background:'linear-gradient(135deg,var(--gold),#a8761a)',fontSize:15}}>
                {savingResult?'⏳ جاري الحفظ...':'✅ حفظ النتيجة وتحديث النقاط'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal إعلان الفائز ── */}
      {showPrizeModal && selectedPhase && (
        <div onClick={() => setShowPrizeModal(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)',display:'grid',placeItems:'center',zIndex:1001,padding:16}}>
          <div onClick={e => e.stopPropagation()} style={{background:'var(--surface)',border:'1px solid rgba(217,178,95,.25)',borderRadius:24,padding:28,width:'100%',maxWidth:500,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div>
                <div style={{fontWeight:900,fontSize:17,color:'var(--gold)'}}>🏅 إعلان فائز</div>
                <div style={{fontSize:13,color:'var(--muted)',marginTop:3}}>{selectedPhase.name}</div>
              </div>
              <button onClick={() => setShowPrizeModal(false)} style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:10,width:34,height:34,cursor:'pointer',color:'var(--text)',fontSize:16,display:'grid',placeItems:'center'}}>✕</button>
            </div>
            {prizeModalLoading
              ? <div style={{textAlign:'center',padding:40,color:'var(--muted)',fontSize:14}}>⏳ جاري تحميل الليدربورد...</div>
              : phaseLeaderboard.length === 0
                ? <div style={{textAlign:'center',padding:40,color:'var(--muted)',fontSize:14}}>لا توجد نقاط مسجلة في هذه المرحلة بعد</div>
                : <>
                  <div style={{background:'rgba(217,178,95,.08)',border:'1px solid rgba(217,178,95,.15)',borderRadius:12,padding:'10px 14px',marginBottom:16,fontSize:13,color:'#ffe3a6'}}>
                    اختر حتى {selectedPhase.winner_count || 1} فائز من أعلى {phaseLeaderboard.length} مشارك · المختار حالياً: {selectedWinnerIds.length}/{selectedPhase.winner_count || 1}
                  </div>
                  {phaseLeaderboard.map((row: any, i: number) => {
                    const prizeLabels = [selectedPhase.prize_label, selectedPhase.prize_label_2, selectedPhase.prize_label_3];
                    const maxWinners = selectedPhase.winner_count || 1;
                    const selIdx = selectedWinnerIds.indexOf(row.user_id);
                    const isSel = selIdx !== -1;
                    const toggle = () => {
                      setSelectedWinnerIds(prev => {
                        if (prev.includes(row.user_id)) return prev.filter(id => id !== row.user_id);
                        if (prev.length >= maxWinners) { showMsg(`⚠️ الحد الأقصى ${maxWinners} فائز · ألغِ تحديداً أولاً`, 'error'); return prev; }
                        return [...prev, row.user_id];
                      });
                    };
                    return (
                      <div key={row.user_id} onClick={toggle} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:isSel?'rgba(217,178,95,.14)':'rgba(255,255,255,.03)',border:'1px solid '+(isSel?'rgba(217,178,95,.5)':'var(--line)'),borderRadius:14,marginBottom:8,cursor:'pointer',transition:'all .15s'}}>
                        <span style={{width:26,height:26,borderRadius:8,border:'2px solid '+(isSel?'var(--gold)':'var(--muted)'),background:isSel?'var(--gold)':'transparent',color:'#1a0a00',display:'grid',placeItems:'center',fontSize:14,fontWeight:900,flexShrink:0}}>{isSel?'✓':''}</span>
                        <span style={{fontSize:22,minWidth:30,textAlign:'center'}}>{isSel ? (['🥇','🥈','🥉'][selIdx] || `#${selIdx+1}`) : <span style={{fontSize:13,color:'var(--muted)'}}>{`#${i+1}`}</span>}</span>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:800,fontSize:15}}>{row.full_name || 'مجهول'}</div>
                          <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{row.phase_points} نقطة في المرحلة</div>
                        </div>
                        {isSel && prizeLabels[selIdx] && (
                          <div style={{fontSize:13,color:'#ffe3a6',fontWeight:700,background:'rgba(217,178,95,.1)',borderRadius:8,padding:'4px 10px',flexShrink:0}}>{prizeLabels[selIdx]}</div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    disabled={savingWinner || selectedWinnerIds.length === 0}
                    onClick={async () => {
                      const existingWins = prizeWinners.filter((w: any) => w.phase_id === selectedPhase.id);
                      if (existingWins.length > 0) {
                        showMsg('⚠️ تم إعلان الفائزين لهذه المرحلة من قبل', 'error');
                        return;
                      }
                      if (selectedWinnerIds.length === 0) { showMsg('⚠️ اختر فائزًا واحدًا على الأقل', 'error'); return; }
                      const chosen = selectedWinnerIds.map(id => phaseLeaderboard.find((r: any) => r.user_id === id)).filter(Boolean) as any[];
                      const names = chosen.map((r, i) => `${i+1}. ${r.full_name || 'مجهول'} (${r.phase_points} نقطة)`).join('\n');
                      if (!confirm(`تأكيد إعلان الفائزين لمرحلة "${selectedPhase.name}"؟\n\n${names}\n\nلا يمكن التراجع.`)) return;
                      setSavingWinner(true);
                      try {
                        for (let i = 0; i < chosen.length; i++) {
                          await supabase.from('prize_winners').insert({
                            phase_id: selectedPhase.id,
                            user_id:  chosen[i].user_id,
                            rank:     i + 1,
                            points:   Number(chosen[i].phase_points),
                          });
                        }
                        await supabase.from('prize_phases').update({ status: 'completed' }).eq('id', selectedPhase.id);
                        await loadPrizes();
                        setShowPrizeModal(false);
                        showMsg('✅ تم إعلان الفائزين بنجاح!', 'success');
                      } catch (err: any) {
                        showMsg('❌ ' + (err?.message || 'خطأ في الحفظ'), 'error');
                      }
                      setSavingWinner(false);
                    }}
                    style={{width:'100%',padding:14,borderRadius:14,border:'none',background:(savingWinner||selectedWinnerIds.length===0)?'rgba(217,178,95,.3)':'linear-gradient(135deg,#e0bc73,#b9892d)',color:'#1a0a00',fontWeight:900,fontSize:15,fontFamily:'Cairo,sans-serif',cursor:(savingWinner||selectedWinnerIds.length===0)?'not-allowed':'pointer',marginTop:16}}
                  >
                    {savingWinner ? '⏳ جاري الحفظ...' : `✅ تأكيد وإعلان ${selectedWinnerIds.length} فائز`}
                  </button>
                </>
            }
          </div>
        </div>
      )}

      {/* ══ BREAKDOWN MODAL ══ */}
      {showBreakdown && breakdownUser && (
        <div onClick={()=>setShowBreakdown(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',backdropFilter:'blur(6px)',display:'grid',placeItems:'center',zIndex:2000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:24,padding:24,width:'100%',maxWidth:580,maxHeight:'88vh',overflowY:'auto',direction:'rtl'}}>

            {/* Header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,gap:10}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:900,fontSize:16,color:'var(--gold)'}}>
                  {breakdownUser.full_name || breakdownUser.user_email?.split('@')[0] || '—'}
                </div>
                <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>{breakdownUser.user_email}</div>
              </div>
              {/* ⑩ زر إعادة حساب نقاط هذا المستخدم فقط */}
              <button
                onClick={()=>recalcSingleUser(breakdownUser.user_id, breakdownUser.full_name || breakdownUser.user_email?.split('@')[0] || 'المستخدم')}
                disabled={recalcingUser}
                style={{padding:'8px 14px',borderRadius:10,border:'1px solid rgba(217,178,95,.3)',background:recalcingUser?'rgba(217,178,95,.05)':'rgba(217,178,95,.1)',color:'var(--gold)',fontSize:12,fontWeight:700,cursor:recalcingUser?'not-allowed':'pointer',fontFamily:'Cairo,sans-serif',whiteSpace:'nowrap',flexShrink:0}}
              >
                {recalcingUser?'⏳ جاري...':'🔄 إعادة حساب'}
              </button>
              <button onClick={()=>setShowBreakdown(false)} style={{background:'var(--surface-3)',border:'1px solid var(--line)',borderRadius:10,width:34,height:34,cursor:'pointer',color:'var(--text)',fontSize:16,display:'grid',placeItems:'center',flexShrink:0}}>✕</button>
            </div>

            {/* ── بيانات البروفايل الكاملة ── */}
            <div style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:16,padding:'14px 18px',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
                <span style={{fontSize:13,color:'var(--muted)',fontWeight:700}}>👤 بيانات العضو</span>
                {loadingProfile && <span style={{fontSize:11,color:'var(--muted)'}}>⏳ جاري جلب البيانات...</span>}
              </div>
              {(() => {
                const pd = profileDetails || {};
                const fullName = pd.full_name || breakdownUser.full_name || '—';
                const email    = pd.email || breakdownUser.user_email || null;
                const phone    = pd.phone || breakdownUser.phone || null;
                const fbUrl    = pd.facebook_url || breakdownUser.facebook_url || null;
                const fbId     = pd.facebook_id || breakdownUser.facebook_id || null;
                const team     = pd.football_team || breakdownUser.football_team || null;
                const dob      = pd.date_of_birth || breakdownUser.date_of_birth || null;
                const refCode  = pd.referral_code || breakdownUser.referral_code || null;
                return (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'10px 18px'}}>
                {/* الاسم */}
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>الاسم الكامل</div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{fullName}</div>
                </div>
                {/* الإيميل */}
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>الإيميل</div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',wordBreak:'break-all'}}>
                    {email ? <a href={`mailto:${email}`} style={{color:'#60c3ff',textDecoration:'none'}}>{email}</a> : <span style={{color:'var(--muted)'}}>—</span>}
                  </div>
                </div>
                {/* التليفون */}
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>التليفون</div>
                  <div style={{fontSize:13,fontWeight:700,color:'var(--text)',direction:'ltr',textAlign:'right'}}>
                    {phone
                      ? <a href={`tel:${phone}`} style={{color:'#60c3ff',textDecoration:'none'}}>{phone}</a>
                      : <span style={{color:'var(--muted)'}}>—</span>}
                  </div>
                </div>
                {/* رابط الفيسبوك */}
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>📘 الفيسبوك</div>
                  <div style={{fontSize:13,fontWeight:700}}>
                    {fbUrl
                      ? <a href={fbUrl} target="_blank" rel="noopener noreferrer" style={{color:'#60c3ff',textDecoration:'underline',wordBreak:'break-all'}}>فتح البروفايل</a>
                      : fbId
                        ? <span style={{color:'var(--text)'}}>ID: {fbId}</span>
                        : <span style={{color:'var(--muted)'}}>—</span>}
                  </div>
                </div>
                {/* الفريق المفضل */}
                {team && (
                  <div>
                    <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>⚽ الفريق المفضل</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{team}</div>
                  </div>
                )}
                {/* تاريخ الميلاد */}
                {dob && (
                  <div>
                    <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>🎂 تاريخ الميلاد</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{dob}</div>
                  </div>
                )}
                {/* كود الدعوة */}
                {refCode && (
                  <div>
                    <div style={{fontSize:11,color:'var(--muted)',marginBottom:2}}>🤝 كود الدعوة</div>
                    <div style={{fontSize:13,fontWeight:700,color:'var(--text)',direction:'ltr',textAlign:'right'}}>{refCode}</div>
                  </div>
                )}
              </div>
                );
              })()}
            </div>

            {/* ملخص الإجمالي */}
            <div style={{background:'linear-gradient(135deg,rgba(217,178,95,.12),rgba(217,178,95,.04))',border:'1px solid rgba(217,178,95,.25)',borderRadius:16,padding:'14px 18px',marginBottom:20}}>
              <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:12}}>📊 مصادر النقاط</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:10}}>
                {/* نقاط التوقعات */}
                {(() => {
                  const predPts = breakdownPreds.reduce((s,p)=>s+(p.points||0),0);
                  return (
                    <div style={{background:'var(--surface-2)',borderRadius:12,padding:'10px 14px',textAlign:'center'}}>
                      <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>🎯 التوقعات</div>
                      <div style={{fontWeight:900,fontSize:20,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{predPts}</div>
                      <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{breakdownPreds.length} ماتش محسوب</div>
                    </div>
                  );
                })()}
                {/* نقاط الدعوات */}
                <div style={{background:'var(--surface-2)',borderRadius:12,padding:'10px 14px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>🤝 الدعوات</div>
                  <div style={{fontWeight:900,fontSize:20,color:'#5effa8',fontVariantNumeric:'tabular-nums'}}>{Math.min((breakdownUser.referral_count || 0) * 5, 50)}</div>
                  <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>{Math.min(breakdownUser.referral_count || 0, 10)} دعوة محتسبة × 5</div>
                </div>
                {/* نقاط البروفايل */}
                {((breakdownUser.bonus_points ?? 0) > 0 || breakdownUser.profile_completed) && (
                  <div style={{background:'var(--surface-2)',borderRadius:12,padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>✅ البروفايل</div>
                    <div style={{fontWeight:900,fontSize:20,color:'#60c3ff',fontVariantNumeric:'tabular-nums'}}>
                      {breakdownUser.bonus_points ?? 0}
                    </div>
                    <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
                     {breakdownUser.facebook_bonus_awarded ? '📘 Facebook مربوط · ' : ''}
{breakdownUser.profile_completed ? '✅ البروفايل مكتمل · ' : ''}
{(breakdownUser.bonus_points ?? 0) > 0 ? `🎁 Bonus محفوظ: ${breakdownUser.bonus_points}` : 'بدون بونص'}
                    </div>
                  </div>
                )}
                {/* الإجمالي */}
                <div style={{background:'rgba(217,178,95,.1)',border:'1px solid rgba(217,178,95,.25)',borderRadius:12,padding:'10px 14px',textAlign:'center'}}>
                  <div style={{fontSize:11,color:'var(--gold)',fontWeight:700,marginBottom:4}}>🏆 الإجمالي</div>
                  <div style={{fontWeight:900,fontSize:22,color:'var(--gold)',fontVariantNumeric:'tabular-nums'}}>{breakdownUser.total}</div>
                </div>
              </div>
            </div>

            {/* تفاصيل كل توقع */}
            <div style={{fontSize:13,color:'var(--muted)',fontWeight:700,marginBottom:12}}>📋 تفصيل التوقعات ({breakdownPreds.length})</div>
            {breakdownPreds.length === 0 ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:32,fontSize:13}}>لا توجد توقعات محسوبة بعد</div>
            ) : breakdownPreds.map((pr, idx) => (
              <div key={idx} style={{background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:14,padding:'12px 14px',marginBottom:10}}>
                {/* اسم الماتش */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
                  <div style={{fontWeight:800,fontSize:13}}>{pr.home_team} × {pr.away_team}</div>
                  <div style={{fontWeight:900,fontSize:15,color:(pr.points||0)>0?'var(--gold)':'var(--muted)',fontVariantNumeric:'tabular-nums'}}>
                    {pr.points||0} نقطة
                  </div>
                </div>
                {/* توقع vs فعلي */}
                <div style={{display:'flex',gap:16,fontSize:12,color:'var(--muted)',marginBottom:8,flexWrap:'wrap'}}>
                  <span>🔮 توقع: <strong style={{color:'var(--text)'}}>{pr.predicted_home_score} - {pr.predicted_away_score}</strong></span>
                  <span>✅ فعلي: <strong style={{color:'var(--text)'}}>{pr.actual_home_score} - {pr.actual_away_score}</strong></span>
                  {pr.first_scorer_actual && <span>⚽ أول هدف: <strong style={{color:'var(--text)'}}>{pr.first_scorer_actual}</strong></span>}
                </div>
                {/* البنود */}
                {pr.items.length > 0 ? (
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {pr.items.map((item: any, ii: number) => (
                      <span key={ii} style={{
                        fontSize:11,padding:'3px 10px',borderRadius:999,fontWeight:700,
                        background: item.pts>0 ? 'rgba(39,176,110,.12)' : 'rgba(201,58,47,.12)',
                        border: `1px solid ${item.pts>0 ? 'rgba(39,176,110,.25)' : 'rgba(201,58,47,.25)'}`,
                        color: item.pts>0 ? '#5effa8' : '#ff9c91',
                      }}>
                        {item.icon} {item.label} ({item.pts>0?'+':''}{item.pts})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{fontSize:11,color:'var(--muted)'}}>— لا نقاط من هذا الماتش</div>
                )}
                {/* ⑩ مؤشر تطابق النقاط: المحسوب من البنود (calcTotal) مقابل المحفوظ (points) */}
                {(pr.calcTotal !== (pr.points || 0)) && (
                  <div style={{marginTop:8,fontSize:11,fontWeight:700,color:'#ff9c91',background:'rgba(201,58,47,.1)',border:'1px solid rgba(201,58,47,.25)',borderRadius:8,padding:'5px 10px',display:'inline-block'}}>
                    ⚠️ عدم تطابق: المحسوب من البنود {pr.calcTotal} · المحفوظ {pr.points || 0}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── مودال المنح الفردية لعضو (تعديل/حذف bonus_grants) ── */}
      {grantsModalUser && (
        <div onClick={()=>setGrantsModalUser(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'var(--surface)',border:'1px solid var(--line)',borderRadius:16,padding:20,maxWidth:640,width:'100%',maxHeight:'85vh',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
              <span style={{fontSize:15,fontWeight:900,color:'var(--gold)'}}>🎁 منح البونص</span>
              <button onClick={()=>setGrantsModalUser(null)} style={{background:'none',border:'none',color:'var(--muted)',fontSize:22,cursor:'pointer',lineHeight:1}}>×</button>
            </div>
            <div style={{fontSize:12,color:'var(--muted)',marginBottom:14,direction:'ltr',textAlign:'right'}}>{grantsModalUser.full_name||'—'} · {grantsModalUser.email||'—'}</div>
            {grantsLoading ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:30}}>⏳ جارٍ التحميل...</div>
            ) : grantsRows.length===0 ? (
              <div style={{textAlign:'center',color:'var(--muted)',padding:30}}>مفيش منح للعضو ده</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {grantsRows.map((g)=>(
                  <div key={g.id} style={{display:'flex',alignItems:'center',gap:10,background:'var(--surface-2)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px'}}>
                    <div style={{fontSize:20,fontWeight:900,color:'#5effa8',fontVariantNumeric:'tabular-nums',minWidth:44,textAlign:'center'}}>{g.bonus_points}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:'var(--fg,#fff)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.source||'—'}</div>
                      <div style={{fontSize:10,color:'var(--muted)',direction:'ltr',textAlign:'right'}}>{g.granted_at?String(g.granted_at).slice(0,10):''}{g.notes?(' · '+g.notes):''}</div>
                    </div>
                    <button disabled={adjBusy} onClick={async()=>{
                      const np = prompt('عدد نقاط البونص الجديد:', String(g.bonus_points));
                      if (np===null) return;
                      const n = Number(np);
                      if (!Number.isFinite(n)) { showMsg('❌ رقم غير صالح','error'); return; }
                      const r = await callAdjustment({action:'bonus_edit',id:g.id,bonus_points:n}, '✅ تم تعديل المنحة');
                      if (r) await reloadGrantsModal();
                    }} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #7fd1ff',background:'rgba(127,209,255,.1)',color:'#7fd1ff',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>✏️</button>
                    <button disabled={adjBusy} onClick={async()=>{
                      if (!confirm(`حذف منحة ${g.bonus_points} نقطة نهائياً؟`)) return;
                      const r = await callAdjustment({action:'bonus_delete',id:g.id}, '✅ تم حذف المنحة');
                      if (r) await reloadGrantsModal();
                    }} style={{padding:'5px 9px',borderRadius:8,border:'1px solid #ff6b6b',background:'rgba(255,107,107,.1)',color:'#ff6b6b',fontSize:11,fontWeight:800,cursor:'pointer',fontFamily:"'Cairo',sans-serif"}}>🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}
