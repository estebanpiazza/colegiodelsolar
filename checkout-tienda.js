const CART_STORAGE_KEY = 'solarStoreCart'

const CHECKOUT_SIZE_CATALOG = {
    'uni-camisa-primaria': ['8', '10', '12', '14', '16'],
    'uni-buzo-secundaria': ['S', 'M', 'L', 'XL'],
    'uni-educacion-fisica': ['6', '8', '10', '12', 'S', 'M', 'L'],
    'mat-cuaderno-a4': ['Unico'],
    'mat-carpeta-anillada': ['Unico'],
    'mat-kit-artistico': ['Unico']
}

const currency = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
})

const refs = {
    cartCount: document.querySelector('[data-cart-count]'),
    checkoutItems: document.querySelector('[data-checkout-items]'),
    subtotal: document.querySelector('[data-total-subtotal]'),
    shipping: document.querySelector('[data-total-shipping]'),
    grandTotal: document.querySelector('[data-total-grand]'),
    itemTemplate: document.getElementById('checkoutItemTemplate'),
    form: document.querySelector('[data-checkout-form]'),
    status: document.querySelector('[data-checkout-status]')
}

function getCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
        if (!Array.isArray(parsed)) {
            return []
        }

        const normalized = parsed.map((item) => {
            const availableSizes = Array.isArray(item.availableSizes) && item.availableSizes.length
                ? item.availableSizes
                : (CHECKOUT_SIZE_CATALOG[item.id] || ['Unico'])

            return {
                ...item,
                size: item.size || availableSizes[0],
                availableSizes
            }
        })

        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized))
        return normalized
    } catch {
        return []
    }
}

function setCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

function updateCartBadge(cart) {
    if (!refs.cartCount) return

    const totalQty = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
    refs.cartCount.textContent = String(totalQty)
}

function calculateTotals(cart) {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const shipping = subtotal > 0 ? 3800 : 0
    return {
        subtotal,
        shipping,
        grandTotal: subtotal + shipping
    }
}

function updateTotals(cart) {
    const totals = calculateTotals(cart)
    if (refs.subtotal) refs.subtotal.textContent = currency.format(totals.subtotal)
    if (refs.shipping) refs.shipping.textContent = currency.format(totals.shipping)
    if (refs.grandTotal) refs.grandTotal.textContent = currency.format(totals.grandTotal)
}

function getLineKey(item) {
    return `${item.id}::${item.size || 'Unico'}`
}

function mutateQuantity(lineKey, action) {
    const cart = getCart()
    const item = cart.find((entry) => getLineKey(entry) === lineKey)

    if (!item) return

    if (action === 'increase') {
        const limit = Number(item.maxStock || 999)
        item.quantity = Math.min(item.quantity + 1, limit)
    }

    if (action === 'decrease') {
        item.quantity -= 1
    }

    if (action === 'remove' || item.quantity < 1) {
        const next = cart.filter((entry) => getLineKey(entry) !== lineKey)
        setCart(next)
        renderCheckout()
        return
    }

    setCart(cart)
    renderCheckout()
}

function updateItemSize(lineKey, newSize) {
    const cart = getCart()
    const item = cart.find((entry) => getLineKey(entry) === lineKey)

    if (!item) return

    item.size = newSize

    const deduped = []
    cart.forEach((entry) => {
        const existing = deduped.find((saved) => getLineKey(saved) === getLineKey(entry))
        if (existing) {
            const maxStock = Number(existing.maxStock || 999)
            existing.quantity = Math.min(existing.quantity + entry.quantity, maxStock)
            return
        }
        deduped.push(entry)
    })

    setCart(deduped)
    renderCheckout()
}

function renderCheckout() {
    if (!refs.checkoutItems || !refs.itemTemplate) return

    const cart = getCart()
    updateCartBadge(cart)
    updateTotals(cart)

    refs.checkoutItems.innerHTML = ''

    if (!cart.length) {
        refs.checkoutItems.innerHTML = '<p class="product-empty">Tu carrito esta vacio. Agrega productos desde la tienda para continuar.</p>'
        return
    }

    cart.forEach((item) => {
        const fragment = refs.itemTemplate.content.cloneNode(true)
        const wrapper = fragment.querySelector('.checkout-item')
        const name = fragment.querySelector('.checkout-item__name')
        const meta = fragment.querySelector('.checkout-item__meta')
        const sizeSelect = fragment.querySelector('.checkout-item__size-select')
        const qty = fragment.querySelector('.checkout-item__qty')
        const lineKey = getLineKey(item)

        name.textContent = item.name
        meta.textContent = `${item.category === 'uniformes' ? 'Uniformes' : 'Materiales'} · ${currency.format(item.price)} c/u`
        qty.textContent = String(item.quantity)

        const availableSizes = Array.isArray(item.availableSizes) && item.availableSizes.length
            ? item.availableSizes
            : [item.size || 'Unico']

        availableSizes.forEach((size) => {
            const option = document.createElement('option')
            option.value = size
            option.textContent = size
            option.selected = size === (item.size || 'Unico')
            sizeSelect.appendChild(option)
        })

        sizeSelect.addEventListener('change', (event) => {
            updateItemSize(lineKey, event.target.value)
        })

        wrapper.querySelectorAll('button[data-action]').forEach((button) => {
            button.addEventListener('click', () => mutateQuantity(lineKey, button.dataset.action || ''))
        })

        refs.checkoutItems.appendChild(fragment)
    })
}

function bindSubmit() {
    refs.form?.addEventListener('submit', (event) => {
        event.preventDefault()

        const cart = getCart()
        if (!cart.length) {
            if (refs.status) {
                refs.status.textContent = 'No hay productos en el carrito para confirmar.'
            }
            return
        }

        if (!refs.form.reportValidity()) {
            return
        }

        const formData = new FormData(refs.form)
        const payload = {
            buyer: {
                name: formData.get('buyerName'),
                email: formData.get('buyerEmail'),
                phone: formData.get('buyerPhone'),
                dni: formData.get('buyerDni')
            },
            student: {
                name: formData.get('studentName'),
                level: formData.get('studentLevel')
            },
            notes: formData.get('notes'),
            paymentMethod: formData.get('paymentMethod'),
            deliveryType: formData.get('deliveryType'),
            items: cart,
            totals: calculateTotals(cart),
            source: 'tienda-escolar-ui'
        }

        console.log('Pedido listo para backend:', payload)

        if (refs.status) {
            refs.status.textContent = 'Pedido confirmado en la vista. Siguiente paso: enviar este payload al endpoint de backend.'
        }

        refs.form.reset()
    })
}

bindSubmit()
renderCheckout()
