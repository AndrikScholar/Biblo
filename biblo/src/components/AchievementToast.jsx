import { useEffect, useState } from 'react'
import './AchievementToast.css'

export default function AchievementToast({ title, description, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50)
    const hideTimer = setTimeout(() => setVisible(false), 4500)
    const doneTimer = setTimeout(() => onDone?.(), 5200)
    return () => {
      clearTimeout(showTimer)
      clearTimeout(hideTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div className={`achievement-toast${visible ? ' is-visible' : ''}`} role="status">
      <span className="achievement-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path
            d="M12 2 L14.6 9.1 L22 9.4 L16.2 14.1 L18.2 21.4 L12 17.3 L5.8 21.4 L7.8 14.1 L2 9.4 L9.4 9.1 Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <div className="achievement-toast__text">
        <span className="achievement-toast__label">Logro desbloqueado</span>
        <span className="achievement-toast__title">{title}</span>
        <span className="achievement-toast__desc">{description}</span>
      </div>
    </div>
  )
}