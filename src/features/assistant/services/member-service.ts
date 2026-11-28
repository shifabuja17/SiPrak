import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { ROLES, isPraktikanRole } from '@/types/user';

// Data peserta yang sudah menjadi anggota kelas.
export interface PracticumMember {
  uid: string;
  nama: string;
  nim: string | null;
  joinedAt: Timestamp | null;
}

// Data praktikan yang tersedia untuk ditambahkan ke kelas.
export interface AvailablePraktikan {
  uid: string;
  nama: string;
  nim: string | null;
  email: string;
}

// READ: Mengambil seluruh akun yang memiliki role praktikan.
export function subscribeAvailablePraktikan(
  onData: (users: AvailablePraktikan[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const usersQuery = query(
    collection(db, 'users'),
    where('role', 'in', ['praktikan', ROLES.PRAKTIKAN])
  );

  return onSnapshot(
    usersQuery,
    (snapshot) => {
      const users: AvailablePraktikan[] =
        snapshot.docs.map((item) => {
          const data = item.data();

          return {
            uid: item.id,
            nama: data.nama ?? '',
            nim: data.nim ?? null,
            email: data.email ?? '',
          };
        });

      users.sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id')
      );

      onData(users);
    },
    onError
  );
}

// READ: Mengambil anggota dari kelas tertentu secara real-time.
export function subscribeClassMembers(
  classId: string,
  onData: (members: PracticumMember[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  if (!classId.trim()) {
    throw new Error('ID kelas tidak valid.');
  }

  const membersRef = collection(
    db,
    'classes',
    classId,
    'members'
  );

  return onSnapshot(
    membersRef,
    (snapshot) => {
      const members: PracticumMember[] =
        snapshot.docs.map((item) => {
          const data = item.data();

          return {
            uid: item.id,
            nama: data.nama ?? '',
            nim: data.nim ?? null,
            joinedAt: data.joinedAt ?? null,
          };
        });

      members.sort((a, b) =>
        a.nama.localeCompare(b.nama, 'id')
      );

      onData(members);
    },
    onError
  );
}

// CREATE: Menambahkan praktikan ke dalam kelas.
export async function addMember(
  classId: string,
  uid: string
): Promise<void> {
  if (!classId.trim() || !uid.trim()) {
    throw new Error('Identitas kelas atau praktikan tidak valid.');
  }

  const classRef = doc(db, 'classes', classId);
  const userRef = doc(db, 'users', uid);

  const memberRef = doc(
    db,
    'classes',
    classId,
    'members',
    uid
  );

  await runTransaction(db, async (transaction) => {
    // Membaca semua dokumen sebelum melakukan penulisan.
    const [classSnapshot, userSnapshot, memberSnapshot] =
      await Promise.all([
        transaction.get(classRef),
        transaction.get(userRef),
        transaction.get(memberRef),
      ]);

    if (!classSnapshot.exists()) {
      throw new Error('Kelas tidak ditemukan.');
    }

    if (!userSnapshot.exists()) {
      throw new Error('Akun praktikan tidak ditemukan.');
    }

    const userData = userSnapshot.data();

    if (!isPraktikanRole(userData.role)) {
      throw new Error('Akun yang dipilih bukan praktikan.');
    }

    if (memberSnapshot.exists()) {
      throw new Error(
        'Praktikan sudah terdaftar di kelas ini.'
      );
    }

    transaction.set(memberRef, {
      uid,
      nama: userData.nama,
      nim: userData.nim ?? null,
      joinedAt: serverTimestamp(),
    });
  });
}

// UPDATE: Memindahkan praktikan dari kelas lama ke kelas baru.
export async function moveMemberToClass(
  sourceClassId: string,
  targetClassId: string,
  uid: string
): Promise<void> {
  if (
    !sourceClassId.trim() ||
    !targetClassId.trim() ||
    !uid.trim()
  ) {
    throw new Error('Data kelas atau praktikan tidak valid.');
  }

  if (sourceClassId === targetClassId) {
    throw new Error('Praktikan sudah berada di kelas tersebut.');
  }

  const sourceClassRef = doc(db, 'classes', sourceClassId);
  const targetClassRef = doc(db, 'classes', targetClassId);
  const userRef = doc(db, 'users', uid);

  const sourceMemberRef = doc(
    db,
    'classes',
    sourceClassId,
    'members',
    uid
  );

  const targetMemberRef = doc(
    db,
    'classes',
    targetClassId,
    'members',
    uid
  );

  await runTransaction(db, async (transaction) => {
    const [
      sourceClassSnapshot,
      targetClassSnapshot,
      userSnapshot,
      sourceMemberSnapshot,
      targetMemberSnapshot,
    ] = await Promise.all([
      transaction.get(sourceClassRef),
      transaction.get(targetClassRef),
      transaction.get(userRef),
      transaction.get(sourceMemberRef),
      transaction.get(targetMemberRef),
    ]);

    if (
      !sourceClassSnapshot.exists() ||
      !targetClassSnapshot.exists()
    ) {
      throw new Error('Kelas asal atau tujuan tidak ditemukan.');
    }

    if (!userSnapshot.exists()) {
      throw new Error('Akun praktikan tidak ditemukan.');
    }

    if (!isPraktikanRole(userSnapshot.data().role)) {
      throw new Error('Akun tersebut bukan praktikan.');
    }

    if (!sourceMemberSnapshot.exists()) {
      throw new Error('Praktikan tidak terdaftar di kelas asal.');
    }

    if (targetMemberSnapshot.exists()) {
      throw new Error('Praktikan sudah terdaftar di kelas tujuan.');
    }

    const userData = userSnapshot.data();

    // Menambahkan ke kelas tujuan.
    transaction.set(targetMemberRef, {
      uid,
      nama: userData.nama,
      nim: userData.nim ?? null,
      joinedAt: serverTimestamp(),
    });

    // Menghapus dari kelas asal dalam transaksi yang sama.
    transaction.delete(sourceMemberRef);
  });
}

// DELETE: Mengeluarkan praktikan dari kelas.
export async function removeMember(
  classId: string,
  uid: string
): Promise<void> {
  if (!classId.trim() || !uid.trim()) {
    throw new Error('ID kelas atau praktikan tidak valid.');
  }

  const classRef = doc(db, 'classes', classId);

  const memberRef = doc(
    db,
    'classes',
    classId,
    'members',
    uid
  );

  await runTransaction(db, async (transaction) => {
    const [classSnapshot, memberSnapshot] =
      await Promise.all([
        transaction.get(classRef),
        transaction.get(memberRef),
      ]);

    if (!classSnapshot.exists()) {
      throw new Error('Kelas tidak ditemukan.');
    }

    if (!memberSnapshot.exists()) {
      throw new Error('Peserta tidak ditemukan di kelas ini.');
    }

    transaction.delete(memberRef);
  });
}