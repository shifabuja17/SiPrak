import type { PracticumSession } from '../types';

/** Data sementara untuk kebutuhan tampilan Asisten. */
export const INITIAL_ASSISTANT_SESSIONS: PracticumSession[] = [
  {
    id: 'ses-101',
    practicumName: 'Praktikum Pemrograman Bergerak',
    moduleTitle: 'Pertemuan 1: Pengenalan React Native & Flexbox',
    classRoom: 'Kelas A - Lab Komputasi Dasar',
    scheduleTime: 'Kamis, 08:00 - 10:30 WIB',
    status: 'dibuka',
    sessionNote: '',
    attendances: [
      {
        uid: 'prk-1',
        nama: 'Andi Pratama',
        waktu: '08:05:12 WIB',
      },
    ],
  },
  {
    id: 'ses-102',
    practicumName: 'Praktikum Struktur Data',
    moduleTitle: 'Pertemuan 3: Stack & Queue',
    classRoom: 'Kelas B - Lab Algoritma',
    scheduleTime: 'Jumat, 13:00 - 15:30 WIB',
    status: 'dijadwalkan',
    sessionNote: '',
    attendances: [],
  },
];