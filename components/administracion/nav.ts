import type { LucideIcon } from "lucide-react";
import {
  Beef,
  Grid3X3,
  Layers,
  Tag,
  Warehouse,
} from "lucide-react";

export type AdminSectionId =
  | "razas"
  | "categorias"
  | "corrales"
  | "estados"
  | "lotes";

export type AdminNavItem = {
  id: AdminSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Si false, se muestra como “próximamente”. */
  available: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "catalogos",
    label: "Catálogos ganaderos",
    items: [
      {
        id: "razas",
        label: "Razas",
        description: "Agregar y renombrar razas del inventario.",
        icon: Beef,
        available: true,
      },
      {
        id: "categorias",
        label: "Categorías",
        description: "Ternero, novillo, toro y rangos de peso.",
        icon: Layers,
        available: false,
      },
      {
        id: "estados",
        label: "Estados de animal",
        description: "Activo, enfermo, vendido y bajas.",
        icon: Tag,
        available: false,
      },
    ],
  },
  {
    id: "finca",
    label: "Finca y operación",
    items: [
      {
        id: "corrales",
        label: "Tipos de corral",
        description: "Clasificación operativa de módulos.",
        icon: Warehouse,
        available: false,
      },
      {
        id: "lotes",
        label: "Lotes",
        description: "Lotes de engorda y capacidad.",
        icon: Grid3X3,
        available: false,
      },
    ],
  },
];

export const DEFAULT_ADMIN_SECTION: AdminSectionId = "razas";

export function findAdminSection(id: string | null | undefined): AdminNavItem {
  const flat = ADMIN_NAV_GROUPS.flatMap((g) => g.items);
  const found = flat.find((i) => i.id === id);
  if (found) return found;
  return flat.find((i) => i.id === DEFAULT_ADMIN_SECTION)!;
}

export function isAdminSectionId(value: string): value is AdminSectionId {
  return ADMIN_NAV_GROUPS.some((g) => g.items.some((i) => i.id === value));
}
