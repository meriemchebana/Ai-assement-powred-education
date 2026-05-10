import { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { archiveAPI } from '../api/client';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AppSidebar from '../components/AppSidebar';

/* ── Icons (no emoji) ───────────────────────────────────────────────────── */
const IMG = {
  archive:  '/image/folderwithdocuments_120818.png',
  draft:    '/image/compass_draft_project_plan_ruler_icon_181792.png',
  trash:    '/image/36_104857.png',
  trashAlt: '/image/trash_delete_remove_recycle_bin_icon_176367.png',
  accept:   '/image/ok_accept_approve_checklist_tick_check_mark_confirm_icon_267804.png',
  save:     '/image/savedisk_121993.png',
  bulb:     '/image/lightbulb_light_energy_power_idea_icon_124743.png',
  exam:     '/image/exam_multiple_choice_document_icon_208911.png',
  folder:   '/image/apps_files_and_folders_folders_folder_storage_sort_sorting_files_file_icon_182736.png',
};

function Icon({ src, size = 16, alt = '', className = '' }) {
  return <img src={src} alt={alt} width={size} height={size} style={{ objectFit: 'contain' }} className={className} />;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const MODE = {
  questions: { icon: IMG.bulb,  accent: 'blue' },
  full_exam:  { icon: IMG.exam,  accent: 'sky' },
};

const ACCENT = {
  blue: { text: 'text-blue-600 dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/25', dot: 'bg-blue-500' },
  sky:  { text: 'text-sky-600 dark:text-sky-300',  bg: 'bg-sky-50 dark:bg-sky-500/10',   border: 'border-sky-200 dark:border-sky-500/25',   dot: 'bg-sky-500'  },
};

const SUBJECT_META = {
  algo:        { label: 'Algorithmics',        color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-500/10',    border: 'border-blue-200 dark:border-blue-500/20'   },
  se:          { label: 'Software Engineering', color: 'text-blue-600 dark:text-blue-400',      bg: 'bg-blue-50 dark:bg-blue-500/10',      border: 'border-blue-200 dark:border-blue-500/20'     },
  commerce:    { label: 'Commerce',             color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-500/10',    border: 'border-amber-200 dark:border-amber-500/20'   },
  Law:         { label: 'Law',                  color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-500/10',      border: 'border-rose-200 dark:border-rose-500/20'     },
  compilation: { label: 'Compilation',          color: 'text-sky-600 dark:text-sky-400',      bg: 'bg-sky-50 dark:bg-sky-500/10',      border: 'border-sky-200 dark:border-sky-500/20'     },
};

function subjectMeta(subj) {
  return SUBJECT_META[subj] || {
    label: subj,
    color: 'text-gray-600 dark:text-gray-300',
    bg: 'bg-gray-50 dark:bg-gray-500/10',
    border: 'border-gray-200 dark:border-gray-500/20',
  };
}

const TAB_IDS = ['all', 'accepted', 'rejected'];
const TAB_IMAGES = { all: IMG.archive, accepted: IMG.draft, rejected: IMG.trash };
const TAB_STATUS = { all: 'pending', accepted: 'accepted', rejected: 'rejected' };

/* ── ConfirmConfig factory ──────────────────────────────────────────────── */
const getConfirmConfig = (t) => ({
  delete: {
    title: t('archive.confirmDeleteTitle'),
    message: t('archive.confirmDeleteMsg'),
    confirmLabel: t('archive.delete'),
    confirmCls: 'bg-red-500 hover:bg-red-600 text-white',
    icon: IMG.trashAlt,
    iconBg: 'bg-transparent border-red-200/50 dark:border-red-500/20',
  },
  accepted: {
    title: t('archive.confirmFavTitle'),
    message: t('archive.confirmFavMsg'),
    confirmLabel: t('archive.moveFavorites'),
    confirmCls: 'bg-sky-600 hover:bg-sky-700 text-white',
    icon: IMG.draft,
    iconBg: 'bg-transparent border-sky-200/50 dark:border-sky-500/20',
  },
  rejected: {
    title: t('archive.confirmTrashTitle'),
    message: t('archive.confirmTrashMsg'),
    confirmLabel: t('archive.moveTrash'),
    confirmCls: 'bg-red-500 hover:bg-red-600 text-white',
    icon: IMG.trashAlt,
    iconBg: 'bg-transparent border-red-200/50 dark:border-red-500/20',
  },
  pending: {
    title: t('archive.confirmRestoreTitle'),
    message: t('archive.confirmRestoreMsg'),
    confirmLabel: t('archive.restore'),
    confirmCls: 'bg-amber-500 hover:bg-amber-600 text-white',
    icon: IMG.archive,
    iconBg: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/25',
  },
});

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function ArchivePage() {
  const { t } = useTranslation();
  const [entries, setEntries]                     = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [expandedId, setExpandedId]               = useState(null);
  const [collapsedSubjects, setCollapsedSubjects] = useState({});
  const [filterSubject, setFilterSubject]         = useState('all');
  const [activeTab, setActiveTab]                 = useState('all');
  const [updating, setUpdating]                   = useState(null);
  const [confirming, setConfirming]               = useState(null);   // { id, action }
  const [confirmModal, setConfirmModal]           = useState(null);   // popup confirm
  const [draggingIds, setDraggingIds]             = useState([]);
  const [dragOverTab, setDragOverTab]             = useState(null);
  const [selectedIds, setSelectedIds]             = useState(new Set());
  const [clipboard, setClipboard]                 = useState([]);
  const { addToast } = useToast();
  const { user }     = useContext(AuthContext);

  const TABS = [
    { id: 'all',      label: t('archive.all'),       image: IMG.archive, statusFilter: null },
    { id: 'accepted', label: t('archive.favorites'), image: IMG.draft,   statusFilter: 'accepted' },
    { id: 'rejected', label: t('archive.trash'),     image: IMG.trash,   statusFilter: 'rejected' },
  ];

  useEffect(() => {
    archiveAPI.getAll()
      .then(setEntries)
      .catch(e => addToast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = useCallback(async (id, status) => {
    setConfirming(null);
    setUpdating(id + status);
    try {
      const updated = await archiveAPI.update(id, { status });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status: updated.status } : e));
      const label = status === 'accepted'
        ? t('archive.movedToFavorites')
        : status === 'rejected'
          ? t('archive.movedToTrash')
          : t('archive.restoredToPending');
      addToast(label, 'success');
    } catch (e) { addToast(e.message, 'error'); }
    finally { setUpdating(null); }
  }, [t]);

  const bulkStatus = async (status) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setUpdating('bulk');
    try {
      await Promise.all(ids.map(id => archiveAPI.update(id, { status })));
      setEntries(prev => prev.map(e => ids.includes(e.id) ? { ...e, status } : e));
      const label = status === 'accepted'
        ? t('archive.favorites')
        : status === 'rejected'
          ? t('archive.trash')
          : t('archive.pending');
      const count = ids.length;
      const msg = count > 1
        ? t('archive.itemsMovedPlural', { count, label })
        : t('archive.itemsMoved', { count, label });
      addToast(msg, 'success');
    } catch (e) { addToast(e.message, 'error'); }
    finally { setUpdating(null); setSelectedIds(new Set()); }
  };

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setUpdating('bulk');
    try {
      await Promise.all(ids.map(id => archiveAPI.delete(id)));
      setEntries(prev => prev.filter(e => !ids.includes(e.id)));
      const count = ids.length;
      const msg = count > 1
        ? t('archive.itemsDeletedPlural', { count })
        : t('archive.itemsDeleted', { count });
      addToast(msg, 'success');
    } catch (e) { addToast(e.message, 'error'); }
    finally { setUpdating(null); setSelectedIds(new Set()); }
  };

  const handleDelete = async (id) => {
    try {
      await archiveAPI.delete(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      addToast(t('archive.deleted'), 'success');
    } catch (e) { addToast(e.message, 'error'); }
  };

  const handleDataset = async (id, in_dataset) => {
    setUpdating(id + 'ds');
    try {
      const updated = await archiveAPI.update(id, { in_dataset });
      setEntries(prev => prev.map(e => e.id === id ? { ...e, in_dataset: updated.in_dataset } : e));
      addToast(in_dataset ? t('archive.savedToDataset') : t('archive.removedFromDataset'), 'success');
    } catch (e) { addToast(e.message, 'error'); }
    finally { setUpdating(null); }
  };

  const toggleSelect   = (id, e) => { e?.stopPropagation(); setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const clearSelection = () => setSelectedIds(new Set());
  const toggleSubject  = (s) => setCollapsedSubjects(prev => ({ ...prev, [s]: !prev[s] }));

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'a') { e.preventDefault(); setSelectedIds(new Set(tabFiltered.map(en => en.id))); }
      if (ctrl && e.key === 'c' && selectedIds.size > 0) { setClipboard([...selectedIds]); addToast(`${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} copied`, 'info'); }
      if (ctrl && e.key === 'v' && clipboard.length > 0) {
        const targetStatus = TAB_STATUS[activeTab];
        Promise.all(clipboard.map(id => archiveAPI.update(id, { status: targetStatus })))
          .then(() => {
            setEntries(prev => prev.map(e => clipboard.includes(e.id) ? { ...e, status: targetStatus } : e));
            addToast(`${clipboard.length} item${clipboard.length > 1 ? 's' : ''} pasted`, 'success');
            setClipboard([]);
          })
          .catch(er => addToast(er.message, 'error'));
      }
      if (e.key === 'Escape') { clearSelection(); setClipboard([]); setConfirming(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, clipboard, activeTab]); // eslint-disable-line

  /* drag */
  const handleCardDragStart = (e, id) => {
    const ids = selectedIds.has(id) ? [...selectedIds] : [id];
    setDraggingIds(ids);
    e.dataTransfer.effectAllowed = 'move';
    const ghost = document.createElement('div');
    ghost.textContent = ids.length > 1 ? `${ids.length} items` : '1 item';
    ghost.style.cssText = 'position:fixed;top:-999px;background:#6d28d9;color:#fff;padding:5px 12px;border-radius:8px;font-size:12px;font-family:monospace;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };
  const handleCardDragEnd = () => { setDraggingIds([]); setDragOverTab(null); };
  const handleTabDragOver = (e, tabId) => {
    if (!draggingIds.length) return;
    const targetStatus = TAB_STATUS[tabId];
    const allSame = draggingIds.every(id => entries.find(en => en.id === id)?.status === targetStatus);
    if (allSame) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTab(tabId);
  };
  const handleTabDrop = async (e, tabId) => {
    e.preventDefault();
    if (!draggingIds.length) return;
    const target = TAB_STATUS[tabId];
    const toMove = draggingIds.filter(id => entries.find(en => en.id === id)?.status !== target);
    if (toMove.length > 1) {
      setUpdating('bulk');
      try {
        await Promise.all(toMove.map(id => archiveAPI.update(id, { status: target })));
        setEntries(prev => prev.map(e => toMove.includes(e.id) ? { ...e, status: target } : e));
        addToast(`${toMove.length} items moved`, 'success');
      } catch (er) { addToast(er.message, 'error'); }
      finally { setUpdating(null); }
    } else if (toMove.length === 1) {
      handleStatus(toMove[0], target);
    }
    setDraggingIds([]); setDragOverTab(null);
  };

  /* derived */
  const tabEntry    = TABS.find(tab => tab.id === activeTab);
  const tabFiltered = tabEntry?.statusFilter
    ? entries.filter(e => e.status === tabEntry.statusFilter)
    : entries;

  const subjects = [...new Set(tabFiltered.map(e => e.ai_subject))];
  const grouped  = subjects.reduce((acc, s) => { acc[s] = tabFiltered.filter(e => e.ai_subject === s); return acc; }, {});
  const visibleSubjects = filterSubject === 'all' ? subjects : subjects.filter(s => s === filterSubject);

  const counts = {
    all:      entries.length,
    accepted: entries.filter(e => e.status === 'accepted').length,
    rejected: entries.filter(e => e.status === 'rejected').length,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex">
      <AppSidebar active="archive" />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1000px] mx-auto px-6 py-10">

          {/* ── Header ── */}
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Icon src={IMG.archive} size={20} />
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">{t('archive.subtitle')}</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{t('archive.title')}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">
                {loading ? '…' : `${entries.length} generation${entries.length !== 1 ? 's' : ''} · ${[...new Set(entries.map(e => e.ai_subject))].length} subject${[...new Set(entries.map(e => e.ai_subject))].length !== 1 ? 's' : ''}`}
              </p>
            </div>
            {user && (() => {
              const count = user.exam_count ?? 0;
              const limit = user.exam_limit ?? 10;
              const pct   = count / limit;
              const cls   = pct >= 1 ? 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/30'
                          : pct >= 0.7 ? 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30'
                          : 'text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/30';
              return (
                <span className={`self-start text-xs font-mono px-3 py-1.5 rounded-lg border font-medium ${cls}`}>
                  {t('archive.usedQuota', { count, limit })}
                </span>
              );
            })()}
          </div>

          {/* ── Bulk Bar ── */}
          {selectedIds.size > 0 && (
            <BulkBar
              count={selectedIds.size} total={tabFiltered.length}
              updating={updating === 'bulk'}
              onSelectAll={() => setSelectedIds(new Set(tabFiltered.map(e => e.id)))}
              onClear={clearSelection}
              onMoveAccepted={() => bulkStatus('accepted')}
              onMoveRejected={() => bulkStatus('rejected')}
            />
          )}

          {/* ── Tabs ── */}
          {draggingIds.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 font-mono mb-2">
              {t('archive.dropToMove')}{draggingIds.length > 1 ? ` ${t('archive.dropItems', { count: draggingIds.length })}` : ''}
            </p>
          )}
          <div className="flex items-center gap-1 mb-6 p-1 bg-white dark:bg-white/5 rounded-xl border border-blue-300 dark:border-blue-500/40 w-fit shadow-sm">
            {TABS.map(tab => {
              const isActive   = activeTab === tab.id;
              const isDropOver = dragOverTab === tab.id;
              const dropCls = tab.id === 'accepted' ? 'ring-2 ring-sky-400 bg-sky-50 dark:bg-sky-500/15'
                            : tab.id === 'rejected' ? 'ring-2 ring-red-400 bg-red-50 dark:bg-red-500/15'
                            : 'ring-2 ring-gray-400 bg-gray-100 dark:bg-white/10';
              return (
                <button key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setFilterSubject('all'); clearSelection(); }}
                  onDragOver={e => handleTabDragOver(e, tab.id)}
                  onDragLeave={() => setDragOverTab(null)}
                  onDrop={e => handleTabDrop(e, tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all
                    ${isDropOver ? dropCls
                      : isActive
                        ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}>
                  <Icon src={isDropOver ? IMG.folder : tab.image} size={15} />
                  {tab.label}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono
                    ${isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 dark:bg-white/8 text-gray-400 dark:text-gray-500'}`}>
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Subject chips ── */}
          {!loading && subjects.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Chip active={filterSubject === 'all'} onClick={() => setFilterSubject('all')}
                label={`${t('archive.all')} (${tabFiltered.length})`} colorCls="text-gray-600 dark:text-gray-300 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10" />
              {subjects.map(s => {
                const sm = subjectMeta(s);
                return (
                  <Chip key={s} active={filterSubject === s} onClick={() => setFilterSubject(s)}
                    label={`${sm.label} (${grouped[s]?.length || 0})`}
                    colorCls={filterSubject === s
                      ? `${sm.color} ${sm.bg} ${sm.border}`
                      : 'text-gray-500 dark:text-gray-400 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'} />
                );
              })}
            </div>
          )}

          {/* ── Info banners ── */}
          {activeTab === 'rejected' && counts.rejected > 0 && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl mb-6"
              style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(239,68,68,0.15)' }}>
              <Icon src={IMG.trashAlt} size={16} className="flex-shrink-0 mt-0.5 opacity-50" />
              <div>
                <p className="text-sm font-semibold text-red-500 dark:text-red-400 mb-0.5">{t('archive.trashInfoTitle')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {t('archive.trashInfoDesc')}
                </p>
              </div>
            </div>
          )}
          {activeTab === 'accepted' && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl mb-6"
              style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <Icon src={IMG.draft} size={16} className="flex-shrink-0 mt-0.5 opacity-60" />
              <div>
                <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 mb-0.5">{t('archive.favoritesInfoTitle')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {t('archive.favoritesInfoDesc')}{' '}
                  <Link to="/exam-builder" className="underline underline-offset-2">{t('archive.examBuilder')}</Link>.
                </p>
              </div>
            </div>
          )}

          {/* ── Content ── */}
          {loading ? (
            <LoadingState />
          ) : tabFiltered.length === 0 ? (
            activeTab === 'all' ? <EmptyState /> : (
              <div className="text-center py-16">
                <p className="text-gray-400 dark:text-gray-500 font-mono text-sm">
                  {activeTab === 'accepted' ? t('archive.noFavorites') : t('archive.noTrash')}
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-6">
              {visibleSubjects.map(subj => {
                const sm = subjectMeta(subj);
                const subjectEntries = grouped[subj];
                const isCollapsed = collapsedSubjects[subj];
                return (
                  <div key={subj}>
                    <button onClick={() => toggleSubject(subj)}
                      className="w-full flex items-center gap-3 mb-3 group text-left bg-transparent border-none cursor-pointer">
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${sm.bg} border ${sm.border}`}>
                        <span className={`text-[12px] font-bold font-mono ${sm.color}`}>{sm.label}</span>
                        <span className={`text-[11px] font-mono ${sm.color} opacity-60`}>{subjectEntries.length}</span>
                        <span className={`text-[10px] ${sm.color} opacity-40`}>{isCollapsed ? '▼' : '▲'}</span>
                      </div>
                      <div className={`h-px flex-1 ${sm.border} border-t`} />
                    </button>

                    {!isCollapsed && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {subjectEntries.map((entry, i) => (
                          <ArchiveCard key={entry.id} entry={entry} index={i}
                            isExpanded={expandedId === entry.id}
                            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                            onDelete={() => setConfirmModal({ type: 'delete', id: entry.id })}
                            onAccept={() => setConfirmModal({ type: 'status', id: entry.id, action: 'accepted' })}
                            onReject={() => setConfirmModal({ type: 'status', id: entry.id, action: 'rejected' })}
                            isSelected={selectedIds.has(entry.id)}
                            anySelected={selectedIds.size > 0}
                            onSelect={e => toggleSelect(entry.id, e)}
                            isDragging={draggingIds.includes(entry.id)}
                            onDragStart={e => handleCardDragStart(e, entry.id)}
                            onDragEnd={handleCardDragEnd}
                            onDataset={(v) => handleDataset(entry.id, v)}
                            updating={updating === entry.id + 'accepted' || updating === entry.id + 'rejected' || updating === entry.id + 'pending' || updating === entry.id + 'ds'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <ConfirmModal
          modal={confirmModal}
          onConfirm={() => {
            if (confirmModal.type === 'delete') handleDelete(confirmModal.id);
            else handleStatus(confirmModal.id, confirmModal.action);
            setConfirmModal(null);
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}

/* ── Chip ───────────────────────────────────────────────────────────────── */
function Chip({ label, active, onClick, colorCls }) {
  return (
    <button onClick={onClick}
      className={`text-[12px] px-3 py-1.5 rounded-lg border font-mono font-medium transition-all ${colorCls}
        ${active ? 'shadow-sm' : 'hover:border-gray-300 dark:hover:border-white/20'}`}>
      {label}
    </button>
  );
}

/* ── ArchiveCard ─────────────────────────────────────────────────────────── */
function ArchiveCard({ entry, index, isExpanded, onToggle, onDelete, onAccept, onReject, onDataset,
  updating, isDragging, onDragStart, onDragEnd, isSelected, anySelected, onSelect }) {

  const { t } = useTranslation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const isQ = entry.mode === 'questions';
  const m   = isQ ? MODE.questions : MODE.full_exam;
  const ac  = ACCENT[m.accent];
  const date = new Date(entry.created_at).toLocaleDateString('fr-DZ', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const count = isQ
    ? (Array.isArray(entry.content) ? entry.content.length : 0)
    : (entry.content?.exercises?.length || 0);

  const STATUS_BADGE = {
    accepted: { label: t('archive.favorite'), cls: 'text-sky-600 bg-transparent border-sky-200/60 dark:text-sky-400 dark:border-sky-500/30', icon: IMG.draft },
    rejected: { label: t('archive.trash'),    cls: 'text-red-500 bg-transparent border-red-200/50 dark:text-red-400 dark:border-red-500/25',   icon: IMG.trashAlt },
    pending:  { label: t('archive.pending'),  cls: 'text-gray-400 bg-transparent border-gray-200/60 dark:text-gray-500 dark:border-white/10',   icon: null },
  };
  const badge = STATUS_BADGE[entry.status] || STATUS_BADGE.pending;

  return (
    <div
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{
        animationDelay: `${index * 0.04}s`,
        background: entry.status === 'rejected'
          ? 'rgba(255,255,255,0.45)'
          : 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
      className={`rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing shadow-sm
        ${isDragging ? 'opacity-40 scale-[0.98]' : ''}
        ${isSelected
          ? 'ring-2 ring-blue-400 border-blue-300 dark:border-blue-500/40'
          : 'border-white/60 dark:border-white/8'
        }`}>

      {/* Header */}
      <div
        onClick={onToggle}
        className={`group relative flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer
          ${isSelected ? 'bg-blue-50 dark:bg-blue-500/8' : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'}
          ${isExpanded ? 'rounded-t-xl' : 'rounded-xl'} transition-colors`}>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Checkbox */}
          <button onClick={onSelect}
            className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all
              ${isSelected
                ? 'bg-blue-500 border-blue-400 text-white'
                : 'border-gray-300 dark:border-white/20 bg-transparent hover:border-blue-400'}
              opacity-100`}
            title="Select">
            {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </button>

          {/* Mode icon */}
          <div className={`w-10 h-10 rounded-lg ${ac.bg} border ${ac.border} flex items-center justify-center flex-shrink-0`}>
            <Icon src={m.icon} size={24} />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className={`text-[14px] font-semibold truncate
              ${entry.status === 'rejected'
                ? 'text-teal-600 dark:text-teal-300'
                : 'text-gray-900 dark:text-white'}`}>
              {entry.title || (isQ ? t('archive.questionsBank') : t('archive.fullExam'))}
            </p>
            <p className={`text-[11px] font-mono mt-0.5
              ${entry.status === 'rejected'
                ? 'text-teal-500 dark:text-teal-400'
                : 'text-gray-400 dark:text-gray-500'}`}>
              {entry.ai_subject} · {count} {isQ ? 'q' : 'ex'} · {date}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>

          {/* Status badge — always visible */}
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium tracking-wide ${badge.cls}`}>
            {badge.label}
          </span>

          {/* Action buttons — always visible */}
          <div className="flex items-center gap-1">
            {entry.status === 'pending' && (
              <>
                <ActionBtn onClick={onAccept} disabled={updating} title={t('archive.moveFavorites')}
                  cls="border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-400 dark:hover:bg-sky-500/20">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </ActionBtn>
                <ActionBtn onClick={onReject} disabled={updating} title={t('archive.moveTrash')}
                  cls="border-transparent bg-transparent text-red-400 hover:text-red-600 hover:border-red-200/60 dark:text-red-400/70 dark:hover:text-red-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </ActionBtn>
              </>
            )}
            {entry.status === 'accepted' && (
              <>
                <ActionBtn onClick={() => onDataset(!entry.in_dataset)} disabled={updating}
                  title={entry.in_dataset ? t('archive.removedFromDataset') : t('archive.savedToDataset')}
                  cls={entry.in_dataset
                    ? 'border-blue-300 bg-blue-50 text-blue-600 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300'
                    : 'border-gray-200 bg-gray-100 text-gray-400 hover:border-blue-200 hover:text-blue-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:border-blue-500/30 dark:hover:text-blue-400'}>
                  <Icon src={IMG.save} size={11} />
                </ActionBtn>
              </>
            )}
            <ActionBtn onClick={onDelete} disabled={updating}
              title={entry.status === 'rejected' ? t('archive.deleteForever') : t('archive.delete')}
              cls="border-transparent bg-transparent text-gray-300 hover:border-red-200 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400">
              <Icon src={IMG.trashAlt} size={12} />
            </ActionBtn>
          </div>

          {/* Expand — always visible */}
          <ActionBtn onClick={onToggle}
            cls={isExpanded
              ? `${ac.bg} ${ac.border} ${ac.text} border`
              : 'border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-500 dark:hover:bg-white/10'}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {isExpanded
                ? <polyline points="2,6 5,3 8,6"/>
                : <polyline points="2,4 5,7 8,4"/>}
            </svg>
          </ActionBtn>
        </div>
      </div>

      {/* Expanded */}
      {isExpanded && (
        <div className={`border-t ${ac.border} rounded-b-xl p-4 max-h-[380px] overflow-y-auto bg-gray-50 dark:bg-white/[0.02]`}>
          <div className={`h-0.5 bg-gradient-to-r ${m.accent === 'blue' ? 'from-blue-400' : 'from-sky-400'} to-transparent rounded-full mb-3`} />
          <div className="flex flex-col gap-2">
            {isQ && Array.isArray(entry.content) ? (
              entry.content.map((q, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3 flex gap-2.5 items-start">
                  <span className={`text-[10px] font-mono ${ac.bg} ${ac.text} px-2 py-0.5 rounded-md border ${ac.border} flex-shrink-0`}>{q.type}</span>
                  <p className="text-[13px] text-gray-800 dark:text-white/85 leading-snug flex-1">{q.data?.stem || q.data?.title || '—'}</p>
                  {q.data?.level && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{q.data.level}</span>}
                </div>
              ))
            ) : (
              (entry.content?.exercises || []).map((ex, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.04] border border-gray-200 dark:border-white/8 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-white/90">{ex.title || `Exercise ${i + 1}`}</p>
                    {ex.total_exercise_points && (
                      <span className={`text-[10px] font-mono ${ac.bg} ${ac.text} px-2 py-0.5 rounded-md border ${ac.border}`}>
                        {ex.total_exercise_points} pts
                      </span>
                    )}
                  </div>
                  {ex.introduction_context && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">{ex.introduction_context}</p>
                  )}
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-mono mt-1.5">
                    {ex.questions?.length || 0} question{(ex.questions?.length || 0) !== 1 ? 's' : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, title, cls }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

/* ── LoadingState ───────────────────────────────────────────────────────── */
function LoadingState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center">
        <span className="w-5 h-5 border-2 border-gray-200 dark:border-white/10 border-t-blue-500 rounded-full animate-spin inline-block" />
      </div>
      <p className="text-gray-400 dark:text-gray-500 font-mono text-xs">{t('archive.loading')}</p>
    </div>
  );
}

/* ── EmptyState ─────────────────────────────────────────────────────────── */
function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-20">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center shadow-sm">
          <Icon src={IMG.archive} size={44} />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">{t('archive.noGenerations')}</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-[340px] mx-auto mb-7">
        {t('archive.noGenerationsDesc')}
      </p>
      <Link to="/subjects"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-semibold text-white transition-colors shadow-sm"
        style={{ textDecoration: 'none' }}>
        {t('archive.goToSubjects')}
      </Link>
    </div>
  );
}

/* ── BulkBar ─────────────────────────────────────────────────────────────── */
function BulkBar({ count, total, updating, onSelectAll, onClear, onMoveAccepted, onMoveRejected }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 mb-5 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(14,165,233,0.2)' }}>

      {/* Left: count + select-all + clear */}
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-blue-500 border-2 border-blue-400 flex items-center justify-center flex-shrink-0">
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span className="text-[12px] font-semibold text-blue-700 dark:text-blue-300">{count} {t('archive.selected')}</span>
        {count < total && (
          <button onClick={onSelectAll} className="text-[11px] text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 underline underline-offset-2">
            {t('archive.selectAll')} {total}
          </button>
        )}
        <button onClick={onClear} className="text-[11px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          ✕ {t('archive.clear')}
        </button>
      </div>

      <div className="h-4 w-px bg-blue-200 dark:bg-white/10" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <BulkBtn onClick={onMoveAccepted} disabled={updating} title={t('archive.moveFavorites')}
          cls="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20">
          <Icon src={IMG.draft} size={12} /> {t('archive.favorites')}
        </BulkBtn>
        <BulkBtn onClick={onMoveRejected} disabled={updating} title={t('archive.moveTrash')}
          cls="border-transparent bg-transparent text-red-400 hover:text-red-600 hover:border-red-200/50 dark:text-red-400/70 dark:hover:text-red-400">
          <Icon src={IMG.trashAlt} size={12} /> {t('archive.trash')}
        </BulkBtn>
      </div>

      {/* Hint */}
      <div className="ml-auto flex items-center gap-1.5 text-[11px] text-blue-400/70 dark:text-blue-300/40">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>{t('archive.trashHint')}</span>
      </div>

      {updating && (
        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">{t('archive.processing')}</span>
      )}
    </div>
  );
}

function BulkBtn({ children, onClick, disabled, cls, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}

/* ── ConfirmModal ───────────────────────────────────────────────────────── */
function ConfirmModal({ modal, onConfirm, onCancel }) {
  const { t } = useTranslation();
  const confirmConfig = getConfirmConfig(t);
  const key = modal.type === 'status' ? modal.action : modal.type;
  const cfg = confirmConfig[key] || confirmConfig.delete;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}>
      <div className="w-full max-w-[400px] rounded-2xl shadow-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
            <Icon src={cfg.icon} size={22} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">{cfg.title}</p>
            <p className="text-[13px] text-gray-500 dark:text-white/50 leading-relaxed">{cfg.message}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50 text-[13px] font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
            {t('archive.cancel')}
          </button>
          <button onClick={onConfirm}
            className={`px-5 py-2 rounded-lg text-[13px] font-semibold transition-all shadow-sm ${cfg.confirmCls}`}>
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
