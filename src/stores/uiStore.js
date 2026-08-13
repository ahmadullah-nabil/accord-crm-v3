import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      notificationsOpen: false,
      profileMenuOpen: false,
      mobileMenuOpen: false,

      // step034. Deliberately NOT persisted — see partialize below. A command
      // menu that reopens itself on every page load is a bug, not a feature.
      commandMenuOpen: false,

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),

      toggleNotifications: () =>
        set((s) => ({
          notificationsOpen: !s.notificationsOpen,
          profileMenuOpen: false,
        })),

      toggleProfileMenu: () =>
        set((s) => ({
          profileMenuOpen: !s.profileMenuOpen,
          notificationsOpen: false,
        })),

      closeAllDropdowns: () =>
        set({ notificationsOpen: false, profileMenuOpen: false }),

      toggleMobileMenu: () =>
        set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),

      closeMobileMenu: () => set({ mobileMenuOpen: false }),

      // Opening the command menu closes the dropdowns and the mobile drawer.
      // Two overlays stacked at once leaves the user unsure which Escape goes
      // to, and on mobile the drawer would sit on top of the menu it opened.
      openCommandMenu: () =>
        set({
          commandMenuOpen: true,
          profileMenuOpen: false,
          notificationsOpen: false,
          mobileMenuOpen: false,
        }),

      closeCommandMenu: () => set({ commandMenuOpen: false }),

      toggleCommandMenu: () =>
        set((s) => ({
          commandMenuOpen: !s.commandMenuOpen,
          profileMenuOpen: false,
          notificationsOpen: false,
          mobileMenuOpen: false,
        })),
    }),
    {
      name: 'nexus-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
)
