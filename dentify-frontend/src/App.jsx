import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./home";                                         
import DentistRegistration from "./pages/auth/invitation/DentistRegistration";  


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Dashboard />} />
        <Route path="/registro/dentista"       element={<DentistRegistration />} />
        <Route path="/registro/secretario"     element={<SecretaryRegistration />} />
      </Routes>
    </BrowserRouter>
  );
}