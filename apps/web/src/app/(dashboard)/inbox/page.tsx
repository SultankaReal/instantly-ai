'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAccessToken } from '@/lib/auth'
import { api } from '@/lib/api'
import { useState } from 'react'

type LeadStatus = 'interested' | 'not_interested' | 'meeting_booked' | 'out_of_office' | 'unsubscribed' | 'new'

type InboxMessage = {
  id: string
  fromEmail: string
  fromName: string
  subject: string
  preview: string
  campaignName: string
  leadStatus: LeadStatus
  receivedAt: string
  isRead: boolean
}

type InboxResponse = { data: InboxMessage[]; unread: number; total: number }

const leadStatusConfig: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: 'Новый', className: 'bg-gray-50 text-gray-600' },
  interested: { label: 'Интерес', className: 'bg-green-50 text-green-700' },
  not_interested: { label: 'Не интересно', className: 'bg-red-50 text-red-600' },
  meeting_booked: { label: 'Встреча', className: 'bg-blue-50 text-blue-700' },
  out_of_office: { label: 'В отпуске', className: 'bg-yellow-50 text-yellow-700' },
  unsubscribed: { label: 'Отписан', className: 'bg-gray-50 text-gray-400' },
}

const LEAD_STATUSES: LeadStatus[] = [
  'interested',
  'not_interested',
  'meeting_booked',
  'out_of_office',
  'unsubscribed',
]

export default function InboxPage(): React.JSX.Element {
  const token = getAccessToken() ?? ''
  const queryClient = useQueryClient()
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null)
  const [replyText, setReplyText] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['inbox', 1],
    queryFn: () => api.inbox.list(token, 1) as Promise<InboxResponse>,
    enabled: !!token,
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.inbox.markRead(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.inbox.updateLeadStatus(token, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  })

  const sendReply = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => api.inbox.reply(token, id, body),
    onSuccess: () => {
      setReplyText('')
      queryClient.invalidateQueries({ queryKey: ['inbox'] })
    },
  })

  const messages: InboxMessage[] = data?.data ?? []

  const handleSelectMessage = (msg: InboxMessage): void => {
    setSelectedMessage(msg)
    if (!msg.isRead) {
      markRead.mutate(msg.id)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="p-6 border-b border-gray-100 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Инбокс</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {data?.unread ? `${data.unread} непрочитанных` : 'Все прочитано'}
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Message list */}
        <div className="w-96 border-r border-gray-100 overflow-y-auto bg-white flex-shrink-0">
          {isLoading && (
            <div className="space-y-px">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-white border-b border-gray-50 animate-pulse" />
              ))}
            </div>
          )}
          {!isLoading && messages.length === 0 && (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">📥</div>
              <p className="text-gray-500 text-sm">Пока нет входящих сообщений</p>
            </div>
          )}
          {!isLoading &&
            messages.map((msg) => {
              const statusCfg = leadStatusConfig[msg.leadStatus]
              const isSelected = selectedMessage?.id === msg.id
              return (
                <button
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  } ${!msg.isRead ? 'bg-white' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-sm font-medium truncate ${!msg.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                      {msg.fromName || msg.fromEmail}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(msg.receivedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className={`text-xs truncate mb-2 ${!msg.isRead ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                    {msg.subject}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 truncate flex-1">{msg.campaignName}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                </button>
              )
            })}
        </div>

        {/* Message detail */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {!selectedMessage ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <div className="text-5xl mb-4">💌</div>
                <p className="text-gray-500">Выберите сообщение для просмотра</p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-gray-100 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedMessage.subject}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedMessage.fromName} &lt;{selectedMessage.fromEmail}&gt; •{' '}
                      {new Date(selectedMessage.receivedAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={selectedMessage.leadStatus}
                      onChange={(e) =>
                        updateStatus.mutate({ id: selectedMessage.id, status: e.target.value })
                      }
                      className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {leadStatusConfig[s].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto">
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{selectedMessage.preview}</p>
              </div>

              <div className="p-6 border-t border-gray-100 flex-shrink-0">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Написать ответ..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-400 text-sm outline-none resize-none"
                />
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => sendReply.mutate({ id: selectedMessage.id, body: replyText })}
                    disabled={!replyText.trim() || sendReply.isPending}
                    className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {sendReply.isPending ? 'Отправка...' : 'Ответить'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
