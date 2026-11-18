import React from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/application.css'
import App from '../components/App'

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('react-root')
  if (el) {
    createRoot(el).render(<App />)
  }
})
