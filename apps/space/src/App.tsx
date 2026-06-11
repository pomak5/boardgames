import ErrorBoundary from "./components/ErrorBoundary";
import { App as PlayApp } from "./play/PlayApp";

function App() {
  return (
    <ErrorBoundary>
      <PlayApp />
    </ErrorBoundary>
  );
}

export default App;
