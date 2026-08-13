// ─── Navbar (top bar) ─────────────────────────────────────────────────────────
//
// step034. Same file, same export, much less of it.
//
// WHAT CHANGED
// ────────────
// • h-16 → h-12. The old bar spent 64px on a title the sidebar already
//   highlights and a subtitle nobody reads twice.
// • The subtitle is gone for the same reason.
// • <GlobalSearch /> is no longer mounted here. Search moved into the command
//   menu so there is one search surface rather than two.
//
//   NOTE ON THE SHORTCUT: GlobalSearch.jsx binds Ctrl/Cmd+K itself. That
//   listener was registered on mount and torn down on unmount, so dropping the
//   component here removes the binding with it — the command menu's own
//   handler is not competing with a second one. GlobalSearch.jsx is now
//   unimported and can be deleted once the module batches land; it is left on
//   disk rather than removed because the batch script copies files and does not
//   delete them.

import React, { useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Menu,
  X,
  Search,
} from 'lucide-react'
import { useAuthStore }   from '../../stores/authStore.js'
import { useUiStore }     from '../../stores/uiStore.js'
import { Avatar }         from '../ui/Avatar.jsx'
import { Badge }          from '../ui/Badge.jsx'
import { useUnreadCount } from '../../hooks/useNotifications.js'

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/leads':         'Leads',
  '/contacts':      'Contacts',
  '/meetings':      'Meetings',
  '/tasks':         'Tasks',
  '/opportunities': 'Opportunities',
  '/analytics':     'Analytics',
  '/notifications': 'Notifications',
  '/settings':      'Settings',
  '/users':         'Members',
}

export function Navbar() {
  const { user, logout } = useAuthStore()
  const {
    profileMenuOpen,
    toggleProfileMenu,
    closeAllDropdowns,
    toggleMobileMenu,
    mobileMenuOpen,
    openCommandMenu,
  } = useUiStore()

  const navigate   = useNavigate()
  const location   = useLocation()
  const profileRef = useRef(null)

  const title = PAGE_TITLES[location.pathname] || 'Accord CRM'
  const { data: unread = 0 } = useUnreadCount()

  // Close dropdowns on outside click.
  //
  // The notifications ref is gone — that button navigates rather than opening a
  // dropdown, so guarding it was checking a menu that never existed. The
  // previous version required BOTH refs to miss before closing, which meant a
  // click anywhere outside still had to clear the notifications ref first.
  useEffect(() => {
    function handleClick(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        closeAllDropdowns()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [closeAllDropdowns])

  const handleLogout = () => {
    closeAllDropdowns()
    logout()
    navigate('/login')
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-3 gap-2 flex-shrink-0 z-20">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors duration-120"
        onClick={toggleMobileMenu}
        aria-label="Menu"
      >
        {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <h1 className="font-display font-semibold text-gray-900 text-sm truncate">
        {title}
      </h1>

      <div className="flex items-center gap-0.5 ml-auto">
        {/* Command menu — the same surface the sidebar's Search button opens.
            Kept here too because the reference puts a trigger top-right and
            because a discoverable button is what teaches the shortcut. */}
        <button
          onClick={openCommandMenu}
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-120 lg:hidden"
          aria-label="Search"
        >
          <Search size={17} />
        </button>

        <button
          onClick={() => { closeAllDropdowns(); navigate('/notifications') }}
          className="relative p-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors duration-120"
          aria-label="Notifications"
        >
          <Bell size={17} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-teal-500 rounded-full ring-2 ring-white" />
          )}
        </button>

        <div className="relative" ref={profileRef}>
          <button
            onClick={toggleProfileMenu}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-gray-100 transition-colors duration-120"
          >
            <Avatar name={user?.name || 'User'} size="sm" />
            <ChevronDown
              size={13}
              className={`text-gray-400 transition-transform duration-120 ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileMenuOpen && (
            <ProfileDropdown
              user={user}
              onLogout={handleLogout}
              onClose={closeAllDropdowns}
              navigate={navigate}
            />
          )}
        </div>
      </div>
    </header>
  )
}

function ProfileDropdown({ user, onLogout, onClose, navigate }) {
  return (
    <div className="absolute right-0 top-full mt-1 w-56 card shadow-card-lg py-1 z-50 animate-fade-in">
      <div className="px-3 py-2 border-b border-gray-100">
        <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
        <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        <Badge variant={user?.role} className="mt-1">{user?.role}</Badge>
      </div>

      <div className="py-1">
        <button
          onClick={() => { navigate('/settings'); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-120"
        >
          <User size={14} className="text-gray-400" />
          My profile
        </button>
        <button
          onClick={() => { navigate('/settings'); onClose() }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-120"
        >
          <Settings size={14} className="text-gray-400" />
          Settings
        </button>
      </div>

      <div className="border-t border-gray-100 py-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-500/10 transition-colors duration-120"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Navbar
