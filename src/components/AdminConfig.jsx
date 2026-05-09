import React from 'react';
import { 
  LayoutDashboard, 
  Box, 
  Calendar, 
  Users, 
  Settings, 
  DollarSign, 
  Activity, 
  CreditCard, 
  MoreVertical 
} from 'lucide-react';

export default function AdminConfig(props) {
  // Metrics data for Top Stats Grid
  const stats = [
    { title: 'Total Revenue', value: '$45,231.89', change: '+20.1%', positive: true, icon: DollarSign, gradient: 'from-orange-500 to-red-500' },
    { title: 'Active Users', value: '2,314', change: '+15.2%', positive: true, icon: Users, gradient: 'from-blue-500 to-cyan-500' },
    { title: 'New Sales', value: '1,234', change: '-4.1%', positive: false, icon: CreditCard, gradient: 'from-emerald-500 to-teal-500' },
    { title: 'Activity', value: '89.2%', change: '+12.5%', positive: true, icon: Activity, gradient: 'from-purple-500 to-pink-500' },
  ];

  // Mock employees data
  const employees = [
    { id: 1, name: 'Alice Smith', role: 'Software Engineer', status: 'Approved' },
    { id: 2, name: 'Bob Jones', role: 'Product Manager', status: 'In-Progress' },
    { id: 3, name: 'Charlie Brown', role: 'Designer', status: 'Dispute' },
    { id: 4, name: 'Diana Prince', role: 'Data Analyst', status: 'Approved' },
  ];

  // Utility to handle status badges based on requirements
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-500/20 text-green-400 border border-green-500/20';
      case 'In-Progress':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20';
      case 'Dispute':
        return 'bg-red-500/20 text-red-400 border border-red-500/20';
      default:
        return 'bg-slate-500/20 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <div className="flex h-full min-h-[100dvh] bg-[#0f172a] text-slate-200 font-sans w-full">
      
      {/* Fixed Sidebar */}
      <aside className="w-64 bg-[#1e293b] border-r border-slate-700/50 hidden md:flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-700/50">
          <h2 className="text-xl font-bold text-slate-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-500 to-cyan-500 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            SaaS Dash
          </h2>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-2">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-400 font-medium transition-colors border border-blue-500/20">
            <LayoutDashboard size={20} />
            Dashboard
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Box size={20} />
            Products
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Calendar size={20} />
            Schedules
          </a>
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Users size={20} />
            Employees
          </a>
        </nav>
        <div className="p-4 border-t border-slate-700/50">
          <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors">
            <Settings size={20} />
            Settings
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-200">Dashboard Overview</h1>
          <p className="text-sm text-slate-400 mt-1">Welcome back! Here's your metrics for today.</p>
        </header>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 flex items-center gap-4 hover:border-slate-600 transition-colors">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${stat.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-medium">{stat.title}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <h3 className="text-2xl font-bold text-slate-200">{stat.value}</h3>
                    <span className={`text-xs font-semibold ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                      {stat.change}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Middle Section: Chart & Circular Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Line Chart Area Placeholder */}
          <div className="col-span-1 lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 flex flex-col min-h-[320px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-slate-200">Revenue Overview</h3>
              <button className="text-slate-400 hover:text-slate-200"><MoreVertical size={20} /></button>
            </div>
            <div className="flex-1 border-2 border-dashed border-slate-700/50 rounded-xl flex items-center justify-center text-slate-500 bg-slate-800/20">
              Main Chart Placeholder
            </div>
          </div>

          {/* Circular Progress Chart */}
          <div className="col-span-1 bg-[#1e293b] rounded-xl border border-slate-700/50 p-6 flex flex-col items-center justify-center">
            <h3 className="font-semibold text-slate-200 w-full mb-6 text-left">Weekly Goal</h3>
            <div className="relative w-48 h-48 flex items-center justify-center">
              {/* SVG Circular Progress Placeholder */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#334155" strokeWidth="8" />
                <circle 
                  cx="50" cy="50" r="40" 
                  fill="transparent" 
                  stroke="url(#gradient)" 
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset="62.8" /* 75% complet */
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-slate-200">75%</span>
                <span className="text-xs text-slate-400 mt-1 uppercase tracking-widest">Completed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h3 className="font-semibold text-slate-200">Recent Employees</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/30 text-xs uppercase tracking-widest text-slate-400">
                  <th className="px-6 py-4 font-medium">Employee</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-300">
                          {emp.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{emp.name}</span>
                          <span className="text-xs text-slate-400">{emp.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-lg transition-colors">
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}