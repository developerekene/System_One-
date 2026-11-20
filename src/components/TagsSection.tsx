import { useState } from 'react';
import { User } from 'firebase/auth';
import { Check, Edit3, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { getToneAccentDot } from '../lib/formatters';
import {
  createAccountTag,
  deleteAccountTag,
  updateAccountTag,
} from '../lib/firestoreService';
import {
  AccountTag,
  ConnectedApp,
  SecurityEvent,
  TagTone,
  UserProfile,
} from '../types/systemOne';

interface TagsSectionProps {
  authUser: User;
  profile: UserProfile;
  tags: AccountTag[];
  connectedApps: ConnectedApp[];
  securityEvents: SecurityEvent[];
  searchQuery: string;
  selectedTagFilter: string | null;
  onSelectTagFilter: (tagLabel: string | null) => void;
}

const TONE_OPTIONS: Array<{ id: TagTone; label: string }> = [
  { id: 'sky', label: 'Sky' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'amber', label: 'Amber' },
  { id: 'slate', label: 'Slate' },
];

export function TagsSection({
  authUser,
  profile,
  tags,
  connectedApps,
  securityEvents,
  searchQuery,
  selectedTagFilter,
  onSelectTagFilter,
}: TagsSectionProps) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [tone, setTone] = useState<TagTone>('sky');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTone, setEditTone] = useState<TagTone>('sky');

  const q = searchQuery.trim().toLowerCase();

  const filteredTags = tags.filter(
    (tag) =>
      !q ||
      tag.label.toLowerCase().includes(q) ||
      tag.description.toLowerCase().includes(q) ||
      tag.tone.toLowerCase().includes(q)
  );

  const countUsage = (tagLabel: string) => {
    const appCount = connectedApps.filter((a) => a.tags.includes(tagLabel)).length;
    const eventCount = securityEvents.filter((e) => e.tags.includes(tagLabel)).length;
    const inProfile = profile.tags.includes(tagLabel) ? 1 : 0;
    return { appCount, eventCount, inProfile };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await createAccountTag(authUser.uid, { label, description, tone });
      setLabel('');
      setDescription('');
      setTone('sky');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to create tag.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tag: AccountTag) => {
    setEditingId(tag.id);
    setEditLabel(tag.label);
    setEditDescription(tag.description);
    setEditTone(tag.tone);
  };

  const handleSaveEdit = async (tagId: string) => {
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateAccountTag(authUser.uid, tagId, {
        label: editLabel,
        description: editDescription,
        tone: editTone,
      });
      setEditingId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to update tag.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Create Organizational Tag */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center gap-2.5 text-slate-900">
          <TagIcon className="w-5 h-5 text-sky-700" />
          <h1 className="text-lg font-semibold">Create Organization Tag</h1>
        </div>
        <p className="mt-1.5 text-sm text-slate-600">
          Group connected apps, profile contexts, and security logs with clear cross-platform
          labels.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="new-tag-label"
              className="block text-sm font-medium text-slate-800 mb-1.5"
            >
              Tag Name
            </label>
            <input
              id="new-tag-label"
              type="text"
              required
              maxLength={32}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Apps"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <label
              htmlFor="new-tag-desc"
              className="block text-sm font-medium text-slate-800 mb-1.5"
            >
              Description
            </label>
            <input
              id="new-tag-desc"
              type="text"
              maxLength={120}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Apps requiring strict redirect validation"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-800 mb-2">
              Category Tone
            </span>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTone(opt.id)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    tone === opt.id
                      ? 'bg-slate-100 border-slate-900 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${getToneAccentDot(opt.id)}`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-60 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Creating...' : 'Create Tag'}</span>
          </button>
        </form>
      </section>

      {/* Right: Tag Directory & Filter Activation */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tag Directory</h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Select any tag to filter connected apps and audit events across System One.
            </p>
          </div>
          {selectedTagFilter && (
            <button
              type="button"
              onClick={() => onSelectTagFilter(null)}
              className="px-3 py-1.5 text-xs font-medium text-sky-800 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear Filter ({selectedTagFilter})
            </button>
          )}
        </div>

        {filteredTags.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">
            No tags found matching your search.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTags.map((tag) => {
              const usage = countUsage(tag.label);
              const isFiltering = selectedTagFilter === tag.label;
              const isEditing = editingId === tag.id;

              return (
                <div key={tag.id} className="py-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          maxLength={32}
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                        />
                        <select
                          value={editTone}
                          onChange={(e) => setEditTone(e.target.value as TagTone)}
                          className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
                        >
                          {TONE_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <input
                        type="text"
                        maxLength={120}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleSaveEdit(tag.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-sky-700 rounded-lg"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${getToneAccentDot(
                              tag.tone
                            )}`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onSelectTagFilter(isFiltering ? null : tag.label)
                            }
                            className={`text-sm font-semibold transition-colors text-left ${
                              isFiltering
                                ? 'text-sky-700 underline underline-offset-4'
                                : 'text-slate-900 hover:text-sky-700'
                            }`}
                          >
                            {tag.label}
                          </button>
                        </div>
                        {tag.description && (
                          <p className="mt-1 text-xs text-slate-600">{tag.description}</p>
                        )}
                        <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                          {usage.appCount} apps · {usage.eventCount} events ·{' '}
                          {usage.inProfile ? 'Active on profile' : 'Unassigned on profile'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectTagFilter(isFiltering ? null : tag.label)
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                            isFiltering
                              ? 'bg-sky-700 border-sky-700 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {isFiltering ? 'Filtering' : 'Filter App'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${tag.label}`}
                          onClick={() => startEdit(tag)}
                          className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${tag.label}`}
                          onClick={() => deleteAccountTag(authUser.uid, tag.id)}
                          className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
