import { describe, expect, test } from "@jest/globals";
import { resolveBasketballClockAction } from "@/components/game/hooks/basketballState";

// Mirrors the refs the owner's game screen keeps for the quarter clock.
const createClock = () => {
  const state = { armedQuarter: 0, endedQuarter: 0, quarterFloor: 0, ended: [] };

  return {
    state,
    // One render of the owner's screen: where the clock reads, and what the
    // server currently believes the quarter is.
    tick({ serverQuarter, minutes, seconds, isRunning }) {
      const quarter = Math.max(1, Number(serverQuarter) || 1, state.quarterFloor);
      const { action } = resolveBasketballClockAction({
        quarter,
        remainingSeconds: minutes * 60 + seconds,
        isRunning,
        armedQuarter: state.armedQuarter,
        endedQuarter: state.endedQuarter,
      });

      if (action === "arm") state.armedQuarter = quarter;
      if (action === "end") {
        state.endedQuarter = quarter;
        state.quarterFloor = quarter + 1;
        state.ended.push(quarter);
      }
      return action;
    },
  };
};

describe("basketball quarter clock", () => {
  test("a clock sitting at 00:00 before the quarter length arrives does nothing", () => {
    const clock = createClock();
    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: false })).toBe("ignore");
    expect(clock.state.ended).toEqual([]);
  });

  test("counting down to zero ends the quarter exactly once", () => {
    const clock = createClock();
    clock.tick({ serverQuarter: 1, minutes: 8, seconds: 0, isRunning: true });
    clock.tick({ serverQuarter: 1, minutes: 0, seconds: 1, isRunning: true });

    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: true })).toBe("end");
    // The clock stops itself a beat later; that must not fire a second time.
    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: false })).toBe("ignore");
    expect(clock.state.ended).toEqual([1]);
  });

  test("the quarter still ends when the running-at-zero render is missed", () => {
    const clock = createClock();
    clock.tick({ serverQuarter: 1, minutes: 8, seconds: 0, isRunning: true });
    // A socket timer snapshot lands and the clock is already stopped at zero.
    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: false })).toBe("end");
    expect(clock.state.ended).toEqual([1]);
  });

  test("resuming a game parked at 00:00 recovers it", () => {
    // Fresh mount: the refs know nothing, the stored clock is spent.
    const clock = createClock();
    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: false })).toBe("ignore");
    expect(clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: true })).toBe("end");
    expect(clock.state.ended).toEqual([1]);
  });

  test("every quarter advances, even while the server snapshot lags behind", () => {
    const clock = createClock();

    for (let q = 1; q <= 4; q += 1) {
      // The server snapshot is deliberately stuck on quarter 1 the whole time.
      clock.tick({ serverQuarter: 1, minutes: 8, seconds: 0, isRunning: true });
      clock.tick({ serverQuarter: 1, minutes: 0, seconds: 0, isRunning: true });
    }

    expect(clock.state.ended).toEqual([1, 2, 3, 4]);
  });

  test("a full four-quarter game with pauses ends each quarter once", () => {
    const clock = createClock();
    let serverQuarter = 1;

    for (let q = 1; q <= 4; q += 1) {
      clock.tick({ serverQuarter, minutes: 8, seconds: 0, isRunning: true });
      clock.tick({ serverQuarter, minutes: 4, seconds: 30, isRunning: true });
      clock.tick({ serverQuarter, minutes: 4, seconds: 30, isRunning: false }); // owner pause
      clock.tick({ serverQuarter, minutes: 4, seconds: 30, isRunning: true }); // resume
      clock.tick({ serverQuarter, minutes: 0, seconds: 0, isRunning: true }); // horn
      clock.tick({ serverQuarter, minutes: 0, seconds: 0, isRunning: false }); // clock self-stops
      serverQuarter += 1;
      clock.tick({ serverQuarter, minutes: 8, seconds: 0, isRunning: false }); // break reset
    }

    expect(clock.state.ended).toEqual([1, 2, 3, 4]);
  });

  test("overtime keeps advancing past regulation", () => {
    const clock = createClock();
    clock.state.armedQuarter = 4;
    clock.state.endedQuarter = 3;

    expect(clock.tick({ serverQuarter: 4, minutes: 0, seconds: 0, isRunning: true })).toBe("end");
    clock.tick({ serverQuarter: 5, minutes: 5, seconds: 0, isRunning: true });
    expect(clock.tick({ serverQuarter: 5, minutes: 0, seconds: 0, isRunning: true })).toBe("end");
    expect(clock.state.ended).toEqual([4, 5]);
  });

  test("a paused mid-quarter clock is left alone", () => {
    const clock = createClock();
    expect(clock.tick({ serverQuarter: 2, minutes: 3, seconds: 12, isRunning: false })).toBe("ignore");
    expect(clock.state.armedQuarter).toBe(0);
    expect(clock.state.ended).toEqual([]);
  });
});
