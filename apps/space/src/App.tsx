import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { HomeHub } from "./play/home/HomeHub";
import { App as PlayApp } from "./play/PlayApp";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeHub />} />
        <Route path="/codenames" element={<PlayApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
