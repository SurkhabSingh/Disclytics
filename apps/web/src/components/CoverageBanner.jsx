export function CoverageBanner({ coverage }) {
  return (
    <section className="coverage-banner">
      <div>
        <p className="eyebrow">Tracking coverage</p>
        <h2>{coverage.percent}% of this user's reachable Discord footprint is covered</h2>
      </div>
      <p>
        Bot present in {coverage.trackedGuilds} of {coverage.accessibleGuilds} servers the user
        authorized. Activity outside those servers is intentionally not tracked.
      </p>
    </section>
  );
}
