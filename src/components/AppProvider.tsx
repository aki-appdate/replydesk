"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { aiMode } from "@/lib/ai";
import { createStore } from "@/lib/store";
import type { DataStore } from "@/lib/store/types";
import type { AiSource, Article, Inquiry, Reply, Staff } from "@/lib/types";

// 画面全体で共有する状態：データ・今だれとして使っているか・保存の操作。

type Ctx = {
  ready: boolean;
  error: string | null;
  staff: Staff[];
  articles: Article[];
  inquiries: Inquiry[];
  replies: Reply[];
  me: Staff | null;
  setMe: (id: string) => void;
  storeKind: DataStore["kind"];
  aiSource: AiSource;
  saveReply: (reply: Reply) => Promise<void>;
  resetDemo: () => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);
const ME_KEY = "replydesk:me";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<DataStore | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [meId, setMeId] = useState<string>("a-1");
  const [source, setSource] = useState<AiSource>("sample");
  const [kind, setKind] = useState<DataStore["kind"]>("local");

  const load = useCallback(async () => {
    const store = storeRef.current ?? createStore();
    storeRef.current = store;
    try {
      const data = await store.load();
      setKind(store.kind);
      setSource(aiMode());
      try {
        const saved = localStorage.getItem(ME_KEY);
        if (saved && data.staff.some((s) => s.id === saved)) setMeId(saved);
      } catch {}
      setStaff(data.staff);
      setArticles(data.articles);
      setInquiries(data.inquiries);
      setReplies(data.replies);
      setError(null);
    } catch (e) {
      console.error(e);
      setError("データを読み込めませんでした。時間をおいて再読み込みしてください。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setMe = useCallback((id: string) => {
    setMeId(id);
    try {
      localStorage.setItem(ME_KEY, id);
    } catch {}
  }, []);

  const saveReply = useCallback(
    async (reply: Reply) => {
      const inquiry = inquiries.find((q) => q.id === reply.inquiryId);
      if (!inquiry) return;
      const updated: Inquiry = { ...inquiry, status: reply.kind === "escalated" ? "escalated" : "sent" };
      // 先に画面へ反映し、保存に失敗したら元に戻す
      setInquiries((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setReplies((prev) => [...prev, reply]);
      try {
        await storeRef.current!.saveReply(reply, updated);
      } catch (e) {
        setInquiries((prev) => prev.map((q) => (q.id === inquiry.id ? inquiry : q)));
        setReplies((prev) => prev.filter((r) => r.id !== reply.id));
        throw e;
      }
    },
    [inquiries],
  );

  const resetDemo = useCallback(async () => {
    setReady(false);
    await storeRef.current?.reset();
    await load();
  }, [load]);

  const value = useMemo<Ctx>(
    () => ({
      ready,
      error,
      staff,
      articles,
      inquiries,
      replies,
      me: staff.find((s) => s.id === meId) ?? null,
      setMe,
      storeKind: kind,
      aiSource: source,
      saveReply,
      resetDemo,
    }),
    [ready, error, staff, articles, inquiries, replies, meId, setMe, kind, source, saveReply, resetDemo],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp は AppProvider の中で使ってください");
  return ctx;
}
