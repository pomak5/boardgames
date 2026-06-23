import { Navigate, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { AliasApp } from "./play/alias/AliasApp";
import { HomeHub } from "./play/home/HomeHub";
import { ImaginariumApp } from "./play/imaginarium/ImaginariumApp";
import { Debug3D } from "./play/imaginarium/__Debug3D";
import { App as PlayApp } from "./play/PlayApp";
import { ProfilePage } from "./play/profile/ProfilePage";
import { UnoApp } from "./play/uno/UnoApp";

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<HomeHub />} />
        <Route path="/codenames" element={<PlayApp />} />
        <Route path="/codenames/:room" element={<PlayApp />} />
        <Route path="/uno" element={<UnoApp />} />
        <Route path="/uno/:room" element={<UnoApp />} />
        <Route path="/alias" element={<AliasApp />} />
        <Route path="/alias/:room" element={<AliasApp />} />
        <Route path="/__im3d" element={<Debug3D />} />
        <Route path="/imaginarium" element={<ImaginariumApp />} />
        <Route path="/imaginarium/:room" element={<ImaginariumApp />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
