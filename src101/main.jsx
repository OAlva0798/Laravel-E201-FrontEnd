import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { SystemProvider } from "./assets/function/SystemContext";
import "./index.css";
import "bootstrap-icons/font/bootstrap-icons.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SystemProvider>
        <App />
      </SystemProvider>
    </BrowserRouter>
  </React.StrictMode>
);