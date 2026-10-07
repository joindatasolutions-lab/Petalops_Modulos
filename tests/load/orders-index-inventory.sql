-- Run only against the agreed test database. This script does not run EXPLAIN ANALYZE.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'petalops'
  AND tablename IN ('pedido', 'entrega', 'pedido_detalle', 'pago', 'pago_metodo',
                    'cliente', 'producto', 'pedido_canal_venta')
ORDER BY tablename, indexname;

SELECT relname, n_live_tup, n_dead_tup, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'petalops'
  AND relname IN ('pedido', 'entrega', 'pedido_detalle', 'pago', 'pago_metodo');

SELECT to_regprocedure('petalops.factura_impresa(text)') AS invoice_function;
ROLLBACK;
