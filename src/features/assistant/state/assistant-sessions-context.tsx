import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';

import { INITIAL_ASSISTANT_SESSIONS } from '../data/sessions';
import type { PracticumSession } from '../types';

type AssistantSessionsContextValue = {
  sessions: PracticumSession[];
  openSession: (sessionId: string, note: string) => void;
  closeSession: (sessionId: string) => void;
};

const AssistantSessionsContext = createContext<AssistantSessionsContextValue | null>(null);

export function AssistantSessionsProvider({ children }: PropsWithChildren) {
  const [sessions, setSessions] = useState(INITIAL_ASSISTANT_SESSIONS);

  const value = useMemo<AssistantSessionsContextValue>(() => ({
    sessions,
    openSession: (sessionId, note) => setSessions((current) => current.map((session) => (
      session.id === sessionId && session.status === 'UPCOMING'
        ? { ...session, status: 'OPEN', sessionNote: note.trim() }
        : session
    ))),
    closeSession: (sessionId) => setSessions((current) => current.map((session) => (
      session.id === sessionId && session.status === 'OPEN'
        ? { ...session, status: 'CLOSED' }
        : session
    ))),
  }), [sessions]);

  return <AssistantSessionsContext.Provider value={value}>{children}</AssistantSessionsContext.Provider>;
}

export function useAssistantSessions() {
  const context = useContext(AssistantSessionsContext);
  if (!context) throw new Error('useAssistantSessions must be used within AssistantSessionsProvider');
  return context;
}
