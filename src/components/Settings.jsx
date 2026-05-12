import { useState } from 'react'
import './Settings.css'

export default function Settings({ currentKey, onSave, onCancel }) {
  const [key, setKey] = useState(currentKey || '')
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) return
    onSave(trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClear = () => {
    setKey('')
    localStorage.removeItem('anthropic_api_key')
    onSave('')
  }

  return (
    <div className="settings-overlay">
      <div className="settings-card">
        <div className="settings-header">
          <h2>Settings</h2>
          {onCancel && (
            <button className="close-btn" onClick={onCancel} aria-label="Close">✕</button>
          )}
        </div>

        <section className="settings-section">
          <h3>Anthropic API Key</h3>
          <p className="settings-hint">
            Your key is stored only in this browser's <code>localStorage</code> and never
            sent to any server other than <code>api.anthropic.com</code>.
          </p>
          <form onSubmit={handleSubmit} className="key-form">
            <div className="input-row">
              <input
                type={show ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-ant-..."
                className="key-input"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="button"
                className="toggle-btn"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide key' : 'Show key'}
              >
                {show ? '🙈' : '👁'}
              </button>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn-primary" disabled={!key.trim()}>
                {saved ? '✓ Saved' : 'Save Key'}
              </button>
              {currentKey && (
                <button type="button" className="btn-danger" onClick={handleClear}>
                  Clear Key
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="settings-section">
          <h3>Data Sources</h3>
          <ul className="source-list">
            <li>
              <span className="source-name">Yahoo Finance</span>
              <span className="source-via">via allorigins.win proxy (no auth required)</span>
            </li>
            <li>
              <span className="source-name">Anthropic Claude API</span>
              <span className="source-via">requires API key above</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
