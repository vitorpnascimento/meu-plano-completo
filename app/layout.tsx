import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '💪 Meu Plano - Dieta & Treino',
  description: 'Acompanhamento completo de dieta, treino, peso e notas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
