// ─── useCommandMenu ───────────────────────────────────────────────────────────
//
// step034. The keyboard binding for the command menu. Mounted EXACTLY ONCE, in
// AppLayout — a second mount registers a second listener and Ctrl+K starts
// toggling twice per press, which reads as "the shortcut does nothing".
//
// BINDINGS
//   Ctrl/Cmd + K   toggle, from anywhere including inside a text field
//   /              open, but ONLY when not typing
//   Escape         handled by the menu itself, so a closed menu does not
//                  swallow Escape from modals and slide-overs that are open
//
// WHY `/` NEEDS A GUARD AND Ctrl+K DOES NOT
// ─────────────────────────────────────────
// `/` is an ordinary character. Without the guard below, typing a date like
// 13/08 into any field, or a URL into a note, would open the command menu and
// eat the keystroke. The guard asks what has focus: an input, a textarea, a
// select, or anything contenteditable means the user is writing, so `/` stays a
// slash. Ctrl+K is not a character anyone types, so it works everywhere.

import { useEffect } from 'react'
import { useUiStore } from '../stores/uiStore.js'

function isTypingIn(target) {
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return Boolean(target.isContentEditable)
}

export function useCommandMenu() {
  useEffect(() => {
    const onKey = (e) => {
      // Read the store at event time rather than subscribing. This hook would
      // otherwise re-run its effect on every open/close, tearing down and
      // re-adding the listener for no reason.
      const { commandMenuOpen, openCommandMenu, closeCommandMenu } = useUiStore.getState()

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (commandMenuOpen) closeCommandMenu()
        else openCommandMenu()
        return
      }

      if (e.key === '/' && !commandMenuOpen && !isTypingIn(e.target)) {
        // Modifier combinations belong to the browser and the OS.
        if (e.metaKey || e.ctrlKey || e.altKey) return
        e.preventDefault()
        openCommandMenu()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
}

export default useCommandMenu
