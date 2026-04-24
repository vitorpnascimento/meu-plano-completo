'use client'

import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { resendVerificationEmail } from '../../lib/firebase'
import type { User } from 'firebase/auth'

interface Props {
  user: User
  onLogout: () => void
}

export default function EmailVerification({ user, onLogout }: Props) {
  const [sent,    setSent]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const handleResend = async () => {
    setLoading(true); setError('')
    try {
      await resendVerificationEmail(user)
      setSent(true)
    } catch {
      setError('Não foi possível reenviar. Tente novamente em alguns minutos.')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckVerified = () => {
    window.location.reload()
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <MailCheck size={48} color="var(--primary)" strokeWidth={1.8} />
        </div>
        <div className="login-brand">Verifique seu email</div>
        <div className="login-tagline">
          Enviamos um link de verificação para<br />
          <strong>{user.email}</strong>
        </div>

        <div className="login-form" style={{ marginTop: 8 }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: '0 0 16px' }}>
            Clique no link no email para ativar sua conta. Depois volte aqui e clique em "Já verifiquei".
          </p>

          {error && <div className="login-error">{error}</div>}
          {sent  && <div style={{ color: 'var(--success)', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>Email reenviado!</div>}

          <button className="btn" onClick={handleCheckVerified}>
            Já verifiquei — Entrar
          </button>

          <button
            className="btn"
            style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', marginTop: 8 }}
            onClick={handleResend}
            disabled={loading || sent}
          >
            {loading ? 'Enviando...' : 'Reenviar email de verificação'}
          </button>
        </div>

        <div className="login-footer">
          <button className="login-link" onClick={onLogout}>Usar outra conta</button>
        </div>
      </div>
    </div>
  )
}
