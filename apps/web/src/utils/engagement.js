export const ENGAGEMENT_LABELS = {
  core: "Core User",
  spammer: "Spammer",
  lurker: "Lurker",
  inactive: "Inactive"
};

function median(values) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

export function formatVoiceDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

export function calculateDailyAverages(summary, trackedDayCount) {
  const safeDayCount = Math.max(1, Number(trackedDayCount || 0));
  return {
    avgMessagesPerDay: Number(summary?.totalMessages || 0) / safeDayCount,
    avgVoiceSecondsPerDay: Number(summary?.totalVoiceSeconds || 0) / safeDayCount
  };
}

export function calculateEngagementThresholds(points, config) {
  const { xKey, yKey } = config;
  const xValues = points.map((point) => Number(point[xKey] || 0));
  const yValues = points.map((point) => Number(point[yKey] || 0));

  return {
    x: median(xValues),
    y: median(yValues)
  };
}

export function classifyEngagementPoint(point, thresholds, config) {
  const { xKey, yKey } = config;
  const xValue = Number(point[xKey] || 0);
  const yValue = Number(point[yKey] || 0);
  const voiceThreshold = Number(thresholds?.x || 0);
  const messageThreshold = Number(thresholds?.y || 0);

  if (xValue >= voiceThreshold && yValue >= messageThreshold) {
    return ENGAGEMENT_LABELS.core;
  }

  if (xValue < voiceThreshold && yValue >= messageThreshold) {
    return ENGAGEMENT_LABELS.spammer;
  }

  if (xValue >= voiceThreshold && yValue < messageThreshold) {
    return ENGAGEMENT_LABELS.lurker;
  }

  return ENGAGEMENT_LABELS.inactive;
}

export function calculateEngagementScore(point, config) {
  const {
    xKey,
    yKey,
    voiceWeightDivisor = 600
  } = config;
  const voiceValue = Number(point[xKey] || 0);
  const messageValue = Number(point[yKey] || 0);

  return messageValue + (voiceValue / voiceWeightDivisor);
}

export function decorateEngagementPoints(points, config) {
  if (!Array.isArray(points) || !points.length) {
    return {
      points: [],
      thresholds: { x: 0, y: 0 },
      maxScore: 0
    };
  }

  const thresholds = calculateEngagementThresholds(points, config);
  const scoredPoints = points.map((point) => ({
    ...point,
    classification: classifyEngagementPoint(point, thresholds, config),
    engagementScore: calculateEngagementScore(point, config)
  }));
  const maxScore = scoredPoints.reduce(
    (highestScore, point) => Math.max(highestScore, point.engagementScore),
    0
  );

  return {
    thresholds,
    maxScore,
    points: scoredPoints.map((point) => ({
      ...point,
      bubbleSize: maxScore > 0
        ? 120 + ((point.engagementScore / maxScore) * 360)
        : 180
    }))
  };
}
