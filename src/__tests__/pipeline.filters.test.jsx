import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PipelineFilters } from "../domain/pipeline/PipelineFilters.jsx";

describe("filtros de pipeline", () => {
  it("renderiza rango de fechas desde y hasta", () => {
    const html = renderToStaticMarkup(
      <PipelineFilters
        filters={{
          numeroPedido: "",
          fechaDesde: "2026-06-18",
          fechaHasta: "2026-06-20",
          sucursalID: null,
          floristaID: "",
          domiciliarioID: "",
          estadoStage: "",
          soloAtrasados: false,
          soloEnProduccion: false,
        }}
        onChange={() => {}}
      />
    );

    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html).toContain("aria-label=\"Fecha desde\"");
    expect(html).toContain("aria-label=\"Fecha hasta\"");
  });
});
