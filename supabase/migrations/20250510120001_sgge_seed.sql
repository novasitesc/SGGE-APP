-- Datos demo (idempotente: borra y vuelve a insertar la finca demo)

do $$
declare
  fid constant uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
begin
  delete from public.sales where farm_id = fid;
  delete from public.weight_measurements where animal_id in (select id from public.animals where farm_id = fid);
  delete from public.health_alerts where farm_id = fid;
  delete from public.treatments where farm_id = fid;
  delete from public.costs where farm_id = fid;
  delete from public.feed_catalog where farm_id = fid;
  delete from public.animals where farm_id = fid;
  delete from public.modules where farm_id = fid;
  delete from public.farms where id = fid;

  insert into public.farms (id, name) values (fid, 'SGGE Demo');

  insert into public.modules (id, farm_id, code, name, type, capacity, location, supervisor)
  values
    ('bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', fid, 'M1', 'Módulo 1', 'engorda', 20, 'Norte A', 'Carlos López'),
    ('bbbbbbbb-bbbb-2bbb-bbbb-bbbbbbbbbbb2', fid, 'M2', 'Módulo 2', 'engorda', 20, 'Norte B', 'Ana García'),
    ('bbbbbbbb-bbbb-3bbb-bbbb-bbbbbbbbbbb3', fid, 'M3', 'Módulo 3', 'engorda', 20, 'Sur A', 'Roberto Silva'),
    ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbb4', fid, 'M4', 'Módulo 4', 'engorda', 20, 'Sur B', 'María Torres'),
    ('bbbbbbbb-bbbb-5bbb-bbbb-bbbbbbbbbbb5', fid, 'M5', 'Módulo 5', 'recría', 18, 'Centro', 'José Martínez');

  insert into public.animals (
    id, farm_id, tag_id, breed, entry_date, initial_weight, current_weight,
    module_id, status, sex, age_months,
    acquisition_type, invoice_folio, invoice_or_auction_date, auction_lot_number, purchase_price_per_kg
  )
  values
    ('cccccccc-cccc-01cc-cccc-cccccccccc01', fid, 'BV-001', 'Angus', '2024-10-01', 220, 385, 'bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', 'activo', 'M', 18, 'subasta', '410756', '2024-09-28', 'L-12', 52.5),
    ('cccccccc-cccc-02cc-cccc-cccccccccc02', fid, 'BV-002', 'Simmental', '2024-10-01', 235, 402, 'bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', 'activo', 'M', 20, 'subasta', '410756', '2024-09-28', 'L-12', 52.5),
    ('cccccccc-cccc-03cc-cccc-cccccccccc03', fid, 'BV-003', 'Brahman', '2024-10-05', 210, 358, 'bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', 'activo', 'M', 17, 'particular', null, null, null, 48.0),
    ('cccccccc-cccc-04cc-cccc-cccccccccc04', fid, 'BV-004', 'Charolais', '2024-10-05', 245, 420, 'bbbbbbbb-bbbb-2bbb-bbbb-bbbbbbbbbbb2', 'activo', 'M', 22, null, null, null, null, null),
    ('cccccccc-cccc-05cc-cccc-cccccccccc05', fid, 'BV-005', 'Hereford', '2024-10-10', 228, 375, 'bbbbbbbb-bbbb-2bbb-bbbb-bbbbbbbbbbb2', 'activo', 'M', 19, null, null, null, null, null),
    ('cccccccc-cccc-06cc-cccc-cccccccccc06', fid, 'BV-006', 'Angus', '2024-10-10', 218, 340, 'bbbbbbbb-bbbb-2bbb-bbbb-bbbbbbbbbbb2', 'enfermo', 'M', 16, null, null, null, null, null),
    ('cccccccc-cccc-19cc-cccc-cccccccccc19', fid, 'BV-019', 'Charolais', '2025-01-05', 260, 420, 'bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', 'vendido', 'M', 24, null, null, null, null, null),
    ('cccccccc-cccc-20cc-cccc-cccccccccc20', fid, 'BV-020', 'Hereford', '2025-01-10', 235, 398, 'bbbbbbbb-bbbb-1bbb-bbbb-bbbbbbbbbbb1', 'vendido', 'M', 21, null, null, null, null, null);

  insert into public.sales (farm_id, animal_id, tag_id, breed, final_weight, price_per_kg, sale_date, buyer, module_code)
  values
    (fid, 'cccccccc-cccc-19cc-cccc-cccccccccc19', 'BV-019', 'Charolais', 420, 48.5, '2025-03-10', 'Rastro Municipal Norte', 'M1'),
    (fid, 'cccccccc-cccc-20cc-cccc-cccccccccc20', 'BV-020', 'Hereford', 398, 47.0, '2025-03-10', 'Rastro Municipal Norte', 'M1');

  insert into public.costs (farm_id, category, description, amount, date, animal_count)
  values
    (fid, 'transporte', 'Flete de ganado lote octubre', 8500, '2024-10-01', 18),
    (fid, 'alimentación', 'Maíz molido - Octubre', 14200, '2024-10-05', null),
    (fid, 'vacunas', 'Vacuna triple (IBR, DVB, PI3)', 3600, '2024-10-07', 18),
    (fid, 'mano_de_obra', 'Salario vaqueros - Octubre', 9800, '2024-10-31', null);

  insert into public.treatments (
    farm_id, type, name, date, animal_count, cost_per_animal, total_cost, applied_by, notes, next_due
  )
  values
    (fid, 'vacuna', 'Triple Viral (IBR, DVB, PI3)', '2024-10-07', 18, 200, 3600, 'Dr. Hernández', 'Aplicar refuerzo en 21 días', '2024-10-28'),
    (fid, 'desparasitante', 'Ivermectina 1% inyectable', '2024-10-10', 18, 85, 1530, 'Carlos López', 'Dosis subcutánea 1ml/50kg', null);

  insert into public.health_alerts (farm_id, animal_id, tag_id, type, message, due_date, priority)
  values
    (fid, 'cccccccc-cccc-06cc-cccc-cccccccccc06', 'BV-006', 'urgente', 'Animal con signos respiratorios, requiere evaluación inmediata', '2025-04-26', 'alta'),
    (fid, null, null, 'programado', 'Desparasitación masiva – ciclo trimestral', '2025-05-10', 'media');

  insert into public.feed_catalog (farm_id, name, unit, daily_consumption, price_per_unit, sort_order)
  values
    (fid, 'Maíz Molido', 'kg', 6.5, 5.8, 1),
    (fid, 'Melaza', 'lt', 0.8, 4.2, 2),
    (fid, 'Urea', 'kg', 0.1, 9.5, 3),
    (fid, 'Sal Mineral', 'kg', 0.15, 18.0, 4),
    (fid, 'Forraje Seco', 'kg', 4.0, 2.5, 5),
    (fid, 'Concentrado Proteínico', 'kg', 1.2, 12.0, 6);
end $$;
