import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUiStore = create(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      notificationsOpen: false,
      profileMenuOpen: false,
      mobileMenuOpen: false,

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
    }),
    {
      name: 'nexus-ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
    },
  ),
)
