import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bell,
  BellRing,
  CheckCheck,
  Globe,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { formatFirestoreTimestamp } from '../lib/formatters';
import {
  createCrossPlatformNotification,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../lib/firestoreService';
import {
  AccountNotification,
  NotificationCategory,
  NotificationPreferences,
  PlatformType,
  UserProfile,
} from '../types/systemOne';

interface NotificationsSectionProps {
  authUser: User;
  profile: UserProfile;
  notifications: AccountNotification[];
  searchQuery: string;
}

export function NotificationsSection({
  authUser,
  profile,
  notifications,
  searchQuery,
}: NotificationsSectionProps) {
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [prefs, setPrefs] = useState<NotificationPreferences>(
    profile.notificationPreferences
  );

  const [showComposer, setShowComposer] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customCategory, setCustomCategory] = useState<NotificationCategory>('system');
  const [targetPlatforms, setTargetPlatforms] = useState<PlatformType[]>([
    'web',
    'mobile',
    'desktop',
  ]);

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [browserPermission, setBrowserPermission] = useState<string>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  useEffect(() => {
    setPrefs(profile.notificationPreferences);
  }, [profile.notificationPreferences]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const q = searchQuery.trim().toLowerCase();

  const filteredNotifications = notifications.filter((item) => {
    const matchesPlatform =
      platformFilter === 'all' || item.targetPlatforms.includes(platformFilter);
    const matchesRead =
      readFilter === 'all' ||
      (readFilter === 'unread' ? !item.read : item.read);
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.message.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.targetPlatforms.some((p) => p.toLowerCase().includes(q));
    return matchesPlatform && matchesRead && matchesSearch;
  });

  const handleToggleTargetPlatform = (platform: PlatformType) => {
    setTargetPlatforms((prev) => {
      if (prev.includes(platform)) {
        if (prev.length === 1) return prev;
        return prev.filter((p) => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const handleEnableBrowserAlerts = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setBrowserPermission(result);
      if (result === 'granted') {
        setStatusMsg('Browser notifications are now turned on for this web session.');
      }
    } catch {
      setErrorMsg('Your browser did not allow notification permissions.');
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: customTitle,
          message: customMessage,
          category: customCategory,
          sourcePlatform: 'web',
          targetPlatforms,
          actionUrl: '',
        },
        prefs
      );
      setCustomTitle('');
      setCustomMessage('');
      setShowComposer(false);
      setStatusMsg(
        `Notification sent to ${targetPlatforms.join(', ')} devices.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not send notification.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePref = async (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    const nextPrefs = { ...prefs, [key]: value };
    setPrefs(nextPrefs);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      await updateNotificationPreferences(authUser.uid, nextPrefs);
      setStatusMsg('Notification settings saved for all your devices.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not save notification settings.'
      );
    }
  };

  const handleMarkAllRead = async () => {
    setBusy(true);
    try {
      await markAllNotificationsRead(authUser.uid, notifications);
    } finally {
      setBusy(false);
    }
  };

  const renderPlatformLabel = (platform: PlatformType) => {
    if (platform === 'mobile') return 'Mobile';
    if (platform === 'desktop') return 'Desktop';
    return 'Web';
  };

  return (
    <div className="space-y-8">
      {/* Header & Cross-Platform Controls */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Notifications Across Your Devices
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              View your account alerts in one place. Every notification works across your web,
              mobile, and desktop apps.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read ({unreadCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowComposer((s) => !s)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{showComposer ? 'Close' : 'Send Alert'}</span>
            </button>
          </div>
        </div>

        {statusMsg && (
          <div className="mt-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
            {statusMsg}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* Composer for sending a cross-platform notification */}
        {showComposer && (
          <form
            onSubmit={handleCreateAlert}
            className="py-6 border-b border-slate-100 space-y-4"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Send a Notification to Your Devices
            </h2>
            <p className="text-xs text-slate-600">
              Create a reminder or account alert that appears right away on the platforms you choose.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label
                  htmlFor="notif-title"
                  className="block text-sm font-medium text-slate-800 mb-1"
                >
                  Title
                </label>
                <input
                  id="notif-title"
                  type="text"
                  required
                  maxLength={100}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Enter notification title"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label
                  htmlFor="notif-category"
                  className="block text-sm font-medium text-slate-800 mb-1"
                >
                  Type
                </label>
                <select
                  id="notif-category"
                  value={customCategory}
                  onChange={(e) =>
                    setCustomCategory(e.target.value as NotificationCategory)
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                >
                  <option value="system">General</option>
                  <option value="account">Account</option>
                  <option value="security">Security</option>
                  <option value="app">Apps</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="notif-message"
                className="block text-sm font-medium text-slate-800 mb-1"
              >
                Message
              </label>
              <textarea
                id="notif-message"
                rows={2}
                required
                maxLength={300}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Write what you want your devices to show"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-slate-800 mb-2">
                Send to Platforms
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'web' as PlatformType, label: 'Web', Icon: Globe },
                  { id: 'mobile' as PlatformType, label: 'Mobile', Icon: Smartphone },
                  { id: 'desktop' as PlatformType, label: 'Desktop', Icon: Monitor },
                ].map(({ id, label, Icon }) => {
                  const active = targetPlatforms.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleToggleTargetPlatform(id)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors ${
                        active
                          ? 'bg-sky-50 border-sky-600 text-sky-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{busy ? 'Sending...' : 'Send Notification'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Controls */}
        <div className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['all', 'web', 'mobile', 'desktop'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  platformFilter === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p === 'all' ? 'All Platforms' : p}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['all', 'unread', 'read'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReadFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  readFilter === r
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Bell className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-sm font-medium text-slate-900">
              No notifications to show right now.
            </p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              When you update your profile, verify a login, or connect a new app, your alerts
              appear here and sync across your devices.
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
            {filteredNotifications.map((item) => (
              <article
                key={item.id}
                className={`py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !item.read ? 'bg-sky-50/40 -mx-3 px-3 rounded-xl' : ''
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </h2>
                    <span
                      className={`text-xs font-medium ${
                        item.read ? 'text-slate-500' : 'text-sky-700'
                      }`}
                    >
                      {item.read ? 'Read' : 'New'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {item.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                    <span className="capitalize">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Synced to:{' '}
                      {item.targetPlatforms.map(renderPlatformLabel).join(', ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {formatFirestoreTimestamp(item.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      markNotificationRead(authUser.uid, item.id, !item.read)
                    }
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {item.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete notification ${item.title}`}
                    onClick={() => deleteNotification(authUser.uid, item.id)}
                    className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Cross-Platform Delivery Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Where You Receive Notifications
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pick which devices and alert types stay turned on for your account.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Web browsers
                </span>
                <span className="block text-xs text-slate-600">
                  Show alerts when you use System One or connected web apps.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.webEnabled}
                onChange={(e) => handleUpdatePref('webEnabled', e.target.checked)}
                className="w-4 h-4 accent-sky-700"
              />
            </label>

            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Mobile apps
                </span>
                <span className="block text-xs text-slate-600">
                  Send account and security alerts to your connected mobile apps.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.mobileEnabled}
                onChange={(e) => handleUpdatePref('mobileEnabled', e.target.checked)}
                className="w-4 h-4 accent-sky-700"
              />
            </label>

            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Desktop apps
                </span>
                <span className="block text-xs text-slate-600">
                  Sync alerts to your connected desktop programs.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.desktopEnabled}
                onChange={(e) => handleUpdatePref('desktopEnabled', e.target.checked)}
                className="w-4 h-4 accent-sky-700"
              />
            </label>

            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  New sign-in alerts
                </span>
                <span className="block text-xs text-slate-600">
                  Let me know whenever someone signs in from a new device.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.newDeviceAlert}
                onChange={(e) =>
                  handleUpdatePref('newDeviceAlert', e.target.checked)
                }
                className="w-4 h-4 accent-sky-700"
              />
            </label>

            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Profile change alerts
                </span>
                <span className="block text-xs text-slate-600">
                  Notify my devices whenever personal profile details change.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.profileUpdateAlert}
                onChange={(e) =>
                  handleUpdatePref('profileUpdateAlert', e.target.checked)
                }
                className="w-4 h-4 accent-sky-700"
              />
            </label>

            <label className="py-3.5 flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <span className="block text-sm font-medium text-slate-900">
                  Connected app alerts
                </span>
                <span className="block text-xs text-slate-600">
                  Notify me when an app is connected, paused, or removed.
                </span>
              </div>
              <input
                type="checkbox"
                checked={prefs.appAuthorizationAlert}
                onChange={(e) =>
                  handleUpdatePref('appAuthorizationAlert', e.target.checked)
                }
                className="w-4 h-4 accent-sky-700"
              />
            </label>
          </div>
        </section>

        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5 text-slate-900">
            <BellRing className="w-5 h-5 text-sky-700" />
            <h2 className="text-base font-semibold">Browser Pop-up Alerts</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Turn on browser pop-ups so important System One notifications show on this screen even
            when you switch tabs.
          </p>
          <p className="text-xs text-slate-600">
            Current browser setting:{' '}
            <strong className="text-slate-900 capitalize">{browserPermission}</strong>
          </p>
          {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={handleEnableBrowserAlerts}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>Allow Browser Pop-ups</span>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}
