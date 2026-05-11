import { create } from "zustand";
import {
  animals as mockAnimals,
  Animal,
  treatments as mockTreatments,
  Treatment,
  sales as mockSales,
  Sale,
  costs as mockCosts,
  Cost,
  modules as mockModules,
  Module,
  feedTypes as mockFeedTypes,
  FeedType,
  healthAlerts as mockHealthAlerts,
  HealthAlert,
} from "@/lib/mockData";

export interface AppState {
  // Animals
  animals: Animal[];
  addAnimal: (animal: Omit<Animal, "id">) => void;
  updateAnimal: (id: string, updates: Partial<Animal>) => void;
  removeAnimal: (id: string) => void;

  // Modules
  modules: Module[];
  addModule: (module: Omit<Module, "id">) => void;
  updateModule: (id: string, updates: Partial<Module>) => void;
  removeModule: (id: string) => void;

  // Treatments
  treatments: Treatment[];
  addTreatment: (treatment: Omit<Treatment, "id">) => void;
  updateTreatment: (id: string, updates: Partial<Treatment>) => void;
  removeTreatment: (id: string) => void;

  // Sales
  sales: Sale[];
  addSale: (sale: Omit<Sale, "id">) => void;
  updateSale: (id: string, updates: Partial<Sale>) => void;
  removeSale: (id: string) => void;

  // Costs
  costs: Cost[];
  addCost: (cost: Omit<Cost, "id">) => void;
  updateCost: (id: string, updates: Partial<Cost>) => void;
  removeCost: (id: string) => void;

  // Feed types
  feedTypes: FeedType[];
  addFeedType: (feed: Omit<FeedType, "id">) => void;
  updateFeedType: (id: string, updates: Partial<FeedType>) => void;
  removeFeedType: (id: string) => void;

  // Health alerts
  healthAlerts: HealthAlert[];
  addHealthAlert: (alert: Omit<HealthAlert, "id">) => void;
  updateHealthAlert: (id: string, updates: Partial<HealthAlert>) => void;
  removeHealthAlert: (id: string) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>((set) => ({
  // ─── Animals ──────────────────────────────────────────────────────────────
  animals: mockAnimals,
  addAnimal: (animal) =>
    set((state) => ({
      animals: [
        ...state.animals,
        { ...animal, id: String(state.animals.length + 1) },
      ],
    })),
  updateAnimal: (id, updates) =>
    set((state) => ({
      animals: state.animals.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  removeAnimal: (id) =>
    set((state) => ({ animals: state.animals.filter((a) => a.id !== id) })),

  // ─── Modules ──────────────────────────────────────────────────────────────
  modules: mockModules,
  addModule: (module) =>
    set((state) => ({
      modules: [
        ...state.modules,
        { ...module, id: `M${state.modules.length + 1}` },
      ],
    })),
  updateModule: (id, updates) =>
    set((state) => ({
      modules: state.modules.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    })),
  removeModule: (id) =>
    set((state) => ({ modules: state.modules.filter((m) => m.id !== id) })),

  // ─── Treatments ───────────────────────────────────────────────────────────
  treatments: mockTreatments,
  addTreatment: (treatment) =>
    set((state) => ({
      treatments: [
        ...state.treatments,
        { ...treatment, id: `T${state.treatments.length + 1}` },
      ],
    })),
  updateTreatment: (id, updates) =>
    set((state) => ({
      treatments: state.treatments.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  removeTreatment: (id) =>
    set((state) => ({ treatments: state.treatments.filter((t) => t.id !== id) })),

  // ─── Sales ────────────────────────────────────────────────────────────────
  sales: mockSales,
  addSale: (sale) =>
    set((state) => ({
      sales: [
        ...state.sales,
        { ...sale, id: `S${state.sales.length + 1}` },
      ],
    })),
  updateSale: (id, updates) =>
    set((state) => ({
      sales: state.sales.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),
  removeSale: (id) =>
    set((state) => ({ sales: state.sales.filter((s) => s.id !== id) })),

  // ─── Costs ────────────────────────────────────────────────────────────────
  costs: mockCosts,
  addCost: (cost) =>
    set((state) => ({
      costs: [
        ...state.costs,
        { ...cost, id: `C${state.costs.length + 1}` },
      ],
    })),
  updateCost: (id, updates) =>
    set((state) => ({
      costs: state.costs.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeCost: (id) =>
    set((state) => ({ costs: state.costs.filter((c) => c.id !== id) })),

  // ─── Feed Types ───────────────────────────────────────────────────────────
  feedTypes: mockFeedTypes,
  addFeedType: (feed) =>
    set((state) => ({
      feedTypes: [
        ...state.feedTypes,
        { ...feed, id: `F${state.feedTypes.length + 1}` },
      ],
    })),
  updateFeedType: (id, updates) =>
    set((state) => ({
      feedTypes: state.feedTypes.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })),
  removeFeedType: (id) =>
    set((state) => ({ feedTypes: state.feedTypes.filter((f) => f.id !== id) })),

  // ─── Health Alerts ────────────────────────────────────────────────────────
  healthAlerts: mockHealthAlerts,
  addHealthAlert: (alert) =>
    set((state) => ({
      healthAlerts: [
        ...state.healthAlerts,
        { ...alert, id: `A${state.healthAlerts.length + 1}` },
      ],
    })),
  updateHealthAlert: (id, updates) =>
    set((state) => ({
      healthAlerts: state.healthAlerts.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  removeHealthAlert: (id) =>
    set((state) => ({ healthAlerts: state.healthAlerts.filter((a) => a.id !== id) })),

  // ─── UI ───────────────────────────────────────────────────────────────────
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
