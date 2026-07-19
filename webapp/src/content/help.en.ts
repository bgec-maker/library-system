import type { HelpContent } from './helpTypes';

// Usage guide (English) — todo/138. Same section ids as help.ko.ts (enforced by HelpContent).

export const HELP_EN: HelpContent = {
  'getting-started': {
    id: 'getting-started',
    title: 'Getting Started',
    blocks: [
      {
        h: 'First connection',
        steps: [
          'Enter the three values from your administrator (web app URL, shared token, your name) on the first screen — they are stored on this device only.',
          'On a phone, use the browser menu’s "Add to Home Screen" to open it like an app.',
          'When a "new version" banner appears at the top, tap it to refresh — that is the whole update process.'
        ]
      },
      {
        h: 'Language',
        p: 'Switch Korean/English with KO·EN at the bottom of the left rail on desktop, or inside "More" on mobile.'
      },
      {
        h: 'Scanning',
        p: 'On desktop, open the camera window with the "Scanner" button at the bottom right (or press S). On mobile, use the "Scan" tab. The camera turns itself off when idle.'
      }
    ]
  },
  'loan-return': {
    id: 'loan-return',
    title: 'Checkout & Return',
    blocks: [
      {
        h: 'Checkout',
        steps: [
          'Open the scanner and scan the student card QR — the student’s name appears.',
          'Then scan the book’s registration label (our barcode) — checkout is done.',
          'Made a mistake? Press "Undo" at the bottom within 5 seconds.'
        ]
      },
      {
        h: 'Return',
        p: 'Just scan the book — the system knows who borrowed it. If someone reserved it, it is assigned to them automatically as "ready for pickup".'
      },
      {
        h: 'Renew & lost',
        p: 'Renew or mark-lost from the recent line on the checkout screen or from the book detail. Lost items record the replacement amount automatically.'
      },
      {
        h: 'Overdue rule',
        p: 'There are no fines. Instead, borrowing is suspended for as many days as the item was late. Students with unpaid replacements cannot borrow.'
      }
    ]
  },
  register: {
    id: 'register',
    title: 'Registering Books',
    blocks: [
      {
        h: 'Books with an ISBN',
        steps: [
          'In "Register", scan the ISBN barcode on the back cover or type the number.',
          'Title, author and cover fill in automatically — confirm, set the number of copies, save.',
          'Received more copies later? Use "bulk copy issue" to add registration numbers at once.'
        ]
      },
      {
        h: 'Books without an ISBN (donations etc.)',
        p: 'Use the "register without ISBN" form — only title and author are required.'
      },
      {
        h: 'Failures don’t disappear',
        p: 'If the network drops, failed registrations wait in the failure list and retry automatically next time the app starts (no duplicates). Validation failures need a manual fix and retry.'
      }
    ]
  },
  'search-catalog': {
    id: 'search-catalog',
    title: 'Search, Catalog & Book Detail',
    blocks: [
      { h: 'Search', p: 'Find by title, author or registration number. Korean initial consonants work too.' },
      {
        h: 'Catalog',
        p: 'The full holdings list. Click column headers to sort, export CSV for Excel, click a row for the book detail.'
      },
      {
        h: 'Book detail',
        p: 'See loan status and history, place reservations, and change states like lost or repair. Scanning a book from the search screen also lands here.'
      }
    ]
  },
  members: {
    id: 'members',
    title: 'Students',
    blocks: [
      { note: 'This tab activates after a server update (an administrator task). Until then it shows a notice only.' },
      {
        h: 'Registering students',
        steps: [
          '"Add student" → enter the name, pick a class (birth year optional), register.',
          'For a whole roster, paste "name, class, birth year" lines into "Paste bulk registration", check the preview, start.'
        ]
      },
      {
        h: 'Class moves & status',
        p: 'Tap a student row to open the edit card — changing the class there is the class move. Graduation and transfer are handled here too (open loans must be settled first; the app tells you).'
      },
      {
        h: 'Find by card',
        p: 'Scan a student card on this screen to show only that student — the most accurate way when many names look alike.'
      }
    ]
  },
  inventory: {
    id: 'inventory',
    title: 'Inventory (Annual Check)',
    blocks: [
      {
        h: 'Once-a-year flow',
        steps: [
          'Start a session in "Inventory" — it shows how many books should be on the shelves.',
          'Walk the shelves scanning each book’s registration label — the counter goes up.',
          'Finish with "End session" — unscanned books become the missing-candidates list.'
        ]
      },
      {
        p: 'Books on loan are excluded automatically. Scanning a back-cover ISBN shows a hint — our registration label is the reference.'
      }
    ]
  },
  'reports-print': {
    id: 'reports-print',
    title: 'Reports & Printing',
    blocks: [
      {
        p: 'Six reports: students with no recent loans, homeroom report (pick class & month), dead stock / purchase suggestions, recall slips (overdue — cut apart for homeroom teachers), unpaid replacements, and the annual operations report (for budget evidence).'
      },
      {
        h: 'Printing',
        steps: [
          'Pick a report, set the conditions (class, month…), press "Preview".',
          'The preview below is exactly what prints — press "Print".',
          'Cut recall slips along the lines and hand them to homeroom teachers.'
        ]
      },
      { p: 'Lines in the dashboard’s "quiet signals" jump straight to the matching report.' }
    ]
  },
  reservations: {
    id: 'reservations',
    title: 'Reservations',
    blocks: [
      {
        p: 'Reserve a checked-out book from its book detail. The moment it is returned it is assigned to the reserver as "ready for pickup" — manage waiting/arrived and cancel from the Reservations tab.'
      }
    ]
  },
  troubleshooting: {
    id: 'troubleshooting',
    title: 'When Something Goes Wrong',
    blocks: [
      {
        h: 'Internet is down',
        p: 'Registrations queue in the failure list and retry automatically — leave them be. For urgent checkouts, write them in the paper fallback sheet; the administrator absorbs them later in one step.'
      },
      {
        h: '"Busy, try again" messages',
        p: 'Normal when two devices write at once — the system retries by itself. Just wait a moment.'
      },
      {
        h: 'Scanning won’t work',
        p: 'For books, scan our registration label, not the back-cover ISBN (the app hints if you do). Keep the barcode inside the aiming frame and find better light if needed.'
      },
      {
        h: 'The screen looks wrong',
        p: 'If a "new version" banner is showing, refresh first. If it persists, send the administrator a screenshot — one capture is the fastest fix.'
      }
    ]
  },
  'admin-notices': {
    id: 'admin-notices',
    title: 'Posting Notices (Admin)',
    blocks: [
      {
        p: 'Notices at the top of this tab are managed in the spreadsheet’s 23_NOTICES sheet — add a row and fill title and body; it publishes immediately (no app deploy).'
      },
      {
        steps: [
          'level WARN highlights it in orange (default is info).',
          'pinned TRUE keeps it at the top.',
          'starts_at / ends_at set a display window (blank = always).',
          'To take one down, set status_code to anything other than ACTIVE.'
        ]
      },
      { p: 'Librarians get a one-time alert when the app starts and a new notice exists.' }
    ]
  }
};
