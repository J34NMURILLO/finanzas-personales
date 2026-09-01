import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'

const WELCOME = {
  role: 'assistant',
  content: 'Hola, contame qué gasto hiciste. Ej: "gasté 5000 en supermercado con la Visa".',
}

export default function Chat() {
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)
    setError('')

    try {
      const data = await api.post('/chat', {
        messages: nextMessages.filter((m) => m !== WELCOME).map((m) => ({ role: m.role, content: m.content })),
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, transaction: data.transaction }])
    } catch (err) {
      setError(err.message)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Hubo un error de conexión. Probá de nuevo.' },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Cargar gasto por chat</h1>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-sm space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
              }`}
            >
              {m.content}
              {m.transaction && (
                <div className="mt-1 text-xs opacity-75">✓ Transacción #{m.transaction.id} registrada</div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 rounded-2xl px-4 py-2 text-sm">Pensando...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <div className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</div>}

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribí tu gasto..."
          className="flex-1 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-indigo-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
