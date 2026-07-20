"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

type NotificationsState = {
  items: AppNotification[];
  add: (item: Omit<AppNotification, "id" | "createdAt">) => void;
  /** Remove after click-through or explicit close. */
  dismiss: (id: string) => void;
  dismissAll: () => void;
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
            },
            ...state.items,
          ].slice(0, 20),
        })),
      dismiss: (id) =>
        set((state) => ({
          items: state.items.filter((n) => n.id !== id),
        })),
      dismissAll: () => set({ items: [] }),
    }),
    { name: "personalearn-notifications" }
  )
);
