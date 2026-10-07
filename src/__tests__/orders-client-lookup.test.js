import { describe, expect, it } from "vitest";
import { mergeClientLookup } from "../domain/orders-admin/hooks/useNewOrderClientLookup.js";

describe("autocompletado de clientes", () => {
  const requested = { clienteNombre: "", clienteEmail: "", clienteIdentificacion: "", clienteTelefono: "1234567" };
  const client = { clienteID: 4, nombreCompleto: "Ana", email: "ana@example.test", identificacion: "100" };
  it("completa los campos cuando el formulario no ha cambiado", () => {
    expect(mergeClientLookup(requested, requested, client)).toMatchObject({ clienteID: 4, clienteNombre: "Ana", clienteEmail: client.email });
  });
  it("conserva el correo escrito durante la solicitud", () => {
    expect(mergeClientLookup({ ...requested, clienteEmail: "nuevo@example.test" }, requested, client))
      .toMatchObject({ clienteID: 4, clienteNombre: "Ana", clienteEmail: "nuevo@example.test" });
  });
  it("no asocia el cliente anterior si se editó su identidad", () => {
    expect(mergeClientLookup({ ...requested, clienteNombre: "Beatriz", clienteIdentificacion: "200" }, requested, client))
      .toMatchObject({ clienteID: null, clienteNombre: "Beatriz", clienteIdentificacion: "200" });
  });
});
