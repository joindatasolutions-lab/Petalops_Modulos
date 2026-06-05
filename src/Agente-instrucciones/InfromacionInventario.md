ya tengo mi modulo de inventario crearo, sin embargo necesito hacerles algunos ajustes, Actualmente en las floristerias manejan estos estados o categorias, necesito ajustar el modulo de inventario para adaptarlo a este requerimiento, creame unas subpestañas debajo de los filtros para navegar entre los disntintos submenus para ver las flores, bases etc, todo esto va edentro del modulo inventario, recuerda por favor aplicar el mismo viusal solorres que se ha implementado con base a las indicaciones del archivo frondModulos

Llevarlo por mòdulos o pestañas dentro del módulo inventario:
NO mezcles:
flores
materiales
adicionales
en una sola tabla.
Porque:
Las flores vencen
Los materiales se consumen diferente
Los chocolates manejan lotes
Las bases tienen variantes
Separarlos por módulos.



MODULOS:

INVENTARIO DE FLORES
INVENTARIO DE BASES
MATERIALES
ADICIONALES CATALOGO
ARREGLOS
MOVIMIENTOS









MÓDULO 1: INVENTARIO DE FLORES: flores y follaje





Categoria: Flores
Subcategoría: Rosas, Girasoles, Hortensias, Claveles, follaje
Crear un item: codigo, categoria, subcategoria, color, descripción, proveedor, descripción, cantidad( und, paquetes)

Algunas funciones como:
Alertas de flores bajas STOCK
 Alertas de vencimiento
Registro de flores dañadas
Historial de compras 

MODULO 2: INVENTARIO DE BASES
Bases
categoría: Box, Madera, Vidrio, Cerámica
Crear un item: codigo, producto, categoria, subcategoria, tamaño, color,  descripción, proveedor, cantidad

Algunas funciones tener en cuenta:
Saber qué bases se venden más
Control de reposición 





OPCION 2 me gusta mas esta



MODULO 3: INVENTARIO DE MATERIALES: todo lo decorativo de los arreglos  e insumos opertativos




categorias: Cintas, Papeles, Celofán, Moños, Yute, Oasis, plastico, frascos.  INSUMOS OPERATIVOS:  Cinta transparente
Tijeras, Bolsas, etiquetas, Pegante, Grapadora, colibries tarjetas de mensajes

Esto ayuda a controlar gastos internos.  
crear item:  codigo, producto, categoria, subcategoria, tamaño, color,  descripción, proveedor, cantidad


Unidades: Rollo Unidad Paquete Pliego Caja  Bloque

ejemplo:
Cinta
Código: MT002
Producto: Cinta flora
Categoría: Cintas
Subcategoría: Satinada
Tamaño: 5 cm o delgada 
Color: beis
Proveedor: Cintas y Más
Cantidad: 120
Unidad: rollo

Código: MT003
Producto: Oasis 
Categoría: Oasis
Subcategoría: Ladrillo
Tamaño: sencillo  o por cms
Color: Verde
Proveedor: Oasis Colombia
Cantidad: 60
Unidad: Unidad 

┌────────────────────────────────────┐
│ 🎀 Cinta Satinada Roja             │
├────────────────────────────────────┤
│ Código: MT002                      │
│ Categoría: Cintas                  │
│ Subcategoría: Satinada             │
│ Tamaño: 5 cm                       │
│ Color: Rojo                        │
│ Proveedor: Cintas y Más            │
│ Unidad: Metro                      │
│ Stock: 120 metros                  │
│ Stock mínimo: 30 metros            │
│ Estado: 🟢 Activo                  │
├────────────────────────────────────┤
│ [ Registrar Compra ]               │
│ [ Ajustar Inventario ]             │
│ [ Historial ]                      │
└────────────────────────────────────┘

MODULO 4: INVENTARIO ADICIONALES: Productos extras para vender. 

subcaterias: Chocolates, Vinos, Peluches, topper, 
item:
codigo, producto, categoria,  marca, descripcion, proveedor,fecha de vencimiento, costo unitario, costo de venta


Algunas funciones:  Costos, Ganancia



MODULO 5: ARREGLOS: aqui estaran todos los arreglos florales con sus recetas   JUAN ALGO ASI ES LO QUE NECESITAMOS MANEJAR EN TEMPORADAS

Ejemplo:
Arreglo: BOX ROMANTIC 

Consume:
24 rosas
1 box larga
2 papel flora

adicional
1 ferrero

descuenta

flores
24 rosas
bases
1 box larga
materiales
1 papel flora
adicional
1 ferrreroÇ

Función principal:
 Permite crear y administrar los arreglos florales que vende la floristería, definiendo los productos y materiales que los componen.
¿Qué hace?
✅ Crear arreglos florales del catálogo.
✅ Asignar precio de venta y costo de producción.
✅ Definir la receta o composición del arreglo.
✅ Relacionar flores, bases, materiales y adicionales.
✅ Consultar utilidad y rentabilidad de cada arreglo.
✅ Controlar cuáles arreglos están activos o inactivos.
Ejemplo
Caja Romance Premium
Contiene:
24 Rosas Rojas
1 Caja Corazón
2 Papeles Coreanos
1 Cinta Satinada
1 Ferrero Rocher
Beneficio
Cuando se vende un arreglo, el sistema puede descontar automáticamente del inventario los productos utilizados o servir como guía para registrar manualmente los consumos.
Información que muestra
Nombre del arreglo
Imagen
Precio de venta
Costo de producción
Utilidad
Componentes utilizados
Estado (Activo/Inactivo)
Historial de ventas
Objetivo
Centralizar la creación de productos terminados y conocer exactamente qué materiales se utilizan y cuánto gana la floristería con cada arreglo vendido.


