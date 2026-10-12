import { describe, expect, it } from "vitest";

import { ACTIVITY_WEEKS, computeClientActivity } from "../client-activity";

const NOW = new Date("2026-10-12T15:00:00Z");

describe("computeClientActivity", () => {
  it("counts distinct training days, not exercise rows", () => {
    const { activity, weeks } = computeClientActivity(
      [
        { client_id: 1, day: "2026-10-12" },
        { client_id: 1, day: "2026-10-12" }, // second exercise, same session
        { client_id: 1, day: "2026-10-06" }, // 6 days ago → still week 0
        { client_id: 1, day: "2026-10-05" }, // 7 days ago → week 1
        { client_id: 2, day: "2026-09-01" }, // outside 28 d, inside 12 weeks
      ],
      [],
      NOW
    );

    const a = activity(1);

    expect(a.trainingDays28).toBe(3);
    expect(a.weeks4).toEqual([0, 0, 1, 2]);
    expect(a.lastTrainingDay).toBe("2026-10-12");
    expect(activity(2).trainingDays28).toBe(0);
    expect(activity(2).lastTrainingDay).toBe("2026-09-01");

    expect(weeks).toHaveLength(ACTIVITY_WEEKS);
    expect(weeks.at(-1)).toEqual({
      weekEnd: "2026-10-12",
      clients: 1,
      trainingDays: 2,
    });
    expect(weeks.at(-2)?.trainingDays).toBe(1);
    expect(weeks.reduce((n, w) => n + w.trainingDays, 0)).toBe(4);
  });

  it("splits check-ins from habits and keeps the last check-in", () => {
    const { activity } = computeClientActivity(
      [],
      [
        {
          client_id: 3,
          form_type: "checkins",
          created_at: "2026-10-10T08:00:00Z",
        },
        {
          client_id: 3,
          form_type: "checkins",
          created_at: "2026-08-01T08:00:00Z",
        },
        {
          client_id: 3,
          form_type: "habits",
          created_at: "2026-10-11T08:00:00Z",
        },
      ],
      NOW
    );

    expect(activity(3)).toMatchObject({
      checkins28: 1,
      habits28: 1,
      lastCheckinAt: "2026-10-10T08:00:00Z",
    });
  });

  it("returns zeros for clients with no rows", () => {
    expect(computeClientActivity([], [], NOW).activity(99).trainingDays28).toBe(
      0
    );
  });
});
