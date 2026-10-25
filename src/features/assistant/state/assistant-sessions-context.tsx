import { createContext, PropsWithChildren, useContext, useMemo } from 'react';

import { usePracticum } from '@/context/PracticumContext';
import type { PracticumSession } from '../types';

type AssistantSessionsContextValue = {
  sessions: PracticumSession[];
  openSession: (sessionId: string, note: string) => void;
  closeSession: (sessionId: string) => void;
};

const AssistantSessionsContext = createContext<AssistantSessionsContextValue | null>(null);

export function AssistantSessionsProvider({ children }: PropsWithChildren) {
  const practicum = usePracticum();

  const value = useMemo<AssistantSessionsContextValue>(() => ({
    sessions: practicum.sessions as unknown as PracticumSession[],
    openSession: practicum.openSession,
    closeSession: practicum.closeSession,
  }), [practicum.sessions, practicum.openSession, practicum.closeSession]);

  return <AssistantSessionsContext.Provider value={value}>{children}</AssistantSessionsContext.Provider>;
}

export function useAssistantSessions() {
  const context = useContext(AssistantSessionsContext);
  if (!context) throw new Error('useAssistantSessions must be used within AssistantSessionsProvider');
  return context;
}
