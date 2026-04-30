/**
 * Per-card error boundary. A render error in one chart shouldn't take
 * down the surrounding grid.
 */

"use client";

import { Icon } from "@iconify/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Stable id used in console / Sentry breadcrumbs to identify the chart. */
  chartId: string;
}

interface State {
  err: Error | null;
}

export class ChartErrorBoundary extends Component<Props, State> {
  override state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    // Log with the chart id so Sentry / Railway logs are filterable.
    console.error("[ChartCard] render error:", {
      chartId: this.props.chartId,
      message: err.message,
      stack: err.stack,
      componentStack: info.componentStack,
    });
  }

  reset = () => {
    this.setState({ err: null });
  };

  override render() {
    if (!this.state.err) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-foreground/40">
        <Icon icon="solar:danger-triangle-bold" width={28} />
        <p className="text-xs font-medium">Error al cargar gráfica</p>
        <button
          className="text-[11px] underline text-foreground/60 hover:text-foreground"
          type="button"
          onClick={this.reset}
        >
          Reintentar
        </button>
      </div>
    );
  }
}
