"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

type NotificationsState = {
  items: AppNotification[];
  add: (item: Omit<AppNotification, "id" | "createdAt" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
};

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => ({
          items: [
            {
              ...item,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...state.items,
          ].slice(0, 50),
        })),
      markRead: (id) =>
        set((state) => ({
          items: state.items.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),
      markAllRead: () =>
        set((state) => ({
          items: state.items.map((n) => ({ ...n, read: true })),
        })),
      clear: () => set({ items: [] }),
    }),
    { name: "personalearn-notifications" }
  )
);
