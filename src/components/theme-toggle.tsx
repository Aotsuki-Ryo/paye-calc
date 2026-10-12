"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/**
 * Deliberately stateless.
 *
 * The obvious implementation tracks a `mounted` flag and reads `resolvedTheme`,
 * but the server cannot know the theme, so the first client render disagreed with
 * the server-rendered markup — a hydration mismatch, and an aria-label announcing
 * the wrong action. Instead the two icons are swapped by CSS on the `dark` class
 * (which next-themes sets on <html>, covered by suppressHydrationWarning), and the
 * label describes the action rather than the current state, so it is correct either
 * way and identical on both renders.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-9"
      aria-label="Toggle dark mode"
      // Only runs in the browser, so reading the resolved theme here is safe.
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="block dark:hidden" />
    </Button>
  )
}
