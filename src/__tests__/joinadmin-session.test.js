import { describe, expect, it } from "vitest";

import { isJoinAdminSession } from "../App.jsx";

describe("isJoinAdminSession", () => {
  it("habilita seguimiento solo para joinadmin global", () => {
    expect(isJoinAdminSession({ esGlobalJoin: true, login: "joinadmin" })).toBe(true);
    expect(isJoinAdminSession({ esGlobalJoin: true, email: "joinadmin@joindata.com.co" })).toBe(true);
  });

  it("bloquea usuarios globales distintos y sesiones no globales", () => {
    expect(isJoinAdminSession({ esGlobalJoin: true, login: "admin" })).toBe(false);
    expect(isJoinAdminSession({ esGlobalJoin: false, login: "joinadmin" })).toBe(false);
  });
});
