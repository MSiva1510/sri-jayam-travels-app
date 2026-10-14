// ─── UI Lab — tactile kit preview ───────────────────────────────
// Approve the look here before pages adopt skins. Style → place map:
//   glass → floating overlays (map controls, sheets, toasts, chips)
//   neu   → Soft-UI cards + tactile controls on flat grounds
//   skeuo → physical depth for hero / primary actions
//   flat  → current design-system default (existing pages unchanged)
import { useState } from 'react'
import { Play, Plus, Save, Trash2, FlaskConical, MousePointerClick, Layers, SlidersHorizontal, ListOrdered, Timer } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import TactileCard from '../components/ui/TactileCard'
import AppleSlider from '../components/ui/AppleSlider'
import AppleToggle from '../components/ui/AppleToggle'
import WheelPicker from '../components/ui/WheelPicker'
import AppleTimer from '../components/ui/AppleTimer'
import SegmentedControl from '../components/ui/SegmentedControl'

const SKINS = ['flat', 'glass', 'neu', 'skeuo']
const SKIN_PLACE = {
  flat: 'Default everywhere — pages you don’t touch stay exactly as they are.',
  glass: 'Floating overlays: map controls, modal sheets, toasts, chips.',
  neu: 'Soft-UI cards + tactile controls on flat grounds.',
  skeuo: 'Physical depth for hero / primary actions.',
}

function Section({ icon: Icon, title, sub, children }) {
  return (
    <section className="ap-surface rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={15} className="text-[var(--ap-accent)]" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">{sub}</p>}
      {children}
    </section>
  )
}

export default function UiLab() {
  const [volume, setVolume] = useState(65)
  const [brightness, setBrightness] = useState(40)
  const [toggles, setToggles] = useState({ a: true, b: false })
  const [seg, setSeg] = useState('month')
  const [hh, setHh] = useState('08')
  const [mm, setMm] = useState('30')
  const [timerMode, setTimerMode] = useState('stopwatch')

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const mins = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <PageHeader
        title="UI Lab"
        subtitle="Tactile kit preview — approve skins and Apple controls here before pages adopt them."
      />

      <Section icon={FlaskConical} title="Style → place map" sub="Polymorphism rule: pick the skin by where the element lives.">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {SKINS.map((s) => (
            <TactileCard key={s} skin={s === 'flat' ? 'flat' : s} className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{s}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{SKIN_PLACE[s]}</p>
            </TactileCard>
          ))}
        </div>
      </Section>

      <Section icon={MousePointerClick} title="Action buttons" sub="Same Button API — add skin='glass | neu | skeuo' to reskin.">
        <div className="space-y-3">
          {SKINS.map((s) => (
            <div key={s} className="flex flex-wrap items-center gap-2">
              <span className="w-14 text-[11px] font-bold uppercase text-slate-400">{s}</span>
              <Button skin={s} variant="primary" icon={Plus}>New Booking</Button>
              <Button skin={s} variant="secondary" icon={Save}>Save</Button>
              <Button skin={s} variant="danger" icon={Trash2}>Delete</Button>
              <Button skin={s} variant="primary" icon={Play} iconRight>Start Trip</Button>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={Layers} title="Surfaces" sub="Cards and floating panels.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TactileCard skin="flat" className="p-4">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Flat card</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dashboard sections, tables, forms.</p>
          </TactileCard>
          <TactileCard skin="neu" className="p-4">
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Soft-UI card</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Extruded on flat grounds — KPIs, stats.</p>
          </TactileCard>
          <div className="rounded-2xl p-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700">
            <TactileCard skin="glass" className="p-4">
              <p className="text-sm font-bold text-white">Glass panel</p>
              <p className="text-xs text-white/80 mt-1">Over maps, photos, gradients — toasts, sheets.</p>
              <div className="flex gap-2 mt-3">
                <Button skin="glass" variant="primary" size="sm">Confirm</Button>
                <Button skin="glass" variant="secondary" size="sm">Later</Button>
              </div>
            </TactileCard>
          </div>
        </div>
      </Section>

      <Section icon={SlidersHorizontal} title="Apple controls" sub="Slider, switch and segmented picker.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-5">
            <AppleSlider label="Volume" value={volume} onChange={setVolume} format={(v) => `${v}%`} />
            <AppleSlider label="Screen brightness" min={0} max={100} value={brightness} onChange={setBrightness} format={(v) => `${v}%`} />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Live tracking</span>
              <AppleToggle checked={toggles.a} onChange={(v) => setToggles((t) => ({ ...t, a: v }))} label="Live tracking" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600 dark:text-slate-300">Alerts (small)</span>
              <AppleToggle size="sm" checked={toggles.b} onChange={(v) => setToggles((t) => ({ ...t, b: v }))} label="Alerts" />
            </div>
            <SegmentedControl
              ariaLabel="Range"
              value={seg}
              onChange={setSeg}
              options={[{ key: 'month', label: 'Month' }, { key: 'year', label: 'This Year' }]}
            />
          </div>
        </div>
      </Section>

      <Section icon={ListOrdered} title="Wheel picker" sub={`Drum picker for time and option fields — currently ${hh}:${mm}.`}>
        <div className="max-w-xs">
          <WheelPicker
            columns={[
              { key: 'hh', label: 'Hour', values: hours, value: hh, onChange: setHh },
              { key: 'mm', label: 'Min', values: mins, value: mm, onChange: setMm },
            ]}
          />
        </div>
      </Section>

      <Section icon={Timer} title="Timer" sub="Stopwatch with laps, plus countdown with progress ring.">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <SegmentedControl
            ariaLabel="Timer mode"
            value={timerMode}
            onChange={setTimerMode}
            options={[{ key: 'stopwatch', label: 'Stopwatch' }, { key: 'countdown', label: 'Countdown' }]}
          />
        </div>
        <div className="max-w-xs mx-auto">
          <AppleTimer mode={timerMode} durationMs={60_000} />
        </div>
      </Section>
    </div>
  )
}
