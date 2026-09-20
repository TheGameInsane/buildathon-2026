import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { router } from './router.tsx'
import { Toaster } from '@/components/ui/sonner'
import { queryClient } from '@/lib/query-client'
import { motion } from '@/lib/tokens'
import { AuthProvider } from '@/lib/auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster duration={motion.toastAutoDismissMs} />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
