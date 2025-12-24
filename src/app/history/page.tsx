'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Package, CreditCard, QrCode, CheckCircle, Clock, XCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface Order {
  id: string
  productId: string
  product: {
    name: string
    description: string
  }
  customerEmail: string
  customerName: string
  amount: number
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'EXPIRED'
  paymentMethod: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO'
  paymentProvider: 'STRIPE' | 'MERCADOPAGO' | 'ABACATEPAY'
  providerPaymentId: string | null
  paidAt: string | null
  createdAt: string
}

const statusConfig = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-500', icon: Clock },
  PAID: { label: 'Pago', color: 'bg-green-500', icon: CheckCircle },
  FAILED: { label: 'Falhou', color: 'bg-red-500', icon: XCircle },
  REFUNDED: { label: 'Reembolsado', color: 'bg-purple-500', icon: RefreshCw },
  EXPIRED: { label: 'Expirado', color: 'bg-gray-500', icon: XCircle },
}

const providerConfig = {
  STRIPE: { label: 'Stripe', icon: CreditCard },
  MERCADOPAGO: { label: 'Mercado Pago', icon: CreditCard },
  ABACATEPAY: { label: 'PIX', icon: QrCode },
}

const methodConfig = {
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [emailFilter, setEmailFilter] = useState('')
  const [searchEmail, setSearchEmail] = useState('')

  const fetchOrders = async (email?: string) => {
    setLoading(true)
    try {
      const url = email
        ? `/api/orders?email=${encodeURIComponent(email)}`
        : '/api/orders'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setOrders(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleSearch = () => {
    setSearchEmail(emailFilter)
    fetchOrders(emailFilter)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    return (amount / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar à loja
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Histórico de Compras</h1>
            <p className="text-gray-500">Visualize todas as suas compras e seus status</p>
          </div>
        </div>

        {/* Filtro por email */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filtrar por Email</CardTitle>
            <CardDescription>Busque pedidos por email do cliente</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              {searchEmail && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEmailFilter('')
                    setSearchEmail('')
                    fetchOrders()
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de pedidos em tabela */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-8 text-center text-gray-500">
                Carregando pedidos...
              </div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum pedido encontrado</p>
                {searchEmail && (
                  <p className="text-sm mt-2">
                    Nenhum pedido para o email: {searchEmail}
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Produto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cliente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pagamento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Valor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => {
                      const StatusIcon = statusConfig[order.status].icon
                      const ProviderIcon = providerConfig[order.paymentProvider].icon

                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="font-medium text-gray-900">{order.product.name}</div>
                            <div className="text-xs text-gray-400 mt-1">ID: {order.id.slice(0, 12)}...</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{order.customerName || '-'}</div>
                            <div className="text-xs text-gray-500">{order.customerEmail}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1 text-sm">
                              <ProviderIcon className="h-4 w-4 text-gray-400" />
                              <span>{providerConfig[order.paymentProvider].label}</span>
                            </div>
                            <div className="text-xs text-gray-500">{methodConfig[order.paymentMethod]}</div>
                          </td>
                          <td className="px-4 py-4">
                            <Badge
                              variant="outline"
                              className={`flex items-center gap-1 w-fit ${
                                order.status === 'PAID' ? 'border-green-500 text-green-700 bg-green-50' :
                                order.status === 'PENDING' ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
                                order.status === 'FAILED' ? 'border-red-500 text-red-700 bg-red-50' :
                                'border-gray-500 text-gray-700'
                              }`}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig[order.status].label}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(order.amount)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-gray-900">{formatDate(order.createdAt)}</div>
                            {order.paidAt && (
                              <div className="text-xs text-green-600">Pago: {formatDate(order.paidAt)}</div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estatísticas */}
        {orders.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                  <p className="text-sm text-gray-500">Total de Pedidos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {orders.filter(o => o.status === 'PAID').length}
                  </p>
                  <p className="text-sm text-gray-500">Pagos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {orders.filter(o => o.status === 'PENDING').length}
                  </p>
                  <p className="text-sm text-gray-500">Pendentes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      orders
                        .filter(o => o.status === 'PAID')
                        .reduce((sum, o) => sum + o.amount, 0)
                    )}
                  </p>
                  <p className="text-sm text-gray-500">Total Recebido</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
