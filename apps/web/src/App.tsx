import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { HomeHub } from "./play/home/HomeHub";
import { App as PlayApp } from "./play/PlayApp";
import { ProfilePage } from "./play/profile/ProfilePage";
import { UnoApp } from "./play/uno/UnoApp";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeHub />} />
        <Route path="/codenames" element={<PlayApp />} />
        <Route path="/uno" element={<UnoApp />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
