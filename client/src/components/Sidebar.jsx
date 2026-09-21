import { useEffect, useState } from 'react'
import { BookOpen, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const storageKey = 'sdoc.sidebar.collapsed'

const navigation = [
  { id: 'dashboard', label: 'Processing dashboard', icon: LayoutDashboard },
  { id: 'knowledge', label: 'Adaptive knowledge', icon: BookOpen }
]

const Sidebar = ({ activeView, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(() => (
    window.localStorage.getItem(storageKey) === 'true'
  ))

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(collapsed))
  }, [collapsed])

  const desktopWidth = collapsed ? 'lg:w-24' : 'lg:w-72'

  return <>
    <aside
      className={`shrink-0 border-b border-sky-100 bg-white text-slate-900 shadow-sm transition-[width] duration-300 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r ${desktopWidth}`}
    >
      <div className="flex items-center gap-3 border-b border-sky-100 px-4 py-5 lg:px-5">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 font-bold text-white shadow-md shadow-blue-200">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-semibold text-slate-950">SDOC</p>
            <p className="text-xs text-slate-500">Document verification</p>
          </div>
        )}
      </div>

      <nav aria-label="Primary navigation" className="flex flex-col px-3 py-5 lg:min-h-[calc(100vh-85px)] lg:px-4">
        {!collapsed && <p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Workspace</p>}
        <ul className="mt-3 space-y-2">
          {navigation.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                type="button"
                title={label}
                onClick={() => onNavigate(id)}
                className={`flex min-h-12 w-full items-center rounded-xl text-left text-sm font-semibold transition ${
                  collapsed ? 'justify-center px-0' : 'gap-3 px-4'
                } ${activeView === id ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-600 hover:bg-sky-50 hover:text-blue-700'}`}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex min-h-12 w-full items-center rounded-xl border border-sky-200 bg-white text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-sky-50 hover:text-blue-700 ${collapsed ? 'justify-center px-0' : 'gap-3 px-4'}`}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </nav>
    </aside>
    <div aria-hidden="true" className={`hidden shrink-0 transition-[width] duration-300 lg:block ${desktopWidth}`} />
  </>
}

export default Sidebar
