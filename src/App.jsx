import { Navigate, Route, Routes } from "react-router-dom";
import Welcome from "./pages/Welcome.jsx";
import CheckIn from "./pages/CheckIn.jsx";

/**
 * Zennara walk-in check-in tablet.
 *
 *   /          the welcome screen the tablet rests on between guests
 *   /check-in  the whole check-in: WhatsApp OTP → details → pre-consult form
 *
 * The doctor's side of this lives in its own deployment (../Doctor Panel) and
 * is deliberately not reachable from here — this build runs on a device a
 * guest is holding.
 */
export default function App() {
  return (
    <div className="zp">
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
