import {
  assignPlayersToFormation,
  applyFormationPositionsToStarters,
  parseFormation,
  normalizeFootballPositionCode,
} from "../../../components/game/footballFormations";

describe("footballFormations", () => {
  const mk = (id, position, extras = {}) => ({
    _id: id,
    firstName: id,
    lastName: "",
    position,
    ...extras,
  });

  test("parseFormation falls back to 4-3-3 for unknown shapes", () => {
    expect(parseFormation("9-9-9").label).toBe("4-3-3");
    expect(parseFormation("4-3-3").slots).toHaveLength(11);
  });

  test("places GK and side-specific players into correct slots", () => {
    const xi = [
      mk("gk", "Goalkeeper"),
      mk("lb", "Left Back"),
      mk("lcb", "Centre Back"),
      mk("rcb", "CB"),
      mk("rb", "Right Back"),
      mk("lcm", "CM"),
      mk("cdm", "CDM"),
      mk("rcm", "Midfielder"),
      mk("lw", "LW"),
      mk("st", "Striker"),
      mk("rw", "Right Wing"),
    ];
    const { placements } = assignPlayersToFormation(xi, "4-3-3");
    const bySlot = Object.fromEntries(placements.map(({ slot, player }) => [slot.key, player._id]));
    expect(bySlot.GK).toBe("gk");
    expect(bySlot.LB).toBe("lb");
    expect(bySlot.RB).toBe("rb");
    expect(bySlot.LW).toBe("lw");
    expect(bySlot.RW).toBe("rw");
    expect(bySlot.ST).toBe("st");
    expect(placements).toHaveLength(11);
  });

  test("applyFormationPositionsToStarters stamps slot codes", () => {
    const xi = [
      mk("gk", "GK"),
      mk("lb", "LB"),
      mk("a", "CB"),
      mk("b", "CB"),
      mk("rb", "RB"),
      mk("c", "CM"),
      mk("d", "CDM"),
      mk("e", "CM"),
      mk("f", "LW"),
      mk("g", "ST"),
      mk("h", "RW"),
    ];
    const stamped = applyFormationPositionsToStarters(xi, "4-3-3");
    expect(stamped.find((p) => p._id === "gk").position).toBe("GK");
    expect(stamped.find((p) => p._id === "gk").slotKey).toBe("GK");
    expect(stamped.find((p) => p._id === "lb").slotKey).toBe("LB");
    expect(stamped.every((p) => p.slotKey)).toBe(true);
  });

  test("respects saved slotKey over generic position", () => {
    const xi = [
      mk("gk", "Goalkeeper", { slotKey: "GK" }),
      mk("p1", "Forward", { slotKey: "LB" }),
      mk("p2", "Forward", { slotKey: "LCB" }),
      mk("p3", "Forward", { slotKey: "RCB" }),
      mk("p4", "Forward", { slotKey: "RB" }),
      mk("p5", "Forward", { slotKey: "LCM" }),
      mk("p6", "Forward", { slotKey: "CDM" }),
      mk("p7", "Forward", { slotKey: "RCM" }),
      mk("p8", "Forward", { slotKey: "LW" }),
      mk("p9", "Forward", { slotKey: "ST" }),
      mk("p10", "Forward", { slotKey: "RW" }),
    ];
    const { placements } = assignPlayersToFormation(xi, "4-3-3");
    const bySlot = Object.fromEntries(placements.map(({ slot, player }) => [slot.key, player._id]));
    expect(bySlot.LB).toBe("p1");
    expect(bySlot.ST).toBe("p9");
    expect(bySlot.RW).toBe("p10");
  });

  test("normalizeFootballPositionCode maps labels to codes", () => {
    expect(normalizeFootballPositionCode("Goalkeeper")).toBe("GK");
    expect(normalizeFootballPositionCode("left back")).toBe("LB");
    expect(normalizeFootballPositionCode("ST")).toBe("ST");
    expect(normalizeFootballPositionCode("")).toBe("");
  });
});
