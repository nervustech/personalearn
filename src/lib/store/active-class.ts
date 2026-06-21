import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveClass = {
  id: string;
  name: string;
  grade_level: number;
  subject: string;
  section: string | null;
};

type ActiveClassState = {
  activeClass: ActiveClass | null;
  setActiveClass: (activeClass: ActiveClass | null) => void;
  clearActiveClass: () => void;
};

export const useActiveClassStore = create<ActiveClassState>()(
  persist(
    (set) => ({
      activeClass: null,
      setActiveClass: (activeClass) => set({ activeClass }),
      clearActiveClass: () => set({ activeClass: null }),
    }),
    {
      name: "personalearn-active-class",
    }
  )
);
