import { test as base, expect } from '@playwright/test'

// Test data
export const TEST_CUSTOMER = {
  email: 'test@example.com',
  name: 'Test User',
}

// Stripe test card numbers
export const STRIPE_TEST_CARDS = {
  success: '4242424242424242',
  decline: '4000000000000002',
  requiresAuth: '4000002500003155',
}

// Helper to create a test product via API
export async function createTestProduct(request: any): Promise<string> {
  const response = await request.post('/api/products', {
    data: {
      name: `Test Product ${Date.now()}`,
      description: 'E2E test product',
      price: 1000, // R$ 10,00
      currency: 'BRL',
    },
  })
  const product = await response.json()
  return product.id
}

// Helper to get orders by email
export async function getOrdersByEmail(request: any, email: string) {
  const response = await request.get(`/api/orders?email=${encodeURIComponent(email)}`)
  return response.json()
}

// Helper to cleanup test data
export async function cleanupTestProduct(request: any, productId: string) {
  await request.delete(`/api/products/${productId}`)
}

// Extended test fixture
export const test = base.extend<{
  testProductId: string
}>({
  testProductId: async ({ request }, use) => {
    const productId = await createTestProduct(request)
    await use(productId)
    // Cleanup after test
    await cleanupTestProduct(request, productId)
  },
})

export { expect }
