import { useEffect, useState } from 'react'
import { LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const storageKey = 'sdoc.sidebar.collapsed'

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(() => (
    window.localStorage.getItem(storageKey) === 'true'
  ))

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(collapsed))
  }, [collapsed])

  return (
    <aside
      className={`shrink-0 border-b border-blue-950 bg-[#030814] text-white transition-[width] duration-300 lg:min-h-screen lg:border-b-0 lg:border-r ${
        collapsed ? 'lg:w-20' : 'lg:w-72'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-5 lg:px-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-600 font-bold">S</div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-semibold">SDOC</p>
            <p className="text-xs text-blue-400/70">Document verification</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`grid size-8 shrink-0 place-items-center rounded-full border border-blue-900 bg-blue-950 text-blue-300 transition hover:bg-blue-900 hover:text-white ${
            collapsed ? 'mx-auto' : 'ml-auto'
          }`}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="mx-4 rounded-lg border border-blue-900/60 bg-blue-950/50 p-4 lg:mx-5">
          <p className="text-sm leading-6 text-blue-200/70"></p>
        </div>
      )}

      <nav aria-label="Primary navigation">
        <ul className="mt-6 space-y-2 px-3 text-sm text-blue-200/80 lg:px-4">
          <li
            title="Run dashboard"
            className={`flex items-center rounded-md bg-blue-600/20 font-medium text-white ring-1 ring-blue-800 ${
              collapsed ? 'justify-center px-0 py-3' : 'gap-2 px-4 py-3'
            }`}
          >
            <LayoutDashboard className="size-4 shrink-0" />
            {!collapsed && <span>Run dashboard</span>}
          </li>
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
