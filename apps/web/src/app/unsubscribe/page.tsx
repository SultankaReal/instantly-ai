export const metadata = {
  title: 'Отписка | Поток',
  robots: 'noindex,nofollow',
}

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const isSuccess = searchParams.status === 'ok'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm p-12 max-w-md w-full text-center">
        {isSuccess ? (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Вы отписались</h1>
            <p className="text-gray-500">
              Ваш адрес удалён из списка рассылки. Вы больше не будете получать письма от этой кампании.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-gray-900 mb-3">Обработка...</h1>
            <p className="text-gray-500">Пожалуйста, подождите.</p>
          </>
        )}
      </div>
    </div>
  )
}
