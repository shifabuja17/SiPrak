export type SessionStatus = 'UPCOMING' | 'OPEN' | 'CLOSED';

export type AttendanceRecord = {
  userId: string;
  name: string;
  nim: string;
  timestamp: string;
  note: string;
};

export type PracticumSession = {
  id: string;
  practicumName: string;
  moduleTitle: string;
  classRoom: string;
  scheduleTime: string;
  status: SessionStatus;
  sessionNote: string;
  attendances: AttendanceRecord[];
};
