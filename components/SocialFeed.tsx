'use client';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

const feedIcon: Record<string, string> = {
  invite_friend: '📩',
  joined_league: '🏆',
  share_league: '📢',
  completed_profile: '✅',
  share_predictions: '📊',
};
const feedText: Record<string, (data: any) => string> = {
  invite_friend: (d) => `🎉 ${d.from_name} انضم لـ الشمعدان`,
  joined_league:  (d) => `🏆 ${d.from_name} انضم لـ "${d.league_name}"`,
  share_league:  (d) => `📢 ${d.from_name} شارك ليج "${d.league_name}"`,
  completed_profile: (d) => `✅ ${d.from_name} كمل بياناته`,
  share_predictions: (d) => `📊 ${d.from_name} شارك توقعاته`,
};

export default function SocialFeed({ limit = 10 }: { limit?: number }) {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFeed = async () => {
    const { data } = await supabase
      .from('social_feed')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit);
    setFeed(data || []);
    setLoading(false);
  };

  useEffect(() => { loadFeed(); }, []);

  if (loading)
    return <div style={{ padding: '16px', color: 'var(--muted)', textAlign: 'center' }}>جاري تحميل النشاط...</div>;
  if (!feed.length)
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>لا يوجد نشاط بعد</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {feed.map(item => (
        
