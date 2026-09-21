const Sidebar = () => {
  return (
    <aside className="border-b border-slate-800 bg-slate-950 px-5 py-5 text-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-blue-600 font-bold">S</div>
        <div>
          <p className="font-semibold">SDOC</p>
          <p className="text-xs text-slate-400">Document verification</p>
        </div>
      </div>
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">Stage 3</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Multi-format SI/BL parsing, traceable seven-field extraction, and deterministic comparison.
        </p>
      </div>
      <ul className="mt-6 space-y-2 text-sm text-slate-300">
        <li className="rounded-xl bg-slate-800 px-4 py-3 font-medium text-white">Run dashboard</li>
        <li className="px-4 py-2">Deterministic-first scoring</li>
        <li className="px-4 py-2">TXT · PDF · DOCX · XLSX</li>
        <li className="px-4 py-2">Validated AI/vision fallback</li>
        <li className="px-4 py-2">7 required fields</li>
        <li className="px-4 py-2">Exact JSON export</li>
      </ul>
    </aside>
  )
}

export default Sidebar
