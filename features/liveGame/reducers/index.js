// Sport-event registry. Add other sports by exporting a `handlers` map
// from a sibling file and merging it here. This is the single function the
// selector calls to derive UI state.

import { handlers as tableTennisHandlers } from "./tableTennis";
import { handlers as tennisHandlers } from "./tennis";
import { handlers as badmintonHandlers } from "./badminton";
import { handlers as volleyballHandlers } from "./volleyball";
import { handlers as pickleballHandlers } from "./pickleball";
import { handlers as cricketHandlers } from "./cricket";
import { handlers as rugbyHandlers } from "./rugby";
import { handlers as baseballHandlers } from "./baseball";
import { handlers as basketballHandlers } from "./basketball";
import { handlers as footballHandlers } from "./football";

const registry = {
  ...tableTennisHandlers,
  ...tennisHandlers,
  ...badmintonHandlers,
  ...volleyballHandlers,
  ...pickleballHandlers,
  ...cricketHandlers,
  ...rugbyHandlers,
  ...baseballHandlers,
  ...basketballHandlers,
  ...footballHandlers,
};

export function applyEvent(state, evt) {
  const fn = registry[evt.type];
  if (!fn) return state;
  try {
    return fn(state, evt);
  } catch {
    // never let a bad client reducer crash the UI — drop and keep prior state
    return state;
  }
}
