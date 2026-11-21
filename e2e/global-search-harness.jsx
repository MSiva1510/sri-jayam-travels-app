// Minimal harness that mounts the real GlobalSearch alongside ordinary form
// controls. Playwright uses it to prove outside clicks never steal field focus.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import '../src/index.css'
import GlobalSearch from '../src/components/ui/GlobalSearch'

function Harness() {
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('one')

  return (
    <MemoryRouter>
      <div className="min-h-screen bg-[var(--ap-bg)] p-6">
        <GlobalSearch />
        <div className="mt-6 max-w-md space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Entry name</span>
            <input
              id="entry-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface)] px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Entry type</span>
            <select
              id="entry-select"
              value={choice}
              onChange={e => setChoice(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--ap-border)] bg-[var(--ap-surface)] px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
            >
              <option value="one">One</option>
              <option value="two">Two</option>
              <option value="three">Three</option>
            </select>
          </label>
          <output id="entry-value" className="block text-sm text-slate-500 dark:text-slate-400">
            {name}|{choice}
          </output>
        </div>
      </div>
    </MemoryRouter>
  )
}

createRoot(document.getElementById('root')).render(<Harness />)
