BEGIN;

-- Nullable: los cierres anteriores no tienen un conteo físico registrado.
ALTER TABLE petalops.caja_apertura_cierre
  ADD COLUMN IF NOT EXISTS total_contado numeric(14,2),
  ADD COLUMN IF NOT EXISTS arqueo_denominaciones jsonb;

COMMENT ON COLUMN petalops.caja_apertura_cierre.total_contado IS
  'Total físico contado antes de retirar el monto guardado. NULL significa sin arqueo.';
COMMENT ON COLUMN petalops.caja_apertura_cierre.arqueo_denominaciones IS
  'Objeto denominación COP -> cantidad entera no negativa. Validar y sumar en el servicio.';

COMMIT;
