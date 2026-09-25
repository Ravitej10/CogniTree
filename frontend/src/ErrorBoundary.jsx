import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surface the real error in the browser console instead of it vanishing
    // behind a blank page.
    console.error("CogniTree crashed:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
            background: "#F7F8F4",
            color: "#14231C",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong loading this page.
          </h1>
          <p style={{ color: "#8B9A8C", maxWidth: 480, marginBottom: "1rem" }}>
            Open your browser's developer console (F12 → Console tab) to see the
            exact error. The message will start with "CogniTree crashed:".
          </p>
          <pre
            style={{
              background: "#FFFFFF",
              border: "1px solid #D8DED4",
              borderRadius: 8,
              padding: "1rem",
              maxWidth: 600,
              overflow: "auto",
              fontSize: 12,
              textAlign: "left",
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
