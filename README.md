# SGGE — Sistema de Gestión Ganadera de Engorda

Aplicación web para operar una granja de **engorda de ganado bovino**: inventario, corrales, alimentación, costos, salud, ventas, reportes y control gerencial.

## Stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript  
- [Tailwind CSS 4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)  
- [Supabase](https://supabase.com) (Auth + PostgreSQL)  
- [Zustand](https://github.com/pmndrs/zustand) (UI local)  
- [Recharts](https://recharts.org)  

Los datos vienen de **Supabase/PostgreSQL** vía Route Handlers en `app/api/*` (no hay mock de negocio).

## Cómo ejecutar

1. Copia `.env.example` a `.env.local` y completa las claves de tu proyecto Supabase.
2. Instala y arranca:

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) (redirige a `/dashboard` tras login).

```bash
npm run build
```

## Variables de entorno

Ver [`.env.example`](.env.example). En producción (Vercel) configura las mismas claves; activa `AUTH_PROXY_ENFORCE=true` para proteger rutas.

## Estructura principal

| Ruta | Contenido |
|------|-----------|
| `/dashboard` | KPIs, gráficas, alertas, ventas recientes |
| `/animals` | Inventario de animales |
| `/modules` | Corrales y ocupación |
| `/feeding` | Raciones y costos de alimentación |
| `/costs` | Gastos por categoría |
| `/health` | Tratamientos y alertas |
| `/sales` | Ventas (consulta) |
| `/reports` | Flujo financiero y rentabilidad |
| `/administracion` | Catálogos (razas, estados, lotes…) |
| `/gestion/*` | Hub operativo (CRUD, comprobantes, mensajería) |

Documentación de producto: [`docs/resumen-ejecutivo.md`](docs/resumen-ejecutivo.md).

## Licencia

MIT (o la que elijas al publicar el repositorio).
