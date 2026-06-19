import { Component, type ReactNode } from "react";
import { ErrorScreen } from "./ErrorScreen";

/**
 * Cattura QUALUNQUE errore di render dell'app e mostra la schermata d'errore
 * centrata e ben fatta, invece di una pagina bianca rotta.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          code="ERRORE"
          message="Qualcosa si è rotto"
          detail={this.state.error.message || "Un imprevisto ha interrotto WhyChat. Ricarica per riprendere."}
        />
      );
    }
    return this.props.children;
  }
}
