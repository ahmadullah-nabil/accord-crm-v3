import React from 'react'
import {
  X, Mail, Phone, Building2, Globe, MapPin,
  Tag, Pencil, Trash2, Calendar, TrendingUp, Link2,
} from 'lucide-react'
import { useContactsStore }                 from '../../stores/contactsStore.js'
import { useContact, useDeleteContact }     from '../../hooks/useContacts.js'
import { TYPE_COLORS, STATUS_COLORS }       from '../../lib/contactsData.js'
import { useRoleByName }                    from '../../hooks/useTeam.js'
import { Avatar }                           from '../ui/Avatar.jsx'
import { Skeleton, SkeletonText }           from '../ui/Skeleton.jsx'
import { TimelinePanel }                    from '../timeline/TimelinePanel.jsx'

export function ContactDetailPanel() {
  const { detailPanelOpen, closeDetail, selectedContactId, openEditModal } = useContactsStore()
  const deleteMutation = useDeleteContact()

  const { data: contact, isLoading } = useContact(
    detailPanelOpen ? selectedContactId : null
  )

  // Real role from public.profiles — replaces hardcoded "Account Owner"
  const assigneeRole = useRoleByName(contact?.assignee)

  const handleDelete = () => {
    if (!contact) return
    if (confirm(`Delete contact "${contact.name}"?`)) {
      deleteMutation.mutate(contact.id, { onSuccess: closeDetail })
    }
  }

  return (
    <>
      {detailPanelOpen && (
        <div className="fixed inset-0 bg-black/20 z-30" onClick={closeDetail} />
      )}

      <div
        className={`
          fixed inset-y-0 right-0 z-40 w-[400px] max-w-full bg-white shadow-card-lg
          flex flex-col transition-transform duration-300 ease-in-out
          ${detailPanelOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isLoading ? (
          <PanelSkeleton onClose={closeDetail} />
        ) : !contact ? null : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={contact.name} src={contact.avatar} size="lg" />
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-gray-900 text-base leading-tight truncate">
                    {contact.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.designation}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Building2 size={11} className="text-gray-300 flex-shrink-0" />
                    {contact.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <button
                  onClick={() => openEditModal(contact.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={closeDetail}
                  className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  title="Close"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Type + Status badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold
                  ${TYPE_COLORS[contact.type] || 'bg-gray-100 text-gray-600'}`}>
                  {contact.type}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                  ${STATUS_COLORS[contact.status] || 'bg-gray-100 text-gray-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full
                    ${contact.status === 'Active' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  {contact.status}
                </span>
              </div>

              {/* Contact info */}
              <Section title="Contact">
                <InfoRow icon={Mail}  label="Email"  value={contact.email}  href={`mailto:${contact.email}`} />
                <InfoRow icon={Phone} label="Phone"  value={contact.phone}  href={`tel:${contact.phone}`} />
                {contact.website && (
                  <InfoRow icon={Globe} label="Website" value={contact.website}
                    href={`https://${contact.website}`} external />
                )}
                {contact.address && (
                  <InfoRow icon={MapPin} label="Address" value={contact.address} />
                )}
              </Section>

              {/* Assignee */}
              <Section title="Assignee">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Avatar name={contact.assignee} size="md" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{contact.assignee}</p>
                    {assigneeRole && (
                      <p className="text-xs text-gray-500">{assigneeRole}</p>
                    )}
                  </div>
                </div>
              </Section>

              {/* Timeline */}
              <Section title="Timeline">
                <TimelinePanel
                  entityType="contact"
                  entityId={contact.id}
                  entityLabel={contact.name}
                />
              </Section>

              {/* Tags */}
              {contact.tags?.length > 0 && (
                <Section title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span key={tag}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                        <Tag size={10} /> {tag}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Notes */}
              {contact.notes && (
                <Section title="Notes">
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3">
                    {contact.notes}
                  </p>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, href, external }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon size={14} className="text-gray-400 flex-shrink-0" />
      <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          onClick={(e) => e.stopPropagation()}
          className="text-sm text-teal-600 hover:underline font-medium truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-800 font-medium truncate">{value}</span>
      )}
    </div>
  )
}

function PanelSkeleton({ onClose }) {
  return (
    <>
      <div className="flex items-start justify-between p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100">
          <X size={15} />
        </button>
      </div>
      <div className="p-5 space-y-5">
        <Skeleton className="h-8 w-40 rounded-full" />
        <SkeletonText lines={4} />
        <SkeletonText lines={3} />
      </div>
    </>
  )
}
