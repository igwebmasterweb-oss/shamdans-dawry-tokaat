// lib/useNotifications.ts
// Hook مركزي للإشعارات — استخدمه في أي صفحة
// Usage: const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';

export interface AppNotification {
  id: string;
  type: 'invite' | 'invite_accepted' | 'invite_declined' | 'kicked' | 'league_deleted';
  data: {
    league_id?: string;
    league_name?: string;
    from_name?: string;
    from_user_id?: string;
    invited_user_name?: string;
  };
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Realtime subscription
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          // تأكد الإشعار لليوزر الحالي بس
          supabase.auth.getUser().then(({ data }) => {
            if (data.user && payload.new.user_id === data.user.id) {
              setNotifications(prev => [payload.new as AppNotification, ...prev]);
            }
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}

// ── Helper: إرسال إشعار (بيتاستخدم من أي action) ──────────────
export async function sendNotification(
  toUserId: string,
  type: AppNotification['type'],
  data: AppNotification['data']
) {
  await supabase.from('notifications').insert({
    user_id: toUserId,
    type,
    data,
  });
}

// ── Helper: نص الإشعار بالعربي ────────────────────────────────
export function getNotificationText(n: AppNotification): string {
  switch (n.type) {
    case 'invite':
      return `🏆 ${n.data.from_name} دعاك للانضمام لليج "${n.data.league_name}"`;
    case 'invite_accepted':
      return `✅ ${n.data.invited_user_name} قبل دعوتك وانضم لـ "${n.data.league_name}"`;
    case 'invite_declined':
      return `❌ ${n.data.invited_user_name} رفض الانضمام لـ "${n.data.league_name}"`;
    case 'kicked':
      return `🚫 تم إزالتك من ليج "${n.data.league_name}"`;
    case 'league_deleted':
      return `🗑️ تم حذف ليج "${n.data.league_name}" من قِبَل المنشئ`;
    default:
      return 'إشعار جديد';
  }
}
