import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  BrainCircuit, 
  BarChart2, 
  ShieldAlert,
  FileText,
  Archive,
  HelpCircle,
  User
} from 'lucide-react'

export default function Sidebar() {
  const mainLinks = [
    { to: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
    { to: '/chat', icon: BrainCircuit, label: 'INTELLIGENCE' },
    { to: '/discovery', icon: FileText, label: 'DISCOVERY' },
    { to: '/evaluation', icon: BarChart2, label: 'EVALUATIONS' },
    { to: '/contracts', icon: Archive, label: 'ALL CONTRACTS' },
  ]

  const NavItem = ({ to, icon: Icon, label }) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 px-5 py-3.5 rounded-lg text-xs font-bold tracking-widest transition-all duration-200 relative ${
          isActive
            ? 'bg-[#1E2336] text-white border-l-4 border-indigo-500 rounded-l-none'
            : 'text-slate-400 hover:bg-[#1E2336]/50 hover:text-slate-200'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-[#0A0D14] border-r border-[#1F2433] flex flex-col z-50">
      
      {/* Brand */}
      <div className="p-7 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <ShieldAlert className="w-6 h-6 text-white" />
          <span className="font-extrabold text-[19px] tracking-tight text-white leading-tight">Lex-Sentinel</span>
        </div>
        <div className="text-[10px] text-slate-500 font-bold tracking-[0.2em] ml-[36px]">
          ENTERPRISE INTELLIGENCE
        </div>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto space-y-2 mt-2">
        {mainLinks.map((link) => <NavItem key={link.to} {...link} />)}
      </nav>

    </aside>
  )
}