import type { PracticumSession } from '../types';

/** Temporary fixture following the SRS contract; replace with shared PracticumContext later. */
export const INITIAL_ASSISTANT_SESSIONS: PracticumSession[] = [
  {
    id: 'ses-101',
    practicumName: 'Praktikum Pemrograman Bergerak',
    moduleTitle: 'Pertemuan 1: Pengenalan React Native & Flexbox',
    classRoom: 'Kelas A - Lab Komputasi Dasar',
    scheduleTime: 'Kamis, 08:00 - 10:30 WIB',
    status: 'UPCOMING',
    sessionNote: '',
    attendances: [
      {
        userId: 'prk-1',
        name: 'Andi Pratama',
        nim: '24060123120001',
        timestamp: '08:05:12 WIB',
        note: 'Hadir tepat waktu',
      },
    ],
  },
  {
    id: 'ses-102',
    practicumName: 'Praktikum Struktur Data',
    moduleTitle: 'Pertemuan 3: Stack & Queue',
    classRoom: 'Kelas B - Lab Algoritma',
    scheduleTime: 'Jumat, 13:00 - 15:30 WIB',
    status: 'UPCOMING',
    sessionNote: '',
    attendances: [],
  },
];
