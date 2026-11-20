import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowUpRight,
  Globe,
  Monitor,
  PauseCircle,
  PlayCircle,
  Plus,
  ShieldOff,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { formatFirestoreTimestamp, getTagButtonClasses } from '../lib/formatters';
import {
  createConnectedApp,
  createCrossPlatformNotification,
  deleteConnectedApp,
  logSecurityEvent,
  updateConnectedAppStatus,
} from '../lib/firestoreService';
import {
  AccountTag,
  AppStatus,
  ConnectedApp,
  NotificationPreferences,
  PlatformType,
} from '../types/systemOne';

interface ConnectedAppsSectionProps {
  authUser: User;
  connectedApps: ConnectedApp[];
  availableTags: AccountTag[];
  notificationPreferences: NotificationPreferences;
  searchQuery: string;
  selectedTagFilter: string | null;
  onLaunchReturn: (redirectTo: string, platform: PlatformType, appName: string) => void;
}

export function ConnectedAppsSection({
  authUser,
  connectedApps,
  availableTags,
  notificationPreferences,
  searchQuery,
  selectedTagFilter,
  onLaunchReturn,
}: ConnectedAppsSectionProps) {
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | AppStatus>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState<PlatformType>('web');
  const [newRedirectUri, setNewRedirectUri] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const q = searchQuery.trim().toLowerCase();

  const filteredApps = connectedApps.filter((app) => {
    const matchesPlatform = platformFilter === 'all' || app.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesTag = !selectedTagFilter || app.tags.includes(selectedTagFilter);
    const matchesSearch =
      !q ||
      app.name.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q) ||
      app.redirectUri.toLowerCase().includes(q) ||
      app.tags.some((t) => t.toLowerCase().includes(q));
    return matchesPlatform && matchesStatus && matchesTag && matchesSearch;
  });

  const handleToggleNewTag = (label: string) => {
    setNewTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label].slice(0, 8)
    );
  };

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createConnectedApp(authUser.uid, {
        name: newName,
        platform: newPlatform,
        description: newDescription,
        redirectUri: newRedirectUri,
        tags: newTags,
        scopes: ['profile:read', 'email:read', 'session:persist'],
      });
      await logSecurityEvent(authUser.uid, {
        title: `Added app: ${newName.trim()}`,
        category: 'app',
        platform: newPlatform,
        provider: 'system_one_sso',
        targetUrl: newRedirectUri.trim(),
        tags: newTags,
        status: 'verified',
      });
      if (notificationPreferences.appAuthorizationAlert) {
        await createCrossPlatformNotification(
          authUser.uid,
          {
            title: `Connected ${newName.trim()}`,
            message: `${newName.trim()} (${newPlatform}) can now use your System One account.`,
            category: 'app',
            sourcePlatform: newPlatform,
            actionUrl: newRedirectUri.trim(),
          },
          notificationPreferences
        );
      }
      setNewName('');
      setNewDescription('');
      setNewRedirectUri('');
      setNewTags([]);
      setShowAddForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to add application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (app: ConnectedApp, nextStatus: AppStatus) => {
    if (app.status === 'revoked') return;
    await updateConnectedAppStatus(authUser.uid, app.id, nextStatus);
    await logSecurityEvent(authUser.uid, {
      title: `Changed ${app.name} status to ${nextStatus}`,
      category: 'app',
      platform: app.platform,
      provider: 'system_one_sso',
      targetUrl: app.redirectUri,
      tags: app.tags,
      status: nextStatus === 'revoked' ? 'revoked' : 'completed',
    });
    if (notificationPreferences.appAuthorizationAlert) {
      await createCrossPlatformNotification(
        authUser.uid,
        {
          title: `${app.name} is now ${nextStatus}`,
          message: `Access for ${app.name} was changed to ${nextStatus}.`,
          category: 'app',
          sourcePlatform: app.platform,
        },
        notificationPreferences
      );
    }
  };

  const handleDeleteApp = async (app: ConnectedApp) => {
    await deleteConnectedApp(authUser.uid, app.id);
  };

  const getPlatformIcon = (platform: PlatformType) => {
    if (platform === 'mobile') return Smartphone;
    if (platform === 'desktop') return Monitor;
    return Globe;
  };

  return (
    <div className="space-y-8">
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Your Connected Applications
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Add the web, mobile, and desktop apps where you sign in with System One.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : 'Add App'}</span>
          </button>
        </div>

        {/* Add Connected App Drawer */}
        {showAddForm && (
          <form
            onSubmit={handleCreateApp}
            className="py-6 border-b border-slate-100 space-y-4"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Add an Application
            </h2>
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
                {errorMsg}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="app-name"
                  className="block text-sm font-medium text-slate-800 mb-1"
                >
                  App Name
                </label>
                <input
                  id="app-name"
                  type="text"
                  required
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter application name"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label
                  htmlFor="app-platform"
                  className="block text-sm font-medium text-slate-800 mb-1"
                >
                  Device Type
                </label>
                <select
                  id="app-platform"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as PlatformType)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                >
                  <option value="web">Web App</option>
                  <option value="mobile">Mobile App</option>
                  <option value="desktop">Desktop App</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="app-redirect-uri"
                  className="block text-sm font-medium text-slate-800 mb-1"
                >
                  Return Link (redirect_to)
                </label>
                <input
                  id="app-redirect-uri"
                  type="text"
                  required
                  maxLength={500}
                  value={newRedirectUri}
                  onChange={(e) => setNewRedirectUri(e.target.value)}
                  placeholder="https://... or myapp://callback"
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="app-desc"
                className="block text-sm font-medium text-slate-800 mb-1"
              >
                Short Description (Optional)
              </label>
              <input
                id="app-desc"
                type="text"
                maxLength={200}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What this app is used for"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
              />
            </div>

            {availableTags.length > 0 && (
              <div>
                <span className="block text-sm font-medium text-slate-800 mb-2">
                  Labels
                </span>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => handleToggleNewTag(tag.label)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${getTagButtonClasses(
                        tag.tone,
                        newTags.includes(tag.label)
                      )}`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl"
              >
                {submitting ? 'Saving...' : 'Save App'}
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
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
                {p === 'all' ? 'All Devices' : p}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['all', 'active', 'paused', 'revoked'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'all' ? 'All States' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Apps Directory */}
        {filteredApps.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              {connectedApps.length === 0
                ? 'You have not added any apps yet.'
                : 'No apps match your current search or filter.'}
            </p>
            <p className="text-sm text-slate-500">
              {connectedApps.length === 0
                ? 'Click "Add App" above whenever you want to connect one of your web, mobile, or desktop apps.'
                : 'Try clearing your search or changing the filters above.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 divide-y divide-slate-200 border-t border-slate-200">
            {filteredApps.map((app) => {
              const Icon = getPlatformIcon(app.platform);
              const isRevoked = app.status === 'revoked';
              return (
                <article
                  key={app.id}
                  className="py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <h3 className="text-base font-semibold text-slate-900">
                          {app.name}
                        </h3>
                        <span
                          className={`text-xs font-medium capitalize ${
                            app.status === 'active'
                              ? 'text-emerald-700'
                              : app.status === 'paused'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {app.status}
                        </span>
                        <span aria-hidden="true" className="text-slate-300">
                          ·
                        </span>
                        <span className="text-xs text-slate-500 capitalize">
                          {app.platform}
                        </span>
                      </div>

                      {app.description && (
                        <p className="mt-1 text-sm text-slate-600">{app.description}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="font-mono text-slate-700 break-all">
                          {app.redirectUri}
                        </span>
                        {app.tags.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{app.tags.map((t) => `#${t}`).join(' ')}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Updated {formatFirestoreTimestamp(app.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {app.status === 'active' && (
                      <button
                        type="button"
                        onClick={() =>
                          onLaunchReturn(app.redirectUri, app.platform, app.name)
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <span>Open App</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isRevoked && (
                      <button
                        type="button"
                        onClick={() =>
                          handleStatusChange(
                            app,
                            app.status === 'active' ? 'paused' : 'active'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        {app.status === 'active' ? (
                          <>
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Pause</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>Resume</span>
                          </>
                        )}
                      </button>
                    )}

                    {!isRevoked && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(app, 'revoked')}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    )}

                    <button
                      type="button"
                      aria-label={`Delete ${app.name}`}
                      onClick={() => handleDeleteApp(app)}
                      className="inline-flex items-center justify-center p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
