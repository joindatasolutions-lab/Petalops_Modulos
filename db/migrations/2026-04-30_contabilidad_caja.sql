BEGIN;

SET search_path TO petalops, public;

-- Reutilizamos pedido.costo_domicilio como snapshot contable del domicilio
-- para no duplicar columnas entre modelo operativo y financiero.
COMMENT ON COLUMN petalops.pedido.costo_domicilio IS
  'Snapshot del costo de domicilio aplicado al pedido en el momento de la venta.';

-- Cada metodo de pago necesita su monto asignado para reconstruir ventas en efectivo
-- cuando un pedido fue pagado con multiples metodos.
ALTER TABLE petalops.pago_metodo
  ADD COLUMN IF NOT EXISTS monto numeric(12,2);

ALTER TABLE petalops.pago_metodo
  DROP CONSTRAINT IF EXISTS pago_metodo_monto_nonnegative_chk;

ALTER TABLE petalops.pago_metodo
  ADD CONSTRAINT pago_metodo_monto_nonnegative_chk
  CHECK (monto IS NULL OR monto >= 0);

COMMENT ON COLUMN petalops.pago_metodo.monto IS
  'Monto asignado a este metodo dentro del pago del pedido. En pagos mixtos permite saber cuanto fue efectivo, transferencia, etc.';

-- Backfill conservador:
-- Si el pago solo tiene un metodo relacionado, se le asigna el monto total del pago.
WITH pago_metodo_unico AS (
  SELECT
    pm.pago_id,
    COUNT(*) AS cantidad_metodos
  FROM petalops.pago_metodo pm
  GROUP BY pm.pago_id
)
UPDATE petalops.pago_metodo pm
SET monto = p.monto
FROM petalops.pago p
JOIN pago_metodo_unico pu
  ON pu.pago_id = p.id_pago
WHERE pm.pago_id = p.id_pago
  AND pu.cantidad_metodos = 1
  AND pm.monto IS NULL;

CREATE TABLE IF NOT EXISTS petalops.caja_apertura_cierre (
  id_caja_apertura_cierre bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  sucursal_id bigint NOT NULL,
  fecha_operacion date NOT NULL,
  base_inicial numeric(14,2) NOT NULL,
  monto_guardado numeric(14,2) NOT NULL DEFAULT 0,
  nueva_base numeric(14,2) NOT NULL,
  observacion text NULL,
  abierto_por_usuario_id bigint NULL,
  cerrado_por_usuario_id bigint NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NULL,
  CONSTRAINT caja_apertura_cierre_empresa_sucursal_fecha_uk
    UNIQUE (empresa_id, sucursal_id, fecha_operacion),
  CONSTRAINT caja_apertura_cierre_base_nonnegative_chk
    CHECK (base_inicial >= 0),
  CONSTRAINT caja_apertura_cierre_guardado_nonnegative_chk
    CHECK (monto_guardado >= 0),
  CONSTRAINT caja_apertura_cierre_nueva_base_nonnegative_chk
    CHECK (nueva_base >= 0),
  CONSTRAINT caja_apertura_cierre_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES petalops.empresa(id_empresa),
  CONSTRAINT caja_apertura_cierre_sucursal_fk
    FOREIGN KEY (sucursal_id) REFERENCES petalops.sucursal(id_sucursal),
  CONSTRAINT caja_apertura_cierre_abierto_usuario_fk
    FOREIGN KEY (abierto_por_usuario_id) REFERENCES petalops.usuario(id_usuario),
  CONSTRAINT caja_apertura_cierre_cerrado_usuario_fk
    FOREIGN KEY (cerrado_por_usuario_id) REFERENCES petalops.usuario(id_usuario)
);

COMMENT ON TABLE petalops.caja_apertura_cierre IS
  'Apertura y cierre diario de caja por empresa y sucursal. No guarda efectivo de ventas porque se calcula desde pago/pago_metodo.';

CREATE INDEX IF NOT EXISTS caja_apertura_cierre_empresa_fecha_idx
  ON petalops.caja_apertura_cierre (empresa_id, sucursal_id, fecha_operacion);

CREATE TABLE IF NOT EXISTS petalops.caja_gasto (
  id_caja_gasto bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  empresa_id bigint NOT NULL,
  sucursal_id bigint NOT NULL,
  fecha_operacion date NOT NULL,
  concepto varchar(160) NOT NULL,
  monto numeric(14,2) NOT NULL,
  observacion text NULL,
  usuario_id bigint NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NULL,
  CONSTRAINT caja_gasto_monto_positive_chk
    CHECK (monto > 0),
  CONSTRAINT caja_gasto_empresa_fk
    FOREIGN KEY (empresa_id) REFERENCES petalops.empresa(id_empresa),
  CONSTRAINT caja_gasto_sucursal_fk
    FOREIGN KEY (sucursal_id) REFERENCES petalops.sucursal(id_sucursal),
  CONSTRAINT caja_gasto_usuario_fk
    FOREIGN KEY (usuario_id) REFERENCES petalops.usuario(id_usuario),
  CONSTRAINT caja_gasto_caja_fecha_fk
    FOREIGN KEY (empresa_id, sucursal_id, fecha_operacion)
    REFERENCES petalops.caja_apertura_cierre(empresa_id, sucursal_id, fecha_operacion)
);

COMMENT ON TABLE petalops.caja_gasto IS
  'Salidas de efectivo de caja por fecha operativa. Cada fila representa un gasto puntual.';

CREATE INDEX IF NOT EXISTS caja_gasto_empresa_fecha_idx
  ON petalops.caja_gasto (empresa_id, sucursal_id, fecha_operacion);

CREATE OR REPLACE VIEW petalops.vw_contabilidad_venta_pedido AS
SELECT
  p.empresa_id,
  p.sucursal_id,
  p.id_pedido,
  p.numero_pedido,
  p.fecha_pedido::date AS fecha_operacion,
  p.fecha_pedido,
  p.total_bruto,
  p.total_iva,
  COALESCE(p.costo_domicilio, 0::numeric) AS total_domicilios,
  (p.total_neto - COALESCE(p.costo_domicilio, 0::numeric)) AS total_arreglos,
  p.total_neto AS total_venta,
  pa.id_pago,
  pa.fecha_pago,
  pa.metodo_pago AS metodo_pago_snapshot,
  ep.codigo AS estado_pago_codigo,
  ep.nombre AS estado_pago_nombre,
  COALESCE((
    SELECT SUM(pm.monto)
    FROM petalops.pago_metodo pm
    JOIN petalops.metodo_pago_catalogo mpc
      ON mpc.id_metodo_pago = pm.metodo_pago_id
     AND mpc.empresa_id = pm.empresa_id
    WHERE pm.empresa_id = p.empresa_id
      AND pm.pedido_id = p.id_pedido
      AND (
        LOWER(COALESCE(mpc.codigo, '')) LIKE '%efectivo%'
        OR LOWER(COALESCE(mpc.nombre, '')) LIKE '%efectivo%'
      )
  ), CASE
    WHEN LOWER(COALESCE(pa.metodo_pago, '')) LIKE '%efectivo%' THEN pa.monto
    ELSE 0::numeric
  END) AS total_efectivo
FROM petalops.pedido p
LEFT JOIN petalops.pago pa
  ON pa.empresa_id = p.empresa_id
 AND pa.pedido_id = p.id_pedido
LEFT JOIN petalops.estado_pago ep
  ON ep.id_estado_pago = pa.estado_pago_id;

COMMENT ON VIEW petalops.vw_contabilidad_venta_pedido IS
  'Vista base contable por pedido. Se usa para resumir ventas y efectivo sin duplicar informacion que ya vive en pedido/pago/pago_metodo.';

CREATE OR REPLACE VIEW petalops.vw_contabilidad_resumen_ventas_diario AS
SELECT
  empresa_id,
  sucursal_id,
  fecha_operacion,
  COUNT(*) AS cantidad_pedidos,
  SUM(total_arreglos) AS total_arreglos_florales,
  SUM(total_domicilios) AS total_domicilios,
  SUM(total_venta) AS total_venta,
  SUM(total_efectivo) AS total_efectivo_ventas
FROM petalops.vw_contabilidad_venta_pedido
GROUP BY empresa_id, sucursal_id, fecha_operacion;

COMMENT ON VIEW petalops.vw_contabilidad_resumen_ventas_diario IS
  'Resumen diario de ventas por empresa y sucursal. Siempre filtrar por empresa_id y, de ser necesario, por fecha y sucursal.';

CREATE OR REPLACE VIEW petalops.vw_caja_totales_diario AS
SELECT
  cac.empresa_id,
  cac.sucursal_id,
  cac.fecha_operacion,
  cac.base_inicial,
  COALESCE(v.total_efectivo_ventas, 0::numeric) AS efectivo_ventas,
  COALESCE(g.total_gastos, 0::numeric) AS total_gastos,
  (cac.base_inicial + COALESCE(v.total_efectivo_ventas, 0::numeric) - COALESCE(g.total_gastos, 0::numeric)) AS total_efectivo,
  cac.monto_guardado,
  cac.nueva_base,
  cac.observacion,
  cac.abierto_por_usuario_id,
  cac.cerrado_por_usuario_id,
  cac.created_at,
  cac.updated_at
FROM petalops.caja_apertura_cierre cac
LEFT JOIN petalops.vw_contabilidad_resumen_ventas_diario v
  ON v.empresa_id = cac.empresa_id
 AND v.sucursal_id = cac.sucursal_id
 AND v.fecha_operacion = cac.fecha_operacion
LEFT JOIN (
  SELECT
    empresa_id,
    sucursal_id,
    fecha_operacion,
    SUM(monto) AS total_gastos
  FROM petalops.caja_gasto
  GROUP BY empresa_id, sucursal_id, fecha_operacion
) g
  ON g.empresa_id = cac.empresa_id
 AND g.sucursal_id = cac.sucursal_id
 AND g.fecha_operacion = cac.fecha_operacion;

COMMENT ON VIEW petalops.vw_caja_totales_diario IS
  'Totales diarios de caja. Formula: base_inicial + efectivo_ventas - total_gastos = total_efectivo; nueva_base es el efectivo que queda tras restar monto_guardado.';

-- Corrección: pedidos en estado CREADO deben tener numero_pedido NULL
-- ya que solo se asigna al aprobar
UPDATE petalops.pedido
SET numero_pedido = NULL
WHERE estado_pedido_id = (
  SELECT id_estado_pedido
  FROM petalops.estado_pedido
  WHERE LOWER(codigo) = 'creado'
) AND numero_pedido IS NOT NULL;

COMMIT;
