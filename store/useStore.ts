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
} from "@/lib/mockData";

interface AppState {
  // Animals
  animals: Animal[];
  addAnimal: (animal: Omit<Animal, "id">) => void;
  updateAnimal: (id: string, updates: Partial<Animal>) => void;
  removeAnimal: (id: string) => void;

  // Treatments
  treatments: Treatment[];
  addTreatment: (treatment: Omit<Treatment, "id">) => void;

  // Sales
  sales: Sale[];
  addSale: (sale: Omit<Sale, "id">) => void;

  // Costs
  costs: Cost[];
  addCost: (cost: Omit<Cost, "id">) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useStore = create<AppState>((set) => ({
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
      animals: state.animals.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  removeAnimal: (id) =>
    set((state) => ({
      animals: state.animals.filter((a) => a.id !== id),
    })),

  treatments: mockTreatments,
  addTreatment: (treatment) =>
    set((state) => ({
      treatments: [
        ...state.treatments,
        { ...treatment, id: `T${state.treatments.length + 1}` },
      ],
    })),

  sales: mockSales,
  addSale: (sale) =>
    set((state) => ({
      sales: [
        ...state.sales,
        { ...sale, id: `S${state.sales.length + 1}` },
      ],
    })),

  costs: mockCosts,
  addCost: (cost) =>
    set((state) => ({
      costs: [
        ...state.costs,
        { ...cost, id: `C${state.costs.length + 1}` },
      ],
    })),

  sidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
