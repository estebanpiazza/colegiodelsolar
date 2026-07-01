const TICKET_PRICE = 55000
const EVENT_NAME = 'CEBSA 2026 - Congreso de Educación y Bienestar Sur Argentino'
const EVENT_START_DATE = new Date('2026-09-18T09:00:00-03:00')

const CHECKOUT_CONFIG = {
    mercadoPagoCheckoutUrl: '',
    mercadoPagoPreferenceEndpoint: 'api/mercadopago-preference.php',
    mercadoPagoLocalPreferenceEndpoint: 'http://127.0.0.1:8000/api/mercadopago-preference.php',
    registrationsPublicCountEndpoint: 'api/inscripciones-public-count.php',
    confirmationEmail: 'cebsa@colegiodelsolar.edu.ar',
    whatsappNumber: '',
    bankTransfer: {
        holder: 'GASTON CASANOVA',
        cuit: '20-32586610-2',
        accountNumber: '0010799-2 082-6',
        cbu: '0070082520000010799262',
        alias: 'MUNDO.ONDA.LASTRE'
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
const EMAIL_MISMATCH_MESSAGE = 'Los emails no coinciden. Revisá que estén escritos igual.'

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
    attendeesBlock: document.getElementById('attendees-block'),
    attendeesFields: document.getElementById('attendees-fields'),
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
    bankCuit: document.querySelector('[data-bank-cuit]'),
    bankAccount: document.querySelector('[data-bank-account]'),
    bankCbu: document.querySelector('[data-bank-cbu]'),
    bankCbuCopy: document.querySelector('[data-bank-cbu-copy]'),
    bankAlias: document.querySelector('[data-bank-alias]'),
    bankAliasCopy: document.querySelector('[data-bank-alias-copy]'),
    transferModal: document.getElementById('transfer-modal'),
    transferModalClose: Array.from(document.querySelectorAll('[data-transfer-modal-close]')),
    transferEmail: document.querySelector('[data-transfer-email]'),
    transferTotal: document.querySelector('[data-transfer-total]'),
    transferEmailLink: document.querySelector('[data-transfer-email-link]'),
    publicInscriptos: document.querySelector('[data-public-inscriptos]'),
    paymentReturnModal: document.getElementById('payment-return-modal'),
    paymentReturnModalClose: Array.from(document.querySelectorAll('[data-payment-return-close]')),
    paymentReturnEmail: document.querySelector('[data-payment-return-email]')
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

    renderAttendeeFields()
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

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderAttendeeFields() {
    if (!selectors.attendeesBlock || !selectors.attendeesFields || !selectors.checkoutForm) return

    if (state.quantity <= 1) {
        selectors.attendeesBlock.hidden = true
        selectors.attendeesFields.innerHTML = ''
        return
    }

    const previousValues = {}
    selectors.attendeesFields.querySelectorAll('input').forEach((input) => {
        previousValues[input.name] = input.value
    })

    let markup = ''
    for (let personNumber = 2; personNumber <= state.quantity; personNumber += 1) {
        const nameKey = `attendeeName${personNumber}`
        const emailKey = `attendeeEmail${personNumber}`
        const dniKey = `attendeeDni${personNumber}`

        markup += `
            <fieldset class="attendee-person">
                <legend>Persona ${personNumber}</legend>
                <div class="form-grid">
                    <label class="form-field form-field--wide" for="attendee-name-${personNumber}">
                        <span>Nombre y apellido</span>
                        <input id="attendee-name-${personNumber}" name="${nameKey}" type="text" autocomplete="name" required placeholder="Nombre completo" value="${escapeHtml(previousValues[nameKey])}">
                    </label>
                    <label class="form-field" for="attendee-email-${personNumber}">
                        <span>Email</span>
                        <input id="attendee-email-${personNumber}" name="${emailKey}" type="email" autocomplete="email" required placeholder="nombre@correo.com" value="${escapeHtml(previousValues[emailKey])}">
                    </label>
                    <label class="form-field" for="attendee-dni-${personNumber}">
                        <span>DNI</span>
                        <input id="attendee-dni-${personNumber}" name="${dniKey}" type="text" inputmode="numeric" required placeholder="DNI" value="${escapeHtml(previousValues[dniKey])}">
                    </label>
                </div>
            </fieldset>
        `
    }

    selectors.attendeesFields.innerHTML = markup
    selectors.attendeesBlock.hidden = false
}

function getAdditionalAttendees(form) {
    const formData = new FormData(form)
    const attendees = []

    for (let personNumber = 2; personNumber <= state.quantity; personNumber += 1) {
        attendees.push({
            person: personNumber,
            name: String(formData.get(`attendeeName${personNumber}`) || '').trim(),
            email: String(formData.get(`attendeeEmail${personNumber}`) || '').trim(),
            dni: String(formData.get(`attendeeDni${personNumber}`) || '').trim()
        })
    }

    return attendees
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase()
}

function validateMatchingEmails(form) {
    const emailInput = form.elements.buyerEmail
    const emailConfirmInput = form.elements.buyerEmailConfirm

    if (!emailInput || !emailConfirmInput) return true

    const email = normalizeEmail(emailInput.value)
    const emailConfirm = normalizeEmail(emailConfirmInput.value)
    const emailsMatch = !email || !emailConfirm || email === emailConfirm

    emailConfirmInput.setCustomValidity(emailsMatch ? '' : EMAIL_MISMATCH_MESSAGE)
    return emailsMatch
}

function handleEmailInput(event) {
    const form = event.currentTarget.form
    if (!form) return

    if (validateMatchingEmails(form) && selectors.formStatus?.textContent === EMAIL_MISMATCH_MESSAGE) {
        setStatus('')
    }
}

function buildOrderPayload(form) {
    const attendees = getAdditionalAttendees(form)

    return {
        event: EVENT_NAME,
        date: '18 y 19 de septiembre de 2026',
        venue: 'Bahía Blanca Plaza Shopping',
        quantity: state.quantity,
        unitPrice: TICKET_PRICE,
        total: getCartTotal(),
        buyer: getBuyerData(form),
        attendees,
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

    if (Array.isArray(order.attendees) && order.attendees.length) {
        lines.push('')
        lines.push('Datos de asistentes:')
        order.attendees.forEach((attendee) => {
            lines.push(`Persona ${attendee.person}: ${attendee.name} | ${attendee.email} | DNI ${attendee.dni}`)
        })
    }

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

function openTransferModal(order) {
    if (!selectors.transferModal) {
        openConfirmationMessage(order)
        return
    }

    const message = buildOrderMessage(order)
    const emailUrl = new URL(`mailto:${CHECKOUT_CONFIG.confirmationEmail}`)
    emailUrl.searchParams.set('subject', 'Comprobante de transferencia - CEBSA 2026')
    emailUrl.searchParams.set('body', message)

    setText(selectors.transferEmail, CHECKOUT_CONFIG.confirmationEmail)
    setText(selectors.transferTotal, formatPrice(order.total))

    if (selectors.transferEmailLink) {
        selectors.transferEmailLink.href = emailUrl.toString()
    }

    selectors.transferModal.hidden = false
    document.body.classList.add('modal-open')
}

function closeTransferModal() {
    if (!selectors.transferModal) return

    selectors.transferModal.hidden = true
    document.body.classList.remove('modal-open')
}

function openPaymentReturnModal() {
    if (!selectors.paymentReturnModal) return

    setText(selectors.paymentReturnEmail, CHECKOUT_CONFIG.confirmationEmail)
    selectors.paymentReturnModal.hidden = false
    document.body.classList.add('modal-open')
}

function closePaymentReturnModal() {
    if (!selectors.paymentReturnModal) return

    selectors.paymentReturnModal.hidden = true
    document.body.classList.remove('modal-open')
}

function handleMercadoPagoReturn() {
    const params = new URLSearchParams(window.location.search)
    const paymentStatus = params.get('payment')

    if (!paymentStatus) return

    if (paymentStatus === 'success') {
        openPaymentReturnModal()
    } else if (paymentStatus === 'pending') {
        setStatus('El pago quedó pendiente en Mercado Pago. Te avisaremos por mail cuando se confirme.', 'success')
    } else if (paymentStatus === 'failure') {
        setStatus('No se pudo completar el pago en Mercado Pago. Podés intentarlo nuevamente o elegir transferencia bancaria.', 'error')
    }

    window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`)
}

function getMercadoPagoPreferenceEndpoint() {
    const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
    const isPhpServer = window.location.port === '8000'

    if (isLocalHost && !isPhpServer) {
        return CHECKOUT_CONFIG.mercadoPagoLocalPreferenceEndpoint
    }

    return CHECKOUT_CONFIG.mercadoPagoPreferenceEndpoint
}

async function redirectToMercadoPago(order) {
    const preferenceEndpoint = getMercadoPagoPreferenceEndpoint()

    if (preferenceEndpoint) {
        const response = await fetch(preferenceEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(order)
        })

        const rawResponse = await response.text()
        let data = {}

        try {
            data = rawResponse ? JSON.parse(rawResponse) : {}
        } catch {
            throw new Error('El servidor devolvió una respuesta inválida. Revisá el endpoint de Mercado Pago.')
        }

        if (!response.ok) {
            throw new Error(data.detail || data.error || 'No se pudo crear la preferencia de Mercado Pago.')
        }

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
    const emailsMatch = validateMatchingEmails(form)

    if (!form.reportValidity()) {
        if (!emailsMatch) {
            setStatus(EMAIL_MISMATCH_MESSAGE, 'error')
            form.elements.buyerEmailConfirm?.focus()
        }
        return
    }
    const order = buildOrderPayload(form)
    const paymentMethod = getSelectedPaymentMethod()
    const submitButton = form.querySelector('button[type="submit"]')

    submitButton.disabled = true
    setStatus(paymentMethod === 'transfer' ? 'Generando la reserva...' : 'Preparando Mercado Pago...')

    try {
        if (paymentMethod === 'transfer') {
            localStorage.setItem('cebsa-last-order', JSON.stringify(order))
            setStatus(`Reserva generada. Enviá el comprobante a ${CHECKOUT_CONFIG.confirmationEmail}; cuando se valide el pago te llegará por mail la confirmación con la entrada.`, 'success')
            openTransferModal(order)
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
    setText(selectors.bankCuit, CHECKOUT_CONFIG.bankTransfer.cuit || 'A completar')
    setText(selectors.bankAccount, CHECKOUT_CONFIG.bankTransfer.accountNumber || 'A completar')
    setText(selectors.bankCbu, CHECKOUT_CONFIG.bankTransfer.cbu || 'A completar')
    setText(selectors.bankAlias, CHECKOUT_CONFIG.bankTransfer.alias || 'A completar')
}

async function copyBankCbu() {
    const cbu = CHECKOUT_CONFIG.bankTransfer.cbu
    if (!cbu || !selectors.bankCbuCopy) return

    try {
        await navigator.clipboard.writeText(cbu)
        selectors.bankCbuCopy.textContent = 'Copiado'
        window.setTimeout(() => {
            selectors.bankCbuCopy.textContent = 'Copiar'
        }, 1800)
    } catch {
        setStatus('No se pudo copiar el CBU automáticamente. Seleccionalo y copialo manualmente.', 'error')
    }
}

async function copyBankAlias() {
    const alias = CHECKOUT_CONFIG.bankTransfer.alias
    if (!alias || !selectors.bankAliasCopy) return

    try {
        await navigator.clipboard.writeText(alias)
        selectors.bankAliasCopy.textContent = 'Copiado'
        window.setTimeout(() => {
            selectors.bankAliasCopy.textContent = 'Copiar'
        }, 1800)
    } catch {
        setStatus('No se pudo copiar el alias automaticamente. Seleccionalo y copialo manualmente.', 'error')
    }
}

async function hydratePublicInscriptosCounter() {
    if (!selectors.publicInscriptos || !CHECKOUT_CONFIG.registrationsPublicCountEndpoint) return

    try {
        const response = await fetch(CHECKOUT_CONFIG.registrationsPublicCountEndpoint, {
            method: 'GET',
            cache: 'no-store'
        })

        if (!response.ok) return

        const data = await response.json()
        const total = Number.parseInt(String(data.total_personas ?? ''), 10)
        if (!Number.isFinite(total) || total < 0) return

        selectors.publicInscriptos.textContent = `rsv: ${total}`
    } catch {
        // Contador opcional: si falla, no bloquea el checkout.
    }
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
    selectors.bankCbuCopy?.addEventListener('click', copyBankCbu)
    selectors.bankAliasCopy?.addEventListener('click', copyBankAlias)

    selectors.checkoutForm?.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
        input.addEventListener('change', handlePaymentChange)
    })
    selectors.checkoutForm?.querySelectorAll('input[name="buyerEmail"], input[name="buyerEmailConfirm"]').forEach((input) => {
        input.addEventListener('input', handleEmailInput)
    })

    selectors.checkoutForm?.addEventListener('submit', handleCheckoutSubmit)
    selectors.transferModalClose.forEach((button) => {
        button.addEventListener('click', closeTransferModal)
    })
    selectors.paymentReturnModalClose.forEach((button) => {
        button.addEventListener('click', closePaymentReturnModal)
    })

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCart()
            closeTransferModal()
            closePaymentReturnModal()
        }
    })

    hydrateTransferData()
    updatePaymentUI()
    updateCart()
    handleMercadoPagoReturn()
}

document.querySelector('[data-year]').textContent = String(new Date().getFullYear())
initNavigation()
initReveal()
initCheckout()
initCountdown()
hydratePublicInscriptosCounter()
