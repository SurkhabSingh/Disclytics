import { memo } from "react";

function formatVoiceSeconds(seconds) {
  const totalMinutes = Math.round((seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

function VoiceChannelList({ channels }) {
  if (!channels.length) {
    return <p className="empty-state">No tracked voice channel time yet for this scope.</p>;
  }

  return (
    <div className="leaderboard-list">
      {channels.map((channel, index) => (
        <article key={`${channel.channelId}-${index}`} className="leaderboard-row">
          <div>
            <p className="leaderboard-rank">#{index + 1}</p>
            <h4>{channel.channelName || channel.channelId}</h4>
          </div>
          <span className="pill">{formatVoiceSeconds(channel.totalVoiceSeconds)}</span>
        </article>
      ))}
    </div>
  );
}

function ChatChannelList({ channels }) {
  if (!channels.length) {
    return <p className="empty-state">No tracked chat activity yet for this scope.</p>;
  }

  return (
    <div className="leaderboard-list">
      {channels.map((channel, index) => (
        <article key={`${channel.channelId}-${index}`} className="leaderboard-row">
          <div>
            <p className="leaderboard-rank">#{index + 1}</p>
            <h4>{channel.channelName || channel.channelId}</h4>
          </div>
          <span className="pill">{channel.messageCount} messages</span>
        </article>
      ))}
    </div>
  );
}

export const LeaderboardPanel = memo(function LeaderboardPanel({ chatChannels, voiceChannels, viewLabel }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Leaderboards</p>
          <p className="panel-title">{viewLabel} channel leaders</p>
        </div>
      </div>
      <div className="leaderboard-grid">
        <section>
          <p className="leaderboard-heading">Voice channels</p>
          <VoiceChannelList channels={voiceChannels || []} />
        </section>
        <section>
          <p className="leaderboard-heading">Chat channels</p>
          <ChatChannelList channels={chatChannels || []} />
        </section>
      </div>
    </section>
  );
});
