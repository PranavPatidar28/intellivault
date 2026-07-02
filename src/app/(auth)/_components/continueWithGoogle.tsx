"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"

const GoogleIcon = () => <svg className="size-5 shrink-0" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100" height="100" viewBox="0 0 48 48">
<path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
</svg>

export const ContinueWithGoogle = ({ callbackURL = "/" }: { callbackURL?: string }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClickHandler = async () => {
    if (isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL })
      // better-auth resolves with an { error } object rather than throwing.
      if (result?.error) {
        setError(result.error.message || "Couldn't continue with Google. Please try again.")
        setIsLoading(false)
      }
      // On success the browser is redirected to Google, so we intentionally
      // keep the button in its loading state until navigation occurs.
    } catch (err) {
      console.error("Google sign-in error:", err)
      setError("Couldn't continue with Google. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <button
        type="button"
        onClick={onClickHandler}
        disabled={isLoading}
        aria-busy={isLoading}
        className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border bg-background text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground hover:border-ring/40 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
      >
        {isLoading ? <Spinner /> : <GoogleIcon />}
        <span>{isLoading ? "Connecting…" : "Continue with Google"}</span>
      </button>
    </div>
  )
}
