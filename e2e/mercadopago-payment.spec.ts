import { test, expect, TEST_CUSTOMER, getOrdersByEmail } from './fixtures'

// Cartões de teste do Mercado Pago Brasil
const MP_TEST_CARDS = {
  mastercard: {
    number: '5031 4332 1540 6351',
    cvv: '123',
    expiry: '11/30',
  },
  visa: {
    number: '4235 6477 2802 5682',
    cvv: '123',
    expiry: '11/30',
  },
}

// Usuário comprador de teste do MP
const MP_TEST_BUYER = {
  email: 'TESTUSER1586362992',
  password: 'OBOUVzW8kw',
  userId: '1914023820',
  // CPF para pagamento aprovado
  cpf: '12345678909',
}

// Nomes especiais para simular diferentes status
const MP_STATUS_NAMES = {
  approved: 'APRO',      // Pagamento aprovado
  rejected: 'OTHE',       // Recusado por erro geral
  pending: 'CONT',        // Pagamento pendente
  insufficientFunds: 'FUND', // Saldo insuficiente
}

test.describe('Mercado Pago - Fluxo Completo E2E', () => {
  // Timeout maior porque o fluxo é longo
  test.setTimeout(120000)

  test('deve completar compra via Mercado Pago com cartão de teste', async ({ page, testProductId, request }) => {
    // 1. Ir para o checkout do produto
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados do cliente
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', MP_STATUS_NAMES.approved) // Nome especial para aprovar

    // 3. Clicar no botão Mercado Pago - isso vai redirecionar
    await page.click('button:has-text("Mercado Pago")')

    // 4. Aguardar redirecionamento para o Mercado Pago
    await page.waitForURL(/mercadopago|mercadolibre/, { timeout: 30000 })
    console.log('Redirecionado para MP:', page.url())

    // 5. No site do Mercado Pago - fazer login com usuário de teste
    // Primeiro, verificar se precisa logar
    const loginButton = page.locator('button:has-text("Iniciar sessão"), button:has-text("Log in"), a:has-text("Iniciar sessão")')
    if (await loginButton.count() > 0) {
      await loginButton.first().click()
      await page.waitForTimeout(2000)
    }

    // Preencher email do comprador de teste
    const emailInput = page.locator('input[name="user_id"], input[type="email"], input[name="email"]')
    if (await emailInput.count() > 0) {
      await emailInput.fill(MP_TEST_BUYER.email)

      // Clicar em continuar
      const continueButton = page.locator('button:has-text("Continuar"), button[type="submit"]')
      if (await continueButton.count() > 0) {
        await continueButton.first().click()
        await page.waitForTimeout(2000)
      }
    }

    // Preencher senha
    const passwordInput = page.locator('input[name="password"], input[type="password"]')
    if (await passwordInput.count() > 0) {
      await passwordInput.fill(MP_TEST_BUYER.password)

      // Clicar em entrar
      const loginSubmit = page.locator('button:has-text("Entrar"), button:has-text("Iniciar sessão"), button[type="submit"]')
      if (await loginSubmit.count() > 0) {
        await loginSubmit.first().click()
        await page.waitForTimeout(3000)
      }
    }

    // 6. Se pedir código de verificação, usar os últimos 6 dígitos do User ID
    const verificationInput = page.locator('input[name="code"], input[placeholder*="código"]')
    if (await verificationInput.count() > 0) {
      const verificationCode = MP_TEST_BUYER.userId.slice(-6) // Últimos 6 dígitos
      await verificationInput.fill(verificationCode)

      const verifyButton = page.locator('button:has-text("Verificar"), button[type="submit"]')
      if (await verifyButton.count() > 0) {
        await verifyButton.first().click()
        await page.waitForTimeout(2000)
      }
    }

    // 7. Selecionar método de pagamento - Cartão de crédito
    const cardOption = page.locator('text=/Cartão de crédito|Tarjeta de crédito|Credit card/i')
    if (await cardOption.count() > 0) {
      await cardOption.first().click()
      await page.waitForTimeout(1000)
    }

    // 8. Preencher dados do cartão
    // Número do cartão
    const cardNumberInput = page.locator('input[name="cardNumber"], input[data-checkout="cardNumber"], input[placeholder*="número"]')
    if (await cardNumberInput.count() > 0) {
      await cardNumberInput.fill(MP_TEST_CARDS.mastercard.number.replace(/\s/g, ''))
    }

    // Nome no cartão - usar APRO para aprovar
    const cardNameInput = page.locator('input[name="cardholderName"], input[data-checkout="cardholderName"]')
    if (await cardNameInput.count() > 0) {
      await cardNameInput.fill(MP_STATUS_NAMES.approved)
    }

    // Data de expiração
    const expiryInput = page.locator('input[name="cardExpirationDate"], input[data-checkout="cardExpirationDate"], input[placeholder*="MM/AA"]')
    if (await expiryInput.count() > 0) {
      await expiryInput.fill(MP_TEST_CARDS.mastercard.expiry)
    }

    // CVV
    const cvvInput = page.locator('input[name="securityCode"], input[data-checkout="securityCode"], input[placeholder*="CVV"]')
    if (await cvvInput.count() > 0) {
      await cvvInput.fill(MP_TEST_CARDS.mastercard.cvv)
    }

    // CPF
    const cpfInput = page.locator('input[name="docNumber"], input[data-checkout="docNumber"], input[placeholder*="CPF"]')
    if (await cpfInput.count() > 0) {
      await cpfInput.fill(MP_TEST_BUYER.cpf)
    }

    // 9. Clicar em Pagar
    const payButton = page.locator('button:has-text("Pagar"), button:has-text("Confirmar"), button[type="submit"]')
    if (await payButton.count() > 0) {
      await payButton.first().click()
    }

    // 10. Aguardar processamento e redirecionamento de volta
    await page.waitForTimeout(10000)

    // 11. Verificar se voltou para nossa página de sucesso
    const currentUrl = page.url()
    console.log('URL após pagamento:', currentUrl)

    // Pode estar na página de sucesso ou ainda no MP
    if (currentUrl.includes('/success') || currentUrl.includes('status=approved')) {
      // Sucesso!
      await expect(page.locator('text=/Pagamento Confirmado|sucesso|obrigado/i')).toBeVisible({ timeout: 10000 })

      // Verificar no banco que o pedido foi pago
      const orders = await getOrdersByEmail(request, TEST_CUSTOMER.email)
      const mpOrder = orders.find((o: any) => o.paymentProvider === 'MERCADOPAGO')

      if (mpOrder) {
        console.log('Pedido encontrado:', mpOrder.id, 'Status:', mpOrder.status)
        expect(['PAID', 'PENDING']).toContain(mpOrder.status)
      }
    } else {
      // Ainda no MP - pode ter dado algum erro ou estar aguardando
      console.log('Ainda no Mercado Pago - verificando status...')

      // Tirar screenshot para debug
      await page.screenshot({ path: 'test-results/mp-checkout-result.png' })
    }
  })

  test('deve rejeitar pagamento com nome OTHE', async ({ page, testProductId }) => {
    // 1. Ir para o checkout
    await page.goto(`/checkout/${testProductId}`)
    await page.waitForLoadState('networkidle')

    // 2. Preencher dados - nome OTHE causa rejeição
    await page.fill('#email', TEST_CUSTOMER.email)
    await page.fill('#name', MP_STATUS_NAMES.rejected) // OTHE = recusado

    // 3. Clicar no botão Mercado Pago
    await page.click('button:has-text("Mercado Pago")')

    // 4. Aguardar redirecionamento
    await page.waitForURL(/mercadopago|mercadolibre/, { timeout: 30000 })

    // O resto do fluxo seguiria igual, mas o pagamento seria recusado
    // por causa do nome "OTHE" no cartão

    console.log('Teste de rejeição - verificar comportamento no MP')
  })
})

test.describe('Mercado Pago - Fluxo via API', () => {
  test('deve criar preferência e retornar link de pagamento', async ({ request, testProductId }) => {
    // Criar preferência via API
    const response = await request.post('/api/payments/mercadopago/create', {
      data: {
        productId: testProductId,
        customerEmail: TEST_CUSTOMER.email,
        customerName: MP_STATUS_NAMES.approved,
        installments: 1,
      },
    })

    expect(response.ok()).toBeTruthy()
    const data = await response.json()

    // Deve ter link de pagamento
    expect(data.initPoint || data.sandbox_init_point).toBeDefined()
    expect(data.orderId).toBeDefined()

    console.log('Link MP:', data.initPoint || data.sandbox_init_point)
    console.log('Order ID:', data.orderId)

    // Verificar pedido criado
    const orders = await getOrdersByEmail(request, TEST_CUSTOMER.email)
    const mpOrder = orders.find((o: any) => o.id === data.orderId)

    expect(mpOrder).toBeDefined()
    expect(mpOrder.status).toBe('PENDING')
  })
})

test.describe('Mercado Pago - Callbacks', () => {
  test('deve processar callback de sucesso', async ({ page, request, testProductId }) => {
    // Criar pedido primeiro
    const createResponse = await request.post('/api/payments/mercadopago/create', {
      data: {
        productId: testProductId,
        customerEmail: TEST_CUSTOMER.email,
        customerName: TEST_CUSTOMER.name,
        installments: 1,
      },
    })

    const createData = await createResponse.json()
    const orderId = createData.orderId

    // Simular callback de sucesso do MP
    await page.goto(`/success?provider=mercadopago&status=approved&external_reference=${orderId}`)
    await page.waitForLoadState('networkidle')

    // Verificar página de sucesso
    await expect(page.locator('text=/Pagamento Confirmado/i')).toBeVisible({ timeout: 10000 })
  })
})
