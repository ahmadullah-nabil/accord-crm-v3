import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar }     from '../components/layout/Sidebar.jsx'
import { Navbar }      from '../components/layout/Navbar.jsx'
import { CommandMenu } from '../components/layout/CommandMenu.jsx'
import { useUiStore } from '../stores/uiStore.js'
import { useIntelligence } from '../hooks/useIntelligence.js'
import { useNotificationsRealtime } from '../hooks/useNotifications.js'
import { useAppliedAppearance } from '../hooks/useAppliedAppearance.js'
import { useCommandMenu } from '../hooks/useCommandMenu.js'
import { useMembershipStatus }  from '../hooks/useInvitations.js'
import { NoOrganization }       from '../components/auth/NoOrganization.jsx'
import { PendingInviteBanner }  from '../components/auth/PendingInviteBanner.jsx'

export function AppLayout() {
  const { mobileMenuOpen, closeMobileMenu } = useUiStore()
  const location = useLocation()

  // Mount intelligence scanner — runs once on login, every 30 min thereafter
  useIntelligence()

  // Mount the notifications realtime channel — exactly once for the whole app.
  // Do not mount this anywhere else; a second mount opens a duplicate channel.
  useNotificationsRealtime()

  // Apply the user's saved theme / accent / font size / density / motion.
  // Also mounted exactly once — a second mount would duplicate the OS theme
  // listener used by 'system' mode.
  useAppliedAppearance()

  // Command menu keyboard bindings (Ctrl/Cmd+K and `/`). step034.
  // Same rule as the two above: exactly once. A second mount would register a
  // second keydown listener and Ctrl+K would toggle twice per press.
  useCommandMenu()

  // Close mobile menu on route change
  useEffect(() => {
    closeMobileMenu()
  }, [location.pathname, closeMobileMenu])

  // ── Org gate ───────────────────────────────────────────────────────────────
  // Someone signed in but in no organisation must not see the CRM shell. Every
  // list would render zero and read as data loss rather than as "you are not on
  // a team yet" — which is the actual, fixable situation.
  //
  // Placed AFTER the hooks above so hook order never changes between renders,
  // and it returns instead of wrapping so the sidebar and navbar do not mount
  // around an empty app.
  //
  // While the check is in flight, nothing is rendered rather than a spinner:
  // it resolves in one round trip, and a flash of "no organisation" for a user
  // who has one would be worse than a blank moment.
  //
  // IT FAILS OPEN, on purpose. If the RPC errors, `membership` is undefined and
  // the app renders as normal. This screen is an EXPLANATION, not a security
  // boundary — RLS is the boundary, and it is enforced in the database whatever
  // this component decides. Failing closed would mean one bad deploy of this
  // check locks every user out of a CRM that is working perfectly.
  const { data: membership, isLoading: membershipLoading } = useMembershipStatus()
  if (membershipLoading) return null
  if (membership && !membership.hasMembership) return <NoOrganization />

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-gray-950/40 z-30 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar — hidden on mobile unless open */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto lg:flex lg:flex-col
          transition-transform duration-120 ease-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />

        {/* step066 — invitations that arrived AFTER this account existed.
            The 024 signup trigger can only fire on auth.users INSERT, so an
            invitation to someone who already has an account had no route in
            at all. Mounted here, above <main> and below the navbar, so it is
            reachable from every route and scrolls with nothing.

            Renders null when there is nothing pending, which is the normal
            case — it is not a permanent band of chrome. `shrink-0` so it
            never eats the height <main> passes down to the pages that fill
            the viewport. */}
        <PendingInviteBanner />

        {/* Scrollable page content.
            Padding tightened from p-4/p-6 to p-3/p-4 — the modules are still
            drawing their own cards and headers inside this, so the outer gutter
            is the one place a few px show up on every screen at once. */}
        <main className="flex-1 overflow-y-auto">
          {/* step055: `h-full` added. <main> already has a definite height (it
              is flex-1 inside an h-screen shell), but this wrapper did not
              pass it on, so a page could not ask for "the height that is
              left" — every page had to be a stack that happened to fit, and
              the Dashboard did not fit. With this, a page opting in with
              `h-full flex flex-col min-h-0` fills the viewport exactly and
              scrolls its own inner region instead of the window.

              SAFE FOR EVERY OTHER PAGE: this div has no background, border or
              overflow of its own. A page taller than the viewport overflows it
              exactly as before and <main> still scrolls; a shorter page just
              sits in a taller invisible box. */}
          <div className="p-3 lg:p-4 animate-fade-in h-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Command menu — rendered at the layout root so it overlays everything,
          and outside <main> so page scroll position is untouched when it opens.
          It returns null when closed; there is no cost to mounting it here. */}
      <CommandMenu />
    </div>
  )
}

export default AppLayout
