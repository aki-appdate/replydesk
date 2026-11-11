import { getAuth, signInAnonymously } from "firebase/auth";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, writeBatch, type Firestore } from "firebase/firestore";
import type { FirebaseApp } from "firebase/app";
import { toDateKey } from "../dates";
import { createSeedData } from "../seed";
import type { Inquiry, Reply } from "../types";
import { mergeWorkspace, type DataStore, type StatusPatch } from "./types";

// Firebaseが設定されているときの保存先。
// お試しの人ごとに匿名ログインし、workspaces/{uid} の下にだけ書き込む（他人のデータは読めない。firestore.rules参照）。

export class FirestoreStore implements DataStore {
  readonly kind = "firestore" as const;
  private db: Firestore;
  private uid: string | null = null;

  constructor(private app: FirebaseApp) {
    this.db = getFirestore(app);
  }

  private async userId(): Promise<string> {
    if (this.uid) return this.uid;
    const auth = getAuth(this.app);
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    this.uid = user.uid;
    return user.uid;
  }

  async load() {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const ws = await getDoc(wsRef);
    let seedBase: string;
    const savedBase = ws.exists() ? (ws.data().seedBase as string) : null;
    if (savedBase && toDateKey(new Date(savedBase)) === toDateKey(new Date())) {
      seedBase = savedBase;
    } else {
      // 日付が変わったら、お試しの記録ごと作り直す（local.ts と同じ考え方）
      if (savedBase) await this.reset();
      seedBase = new Date().toISOString();
      await setDoc(wsRef, { seedBase });
    }
    const [replySnap, patchSnap] = await Promise.all([getDocs(collection(wsRef, "replies")), getDocs(collection(wsRef, "statusPatches"))]);
    return mergeWorkspace(
      createSeedData(new Date(seedBase)),
      replySnap.docs.map((d) => d.data() as Reply),
      patchSnap.docs.map((d) => d.data() as StatusPatch),
    );
  }

  async saveReply(reply: Reply, inquiry: Inquiry) {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const batch = writeBatch(this.db);
    batch.set(doc(wsRef, "replies", reply.id), reply);
    batch.set(doc(wsRef, "statusPatches", inquiry.id), { id: inquiry.id, status: inquiry.status } satisfies StatusPatch);
    await batch.commit();
  }

  async reset() {
    const uid = await this.userId();
    const wsRef = doc(this.db, "workspaces", uid);
    const [replySnap, patchSnap] = await Promise.all([getDocs(collection(wsRef, "replies")), getDocs(collection(wsRef, "statusPatches"))]);
    const batch = writeBatch(this.db);
    replySnap.docs.forEach((d) => batch.delete(d.ref));
    patchSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    await deleteDoc(wsRef);
  }
}
