export const DESTINO_POR_CATEGORIA: Record<
  string,
  { href: string; label: string }
> = {
  SPUB: { href: "/gestion/servicios-publicos", label: "Servicios públicos" },
  POL: { href: "/gestion/polizas", label: "Pólizas" },
  CCSS: { href: "/gestion/ccss", label: "CCSS" },
  SAL: { href: "/gestion/salarios", label: "Salarios" },
  VIAT: { href: "/gestion/viaticos", label: "Viáticos" },
  ALIM: { href: "/gestion/alimentacion", label: "Alimentación" },
  VET: { href: "/gestion/salud", label: "Salud" },
};

export function destinoPorCategoria(code: string | null | undefined) {
  if (!code) return null;
  return DESTINO_POR_CATEGORIA[code.toUpperCase()] ?? null;
}
