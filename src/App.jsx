import { useState, useEffect } from 'react'
import Settings from './components/Settings.jsx'
import './App.css'

// Placeholder — replace this entire file with the main App.jsx you provide.
export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('anthropic_api_key') || '')
  const [showSettings, setShowSettings] = useState(!apiKey)

  useEffect(() => {
    if (!apiKey) setShowSettings(true)
  }, [apiKey])

  const handleSaveKey = (key) => {
    localStorage.setItem('anthropic_api_key', key)
    setApiKey(key)
    setShowSettings(false)
  }

  if (showSettings) {
    return (
      <Settings
        currentKey={apiKey}
        onSave={handleSaveKey}
        onCancel={apiKey ? () => setShowSettings(false) : null}
      />
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>GeoMarket Intelligence</h1>
        <p className="subtitle">9-Agent AI Financial Analysis · Indian Equity Markets</p>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          ⚙ Settings
        </button>
      </header>
      <main className="app-main">
        <p className="placeholder-text">
          Replace <code>src/App.jsx</code> with your main application code.
        </p>
      </main>
    </div>
  )
}
