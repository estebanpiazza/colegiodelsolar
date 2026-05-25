const TICKET_PRICE = 45000
const EVENT_NAME = 'CEBSA 2026 - Congreso de Educación y Bienestar Sur Argentino'
const EVENT_START_DATE = new Date('2026-09-18T09:00:00-03:00')

const CHECKOUT_CONFIG = {
    mercadoPagoCheckoutUrl: '',
    mercadoPagoPreferenceEndpoint: 'api/mercadopago-preference.php',
    confirmationEmail: 'admisiones@colegiodelsolar.edu.ar',
    whatsappNumber: '',
    bankTransfer: {
        holder: '',
        alias: '',
        cbu: ''
    }
}

const state = {
    quantity: 1
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
})

const selectors = {
    header: document.getElementById('site-header'),
    navToggle: document.getElementById('nav-toggle'),
    navLinks: document.getElementById('nav-links'),
    quantityDecrease: document.querySelector('[data-quantity-decrease]'),
    quantityIncrease: document.querySelector('[data-quantity-increase]'),
    ticketQuantity: document.querySelector('[data-ticket-quantity]'),
    ticketPlural: document.querySelector('[data-ticket-plural]'),
    cartCount: document.querySelector('[data-cart-count]'),
    cartQuantity: document.querySelector('[data-cart-quantity]'),
    cartTotal: document.querySelector('[data-cart-total]'),
    cartLineTotal: document.querySelector('[data-cart-line-total]'),
    checkoutQuantity: document.querySelector('[data-checkout-quantity]'),
    checkoutTotal: document.querySelector('[data-checkout-total]'),
    cartPanel: document.querySelector('[data-cart-panel]'),
    cartToggle: document.querySelector('[data-cart-toggle]'),
    cartClose: document.querySelector('[data-cart-close]'),
    checkoutForm: document.getElementById('checkout-form'),
    transferBox: document.getElementById('transfer-box'),
    submitLabel: document.querySelector('[data-submit-label]'),
    formStatus: document.getElementById('form-status'),
    countdown: document.querySelector('[data-countdown]'),
    countdownDays: document.querySelector('[data-countdown-days]'),
    countdownHours: document.querySelector('[data-countdown-hours]'),
    countdownMinutes: document.querySelector('[data-countdown-minutes]'),
    countdownSeconds: document.querySelector('[data-countdown-seconds]'),
    bankHolder: document.querySelector('[data-bank-holder]'),
    bankAlias: document.querySelector('[data-bank-alias]'),
    bankCbu: document.querySelector('[data-bank-cbu]')
}

function formatPrice(value) {
    return currencyFormatter.format(value).replace(/\s/g, ' ')
}

function getCartTotal() {
    return state.quantity * TICKET_PRICE
}

function setText(element, value) {
    if (element) element.textContent = value
}

function updateCart() {
    const total = formatPrice(getCartTotal())

    setText(selectors.ticketQuantity, String(state.quantity))
    setText(selectors.ticketPlural, state.quantity === 1 ? '' : 's')
    setText(selectors.cartCount, String(state.quantity))
    setText(selectors.cartQuantity, String(state.quantity))
    setText(selectors.cartTotal, total)
    setText(selectors.cartLineTotal, total)
    setText(selectors.checkoutQuantity, String(state.quantity))
    setText(selectors.checkoutTotal, total)

    if (selectors.quantityDecrease) {
        selectors.quantityDecrease.disabled = state.quantity <= 1
    }
}

function changeQuantity(nextQuantity) {
    state.quantity = Math.max(1, Math.min(20, nextQuantity))
    updateCart()
}

function openCart() {
    selectors.cartPanel?.classList.add('is-open')
    document.body.classList.add('cart-open')
}

function closeCart() {
    selectors.cartPanel?.classList.remove('is-open')
    document.body.classList.remove('cart-open')
}

function getSelectedPaymentMethod() {
    const selected = selectors.checkoutForm?.querySelector('input[name="paymentMethod"]:checked')
    return selected?.value || 'mercadopago'
}

function updatePaymentUI() {
    const isTransfer = getSelectedPaymentMethod() === 'transfer'
    if (selectors.transferBox) {
        selectors.transferBox.hidden = !isTransfer
    }
    setText(selectors.submitLabel, isTransfer ? 'Reservar por transferencia' : 'Ir a Mercado Pago')
}

function setStatus(message, type = '') {
    if (!selectors.formStatus) return

    selectors.formStatus.textContent = message
    selectors.formStatus.classList.remove('is-error', 'is-success')
    if (type) {
        selectors.formStatus.classList.add(`is-${type}`)
    }
}

function getBuyerData(form) {
    const formData = new FormData(form)
    return {
        name: String(formData.get('buyerName') || '').trim(),
        email: String(formData.get('buyerEmail') || '').trim(),
        phone: String(formData.get('buyerPhone') || '').trim(),
        dni: String(formData.get('buyerDni') || '').trim(),
        institution: String(formData.get('buyerInstitution') || '').trim()
    }
}

function buildOrderPayload(form) {
    return {
        event: EVENT_NAME,
        date: '18 y 19 de septiembre de 2026',
        venue: 'Bahía Blanca Plaza Shopping',
        quantity: state.quantity,
        unitPrice: TICKET_PRICE,
        total: getCartTotal(),
        buyer: getBuyerData(form),
        source: window.location.href
    }
}

function buildOrderMessage(order) {
    const lines = [
        'Reserva de entrada CEBSA 2026',
        `Nombre: ${order.buyer.name}`,
        `Email: ${order.buyer.email}`,
        `Teléfono: ${order.buyer.phone}`,
        `DNI: ${order.buyer.dni}`,
        `Institución / ciudad: ${order.buyer.institution || '-'}`,
        `Entradas: ${order.quantity}`,
        `Total: ${formatPrice(order.total)}`
    ]

    return lines.join('\n')
}

function openConfirmationMessage(order) {
    const message = buildOrderMessage(order)

    if (CHECKOUT_CONFIG.whatsappNumber) {
        const whatsappUrl = new URL(`https://wa.me/${CHECKOUT_CONFIG.whatsappNumber}`)
        whatsappUrl.searchParams.set('text', message)
        window.open(whatsappUrl.toString(), '_blank', 'noopener')
        return
    }

    const emailUrl = new URL(`mailto:${CHECKOUT_CONFIG.confirmationEmail}`)
    emailUrl.searchParams.set('subject', 'Reserva de entrada CEBSA 2026')
    emailUrl.searchParams.set('body', message)
    window.location.href = emailUrl.toString()
}

async function redirectToMercadoPago(order) {
    if (CHECKOUT_CONFIG.mercadoPagoPreferenceEndpoint) {
        const response = await fetch(CHECKOUT_CONFIG.mercadoPagoPreferenceEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
        })

        if (!response.ok) {
            throw new Error('No se pudo crear la preferencia de Mercado Pago.')
        }

        const data = await response.json()
        const checkoutUrl = data.init_point || data.sandbox_init_point

        if (!checkoutUrl) {
            throw new Error('La respuesta de Mercado Pago no incluyó una URL de checkout.')
        }

        window.location.href = checkoutUrl
        return
    }

    if (CHECKOUT_CONFIG.mercadoPagoCheckoutUrl) {
        window.location.href = CHECKOUT_CONFIG.mercadoPagoCheckoutUrl
        return
    }

    throw new Error('Falta configurar el link de Mercado Pago o el endpoint que crea la preferencia.')
}

function handlePaymentChange() {
    updatePaymentUI()
    setStatus('')
}

async function handleCheckoutSubmit(event) {
    event.preventDefault()

    const form = event.currentTarget
    if (!form.reportValidity()) return

    const order = buildOrderPayload(form)
    const paymentMethod = getSelectedPaymentMethod()
    const submitButton = form.querySelector('button[type="submit"]')

    submitButton.disabled = true
    setStatus(paymentMethod === 'transfer' ? 'Generando la reserva...' : 'Preparando Mercado Pago...')

    try {
        if (paymentMethod === 'transfer') {
            localStorage.setItem('cebsa-last-order', JSON.stringify(order))
            setStatus('Reserva generada. Enviá el detalle junto con el comprobante para confirmar la entrada.', 'success')
            openConfirmationMessage(order)
            return
        }

        await redirectToMercadoPago(order)
    } catch (error) {
        setStatus(error.message, 'error')
    } finally {
        submitButton.disabled = false
    }
}

function hydrateTransferData() {
    setText(selectors.bankHolder, CHECKOUT_CONFIG.bankTransfer.holder || 'A completar')
    setText(selectors.bankAlias, CHECKOUT_CONFIG.bankTransfer.alias || 'A completar')
    setText(selectors.bankCbu, CHECKOUT_CONFIG.bankTransfer.cbu || 'A completar')
}

function updateCountdown() {
    if (!selectors.countdown) return

    const remaining = Math.max(0, EVENT_START_DATE.getTime() - Date.now())
    const totalSeconds = Math.floor(remaining / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    setText(selectors.countdownDays, String(days))
    setText(selectors.countdownHours, String(hours).padStart(2, '0'))
    setText(selectors.countdownMinutes, String(minutes).padStart(2, '0'))
    setText(selectors.countdownSeconds, String(seconds).padStart(2, '0'))
}

function initCountdown() {
    updateCountdown()
    window.setInterval(updateCountdown, 1000)
}

function initNavigation() {
    selectors.navToggle?.addEventListener('click', () => {
        const isOpen = selectors.navLinks?.classList.toggle('is-open') || false
        selectors.navToggle.setAttribute('aria-expanded', String(isOpen))
    })

    selectors.navLinks?.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            selectors.navLinks?.classList.remove('is-open')
            selectors.navToggle?.setAttribute('aria-expanded', 'false')
        })
    })

    window.addEventListener('scroll', () => {
        selectors.header?.classList.toggle('is-scrolled', window.scrollY > 16)
    }, { passive: true })
}

function initReveal() {
    const revealItems = Array.from(document.querySelectorAll('[data-reveal]'))

    if (!('IntersectionObserver' in window)) {
        revealItems.forEach((item) => item.classList.add('is-visible'))
        return
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
        })
    }, {
        threshold: 0.16
    })

    revealItems.forEach((item) => observer.observe(item))
}

function initCheckout() {
    selectors.quantityDecrease?.addEventListener('click', () => changeQuantity(state.quantity - 1))
    selectors.quantityIncrease?.addEventListener('click', () => changeQuantity(state.quantity + 1))
    selectors.cartToggle?.addEventListener('click', openCart)
    selectors.cartClose?.addEventListener('click', closeCart)

    selectors.checkoutForm?.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
        input.addEventListener('change', handlePaymentChange)
    })

    selectors.checkoutForm?.addEventListener('submit', handleCheckoutSubmit)

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCart()
        }
    })

    hydrateTransferData()
    updatePaymentUI()
    updateCart()
}

document.querySelector('[data-year]').textContent = String(new Date().getFullYear())
initNavigation()
initReveal()
initCheckout()
initCountdown()
