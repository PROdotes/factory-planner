/**
 * ROLE: Entry Point
 * PURPOSE: React DOM initialization and global CSS imports.
 * RELATION: Root of the application.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
