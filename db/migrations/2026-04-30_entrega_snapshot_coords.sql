BEGIN;

SET search_path TO petalops, public;

ALTER TABLE petalops.entrega
  ADD COLUMN IF NOT EXISTS latituddestino numeric(10,7);

ALTER TABLE petalops.entrega
  ADD COLUMN IF NOT EXISTS longituddestino numeric(10,7);

COMMENT ON COLUMN petalops.entrega.latituddestino IS
  'Coordenada snapshot del destino usada para cálculo de distancia y trazabilidad operativa.';

COMMENT ON COLUMN petalops.entrega.longituddestino IS
  'Coordenada snapshot del destino usada para cálculo de distancia y trazabilidad operativa.';

COMMIT;
