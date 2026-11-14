import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

export interface PracticumClass {
  id: string;
  nama: string;
  kode: string;
  deskripsi: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  createdBy: string;
}

export interface ClassInput {
  nama: string;
  kode: string;
  deskripsi: string;
}

const classesRef = collection(db, 'classes');

// Validasi dan merapikan input sebelum disimpan.
function validateClassInput(input: ClassInput): ClassInput {
  const nama = input.nama.trim();
  const kode = input.kode.trim().toUpperCase();
  const deskripsi = input.deskripsi.trim();

  if (!nama) {
    throw new Error('Nama kelas wajib diisi.');
  }

  if (nama.length < 3 || nama.length > 100) {
    throw new Error('Nama kelas harus terdiri dari 3–100 karakter.');
  }

  if (!kode) {
    throw new Error('Kode kelas wajib diisi.');
  }

  if (!/^[A-Z0-9_-]{2,20}$/.test(kode)) {
    throw new Error(
      'Kode kelas hanya boleh berisi huruf, angka, garis bawah, atau tanda hubung (2–20 karakter).'
    );
  }

  if (deskripsi.length > 300) {
    throw new Error('Deskripsi maksimal 300 karakter.');
  }

  return { nama, kode, deskripsi };
}

// Mencegah penggunaan kode kelas yang sama.
async function checkDuplicateCode(
  kode: string,
  excludedId?: string
): Promise<void> {
  const duplicateQuery = query(
    classesRef,
    where('kode', '==', kode)
  );

  const snapshot = await getDocs(duplicateQuery);

  const isDuplicate = snapshot.docs.some(
    (item) => item.id !== excludedId
  );

  if (isDuplicate) {
    throw new Error('Kode kelas sudah digunakan.');
  }
}

// READ: Mendengarkan perubahan data kelas secara real-time.
export function subscribeClasses(
  onData: (classes: PracticumClass[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const classQuery = query(
    classesRef,
    orderBy('nama', 'asc')
  );

  return onSnapshot(
    classQuery,
    (snapshot) => {
      const classes: PracticumClass[] = snapshot.docs.map(
        (item) => {
          const data = item.data();

          return {
            id: item.id,
            nama: data.nama,
            kode: data.kode,
            deskripsi: data.deskripsi ?? '',
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
            createdBy: data.createdBy,
          };
        }
      );

      onData(classes);
    },
    (error) => {
      onError(error);
    }
  );
}

// CREATE: Menambahkan kelas baru.
export async function createClass(
  input: ClassInput,
  createdBy: string
): Promise<string> {
  if (!createdBy.trim()) {
    throw new Error('Identitas asisten tidak ditemukan.');
  }

  const validInput = validateClassInput(input);

  await checkDuplicateCode(validInput.kode);

  const newClass = await addDoc(classesRef, {
    ...validInput,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  });

  return newClass.id;
}

// UPDATE: Mengubah informasi kelas.
export async function updateClass(
  classId: string,
  input: ClassInput
): Promise<void> {
  if (!classId.trim()) {
    throw new Error('ID kelas tidak valid.');
  }

  const validInput = validateClassInput(input);

  await checkDuplicateCode(validInput.kode, classId);

  await updateDoc(doc(db, 'classes', classId), {
    ...validInput,
    updatedAt: serverTimestamp(),
  });
}

// DELETE: Menghapus kelas jika belum memiliki relasi data.
export async function deleteClass(
  classId: string
): Promise<void> {
  if (!classId.trim()) {
    throw new Error('ID kelas tidak valid.');
  }

  const membersRef = collection(
    db,
    'classes',
    classId,
    'members'
  );

  const schedulesQuery = query(
    collection(db, 'schedules'),
    where('classId', '==', classId)
  );

  const [membersSnapshot, schedulesSnapshot] =
    await Promise.all([
      getDocs(membersRef),
      getDocs(schedulesQuery),
    ]);

  if (!membersSnapshot.empty) {
    throw new Error(
      'Kelas tidak dapat dihapus karena masih memiliki peserta. Hapus atau pindahkan peserta terlebih dahulu.'
    );
  }

  if (!schedulesSnapshot.empty) {
    throw new Error(
      'Kelas tidak dapat dihapus karena masih memiliki jadwal praktikum.'
    );
  }

  await deleteDoc(doc(db, 'classes', classId));
}