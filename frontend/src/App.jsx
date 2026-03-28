import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import ChatInterface from './pages/ChatInterface.jsx'
import EvaluationReport from './pages/EvaluationReport.jsx'
import SemanticSearch from './pages/SemanticSearch.jsx'
import AllContracts from './pages/AllContracts.jsx'
export default function App() {
  return (
    <div className="flex min-h-screen text-slate-100 selection:bg-blue-500/30">
      <Sidebar />
      <main className="ml-[260px] flex-1 min-w-0 bg-[#0A0D14]">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/evaluation" element={<EvaluationReport />} />
          <Route path="/discovery" element={<SemanticSearch />} />
          <Route path="/contracts" element={<AllContracts />} />
        </Routes>
      </main>
    </div>
  )
}