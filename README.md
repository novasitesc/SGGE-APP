# SGGE — Dashboard de gestión ganadera (engorda)

Aplicación web tipo panel de administración para operaciones de **engorda de ganado bovino**: animales, pesos, alimentación, costos, salud, ventas y reportes financieros.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript  
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)  
- [Zustand](https://github.com/pmndrs/zustand)  
- [Recharts](https://recharts.org)  

Los datos son **mock** (`lib/mockData.ts`), listos para conectar un backend.

## Cómo ejecutar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) (redirige a `/dashboard`).

```bash
npm run build
```

## Estructura principal

| Ruta | Contenido |
|------|-----------|
| `/dashboard` | KPIs, gráficas, alertas, ventas recientes |
| `/animals` | Tabla de animales y alta con modal |
| `/modules` | Módulos de corral y ocupación |
| `/feeding` | Raciones y costos de alimentación |
| `/costs` | Gastos por categoría |
| `/health` | Tratamientos y alertas |
| `/sales` | Ventas |
| `/reports` | Flujo financiero y rentabilidad |

## Licencia

MIT (o la que elijas al publicar el repositorio).
