// Web-CMS: the public proswim-lb.com content editors (classes, FAQs, levels,
// press, videos) plus the read-only feedback inbox. Config-driven lists +
// forms; each maps 1:1 to a legacy Web*List / Web*Individual page.

import { ModuleListPage, type ModuleConfig } from '../components/ModuleListPage';
import { RecordFormPage, type RecordFormConfig } from '../components/RecordFormPage';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Classes ──────────────────────────────────────────────────────────────────
const classesList: ModuleConfig = {
  title: 'Website · Classes',
  endpoint: '/api/portal/modules/web-classes',
  idKey: 'WebClassID',
  editBase: '/web/classes',
  filters: [{ param: 'searchFor', label: 'Search…', type: 'text' }],
  columns: [
    { key: 'WebClassName', label: 'Name' },
    { key: 'WebClassPriority', label: 'Priority' },
    { key: 'WebClassOnline', label: 'Online', format: 'bool' },
    { key: 'WebClassDate', label: 'Updated', format: 'date' },
  ],
};
const classForm: RecordFormConfig = {
  title: 'Website Class', listPath: '/web/classes', slug: 'webclass',
  idKey: 'WebClassID', titleKey: 'WebClassName',
  createDefaults: { WebClassOnline: true, WebClassPriority: 0, WebClassDate: today() },
  sections: [{ title: 'Class', fields: [
    { key: 'WebClassName', label: 'Name', type: 'text' },
    { key: 'WebClassDescription', label: 'Description', type: 'textarea' },
    { key: 'WebClassEttiquette', label: 'Etiquette', type: 'textarea' },
    { key: 'WebClassPriority', label: 'Priority (sort order)', type: 'number' },
    { key: 'WebClassDate', label: 'Date', type: 'date' },
    { key: 'WebClassOnline', label: 'Show online', type: 'checkbox' },
  ] }],
};

// ── FAQs ─────────────────────────────────────────────────────────────────────
const faqsList: ModuleConfig = {
  title: 'Website · FAQs',
  endpoint: '/api/portal/modules/web-faqs',
  idKey: 'WebFAQID',
  editBase: '/web/faqs',
  filters: [{ param: 'searchFor', label: 'Search…', type: 'text' }],
  columns: [
    { key: 'WebFAQQuestion', label: 'Question' },
    { key: 'WebFAQPriority', label: 'Priority' },
    { key: 'WebFAQOnline', label: 'Online', format: 'bool' },
    { key: 'WebFAQDate', label: 'Updated', format: 'date' },
  ],
};
const faqForm: RecordFormConfig = {
  title: 'Website FAQ', listPath: '/web/faqs', slug: 'webfaq',
  idKey: 'WebFAQID', titleKey: 'WebFAQQuestion',
  createDefaults: { WebFAQOnline: true, WebFAQPriority: 0, WebFAQDate: today() },
  sections: [{ title: 'FAQ', fields: [
    { key: 'WebFAQQuestion', label: 'Question', type: 'text' },
    { key: 'WebFAQAnswer', label: 'Answer', type: 'textarea' },
    { key: 'WebFAQPriority', label: 'Priority (sort order)', type: 'number' },
    { key: 'WebFAQDate', label: 'Date', type: 'date' },
    { key: 'WebFAQOnline', label: 'Show online', type: 'checkbox' },
  ] }],
};

// ── Levels ───────────────────────────────────────────────────────────────────
const levelsList: ModuleConfig = {
  title: 'Website · Levels',
  endpoint: '/api/portal/modules/web-levels',
  idKey: 'WebLevelID',
  editBase: '/web/levels',
  filters: [{ param: 'searchFor', label: 'Search…', type: 'text' }],
  columns: [
    { key: 'WebLevelName', label: 'Name' },
    { key: 'WebLevelPriority', label: 'Priority' },
    { key: 'WebLevelOnline', label: 'Online', format: 'bool' },
    { key: 'WebLevelDate', label: 'Updated', format: 'date' },
  ],
};
const levelForm: RecordFormConfig = {
  title: 'Website Level', listPath: '/web/levels', slug: 'weblevel',
  idKey: 'WebLevelID', titleKey: 'WebLevelName',
  createDefaults: { WebLevelOnline: true, WebLevelPriority: 0, WebLevelDate: today() },
  sections: [{ title: 'Level', fields: [
    { key: 'WebLevelName', label: 'Name', type: 'text' },
    { key: 'WebLevelDescription', label: 'Description', type: 'textarea' },
    { key: 'WebLevelPriority', label: 'Priority (sort order)', type: 'number' },
    { key: 'WebLevelDate', label: 'Date', type: 'date' },
    { key: 'WebLevelOnline', label: 'Show online', type: 'checkbox' },
  ] }],
};

// ── Press ────────────────────────────────────────────────────────────────────
const pressesList: ModuleConfig = {
  title: 'Website · Press',
  endpoint: '/api/portal/modules/web-presses',
  idKey: 'WebPressID',
  editBase: '/web/presses',
  filters: [{ param: 'searchFor', label: 'Search…', type: 'text' }],
  columns: [
    { key: 'WebPressTitle', label: 'Title' },
    { key: 'WebPressSource', label: 'Source' },
    { key: 'WebPressPriority', label: 'Priority' },
    { key: 'WebPressOnline', label: 'Online', format: 'bool' },
    { key: 'WebPressDate', label: 'Date', format: 'date' },
  ],
};
const pressForm: RecordFormConfig = {
  title: 'Press Item', listPath: '/web/presses', slug: 'webpress',
  idKey: 'WebPressID', titleKey: 'WebPressTitle',
  createDefaults: { WebPressOnline: true, WebPressPriority: 0, WebPressDate: today() },
  sections: [{ title: 'Press', fields: [
    { key: 'WebPressTitle', label: 'Title', type: 'text' },
    { key: 'WebPressSource', label: 'Source', type: 'text' },
    { key: 'WebPressLink', label: 'Link (URL)', type: 'text' },
    { key: 'WebPressSummary', label: 'Summary', type: 'textarea' },
    { key: 'WebPressBody', label: 'Body', type: 'textarea' },
    { key: 'WebPressPriority', label: 'Priority (sort order)', type: 'number' },
    { key: 'WebPressDate', label: 'Date', type: 'date' },
    { key: 'WebPressOnline', label: 'Show online', type: 'checkbox' },
  ] }],
};

// ── Videos ───────────────────────────────────────────────────────────────────
const videosList: ModuleConfig = {
  title: 'Website · Videos',
  endpoint: '/api/portal/modules/web-videos',
  idKey: 'WebVideoID',
  editBase: '/web/videos',
  filters: [{ param: 'searchFor', label: 'Search…', type: 'text' }],
  columns: [
    { key: 'WebVideoTitle', label: 'Title' },
    { key: 'WebVideoLink', label: 'Link' },
    { key: 'WebVideoPriority', label: 'Priority' },
    { key: 'WebVideoOnline', label: 'Online', format: 'bool' },
    { key: 'WebVideoDate', label: 'Date', format: 'date' },
  ],
};
const videoForm: RecordFormConfig = {
  title: 'Website Video', listPath: '/web/videos', slug: 'webvideo',
  idKey: 'WebVideoID', titleKey: 'WebVideoTitle',
  createDefaults: { WebVideoOnline: true, WebVideoPriority: 0, WebVideoDate: today() },
  sections: [{ title: 'Video', fields: [
    { key: 'WebVideoTitle', label: 'Title', type: 'text' },
    { key: 'WebVideoLink', label: 'Link (URL)', type: 'text' },
    { key: 'WebVideoSummary', label: 'Summary', type: 'textarea' },
    { key: 'WebVideoPriority', label: 'Priority (sort order)', type: 'number' },
    { key: 'WebVideoDate', label: 'Date', type: 'date' },
    { key: 'WebVideoOnline', label: 'Show online', type: 'checkbox' },
  ] }],
};

// ── Feedback inbox (read-only) ───────────────────────────────────────────────
const feedbackList: ModuleConfig = {
  title: 'Website · Feedback',
  subtitle: 'Messages submitted through the public site',
  endpoint: '/api/portal/modules/web-feedback',
  idKey: 'WebFeedbackID',
  filters: [],
  columns: [
    { key: 'WebFeedbackDate', label: 'Date', format: 'date' },
    { key: 'WebFeedbackFullName', label: 'Name' },
    { key: 'WebFeedbackReason', label: 'Reason' },
    { key: 'WebFeedbackPhone', label: 'Phone' },
    { key: 'WebFeedbackEmailAddress', label: 'Email' },
    { key: 'WebFeedbackRemarks', label: 'Message' },
  ],
};

export const WebClassesPage = () => <ModuleListPage config={classesList} />;
export const WebClassForm = () => <RecordFormPage config={classForm} />;
export const WebFaqsPage = () => <ModuleListPage config={faqsList} />;
export const WebFaqForm = () => <RecordFormPage config={faqForm} />;
export const WebLevelsPage = () => <ModuleListPage config={levelsList} />;
export const WebLevelForm = () => <RecordFormPage config={levelForm} />;
export const WebPressesPage = () => <ModuleListPage config={pressesList} />;
export const WebPressForm = () => <RecordFormPage config={pressForm} />;
export const WebVideosPage = () => <ModuleListPage config={videosList} />;
export const WebVideoForm = () => <RecordFormPage config={videoForm} />;
export const WebFeedbackPage = () => <ModuleListPage config={feedbackList} />;
