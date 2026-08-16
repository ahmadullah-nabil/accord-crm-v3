// ─── lib/modules.js ───────────────────────────────────────────────────────────
//
// step067. The canonical list of AccordHRM modules a lead can be interested in.
//
// ONE SOURCE. The form's checkboxes, the record view's chips and anything that
// later counts "how many open deals want Payroll" all read this array. A module
// added here appears everywhere without another edit.
//
// THE DATABASE DOES NOT CONSTRAIN THIS, on purpose. `leads.modules` is a plain
// TEXT[] with no CHECK, because the field explicitly allows free text for
// anything not on this list — a constraint would reject the one case the field
// was asked for. So this array is a suggestion list, not a validator, and
// `isCustomModule()` below is how the UI tells the two apart.
//
// ORDER IS THE ORDER THEY RENDER IN, and it is not alphabetical. The Portal
// comes first because it is the whole-suite answer; the rest run roughly in
// the order a Bangladesh HR team adopts them, with the statutory items
// (Chalan, PF, Gratuity, WPPF, Regulatory Filing) grouped together because a
// prospect asking for one usually asks for the neighbours.

export const HRM_MODULES = [
  'HR & Admin Portal',
  'ESS',
  'Attendance',
  'Leave',
  'Shift',
  'Roster',
  'Payroll',
  'Chalan',
  'Provident Fund',
  'Gratuity',
  'WPPF',
  'Regulatory Filing',
  'Expense Management',
  'FMS',
  'Reporting',
]

const MODULE_SET = new Set(HRM_MODULES)

/** True for anything the user typed that is not on the canonical list. */
export function isCustomModule(value) {
  return Boolean(value) && !MODULE_SET.has(value)
}

/**
 * Split a stored array into the two groups the UI renders differently.
 * Preserves the order within each group.
 */
export function splitModules(list = []) {
  const known  = []
  const custom = []
  for (const m of list) {
    if (MODULE_SET.has(m)) known.push(m)
    else if (m) custom.push(m)
  }
  return { known, custom }
}

/**
 * Free-text box → array. Comma-separated, trimmed, blanks dropped, duplicates
 * removed. Matches how `tags` is parsed everywhere else in the app so the two
 * fields behave the same way under the same keystrokes.
 */
export function parseCustomModules(text) {
  if (!text) return []
  return Array.from(new Set(
    text.split(',').map((s) => s.trim()).filter(Boolean)
  ))
}
