function GuildBadge({ installed, canInstall }) {
  if (installed) {
    return <span className="pill pill-live">Installed</span>;
  }

  if (canInstall) {
    return <span className="pill">Ready to install</span>;
  }

  return <span className="pill">Need Manage Server</span>;
}

function GuildAvatar({ iconUrl, name }) {
  if (iconUrl) {
    return <img className="guild-avatar" src={iconUrl} alt="" />;
  }

  return (
    <div className="guild-avatar guild-avatar-fallback">
      {(name || "?").slice(0, 1).toUpperCase()}
    </div>
  );
}

export function GuildInstallPanel({ botInstallUrl, guilds, isOpen, onClose }) {
  const safeGuilds = Array.isArray(guilds) ? guilds : [];
  const totalPending = safeGuilds.filter((guild) => !guild.botPresent).length;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="overlay-backdrop" onClick={onClose} role="presentation">
      <section
        className="overlay-card panel guild-install-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Server installs</p>
            <p className="panel-title">Choose which servers Disclytics should track</p>
          </div>
          <div className="header-actions">
            {botInstallUrl ? (
              <a className="secondary-button" href={botInstallUrl} target="_blank" rel="noreferrer">
                Generic invite
              </a>
            ) : null}
            <button className="secondary-button" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>

        <p className="guild-install-copy">
          Open Discord's install screen for the exact server you want. Tracking only starts in servers
          where the bot is installed and can see the relevant channels.
        </p>

        <div className="guild-install-summary">
          <span>{safeGuilds.length} authorized servers</span>
          <span>{totalPending} still missing the bot</span>
        </div>

        {safeGuilds.length ? (
          <div className="guild-list">
            {safeGuilds.map((guild) => (
              <article key={guild.guildId} className="guild-row">
                <div className="guild-meta">
                  <GuildAvatar iconUrl={guild.iconUrl} name={guild.name} />
                  <div>
                    <h4>{guild.name}</h4>
                    <GuildBadge installed={guild.botPresent} canInstall={guild.canInstall} />
                  </div>
                </div>

                {guild.botPresent ? (
                  <span className="secondary-button button-static">Bot already installed</span>
                ) : guild.canInstall ? (
                  <a
                    className="primary-button"
                    href={guild.installUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Invite to this server
                  </a>
                ) : (
                  <span className="secondary-button button-static">No permission to install</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No authorized servers available yet. Restart the API after backend changes, then log in
            again to refresh your server list.
          </p>
        )}
      </section>
    </div>
  );
}
