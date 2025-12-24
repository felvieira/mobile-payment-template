'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Settings, History } from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  imageUrl: string | null
  active: boolean
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      setProducts(data)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Payment Hub</h1>
          <div className="flex gap-2">
            <Link href="/history">
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-2" />
                Histórico
              </Button>
            </Link>
            <Link href="/admin">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Loja de Produtos Virtuais</h2>
          <p className="text-xl opacity-90 max-w-2xl mx-auto">
            Sistema de pagamentos universal com Stripe, Mercado Pago e PIX
          </p>
        </div>
      </section>

      {/* Products Grid */}
      <main className="container mx-auto px-4 py-12">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-600 mb-2">
              Nenhum produto disponível
            </h3>
            <p className="text-gray-500 mb-4">
              Acesse o painel admin para cadastrar seus produtos
            </p>
            <Link href="/admin">
              <Button>Ir para Admin</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="flex flex-col">
                <CardHeader>
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-48 object-cover rounded-t-lg -mt-6 -mx-6 mb-4"
                      style={{ width: 'calc(100% + 3rem)' }}
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg -mt-6 -mx-6 mb-4 flex items-center justify-center" style={{ width: 'calc(100% + 3rem)' }}>
                      <ShoppingCart className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  <CardTitle>{product.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                  {product.description && (
                    <p className="text-gray-600 text-sm">{product.description}</p>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between items-center">
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    {formatPrice(product.price, product.currency)}
                  </Badge>
                  <Link href={`/checkout/${product.id}`}>
                    <Button>
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Comprar
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Payment Hub - Sistema de Pagamentos Universal</p>
          <p className="mt-2">Stripe • Mercado Pago • PIX (Abacate Pay)</p>
        </div>
      </footer>
    </div>
  )
}
