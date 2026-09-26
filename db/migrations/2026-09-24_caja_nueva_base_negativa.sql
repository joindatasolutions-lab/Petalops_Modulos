BEGIN;

SET search_path TO petalops, public;

ALTER TABLE petalops.caja_apertura_cierre
  DROP CONSTRAINT IF EXISTS caja_apertura_cierre_nueva_base_nonnegative_chk;

COMMENT ON COLUMN petalops.caja_apertura_cierre.nueva_base IS
  'Efectivo que queda fisicamente en caja al cierre. Puede ser negativo cuando los gastos superan la base mas el efectivo del dia.';

COMMIT;
