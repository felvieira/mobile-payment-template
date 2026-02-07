'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Package, ShoppingCart, Zap, Smartphone, Loader2, Copy, Check } from 'lucide-react'

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  imageUrl: string | null
  active: boolean
  createdAt: string
}

interface Order {
  id: string
  customerEmail: string
  customerName: string | null
  description: string | null
  amount: number
  currency: string
  status: string
  paymentMethod: string
  paymentProvider: string
  paidAt: string | null
  createdAt: string
  product: Product | null
}

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [deletingProducts, setDeletingProducts] = useState(false)
  const [deletingOrders, setDeletingOrders] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    imageUrl: '',
    active: true,
  })

  // Quick Payment state
  const [quickPayment, setQuickPayment] = useState({
    amount: '',
    description: '',
    customerEmail: '',
    customerName: '',
    paymentProvider: 'STRIPE',
  })
  const [quickPaymentResult, setQuickPaymentResult] = useState<string | null>(null)
  const [quickPaymentLoading, setQuickPaymentLoading] = useState(false)
  const [quickPaymentLink, setQuickPaymentLink] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  // Google Play state
  const [gpValidation, setGpValidation] = useState({
    productId: '',
    purchaseToken: '',
    packageName: '',
  })
  const [gpValidationResult, setGpValidationResult] = useState<Record<string, unknown> | null>(null)
  const [gpValidationLoading, setGpValidationLoading] = useState(false)

  useEffect(() => {
    fetchProducts()
    fetchOrders()
  }, [])

  async function fetchProducts() {
    try {
      const res = await fetch('/api/products?active=false')
      const data = await res.json()
      setProducts(data)
    } catch (error) {
      console.error('Erro ao buscar produtos:', error)
    }
  }

  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders')
      const data = await res.json()
      setOrders(data)
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const priceInCents = Math.round(parseFloat(formData.price) * 100)

    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            price: priceInCents,
          }),
        })
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            price: priceInCents,
          }),
        })
      }

      setDialogOpen(false)
      resetForm()
      fetchProducts()
    } catch (error) {
      console.error('Erro ao salvar produto:', error)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return

    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' })
      fetchProducts()
    } catch (error) {
      console.error('Erro ao excluir produto:', error)
    }
  }

  // Product selection functions
  function toggleProductSelection(id: string) {
    setSelectedProducts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  function toggleAllProducts(checked: boolean) {
    if (checked) {
      setSelectedProducts(new Set(products.map(p => p.id)))
    } else {
      setSelectedProducts(new Set())
    }
  }

  async function handleBulkDeleteProducts() {
    if (selectedProducts.size === 0) return
    if (!confirm(`Tem certeza que deseja excluir ${selectedProducts.size} produto(s)?`)) return

    setDeletingProducts(true)
    try {
      await Promise.all(
        Array.from(selectedProducts).map(id =>
          fetch(`/api/products/${id}`, { method: 'DELETE' })
        )
      )
      setSelectedProducts(new Set())
      fetchProducts()
    } catch (error) {
      console.error('Erro ao excluir produtos:', error)
    } finally {
      setDeletingProducts(false)
    }
  }

  // Order selection functions
  function toggleOrderSelection(id: string) {
    setSelectedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  function toggleAllOrders(checked: boolean) {
    if (checked) {
      setSelectedOrders(new Set(orders.map(o => o.id)))
    } else {
      setSelectedOrders(new Set())
    }
  }

  async function handleBulkDeleteOrders() {
    if (selectedOrders.size === 0) return
    if (!confirm(`Tem certeza que deseja excluir ${selectedOrders.size} pedido(s)?`)) return

    setDeletingOrders(true)
    try {
      await Promise.all(
        Array.from(selectedOrders).map(id =>
          fetch(`/api/orders/${id}`, { method: 'DELETE' })
        )
      )
      setSelectedOrders(new Set())
      fetchOrders()
    } catch (error) {
      console.error('Erro ao excluir pedidos:', error)
    } finally {
      setDeletingOrders(false)
    }
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      description: product.description || '',
      price: (product.price / 100).toFixed(2),
      imageUrl: product.imageUrl || '',
      active: product.active,
    })
    setDialogOpen(true)
  }

  function resetForm() {
    setEditingProduct(null)
    setFormData({
      name: '',
      description: '',
      price: '',
      imageUrl: '',
      active: true,
    })
  }

  // Quick Payment functions
  async function handleQuickPayment(e: React.FormEvent) {
    e.preventDefault()
    setQuickPaymentLoading(true)
    setQuickPaymentResult(null)

    try {
      const amountInCents = Math.round(parseFloat(quickPayment.amount) * 100)
      const res = await fetch('/api/payments/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'BRL',
          description: quickPayment.description,
          customerEmail: quickPayment.customerEmail,
          customerName: quickPayment.customerName || undefined,
          paymentProvider: quickPayment.paymentProvider,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        setQuickPaymentResult(`Pagamento criado! Order ID: ${data.orderId}`)
        fetchOrders()
      } else {
        setQuickPaymentResult(`Erro: ${data.error || 'Falha ao criar pagamento'}`)
      }
    } catch (error) {
      setQuickPaymentResult('Erro ao processar pagamento')
      console.error(error)
    } finally {
      setQuickPaymentLoading(false)
    }
  }

  function generateQuickCheckoutLink() {
    const amountInCents = Math.round(parseFloat(quickPayment.amount) * 100)
    const params = new URLSearchParams()
    if (quickPayment.amount) params.set('amount', quickPayment.amount)
    if (quickPayment.description) params.set('description', quickPayment.description)
    if (quickPayment.customerEmail) params.set('email', quickPayment.customerEmail)
    const link = `${window.location.origin}/quick-checkout?${params.toString()}`
    setQuickPaymentLink(link)
  }

  function copyLink() {
    if (quickPaymentLink) {
      navigator.clipboard.writeText(quickPaymentLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }
  }

  // Google Play functions
  async function handleGpValidation(e: React.FormEvent) {
    e.preventDefault()
    setGpValidationLoading(true)
    setGpValidationResult(null)

    try {
      const res = await fetch('/api/payments/google-play/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gpValidation),
      })

      const data = await res.json()
      setGpValidationResult(data)
    } catch (error) {
      setGpValidationResult({ error: 'Erro ao validar compra' })
      console.error(error)
    } finally {
      setGpValidationLoading(false)
    }
  }

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
    }).format(cents / 100)
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PAID: 'default',
      PENDING: 'secondary',
      FAILED: 'destructive',
      EXPIRED: 'outline',
      REFUNDED: 'outline',
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Admin - Payment Hub</h1>

      <Tabs defaultValue="products">
        <TabsList className="mb-6">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Pedidos
          </TabsTrigger>
          <TabsTrigger value="quick-payment" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Payment
          </TabsTrigger>
          <TabsTrigger value="google-play" className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Google Play
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Produtos</CardTitle>
                {selectedProducts.size > 0 && (
                  <Badge variant="secondary">
                    {selectedProducts.size} selecionado(s)
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {selectedProducts.size > 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleBulkDeleteProducts}
                    disabled={deletingProducts}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletingProducts ? 'Excluindo...' : `Excluir (${selectedProducts.size})`}
                  </Button>
                )}
                <Dialog open={dialogOpen} onOpenChange={(open) => {
                  setDialogOpen(open)
                  if (!open) resetForm()
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Produto
                    </Button>
                  </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="imageUrl">URL da Imagem</Label>
                      <Input
                        id="imageUrl"
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="active"
                        checked={formData.active}
                        onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                      />
                      <Label htmlFor="active">Produto ativo</Label>
                    </div>
                    <Button type="submit" className="w-full">
                      {editingProduct ? 'Salvar' : 'Criar'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={products.length > 0 && selectedProducts.size === products.length}
                        onCheckedChange={(checked) => toggleAllProducts(checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className={selectedProducts.has(product.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedProducts.has(product.id)}
                          onCheckedChange={() => toggleProductSelection(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {product.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(product.price, product.currency)}</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? 'default' : 'secondary'}>
                          {product.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(product)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Nenhum produto cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle>Pedidos Recentes</CardTitle>
                {selectedOrders.size > 0 && (
                  <Badge variant="secondary">
                    {selectedOrders.size} selecionado(s)
                  </Badge>
                )}
              </div>
              {selectedOrders.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleBulkDeleteOrders}
                  disabled={deletingOrders}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deletingOrders ? 'Excluindo...' : `Excluir (${selectedOrders.size})`}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={orders.length > 0 && selectedOrders.size === orders.length}
                        onCheckedChange={(checked) => toggleAllOrders(checked as boolean)}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id} className={selectedOrders.has(order.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOrders.has(order.id)}
                          onCheckedChange={() => toggleOrderSelection(order.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {order.product?.name || order.description || <span className="text-gray-400 italic">Quick Payment</span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{order.customerEmail}</div>
                          {order.customerName && (
                            <div className="text-sm text-gray-500">{order.customerName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(order.amount, order.currency)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{order.paymentMethod}</div>
                          <div className="text-gray-500">{order.paymentProvider}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>
                        {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Nenhum pedido encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quick-payment">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerar Cobranca Rapida</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleQuickPayment} className="space-y-4">
                  <div>
                    <Label htmlFor="qp-amount">Valor (R$)</Label>
                    <Input
                      id="qp-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={quickPayment.amount}
                      onChange={(e) => setQuickPayment({ ...quickPayment, amount: e.target.value })}
                      placeholder="0,00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="qp-description">Descricao</Label>
                    <Input
                      id="qp-description"
                      value={quickPayment.description}
                      onChange={(e) => setQuickPayment({ ...quickPayment, description: e.target.value })}
                      placeholder="Ex: Consultoria, Produto X"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="qp-email">Email do Cliente</Label>
                    <Input
                      id="qp-email"
                      type="email"
                      value={quickPayment.customerEmail}
                      onChange={(e) => setQuickPayment({ ...quickPayment, customerEmail: e.target.value })}
                      placeholder="cliente@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="qp-name">Nome do Cliente</Label>
                    <Input
                      id="qp-name"
                      value={quickPayment.customerName}
                      onChange={(e) => setQuickPayment({ ...quickPayment, customerName: e.target.value })}
                      placeholder="Nome do cliente"
                    />
                  </div>
                  <div>
                    <Label htmlFor="qp-provider">Gateway</Label>
                    <Select
                      value={quickPayment.paymentProvider}
                      onValueChange={(value) => setQuickPayment({ ...quickPayment, paymentProvider: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STRIPE">Stripe (Cartao)</SelectItem>
                        <SelectItem value="MERCADOPAGO">Mercado Pago</SelectItem>
                        <SelectItem value="ABACATEPAY">PIX (Abacate Pay)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={quickPaymentLoading} className="flex-1">
                      {quickPaymentLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Criar Cobranca
                    </Button>
                    <Button type="button" variant="outline" onClick={generateQuickCheckoutLink}>
                      Gerar Link
                    </Button>
                  </div>

                  {quickPaymentResult && (
                    <div className={`text-sm p-3 rounded ${quickPaymentResult.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                      {quickPaymentResult}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Link de Checkout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-500">
                  Gere um link de pagamento para enviar ao cliente. O link pre-preenche valor, descricao e email.
                </p>

                {quickPaymentLink ? (
                  <div className="space-y-2">
                    <Label>Link gerado</Label>
                    <div className="flex gap-2">
                      <Input value={quickPaymentLink} readOnly className="font-mono text-xs" />
                      <Button variant="outline" onClick={copyLink}>
                        {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => window.open(quickPaymentLink, '_blank')}
                    >
                      Abrir em nova aba
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Preencha os campos e clique em &quot;Gerar Link&quot; para criar um link de checkout.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="google-play">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Validacao Manual</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGpValidation} className="space-y-4">
                  <div>
                    <Label htmlFor="gp-package">Package Name</Label>
                    <Input
                      id="gp-package"
                      value={gpValidation.packageName}
                      onChange={(e) => setGpValidation({ ...gpValidation, packageName: e.target.value })}
                      placeholder="com.example.app"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="gp-product">Product ID</Label>
                    <Input
                      id="gp-product"
                      value={gpValidation.productId}
                      onChange={(e) => setGpValidation({ ...gpValidation, productId: e.target.value })}
                      placeholder="premium_monthly"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="gp-token">Purchase Token</Label>
                    <Textarea
                      id="gp-token"
                      value={gpValidation.purchaseToken}
                      onChange={(e) => setGpValidation({ ...gpValidation, purchaseToken: e.target.value })}
                      placeholder="Token recebido do dispositivo Android"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={gpValidationLoading}>
                    {gpValidationLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Validar Compra
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resultado da Validacao</CardTitle>
              </CardHeader>
              <CardContent>
                {gpValidationResult ? (
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(gpValidationResult, null, 2)}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-400">
                    Nenhuma validacao realizada ainda. Preencha os campos e clique em &quot;Validar Compra&quot;.
                  </p>
                )}

                <div className="mt-4 space-y-2">
                  <h4 className="font-medium text-sm">Configuracao</h4>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">GOOGLE_PLAY_PACKAGE_NAME</span>
                      <Badge variant={process.env.NEXT_PUBLIC_GOOGLE_PLAY_CONFIGURED === 'true' ? 'default' : 'secondary'}>
                        {process.env.NEXT_PUBLIC_GOOGLE_PLAY_CONFIGURED === 'true' ? 'Configurado' : 'Pendente'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Service Account</span>
                      <Badge variant={process.env.NEXT_PUBLIC_GOOGLE_PLAY_CONFIGURED === 'true' ? 'default' : 'secondary'}>
                        {process.env.NEXT_PUBLIC_GOOGLE_PLAY_CONFIGURED === 'true' ? 'Configurado' : 'Pendente'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
