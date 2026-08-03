# Salud — Ola 0: contrato de tablas

## Tablas

| Tabla | Rol |
|-------|-----|
| `medicamentos` | Catálogo por granja (nombre, tipo, costo unitario) |
| `tratamientos` | Cabecera de aplicación sanitaria |
| `tratamiento_animales` | N:N tratamiento ↔ animales (multi-animal) |
| `alertas_sanitarias` | Alertas activas / resueltas |
| `salud_importaciones` | Staging de PDF sanitarios |

## Columnas clave de `tratamientos`

- `granja_id`, `animal_id` (opcional), `lote_id` (opcional)
- `medicamento_id`, `tipo`, `nombre`
- `fecha_inicio`, `proxima_aplicacion`
- `animal_count`, `costo_por_animal`, `costo_total`
- `aplicado_por`, `estado`, `observaciones`, `origen` (`manual` \| `pdf` \| `bulk`)
- Soft-delete: `deleted_at`

## Columnas clave de `alertas_sanitarias`

- `tipo`: `tratamiento` \| `revisión` \| `urgente` \| `programado`
- `prioridad`: `alta` \| `media` \| `baja`
- `estado`: `activa` \| `resuelta` \| `pospuesta`
- `fecha_vencimiento`, `tag_id`, `animal_id`, `tratamiento_id`

## RLS

Políticas por `granja_id` vía `current_usuario_id()` → `usuarios.granja_id`.
Las Route Handlers usan Service Role (bypass RLS) con `requireApiContext`.

## Migración

`supabase/migrations/20260802200000_salud_schema.sql`
