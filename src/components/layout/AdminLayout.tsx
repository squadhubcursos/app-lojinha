'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ShoppingBag, LayoutDashboard, Package, Users, FileText, Warehouse, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  children: React.ReactNode
}

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/admin/produtos', label: 'Produtos', icon: Package },
  { href: '/admin/usuarios', label: 'Usuários', icon: Users },
  { href: '/admin/relatorios', label: 'Relatórios', icon: FileText },
]

export default function AdminLayout({ children }: Props) {
  const [adminNome, setAdminNome] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const nome = localStorage.getItem('admin_nome') || 'Admin'
    setAdminNome(nome)
  }, [])

  function handleLogout() {
    localStorage.removeItem('isAdmin')
    localStorage.removeItem('admin_nome')
    router.push('/identificacao')
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white shadow-lg z-50 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:static lg:z-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#009ada] text-white p-1.5 rounded-lg">
              <ShoppingBag size={20} />
            </div>
            <div>
              <p className="font-bold text-gray-800 text-sm">Banquinha</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-[#009ada] text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t">
          <p className="text-xs text-gray-400 mb-2">Logado como</p>
          <p className="text-sm font-semibold text-gray-700 mb-3">{adminNome}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors w-full"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="bg-white shadow-sm py-3 px-4 flex items-center gap-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <span className="font-bold text-gray-800">Banquinha SquadHub</span>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
