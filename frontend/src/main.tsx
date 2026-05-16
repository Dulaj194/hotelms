import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n/config";
import i18n from "i18next";

// Update HTML lang attribute on language change
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// Initial set
document.documentElement.lang = i18n.language;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
