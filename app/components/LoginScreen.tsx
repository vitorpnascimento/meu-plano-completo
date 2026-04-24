'use client'

import { useState } from 'react'
import { Activity, Eye, EyeOff } from 'lucide-react'
import { createAccount, loginWithEmail } from '../../lib/firebase'

type View = 'login' | 'register'

function parseFirebaseError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':  return 'Este email já está cadastrado.'
    case 'auth/invalid-email':         return 'Email inválido.'
    case 'auth/weak-password':         return 'Senha muito curta (mínimo 6 caracteres).'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':    return 'Email ou senha incorretos.'
    case 'auth/user-not-found':        return 'Conta não encontrada.'
    case 'auth/too-many-requests':     return 'Muitas tentativas. Tente novamente em alguns minutos.'
    case 'auth/network-request-failed':return 'Sem conexão. Verifique a internet.'
    default:                           return 'Erro ao autenticar. Tente novamente.'
  }
}

export default function LoginScreen() {
  const [view,        setView]        = useState<View>('login')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  const switchView = (v: View) => {
    setView(v); setError(''); setEmail(''); setPassword(''); setShowPass(false)
  }

  const handleSubmit = async () => {
    if (!email.trim() || !password) return
    setError(''); setLoading(true)
    try {
      if (view === 'register') await createAccount(email.trim(), password)
      else                     await loginWithEmail(email.trim(), password)
    } catch (e: any) {
      setError(parseFirebaseError(e.code || ''))
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSubmit() }

  return (
    <div className="login-screen">
      <div className="login-card">

        <div className="login-logo">
          <Activity size={48} color="var(--primary)" strokeWidth={1.8} />
        </div>
        <div className="login-brand">Meu Plano</div>
        <div className="login-tagline">Acompanhamento de Dieta &amp; Treino</div>

        <div className="login-tabs">
          <button
            className={`login-tab ${view === 'login' ? 'active' : ''}`}
            onClick={() => switchView('login')}
          >
            Fazer Login
          </button>
          <button
            className={`login-tab ${view === 'register' ? 'active' : ''}`}
            onClick={() => switchView('register')}
          >
            Criar Conta
          </button>
        </div>

        <div className="login-form">
          <label className="login-label">Email</label>
          <input
            type="email"
            className="login-input"
            placeholder="seu@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={onKey}
            autoComplete="email"
            autoCapitalize="none"
          />

          <label className="login-label">Senha</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              className="login-input"
              style={{ paddingRight: 40, width: '100%', boxSizing: 'border-box' }}
              placeholder={view === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={onKey}
              autoComplete={view === 'register' ? 'new-password' : 'current-password'}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
              }}
              tabIndex={-1}
              aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <div className="login-error">{error}</div>
          )}

          <button
            className="btn"
            style={{ marginTop: 8 }}
            onClick={handleSubmit}
            disabled={loading || !email.trim() || !password}
          >
            {loading
              ? 'Aguarde...'
              : view === 'register'
              ? 'Criar Conta'
              : 'Entrar'}
          </button>
        </div>

        <div className="login-footer">
          {view === 'login' ? (
            <>Não tem conta?{' '}
              <button className="login-link" onClick={() => switchView('register')}>
                Criar agora
              </button>
            </>
          ) : (
            <>Já tem conta?{' '}
              <button className="login-link" onClick={() => switchView('login')}>
                Fazer login
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
