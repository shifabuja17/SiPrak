export type Role = "praktikan" | "asisten";

export interface UserProfile {
  uid: string;
  nama: string;
  email: string;
  nim: string | null;
  role: Role;
}