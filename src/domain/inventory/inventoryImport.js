const HEADER_ALIASES = {
  codigo: ["codigo", "cod", "codigoproducto", "codigoinventario"],
  nombre: ["producto", "nombre", "nombreproducto", "insumo"],
  subcategoria: ["subcategoria", "tipoproducto"],
  color: ["color"],
  tamano: ["tamano", "tamao", "medida"],
  unidadMedida: ["unidad", "unidadmedida", "presentacion"],
  proveedor: ["proveedor", "provedor"],
  descripcion: ["descripcion", "detalle"],
  stockActual: ["stockinicial", "stockactual", "cantidad", "cantidadstock", "stock"],
  stockMinimo: ["stockminimo", "cantidadminima", "minimo"],
  valorUnitario: ["costoxunidad", "costounitario", "costoporunidad", "preciocompra"],
  costoPaquete: ["costoxpaquete", "costopaquete", "costoporpaquete"],
  precioVenta: ["preciodeventaporunidad", "precioventaporunidad", "precioventaunidad", "precioventa"],
  precioVentaPaquete: ["preciodeventaporpaquete", "precioventaporpaquete", "precioventapaquete"],
  marca: ["marca"],
  diasVidaUtil: ["diasdevidautil", "diasvidautil", "vidautil"],
  fechaVencimiento: ["fechadevencimiento", "fechavencimiento", "vencimiento"],
  observaciones: ["observaciones", "observacion", "notas"],
  activo: ["estado", "activo"],
  vendibleUnidad: ["vendibleporunidad", "vendibleunidad"],
};

const NUMERIC_FIELDS = [
  "stockActual", "stockMinimo", "valorUnitario", "costoPaquete",
  "precioVenta", "precioVentaPaquete", "diasVidaUtil",
];

export function normalizeInventoryExcelHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

export function parseInventoryExcelNumber(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let normalized = String(value).trim().replace(/[$\s]/g, "");
  if (!normalized) return null;
  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
    normalized = normalized.replace(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const decimals = normalized.length - lastComma - 1;
    normalized = decimals === 3 ? normalized.replace(/,/g, "") : normalized.replace(",", ".");
  } else if (lastDot >= 0) {
    const decimals = normalized.length - lastDot - 1;
    if (decimals === 3) normalized = normalized.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value, defaultValue) {
  if (value == null || String(value).trim() === "") return defaultValue;
  const normalized = normalizeInventoryExcelHeader(value);
  if (["0", "no", "false", "inactivo", "inactiva"].includes(normalized)) return false;
  if (["1", "si", "true", "activo", "activa"].includes(normalized)) return true;
  return defaultValue;
}

function parseDate(value, XLSX) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (local) return `${local[3]}-${local[2].padStart(2, "0")}-${local[1].padStart(2, "0")}`;
  return null;
}

function resolveColumns(headers) {
  const normalizedHeaders = new Set(headers.map(header => normalizeInventoryExcelHeader(header)));
  return Object.fromEntries(Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
    field,
    aliases.find(alias => normalizedHeaders.has(alias)) || null,
  ]));
}

export function parseInventoryWorksheetRows(rawRows, XLSX = null) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row || {}))));
  const columns = resolveColumns(headers);
  const missing = [["codigo", "Código"], ["nombre", "Producto"]]
    .filter(([field]) => !columns[field])
    .map(([, label]) => label);
  if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(", ")}.`);

  const items = [];
  const errors = [];
  rows.forEach((source, index) => {
    const fila = index + 2;
    const normalizedSource = Object.fromEntries(Object.entries(source || {}).map(([header, cell]) => [
      normalizeInventoryExcelHeader(header),
      cell,
    ]));
    const value = field => columns[field] ? normalizedSource[columns[field]] : null;
    const codigo = cleanText(value("codigo"));
    const nombre = cleanText(value("nombre"));
    if (!codigo && !nombre) return;
    if (!codigo || !nombre) {
      errors.push({ fila, codigo, mensaje: `Completa ${!codigo ? "Código" : "Producto"}.` });
      return;
    }

    const parsedNumbers = {};
    const invalidFields = [];
    NUMERIC_FIELDS.forEach(field => {
      const raw = value(field);
      const parsed = parseInventoryExcelNumber(raw);
      if (raw != null && String(raw).trim() !== "" && parsed == null) invalidFields.push(columns[field] || field);
      parsedNumbers[field] = parsed;
    });
    if (invalidFields.length) {
      errors.push({ fila, codigo, mensaje: `Valores numéricos inválidos en: ${invalidFields.join(", ")}.` });
      return;
    }

    const fechaRaw = value("fechaVencimiento");
    const fechaVencimiento = parseDate(fechaRaw, XLSX || { SSF: { parse_date_code: () => null } });
    if (fechaRaw != null && String(fechaRaw).trim() !== "" && !fechaVencimiento) {
      errors.push({ fila, codigo, mensaje: "Fecha de vencimiento inválida." });
      return;
    }

    items.push({
      fila,
      codigo,
      nombre,
      subcategoria: cleanText(value("subcategoria")),
      color: cleanText(value("color")),
      tamano: cleanText(value("tamano")),
      unidadMedida: cleanText(value("unidadMedida")) || "Unidad",
      proveedor: cleanText(value("proveedor")),
      descripcion: cleanText(value("descripcion")),
      stockActual: parsedNumbers.stockActual ?? 0,
      stockMinimo: parsedNumbers.stockMinimo ?? 0,
      valorUnitario: parsedNumbers.valorUnitario ?? 0,
      costoPaquete: parsedNumbers.costoPaquete,
      precioVenta: parsedNumbers.precioVenta,
      precioVentaPaquete: parsedNumbers.precioVentaPaquete,
      marca: cleanText(value("marca")),
      diasVidaUtil: parsedNumbers.diasVidaUtil == null ? null : Math.trunc(parsedNumbers.diasVidaUtil),
      fechaVencimiento,
      observaciones: cleanText(value("observaciones")),
      activo: parseBoolean(value("activo"), true),
      vendibleUnidad: parseBoolean(value("vendibleUnidad"), false),
    });
  });

  const counts = new Map();
  items.forEach(item => {
    const key = normalizeInventoryExcelHeader(item.codigo);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const duplicates = new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  const validItems = items.filter(item => {
    if (!duplicates.has(normalizeInventoryExcelHeader(item.codigo))) return true;
    errors.push({ fila: item.fila, codigo: item.codigo, mensaje: "El código está repetido dentro del archivo." });
    return false;
  });

  return { items: validItems, errors, totalRows: validItems.length + errors.length, columns };
}

export async function parseInventoryWorkbook(file) {
  if (!file) throw new Error("Selecciona un archivo de Excel.");
  if (!/\.(xlsx|xls)$/i.test(file.name || "")) throw new Error("El archivo debe ser Excel (.xlsx o .xls).");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames.find(name => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: null });
    return rows.length > 0;
  });
  if (!sheetName) throw new Error("El archivo no contiene filas para importar.");
  const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: true });
  return { ...parseInventoryWorksheetRows(rawRows, XLSX), sheetName };
}
