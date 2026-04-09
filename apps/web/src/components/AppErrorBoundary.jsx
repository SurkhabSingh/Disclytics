import React from "react";

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell">
          <div className="hero-card state-card">
            Disclytics hit an unexpected UI error. Reload the page to try again.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
