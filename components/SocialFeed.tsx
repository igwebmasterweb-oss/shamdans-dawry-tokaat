'use client';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

const feedIcon: Record<string, string> = {
  invite_friend: '📩',
  joined_league: '🏆',
  share_league: '📢',
  completed_profile: '✅',
  share_predictions: '📊',
  referral_bonus: '🎉',
  profile_completed: '✅',
  points_earned: '🏅',
  prediction_submitted: '⚽',
};

const feedText: Record<string, (d: any) => string> = {
  invite_friend: (d) => `🎉 ${d.from_name || 'لاعب'} انضم لـ الشمعدان`,
  joined_league: (d) => `🏆 ${d.from_name || 'لاعب'} انضم لـ "${d.league_name || ''}"`,
  share_league: (d) => `📢 ${d.from_name || 'لاعب'} شارك ليج "${d.league_name || ''}"`,
  completed_profile: (d) => `✅ ${d.from_name || 'لاعب'} كمل بياناته`,
  share_predictions: (d) => `📊 ${d.from_name || 'لاعب'} شارك توقعاته`,
  referral_bonus: (d) => `🎉 ${d.from_name || 'لاعب'} دعا صديقاً وربح 5 نقاط!`,
  profile_completed: (d) => `✅ ${d.from_name || 'لاعب'} أكمل بياناته الشخصية`,
  points_earned: (d) => `🏅 ${d.from_name || 'لاعب'} كسب ${d.points || ''} نقطة`,
  prediction_submitted: (d) => `⚽ ${d.from_name || 'لاعب'} توقّع ${d.home || ''} × ${d.away || ''}`,
};

interface FeedItem {
  id: string;
  event_type: string;
  user_name?: string;
  meta?: any;
  created_at: string;
}

export default function SocialFeed({ limit = 10 }: { limit?: number }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    const { data } = await supabase
      .from('social_feed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    setFeed(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    return `منذ ${Math.floor(hrs / 24)} يوم`;
  };

  const getEventText = (item: FeedItem): string => {
    const meta = item.meta || {};
    const data = { from_name: item.user_name || 'لاعب', ...meta };
    const fn = feedText[item.event_type];
    return fn ? fn(data) : '🔔 نشاط جديد';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#a8a39a', fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>
        جاري تحميل النشاط...
      </div>
    );
  }

  if (!feed.length) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a8a39a', fontFamily: 'Cairo, sans-serif', fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
        لا يوجد نشاط بعد
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {feed.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '12px 16px',
            background: 'rgba(255,255,255,.025)',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 16,
          }}
        >
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'rgba(217,178,95,.1)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>
            {feedIcon[item.event_type] || '🔔'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'Cairo, sans-serif', color: '#f4f1e8' }}>
              {getEventText(item)}
            </div>
            <div style={{ fontSize: 11, color: '#a8a39a', marginTop: 4 }}>
              {timeAgo(item.created_at)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
