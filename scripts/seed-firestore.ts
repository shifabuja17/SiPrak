/**
 * Reset + seed data praktikum SiPrak di Cloud Firestore (khusus data uji).
 *
 * Mengosongkan: classes (+members), schedules, sessions (+attendance),
 * leaveRequests, laboratories. Collection `users` TIDAK disentuh.
 *
 * Pemakaian (dari root proyek):
 *   npx tsx scripts/seed-firestore.ts \
 *     --key ../siprak-service-account.json \
 *     --asisten asisten@contoh.com \
 *     --praktikan p1@contoh.com,p2@contoh.com
 *
 * Tanpa `--apply` script hanya menampilkan rencana (dry run, tidak menulis apa pun).
 * Tambahkan `--apply` untuk benar-benar menghapus dan mengisi ulang data.
 *
 * Akun harus sudah ada di Firebase Authentication dan punya profil `users/{uid}`
 * dengan role yang sesuai. Script tidak membuat atau mengubah akun.
 *
 * Kunci service account memberi akses penuh ke database: simpan di luar repo
 * dan jangan pernah di-commit.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type Firestore,
} from 'firebase-admin/firestore';

// ==========================================
// DATA ACUAN
// ==========================================

const COLLECTIONS_TO_RESET = [
  'classes',
  'schedules',
  'sessions',
  'leaveRequests',
  'laboratories',
] as const;

const PROTECTED_COLLECTIONS = ['users'];

/** Sama dengan DEFAULT_LABORATORIES di src/features/assistant/services/laboratory-service.ts. */
const LABORATORIES = [
  { id: 'lab-b-informatika', name: 'Lab B Informatika', latitude: -7.0482375, longitude: 110.440765625 },
  { id: 'lab-c-informatika', name: 'Lab C Informatika', latitude: -7.0482375, longitude: 110.440765625 },
  { id: 'lab-d-informatika', name: 'Lab D Informatika', latitude: -7.0482375, longitude: 110.440765625 },
  { id: 'lab-gedung-ap', name: 'Lab Gedung AP', latitude: -7.04835, longitude: 110.44125 },
] as const;

const DEFAULT_RADIUS = 50;

type LabId = (typeof LABORATORIES)[number]['id'];

// ==========================================
// ARGUMEN
// ==========================================

interface Options {
  keyPath: string;
  asistenEmail: string;
  praktikanEmails: string[];
  apply: boolean;
}

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith('--') ? value : undefined;
}

function parseOptions(): Options {
  const keyPath = readArg('key') ?? process.env.FIREBASE_SERVICE_ACCOUNT;
  const asistenEmail = readArg('asisten');
  const praktikanEmails = (readArg('praktikan') ?? '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);

  const missing: string[] = [];
  if (!keyPath) missing.push('--key <path service account json>');
  if (!asistenEmail) missing.push('--asisten <email>');
  if (praktikanEmails.length === 0) missing.push('--praktikan <email1,email2>');

  if (missing.length > 0) {
    fail(`Argumen kurang: ${missing.join(', ')}\nLihat petunjuk di bagian atas scripts/seed-firestore.ts.`);
  }

  return {
    keyPath: resolve(keyPath!),
    asistenEmail: asistenEmail!,
    praktikanEmails,
    apply: process.argv.includes('--apply'),
  };
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// ==========================================
// WAKTU (WIB)
// ==========================================

/** Tanggal hari ini di WIB dalam format YYYY-MM-DD, digeser `offsetDays`. */
function wibDate(offsetDays: number): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000); // geser ke WIB
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return now.toISOString().slice(0, 10);
}

function wib(date: string, time: string): Timestamp {
  return Timestamp.fromDate(new Date(`${date}T${time}:00+07:00`));
}

/** Jam bulat terdekat sebelum sekarang (WIB), mis. "13:00". */
function currentWibHour(): number {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).getUTCHours();
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function dayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T12:00:00+07:00`).getUTCDay()];
}

function scheduleText(date: string, start: string, end: string): string {
  return `${dayName(date)}, ${start.replace(':', '.')} - ${end.replace(':', '.')} WIB`;
}

// ==========================================
// AKUN
// ==========================================

interface Account {
  uid: string;
  email: string;
  nama: string;
  nim: string | null;
  role: string;
}

async function loadAccount(db: Firestore, email: string, expectedRole: string): Promise<Account> {
  let uid: string;
  try {
    uid = (await getAuth().getUserByEmail(email)).uid;
  } catch {
    fail(`Akun ${email} tidak ditemukan di Firebase Authentication.`);
  }

  const profile = await db.collection('users').doc(uid).get();
  if (!profile.exists) {
    fail(`Akun ${email} belum punya profil users/${uid}. Login sekali lewat aplikasi atau buat profilnya dulu.`);
  }

  const data = profile.data()!;
  if (data.role !== expectedRole) {
    fail(`Akun ${email} ber-role "${String(data.role)}", seharusnya "${expectedRole}".`);
  }

  return {
    uid,
    email,
    nama: typeof data.nama === 'string' && data.nama.trim() ? data.nama.trim() : email,
    nim: typeof data.nim === 'string' && data.nim.trim() ? data.nim.trim() : null,
    role: data.role,
  };
}

// ==========================================
// RESET
// ==========================================

async function resetCollections(db: Firestore, apply: boolean) {
  for (const name of COLLECTIONS_TO_RESET) {
    const ref = db.collection(name);
    const count = (await ref.count().get()).data().count;
    console.log(`  - ${name}: ${count} dokumen${count > 0 ? ' (beserta subcollection)' : ''}`);
    if (apply && count > 0) {
      await db.recursiveDelete(ref);
    }
  }

  const known = new Set<string>([...COLLECTIONS_TO_RESET, ...PROTECTED_COLLECTIONS]);
  const others = (await db.listCollections())
    .map((ref) => ref.id)
    .filter((id) => !known.has(id));
  if (others.length > 0) {
    console.log(`  ! Collection lain dibiarkan (tidak dikenal script): ${others.join(', ')}`);
  }
}

// ==========================================
// SEED
// ==========================================

async function seed(db: Firestore, asisten: Account, praktikan: Account[], apply: boolean) {
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();
  const summary: string[] = [];

  // --- Laboratorium (FR-09 s.d. FR-12) ---
  for (const lab of LABORATORIES) {
    batch.set(db.collection('laboratories').doc(lab.id), {
      ...lab,
      radius: DEFAULT_RADIUS,
      updatedAt: now,
    });
  }
  summary.push(`${LABORATORIES.length} laboratorium`);

  // --- Kelas + anggota ---
  const classes = [
    { key: 'pm', nama: 'Pembelajaran Mesin A', kode: 'PM-A', deskripsi: 'Kelas praktikum Pembelajaran Mesin.' },
    { key: 'ppb', nama: 'Pemrograman Perangkat Bergerak A', kode: 'PPB-A', deskripsi: 'Kelas praktikum Pemrograman Perangkat Bergerak.' },
  ];
  const classIds: Record<string, string> = {};
  for (const item of classes) {
    const ref = db.collection('classes').doc();
    classIds[item.key] = ref.id;
    batch.set(ref, {
      nama: item.nama,
      kode: item.kode,
      deskripsi: item.deskripsi,
      createdBy: asisten.uid,
      createdAt: now,
      updatedAt: now,
    });
    for (const member of praktikan) {
      batch.set(ref.collection('members').doc(member.uid), {
        uid: member.uid,
        nama: member.nama,
        nim: member.nim,
        joinedAt: now,
      });
    }
  }
  summary.push(`${classes.length} kelas, masing-masing ${praktikan.length} anggota`);

  // --- Jadwal ---
  const today = wibDate(0);
  const schedules = [
    {
      key: 'pm',
      classKey: 'pm',
      practicumName: 'Praktikum Pembelajaran Mesin',
      moduleTitle: 'Modul 3: Regresi Linear',
      lab: 'lab-b-informatika' as LabId,
      start: '07:00',
      end: '09:00',
      day: wibDate(-7),
    },
    {
      key: 'ppb',
      classKey: 'ppb',
      practicumName: 'Praktikum Pemrograman Perangkat Bergerak',
      moduleTitle: 'Modul 5: Maps dan Geolocation',
      lab: 'lab-c-informatika' as LabId,
      start: '13:00',
      end: '15:30',
      day: wibDate(2),
    },
  ];
  const scheduleIds: Record<string, string> = {};
  for (const item of schedules) {
    const ref = db.collection('schedules').doc();
    scheduleIds[item.key] = ref.id;
    batch.set(ref, {
      classId: classIds[item.classKey],
      practicumName: item.practicumName,
      moduleTitle: item.moduleTitle,
      classRoom: LABORATORIES.find((lab) => lab.id === item.lab)!.name,
      scheduleTime: scheduleText(item.day, item.start, item.end),
      createdBy: asisten.uid,
      createdAt: now,
      updatedAt: now,
    });
  }
  summary.push(`${schedules.length} jadwal`);

  // --- Sesi: satu tiap status supaya semua alur bisa langsung diuji ---
  const hour = currentWibHour();
  const openStart = `${pad(hour)}:00`;
  const openEnd = `${pad(Math.min(hour + 2, 23))}:${hour + 2 > 23 ? '59' : '00'}`;

  const sessions = [
    {
      key: 'closed',
      schedule: schedules[0],
      moduleTitle: 'Modul 2: Eksplorasi Data',
      lab: 'lab-b-informatika' as LabId,
      date: wibDate(-7),
      start: '07:00',
      end: '09:00',
      status: 'ditutup',
      note: 'Sesi minggu lalu.',
    },
    {
      key: 'open',
      schedule: schedules[0],
      moduleTitle: 'Modul 3: Regresi Linear',
      lab: 'lab-b-informatika' as LabId,
      date: today,
      start: openStart,
      end: openEnd,
      status: 'dibuka',
      note: 'Sesi sedang berlangsung, silakan presensi dari laboratorium.',
    },
    {
      key: 'upcoming',
      schedule: schedules[0],
      moduleTitle: 'Modul 4: Klasifikasi',
      lab: 'lab-d-informatika' as LabId,
      date: wibDate(7),
      start: '07:00',
      end: '09:00',
      status: 'dijadwalkan',
      note: 'Bawa laptop dengan Python terpasang.',
    },
    {
      key: 'ppb-upcoming',
      schedule: schedules[1],
      moduleTitle: 'Modul 5: Maps dan Geolocation',
      lab: 'lab-gedung-ap' as LabId,
      date: wibDate(2),
      start: '13:00',
      end: '15:30',
      status: 'dijadwalkan',
      note: '',
    },
  ];
  const sessionIds: Record<string, string> = {};
  for (const item of sessions) {
    const lab = LABORATORIES.find((entry) => entry.id === item.lab)!;
    const ref = db.collection('sessions').doc();
    sessionIds[item.key] = ref.id;
    const waktuMulai = wib(item.date, item.start);
    batch.set(ref, {
      scheduleId: scheduleIds[item.schedule.key],
      classId: classIds[item.schedule.classKey],
      labId: lab.id,
      labName: lab.name,
      practicumName: item.schedule.practicumName,
      moduleTitle: item.moduleTitle,
      classRoom: lab.name,
      scheduleTime: scheduleText(item.date, item.start, item.end),
      waktuMulai,
      waktuSelesai: wib(item.date, item.end),
      status: item.status,
      sessionNote: item.note,
      createdBy: asisten.uid,
      createdAt: now,
      updatedAt: now,
      ...(item.status !== 'dijadwalkan' ? { openedAt: waktuMulai } : {}),
      ...(item.status === 'ditutup' ? { closedAt: wib(item.date, item.end) } : {}),
    });
  }
  summary.push(`${sessions.length} sesi (ditutup, dibuka, 2 dijadwalkan)`);

  // --- Presensi contoh di sesi yang sudah ditutup ---
  const closedLab = LABORATORIES[0];
  batch.set(
    db.collection('sessions').doc(sessionIds.closed).collection('attendance').doc(praktikan[0].uid),
    {
      uid: praktikan[0].uid,
      nama: praktikan[0].nama,
      waktu: wib(sessions[0].date, '07:10'),
      labId: closedLab.id,
      latitude: closedLab.latitude + 0.0001,
      longitude: closedLab.longitude,
      jarak: 11.1,
    },
  );
  summary.push(`1 presensi contoh (${praktikan[0].nama}, sesi ditutup)`);

  // --- Pengajuan izin contoh (menunggu keputusan) ---
  const izinOwner = praktikan[praktikan.length - 1];
  const izinSession = sessionIds.upcoming;
  batch.set(db.collection('leaveRequests').doc(`${izinSession}_${izinOwner.uid}`), {
    uid: izinOwner.uid,
    nama: izinOwner.nama,
    sessionId: izinSession,
    alasan: 'Saya demam tinggi dan perlu berobat ke klinik pada hari tersebut.',
    kategoriAI: 'Sakit',
    status: 'menunggu',
    createdAt: now,
  });
  summary.push(`1 pengajuan izin menunggu (${izinOwner.nama})`);

  for (const line of summary) console.log(`  + ${line}`);

  if (apply) {
    await batch.commit();
  }
}

// ==========================================
// MAIN
// ==========================================

async function main() {
  const options = parseOptions();

  if (!existsSync(options.keyPath)) {
    fail(`File service account tidak ditemukan: ${options.keyPath}`);
  }
  const serviceAccount = JSON.parse(readFileSync(options.keyPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  console.log(`\nProject Firebase : ${serviceAccount.project_id}`);
  console.log(`Mode             : ${options.apply ? 'APPLY (menulis ke database)' : 'DRY RUN (tidak menulis apa pun)'}`);

  console.log('\nMemeriksa akun...');
  const asisten = await loadAccount(db, options.asistenEmail, 'asisten');
  const praktikan: Account[] = [];
  for (const email of options.praktikanEmails) {
    praktikan.push(await loadAccount(db, email, 'praktikan'));
  }
  console.log(`  Asisten   : ${asisten.nama} <${asisten.email}>`);
  for (const p of praktikan) console.log(`  Praktikan : ${p.nama} <${p.email}>`);

  console.log(`\n${options.apply ? 'Menghapus' : 'Akan menghapus'} (users tidak disentuh):`);
  await resetCollections(db, options.apply);

  console.log(`\n${options.apply ? 'Mengisi' : 'Akan mengisi'}:`);
  await seed(db, asisten, praktikan, options.apply);

  console.log(
    options.apply
      ? '\n✔ Selesai. Data uji sudah terisi.\n'
      : '\nDry run selesai. Jalankan ulang dengan --apply untuk menerapkan.\n',
  );
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
