# Módulo Salud — documentación técnica

## Rutas UI

| Ruta | Rol |
|------|-----|
| `/health` | Hub analítico: KPIs, charts, exploración, alertas accionables, export |
| `/gestion/salud` | Operaciones: CRUD tratamientos/alertas, catálogo medicamentos, cargas |

## Código

```
modules/salud/
  client.ts          # exports seguros para Client Components
  index.ts           # barrel server (queries/actions)
  types/
  queries/
  actions/
  components/
  lib/kpis.ts
```

## API

| Método | Path | Descripción |
|--------|------|-------------|
| GET/POST | `/api/treatments` | Listar (filtros `from,to,type,q,animalId`) / crear (también `bulk`+`animalIds`) |
| GET/PATCH/DELETE | `/api/treatments/[id]` | Detalle / editar / soft-delete |
| GET/POST | `/api/health-alerts` | Alertas activas / crear |
| PATCH/DELETE | `/api/health-alerts/[id]` | Editar (incl. `status: resuelta`) / eliminar |
| POST | `/api/health-alerts/sync` | Regenera alertas desde `proxima_aplicacion` |
| GET/POST | `/api/medicamentos` | Catálogo |
| DELETE | `/api/medicamentos/[id]` | Soft-delete |
| POST | `/api/salud/import` | Upload PDF → staging |
| POST | `/api/salud/import/[id]/confirm` | Confirma e inserta tratamiento |
| GET | `/api/salud/export?format=html\|csv` | Informe imprimible / CSV |

## Base de datos

Migración: `supabase/migrations/20260802200000_salud_schema.sql`

Tablas: `medicamentos`, `tratamientos`, `tratamiento_animales`, `alertas_sanitarias`, `salud_importaciones`.

RLS por `granja_id` vía `current_usuario_id()`. Las Route Handlers usan Service Role con `requireApiContext`.

Detalle de columnas: [salud-ola0.md](./salud-ola0.md).

## Trazabilidad

Todas las mutaciones llaman `registrarHistorial(..., { modulo: "salud" })`.
Visible en `/gestion/historial` filtrando módulo Salud.

## Flujos de carga

1. **Manual** — formulario → `POST /api/treatments` → alerta si hay `nextDue`
2. **PDF sanitario** — upload en Gestión Salud → parse → revisión → confirm
3. **Comprobante VET** — al confirmar gasto en `/gestion/comprobantes` con categoría VET (o líneas vet detectadas, p. ej. Dos Pinos: Baytril, Partovet…), se sincronizan `medicamentos` + `tratamientos` (`lib/api/vet-from-comprobante.ts`). Idempotente por marcador `gasto:{id}` en observaciones.
4. **CSV plantilla** — `/templates/salud-carga.csv` (guía para carga manual)

### Backfill de comprobantes ya confirmados

```bash
npm run backfill:vet
```

## Aplicar migración

```bash
supabase db push
# o aplicar 20260802200000_salud_schema.sql en el SQL Editor
```
