const STORE_PRODUCTS = [
    {
        id: 'uni-camisa-primaria',
        name: 'Camisa institucional Primaria',
        category: 'uniformes',
        description: 'Tela resistente, corte regular y bordado oficial del colegio.',
        price: 35500,
        stock: 18,
        sizes: ['8', '10', '12', '14', '16'],
        tags: ['Talles: 8 al 16', 'Algodon premium']
    },
    {
        id: 'uni-buzo-secundaria',
        name: 'Buzo oficial Secundaria',
        category: 'uniformes',
        description: 'Frisa liviana, interior suave y capucha con ajuste interno.',
        price: 49800,
        stock: 11,
        sizes: ['S', 'M', 'L', 'XL'],
        tags: ['Talles: S al XL', 'Edicion 2026']
    },
    {
        id: 'uni-educacion-fisica',
        name: 'Conjunto Educacion Fisica',
        category: 'uniformes',
        description: 'Remera dry-fit y short con logo del Solar.',
        price: 61200,
        stock: 8,
        sizes: ['6', '8', '10', '12', 'S', 'M', 'L'],
        tags: ['Talles: 6 al L', 'Secado rapido']
    },
    {
        id: 'mat-cuaderno-a4',
        name: 'Cuaderno personalizado A4',
        category: 'materiales',
        description: 'Tapa dura con identidad institucional y hojas rayadas de 80 g.',
        price: 9100,
        stock: 35,
        sizes: ['Unico'],
        tags: ['120 hojas', 'Linea clasica']
    },
    {
        id: 'mat-carpeta-anillada',
        name: 'Carpeta anillada Del Solar',
        category: 'materiales',
        description: 'Carpeta de 3 anillos con refuerzos y diseño exclusivo.',
        price: 14300,
        stock: 26,
        sizes: ['Unico'],
        tags: ['Lomo 4 cm', 'Incluye separadores']
    },
    {
        id: 'mat-kit-artistico',
        name: 'Kit artistico personalizado',
        category: 'materiales',
        description: 'Set de lapices, fibras y cartuchera bordada.',
        price: 28700,
        stock: 0,
        sizes: ['Unico'],
        tags: ['Uso escolar', 'Edicion limitada']
    }
]

const CART_STORAGE_KEY = 'solarStoreCart'

const currency = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
})

const refs = {
    grid: document.querySelector('[data-product-grid]'),
    resultsCount: document.querySelector('[data-results-count]'),
    cartCount: document.querySelector('[data-cart-count]'),
    search: document.querySelector('[data-filter-search]'),
    categoryButtons: Array.from(document.querySelectorAll('[data-filter-category] .chip')),
    price: document.querySelector('[data-filter-price]'),
    priceLabel: document.querySelector('[data-price-label]'),
    onlyStock: document.querySelector('[data-filter-stock]'),
    sort: document.querySelector('[data-filter-sort]'),
    clearFilters: document.querySelector('[data-clear-filters]'),
    template: document.getElementById('productCardTemplate')
}

const state = {
    category: 'all',
    query: '',
    maxPrice: Number(refs.price?.value || 90000),
    onlyStock: false,
    sortBy: 'featured'
}

function getCart() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]')
        if (!Array.isArray(parsed)) {
            return []
        }

        const normalized = parsed
            .map((item) => {
                const product = STORE_PRODUCTS.find((productItem) => productItem.id === item.id)
                if (!product) {
                    return null
                }

                const availableSizes = getAvailableSizes(product)
                const size = item.size || availableSizes[0]

                return {
                    id: item.id,
                    name: item.name || product.name,
                    category: item.category || product.category,
                    price: Number(item.price || product.price),
                    quantity: Math.max(1, Number(item.quantity || 1)),
                    maxStock: Number(item.maxStock || product.stock),
                    size,
                    availableSizes
                }
            })
            .filter(Boolean)

        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized))
        return normalized
    } catch {
        return []
    }
}

function setCart(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
}

function updateCartCounter() {
    if (!refs.cartCount) return

    const quantity = getCart().reduce((total, item) => total + Number(item.quantity || 0), 0)
    refs.cartCount.textContent = String(quantity)
}

function normalizeText(text) {
    return String(text)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
}

function sortProducts(products) {
    const data = [...products]

    if (state.sortBy === 'price-asc') {
        return data.sort((a, b) => a.price - b.price)
    }

    if (state.sortBy === 'price-desc') {
        return data.sort((a, b) => b.price - a.price)
    }

    if (state.sortBy === 'name') {
        return data.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }

    return data
}

function getFilteredProducts() {
    const query = normalizeText(state.query)

    const filtered = STORE_PRODUCTS.filter((product) => {
        const inCategory = state.category === 'all' || product.category === state.category
        const inPrice = product.price <= state.maxPrice
        const hasStock = !state.onlyStock || product.stock > 0
        const searchable = normalizeText(`${product.name} ${product.description} ${product.tags.join(' ')}`)
        const queryMatch = query === '' || searchable.includes(query)

        return inCategory && inPrice && hasStock && queryMatch
    })

    return sortProducts(filtered)
}

function getAvailableSizes(product) {
    return Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ['Unico']
}

function addToCart(productId, selectedSize) {
    const product = STORE_PRODUCTS.find((item) => item.id === productId)
    if (!product || product.stock < 1) {
        return
    }

    const size = selectedSize || getAvailableSizes(product)[0]
    const cart = getCart()
    const existing = cart.find((item) => item.id === productId && item.size === size)

    if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, product.stock)
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            quantity: 1,
            maxStock: product.stock,
            size,
            availableSizes: getAvailableSizes(product)
        })
    }

    setCart(cart)
    updateCartCounter()
}

function renderProducts() {
    if (!refs.grid || !refs.template || !refs.resultsCount) return

    const products = getFilteredProducts()
    refs.resultsCount.textContent = String(products.length)
    refs.grid.innerHTML = ''

    if (!products.length) {
        const empty = document.createElement('article')
        empty.className = 'product-empty'
        empty.innerHTML = '<h3>Sin resultados</h3><p>No encontramos productos con esos filtros. Proba ampliar la busqueda.</p>'
        refs.grid.appendChild(empty)
        return
    }

    products.forEach((product) => {
        const fragment = refs.template.content.cloneNode(true)
        const card = fragment.querySelector('.product-card')
        const category = fragment.querySelector('.product-card__category')
        const badge = fragment.querySelector('.product-card__badge')
        const name = fragment.querySelector('.product-card__name')
        const desc = fragment.querySelector('.product-card__desc')
        const meta = fragment.querySelector('.product-card__meta')
        const price = fragment.querySelector('.product-card__price')
        const sizeSelect = fragment.querySelector('.product-card__size-select')
        const addButton = fragment.querySelector('.button-add')

        category.textContent = product.category === 'uniformes' ? 'Uniformes' : 'Materiales'
        badge.textContent = product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'
        name.textContent = product.name
        desc.textContent = product.description
        price.textContent = currency.format(product.price)

        getAvailableSizes(product).forEach((size) => {
            const option = document.createElement('option')
            option.value = size
            option.textContent = size
            sizeSelect.appendChild(option)
        })

        product.tags.forEach((tag) => {
            const item = document.createElement('li')
            item.textContent = tag
            meta.appendChild(item)
        })

        addButton.textContent = product.stock > 0 ? 'Agregar' : 'No disponible'
        addButton.disabled = product.stock < 1
        sizeSelect.disabled = product.stock < 1

        addButton.addEventListener('click', () => {
            addToCart(product.id, sizeSelect.value)
            addButton.textContent = 'Agregado'
            setTimeout(() => {
                addButton.textContent = 'Agregar'
            }, 900)
        })

        if (product.category === 'materiales') {
            card.querySelector('.product-card__media').style.background =
                'linear-gradient(140deg, rgba(232, 173, 27, 0.96), rgba(255, 213, 94, 0.88))'
            card.querySelector('.product-card__media').style.color = '#283248'
        }

        refs.grid.appendChild(fragment)
    })
}

function clearFilters() {
    state.category = 'all'
    state.query = ''
    state.maxPrice = 90000
    state.onlyStock = false
    state.sortBy = 'featured'

    if (refs.search) refs.search.value = ''
    if (refs.price) refs.price.value = '90000'
    if (refs.onlyStock) refs.onlyStock.checked = false
    if (refs.sort) refs.sort.value = 'featured'

    refs.categoryButtons.forEach((button) => {
        button.classList.toggle('is-active', button.dataset.value === 'all')
    })

    if (refs.priceLabel) {
        refs.priceLabel.textContent = currency.format(90000)
    }

    renderProducts()
}

function bindEvents() {
    refs.search?.addEventListener('input', (event) => {
        state.query = event.target.value
        renderProducts()
    })

    refs.categoryButtons.forEach((button) => {
        button.addEventListener('click', () => {
            refs.categoryButtons.forEach((item) => item.classList.remove('is-active'))
            button.classList.add('is-active')
            state.category = button.dataset.value || 'all'
            renderProducts()
        })
    })

    refs.price?.addEventListener('input', (event) => {
        state.maxPrice = Number(event.target.value)
        if (refs.priceLabel) {
            refs.priceLabel.textContent = currency.format(state.maxPrice)
        }
        renderProducts()
    })

    refs.onlyStock?.addEventListener('change', (event) => {
        state.onlyStock = event.target.checked
        renderProducts()
    })

    refs.sort?.addEventListener('change', (event) => {
        state.sortBy = event.target.value
        renderProducts()
    })

    refs.clearFilters?.addEventListener('click', clearFilters)
}

updateCartCounter()
bindEvents()
renderProducts()
