'use client'

import { useState, useEffect, useRef } from 'react'
import { UserCircle, Upload, CheckCircle, XCircle, Loader } from 'lucide-react'
import { checkUsernameAvailable, saveUserProfile, type UserProfile } from '../../lib/firebase'
import type { User } from 'firebase/auth'

const PRESET_AVATARS = [
  { id: 'indigo',  bg: '#6366F1', emoji: '💪' },
  { id: 'emerald', bg: '#10B981', emoji: '🥗' },
  { id: 'rose',    bg: '#F43F5E', emoji: '🎯' },
  { id: 'orange',  bg: '#F97316', emoji: '🏃' },
  { id: 'purple',  bg: '#8B5CF6', emoji: '⚡' },
  { id: 'cyan',    bg: '#06B6D4', emoji: '🏊' },
  { id: 'amber',   bg: '#EAB308', emoji: '⭐' },
  { id: 'teal',    bg: '#14B8A6', emoji: '🌿' },
]

const USERNAME_RE = /^[a-z0-9_]{3,20}$/

interface Props {
  user: User
  onComplete: (profile: UserProfile) => void
  onLogout: () => void
  existingProfile?: UserProfile | null
}

export default function ProfileSetup({ user, onComplete, onLogout, existingProfile }: Props) {
  const isEdit = !!existingProfile

  const [username,    setUsername]    = useState(existingProfile?.username     ?? '')
  const [displayName, setDisplayName] = useState(existingProfile?.displayName  ?? '')
  const [birthDate,   setBirthDate]   = useState(existingProfile?.birthDate    ?? '')
  const [avatarType,  setAvatarType]  = useState<'preset'|'upload'>(existingProfile?.avatarType ?? 'preset')
  const [avatarPreset,setAvatarPreset]= useState(existingProfile?.avatarPreset ?? 'indigo')
  const [avatarUrl,   setAvatarUrl]   = useState(existingProfile?.avatarUrl    ?? '')

  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'ok'|'taken'|'invalid'>('idle')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const checkTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const normalizeUsername = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '')

  useEffect(() => {
    const u = username.trim()
    if (!u) { setUsernameStatus('idle'); return }
    if (!USERNAME_RE.test(u)) { setUsernameStatus('invalid'); return }
    if (u === existingProfile?.username) { setUsernameStatus('ok'); return }

    setUsernameStatus('checking')
    if (checkTimer.current) clearTimeout(checkTimer.current)
    checkTimer.current = setTimeout(async () => {
      const available = await checkUsernameAvailable(u, user.uid)
      setUsernameStatus(available ? 'ok' : 'taken')
    }, 500)
    return () => { if (checkTimer.current) clearTimeout(checkTimer.current) }
  }, [username, user.uid, existingProfile?.username])

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 128
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')!
        const min = Math.min(img.width, img.height)
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size)
        setAvatarUrl(canvas.toDataURL('image/jpeg', 0.7))
        setAvatarType('upload')
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const canSave =
    USERNAME_RE.test(username.trim()) &&
    usernameStatus === 'ok' &&
    displayName.trim().length >= 2

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true); setError('')
    const profile: UserProfile = {
      username:     username.trim().toLowerCase(),
      displayName:  displayName.trim(),
      birthDate:    birthDate || undefined,
      avatarType,
      avatarPreset: avatarType === 'preset' ? avatarPreset : undefined,
      avatarUrl:    avatarType === 'upload'  ? avatarUrl    : undefined,
      createdAt:    existingProfile?.createdAt ?? new Date().toISOString(),
    }
    const ok = await saveUserProfile(user.uid, profile, existingProfile?.username)
    if (ok) {
      onComplete(profile)
    } else {
      setError('Erro ao salvar perfil. Tente novamente.')
      setSaving(false)
    }
  }

  const selectedPreset = PRESET_AVATARS.find(a => a.id === avatarPreset) ?? PRESET_AVATARS[0]

  return (
    <div className="login-screen" style={{ overflowY: 'auto', padding: '24px 0' }}>
      <div className="login-card" style={{ maxHeight: 'none' }}>
        <div className="login-logo">
          <UserCircle size={48} color="var(--primary)" strokeWidth={1.8} />
        </div>
        <div className="login-brand">{isEdit ? 'Editar perfil' : 'Complete seu perfil'}</div>
        {!isEdit && (
          <div className="login-tagline">
            O app foi atualizado! Complete seu perfil para continuar.
          </div>
        )}

        <div className="login-form" style={{ gap: 12, marginTop: 12 }}>

          {/* Avatar */}
          <label className="login-label">Foto de perfil</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
            {PRESET_AVATARS.map(av => (
              <button
                key={av.id}
                type="button"
                onClick={() => { setAvatarPreset(av.id); setAvatarType('preset') }}
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: av.bg,
                  border: avatarType === 'preset' && avatarPreset === av.id
                    ? '3px solid var(--primary)' : '3px solid transparent',
                  fontSize: 22, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  boxShadow: avatarType === 'preset' && avatarPreset === av.id
                    ? '0 0 0 2px var(--bg)' : 'none',
                  transition: 'all 0.15s',
                }}
                title={av.emoji}
              >
                {av.emoji}
              </button>
            ))}
            {/* Upload button */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--surface-2)',
                border: avatarType === 'upload'
                  ? '3px solid var(--primary)' : '3px solid transparent',
                cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', transition: 'all 0.15s',
              }}
              title="Enviar foto"
            >
              {avatarType === 'upload' && avatarUrl
                ? <img src={avatarUrl} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} alt="avatar" />
                : <Upload size={18} />
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>

          {/* Preview do avatar selecionado */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: avatarType === 'upload' && avatarUrl ? 'transparent' : selectedPreset.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, border: '3px solid var(--primary-mid)',
              overflow: 'hidden',
            }}>
              {avatarType === 'upload' && avatarUrl
                ? <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="avatar" />
                : selectedPreset.emoji
              }
            </div>
          </div>

          {/* Username */}
          <label className="login-label">Nome de usuário</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="login-input"
              style={{ paddingRight: 36, width: '100%', boxSizing: 'border-box' }}
              placeholder="ex: joao_silva (3-20 caracteres)"
              value={username}
              onChange={e => setUsername(normalizeUsername(e.target.value))}
              maxLength={20}
              autoCapitalize="none"
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
              {usernameStatus === 'checking' && <Loader size={16} style={{ color: 'var(--text-secondary)', animation: 'spin 1s linear infinite' }} />}
              {usernameStatus === 'ok'       && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && <XCircle size={16} style={{ color: 'var(--error)' }} />}
            </span>
          </div>
          {usernameStatus === 'taken'   && <span style={{ fontSize: 12, color: 'var(--error)', marginTop: -6 }}>Nome de usuário já está em uso</span>}
          {usernameStatus === 'invalid' && <span style={{ fontSize: 12, color: 'var(--error)', marginTop: -6 }}>Apenas letras, números e _ (3-20 caracteres)</span>}
          {usernameStatus === 'ok'      && <span style={{ fontSize: 12, color: 'var(--success)', marginTop: -6 }}>Disponível!</span>}

          {/* Display name */}
          <label className="login-label">Nome completo</label>
          <input
            type="text"
            className="login-input"
            placeholder="Seu nome"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={50}
          />

          {/* Birth date */}
          <label className="login-label">Data de nascimento (opcional)</label>
          <input
            type="date"
            className="login-input"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />

          {error && <div className="login-error">{error}</div>}

          <button
            className="btn"
            style={{ marginTop: 4 }}
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Continuar'}
          </button>

          {!isEdit && (
            <div className="login-footer" style={{ marginTop: 8 }}>
              <button className="login-link" onClick={onLogout}>Usar outra conta</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
