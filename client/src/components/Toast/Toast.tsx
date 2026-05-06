import { CheckCircle, XCircle, Info } from 'lucide-react'
import { ToastItem } from '../../hooks/useToast'

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const COLORS = {
  success: 'bg-green-900/80 border-green-700/40 text-green-300',
  error: 'bg-red-900/80 border-red-700/40 text-red-300',
  info: 'bg-blue-900/80 border-blue-700/40 text-blue-300',
}

export default function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-lg animate-fadeInUp ${COLORS[t.type]}`}
          >
            <Icon size={15} />
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
