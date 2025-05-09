// components/chat.tsx
'use client'

import { cn } from '@/lib/utils'
import { ChatList } from '@/components/chat-list'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyScreen } from '@/components/empty-screen'
import { useEffect, useState, useRef } from 'react'
import { useUIState, useAIState } from 'ai/rsc'
import { usePathname, useRouter } from 'next/navigation'
import { useScrollAnchor } from '@/lib/hooks/use-scroll-anchor'
import { toast } from 'sonner'
import { TickerTape } from '@/components/tradingview/ticker-tape'
import { MissingApiKeyBanner } from '@/components/missing-api-key-banner'
import { useUserStore } from '@/lib/store/user-store'
import { useUser } from '@clerk/nextjs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import Image from 'next/image'

export interface ChatProps extends React.ComponentProps<'div'> {
  id?: string
  missingKeys: string[]
}

export function Chat({ id, className, missingKeys }: ChatProps) {
  const router = useRouter()
  const path = usePathname()
  const [input, setInput] = useState('')
  const [messages] = useUIState()
  const [aiState] = useAIState()
  const { user, incrementMessageCount } = useUserStore()
  const { isSignedIn } = useUser()
  const [showLimitDialog, setShowLimitDialog] = useState(false)
  const [isNewChat, setIsNewChat] = useState(!path?.includes('/chat/'))
  const redirectInProgress = useRef(false)
  const redirectTimeout = useRef<NodeJS.Timeout | null | any>(null)

  // Handle chat creation and redirect
  useEffect(() => {
    if (
      isNewChat &&
      aiState?.chatId &&
      aiState.messages?.length > 0 &&
      !path?.includes(aiState.chatId) &&
      !redirectInProgress.current &&
      user?.subscriptionStatus === 'premium'
    ) {
      // Set flag to prevent multiple redirects
      redirectInProgress.current = true

      // Generate event to ensure chat list updates
      window.dispatchEvent(new Event('refetch-chats'))

      // Clear any existing timeout
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }

      // Add a delay to ensure the chat is registered in the database
      redirectTimeout.current = setTimeout(() => {
        // Use replace instead of push to avoid back-button issues
        router.replace(`/chat/${aiState.chatId}`)
        setIsNewChat(false)
        redirectInProgress.current = false
      }, 1500) // Increased delay to allow database operations to complete
    }

    // Cleanup timeout on component unmount
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
    }
  }, [aiState, isNewChat, path, router, user?.subscriptionStatus])

  // Display missing environment key errors
  useEffect(() => {
    missingKeys.forEach(key => {
      toast.error(`Falta tu ${key} como variable de entorno!`)
    })
  }, [missingKeys])

  // Check message limits for free users
  const checkMessageLimit = async (): Promise<boolean> => {
    if (!isSignedIn) {
      router.push('/sign-in')
      return false
    }

    // If user is premium, no need to check limit
    if (user?.subscriptionStatus === 'premium') {
      return true
    }

    // For free users, check and increment the message count
    const newCount = await incrementMessageCount()

    if (newCount > 3) {
      setShowLimitDialog(true)
      return false
    }

    return true
  }

  const { messagesRef, scrollRef, visibilityRef, isAtBottom, scrollToBottom } =
    useScrollAnchor()

  return (
    <div className="w-full overflow-auto" ref={scrollRef}>
      {messages.length ? (
        <MissingApiKeyBanner missingKeys={missingKeys} />
      ) : (
        <TickerTape />
      )}

      <div
        className={cn(messages.length ? 'pb-40 ' : 'pb-40 ', className)}
        ref={messagesRef}
      >
        {messages.length ? <ChatList messages={messages} /> : <EmptyScreen />}
        <div className="w-full h-px" ref={visibilityRef} />
      </div>

      <ChatPanel
        id={id}
        input={input}
        setInput={setInput}
        isAtBottom={isAtBottom}
        scrollToBottom={scrollToBottom}
        checkMessageLimit={checkMessageLimit}
      />

      {/* Message Limit Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center items-center my-2">
              <Image
                alt="Sad Dog"
                src={'/sad-dog.svg'}
                className="object-contain my-2"
                width={300}
                height={300}
                priority
              />
            </div>
            <DialogTitle>Límite de mensajes alcanzado</DialogTitle>
            <DialogDescription>
              Has alcanzado el límite de 3 mensajes para cuentas gratuitas.
              Actualiza a Premium para obtener mensajes ilimitados y más
              funciones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => setShowLimitDialog(false)}>
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setShowLimitDialog(false)
                router.push('/pricing')
              }}
            >
              Ver planes Premium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
