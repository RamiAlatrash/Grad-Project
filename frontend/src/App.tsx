import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3, SplitSquareHorizontal, FileText, Bug,
  Shield, FlaskConical, Users, MessageSquare, Loader2,
} from 'lucide-react';

import { api, isSuppressedAuth401Error } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { notify } from './lib/notify';

import { Document, Attack, Defense, ChatMessage } from '../../shared/types';
import type { ChatSession } from './components/ChatInterface';

import LoginPage from './components/LoginPage';
import AppShell from './components/AppShell';
import type { NavSection } from './components/AppShell';
import { pageTransitionProps } from './components/ui/page-transition';
import ChatInterface from './components/ChatInterface';
import DocumentsPage from './components/DocumentsPage';
import AttacksPage from './components/AttacksPage';
import DefensesPage from './components/DefensesPage';
import AnalyticsPage from './components/AnalyticsPage';
import TestingPage from './components/TestingPage';
import TestTracesPage from './components/TestTracesPage';
import ComparisonSimulator from './components/ComparisonSimulator';
import UserManagementPage from './components/UserManagementPage';
import { shouldSuppressAuth401Toast } from './lib/auth-toast-suppress';

type PageView =
  | 'analytics' | 'simulator' | 'documents' | 'attacks'
  | 'defenses' | 'testing' | 'test-traces' | 'users' | 'chat';

/** Human-readable labels used in the breadcrumb. */
const PAGE_LABELS: Record<string, string> = {
  analytics: 'Analytics',
  simulator: 'Simulator',
  documents: 'Documents',
  attacks: 'Attacks',
  defenses: 'Defenses',
  testing: 'Stress Test',
  'test-traces': 'Test Traces',
  users: 'User Management',
  chat: 'Chat',
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.random().toString(36).substring(2);
};

const ADMIN_ONLY_PAGES = new Set([
  'analytics',
  'simulator',
  'attacks',
  'defenses',
  'testing',
  'test-traces',
  'users',
]);

/**
 * True when a bootstrap request should fail silently (no toast / no further handling).
 *
 * - `signal?.aborted` — AbortController aborted before the request settled.
 * - `axios.isCancel(error)` — legacy CancelToken-style rejections (compat with older callers).
 * - `error.code === 'ERR_CANCELED'` — Axios when the request was aborted via `AbortSignal`.
 * - `isSuppressedAuth401Error(error)` — tagged rejection from `api.ts` interceptor during intentional sign-out.
 */
function isBootstrapLoadAborted(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (axios.isCancel(error)) return true;
  if (isSuppressedAuth401Error(error)) return true;
  if (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') return true;
  return false;
}

// AUTHCHECK: no mock session found — real auth already active

function AppContent() {
  const { user, session, isLoading: authLoading, logout } = useAuth();
  /** AuthProvider maps session → a new `user` object each render; ref avoids bootstrap loops in loadInitialData. */
  const userRef = useRef(user);
  userRef.current = user;

  const [documents, setDocuments] = useState<Document[]>([]);
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [defenses, setDefenses] = useState<Defense[]>([]);
  const [activeDefenses, setActiveDefenses] = useState<string[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    let valid: ChatSession[] = [];
    try {
      const stored = localStorage.getItem('thrax_chat_sessions');
      if (stored) {
        const parsed = JSON.parse(stored) as ChatSession[];
        const now = Date.now();
        valid = parsed.filter(s => now - s.updatedAt < 86400000); // 24 hours
      }
    } catch {}
    
    // Always ensure a fresh empty chat is available at the top when loading, like standard GPTs
    if (valid.length > 0 && valid[0].messages.length === 0 && (!valid[0].title || valid[0].title === 'New Chat')) {
      return valid;
    }
    
    return [{ id: generateId(), title: 'New Chat', messages: [], updatedAt: Date.now() }, ...valid];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(chatSessions[0]?.id);
  const [dataLoading, setDataLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(
    () => (localStorage.getItem('theme') as 'dark' | 'light' | 'system') || 'dark'
  );

  const [currentPage, setCurrentPage] = useState<PageView>(() =>
    user?.role === 'admin' || user?.role === 'super_admin' ? 'analytics' : 'chat',
  );
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const defaultPage: PageView = isAdmin ? 'analytics' : 'chat';
  const effectivePage: PageView = !isAdmin && ADMIN_ONLY_PAGES.has(currentPage)
    ? 'chat'
    : currentPage;

  useEffect(() => {
    localStorage.setItem('thrax_chat_sessions', JSON.stringify(chatSessions));
  }, [chatSessions]);

  useEffect(() => {
    const pruneExpiredChats = () => {
      setChatSessions((prev) => {
        const now = Date.now();
        const valid = prev.filter(s => now - s.updatedAt < 86400000); // 24 hours
        
        if (valid.length === prev.length) return prev; // no change
        
        if (valid.length === 0) {
          const newSession = { id: generateId(), title: '', messages: [], updatedAt: Date.now() };
          setActiveSessionId(newSession.id);
          return [newSession];
        }

        if (!valid.find(s => s.id === activeSessionId)) {
          setActiveSessionId(valid[0].id);
        }
        
        return valid;
      });
    };

    const intervalId = setInterval(pruneExpiredChats, 60000); // check every minute
    return () => clearInterval(intervalId);
  }, [activeSessionId]);

  const activeSession = chatSessions.find(s => s.id === activeSessionId) || chatSessions[0];
  const messages = activeSession?.messages || [];

  // --- Effects ---

  // Keep stress-test document IDs in sync with the server when opening the page (in-memory store).
  useEffect(() => {
    if (!user || effectivePage !== 'testing') return;
    if (user.role !== 'admin' && user.role !== 'super_admin') return;
    api.getDocuments().then((d) => setDocuments(d.documents)).catch(() => {});
  }, [effectivePage, user?.id, user?.role]);

  useEffect(() => {
    if (!user) return;
    document.title = 'THRAX';
  }, [effectivePage, user?.id, user?.role]);

  useEffect(() => {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- Data loading ---

  const handleBootstrapError = useCallback((error: unknown) => {
    if (axios.isCancel(error)) return;
    if (shouldSuppressAuth401Toast()) return;
    if (isSuppressedAuth401Error(error)) return;
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401) {
        notify.error('Your session expired. Please sign in again.');
        return;
      }
      if (status === 403) {
        notify.error('You do not have permission to access that resource.');
        return;
      }
    }
    notify.error('Could not reach the backend. Is the server running?');
  }, []);

  const loadInitialData = useCallback(async (signal?: AbortSignal) => {
    const u = userRef.current;
    const isAdminUsr = u?.role === 'admin' || u?.role === 'super_admin';

    try {
      const [health, docsData] = await Promise.all([
        api.checkHealth({ signal }),
        api.getDocuments({ signal }),
      ]);

      if (signal?.aborted) return;
      setHealthStatus(health);
      setIsConnected(health.llmConfigured);
      setDocuments(docsData.documents);
    } catch (error) {
      if (isBootstrapLoadAborted(error, signal)) return;
      handleBootstrapError(error);
      return;
    }

    if (!isAdminUsr) {
      setAttacks([]);
      setDefenses([]);
      setActiveDefenses([]);
      return;
    }

    if (signal?.aborted) return;

    try {
      const [attacksData, defensesData] = await Promise.all([
        api.getAttacks({ signal }),
        api.getDefenses({ signal }),
      ]);
      if (signal?.aborted) return;
      setAttacks(attacksData);
      setDefenses(defensesData);
      setActiveDefenses(defensesData.filter((d: Defense) => d.enabled).map((d: Defense) => d.id));
    } catch (error) {
      if (isBootstrapLoadAborted(error, signal)) return;
      handleBootstrapError(error);
    }
  }, [handleBootstrapError]); // `user.role` via userRef — AuthProvider recreates `user` each render; ref tracks latest without churning this callback.

  useEffect(() => {
    if (!user) return;
    setCurrentPage(user.role === 'admin' || user.role === 'super_admin' ? 'analytics' : 'chat');
    const ac = new AbortController();
    setDataLoading(true);
    void loadInitialData(ac.signal).finally(() => {
      if (!ac.signal.aborted) setDataLoading(false);
    });
    return () => ac.abort();
  }, [user?.id, user?.role, loadInitialData]);

  // --- Handlers ---

  const handleUploadDocument = async (file: File) => {
    try {
      const result = await api.uploadDocument(file, false);
      setDocuments((prev) => {
        // Only add if not already exists
        if (!prev.find(d => d.id === result.document.id)) {
          return [...prev, result.document];
        }
        return prev;
      });
      
      // Associate with current active chat session
      setChatSessions((prev) => prev.map(s => {
        if (s.id === activeSessionId) {
          const currentDocIds = s.documentIds || [];
          if (!currentDocIds.includes(result.document.id)) {
            return { ...s, documentIds: [...currentDocIds, result.document.id], updatedAt: Date.now() };
          }
        }
        return s;
      }));

      notify.success(
        'Document uploaded and attached to current chat',
        'Untrusted source: uploaded .txt files are treated as potentially malicious and excluded from Comparison Simulator clean baselines.',
      );
      if (result.scanResult?.isPoisonSuspect) {
        notify.warn(
          'Heuristic scan flagged possible injection patterns',
          result.scanResult.indicators.slice(0, 4).join(' · '),
        );
      }
    } catch {
      notify.error('Upload failed. Check the file and try again.');
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await api.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      notify.error('Could not delete document — please try again.');
    }
  };

  const handleRefreshDocuments = useCallback(async () => {
    const data = await api.getDocuments();
    setDocuments(data.documents);
  }, []);

  const handleToggleDocumentInChat = useCallback((docId: string) => {
    setChatSessions(prev => prev.map(s => {
      if (s.id !== activeSessionId) return s;
      const current = s.documentIds || [];
      const next = current.includes(docId)
        ? current.filter(id => id !== docId)
        : [...current, docId];
      return { ...s, documentIds: next, updatedAt: Date.now() };
    }));
  }, [activeSessionId]);

  const handleCreateAttack = async (data: {
    name: string;
    description: string;
    injectionText: string;
    category: string;
    tier: string;
    howItWorks?: string;
    mechanism?: string;
    impact?: string;
    example?: string;
  }) => {
    try {
      const attack = await api.createAttack(data);
      setAttacks((prev) => [...prev, attack]);
      notify.success(`Attack "${attack.name}" created`);
    } catch {
      notify.error('Failed to create attack.');
      throw new Error('Failed');
    }
  };

  const handleDeleteAttack = async (attackId: string) => {
    try {
      await api.deleteAttack(attackId);
      setAttacks((prev) => prev.filter((a) => a.id !== attackId));
      notify.info('Attack deleted');
    } catch {
      notify.error('Failed to delete attack. Built-in attacks cannot be deleted.');
    }
  };

  const handleToggleDefense = async (defenseId: string) => {
    try {
      const updatedDefense = await api.toggleDefense(defenseId);
      setDefenses((prev) =>
        prev.map((d) => (d.id === defenseId ? updatedDefense : d)),
      );
      setActiveDefenses((prev) =>
        updatedDefense.enabled
          ? [...prev.filter((id) => id !== defenseId), defenseId]
          : prev.filter((id) => id !== defenseId),
      );
      notify.info(`${updatedDefense.name} ${updatedDefense.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      notify.error('Failed to toggle defense.');
    }
  };

  const handleSendMessage = async (prompt: string) => {
    if (!prompt.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    
    setChatSessions((prev) => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() };
      }
      return s;
    }));

    try {
      // Use documents attached to this chat, or default to empty if none.
      // We also filter by `documents` in state to ensure they haven't been deleted globally.
      const currentChatDocIds = chatSessions.find(s => s.id === activeSessionId)?.documentIds || [];
      const activeDocumentIds = documents.filter(d => currentChatDocIds.includes(d.id)).map(d => d.id);

      const response = await api.query({
        prompt,
        documentIds: activeDocumentIds,
        activeDefenses,
      });
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        defenseState: response.defenseState,
      };
      
      setChatSessions((prev) => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() };
        }
        return s;
      }));
    } catch {
      notify.error('No response from AI. Is the backend running?');
      
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Connection error: Could not reach the AI backend. Please check your connection and try again.',
        timestamp: new Date(),
      };
      
      setChatSessions((prev) => prev.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, messages: [...s.messages, errorMsg], updatedAt: Date.now() };
        }
        return s;
      }));
    }
  };

  const handleNavigate = useCallback((pageId: string) => {
    const requested = pageId as PageView;
    if (!isAdmin && ADMIN_ONLY_PAGES.has(requested)) {
      setCurrentPage('chat');
      return;
    }
    setCurrentPage(requested);
  }, [isAdmin]);

  const handleLogout = () => {
    logout();
    notify.info('You have been signed out.');
  };

  // --- Auth loading ---

  if (authLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background">
        <span role="status" aria-label="Loading application">
          <span className="sr-only">Loading…</span>
          <Loader2 size={32} className="animate-spin text-primary" aria-hidden="true" />
        </span>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  // --- Nav sections ---

  const adminSections: NavSection[] = [
    {
      label: 'OVERVIEW',
      items: [
        { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-5 w-5" /> },
      ],
    },
    {
      label: 'LAB',
      items: [
        { id: 'simulator', label: 'Simulator', icon: <SplitSquareHorizontal className="h-5 w-5" /> },
        { id: 'defenses', label: 'Defenses', icon: <Shield className="h-5 w-5" />, badge: activeDefenses.length || null },
        { id: 'attacks', label: 'Attacks', icon: <Bug className="h-5 w-5" /> },
        { id: 'documents', label: 'Documents', icon: <FileText className="h-5 w-5" />, badge: documents.length || null },
      ],
    },
    {
      label: 'RESEARCH',
      items: [
        { id: 'testing', label: 'Stress Test', icon: <FlaskConical className="h-5 w-5" /> },
        { id: 'test-traces', label: 'Test Traces', icon: <FileText className="h-5 w-5" /> },
      ],
    },
    {
      label: 'ADMIN',
      labelColor: user.role === 'super_admin' ? '#f59e0b' : '#8b5cf6',
      items: [
        { id: 'users', label: 'Users', icon: <Users className="h-5 w-5" /> },
      ],
    },
  ];

  const userSections: NavSection[] = [
    {
      items: [
        { id: 'chat', label: 'Chat', icon: <MessageSquare className="h-5 w-5" />, badge: messages.length || null },
        { id: 'documents', label: 'Documents', icon: <FileText className="h-5 w-5" />, badge: documents.length || null },
      ],
    },
  ];

  const sections = isAdmin ? adminSections : userSections;

  const renderPage = () => {
    switch (effectivePage) {
      case 'analytics':
        return <AnalyticsPage />;
      case 'simulator':
        return (
          <ComparisonSimulator attacks={attacks} defenses={defenses} documents={documents} />
        );
      case 'chat':
        return (
          <ChatInterface
            messages={messages}
            sessionTitle={activeSession?.title}
            documents={documents}
            activeDocumentIds={(activeSession?.documentIds || []).filter(id => documents.some(d => d.id === id))}
            activeDocumentCount={(activeSession?.documentIds || []).filter(id => documents.some(d => d.id === id)).length}
            onSendMessage={(prompt) => {
              handleSendMessage(prompt);
              setChatSessions(prev => prev.map(s => {
                if (s.id === activeSessionId) {
                  let newTitle = s.title;
                  if (!s.title || s.title === 'New Chat') {
                    newTitle = prompt.substring(0, 30);
                    if (prompt.length > 30) newTitle += '...';
                  }
                  return { ...s, title: newTitle, updatedAt: Date.now() };
                }
                return s;
              }));
            }}
            onUploadDocument={handleUploadDocument}
            onToggleDocument={handleToggleDocumentInChat}
          />
        );
      case 'documents':
        return (
          <DocumentsPage
            documents={documents}
            isLoading={dataLoading}
            onUpload={handleUploadDocument}
            onDelete={handleDeleteDocument}
            onRefresh={handleRefreshDocuments}
            onAttachToChat={handleToggleDocumentInChat}
          />
        );
      case 'attacks':
        return (
          <AttacksPage
            attacks={attacks}
            isLoading={dataLoading}
            onCreateAttack={handleCreateAttack}
            onDeleteAttack={handleDeleteAttack}
          />
        );
      case 'defenses':
        return (
          <DefensesPage
            defenses={defenses}
            activeDefenses={activeDefenses}
            isLoading={dataLoading}
            onToggle={handleToggleDefense}
          />
        );
      case 'testing':
        return <TestingPage documents={documents} />;
      case 'test-traces':
        return <TestTracesPage />;
      case 'users':
        return <UserManagementPage />;
      default:
        return (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground text-sm">Page not found.</p>
          </div>
        );
    }
  };

  return (
    <AppShell
      user={user}
      session={session}
      sections={sections}
      activePage={effectivePage || defaultPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      isConnected={isConnected}
      healthStatus={healthStatus}
      theme={theme}
      setTheme={setTheme}
      onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      currentPageLabel={PAGE_LABELS[effectivePage] ?? 'THRAX'}
      chatSessions={chatSessions}
      activeSessionId={activeSessionId}
      onSelectSession={setActiveSessionId}
      onCreateSession={() => {
        const newSession = { id: generateId(), title: 'New Chat', messages: [], updatedAt: Date.now() };
        setChatSessions([newSession, ...chatSessions]);
        setActiveSessionId(newSession.id);
      }}
      onDeleteSession={(id) => {
        setChatSessions(prev => {
          const filtered = prev.filter(s => s.id !== id);
          if (filtered.length === 0) {
            const newSession = { id: generateId(), title: 'New Chat', messages: [], updatedAt: Date.now() };
            setActiveSessionId(newSession.id);
            return [newSession];
          }
          if (activeSessionId === id) setActiveSessionId(filtered[0].id);
          return filtered;
        });
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div key={effectivePage} {...pageTransitionProps}>
          {renderPage()}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
