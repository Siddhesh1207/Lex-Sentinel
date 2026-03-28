export default function MetricCard({ label, value, sublabel, icon: Icon, color }) {
  const themes = {
    blue: {
      bg: 'bg-indigo-500/20',
      icon: 'text-indigo-400',
      badge: 'bg-indigo-500/20 text-indigo-400 border py-0.5 px-2 rounded-full text-[10px] font-bold border-indigo-500/30'
    },
    red: {
      bg: 'bg-rose-500/20',
      icon: 'text-rose-400',
      badge: 'bg-rose-500/20 text-rose-400 border py-0.5 px-2 rounded-full text-[10px] font-bold border-rose-500/30'
    },
    amber: {
      bg: 'bg-amber-500/20',
      icon: 'text-amber-400',
      badge: 'bg-amber-500/20 text-amber-400 border py-0.5 px-2 rounded-full text-[10px] font-bold border-amber-500/30'
    },
    green: {
      bg: 'bg-emerald-500/20',
      icon: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-400 border py-0.5 px-2 rounded-full text-[10px] font-bold border-emerald-500/30'
    },
  }

  const theme = themes[color] || themes.blue

  return (
    <div className="glass-card flex flex-col justify-between p-6 h-full relative transition-[transform,shadow] hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/40">
      <div className="flex justify-between items-start mb-8">
        <div className={`p-3 rounded-xl ${theme.bg}`}>
          <Icon className={`w-5 h-5 ${theme.icon}`} />
        </div>
        <div className={theme.badge}>
          {sublabel}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 leading-relaxed max-w-[120px]">{label}</p>
        <h3 className="text-3xl font-bold text-white tracking-tight">{value ?? '-'}</h3>
      </div>
    </div>
  )
}
