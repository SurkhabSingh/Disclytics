import { describe, expect, it } from "vitest";

import {
  calculateDailyAverages,
  classifyEngagementPoint,
  decorateEngagementPoints,
  ENGAGEMENT_LABELS
} from "../src/utils/engagement";

describe("engagement utilities", () => {
  it("calculates safe daily averages", () => {
    const result = calculateDailyAverages(
      { totalMessages: 90, totalVoiceSeconds: 18_000 },
      9
    );

    expect(result.avgMessagesPerDay).toBe(10);
    expect(result.avgVoiceSecondsPerDay).toBe(2000);
  });

  it("classifies points by quadrant", () => {
    const thresholds = { x: 100, y: 50 };

    expect(
      classifyEngagementPoint({ totalVoiceSeconds: 160, totalMessages: 60 }, thresholds, {
        xKey: "totalVoiceSeconds",
        yKey: "totalMessages"
      })
    ).toBe(ENGAGEMENT_LABELS.core);

    expect(
      classifyEngagementPoint({ totalVoiceSeconds: 20, totalMessages: 90 }, thresholds, {
        xKey: "totalVoiceSeconds",
        yKey: "totalMessages"
      })
    ).toBe(ENGAGEMENT_LABELS.spammer);
  });

  it("decorates peer points with classification and bubble size", () => {
    const result = decorateEngagementPoints([
      { userId: "1", totalVoiceSeconds: 300, totalMessages: 40 },
      { userId: "2", totalVoiceSeconds: 600, totalMessages: 80 }
    ], {
      xKey: "totalVoiceSeconds",
      yKey: "totalMessages"
    });

    expect(result.points).toHaveLength(2);
    expect(result.points[0]).toHaveProperty("classification");
    expect(result.points[0]).toHaveProperty("bubbleSize");
    expect(result.thresholds.x).toBeGreaterThanOrEqual(300);
  });
});
