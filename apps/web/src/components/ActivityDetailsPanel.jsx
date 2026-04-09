import { memo, useState } from "react";

function formatTimestamp(value) {
  if (!value) {
    return "Still active";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(seconds) {
  const totalMinutes = Math.round((seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${minutes}m`;
}

function MediaPreview({ item }) {
  if (item.kind === "video") {
    return (
      <video
        className="message-media"
        controls
        preload="metadata"
        src={item.url}
      >
        Your browser does not support embedded video previews.
      </video>
    );
  }

  return (
    <img
      alt={item.label || "Shared media"}
      className="message-media"
      src={item.url}
    />
  );
}

function MessageList({ items }) {
  if (!items.length) {
    return <p className="empty-state">No tracked messages yet.</p>;
  }

  return (
    <div className="activity-list">
      {items.map((item, index) => (
        <article
          key={`${item.occurredAt}-${item.channelId}-${index}`}
          className="activity-row"
        >
          <div className="activity-topline">
            <span className="pill">{item.channelName || item.channelId}</span>
            <time>{formatTimestamp(item.occurredAt)}</time>
          </div>
          {item.content ? (
            <p className="activity-copy">{item.content}</p>
          ) : null}
          {item.media?.length ? (
            <div className="message-media-grid">
              {item.media.map((mediaItem, mediaIndex) => (
                <MediaPreview
                  key={`${item.occurredAt}-${mediaItem.url}-${mediaIndex}`}
                  item={mediaItem}
                />
              ))}
            </div>
          ) : null}
          {!item.content && !item.media?.length ? (
            <p className="activity-copy">
              Message text was not captured for this older event.
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function VoiceList({ items }) {
  if (!items.length) {
    return <p className="empty-state">No tracked voice sessions yet.</p>;
  }

  return (
    <div className="activity-list">
      {items.map((item, index) => (
        <article
          key={`${item.startTime}-${item.channelId}-${index}`}
          className="activity-row"
        >
          <div className="activity-topline">
            <span className="pill">{item.channelName || item.channelId}</span>
            <span className="pill">{formatDuration(item.durationSeconds)}</span>
          </div>
          <div className="activity-copy">
            <strong>Joined:</strong> {formatTimestamp(item.startTime)}
            <br />
            <strong>Left:</strong> {formatTimestamp(item.endTime)}
          </div>
        </article>
      ))}
    </div>
  );
}

export const ActivityDetailsPanel = memo(function ActivityDetailsPanel({
  recentMessages,
  recentVoiceSessions,
}) {
  const [activeTab, setActiveTab] = useState("voice");

  return (
    <section className="panel activity-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Activity log</p>
        </div>
      </div>

      <div className="tab-row">
        <button
          className={`tab-button ${activeTab === "voice" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("voice")}
          type="button"
        >
          Voice channels
        </button>
        <button
          className={`tab-button ${activeTab === "messages" ? "tab-button-active" : ""}`}
          onClick={() => setActiveTab("messages")}
          type="button"
        >
          Messages
        </button>
      </div>

      {activeTab === "voice" ? (
        <VoiceList items={recentVoiceSessions || []} />
      ) : (
        <MessageList items={recentMessages || []} />
      )}
    </section>
  );
});
