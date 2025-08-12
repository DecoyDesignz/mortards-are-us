import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Leaflet CSS (in addition to index.html for Vite bundling)
import 'leaflet/dist/leaflet.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
