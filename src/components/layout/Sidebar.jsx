// ─── Sidebar ──────────────────────────────────────────────────────────────────
//
// step034. Rebuilt against the Twenty reference: a light rail with a workspace
// header, a section-labelled object list, and a collapse to icons.
//
// WHY THIS IS LIGHT NOW, AND WHY THAT COST NOTHING
// ────────────────────────────────────────────────
// The old rail painted itself with inline hex literals — style={{ background:
// '#0f1923' }}, '#1e2d40', '#8fa3b8', '#4a637a'. That is why step033's token
// retune did not visibly touch the sidebar: those values bypassed the token
// system entirely and no theme change could reach them.
//
// Everything here uses the gray ramp instead. In dark mode index.css INVERTS
// that ramp, so `bg-gray-100` is a light rail in light mode and a dark rail in
// dark mode automatically, with no `dark:` variant and no second palette to
// maintain. The one exception is the logo, below.
//
// THE LOGO
// ────────
// Logo.jsx serves two files: a white wordmark for dark backgrounds and a dark
// one for light. A rail that changes brightness with the theme therefore needs
// to change asset with it. Rather than read the theme in JS — which would need
// the resolved value of 'system' and would flicker on first paint — both are
// rendered and one is hidden by CSS. `dark:hidden` is a deliberate exception to
// this codebase's no-dark-variant rule: it is the only place where a *file*,
// not a colour, has to change.

import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserCog,
  Calendar,
  CheckSquare,
  BarChart2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Target,
  Bell,
  Briefcase,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore.js'
import { useUiStore }   from '../../stores/uiStore.js'
import { Avatar }       from '../ui/Avatar.jsx'

// Grouped rather than flat. The reference groups objects under a "Workspace"
// heading and keeps administration separate; the same split already existed
// here implicitly as NAV_ITEMS vs ADMIN_ITEMS, so this only makes it visible.
const WORKSPACE_ITEMS = [
  { label: 'Dashboard',     to: '/dashboard',     icon: LayoutDashboard },
  { label: 'Leads',         to: '/leads',         icon: Target },
  { label: 'Contacts',      to: '/contacts',      icon: Users },
  { label: 'Opportunities', to: '/opportunities', icon: Briefcase },
  { label: 'Tasks',         to: '/tasks',         icon: CheckSquare },
  { label: 'Meetings',      to: '/meetings',      icon: Calendar },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Analytics',     to: '/analytics',     icon: BarChart2 },
]

const ADMIN_ITEMS = [
  { label: 'Members', to: '/users',    icon: UserCog },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed, toggleSidebar, openCommandMenu } = useUiStore()
  const navigate = useNavigate()

  // UNCHANGED from the previous sidebar, deliberately. Moving this onto
  // memberships.role is real work with real consequences (profiles.role is
  // still trigger-mirrored and lib/permissions.js reads it), and doing it
  // inside a layout batch would bury a permissions change in a UI diff.
  const isAdmin = user?.role === 'Admin'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`
        relative flex flex-col h-full flex-shrink-0
        bg-gray-100 border-r border-gray-200
        transition-[width] duration-120 ease-out
        ${sidebarCollapsed ? 'w-[52px]' : 'w-[228px]'}
      `}
    >
      {/* ── Workspace header ─────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 h-12 flex-shrink-0 ${sidebarCollapsed ? 'justify-center px-1' : 'px-3'}`}>
        {sidebarCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors duration-120"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        ) : (
          <>
            {/* Both assets ship; CSS picks one. See the note at the top. */}
            <img
              src="/accord-logo-black.svg"
              alt="Accord Technologies Limited"
              className="h-[22px] w-auto dark:hidden"
            />
            <img
              src="/accord-logo-white.svg"
              alt="Accord Technologies Limited"
              className="h-[22px] w-auto hidden dark:block"
            />
            <button
              onClick={toggleSidebar}
              className="ml-auto p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-200 transition-colors duration-120"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </>
        )}
      </div>

      {/* ── Search trigger ───────────────────────────────────────────────────
          Not an input. The field lives inside the command menu now, so there is
          one search surface instead of two competing ones. This button and the
          Ctrl+K shortcut open the same thing. */}
      <div className={`flex-shrink-0 ${sidebarCollapsed ? 'px-1.5 pb-2' : 'px-2 pb-2'}`}>
        <button
          onClick={openCommandMenu}
          title={sidebarCollapsed ? 'Search  (Ctrl K)' : undefined}
          className={`
            w-full flex items-center gap-2 rounded-lg
            text-sm text-gray-500 hover:text-gray-900
            bg-white border border-gray-200 hover:border-gray-300
            transition-colors duration-120
            ${sidebarCollapsed ? 'justify-center py-1.5' : 'px-2 py-1.5'}
          `}
        >
          <Search size={15} className="flex-shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span>Search</span>
              <kbd className="ml-auto text-[10px] font-medium text-gray-400 border border-gray-200 rounded px-1 py-px">
                Ctrl K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-1.5 pb-2 scrollbar-hide">
        <SectionLabel collapsed={sidebarCollapsed}>Workspace</SectionLabel>

        <div className="space-y-px">
          {WORKSPACE_ITEMS.map(({ label, to, icon: Icon }) => (
            <SidebarNavItem key={to} to={to} icon={Icon} label={label} collapsed={sidebarCollapsed} />
          ))}
        </div>

        {isAdmin && (
          <>
            <SectionLabel collapsed={sidebarCollapsed}>Administration</SectionLabel>
            <div className="space-y-px">
              {ADMIN_ITEMS.map(({ label, to, icon: Icon }) => (
                <SidebarNavItem key={to} to={to} icon={Icon} label={label} collapsed={sidebarCollapsed} />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* ── User ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-200 p-1.5">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-1.5">
            <Avatar name={user?.name || 'User'} size="sm" />
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-500/10 transition-colors duration-120"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-1.5 py-1 rounded-lg">
            <Avatar name={user?.name || 'User'} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate leading-tight">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate leading-tight">
                {user?.role || ''}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-500/10 transition-colors duration-120"
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

function SectionLabel({ children, collapsed }) {
  // Collapsed, a text heading would wrap or clip. A rule carries the same
  // "these are separate groups" information in 52px.
  if (collapsed) return <div className="my-2 mx-2 border-t border-gray-200" />
  return (
    <p className="text-[11px] font-medium text-gray-400 px-2 pt-3 pb-1 select-none">
      {children}
    </p>
  )
}

function SidebarNavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm
         transition-colors duration-120 whitespace-nowrap
         ${collapsed ? 'justify-center' : ''}
         ${isActive
           // Active is a raised white chip against the grey rail, not a colour
           // wash. The accent stays on the icon alone, so a page with several
           // teal elements does not have the nav competing with them.
           ? 'bg-white text-gray-900 font-medium border border-gray-200 shadow-card'
           : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900 border border-transparent'
         }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-teal-600' : 'text-gray-400'}`} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}

export default Sidebar
