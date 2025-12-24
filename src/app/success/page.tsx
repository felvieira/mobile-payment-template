'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, ArrowLeft, ShoppingBag } from 'lucide-react'

interface Order {
  id: string
  status: string
  amount: number
  currency: string
  customerEmail: string
  paymentProvider: string
  paidAt: string | null
  product: {
    name: string
    description: string | null
  }
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const provider = searchParams.get('provider')
  const orderId = searchParams.get('orderId')
  const paymentIntent = searchParams.get('payment_intent')
  const status = searchParams.get('status')

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orderId) {
      fetchOrder(orderId)
    } else {
      setLoading(false)
    }
  }, [orderId])

  async function fetchOrder(id: string) {
    try {
      const res = await fetch(`/api/orders/${id}`)
      if (res.ok) {
        const data = await res.json()
        setOrder(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pedido:', error)
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }

  const isPending = status === 'pending'
  const isPaid = order?.status === 'PAID' || (!isPending && provider)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-lg">
        <Card>
          <CardHeader className="text-center">
            {isPending ? (
              <Clock className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            ) : (
              <CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" />
            )}
            <CardTitle className="text-2xl">
              {isPending ? 'Pagamento Pendente' : 'Pagamento Confirmado!'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isPending ? (
              <p className="text-center text-gray-600">
                Seu pagamento está sendo processado. Você receberá uma confirmação por email assim que for aprovado.
              </p>
            ) : (
              <p className="text-center text-gray-600">
                Obrigado pela sua compra! Você receberá os detalhes por email.
              </p>
            )}

            {order && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Produto</span>
                  <span className="font-medium">{order.product?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Valor</span>
                  <span className="font-medium">
                    {formatPrice(order.amount, order.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Método</span>
                  <Badge variant="secondary">{order.paymentProvider}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <Badge variant={order.status === 'PAID' ? 'default' : 'secondary'}>
                    {order.status === 'PAID' ? 'Pago' : order.status}
                  </Badge>
                </div>
                {order.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Data</span>
                    <span className="text-sm">
                      {new Date(order.paidAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {provider && !order && (
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Processado via</span>
                  <Badge variant="secondary">{provider.toUpperCase()}</Badge>
                </div>
                {paymentIntent && (
                  <div className="flex justify-between mt-2">
                    <span className="text-gray-600">ID</span>
                    <span className="text-xs font-mono">{paymentIntent.slice(0, 20)}...</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Link href="/">
                <Button className="w-full">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Continuar Comprando
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar à Loja
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Carregando...</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
