// ─── MIME assembly ────────────────────────────────────────────────────────────
//
// Builds an RFC 2822 message from the CRM's structured send request.
//
// TWO OF THE THREE PROVIDERS TAKE RAW MIME, ONE DOES NOT
// ──────────────────────────────────────────────────────
//   Gmail      messages.send  → base64url of the raw message
//   Microsoft  /me/sendMail   → base64 of the raw message, Content-Type: text/plain
//   Zoho       /messages      → a JSON object; there is NO raw-MIME endpoint
//
// So this module serves Google and Microsoft directly, and the Zoho adapter
// maps the same SendEmailInput onto Zoho's JSON fields. That asymmetry is a
// provider fact, not a design choice — see the note in providers/zoho.ts about
// what is lost on that path.
//
// ATTACHMENTS (PHASE 1b) SLOT IN WITHOUT A REWRITE
// ────────────────────────────────────────────────
// buildMimeMessage() already branches on `attachments.length`:
//
//   no attachments          with attachments
//   ──────────────          ────────────────
//   multipart/alternative   multipart/mixed
//     ├── text/plain          ├── multipart/alternative
//     └── text/html           │     ├── text/plain
//                             │     └── text/html
//                             └── <one part per file>
//
// Phase 1b therefore only has to populate SendEmailInput.attachments — fetch
// from Supabase Storage, base64 the bytes — and enforce provider size limits.
// The nesting, boundaries and encoding are already correct for that shape.
//
// ENCODING
// ────────
// Every body part is base64, never quoted-printable. This matters here: Accord
// serves Bangladesh, so subjects and bodies routinely carry Bengali script and
// the occasional emoji. Quoted-printable would encode most of a Bengali
// sentence byte-by-byte, produce longer output than base64, and adds soft-line-
// break rules that are easy to get subtly wrong. Base64 is uniform and safe for
// any byte sequence.
//
// Headers with non-ASCII characters use RFC 2047 encoded-words for the same
// reason — a raw UTF-8 Subject header is not legal and gets mangled in transit.

import type { EmailAttachment, EmailAddress, SendEmailInput } from './types.ts'

/** CRLF. Bare LF is not a legal line ending in a MIME message. */
const CRLF = '\r\n'

// ── base64 ────────────────────────────────────────────────────────────────────

/**
 * Encode bytes as base64.
 *
 * Chunked rather than `btoa(String.fromCharCode(...bytes))`: spreading a large
 * Uint8Array into apply/spread overflows the call stack somewhere around a few
 * hundred KB, which would work fine for every plain email and then fail the
 * first time Phase 1b attaches a quotation PDF.
 */
export function base64Encode(bytes: Uint8Array): string {
  const CHUNK = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64EncodeText(text: string): string {
  return base64Encode(new TextEncoder().encode(text))
}

/**
 * Decode base64 back to bytes.
 *
 * Exists for Zoho, which is the one provider that does not take a MIME message
 * at all: its Upload Attachments API wants the raw binary in the request body
 * and hands back a reference to quote in the send call. EmailAttachment carries
 * base64 because that is what the other two providers need inside a MIME part,
 * so Zoho decodes rather than every attachment carrying two representations of
 * the same bytes that could drift apart.
 */
// The return type is INFERRED, not annotated, and the buffer is allocated
// explicitly. `new Uint8Array(length)` is typed over ArrayBufferLike, which
// includes SharedArrayBuffer and is therefore not a legal fetch body; building
// over a real ArrayBuffer produces the narrower type that `body:` accepts.
// Writing `: Uint8Array` here would widen it straight back and the Zoho upload
// would not compile.
export function base64Decode(b64: string) {
  const binary = atob(b64)
  const buffer = new ArrayBuffer(binary.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Gmail wants base64url — URL-safe alphabet, no padding. */
export function base64Url(text: string): string {
  return base64EncodeText(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Split base64 into 76-character lines, as RFC 2045 requires. */
function wrap76(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF)
}

// ── Headers ───────────────────────────────────────────────────────────────────

const NON_ASCII = /[^\x20-\x7E]/

/**
 * RFC 2047 encoded-word for a header value that is not pure ASCII.
 * Returned unchanged when it is, because an encoded-word where none is needed
 * is legal but renders as mojibake in a few older clients.
 */
function encodeHeaderValue(value: string): string {
  if (!NON_ASCII.test(value)) return value
  return `=?UTF-8?B?${base64EncodeText(value)}?=`
}

/** `"Display Name" <addr@example.com>`, or bare address when there is no name. */
export function formatAddress(addr: EmailAddress): string {
  const email = addr.email.trim()
  const name = (addr.name ?? '').trim()
  if (!name) return email
  return `${encodeHeaderValue(name)} <${email}>`
}

function formatAddressList(list: EmailAddress[] | undefined): string {
  return (list ?? []).map(formatAddress).join(', ')
}

/**
 * Fold a long header onto continuation lines.
 * References headers in particular grow without limit as a thread lengthens,
 * and some MTAs reject or truncate lines past 998 octets.
 */
function foldHeader(name: string, value: string): string {
  const line = `${name}: ${value}`
  if (line.length <= 78) return line

  // Fold only at existing spaces. An RFC 2047 encoded-word contains none, so a
  // long encoded Subject is returned as one line rather than being split — a
  // fold INSIDE an encoded-word is illegal and renders as literal base64.
  const words = value.split(' ')
  let out = `${name}:`
  let current = ''
  for (const word of words) {
    if (current && (current + ' ' + word).length > 76) {
      out += current + CRLF
      current = ' ' + word          // leading space = the continuation indent
    } else {
      current += ' ' + word
    }
  }
  return out + current
}

// ── Message-ID ────────────────────────────────────────────────────────────────

/**
 * Generate an RFC-compliant Message-ID for an outgoing message.
 *
 * The domain part is taken from the SENDER's address, not a constant, because
 * a Message-ID whose domain does not belong to the sender looks like forgery to
 * some spam filters.
 *
 * WORTH KNOWING: Gmail does not reliably preserve a caller-supplied Message-ID
 * — it commonly substitutes its own on send. Since the CRM holds send-only
 * scope it cannot read the sent message back to discover the real one. See the
 * threading note in send-email/index.ts for what that does and does not break.
 */
export function generateMessageId(fromEmail: string): string {
  const domain = fromEmail.split('@')[1] ?? 'accord-crm.local'
  return `<${crypto.randomUUID()}@${domain}>`
}

// ── HTML → plain text ─────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
  '&quot;': '"', '&#39;': "'", '&apos;': "'", '&mdash;': '—', '&ndash;': '–',
}

/**
 * Derive a readable plain-text alternative from the composed HTML.
 *
 * Every message carries both parts. Two reasons, and the second is the one that
 * actually costs money: a text/html-only message scores worse with essentially
 * every spam filter, and a CRM whose quotations land in Junk is worse than one
 * that cannot send at all.
 *
 * This is a pragmatic converter, not a full HTML renderer — the input is the
 * composer's own limited markup (bold, italic, lists, links, paragraphs), not
 * arbitrary web HTML.
 */
export function htmlToText(html: string): string {
  let text = html

  // Drop anything with no textual meaning, contents included.
  text = text.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')

  // Links become "label (url)" so the destination survives in the text part.
  text = text.replace(
    /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, label) => {
      const clean = String(label).replace(/<[^>]+>/g, '').trim()
      if (!clean) return String(href)
      if (clean === href) return clean
      return `${clean} (${href})`
    },
  )

  text = text.replace(/<li\b[^>]*>/gi, '\n• ')
  text = text.replace(/<\/li>/gi, '')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/(p|div|h[1-6]|tr|ul|ol|blockquote)>/gi, '\n\n')
  text = text.replace(/<hr\s*\/?>/gi, '\n———\n')
  text = text.replace(/<[^>]+>/g, '')

  for (const [entity, char] of Object.entries(ENTITIES)) {
    text = text.replaceAll(entity, char)
  }
  text = text.replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map((l) => l.trimEnd()).join('\n')
    .trim()
}

// ── Parts ─────────────────────────────────────────────────────────────────────

function boundary(tag: string): string {
  return `----=_AccordCRM_${tag}_${crypto.randomUUID().replace(/-/g, '')}`
}

function textPart(content: string, mimeType: string): string {
  return [
    `Content-Type: ${mimeType}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(base64EncodeText(content)),
  ].join(CRLF)
}

function attachmentPart(file: EmailAttachment): string {
  const disposition = file.contentId ? 'inline' : 'attachment'
  const headers = [
    `Content-Type: ${file.mimeType || 'application/octet-stream'}; name="${encodeHeaderValue(file.filename)}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: ${disposition}; filename="${encodeHeaderValue(file.filename)}"`,
  ]
  if (file.contentId) headers.push(`Content-ID: <${file.contentId}>`)
  return [...headers, '', wrap76(file.contentBase64)].join(CRLF)
}

/** The text/plain + text/html pair the recipient's client chooses between. */
function alternativePart(input: SendEmailInput): { headers: string[]; body: string } {
  const alt = boundary('alt')
  const body = [
    `--${alt}`,
    textPart(input.text, 'text/plain'),
    `--${alt}`,
    textPart(input.html, 'text/html'),
    `--${alt}--`,
  ].join(CRLF)

  return {
    headers: [`Content-Type: multipart/alternative; boundary="${alt}"`],
    body,
  }
}

// ── Assemble ──────────────────────────────────────────────────────────────────

export interface BuiltMessage {
  /** The complete RFC 2822 message. */
  raw: string
  /** The Message-ID header written into it — persisted so replies can chain. */
  messageId: string
}

/**
 * Build the full message.
 *
 * `input.messageId` may be supplied by the caller so that the value stored in
 * `email_messages` and the value in the header are guaranteed identical even if
 * the send fails and is retried.
 */
export function buildMimeMessage(input: SendEmailInput): BuiltMessage {
  const messageId = input.messageId ?? generateMessageId(input.from.email)
  const attachments = input.attachments ?? []

  const headers: string[] = [
    foldHeader('Message-ID', messageId),
    foldHeader('Date', new Date().toUTCString()),
    foldHeader('From', formatAddress(input.from)),
    foldHeader('To', formatAddressList(input.to)),
  ]

  if (input.cc?.length) headers.push(foldHeader('Cc', formatAddressList(input.cc)))
  // Bcc IS written into the message. Gmail and Graph both read recipients from
  // the headers and strip Bcc before delivery; omitting it would silently drop
  // those recipients rather than hiding them.
  if (input.bcc?.length) headers.push(foldHeader('Bcc', formatAddressList(input.bcc)))
  if (input.replyTo) headers.push(foldHeader('Reply-To', formatAddress(input.replyTo)))

  headers.push(foldHeader('Subject', encodeHeaderValue(input.subject)))

  // Threading. In-Reply-To names the immediate parent; References carries the
  // whole chain so a client can rebuild the conversation even if it never saw
  // the intermediate messages.
  if (input.inReplyTo) headers.push(foldHeader('In-Reply-To', input.inReplyTo))
  if (input.references?.length) {
    headers.push(foldHeader('References', input.references.join(' ')))
  }

  headers.push('MIME-Version: 1.0')

  const alternative = alternativePart(input)

  if (attachments.length === 0) {
    headers.push(...alternative.headers)
    return { raw: headers.join(CRLF) + CRLF + CRLF + alternative.body, messageId }
  }

  // Attachments present → wrap the alternative pair in a multipart/mixed.
  const mixed = boundary('mix')
  headers.push(`Content-Type: multipart/mixed; boundary="${mixed}"`)

  const body = [
    `--${mixed}`,
    alternative.headers.join(CRLF),
    '',
    alternative.body,
    ...attachments.flatMap((file) => [`--${mixed}`, attachmentPart(file)]),
    `--${mixed}--`,
  ].join(CRLF)

  return { raw: headers.join(CRLF) + CRLF + CRLF + body, messageId }
}
