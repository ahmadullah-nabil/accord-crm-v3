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
} from 'lucide-react'
import { useAuthStore }    from '../../stores/authStore.js'
import { useUiStore }      from '../../stores/uiStore.js'
import { Avatar }          from '../ui/Avatar.jsx'
import { Badge }           from '../ui/Badge.jsx'
import { useUnreadCount }  from '../../hooks/useNotifications.js'
import { GlobalSearch }   from './GlobalSearch.jsx'

const PAGE_TITLES = {
  '/dashboard':     { title: 'Dashboard',      sub: 'Overview of your pipeline'  },
  '/leads':         { title: 'Leads',          sub: 'Manage and track leads'     },
  '/contacts':      { title: 'Contacts',       sub: 'Your contact directory'     },
  '/meetings':      { title: 'Meetings',       sub: 'Scheduled meetings'         },
  '/tasks':         { title: 'Tasks',          sub: 'Pending tasks & follow-ups' },
  '/opportunities': { title: 'Opportunities',  sub: 'Deals pipeline'             },
  '/analytics':     { title: 'Analytics',      sub: 'Reports & insights'         },
  '/notifications': { title: 'Notifications',  sub: 'Activity & alerts'          },
  '/settings':      { title: 'Settings',       sub: 'Account & preferences'      },
  '/users':         { title: 'User Management', sub: 'Workspace members & roles' },
}

export function Navbar() {
  const { user, logout }    = useAuthStore()
  const {
    profileMenuOpen,
    toggleProfileMenu,
    closeAllDropdowns,
    toggleMobileMenu,
    mobileMenuOpen,
  } = useUiStore()

  const navigate   = useNavigate()
  const location   = useLocation()
  const notifRef   = useRef(null)
  const profileRef = useRef(null)

  const pageInfo = PAGE_TITLES[location.pathname] || { title: 'Accord CRM', sub: '' }
  const { data: unread = 0 } = useUnreadCount()

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e) {
      if (
        notifRef.current   && !notifRef.current.contains(e.target) &&
        profileRef.current && !profileRef.current.contains(e.target)
      ) {
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
    <header className="h-16 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0 z-20">
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden btn-ghost p-2"
        onClick={toggleMobileMenu}
      >
        {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <h1 className="font-display font-700 text-gray-900 text-xl leading-tight">
          {pageInfo.title}
        </h1>
        {pageInfo.sub && (
          <p className="text-xs text-gray-400 leading-tight">{pageInfo.sub}</p>
        )}
      </div>

      {/* Universal search — GlobalSearch renders the same slot the placeholder
          input previously occupied (same width, same breakpoint, same styling). */}
      <GlobalSearch />

      {/* Right actions */}
      <div className="flex items-center gap-1 ml-auto sm:ml-0">

        {/* Notifications — navigate to full page */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { closeAllDropdowns(); navigate('/notifications') }}
            className="relative btn-ghost p-2 rounded-xl"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-500 rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={toggleProfileMenu}
            className="flex items-center gap-2 btn-ghost px-2 py-1.5 rounded-xl"
          >
            <Avatar name={user?.name || 'User'} size="sm" />
            <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[120px] truncate">
              {user?.name || 'User'}
            </span>
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {profileMenuOpen && (
            <ProfileDropdown user={user} onLogout={handleLogout} onClose={closeAllDropdowns} navigate={navigate} />
          )}
        </div>
      </div>
    </header>
  )
}

function ProfileDropdown({ user, onLogout, onClose, navigate }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-56 card shadow-card-lg py-1 z-50 animate-fade-in">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        <Badge variant={user?.role} className="mt-1">{user?.role}</Badge>
      </div>

      <div className="py-1">
        <button
          onClick={() => { navigate('/settings'); onClose() }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <User size={15} className="text-gray-400" />
          My Profile
        </button>
        <button
          onClick={() => { navigate('/settings'); onClose() }}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Settings size={15} className="text-gray-400" />
          Settings
        </button>
      </div>

      <div className="border-t border-gray-100 py-1">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </div>
  )
}

export default Navbar
